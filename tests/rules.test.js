// rules.test.js — docs/rules_truth_table.md 每個案例一條 test（node --test）
// 標「補充」的是真值表沒列案例、但函式有實作的部分。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from '../shared/rules.js';

const { idx } = R;
const HOUSES_JSON = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8')).houses;
// 測試用的假 2×2 房型（與目錄無關，避免跟著 Design 改尺寸）
const HOUSES = [...HOUSES_JSON, { id: 'test:big', size: [2, 2] }];
const ONE = { id: 'sys:jpdorm', size: [1, 1] };
const BIG = { id: 'test:big', size: [2, 2] };

const empty = () => new Array(256).fill(null);
const road = { t: 'road' };
const house = (ref, id = 'sys:jpdorm') => ({ t: 'house', id, ref, rot: 0 });
const grant = (id, item_id = 'sys:jpdorm', state = 'placed', extra = {}) =>
  ({ id, kind: 'house', item_id, state, seed: 0, consumed_at: null, ...extra });
// 在 grid 裡把 cells 填成路
const fill = (grid, cells) => { for (const i of cells) grid[i] = road; return grid; };
const windowCells = (size) => [...Array(256).keys()].filter((i) => R.isUnlocked(i, size));
const place2x2 = (grid, a, ref) => {
  grid[a] = house(ref, 'test:big');
  for (const p of [a + 1, a + 16, a + 17]) grid[p] = { t: 'part', of: a };
  return grid;
};

// ---------- §0 常數 ----------
test('§0 RULES 常數與真值表一致', () => {
  assert.deepEqual({ ...R.RULES, SIZES: [...R.RULES.SIZES], MOODS: [...R.RULES.MOODS] }, {
    GRID: 16, SIZES: [8, 10, 12, 14, 16], UNLOCK_RATIO: 0.70,
    R_DEFAULT: 100, ACC_MAX: 200, ACC_TOLERANCE_MAX: 50,
    DAILY_CAP: 40, MIN_INTERVAL_S: 60, DAY_OFFSET_H: 4, TZ_OFFSET_H: 8,
    COUNTY_MAX_KM: 30,
    NOTE_MAX: 40, MOODS: [0, 1, 2, 3, 4],
  });
});

// ---------- §1 格線 ----------
test('§1 idx(0,0)→0', () => assert.equal(idx(0, 0), 0));
test('§1 idx(1,0)→16', () => assert.equal(idx(1, 0), 16));
test('§1 idx(15,15)→255', () => assert.equal(idx(15, 15), 255));
test('§1 rc(17)→[1,1]', () => assert.deepEqual(R.rc(17), [1, 1]));
test('§1 inBounds(-1,0)→false', () => assert.equal(R.inBounds(-1, 0), false));
test('§1 inBounds(16,3)→false', () => assert.equal(R.inBounds(16, 3), false));
test('§1 window(8)→[4,11]', () => assert.deepEqual(R.window(8), [4, 11]));
test('§1 window(16)→[0,15]', () => assert.deepEqual(R.window(16), [0, 15]));
test('§1 isUnlocked(idx(4,4),8)→true', () => assert.equal(R.isUnlocked(idx(4, 4), 8), true));
test('§1 isUnlocked(idx(3,4),8)→false', () => assert.equal(R.isUnlocked(idx(3, 4), 8), false));
test('§1 isUnlocked(idx(0,0),16)→true', () => assert.equal(R.isUnlocked(idx(0, 0), 16), true));
test('§1 neighbors4(0)→[1,16]', () => assert.deepEqual(R.neighbors4(0), [1, 16]));
test('§1 neighbors4(17)→[1,16,18,33]', () => assert.deepEqual(R.neighbors4(17), [1, 16, 18, 33]));

// ---------- §2 解鎖 ----------
const w8 = windowCells(8), ring10 = windowCells(10).filter((i) => !R.isUnlocked(i, 8));
test('§2 全 null → 8', () => assert.equal(R.unlockedSize(empty()), 8));
test('§2 8×8 視窗 44 格非 null → 8', () => assert.equal(R.unlockedSize(fill(empty(), w8.slice(0, 44))), 8));
test('§2 8×8 視窗 45 格非 null → 10', () => assert.equal(R.unlockedSize(fill(empty(), w8.slice(0, 45))), 10));
test('§2 8×8 全滿、10×10 視窗 69/100 → 10', () =>
  assert.equal(R.unlockedSize(fill(empty(), [...w8, ...ring10.slice(0, 5)])), 10));
test('§2 8×8 全滿、10×10 視窗 70/100 → 12', () =>
  assert.equal(R.unlockedSize(fill(empty(), [...w8, ...ring10.slice(0, 6)])), 12));
