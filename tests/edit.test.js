// edit.test.js — store.js（localStorage 立即寫）+ edit.js（rules → store、復原）
// 對應 test_plan S0-C / S0-D 中不需瀏覽器的部分。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../shared/rules.js';
import { createStore, starterState, KEY } from '../src/store.js';
import { createEditor } from '../src/edit.js';

const { idx } = R;
const HOUSES = [...JSON.parse(readFileSync(new URL('../data/houses.json', import.meta.url), 'utf8')).houses,
  { id: 'test:big', size: [2, 2] }, { id: 'test:3x1', size: [3, 1] }];

// 假 localStorage
function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}
const saved = (s) => JSON.parse(s.map.get(KEY));
const setup = () => {
  const storage = memStorage();
  const store = createStore(storage);
  return { storage, store, ed: createEditor(store, HOUSES), stock: (item) => store.get().grants.find((g) => g.item_id === item) };
};
const valid = (store) => R.validateGrid(store.get().grid, store.get().grants, HOUSES);

// ---------- store ----------
test('store 首啟：預鋪路 + 2 棟 stock seed 0，立即寫入且 validateGrid ok', () => {
  const { storage, store } = setup();
  const s = store.get();
  assert.deepEqual(s.grid, R.starterGrid());
  assert.deepEqual(s.grants.map((g) => [g.item_id, g.state, g.seed]), [['sys:iron', 'stock', 0], ['sys:minnan', 'stock', 0]]);
  assert.equal(new Set(s.grants.map((g) => g.id)).size, 2);
  assert.deepEqual(saved(storage), s);
  assert.equal(valid(store).ok, true);
});

test('store 重新載入：讀回同一份 grid 與庫存（S0-D）', () => {
  const { storage, store, ed, stock } = setup();
  ed.placeHouse(stock('sys:minnan').id, idx(6, 5));
  const again = createStore(storage);
  assert.deepEqual(again.get(), store.get());
});

test('store 壞檔 / 形狀不對 → 首啟狀態', () => {
  for (const bad of ['{', '{"grid":[],"grants":[],"rev":0}', 'null']) {
    const store = createStore(memStorage({ [KEY]: bad }));
    assert.deepEqual(store.get().grid, R.starterGrid());
  }
});

test('store setItem 丟例外（私密模式）時狀態仍更新、不擋操作', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const store = createStore(storage);
  store.set({ rev: 3 });
  assert.equal(store.get().rev, 3);
});

test('store subscribe 收到每次變更；取消後不再收到', () => {
  const { store } = setup();
  let n = 0;
  const off = store.subscribe(() => n++);
  store.set({ rev: 1 }); off(); store.set({ rev: 2 });
  assert.equal(n, 1);
});

test('store reset → 新的首啟狀態', () => {
  const { store } = setup();
  const before = store.get().grants.map((g) => g.id);
  store.set({ grid: new Array(256).fill(null) });
  store.reset();
  assert.deepEqual(store.get().grid, R.starterGrid());
  assert.notDeepEqual(store.get().grants.map((g) => g.id), before);
});

test('starterState 可注入 id 與時間', () => {
  let n = 0;
  const s = starterState(() => `g${n++}`, '2026-10-21T00:00:00Z');
  assert.deepEqual(s.grants.map((g) => [g.id, g.at]), [['g0', '2026-10-21T00:00:00Z'], ['g1', '2026-10-21T00:00:00Z']]);
});

// ---------- 塗路 / 擦路 ----------
test('塗路：空地 ok；已是路 ok 不變；視窗外 locked；有房 occupied', () => {
  const { store, ed, stock } = setup();
  assert.equal(ed.paintRoad(idx(6, 4)).ok, true);
  assert.deepEqual(store.get().grid[idx(6, 4)], { t: 'road' });
  const g = store.get().grid;
  assert.equal(ed.paintRoad(idx(7, 4)).ok, true);
  assert.equal(store.get().grid, g);
  assert.equal(ed.paintRoad(idx(3, 4)).reason, 'locked');
  ed.placeHouse(stock('sys:iron').id, idx(8, 5));
  assert.equal(ed.paintRoad(idx(8, 5)).reason, 'occupied');
});

test('擦路：會讓房 orphan → 拒絕且 grid 不變；不是路 → not_road', () => {
  const { store, ed, stock } = setup();
  ed.placeHouse(stock('sys:iron').id, idx(8, 5));
  const g = store.get().grid;
  assert.equal(ed.eraseRoad(idx(7, 5)).reason, 'orphan');
  assert.equal(store.get().grid, g);
  assert.equal(ed.eraseRoad(idx(8, 5)).reason, 'not_road');
  assert.equal(ed.eraseRoad(idx(7, 11)).ok, true);
  assert.equal(store.get().grid[idx(7, 11)], null);
});

