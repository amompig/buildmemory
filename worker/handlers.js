// worker/handlers.js — 各端點邏輯 + 共用工具（cookie、HMAC、限速、Google id_token 驗證）
// 驗證規則只呼叫 shared/rules.js。user_id 只取自 cookie（guard 給的 userId），不收客端自報。
import * as R from '../shared/rules.js';
import housesJson from '../data/houses.json';

const HOUSES = housesJson.houses;
const DATA_VERSION = housesJson.data_version;
export const SESSION_PER_MIN = 30;
const DEVICE = 'bym_device', SESSION = 'bym_session', NONCE = 'bym_nonce';
const DAY_S = 86400, DEVICE_DAYS = 400, SESSION_DAYS = 30, NONCE_S = 300;
const now = () => new Date().toISOString();
const enc = new TextEncoder();

export class ApiError extends Error {
  constructor(status, code, extra = {}, headers = []) { super(code); this.status = status; this.code = code; this.extra = extra; this.headers = headers; }
}
const invalid = (reason) => new ApiError(400, 'invalid', { reason });

// ---------- cookie / 雜湊 ----------
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
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
const cookieOf = (req, name) => {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
};
const setCookie = (env, name, value, maxAgeS) =>
  ['set-cookie', `${name}=${value}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${env.ENV === 'dev' ? '' : '; Secure'}`];
const deviceCookie = async (env, id) => setCookie(env, DEVICE, `${id}.${await hmac(env.DEVICE_SECRET, id)}`, DEVICE_DAYS * DAY_S);
export const ipKey = async (env, req) => (await hmac(env.DEVICE_SECRET, req.headers.get('cf-connecting-ip') ?? 'local')).slice(0, 32);

// ---------- D1 計數限速（每分鐘一格）----------
export async function rateLimit(env, key, perMin) {
  const win = Math.floor(Date.now() / 60000);
  const row = await env.DB.prepare(
    'INSERT INTO rate (key, win, n) VALUES (?, ?, 1) ON CONFLICT (key, win) DO UPDATE SET n = n + 1 RETURNING n',
  ).bind(key, win).first();
  if (row.n > perMin) throw new ApiError(429, 'rate_limited', { retry_after: 60 - Math.floor((Date.now() / 1000) % 60) });
}

// ---------- 身分 ----------
// device cookie 只代表「未綁定、未併入」的訪客帳；綁定 Google 後只認 session（30 天滑動、可撤銷）
async function guestFromDevice(env, req) {
  const m = (cookieOf(req, DEVICE) ?? '').match(/^([0-9a-f-]{36})\.([0-9a-f]{64})$/);
  if (!m || !safeEqual(await hmac(env.DEVICE_SECRET, m[1]), m[2])) return null;
  const ok = await env.DB.prepare('SELECT 1 FROM users WHERE id = ? AND google_sub IS NULL AND merged_into IS NULL').bind(m[1]).first();
  return ok ? m[1] : null;
}
async function userFromSession(env, req) {
  const token = cookieOf(req, SESSION);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const hash = await sha256(token), t = Date.now();
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE id_hash = ?').bind(hash).first();
  if (!row || Date.parse(row.expires_at) <= t) return null;
  // 滑動：剩不到 29 天才寫回（每天最多一次）
  if (Date.parse(row.expires_at) - t < (SESSION_DAYS - 1) * DAY_S * 1000) {
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id_hash = ?').bind(new Date(t + SESSION_DAYS * DAY_S * 1000).toISOString(), hash).run();
  }
  return row.user_id;
}
export const whoami = async (env, req) => (await userFromSession(env, req)) ?? (await guestFromDevice(env, req));

// 建帳 + 首啟贈品（2 棟 stock + 預鋪路 grid）；googleSub 有值 = 直接以 Google 建帳
async function createUser(env, googleSub = null) {
  const id = crypto.randomUUID(), t = now(), db = env.DB;
  await db.batch([
    db.prepare('INSERT INTO users (id, google_sub, created_at, last_seen) VALUES (?, ?, ?, ?)').bind(id, googleSub, t, t),
    ...R.STARTER_HOUSES.map((item) => db.prepare(
      "INSERT INTO grants (id, user_id, kind, item_id, state, seed, visit_n, at) VALUES (?, ?, 'house', ?, 'stock', 0, 1, ?)",
    ).bind(crypto.randomUUID(), id, item, t)),
    db.prepare('INSERT INTO towns (id, user_id, grid_json, rev, updated_at) VALUES (?, ?, ?, 0, ?)')
      .bind(crypto.randomUUID(), id, JSON.stringify(R.starterGrid()), t),
  ]);
  return id;
}