test('§2 16×16 全滿 → 16', () => assert.equal(R.unlockedSize(new Array(256).fill(road)), 16));
test('§2 補充：house / part 也算非 null', () => {
  const g = fill(empty(), w8.slice(0, 44));
  g[w8[44]] = house('x');
  assert.equal(R.unlockedSize(g), 10);
});

// ---------- §3 佔格與放置 ----------
test('§3 footprint([1,1],a)→[a]', () => assert.deepEqual(R.footprint([1, 1], 37), [37]));
test('§3 footprint([2,2],a)→[a,a+1,a+16,a+17]', () => assert.deepEqual(R.footprint([2, 2], 37), [37, 38, 53, 54]));
test('§3 footprint 2×2 錨在 c=15 → null', () => assert.equal(R.footprint([2, 2], idx(3, 15)), null));
test('§3 footprint 2×2 錨在 r=15 → null', () => assert.equal(R.footprint([2, 2], idx(15, 3)), null));

const roadAt55 = () => { const g = empty(); g[idx(5, 5)] = road; return g; };
test('§3 canPlace 1×1 放 idx(5,6) → ok', () =>
  assert.deepEqual(R.canPlace(roadAt55(), ONE, idx(5, 6), 0, 8), { ok: true, cells: [idx(5, 6)] }));
test('§3 canPlace 1×1 放 idx(6,6)（斜角）→ no_road', () =>
  assert.deepEqual(R.canPlace(roadAt55(), ONE, idx(6, 6), 0, 8), { ok: false, code: 'invalid', reason: 'no_road' }));
test('§3 canPlace 1×1 放 idx(5,5)（路上）→ occupied', () =>
  assert.deepEqual(R.canPlace(roadAt55(), ONE, idx(5, 5), 0, 8), { ok: false, code: 'invalid', reason: 'occupied' }));
test('§3 canPlace 1×1 放 idx(3,5)（視窗外）→ locked', () =>
  assert.deepEqual(R.canPlace(roadAt55(), ONE, idx(3, 5), 0, 8), { ok: false, code: 'invalid', reason: 'locked' }));
test('§3 canPlace 2×2 錨 idx(5,6)，(5,5) 是路 → ok', () =>
  assert.deepEqual(R.canPlace(roadAt55(), BIG, idx(5, 6), 0, 8),
    { ok: true, cells: [idx(5, 6), idx(5, 7), idx(6, 6), idx(6, 7)] }));
test('§3 canPlace 2×2 錨 idx(5,15) → locked（出界）', () =>
  assert.deepEqual(R.canPlace(roadAt55(), BIG, idx(5, 15), 0, 8), { ok: false, code: 'invalid', reason: 'locked' }));
test('§3 canPlace 2×2 錨 idx(4,6)，(5,6) 已有房 → occupied', () => {
  const g = roadAt55(); g[idx(5, 6)] = house('a');
  assert.deepEqual(R.canPlace(g, BIG, idx(4, 6), 0, 8), { ok: false, code: 'invalid', reason: 'occupied' });
});
test('§3 canPlace 檢查順序 1：rot 不在 0–3 → rot', () =>
  assert.deepEqual(R.canPlace(roadAt55(), ONE, idx(5, 6), 4, 8), { ok: false, code: 'invalid', reason: 'rot' }));

test('§3 canPaintRoad：空格且在視窗內 → true', () => assert.equal(R.canPaintRoad(empty(), idx(5, 5), 8), true));
test('§3 canPaintRoad 補充：已有東西 → false', () => assert.equal(R.canPaintRoad(roadAt55(), idx(5, 5), 8), false));
test('§3 canPaintRoad 補充：視窗外 → false', () => assert.equal(R.canPaintRoad(empty(), idx(3, 5), 8), false));

test('§3 canEraseRoad 路 (5,5)，房 (5,6) 只靠它 → orphan', () => {
  const g = roadAt55(); g[idx(5, 6)] = house('a');
  assert.deepEqual(R.canEraseRoad(g, idx(5, 5)), { ok: false, code: 'invalid', reason: 'orphan' });
});
test('§3 canEraseRoad 路 (5,5)、(5,7)，房 (5,6) → ok', () => {
  const g = roadAt55(); g[idx(5, 7)] = road; g[idx(5, 6)] = house('a');
  assert.deepEqual(R.canEraseRoad(g, idx(5, 5)), { ok: true });
});
test('§3 canEraseRoad 路無鄰房 → ok', () => assert.deepEqual(R.canEraseRoad(roadAt55(), idx(5, 5)), { ok: true }));
test('§3 canEraseRoad 補充：鄰格是 part → 以錨點判斷 orphan', () => {
  const g = place2x2(empty(), idx(5, 6), 'big'); g[idx(6, 5)] = road;   // 路只貼著 part (6,6)
  assert.deepEqual(R.canEraseRoad(g, idx(6, 5)), { ok: false, code: 'invalid', reason: 'orphan' });
});