// ---------- 落房 / 拆除 / 旋轉 ----------
test('落房：寫錨點、grant → placed、localStorage 立即寫、整鎮仍合法', () => {
  const { storage, store, ed, stock } = setup();
  const g = stock('sys:minnan');
  assert.equal(ed.placeHouse(g.id, idx(6, 5), 2).ok, true);
  assert.deepEqual(store.get().grid[idx(6, 5)], { t: 'house', id: 'sys:minnan', ref: g.id, rot: 2 });
  assert.equal(store.get().grants.find((x) => x.id === g.id).state, 'placed');
  assert.deepEqual(saved(storage).grid[idx(6, 5)], store.get().grid[idx(6, 5)]);
  assert.equal(valid(store).ok, true);
});

test('落房非法格：occupied / no_road / locked 各一（S0-C），grid 與庫存不變', () => {
  const { store, ed, stock } = setup();
  const id = stock('sys:minnan').id;
  const before = store.get();
  assert.equal(ed.placeHouse(id, idx(7, 5)).reason, 'occupied');
  assert.equal(ed.placeHouse(id, idx(5, 5)).reason, 'no_road');
  assert.equal(ed.placeHouse(id, idx(6, 3)).reason, 'locked');
  assert.equal(store.get(), before);
});

test('checkHouse：與 placeHouse 同判定、不改 store', () => {
  const { store, ed, stock } = setup();
  const id = stock('sys:minnan').id, before = store.get();
  assert.deepEqual(ed.checkHouse(id, idx(6, 5)), { ok: true, cells: [idx(6, 5)] });
  assert.equal(ed.checkHouse(id, idx(5, 5)).reason, 'no_road');
  assert.equal(ed.checkHouse('nope', idx(6, 5)).reason, 'ref');
  assert.equal(store.get(), before);
});

test('落房：同一 grant 不能放兩次；不存在的 grant → ref', () => {
  const { ed, stock } = setup();
  const id = stock('sys:minnan').id;
  ed.placeHouse(id, idx(6, 5));
  assert.equal(ed.placeHouse(id, idx(6, 6)).reason, 'ref');
  assert.equal(ed.placeHouse('nope', idx(6, 6)).reason, 'ref');
});

test('2×2 落房寫 3 個 part；點從屬格拆除 → 4 格清空、grant 回 stock', () => {
  const storage = memStorage();
  const store = createStore(storage);
  store.set({ grants: [...store.get().grants, { id: 'big1', kind: 'house', item_id: 'test:big', state: 'stock', seed: 0, consumed_at: null }] });
  const ed = createEditor(store, HOUSES);
  const a = idx(5, 5);
  assert.equal(ed.placeHouse('big1', a).ok, true);
  assert.deepEqual([a + 1, a + 16, a + 17].map((i) => store.get().grid[i]), Array(3).fill({ t: 'part', of: a }));
  assert.equal(valid(store).ok, true);
  assert.equal(ed.removeHouse(a + 17).ok, true);
  assert.deepEqual([a, a + 1, a + 16, a + 17].map((i) => store.get().grid[i]), [null, null, null, null]);
  assert.equal(store.get().grants.find((g) => g.id === 'big1').state, 'stock');
});

test('拆除空格 / 路 → not_house', () => {
  const { ed } = setup();
  assert.equal(ed.removeHouse(idx(6, 6)).reason, 'not_house');
  assert.equal(ed.removeHouse(idx(7, 5)).reason, 'not_house');
});

test('旋轉：rot 0→1→2→3→0；只改 rot', () => {
  const { store, ed, stock } = setup();
  ed.placeHouse(stock('sys:iron').id, idx(6, 5));
  const rots = [];
  for (let k = 0; k < 4; k++) { ed.rotate(idx(6, 5)); rots.push(store.get().grid[idx(6, 5)].rot); }
  assert.deepEqual(rots, [1, 2, 3, 0]);
  assert.equal(ed.rotate(idx(6, 6)).reason, 'not_house');
});

// ---------- 解鎖 ----------
test('8×8 填到 45 格 → 自動變 10×10，視窗外第一圈可塗路（S0-D）', () => {
  const { store, ed } = setup();
  const win = [...Array(256).keys()].filter((i) => R.isUnlocked(i, 8));
  for (const i of win) { if (R.unlockedSize(store.get().grid) > 8) break; ed.paintRoad(i); }
  assert.equal(win.filter((i) => store.get().grid[i] !== null).length, 45);
  assert.equal(R.unlockedSize(store.get().grid), 10);
  assert.equal(ed.paintRoad(idx(3, 4)).ok, true);
});

