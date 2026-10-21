// worker/index.js — /api/* 路由 + guard()（Origin、body ≤ 32 KB、JSON、session / device cookie、D1 計數限速）
// 其餘路徑交給靜態資產。主模組只能 export handler（workerd 規定），共用工具放 handlers.js。
import * as H from './handlers.js';

const BODY_MAX = 32 * 1024;
const enc = new TextEncoder();

// headers = [[名, 值], …]（Set-Cookie 可能不只一個）
function json(status, body, headers = []) {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  for (const [k, v] of headers) h.append(k, v);
  return new Response(JSON.stringify(body), { status, headers: h });
}

const ROUTES = {
  'POST /api/session': { fn: H.session, auth: false },
  'GET /api/auth/nonce': { fn: H.nonce, auth: false, rate: ['auth', 10] },
  'POST /api/auth/google': { fn: H.authGoogle, auth: false, rate: ['auth', 10] },
  'GET /api/me': { fn: H.me, auth: true },
  'PUT /api/town': { fn: H.putTown, auth: true, rate: ['town', 30] },
  'POST /api/checkin': { fn: H.checkin, auth: true, rate: ['checkin', 30] },
  'POST /api/daily': { fn: H.daily, auth: true, rate: ['daily', 10] },
};
// 帶參數的路由
const PARAM_ROUTES = [
  { method: 'PUT', re: /^\/api\/grant\/([0-9a-f-]{36})\/memory$/, keys: ['id'], fn: H.memory, auth: true, rate: ['memory', 30] },
];
function match(method, path) {
  const exact = ROUTES[`${method} ${path}`];
  if (exact) return { route: exact, params: {} };
  for (const r of PARAM_ROUTES) {
    const m = r.method === method && path.match(r.re);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]])) };
  }
  return null;
}

async function guard(req, env) {
  const url = new URL(req.url);
  const hit = match(req.method, url.pathname);
  if (!hit) throw new H.ApiError(404, 'invalid', { reason: 'route' });
  const { route, params } = hit;

  const write = req.method !== 'GET';
  if (write) {
    const allowed = env.APP_ORIGIN.split(',').map((s) => s.trim());
    if (!allowed.includes(req.headers.get('origin'))) throw new H.ApiError(403, 'invalid', { reason: 'origin' });
  }
  let body = null;
  if (write) {
    const text = await req.text();
    if (enc.encode(text).length > BODY_MAX) throw new H.ApiError(413, 'invalid', { reason: 'size' });
    if (text) { try { body = JSON.parse(text); } catch { throw new H.ApiError(400, 'invalid', { reason: 'json' }); } }
  }
  const userId = await H.whoami(env, req);
  if (route.auth && !userId) throw new H.ApiError(401, 'unauthorized');
  // 限速鍵：有身分用 user，沒有用 IP 的 HMAC（不落地原文）
  if (route.rate) await H.rateLimit(env, `${route.rate[0]}:${userId ?? (await H.ipKey(env, req))}`, route.rate[1]);
  return route.fn({ req, env, body, userId, params });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      const { status = 200, body, headers = [] } = await guard(req, env);
      return json(status, body, headers);
    } catch (e) {
      if (e instanceof H.ApiError) return json(e.status, { error: { code: e.code, ...e.extra } }, e.headers ?? []);
      console.error(e); // 不回內部錯誤細節
      return json(500, { error: { code: 'invalid', reason: 'server' } });
    }
  },
};