test('§3 removeHouse：錨點與 part 全設 null，回傳 ref', () => {
  const g = place2x2(roadAt55(), idx(5, 6), 'big');
  const { grid, ref } = R.removeHouse(g, idx(5, 6));
  assert.equal(ref, 'big');
  for (const i of [idx(5, 6), idx(5, 7), idx(6, 6), idx(6, 7)]) assert.equal(grid[i], null);
  assert.deepEqual(grid[idx(5, 5)], road);
  assert.notEqual(grid, g, '不可改到原 grid');
});

// ---------- §4 整鎮驗證 ----------
// 合法鎮：首啟道路 + 路北側一棟 1×1 + 一棟 2×2
const legalTown = () => {
  const g = R.starterGrid();
  g[idx(6, 4)] = house('g1');
  place2x2(g, idx(5, 6), 'g2');
  return g;
};
const legalGrants = () => [grant('g1'), grant('g2', 'test:big')];
const v = (grid, grants = legalGrants()) => R.validateGrid(grid, grants, HOUSES);
const bad = (reason) => ({ ok: false, code: 'invalid', reason });

test('§4 合法鎮 → ok', () => assert.deepEqual(v(legalTown()), { ok: true }));
test('§4 house ref 屬於別人 → ref', () => {
  const g = legalTown(); g[idx(6, 4)] = house('someone-else');
  assert.deepEqual(v(g), bad('ref'));
});
test('§4 兩格同 ref → dup_ref', () => {
  const g = legalTown(); g[idx(6, 5)] = house('g1');
  assert.deepEqual(v(g), bad('dup_ref'));
});
test('§4 2×2 少一個 part → footprint', () => {
  const g = legalTown(); g[idx(6, 7)] = null;
  assert.deepEqual(v(g), bad('footprint'));
});
test('§4 part 的 of 指向空格 → footprint', () => {
  const g = legalTown(); g[idx(8, 4)] = { t: 'part', of: idx(9, 4) };
  assert.deepEqual(v(g), bad('footprint'));
});
test('§4 房四周無路 → no_road', () => {
  const g = legalTown(); g[idx(10, 10)] = house('g3');
  assert.deepEqual(v(g, [...legalGrants(), grant('g3')]), bad('no_road'));
});
test('§4 房在視窗外 → locked', () => {
  const g = legalTown(); g[idx(3, 4)] = house('g3'); g[idx(3, 5)] = road;
  assert.deepEqual(v(g, [...legalGrants(), grant('g3')]), bad('locked'));
});
test('§4 格子多了 selected:true → schema', () => {
  const g = legalTown(); g[idx(6, 4)] = { ...house('g1'), selected: true };
  assert.deepEqual(v(g), bad('schema'));
});
test('§4 house id sys:nope 不在 houses → schema', () => {
  const g = legalTown(); g[idx(6, 4)] = house('g1', 'sys:nope');
  assert.deepEqual(v(g, [grant('g1', 'sys:nope'), grant('g2', 'test:big')]), bad('schema'));
});
test('§4 補充：長度不是 256 → schema', () => assert.deepEqual(v(legalTown().slice(1)), bad('schema')));
test('§4 補充：未知格子型別 → schema', () => {
  const g = legalTown(); g[idx(4, 4)] = { t: 'tree' };
  assert.deepEqual(v(g), bad('schema'));
});
test('§4 補充：ref 存在但 item_id 不符 → ref', () =>
  assert.deepEqual(v(legalTown(), [grant('g1', 'sys:iron'), grant('g2', 'test:big')]), bad('ref')));
test('§4 補充：ref 是已拆解的列 → ref', () =>
  assert.deepEqual(v(legalTown(), [grant('g1', 'sys:jpdorm', 'dismantled'), grant('g2', 'test:big')]), bad('ref')));

// ---------- §5 距離與打卡 ----------
const near = (a, b) => assert.ok(Math.abs(a - b) <= 1, `${a} 不在 ${b}±1`);
test('§5 distanceM 同點 → 0', () => near(R.distanceM(25.033, 121.5654, 25.033, 121.5654), 0));
test('§5 distanceM (25.0330,121.5654)→(25.0339,121.5654) → 100', () =>
  near(R.distanceM(25.0330, 121.5654, 25.0339, 121.5654), 100));
