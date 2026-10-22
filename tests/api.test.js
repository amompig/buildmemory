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
const CATALOG = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8')), HOUSES = CATALOG.houses;
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
  // 首啟 20 棟：含鐵窗厝與日式宿舍，其餘為城市池的 1×1；全部待放、變體在範圍內
  assert.equal(m.grants.length, R.STARTER_TOTAL);
  assert.ok(['sys:iron', 'sys:jpdorm'].every((id) => m.grants.some((g) => g.item_id === id)));
  const pool = Object.keys(CATALOG.pools.groups[CATALOG.pools.default_group]);
  assert.ok(m.grants.every((g) => pool.includes(g.item_id) && g.state === 'stock' && g.kind === 'house'
    && g.seed >= 0 && g.seed < HOUSES.find((h) => h.id === g.item_id).palettes.length), JSON.stringify(m.grants.map((g) => [g.item_id, g.seed])));
  assert.deepEqual(m.town.grid, R.starterGrid());
  assert.equal(m.town.rev, 0);
  assert.equal(R.validateGrid(m.town.grid, m.grants, HOUSES).ok, true);
  assert.equal(m.bound, false);
});

test('session：帶有效 cookie 再呼叫 → 同一帳號、不重發贈品', opts, async () => {
  const u = await newUser();
  const r = await call('POST', '/api/session', { body: {}, cookie: u.cookie });
  assert.equal(r.json.user_id, u.id);
  assert.equal((await me(u)).grants.length, R.STARTER_TOTAL);
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
  const minnan = grants.find((g) => g.item_id === 'sys:jpdorm');
  const grid = R.starterGrid();
  grid[R.idx(6, 5)] = { t: 'house', id: 'sys:jpdorm', ref: minnan.id, rot: 1 };
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

// ---------- Google 登入（本機：wrangler dev 讀 .dev.vars 的 TEST_JWKS，用 fixtures 私鑰簽假 id_token）----------
import { createSign, createPrivateKey } from 'node:crypto';
const KEY = JSON.parse(readFileSync(new URL('./fixtures/test_google_key.json', import.meta.url), 'utf8'));
const CLIENT = 'test-client.apps.googleusercontent.com';
const local = { skip: (!API && '沒設 API') || (process.env.PROD && '正式站沒有測試金鑰') };
const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
function idToken(claims = {}, header = {}) {
  const t = Math.floor(Date.now() / 1000);
  const h = { alg: 'RS256', kid: KEY.private.kid, typ: 'JWT', ...header };
  const p = { iss: 'https://accounts.google.com', aud: CLIENT, azp: CLIENT, sub: String(1e15 + Math.floor(Math.random() * 1e15)), iat: t, exp: t + 3600, ...claims };
  const data = `${b64u(h)}.${b64u(p)}`;
  if (h.alg !== 'RS256') return `${data}.`;
  return `${data}.${createSign('RSA-SHA256').update(data).sign(createPrivateKey({ key: KEY.private, format: 'jwk' })).toString('base64url')}`;
}
const cookiesFrom = (setCookie) => (setCookie ?? '').split(/,(?=\s*bym_)/).map((c) => c.trim().split(';')[0]).filter((c) => !c.endsWith('='));
async function login(u, claims = {}, { tokenFn = idToken, nonceOverride } = {}) {
  const n = await call('GET', '/api/auth/nonce', { cookie: u?.cookie });
  const nonceCookie = cookiesFrom(n.setCookie)[0];
  const cookie = [u?.cookie, nonceCookie].filter(Boolean).join('; ');
  const r = await call('POST', '/api/auth/google', { cookie, body: { credential: tokenFn({ nonce: nonceOverride ?? n.json.nonce, ...claims }) } });
  const session = cookiesFrom(r.setCookie).find((c) => c.startsWith('bym_session='));
  return { ...r, session, nonce: n.json };
}

test('auth：nonce 回 client_id 與 HttpOnly nonce cookie', local, async () => {
  const n = await call('GET', '/api/auth/nonce');
  assert.equal(n.json.client_id, CLIENT);
  assert.match(n.json.nonce, /^[0-9a-f]{64}$/);
  assert.match(n.setCookie, /bym_nonce=[0-9a-f]{64}; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=300/);
});

test('auth：訪客首次登入 → 綁到同一帳號、bound=true、發 session；之後 device cookie 不再能單獨登入', local, async () => {
  const u = await newUser();
  const r = await login(u);
  assert.deepEqual([r.status, r.json], [200, { user_id: u.id, merged: false }]);
  assert.ok(r.session);
  const m = (await call('GET', '/api/me', { cookie: r.session })).json;
  assert.deepEqual([m.user_id, m.bound, m.grants.length], [u.id, true, R.STARTER_TOTAL]);
  assert.equal((await call('GET', '/api/me', { cookie: u.cookie })).status, 401);
});

test('auth：同一個 Google 帳在第二台裝置登入 → 合併到原帳；首啟贈品不併、原鎮保留；舊訪客 cookie 失效', local, async () => {
  const sub = String(2e15 + Math.floor(Math.random() * 1e15));
  const a = await newUser();
  const first = await login(a, { sub });
  const town = R.starterGrid(); town[R.idx(6, 6)] = { t: 'road' };
  await call('PUT', '/api/town', { cookie: first.session, body: { grid: town, base_rev: 0, op_id: op() } });
  const b = await newUser();
  const second = await login(b, { sub });
  assert.deepEqual(second.json, { user_id: a.id, merged: true });
  const m = (await call('GET', '/api/me', { cookie: second.session })).json;
  assert.equal(m.user_id, a.id);
  assert.equal(m.grants.length, R.STARTER_TOTAL); // b 的首啟贈品沒有併進來
  assert.deepEqual(m.town.grid[R.idx(6, 6)], { t: 'road' });
  assert.equal((await call('GET', '/api/me', { cookie: b.cookie })).status, 401);
});

test('auth：沒有任何 cookie 直接登入 → 以 Google 建新帳（含首啟贈品）', local, async () => {
  const r = await login(null);
  assert.equal(r.status, 200);
  logUser(r.json.user_id);
  const m = (await call('GET', '/api/me', { cookie: r.session })).json;
  assert.deepEqual([m.bound, m.grants.length, m.town.rev], [true, R.STARTER_TOTAL, 0]);
});

test('auth：偽造／過期／錯對象的憑證一律 401 且不發 session', local, async () => {
  const cases = {
    nonce: { nonceOverride: 'f'.repeat(64) },
    aud: { claims: { aud: 'other.apps.googleusercontent.com' } },
    azp: { claims: { azp: 'other.apps.googleusercontent.com' } },
    exp: { claims: { exp: Math.floor(Date.now() / 1000) - 3600, iat: Math.floor(Date.now() / 1000) - 7200 } },
    iss: { claims: { iss: 'https://evil.example' } },
    alg_none: { tokenFn: (c) => idToken(c, { alg: 'none' }) },
    sig: { tokenFn: (c) => { const t = idToken(c); return t.slice(0, -4) + (t.endsWith('AAAA') ? 'BBBB' : 'AAAA'); } },
    kid: { tokenFn: (c) => idToken(c, { kid: 'unknown' }) },
  };
  for (const [name, o] of Object.entries(cases)) {
    const r = await login(await newUser(), o.claims ?? {}, o);
    assert.deepEqual([r.status, r.json?.error?.code, !!r.session], [401, 'unauthorized', false], name);
  }
  // nonce cookie 不在（換瀏覽器重放）
  const n = await call('GET', '/api/auth/nonce');
  const r = await call('POST', '/api/auth/google', { body: { credential: idToken({ nonce: n.json.nonce }) } });
  assert.equal(r.status, 401);
});

test('auth：session 竄改 → 401', local, async () => {
  const r = await login(await newUser());
  const bad = r.session.slice(0, -1) + (r.session.endsWith('0') ? '1' : '0');
  assert.equal((await call('GET', '/api/me', { cookie: bad })).status, 401);
});

// 正式站：client_id 是真的；用測試金鑰簽的憑證必須被拒（證明正式環境沒有信任 TEST_JWKS）
const prodOnly = { skip: !process.env.PROD && '只在正式站跑' };
test('prod auth：nonce 給真的 client_id；測試金鑰簽的憑證 → 401、不發 session', prodOnly, async () => {
  const n = await call('GET', '/api/auth/nonce');
  assert.match(n.json.client_id, /^\d+-[0-9a-z]+\.apps\.googleusercontent\.com$/);
  const nonceCookie = cookiesFrom(n.setCookie)[0];
  const r = await call('POST', '/api/auth/google', { cookie: nonceCookie, body: { credential: idToken({ nonce: n.json.nonce, aud: n.json.client_id, azp: n.json.client_id }) } });
  assert.deepEqual([r.status, r.json.error.code, /bym_session=[0-9a-f]/.test(r.setCookie ?? '')], [401, 'unauthorized', false]);
});

// ---------- 打卡 / 每日簽到 / 記憶卡 ----------
const LMS = JSON.parse(readFileSync(new URL('../data/landmarks.json', import.meta.url), 'utf8')).items;
const LM5 = LMS.find((l) => l.id === 'lm:TPE-f05'); // 西門紅樓 r=100
const north = (l, m) => ({ lat: l.lat + m / 111195, lng: l.lng });
const ck = (u, l, m, acc = 20, extra = {}) => call('POST', '/api/checkin', { cookie: u.cookie, body: { landmark_id: l.id, ...north(l, m), acc, op_id: op(), ...extra } });

test('checkin：acc > 200 → 422 weak_signal；未知地標 → invalid；圈外 → 422 too_far{dist}', opts, async () => {
  const u = await newUser();
  assert.deepEqual([(await ck(u, LM5, 0, 201)).status, (await ck(u, LM5, 0, 201)).json.error.code], [422, 'weak_signal']);
  assert.equal((await ck(u, { ...LM5, id: 'lm:TPE-nope' }, 0)).json.error.reason, 'landmark');
  const far = await ck(u, LM5, 125);
  assert.deepEqual([far.status, far.json.error.code, far.json.error.dist], [422, 'too_far', 120]);
  assert.equal((await me(u)).grants.length, R.STARTER_TOTAL); // 都沒有發房
});

test('checkin：圈內 → 發房（原色、第 1 次）；同 op_id 重送 → 同一筆；同地標同日 → cooldown；馬上打別處 → rate_limited', opts, async () => {
  const u = await newUser(), id = op();
  const r = await ck(u, LM5, 80, 30, { op_id: id }); // 80 m < 100 + 30
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.grant.item_id, r.json.grant.seed, r.json.grant.state, r.json.grant.landmark_id, r.json.checkin.visit_n], [LM5.house, 0, 'stock', LM5.id, 1]);
  const again = await ck(u, LM5, 80, 30, { op_id: id });
  assert.equal(again.json.grant.id, r.json.grant.id);
  const cd = await ck(u, LM5, 0);
  assert.deepEqual([cd.status, cd.json.error.code], [429, 'cooldown']);
  assert.match(cd.json.error.until, /T20:00:00Z$/);
  const other = LMS.find((l) => l.id === 'lm:TPE-f02');
  const rl = await ck(u, other, 0);
  assert.deepEqual([rl.status, rl.json.error.code], [429, 'rate_limited']);
  assert.ok(rl.json.error.retry_after > 0 && rl.json.error.retry_after <= 60);
  assert.equal((await me(u)).grants.length, R.STARTER_TOTAL + 1);
});

