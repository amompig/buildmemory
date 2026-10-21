// store.js — 單一狀態（grants, grid, rev）+ localStorage 立即寫
// Sprint 0 只有本機；Sprint 2 加 api.js 同步。依賴方向：views → store → shared/rules。
import { starterGrid, STARTER_HOUSES } from '../shared/rules.js';

export const KEY = 'bym:v1';

// 首啟：預鋪路 grid + 2 棟 seed 0（本機 id；Sprint 1 起改由 POST /session 發）
export function starterState(newId = () => crypto.randomUUID(), now = new Date().toISOString()) {
  const grants = STARTER_HOUSES.map((item_id) => ({
    id: newId(), kind: 'house', item_id, state: 'stock', seed: 0, landmark_id: null,
    visit_n: 1, mood: null, note: null, at: now, consumed_at: null,
  }));
  return { grid: starterGrid(), grants, rev: 0 };
}

// 讀不到或形狀不對 → null（呼叫端改用 starterState）
function read(storage) {
  try {
    const s = JSON.parse(storage.getItem(KEY));
    if (Array.isArray(s?.grid) && s.grid.length === 256 && Array.isArray(s.grants) && Number.isInteger(s.rev)) return s;
  } catch { /* 壞檔視同無存檔 */ }
  return null;
}

export function createStore(storage = globalThis.localStorage) {
  const subs = new Set();
  let state;
  const commit = (next) => {
    state = next;
    // 私密模式 / 配額滿時寫不進去：狀態仍留在記憶體，不擋操作
    try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    subs.forEach((fn) => fn(state));
  };
  state = read(storage);
  if (!state) commit(starterState());

  return {
    get: () => state,
    set: (patch) => commit({ ...state, ...patch }),
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    reset: () => commit(starterState()),
  };
}