// ---------- 復原 ----------
test('復原：逐步退回（含 grant state），堆疊空了回 empty', () => {
  const { store, ed, stock } = setup();
  const s0 = store.get();
  ed.paintRoad(idx(6, 5));
  const s1 = store.get();
  ed.placeHouse(stock('sys:minnan').id, idx(5, 5));
  assert.equal(ed.canUndo(), true);
  ed.undo();
  assert.deepEqual(store.get().grid, s1.grid);
  assert.equal(stock('sys:minnan').state, 'stock');
  ed.undo();
  assert.deepEqual(store.get().grid, s0.grid);
  assert.equal(ed.undo().reason, 'empty');
});

test('一筆連續塗路算一步；沒畫到東西的筆不進堆疊', () => {
  const { store, ed } = setup();
  const s0 = store.get();
  ed.beginStroke();
  for (let c = 4; c <= 8; c++) ed.paintRoad(idx(6, c));
  ed.endStroke();
  ed.beginStroke(); ed.paintRoad(idx(3, 3)); ed.endStroke(); // 全部被拒
  ed.undo();
  assert.deepEqual(store.get().grid, s0.grid);
  assert.equal(ed.canUndo(), false);
});

test('失敗的操作不進堆疊；done() 清空堆疊', () => {
  const { ed, stock } = setup();
  ed.placeHouse(stock('sys:minnan').id, idx(5, 5)); // no_road
  assert.equal(ed.canUndo(), false);
  ed.paintRoad(idx(6, 5));
  ed.done();
  assert.equal(ed.canUndo(), false);
});

// ---------- store 同步（假 api）----------
// 伺服器模擬：rev、grid、grants；calls 記錄每次請求
function fakeServer({ offline = false } = {}) {
  const srv = { rev: 0, grid: R.starterGrid(), grants: starterState(() => crypto.randomUUID()).grants, calls: [], offline, ops: new Map() };
  srv.api = async (method, path, body) => {
    srv.calls.push({ method, path, body });
    if (srv.delay) await tick(srv.delay);
    if (srv.offline) return { ok: false, code: 'offline' };
    if (path === '/api/me') return { ok: true, data: { grants: srv.grants, town: { grid: srv.grid, rev: srv.rev } } };
    if (path === '/api/town') {
      if (srv.ops.has(body.op_id)) return { ok: true, data: { rev: srv.ops.get(body.op_id) } };
      if (body.base_rev !== srv.rev) return { ok: false, code: 'conflict', rev: srv.rev, grid: srv.grid };
      srv.grid = body.grid; srv.rev++; srv.ops.set(body.op_id, srv.rev);
      return { ok: true, data: { rev: srv.rev } };
    }
    return { ok: true, data: {} };
  };
  return srv;
}
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test('同步：connect 以伺服器版為準（grants、grid、rev）', async () => {
  const srv = fakeServer(); srv.rev = 7; srv.grid[idx(6, 6)] = { t: 'road' };
  const store = createStore(memStorage(), { api: srv.api, debounceMs: 0 });
  await store.connect();
  assert.equal(store.get().rev, 7);
  assert.deepEqual(store.get().grid, srv.grid);
  assert.equal(store.get().grants[0].id, srv.grants[0].id);
});

test('同步：編輯後 debounce 送 PUT /town，成功 → rev 更新、dirty 清掉', async () => {
  const srv = fakeServer(), events = [];
  const store = createStore(memStorage(), { api: srv.api, debounceMs: 0, onEvent: (e) => events.push(e.type) });
  await store.connect();
  const ed = createEditor(store, HOUSES);
  ed.paintRoad(idx(6, 6)); ed.paintRoad(idx(6, 7));
  await tick(20);
  assert.equal(srv.calls.filter((c) => c.path === '/api/town').length, 1); // 兩次編輯合併成一次送出
  assert.deepEqual([store.get().rev, store.get().dirty, srv.grid[idx(6, 7)]], [1, false, { t: 'road' }]);
  assert.ok(events.includes('synced'));
});