test('daily：台北 → 城市 1×1 池（seed 1..n−1）或部件；同日再領 → cooldown；30 km 外 → invalid county', opts, async () => {
  const u = await newUser();
  const r = await call('POST', '/api/daily', { cookie: u.cookie, body: { ...north(LM5, 500), acc: 30, op_id: op() } });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.county, r.json.grant.state, r.json.grant.kind], ['TPE', 'stock', r.json.kind]);
  if (r.json.kind === 'decor') assert.ok(CATALOG.decor.some((d) => d.id === r.json.grant.item_id), r.json.grant.item_id);
  else {
    assert.equal(r.json.kind, 'house');
    const h = HOUSES.find((x) => x.id === r.json.grant.item_id);
    assert.ok(h && Object.hasOwn(CATALOG.pools.groups.metro, h.id), r.json.grant.item_id);
    assert.ok(r.json.grant.seed >= 1 && r.json.grant.seed < h.palettes.length);
  }
  const again = await call('POST', '/api/daily', { cookie: u.cookie, body: { ...north(LM5, 500), acc: 30, op_id: op() } });
  assert.deepEqual([again.status, again.json.error.code], [429, 'cooldown']);
  const v = await newUser();
  const kao = await call('POST', '/api/daily', { cookie: v.cookie, body: { lat: 22.6273, lng: 120.3014, acc: 30, op_id: op() } });
  assert.deepEqual([kao.status, kao.json.error.reason], [400, 'county']);
});

