// rules.js — 規則純函式（規格：docs/rules_truth_table.md）
// 前後端共用同一檔；不得引入 three / DOM / 網路；時間一律由呼叫端傳入。
// 失敗一律回 { ok:false, code, ...參數 }，code 對應 schema_v1 §6 / ui_strings.json。

export const RULES = Object.freeze({
  GRID: 16, SIZES: Object.freeze([8, 10, 12, 14, 16]), UNLOCK_RATIO: 0.70,
  R_DEFAULT: 100, ACC_MAX: 200, ACC_TOLERANCE_MAX: 50,
  DAILY_CAP: 40, MIN_INTERVAL_S: 60, DAY_OFFSET_H: 4, TZ_OFFSET_H: 8,
  DAILY_HOUSE: 'sys:iron', DAILY_HOUSE_MAX: 3, COUNTY_MAX_KM: 30,
  NOTE_MAX: 40, MOODS: Object.freeze([0, 1, 2, 3, 4]),
});

const N = RULES.GRID;
const CELLS = N * N;
const ok = (extra) => ({ ok: true, ...extra });
const fail = (code, extra) => ({ ok: false, code, ...extra });
const invalid = (reason) => fail('invalid', { reason });

// ---------- §1 格線 ----------
export const idx = (r, c) => r * N + c;
export const rc = (i) => [Math.floor(i / N), i % N];
export const inBounds = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
export function window(size) { const lo = (N - size) / 2; return [lo, lo + size - 1]; }
export function isUnlocked(i, size) {
  const [r, c] = rc(i), [lo, hi] = window(size);
  return r >= lo && r <= hi && c >= lo && c <= hi;
}
// 順序：上、左、右、下
export function neighbors4(i) {
  const [r, c] = rc(i), out = [];
  for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) if (inBounds(r + dr, c + dc)) out.push(idx(r + dr, c + dc));
  return out;
}

// ---------- §2 解鎖 ----------
export function unlockedSize(grid) {
  let size = RULES.SIZES[0];
  while (size < N) {
    let cells = 0, filled = 0;
    for (let i = 0; i < CELLS; i++) if (isUnlocked(i, size)) { cells++; if (grid[i] != null) filled++; }
    if (filled / cells >= RULES.UNLOCK_RATIO) size += 2; else break;
  }
  return size;
}

// ---------- §3 佔格與放置 ----------
// hs = 房型 size，[1,1] 或 [2,2]；2×2 錨點為左上，越界回 null
export function footprint(hs, a) {
  if (hs[0] === 1 && hs[1] === 1) return [a];
  const [r, c] = rc(a);
  if (r >= N - 1 || c >= N - 1) return null;
  return [a, a + 1, a + N, a + N + 1];
}
// cells 以外的上下左右鄰格中至少一格是路
function touchesRoad(grid, cells) {
  return cells.some((i) => neighbors4(i).some((n) => !cells.includes(n) && grid[n]?.t === 'road'));
}
// 從 grid 本身找出某錨點佔的格（錨點 + of 指向它的 part），不必查 houses.json
function cellsOf(grid, a) {
  const out = [a];
  for (let i = 0; i < CELLS; i++) if (grid[i]?.t === 'part' && grid[i].of === a) out.push(i);
  return out;
}

export function canPlace(grid, house, anchor, rot, size) {
  if (![0, 1, 2, 3].includes(rot)) return invalid('rot');
  const cells = footprint(house.size, anchor);
  if (!cells || !cells.every((i) => inBounds(...rc(i)) && isUnlocked(i, size))) return invalid('locked');
  if (!cells.every((i) => grid[i] === null)) return invalid('occupied');
  if (!touchesRoad(grid, cells)) return invalid('no_road');
  return ok({ cells });
}

export const canPaintRoad = (grid, i, size) => grid[i] === null && isUnlocked(i, size);

export function canEraseRoad(grid, i) {
  const after = grid.slice(); after[i] = null;
  const anchors = new Set();
  for (const n of neighbors4(i)) {
    if (grid[n]?.t === 'house') anchors.add(n);
    else if (grid[n]?.t === 'part') anchors.add(grid[n].of);
  }
  for (const a of anchors) if (!touchesRoad(after, cellsOf(after, a))) return invalid('orphan');
  return ok();
}

export function removeHouse(grid, anchor) {
  const next = grid.slice();
  for (const i of cellsOf(grid, anchor)) next[i] = null;
  return { grid: next, ref: grid[anchor]?.ref };
}

// ---------- §4 整鎮驗證 ----------
// houses = houses.json 的 houses 陣列（取 size 算 footprint）
function cellShapeOk(v) {
  if (v === null) return true;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v).sort().join(',');
  if (v.t === 'road') return keys === 't';
  if (v.t === 'house') return keys === 'id,ref,rot,t' && typeof v.id === 'string' && typeof v.ref === 'string' && [0, 1, 2, 3].includes(v.rot);
  if (v.t === 'part') return keys === 'of,t' && Number.isInteger(v.of) && v.of >= 0 && v.of < CELLS;
  return false;
}