test('同步：離線送不出 → 保持 dirty；恢復後 flush 沿用同一個 op_id', async () => {
  const srv = fakeServer(), events = [];
  const store = createStore(memStorage(), { api: srv.api, debounceMs: 0, onEvent: (e) => events.push(e.type) });
  await store.connect();
  srv.offline = true;
  createEditor(store, HOUSES).paintRoad(idx(6, 6));
  await tick(20);
  assert.equal(store.get().dirty, true);
  assert.ok(events.includes('offline'));
  srv.offline = false;
  await store.flush();
  const puts = srv.calls.filter((c) => c.path === '/api/town');
  assert.equal(puts.length, 2);
  assert.equal(puts[0].body.op_id, puts[1].body.op_id);
  assert.deepEqual([store.get().dirty, store.get().rev], [false, 1]);
});

test('同步：409 → 改用伺服器版並通知 conflict / replaced', async () => {
  const srv = fakeServer(), events = [];
  const store = createStore(memStorage(), { api: srv.api, debounceMs: 0, onEvent: (e) => events.push(e.type) });
  await store.connect();
  srv.rev = 3; srv.grid = R.starterGrid(); srv.grid[idx(8, 8)] = { t: 'road' }; // 別台裝置先寫了
  createEditor(store, HOUSES).paintRoad(idx(6, 6));
  await tick(20);
  assert.deepEqual([store.get().rev, store.get().grid[idx(8, 8)], store.get().grid[idx(6, 6)], store.get().dirty], [3, { t: 'road' }, null, false]);
  assert.ok(events.includes('conflict') && events.includes('replaced'));
});

test('同步：重開時本機有沒送出的修改且 rev 相同 → 送本機版，grant state 依 grid 重算', async () => {
  const srv = fakeServer(), storage = memStorage();
  let store = createStore(storage, { api: srv.api, debounceMs: 0 });
  await store.connect();
  srv.offline = true;
  const minnan = store.get().grants.find((g) => g.item_id === 'sys:minnan');
  createEditor(store, HOUSES).placeHouse(minnan.id, idx(6, 5));
  await tick(20);
  srv.offline = false;
  store = createStore(storage, { api: srv.api, debounceMs: 0 }); // 重新整理
  await store.connect();
  assert.deepEqual(srv.grid[idx(6, 5)]?.ref, minnan.id);
  assert.equal(store.get().grants.find((g) => g.id === minnan.id).state, 'placed');
  assert.equal(store.get().dirty, false);
});

test('同步：送出途中又編輯 → 那筆不會漏，送完會再送一次', async () => {
  const srv = fakeServer();
  const store = createStore(memStorage(), { api: srv.api, debounceMs: 0 });
  await store.connect();
  const ed = createEditor(store, HOUSES);
  srv.delay = 30;
  ed.paintRoad(idx(6, 6));
  await tick(10); // 第一次 PUT 還在路上
  ed.paintRoad(idx(6, 7));
  await tick(150);
  assert.deepEqual([srv.grid[idx(6, 6)], srv.grid[idx(6, 7)], store.get().dirty], [{ t: 'road' }, { t: 'road' }, false]);
});

test('v2 旋轉：3×1 轉向後佔格跟著換；轉向會撞到東西 → 拒絕、不改', () => {
  const store = createStore(memStorage());
  store.set({ grants: [...store.get().grants, { id: 'w1', kind: 'house', item_id: 'test:3x1', state: 'stock', seed: 0, consumed_at: null }] });
  const ed = createEditor(store, HOUSES);
  const g = () => store.get().grid;
  // 橫放 (6,5..7) 貼著 (7,*) 的路；轉直會壓到 (7,5) 的路 → occupied
  assert.equal(ed.placeHouse('w1', idx(6, 5), 0).ok, true);
  assert.equal(ed.rotate(idx(6, 5)).reason, 'occupied');
  assert.deepEqual([g()[idx(6, 5)].rot, g()[idx(6, 7)]], [0, { t: 'part', of: idx(6, 5) }]);
  ed.removeHouse(idx(6, 5));
  // 直放 (4..6,5)；加一格路 (5,6) 後轉橫 (4,5..7) → (4,6) 貼著路 → ok，舊從屬格清掉
  ed.paintRoad(idx(5, 6));
  assert.equal(ed.placeHouse('w1', idx(4, 5), 1).ok, true);
  assert.equal(ed.rotate(idx(5, 5)).ok, true); // 點從屬格也可以
  assert.deepEqual([g()[idx(4, 5)].rot, g()[idx(4, 6)], g()[idx(4, 7)], g()[idx(5, 5)], g()[idx(6, 5)]],
    [2, { t: 'part', of: idx(4, 5) }, { t: 'part', of: idx(4, 5) }, null, null]);
  assert.equal(R.validateGrid(g(), store.get().grants, HOUSES).ok, true);
});
