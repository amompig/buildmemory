// api.test.js — 打本機 wrangler dev（npx wrangler@4 dev --local --port 8787）的 /api/*
// 先跑：npx wrangler@4 d1 execute buildingyourmemory --local --file=schema.sql
// 執行：API=http://localhost:8787 node --test tests/api.test.js（沒設 API 就整檔略過）
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../shared/rules.js';
import { readFileSync } from 'node:fs';

const API = process.env.API;
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:8787';
// PROD=1：打正式站時略過會大量建帳的限速測試（正式環境 Cloudflare 會覆寫 cf-connecting-ip，假 IP 無效）
const heavy = { skip: (!API && '沒設 API') || (process.env.PROD && '正式站不跑大量建帳') };
// 記錄測試建的帳號，打正式站後可清掉（USERS_LOG=檔名）
import { appendFileSync } from 'node:fs';
const logUser = (id) => { if (process.env.USERS_LOG && id) appendFileSync(process.env.USERS_LOG, `${id}\n`); };
const HOUSES = JSON.parse(readFileSync(new URL('../data/houses.json', import.meta.url), 'utf8')).houses;
const opts = { skip: !API && '沒設 API（需要 wrangler dev）' };

// 每個測試用戶各自一個假 IP，避免撞到建帳的 IP 限速（正式環境 Cloudflare 會覆寫這個標頭，客端偽造無效）
const fakeIp = () => `10.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}`;
async function call(method, path, { body, cookie, origin = ORIGIN, raw, ip = fakeIp() } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (!process.env.PROD) headers['cf-connecting-ip'] = ip; // 正式站帶這個標頭會被 Cloudflare 邊緣直接 403
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const res = await fetch(API + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text, setCookie: res.headers.get('set-cookie') };
}
async function newUser() {
  const r = await call('POST', '/api/session', { body: {} });
  logUser(r.json.user_id);
  return { id: r.json.user_id, cookie: r.setCookie.split(';')[0] };
}
const op = () => crypto.randomUUID();
const me = (u) => call('GET', '/api/me', { cookie: u.cookie }).then((r) => r.json);

test('session：沒有 Origin → 403；Origin 不在名單 → 403', opts, async () => {
  assert.equal((await call('POST', '/api/session', { body: {}, origin: null })).status, 403);
  assert.equal((await call('POST', '/api/session', { body: {}, origin: 'https://evil.example' })).status, 403);
});

test('session：建帳 → HttpOnly device cookie；首啟贈品 2 棟 stock + 預鋪路 grid', opts, async () => {
  const r = await call('POST', '/api/session', { body: {} });
  logUser(r.json.user_id);
  assert.equal(r.status, 200);
  assert.match(r.setCookie, /^bym_device=[0-9a-f-]{36}\.[0-9a-f]{64}; Path=\/api; HttpOnly; SameSite=Lax/);
  if (process.env.PROD) assert.match(r.setCookie, /; Secure/);
  const m = await me({ cookie: r.setCookie.split(';')[0] });
  assert.equal(m.user_id, r.json.user_id);
  assert.deepEqual(m.grants.map((g) => [g.item_id, g.state, g.seed]).sort(), [['sys:iron', 'stock', 0], ['sys:minnan', 'stock', 0]]);
  assert.deepEqual(m.town.grid, R.starterGrid());
  assert.equal(m.town.rev, 0);
  assert.equal(R.validateGrid(m.town.grid, m.grants, HOUSES).ok, true);
  assert.equal(m.bound, false);
});

test('session：帶有效 cookie 再呼叫 → 同一帳號、不重發贈品', opts, async () => {
  const u = await newUser();
  const r = await call('POST', '/api/session', { body: {}, cookie: u.cookie });
  assert.equal(r.json.user_id, u.id);
  assert.equal((await me(u)).grants.length, 2);
});

test('me：無 cookie / 竄改簽章 / 換成別人的 id → 401', opts, async () => {
  const u = await newUser(), v = await newUser();
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('GET', '/api/me', { cookie: u.cookie.slice(0, -1) + (u.cookie.endsWith('0') ? '1' : '0') })).status, 401);
  const [, sig] = u.cookie.split('.');
  assert.equal((await call('GET', '/api/me', { cookie: `bym_device=${v.id}.${sig}` })).status, 401);
});

test('town：放房 → rev+1、grant → placed；收回 → stock', opts, async () => {
  const u = await newUser();
  const { grants } = await me(u);
  const minnan = grants.find((g) => g.item_id === 'sys:minnan');
  const grid = R.starterGrid();
  grid[R.idx(6, 5)] = { t: 'house', id: 'sys:minnan', ref: minnan.id, rot: 1 };
  const r = await call('PUT', '/api/town', { cookie: u.cookie, body: { grid, base_rev: 0, op_id: op() } });
  assert.deepEqual([r.status, r.json], [200, { rev: 1 }]);
  let m = await me(u);
  assert.equal(m.grants.find((g) => g.id === minnan.id).state, 'placed');
  assert.deepEqual(m.town.grid[R.idx(6, 5)], grid[R.idx(6, 5)]);
  const r2 = await call('PUT', '/api/town', { cookie: u.cookie, body: { grid: R.starterGrid(), base_rev: 1, op_id: op() } });
  assert.equal(r2.json.rev, 2);
  m = await me(u);
  assert.equal(m.grants.find((g) => g.id === minnan.id).state, 'stock');
});