export function validateGrid(grid, grants, houses) {
  if (!Array.isArray(grid) || grid.length !== CELLS || !grid.every(cellShapeOk)) return invalid('schema');
  const sizeOf = new Map(houses.map((h) => [h.id, h.size]));
  const anchors = [];
  for (let i = 0; i < CELLS; i++) if (grid[i]?.t === 'house') {
    if (!sizeOf.has(grid[i].id)) return invalid('schema');
    anchors.push(i);
  }

  const size = unlockedSize(grid);
  for (let i = 0; i < CELLS; i++) if (grid[i] !== null && !isUnlocked(i, size)) return invalid('locked');

  const byId = new Map(grants.map((g) => [g.id, g]));
  const seen = new Set();
  for (const a of anchors) {
    const { id, ref } = grid[a], g = byId.get(ref);
    if (!g || g.kind !== 'house' || g.item_id !== id || !['stock', 'placed'].includes(g.state)) return invalid('ref');
    if (seen.has(ref)) return invalid('dup_ref');
    seen.add(ref);
  }

  const fps = new Map();
  for (const a of anchors) {
    const fp = footprint(sizeOf.get(grid[a].id), a);
    if (!fp || fp.some((i) => i !== a && !(grid[i]?.t === 'part' && grid[i].of === a))) return invalid('footprint');
    fps.set(a, fp);
  }
  for (let i = 0; i < CELLS; i++) if (grid[i]?.t === 'part' && !fps.get(grid[i].of)?.includes(i)) return invalid('footprint');

  // 以「把自己移除後的 grid」檢查鄰路：自己的格都不是路，結果等同直接檢查
  for (const [, fp] of fps) if (!touchesRoad(grid, fp)) return invalid('no_road');
  return ok();
}

// ---------- §5 距離與打卡 ----------
export function distanceM(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180, R = 6371000;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function checkinDistance(dist, R, acc) {
  if (acc > RULES.ACC_MAX) return fail('weak_signal');
  if (dist > R + Math.min(acc, RULES.ACC_TOLERANCE_MAX)) return fail('too_far', { dist: Math.round(dist / 10) * 10 });
  return ok();
}

const H = 3600 * 1000;
export const tpeDay = (isoUtc) =>
  new Date(Date.parse(isoUtc) + (RULES.TZ_OFFSET_H - RULES.DAY_OFFSET_H) * H).toISOString().slice(0, 10);
// day 結束 = 次日台北 04:00 = 當天 UTC 20:00
export const cooldownUntil = (day) => `${day}T${String(24 - RULES.TZ_OFFSET_H + RULES.DAY_OFFSET_H).padStart(2, '0')}:00:00Z`;

// now / lastAt 為 ISO 字串；lastAt 可為 null（無上一筆）
export function canCheckin({ existsSameDay, countToday, lastAt, now }) {
  if (existsSameDay) return fail('cooldown', { until: cooldownUntil(tpeDay(now)) });
  if (countToday >= RULES.DAILY_CAP) return fail('daily_cap');
  if (lastAt) {
    const elapsed = (Date.parse(now) - Date.parse(lastAt)) / 1000;
    if (elapsed < RULES.MIN_INTERVAL_S) return fail('rate_limited', { retry_after: Math.ceil(RULES.MIN_INTERVAL_S - elapsed) });
  }
  return ok();
}

export const visitN = (prevVisits) => prevVisits + 1;
// rand ∈ [0,1)；第 1 次為原色 0，之後 1..paletteCount-1
export const seed = (visitN, paletteCount, rand) => (visitN === 1 ? 0 : 1 + Math.floor(rand * (paletteCount - 1)));

// ---------- §6 每日簽到 ----------
// landmarks = landmarks.json 的 items；判不到回 null，由呼叫端轉 invalid
export function countyOf(lat, lng, landmarks) {
  let best = null, bestD = Infinity;
  for (const lm of landmarks) {
    const d = distanceM(lat, lng, lm.lat, lm.lng);
    if (d < bestD) { bestD = d; best = lm; }
  }
  return best && bestD <= RULES.COUNTY_MAX_KM * 1000 ? best.county : null;
}

// stock + placed 的 sys:iron 列數（dismantled 不計）
export const ironOwned = (grants) =>
  grants.filter((g) => g.item_id === RULES.DAILY_HOUSE && (g.state === 'stock' || g.state === 'placed')).length;

export function dailyGrant(ironOwnedCount, rand, paletteCount) {
  if (ironOwnedCount >= RULES.DAILY_HOUSE_MAX) return { kind: 'shard', item_id: RULES.DAILY_HOUSE, state: 'dismantled' };
  return { kind: 'house', item_id: RULES.DAILY_HOUSE, seed: seed(2, paletteCount, rand) };
}

// ---------- §7 記憶卡與拆解 ----------
export function validateMemory({ mood, note }) {
  if (mood === undefined) mood = null;
  if (mood !== null && !RULES.MOODS.includes(mood)) return invalid('mood');
  if (note === undefined || note === null) return ok({ mood, note: null });
  if (typeof note !== 'string') return invalid('note');
  const clean = note.normalize('NFC').replace(/\p{Cc}/gu, '').trim();
  if ([...clean].length > RULES.NOTE_MAX) return invalid('note');
  return ok({ mood, note: clean === '' ? null : clean });
}

// grants = 本人的列；ids 重複視為 invalid
export function canDismantle(grants, ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 99 || new Set(ids).size !== ids.length) return invalid('ids');
  const byId = new Map(grants.map((g) => [g.id, g]));
  if (!ids.every((id) => byId.get(id)?.state === 'stock')) return invalid('state');
  return ok();
}

export const shards = (grants) =>
  grants.filter((g) => g.kind === 'house' && g.state === 'dismantled' && g.consumed_at == null).length;

// ---------- §8 版本 ----------
export function applyTown(baseRev, serverRev, serverGrid) {
  if (baseRev === serverRev) return ok({ rev: serverRev + 1 });
  return fail('conflict', { rev: serverRev, grid: serverGrid });
}

// ---------- §9 首啟贈品 ----------
export const STARTER_HOUSES = Object.freeze(['sys:iron', 'sys:minnan']);
export function starterGrid() {
  const grid = new Array(CELLS).fill(null);
  for (let c = 4; c <= 11; c++) grid[idx(7, c)] = { t: 'road' };
  return grid;
}
