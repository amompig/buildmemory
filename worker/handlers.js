// worker/handlers.js — 各端點邏輯；驗證只呼叫 shared/rules.js。user_id 只取自 cookie（guard 給的 userId）。
import * as R from '../shared/rules.js';
import housesJson from '../data/houses.json';
import { ApiError, deviceCookie, hmac, rateLimit } from './index.js';

const HOUSES = housesJson.houses;
const DATA_VERSION = housesJson.data_version;
export const SESSION_PER_MIN = 30;
const now = () => new Date().toISOString();
const invalid = (reason) => new ApiError(400, 'invalid', { reason });

export async function userExists(env, id) {
  return !!(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first());
}

// POST /api/session：已有有效 device cookie → 沿用；否則建帳 + 首啟贈品（2 棟 stock + 預鋪路 grid）
export async function session({ req, env, cookieUser }) {
  if (cookieUser && (await userExists(env, cookieUser))) {
    await env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now(), cookieUser).run();
    return { body: { user_id: cookieUser, data_version: DATA_VERSION } };
  }
  // 建帳以 IP 限速（IP 只以 HMAC 雜湊當計數鍵，不落地原文）；30/min 留給電信 CGNAT 共用 IP 的空間
  const ip = req.headers.get('cf-connecting-ip') ?? 'local';
  await rateLimit(env, `session:${(await hmac(env.DEVICE_SECRET, ip)).slice(0, 32)}`, SESSION_PER_MIN);

  const id = crypto.randomUUID(), t = now();
  const db = env.DB;
  await db.batch([
    db.prepare('INSERT INTO users (id, created_at, last_seen) VALUES (?, ?, ?)').bind(id, t, t),
    ...R.STARTER_HOUSES.map((item) => db.prepare(
      "INSERT INTO grants (id, user_id, kind, item_id, state, seed, visit_n, at) VALUES (?, ?, 'house', ?, 'stock', 0, 1, ?)",
    ).bind(crypto.randomUUID(), id, item, t)),
    db.prepare('INSERT INTO towns (id, user_id, grid_json, rev, updated_at) VALUES (?, ?, ?, 0, ?)')
      .bind(crypto.randomUUID(), id, JSON.stringify(R.starterGrid()), t),
  ]);
  return { body: { user_id: id, data_version: DATA_VERSION }, headers: { 'set-cookie': await deviceCookie(env, id) } };
}

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