test('town：同一 op_id 重送 → 同結果、不再 +1', opts, async () => {
  const u = await newUser(), id = op();
  const body = { grid: R.starterGrid(), base_rev: 0, op_id: id };
  assert.equal((await call('PUT', '/api/town', { cookie: u.cookie, body })).json.rev, 1);
  const again = await call('PUT', '/api/town', { cookie: u.cookie, body });
  assert.deepEqual([again.status, again.json], [200, { rev: 1 }]);
  assert.equal((await me(u)).town.rev, 1);
});

test('town：base_rev 過期 → 409 conflict{rev, grid}', opts, async () => {
  const u = await newUser();
  const g1 = R.starterGrid(); g1[R.idx(6, 6)] = { t: 'road' };
  await call('PUT', '/api/town', { cookie: u.cookie, body: { grid: g1, base_rev: 0, op_id: op() } });
  const r = await call('PUT', '/api/town', { cookie: u.cookie, body: { grid: R.starterGrid(), base_rev: 0, op_id: op() } });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, 'conflict');
  assert.equal(r.json.error.rev, 1);
  assert.deepEqual(r.json.error.grid, g1);
});

test('town：規則不符 → 400 invalid{reason}，伺服器狀態不變', opts, async () => {
  const u = await newUser(), v = await newUser();
  const mine = (await me(u)).grants[0], theirs = (await me(v)).grants[0];
  const cases = [
    ['no_road', (g) => { g[R.idx(4, 4)] = { t: 'house', id: mine.item_id, ref: mine.id, rot: 0 }; }],
    ['ref', (g) => { g[R.idx(6, 5)] = { t: 'house', id: theirs.item_id, ref: theirs.id, rot: 0 }; }],
    ['schema', (g) => { g[R.idx(6, 5)] = { t: 'house', id: mine.item_id, ref: mine.id, rot: 0, selected: true }; }],
    ['locked', (g) => { g[R.idx(2, 2)] = { t: 'road' }; }],
  ];
  for (const [reason, mutate] of cases) {
    const grid = R.starterGrid(); mutate(grid);
    const r = await call('PUT', '/api/town', { cookie: u.cookie, body: { grid, base_rev: 0, op_id: op() } });
    assert.deepEqual([r.status, r.json.error], [400, { code: 'invalid', reason }], reason);
  }
  const m = await me(u);
  assert.equal(m.town.rev, 0);
  assert.ok(m.grants.every((g) => g.state === 'stock'));
});

test('town：缺 op_id / base_rev → schema；壞 JSON → json；> 32 KB → 413', opts, async () => {
  const u = await newUser();
  assert.equal((await call('PUT', '/api/town', { cookie: u.cookie, body: { grid: R.starterGrid(), base_rev: 0 } })).json.error.reason, 'schema');
  assert.equal((await call('PUT', '/api/town', { cookie: u.cookie, raw: '{"grid":' })).json.error.reason, 'json');
  assert.equal((await call('PUT', '/api/town', { cookie: u.cookie, raw: JSON.stringify({ pad: 'x'.repeat(33 * 1024) }) })).status, 413);
});

test('town：每人每分鐘 30 次，第 31 次 → 429 rate_limited{retry_after}', opts, async () => {
  const u = await newUser();
  const statuses = [];
  for (let i = 0; i < 31; i++) statuses.push((await call('PUT', '/api/town', { cookie: u.cookie, body: { base_rev: -1 } })).status);
  assert.equal(statuses.slice(0, 30).every((s) => s === 400), true);
  const last = await call('PUT', '/api/town', { cookie: u.cookie, body: { base_rev: -1 } });
  assert.equal(last.status, 429);
  assert.ok(last.json.error.retry_after > 0);
});

test('session：同一 IP 每分鐘建帳 30 次，第 31 次 → 429', heavy, async () => {
  const ip = fakeIp(), st = [];
  for (let i = 0; i < 31; i++) st.push((await call('POST', '/api/session', { body: {}, ip })).status);
  assert.deepEqual([st.slice(0, 30).every((s) => s === 200), st[30]], [true, 429]);
});

test('路由：未知 /api → 404；非 /api 交給靜態資產', opts, async () => {
  assert.equal((await call('GET', '/api/nope')).status, 404);
  const home = await call('GET', '/');
  assert.equal(home.status, 200);
  assert.match(home.text, /<canvas id="town">/);
});