// POST /api/session：已有身分 → 沿用；否則建訪客帳 + device cookie
export async function session({ req, env, userId }) {
  if (userId) {
    await env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now(), userId).run();
    return { body: { user_id: userId, data_version: DATA_VERSION } };
  }
  // 建帳以 IP 限速；30/min 留給電信 CGNAT 共用 IP 的空間
  await rateLimit(env, `session:${await ipKey(env, req)}`, SESSION_PER_MIN);
  const id = await createUser(env);
  return { body: { user_id: id, data_version: DATA_VERSION }, headers: [await deviceCookie(env, id)] };
}

// ---------- Google 登入 ----------
// GET /api/auth/nonce：nonce 綁 HttpOnly cookie 5 分鐘；client_id 是公開值，一併給前端
export async function nonce({ env }) {
  const n = randomHex(32);
  return { body: { nonce: n, client_id: env.GOOGLE_CLIENT_ID }, headers: [setCookie(env, NONCE, n, NONCE_S)] };
}

const b64urlBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));
let jwks = { at: 0, keys: [] };
async function googleKeys(env, force = false) {
  // 只有本機 dev 能用測試金鑰組（正式環境一律 Google）
  if (env.ENV === 'dev' && env.TEST_JWKS) return JSON.parse(env.TEST_JWKS).keys;
  if (force || !jwks.keys.length || Date.now() - jwks.at > 3600e3) {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    jwks = { at: Date.now(), keys: (await r.json()).keys };
  }
  return jwks.keys;
}
// RS256 簽章 + iss / aud / azp / exp / iat / nonce；任何不符一律同一個錯（不給 oracle）
async function verifyIdToken(env, token, expectedNonce) {
  const bad = () => new ApiError(401, 'unauthorized', { reason: 'token' });
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) throw bad();
  let header, p;
  try { header = b64urlJson(parts[0]); p = b64urlJson(parts[1]); } catch { throw bad(); }
  if (header.alg !== 'RS256') throw bad(); // 擋 alg:none / HS256 混淆
  let jwk = (await googleKeys(env)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(env, true)).find((k) => k.kid === header.kid); // Google 輪替金鑰
  if (!jwk) throw bad();
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  const t = Date.now() / 1000;
  if (!ok
    || !['https://accounts.google.com', 'accounts.google.com'].includes(p.iss)
    || p.aud !== env.GOOGLE_CLIENT_ID || (p.azp !== undefined && p.azp !== env.GOOGLE_CLIENT_ID)
    || !(p.exp > t - 60) || !(p.iat > t - 600 - 60)
    || typeof p.sub !== 'string' || !/^\d{1,64}$/.test(p.sub)
    || typeof p.nonce !== 'string' || !expectedNonce || !safeEqual(p.nonce, expectedNonce)) throw bad();
  return p.sub;
}