test('§5 distanceM (25.0330,121.5654)→(25.0330,121.5664) → 101', () =>
  near(R.distanceM(25.0330, 121.5654, 25.0330, 121.5664), 101));

const cd = (d, r, a) => R.checkinDistance(d, r, a);
test('§5 checkinDistance 90/100/20 → ok', () => assert.deepEqual(cd(90, 100, 20), { ok: true }));
test('§5 checkinDistance 120/100/20 → ok（容差 120）', () => assert.deepEqual(cd(120, 100, 20), { ok: true }));
test('§5 checkinDistance 121/100/20 → too_far{120}', () =>
  assert.deepEqual(cd(121, 100, 20), { ok: false, code: 'too_far', dist: 120 }));
test('§5 checkinDistance 149/100/80 → ok（acc 封頂 50）', () => assert.deepEqual(cd(149, 100, 80), { ok: true }));
test('§5 checkinDistance 151/100/80 → too_far{150}', () =>
  assert.deepEqual(cd(151, 100, 80), { ok: false, code: 'too_far', dist: 150 }));
test('§5 checkinDistance 50/100/201 → weak_signal', () =>
  assert.deepEqual(cd(50, 100, 201), { ok: false, code: 'weak_signal' }));
test('§5 checkinDistance 180/200/0 → ok（精選）', () => assert.deepEqual(cd(180, 200, 0), { ok: true }));

test('§5 tpeDay 2026-10-21T19:59:59Z（TPE 03:59）→ 2026-10-21', () =>
  assert.equal(R.tpeDay('2026-10-21T19:59:59Z'), '2026-10-21'));
test('§5 tpeDay 2026-10-21T20:00:00Z（TPE 04:00）→ 2026-10-22', () =>
  assert.equal(R.tpeDay('2026-10-21T20:00:00Z'), '2026-10-22'));
test('§5 tpeDay 2026-10-21T02:00:00Z（TPE 10:00）→ 2026-10-21', () =>
  assert.equal(R.tpeDay('2026-10-21T02:00:00Z'), '2026-10-21'));
test('§5 cooldownUntil(2026-10-21) → 2026-10-21T20:00:00Z', () =>
  assert.equal(R.cooldownUntil('2026-10-21'), '2026-10-21T20:00:00Z'));

const NOW = '2026-10-21T08:00:00Z';
const ago = (s) => new Date(Date.parse(NOW) - s * 1000).toISOString();
test('§5 canCheckin existsSameDay → cooldown{until}', () =>
  assert.deepEqual(R.canCheckin({ existsSameDay: true, countToday: 0, lastAt: null, now: NOW }),
    { ok: false, code: 'cooldown', until: '2026-10-21T20:00:00Z' }));
test('§5 canCheckin countToday 40 → daily_cap', () =>
  assert.deepEqual(R.canCheckin({ existsSameDay: false, countToday: 40, lastAt: ago(3600), now: NOW }),
    { ok: false, code: 'daily_cap' }));
test('§5 canCheckin 39 次、間隔 30 s → rate_limited{30}', () =>
  assert.deepEqual(R.canCheckin({ existsSameDay: false, countToday: 39, lastAt: ago(30), now: NOW }),
    { ok: false, code: 'rate_limited', retry_after: 30 }));
test('§5 canCheckin 39 次、間隔 60 s → ok', () =>
  assert.deepEqual(R.canCheckin({ existsSameDay: false, countToday: 39, lastAt: ago(60), now: NOW }), { ok: true }));
test('§5 canCheckin 0 次、無上一筆 → ok', () =>
  assert.deepEqual(R.canCheckin({ existsSameDay: false, countToday: 0, lastAt: null, now: NOW }), { ok: true }));

test('§5 visitN(prev) = prev + 1', () => assert.equal(R.visitN(0), 1));
test('§5 seed 第 1 次 → 0', () => assert.equal(R.seed(1, 3, 0.9), 0));
test('§5 seed paletteCount=3 第 2 次 → 1 或 2', () => {
  assert.equal(R.seed(2, 3, 0), 1);
  assert.equal(R.seed(2, 3, 0.9999), 2);
});

// ---------- §6 每日簽到 ----------
const LMS = [
  { id: 'lm:TPE-0001', lat: 25.0330, lng: 121.5654, county: 'TPE' },
  { id: 'lm:KHH-0001', lat: 22.6273, lng: 120.3014, county: 'KHH' },
];
test('§6 countyOf 補充：最近地標 ≤ 30 km → 其 county', () => assert.equal(R.countyOf(25.05, 121.55, LMS), 'TPE'));
test('§6 countyOf 補充：最近地標 > 30 km → null', () => assert.equal(R.countyOf(24.0, 121.6, LMS), null));

