// rules.js — 規則純函式（規格：docs/rules_truth_table.md）
// 前後端共用同一檔；不得引入 three / DOM / 網路；時間一律由呼叫端傳入。
// 失敗一律回 { ok:false, code, ...參數 }，code 對應 schema_v1 §6 / ui_strings.json。

export const RULES = Object.freeze({
  GRID: 16, SIZES: Object.freeze([8, 10, 12, 14, 16]), UNLOCK_RATIO: 0.70,
  R_DEFAULT: 100, ACC_MAX: 200, ACC_TOLERANCE_MAX: 50,
  DAILY_CAP: 40, MIN_INTERVAL_S: 60, DAY_OFFSET_H: 4, TZ_OFFSET_H: 8,
  COUNTY_MAX_KM: 30,
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
// hs = 房型 size [w, d]（w = c 方向、d = r 方向，各 1–3；blueprint v2 提案）
// rot 1 / 3 時 w、d 對調；錨點 = 旋轉後矩形的左上（最小 r、最小 c）；任一格出界回 null
export function footprint(hs, a, rot = 0) {
  const [w, d] = rot % 2 ? [hs[1], hs[0]] : hs;
  const [r, c] = rc(a);
  if (r + d > N || c + w > N) return null;
  const out = [];
  for (let dr = 0; dr < d; dr++) for (let dc = 0; dc < w; dc++) out.push(a + dr * N + dc);
  return out;
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
  const cells = footprint(house.size, anchor, rot);
  if (!cells || !cells.every((i) => inBounds(...rc(i)) && isUnlocked(i, size))) return invalid('locked');
  if (!cells.every((i) => grid[i] === null)) return invalid('occupied');
  if (!touchesRoad(grid, cells)) return invalid('no_road');
  return ok({ cells });
}

export const canPaintRoad = (grid, i, size) => grid[i] === null && isUnlocked(i, size);

// ---------- §3b 基礎部件（data/decor.json；docs/design_reply_upgrade_2026-10-22.md §3）----------
// road 層：疊在路格上 { t:'road', deco:{ id, ref } }，每格最多 1 個，不佔格、不影響臨路與連通
// lot 層：佔 1 格空地 { t:'deco', id, ref, rot }，不需臨路、不算路
export function canPlaceDeco(grid, deco, i, size) {
  if (!isUnlocked(i, size)) return invalid('locked');
  if (deco.layer === 'road') return grid[i]?.t === 'road' && !grid[i].deco ? ok() : invalid(grid[i]?.t === 'road' ? 'occupied' : 'no_road');
  return grid[i] === null ? ok() : invalid('occupied');
}
// 盤面上所有被引用的 grant id（房子、空地部件、路上部件）
export function gridRefs(grid) {
  const out = [];
  for (const v of grid) {
    if (v?.t === 'house' || v?.t === 'deco') out.push(v.ref);
    else if (v?.t === 'road' && v.deco) out.push(v.deco.ref);
  }
  return out;
}

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
const decoShapeOk = (d) => d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).sort().join(',') === 'id,ref'
  && typeof d.id === 'string' && typeof d.ref === 'string';
function cellShapeOk(v) {
  if (v === null) return true;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v).sort().join(',');
  if (v.t === 'road') return keys === 't' || (keys === 'deco,t' && decoShapeOk(v.deco));
  if (v.t === 'deco') return keys === 'id,ref,rot,t' && typeof v.id === 'string' && typeof v.ref === 'string' && [0, 1, 2, 3].includes(v.rot);
  if (v.t === 'house') return keys === 'id,ref,rot,t' && typeof v.id === 'string' && typeof v.ref === 'string' && [0, 1, 2, 3].includes(v.rot);
  if (v.t === 'part') return keys === 'of,t' && Number.isInteger(v.of) && v.of >= 0 && v.of < CELLS;
  return false;
}

