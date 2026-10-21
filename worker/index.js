// worker/index.js — /api/* 路由 + guard()（Origin、body ≤ 32 KB、JSON、device cookie、D1 計數限速）
// 其餘路徑交給靜態資產。驗證規則只呼叫 shared/rules.js（在 handlers.js）。
import * as H from './handlers.js';

const BODY_MAX = 32 * 1024;
const COOKIE = 'bym_device';
const COOKIE_DAYS = 400;

export class ApiError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
});

// ---------- device cookie：<userId>.<HMAC-SHA256(userId, DEVICE_SECRET)> ----------
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
// 長度相同才比、逐字元比完（不提早結束）
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function deviceCookie(env, userId) {
  const secure = env.ENV === 'dev' ? '' : '; Secure';
  return `${COOKIE}=${userId}.${await hmac(env.DEVICE_SECRET, userId)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_DAYS * 86400}${secure}`;
}
async function userIdFromCookie(env, req) {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f-]{36})\\.([0-9a-f]{64})`));
  if (!m) return null;
  return safeEqual(await hmac(env.DEVICE_SECRET, m[1]), m[2]) ? m[1] : null;
}

// ---------- D1 計數限速（每分鐘一格）----------
export async function rateLimit(env, key, perMin) {
  const win = Math.floor(Date.now() / 60000);
  const row = await env.DB.prepare(
    'INSERT INTO rate (key, win, n) VALUES (?, ?, 1) ON CONFLICT (key, win) DO UPDATE SET n = n + 1 RETURNING n',
  ).bind(key, win).first();
  if (row.n > perMin) throw new ApiError(429, 'rate_limited', { retry_after: 60 - Math.floor((Date.now() / 1000) % 60) });
}

const ROUTES = {
  'POST /api/session': { fn: H.session, auth: false },
  'GET /api/me': { fn: H.me, auth: true },
  'PUT /api/town': { fn: H.putTown, auth: true, rate: ['town', 30] },
};

async function guard(req, env) {
  const url = new URL(req.url);
  const route = ROUTES[`${req.method} ${url.pathname}`];
  if (!route) throw new ApiError(404, 'invalid', { reason: 'route' });

  const write = req.method !== 'GET';
  if (write) {
    const allowed = env.APP_ORIGIN.split(',').map((s) => s.trim());
    if (!allowed.includes(req.headers.get('origin'))) throw new ApiError(403, 'invalid', { reason: 'origin' });
  }
  let body = null;
  if (write) {
    const text = await req.text();
    if (enc.encode(text).length > BODY_MAX) throw new ApiError(413, 'invalid', { reason: 'size' });
    if (text) { try { body = JSON.parse(text); } catch { throw new ApiError(400, 'invalid', { reason: 'json' }); } }
  }
  let userId = null;
  if (route.auth) {
    userId = await userIdFromCookie(env, req);
    if (!userId || !(await H.userExists(env, userId))) throw new ApiError(401, 'unauthorized');
    if (route.rate) await rateLimit(env, `${route.rate[0]}:${userId}`, route.rate[1]);
  }
  return route.fn({ req, env, body, userId, cookieUser: route.auth ? userId : await userIdFromCookie(env, req) });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      const { status = 200, body, headers } = await guard(req, env);
      return json(status, body, headers);
    } catch (e) {
      if (e instanceof ApiError) return json(e.status, { error: { code: e.code, ...e.extra } });
      console.error(e); // 不回內部錯誤細節
      return json(500, { error: { code: 'invalid', reason: 'server' } });
    }
  },
};