// 每日簽到 / 非精選地標：城市池加權（docs/design_reply_upgrade_2026-10-22.md §2、§4）；碎片規則取消
const CATALOG = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const POOL = [{ id: 'sys:a', palettes: 3, w: 1 }, { id: 'sys:b', palettes: 4, w: 3 }];
const DECOR = [{ id: 'dc:x', weight: 1, layer: 'road' }, { id: 'dc:y', weight: 1, layer: 'lot' }];
const SPLIT = { house: 70, decor: 30 };
test('§6 pickWeighted：依權重切區間', () => {
  assert.equal(R.pickWeighted(POOL, 0).id, 'sys:a');
  assert.equal(R.pickWeighted(POOL, 0.2499).id, 'sys:a');
  assert.equal(R.pickWeighted(POOL, 0.25).id, 'sys:b');
  assert.equal(R.pickWeighted(POOL, 0.9999).id, 'sys:b');
});
test('§6 dailyGrant：rand < 30% → 部件（seed 0），否則房子', () => {
  assert.deepEqual(R.dailyGrant(POOL, DECOR, SPLIT, 0.29, 0.6, 0.5), { kind: 'decor', item_id: 'dc:y', seed: 0 });
  assert.deepEqual(R.dailyGrant(POOL, DECOR, SPLIT, 0.3, 0.1, 0.5), { kind: 'house', item_id: 'sys:a', seed: 2 });
});
test('§6 dailyGrant 房子 seed = seed(2, 該房型 palettes, rand3)：不給原色', () => {
  assert.equal(R.dailyGrant(POOL, DECOR, SPLIT, 0.9, 0.9, 0).seed, 1);
  assert.equal(R.dailyGrant(POOL, DECOR, SPLIT, 0.9, 0.9, 0.9999).seed, 3);
});
test('§6 dailyGrant 沒有部件清單 → 一律房子', () => assert.equal(R.dailyGrant(POOL, [], SPLIT, 0, 0, 0).kind, 'house'));
test('§6 dailyPool：台北 = 都會權重、對不到縣市 = default（鄉鎮）', () => {
  const w = (county) => Object.fromEntries(R.dailyPool(CATALOG.houses, county, CATALOG.pools).map((x) => [x.id, x.w]));
  assert.deepEqual(w('TPE'), CATALOG.pools.groups.metro);
  assert.deepEqual(w('XXX'), CATALOG.pools.groups[CATALOG.pools.default_group]);
  assert.ok(R.dailyPool(CATALOG.houses, 'TPE', CATALOG.pools).every((x) => x.palettes >= 1));
});

// ---------- §6b 合成升級 ----------
const G = (id, item_id, state = 'stock', seed = 0) => ({ id, kind: 'house', item_id, state, seed, consumed_at: null });
test('§6b canMerge 同型兩棟待放 → ok（line, tier 1）', () =>
  assert.deepEqual(R.canMerge([G('a', 'sys:iron'), G('b', 'sys:iron')], CATALOG.houses, 'a', 'b'), { ok: true, line: 'sys:iron', tier: 1 }));
test('§6b canMerge 1×2 + 1×3 同系列同階 → ok（MERGE_BY line_tier）', () =>
  assert.equal(R.canMerge([G('a', 'sys:iron-2'), G('b', 'sys:iron-3')], CATALOG.houses, 'a', 'b').tier, 2));
test('§6b canMerge 不同系列 → mismatch', () =>
  assert.equal(R.canMerge([G('a', 'sys:iron'), G('b', 'sys:temple')], CATALOG.houses, 'a', 'b').reason, 'mismatch'));
test('§6b canMerge 不同階 → mismatch', () =>
  assert.equal(R.canMerge([G('a', 'sys:iron'), G('b', 'sys:iron-2')], CATALOG.houses, 'a', 'b').reason, 'mismatch'));
test('§6b canMerge 已放上鎮 → state', () =>
  assert.equal(R.canMerge([G('a', 'sys:iron', 'placed'), G('b', 'sys:iron')], CATALOG.houses, 'a', 'b').reason, 'state'));
test('§6b canMerge 同一棟兩次 → same', () =>
  assert.equal(R.canMerge([G('a', 'sys:iron')], CATALOG.houses, 'a', 'a').reason, 'same'));