// decor = data/catalog.json 的 decor（取 layer）；舊呼叫端不給時盤面不得有部件
export function validateGrid(grid, grants, houses, decor = []) {
  if (!Array.isArray(grid) || grid.length !== CELLS || !grid.every(cellShapeOk)) return invalid('schema');
  const layerOf = new Map(decor.map((d) => [d.id, d.layer]));
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
  for (let i = 0; i < CELLS; i++) {
    const v = grid[i], d = v?.t === 'deco' ? v : v?.t === 'road' ? v.deco : null;
    if (!d) continue;
    if (layerOf.get(d.id) !== (v.t === 'deco' ? 'lot' : 'road')) return invalid('schema');
    const g = byId.get(d.ref);
    if (!g || g.kind !== 'decor' || g.item_id !== d.id || !['stock', 'placed'].includes(g.state)) return invalid('ref');
    if (seen.has(d.ref)) return invalid('dup_ref');
    seen.add(d.ref);
  }

  const fps = new Map();
  for (const a of anchors) {
    const fp = footprint(sizeOf.get(grid[a].id), a, grid[a].rot);
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

// 每日簽到 / 非精選地標：城市池加權隨機（data/city_pools.json；docs/design_reply_upgrade_2026-10-22.md §2、§4）
// 加權抽一個：list = [{ w, ... }]，rand ∈ [0, 1)
export function pickWeighted(list, rand) {
  const total = list.reduce((s, x) => s + x.w, 0);
  let t = rand * total;
  for (const x of list) { if (t < x.w) return x; t -= x.w; }
  return list[list.length - 1];
}
// 該縣市的 1×1 池（catalog.pools；對不到縣市 → default_group）→ [{ id, palettes, w }]
export function dailyPool(houses, county, pools) {
  const weights = pools.groups[pools.counties[county] ?? pools.default_group];
  return Object.entries(weights).map(([id, w]) => ({ id, w, palettes: houses.find((h) => h.id === id).palettes.length }));
}
// 先抽種類（房子 / 部件，比例 pools.daily_split），再從池裡加權抽；房子的變體同「第 2 次以上到訪」（不給原色）
export function dailyGrant(pool, decor, split, rand, rand2, rand3) {
  if (decor.length && rand < split.decor / (split.house + split.decor)) {
    const d = pickWeighted(decor.map((x) => ({ id: x.id, w: x.weight })), rand2);
    return { kind: 'decor', item_id: d.id, seed: 0 };
  }
  const h = pickWeighted(pool, rand2);
  return { kind: 'house', item_id: h.id, seed: seed(2, h.palettes, rand3) };
}

// ---------- §6b 合成升級（docs/spec_upgrade_2026-10-22.md §2）----------
// 兩棟同系列、同階（MERGE_BY = 'line_tier'；改成 'item' = 必須同 item_id）的待放房子 → 消耗兩棟、給下一階一棟
// 第 1 階 → 第 2 階：-2（1×2）或 -3（1×3）各半；第 2 階 → 第 3 階：-4（2×2）；地標與第 3 階不能合
export const MERGE_BY = 'line_tier';
export function canMerge(grants, houses, aId, bId) {
  if (aId === bId) return invalid('same');
  const a = grants.find((g) => g.id === aId), b = grants.find((g) => g.id === bId);
  if (!a || !b || a.kind !== 'house' || b.kind !== 'house') return invalid('ref');
  if (a.state !== 'stock' || b.state !== 'stock') return invalid('state');
  const ha = houses.find((h) => h.id === a.item_id), hb = houses.find((h) => h.id === b.item_id);
  if (!ha?.line || !hb?.line || ha.tier >= 3) return invalid('not_mergeable');
  const same = MERGE_BY === 'item' ? ha.id === hb.id : ha.line === hb.line && ha.tier === hb.tier;
  if (!same) return invalid('mismatch');
  return ok({ line: ha.line, tier: ha.tier });
}
// rand、rand2 ∈ [0, 1)；變體：兩棟相同 → 沿用，不同 → 兩者之一隨機
export function mergeResult({ line, tier }, seedA, seedB, rand, rand2) {
  const slug = line.slice(line.indexOf(':') + 1), pre = line.slice(0, line.indexOf(':') + 1);
  const n = tier === 1 ? (rand < 0.5 ? 2 : 3) : 4;
  return { item_id: `${pre}${slug}-${n}`, seed: seedA === seedB ? seedA : (rand2 < 0.5 ? seedA : seedB) };
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


// ---------- §8 版本 ----------
export function applyTown(baseRev, serverRev, serverGrid) {
  if (baseRev === serverRev) return ok({ rev: serverRev + 1 });
  return fail('conflict', { rev: serverRev, grid: serverGrid });
}

// ---------- §9 首啟贈品 ----------
export const STARTER_HOUSES = Object.freeze(['sys:iron', 'sys:jpdorm']); // sys:minnan 已由 Design 刪除；暫以 1×1 的日式宿舍替代，待使用者確認
export function starterGrid() {
  const grid = new Array(CELLS).fill(null);
  for (let c = 4; c <= 11; c++) grid[idx(7, c)] = { t: 'road' };
  return grid;
}