// POST /api/auth/google {credential}
// Google 帳尚無資料 → 綁到目前的訪客帳；已有資料 → 訪客帳的打卡所得併入（首啟贈品不併，免得刷新帳洗房），鎮以 Google 帳為主
export async function authGoogle({ req, env, body, userId }) {
  const clear = setCookie(env, NONCE, '', 0); // nonce 用一次就清，任何結果都清
  let sub;
  try { sub = await verifyIdToken(env, body?.credential, cookieOf(req, NONCE)); } catch (e) { e.headers = [clear]; throw e; }

  const db = env.DB, t = now();
  const g = await db.prepare('SELECT id FROM users WHERE google_sub = ?').bind(sub).first();
  const cur = userId && (await db.prepare('SELECT id, google_sub, created_at FROM users WHERE id = ?').bind(userId).first());
  const guest = cur && !cur.google_sub ? cur : null;
  let target, merged = false;
  if (!g && guest) {
    await db.prepare('UPDATE users SET google_sub = ?, last_seen = ? WHERE id = ? AND google_sub IS NULL').bind(sub, t, guest.id).run();
    target = guest.id;
  } else if (!g) {
    target = await createUser(env, sub);
  } else {
    target = g.id;
    if (guest && guest.id !== target) {
      merged = true;
      await db.batch([
        db.prepare("UPDATE grants SET user_id = ?, state = CASE state WHEN 'dismantled' THEN 'dismantled' ELSE 'stock' END WHERE user_id = ? AND at <> ?")
          .bind(target, guest.id, guest.created_at),
        db.prepare('UPDATE OR IGNORE checkins SET user_id = ? WHERE user_id = ?').bind(target, guest.id),
        db.prepare('UPDATE users SET merged_into = ?, last_seen = ? WHERE id = ?').bind(target, t, guest.id),
      ]);
    }
  }
  const token = randomHex(32);
  await db.prepare('INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), target, new Date(Date.now() + SESSION_DAYS * DAY_S * 1000).toISOString(), t).run();
  return { body: { user_id: target, merged }, headers: [clear, setCookie(env, SESSION, token, SESSION_DAYS * DAY_S)] };
}

// ---------- 帳本與城鎮 ----------
const GRANT_COLS = 'id, kind, item_id, state, seed, landmark_id, visit_n, mood, note, at, consumed_at';
const grantsOf = async (env, userId) =>
  (await env.DB.prepare(`SELECT ${GRANT_COLS} FROM grants WHERE user_id = ? ORDER BY at, id`).bind(userId).all()).results;
const townOf = (env, userId) => env.DB.prepare('SELECT id, grid_json, rev, last_op FROM towns WHERE user_id = ? LIMIT 1').bind(userId).first();

// GET /api/me
export async function me({ env, userId }) {
  const [user, grants, town] = await Promise.all([
    env.DB.prepare('SELECT google_sub FROM users WHERE id = ?').bind(userId).first(),
    grantsOf(env, userId),
    townOf(env, userId),
  ]);
  return {
    body: {
      user_id: userId, bound: !!user.google_sub, grants,
      town: { id: town.id, grid: JSON.parse(town.grid_json), rev: town.rev },
      shards: R.shards(grants), data_version: DATA_VERSION, server_time: now(),
    },
  };
}

// PUT /api/town {grid, base_rev, op_id}：rev 樂觀鎖 → validateGrid → batch（鎮 + grant state）
export async function putTown({ env, body, userId }) {
  const { grid, base_rev, op_id } = body ?? {};
  if (!Number.isInteger(base_rev) || typeof op_id !== 'string' || !/^[0-9a-f-]{8,64}$/i.test(op_id)) throw invalid('schema');
  const town = await townOf(env, userId);
  if (town.last_op === op_id) return { body: { rev: town.rev } }; // 重送：回同一結果

  const conflict = (t) => new ApiError(409, 'conflict', { rev: t.rev, grid: JSON.parse(t.grid_json) });
  if (!R.applyTown(base_rev, town.rev, null).ok) throw conflict(town);
  const v = R.validateGrid(grid, await grantsOf(env, userId), HOUSES);
  if (!v.ok) throw invalid(v.reason);

  const refs = JSON.stringify(grid.filter((x) => x?.t === 'house').map((x) => x.ref));
  const t = now(), db = env.DB;
  // 第 1 句 rev 對得上才會寫入 last_op；後兩句以 last_op = 本次 op_id 為條件 → 整批要嘛一起生效、要嘛都不動
  const mine = 'EXISTS (SELECT 1 FROM towns WHERE id = ? AND last_op = ?)';
  const res = await db.batch([
    db.prepare('UPDATE towns SET grid_json = ?, rev = rev + 1, last_op = ?, updated_at = ? WHERE id = ? AND rev = ?')
      .bind(JSON.stringify(grid), op_id, t, town.id, base_rev),
    db.prepare(`UPDATE grants SET state = 'placed' WHERE user_id = ? AND state = 'stock' AND id IN (SELECT value FROM json_each(?)) AND ${mine}`)
      .bind(userId, refs, town.id, op_id),
    db.prepare(`UPDATE grants SET state = 'stock' WHERE user_id = ? AND state = 'placed' AND id NOT IN (SELECT value FROM json_each(?)) AND ${mine}`)
      .bind(userId, refs, town.id, op_id),
  ]);
  if (res[0].meta.changes !== 1) throw conflict(await townOf(env, userId)); // 併發：別人先寫了
  return { body: { rev: base_rev + 1 } };
}