test('§6b canMerge 地標 / 第 3 階 / 非 1×1 一般房（shophouse 無升級線以外）→ not_mergeable', () => {
  assert.equal(R.canMerge([G('a', 'lm:TPE-f01'), G('b', 'lm:TPE-f01')], CATALOG.houses, 'a', 'b').reason, 'not_mergeable');
  assert.equal(R.canMerge([G('a', 'sys:iron-4'), G('b', 'sys:iron-4')], CATALOG.houses, 'a', 'b').reason, 'not_mergeable');
});
test('§6b canMerge 不是自己的 grant → ref', () =>
  assert.equal(R.canMerge([G('a', 'sys:iron')], CATALOG.houses, 'a', 'zzz').reason, 'ref'));
test('§6b mergeResult：第 1 階 → -2 / -3 各半；第 2 階 → -4', () => {
  assert.equal(R.mergeResult({ line: 'sys:iron', tier: 1 }, 0, 0, 0.49, 0).item_id, 'sys:iron-2');
  assert.equal(R.mergeResult({ line: 'sys:iron', tier: 1 }, 0, 0, 0.5, 0).item_id, 'sys:iron-3');
  assert.equal(R.mergeResult({ line: 'sys:iron', tier: 2 }, 0, 0, 0.1, 0).item_id, 'sys:iron-4');
});
test('§6b mergeResult 變體：相同沿用；不同取其一', () => {
  assert.equal(R.mergeResult({ line: 'sys:iron', tier: 1 }, 2, 2, 0, 0.9).seed, 2);
  assert.equal(R.mergeResult({ line: 'sys:iron', tier: 1 }, 1, 2, 0, 0.1).seed, 1);
  assert.equal(R.mergeResult({ line: 'sys:iron', tier: 1 }, 1, 2, 0, 0.9).seed, 2);
});
test('§6b 目錄：每個城市池房型都有 -2 / -3 / -4 三個升級版', () => {
  const ids = new Set(CATALOG.houses.map((h) => h.id));
  for (const id of Object.keys(CATALOG.pools.groups.metro)) for (const n of [2, 3, 4]) assert.ok(ids.has(`${id}-${n}`), `${id}-${n}`);
});

// ---------- §3b 基礎部件 ----------
const D = (id, item_id, state = 'placed') => ({ id, kind: 'decor', item_id, state, seed: 0, consumed_at: null });
const CDECOR = CATALOG.decor;
test('§3b canPlaceDeco：路上部件只能放在沒部件的路格', () => {
  const g = R.starterGrid(), lamp = { layer: 'road' }, at = idx(7, 6);
  assert.deepEqual(R.canPlaceDeco(g, lamp, at, 8), { ok: true });
  assert.equal(R.canPlaceDeco(g, lamp, idx(6, 6), 8).reason, 'no_road');
  g[at] = { t: 'road', deco: { id: 'dc:lamp', ref: 'x' } };
  assert.equal(R.canPlaceDeco(g, lamp, at, 8).reason, 'occupied');
});
test('§3b canPlaceDeco：空地部件只能放空格、不需臨路；鎖定格 → locked', () => {
  const g = R.starterGrid(), banyan = { layer: 'lot' };
  assert.deepEqual(R.canPlaceDeco(g, banyan, idx(4, 4), 8), { ok: true });
  assert.equal(R.canPlaceDeco(g, banyan, idx(7, 6), 8).reason, 'occupied');
  assert.equal(R.canPlaceDeco(g, banyan, idx(0, 0), 8).reason, 'locked');
});
test('§3b gridRefs：房子、空地部件、路上部件都算', () => {
  const g = legalTown(); g[idx(7, 5)] = { t: 'road', deco: { id: 'dc:lamp', ref: 'd1' } }; g[idx(4, 4)] = { t: 'deco', id: 'dc:banyan', ref: 'd2', rot: 0 };
  assert.deepEqual(R.gridRefs(g).sort(), ['d1', 'd2', 'g1', 'g2']);
});
const vd = (g, gs) => R.validateGrid(g, gs, HOUSES, CDECOR);
const withDeco = () => { const g = legalTown(); g[idx(7, 5)] = { t: 'road', deco: { id: 'dc:lamp', ref: 'd1' } }; g[idx(4, 4)] = { t: 'deco', id: 'dc:banyan', ref: 'd2', rot: 1 }; return g; };
const decoGrants = () => [...legalGrants(), D('d1', 'dc:lamp'), D('d2', 'dc:banyan')];
test('§3b validateGrid：合法的路上 + 空地部件 → ok', () => assert.deepEqual(vd(withDeco(), decoGrants()), { ok: true }));
test('§3b validateGrid：路燈放在空地 / 榕樹放在路上 → schema', () => {
  const g = withDeco(); g[idx(4, 4)] = { t: 'deco', id: 'dc:lamp', ref: 'd1', rot: 0 }; g[idx(7, 5)] = road;
  assert.deepEqual(vd(g, decoGrants()), bad('schema'));
  const h = legalTown(); h[idx(7, 5)] = { t: 'road', deco: { id: 'dc:banyan', ref: 'd2' } };
  assert.deepEqual(vd(h, decoGrants()), bad('schema'));
});
test('§3b validateGrid：部件 ref 指到房子 grant / 別人的 → ref；同一部件放兩處 → dup_ref', () => {
  const g = legalTown(); g[idx(4, 4)] = { t: 'deco', id: 'dc:banyan', ref: 'g1', rot: 0 };
  assert.deepEqual(vd(g, decoGrants()), bad('ref'));
  const h = withDeco(); h[idx(4, 5)] = { t: 'deco', id: 'dc:banyan', ref: 'd2', rot: 0 };
  assert.deepEqual(vd(h, decoGrants()), bad('dup_ref'));
});
test('§3b validateGrid：deco 多出欄位 / 路格 deco 形狀錯 → schema', () => {
  const g = withDeco(); g[idx(4, 4)] = { t: 'deco', id: 'dc:banyan', ref: 'd2', rot: 0, x: 1 };
  assert.deepEqual(vd(g, decoGrants()), bad('schema'));
  const h = withDeco(); h[idx(7, 5)] = { t: 'road', deco: { id: 'dc:lamp' } };
  assert.deepEqual(vd(h, decoGrants()), bad('schema'));
});
test('§3b 擦掉有路燈的路格不受阻（orphan 規則不變）', () => {
  const g = withDeco();
  assert.deepEqual(R.canEraseRoad(g, idx(7, 5)), { ok: true });
});
test('§3b 路上部件不影響臨路：房子貼著有路燈的路仍合法', () => {
  const g = R.starterGrid(); g[idx(7, 4)] = { t: 'road', deco: { id: 'dc:lamp', ref: 'd1' } }; g[idx(6, 4)] = house('g1');
  assert.deepEqual(vd(g, [grant('g1'), D('d1', 'dc:lamp')]), { ok: true });
});

