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
  { id: 'test:big', size: [2, 2] }];

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