test('daily 不計入打卡間隔：簽到後馬上打卡仍可', opts, async () => {
  const u = await newUser();
  await call('POST', '/api/daily', { cookie: u.cookie, body: { ...north(LM5, 0), acc: 30, op_id: op() } });
  assert.equal((await ck(u, LM5, 0)).status, 200);
});

test('memory：心情＋一句話寫入；41 字 → invalid；別人的 grant → 404', opts, async () => {
  const u = await newUser(), v = await newUser();
  const g = (await ck(u, LM5, 0)).json.grant;
  const r = await call('PUT', `/api/grant/${g.id}/memory`, { cookie: u.cookie, body: { mood: 3, note: '  第一次來\u0000紅樓 ' } });
  assert.deepEqual([r.status, r.json.grant.mood, r.json.grant.note], [200, 3, '第一次來紅樓']);
  assert.equal((await call('PUT', `/api/grant/${g.id}/memory`, { cookie: u.cookie, body: { mood: 1, note: '好'.repeat(41) } })).json.error.reason, 'note');
  assert.equal((await call('PUT', `/api/grant/${g.id}/memory`, { cookie: v.cookie, body: { mood: 1, note: 'x' } })).status, 404);
});

test('merge：贈品鐵窗厝 + 日式宿舍（不同系列）→ 400 mismatch；同一棟兩次 → same；缺 op_id → schema', opts, async () => {
  const u = await newUser();
  const m = (await call('GET', '/api/me', { cookie: u.cookie })).json;
  const iron = m.grants.find((g) => g.item_id === 'sys:iron'), dorm = m.grants.find((g) => g.item_id === 'sys:jpdorm');
  const r = await call('POST', '/api/merge', { cookie: u.cookie, body: { a: iron.id, b: dorm.id, op_id: op() } });
  assert.deepEqual([r.status, r.json.error.reason], [400, 'mismatch']);
  const s = await call('POST', '/api/merge', { cookie: u.cookie, body: { a: iron.id, b: iron.id, op_id: op() } });
  assert.deepEqual([s.status, s.json.error.reason], [400, 'same']);
  const x = await call('POST', '/api/merge', { cookie: u.cookie, body: { a: iron.id, b: dorm.id } });
  assert.deepEqual([x.status, x.json.error.reason], [400, 'schema']);
});