// ---------- §7 記憶卡與拆解 ----------
test('§7 validateMemory 40 個「好」→ ok', () => assert.equal(R.validateMemory({ mood: 1, note: '好'.repeat(40) }).ok, true));
test('§7 validateMemory 41 個「好」→ invalid', () =>
  assert.equal(R.validateMemory({ mood: 1, note: '好'.repeat(41) }).code, 'invalid'));
test('§7 validateMemory "a\\u0000b" → ok，存 "ab"', () =>
  assert.deepEqual(R.validateMemory({ mood: null, note: 'a\u0000b' }), { ok: true, mood: null, note: 'ab' }));
test('§7 validateMemory 全空白 → ok，存 null', () =>
  assert.deepEqual(R.validateMemory({ mood: null, note: '   ' }), { ok: true, mood: null, note: null }));
test('§7 validateMemory 補充：mood 不在 0–4 → invalid', () =>
  assert.equal(R.validateMemory({ mood: 5, note: null }).code, 'invalid'));
test('§7 validateMemory 補充：長度以 code point 計（40 個 emoji 通過）', () =>
  assert.equal(R.validateMemory({ mood: null, note: '😀'.repeat(40) }).ok, true));

const stock = [grant('a', 'sys:iron', 'stock'), grant('b', 'sys:iron', 'placed')];
test('§7 canDismantle [a]（a stock）→ ok', () => assert.deepEqual(R.canDismantle(stock, ['a']), { ok: true }));
test('§7 canDismantle [a, a] → invalid', () => assert.equal(R.canDismantle(stock, ['a', 'a']).code, 'invalid'));
test('§7 canDismantle [a, b]（b placed）→ invalid', () => assert.equal(R.canDismantle(stock, ['a', 'b']).code, 'invalid'));
test('§7 canDismantle 100 個 → invalid', () =>
  assert.equal(R.canDismantle(stock, Array.from({ length: 100 }, (_, i) => `s${i}`)).code, 'invalid'));
test('§7 canDismantle 補充：0 個 → invalid', () => assert.equal(R.canDismantle(stock, []).code, 'invalid'));
test('§7 canDismantle 補充：不屬於本人 → invalid', () => assert.equal(R.canDismantle(stock, ['x']).code, 'invalid'));

// ---------- §8 版本 ----------
test('§8 applyTown 相等 → 寫入、rev+1', () => assert.deepEqual(R.applyTown(3, 3, []), { ok: true, rev: 4 }));
test('§8 applyTown 不等 → conflict{rev, grid}', () => {
  const sg = R.starterGrid();
  assert.deepEqual(R.applyTown(2, 3, sg), { ok: false, code: 'conflict', rev: 3, grid: sg });
});

// ---------- §9 首啟贈品 ----------
test('§9 首啟 grid：路在 idx 116–123，其餘 null', () => {
  const g = R.starterGrid();
  for (let i = 0; i < 256; i++) assert.deepEqual(g[i], i >= 116 && i <= 123 ? road : null, `idx ${i}`);
});
test('§9 首啟贈品房型：sys:iron + sys:jpdorm', () => assert.deepEqual([...R.STARTER_HOUSES], ['sys:iron', 'sys:jpdorm']));
test('§9 首啟 grid：validateGrid 必為 ok', () => {
  const gs = R.STARTER_HOUSES.map((id, n) => grant(`gift${n}`, id, 'stock'));
  assert.deepEqual(R.validateGrid(R.starterGrid(), gs, HOUSES), { ok: true });
});
test('§9 首啟 grid：unlockedSize = 8', () => assert.equal(R.unlockedSize(R.starterGrid()), 8));

// ---------- blueprint v2 提案（docs/blueprint_v2_proposal.md §3）：任意 w×d、rot 對調 ----------
test('v2 footprint：size [3,1] 錨 idx(5,5) rot 0 → [85,86,87]；rot 1 → [85,101,117]', () => {
  assert.deepEqual(R.footprint([3, 1], idx(5, 5), 0), [85, 86, 87]);
  assert.deepEqual(R.footprint([3, 1], idx(5, 5), 1), [85, 101, 117]);
  assert.deepEqual(R.footprint([3, 1], idx(5, 5), 2), [85, 86, 87]);
  assert.deepEqual(R.footprint([3, 1], idx(5, 5), 3), [85, 101, 117]);
});

test('v2 footprint：size [2,3] 錨 c=15 → null（出界）；r=14 rot 0（d=3）→ null', () => {
  assert.equal(R.footprint([2, 3], idx(5, 15)), null);
  assert.equal(R.footprint([2, 3], idx(14, 5)), null);
  assert.deepEqual(R.footprint([2, 3], idx(14, 5), 1), [idx(14, 5), idx(14, 6), idx(14, 7), idx(15, 5), idx(15, 6), idx(15, 7)]);
});

test('v2 canPlace：3×3 錨 (4,9) 在 8×8 視窗內 ok；錨 (4,10) → c=12 出視窗 → locked', () => {
  const H3 = { id: 'test:3x3', size: [3, 3] };
  const g = empty(); g[idx(7, 9)] = road;
  assert.equal(R.canPlace(g, H3, idx(4, 9), 0, 8).ok, true);
  assert.equal(R.canPlace(g, H3, idx(4, 10), 0, 8).reason, 'locked');
});

test('v2 canPlace：非方形旋轉後佔格不同 → 判定跟著變', () => {
  const H31 = { id: 'test:3x1', size: [3, 1] };
  const g = empty(); g[idx(8, 5)] = road;
  assert.equal(R.canPlace(g, H31, idx(5, 5), 1, 8).ok, true);   // 直放 (5..7,5)，(7,5) 貼著 (8,5) 的路
  assert.equal(R.canPlace(g, H31, idx(5, 5), 0, 8).reason, 'no_road'); // 橫放 (5,5..7) 碰不到路
});

test('v2 validateGrid：rot 1 的 3×1 從屬格要照旋轉後的佔格；照 rot 0 擺 → footprint', () => {
  const houses = [...HOUSES, { id: 'test:3x1', size: [3, 1] }];
  const grants = [grant('g1', 'test:3x1')];
  const ok = empty(); ok[idx(8, 5)] = road;
  ok[idx(5, 5)] = { t: 'house', id: 'test:3x1', ref: 'g1', rot: 1 };
  ok[idx(6, 5)] = { t: 'part', of: idx(5, 5) }; ok[idx(7, 5)] = { t: 'part', of: idx(5, 5) };
  assert.equal(R.validateGrid(ok, grants, houses).ok, true);
  const bad = empty(); bad[idx(6, 5)] = road;
  bad[idx(5, 5)] = { t: 'house', id: 'test:3x1', ref: 'g1', rot: 1 };
  bad[idx(5, 6)] = { t: 'part', of: idx(5, 5) }; bad[idx(5, 7)] = { t: 'part', of: idx(5, 5) };
  assert.equal(R.validateGrid(bad, grants, houses).reason, 'footprint');
});
