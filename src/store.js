// store.js — 單一狀態（grants, grid, rev）+ localStorage 立即寫 + 2 s debounce 同步（PUT /api/town）
// 依賴方向：views → store → shared/rules。伺服器是庫存權威：連上後以 GET /me 為準。
import { starterGrid, STARTER_HOUSES } from '../shared/rules.js';

export const KEY = 'bym:v1';

// 首啟（離線 / 尚未連上伺服器時的本機版）：預鋪路 grid + 2 棟 seed 0
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

// grant state 依 grid 重算（與伺服器 PUT /town 的批次規則相同）：在 grid 裡 → placed，不在 → stock
const restate = (grants, grid) => {
  const refs = new Set(grid.filter((x) => x?.t === 'house').map((x) => x.ref));
  return grants.map((g) => (g.state === 'dismantled' ? g : { ...g, state: refs.has(g.id) ? 'placed' : 'stock' }));
};

// api = src/api.js 的 api()；不給就是純本機（Sprint 0 / 單元測試）
// onEvent({type}) ：'synced' | 'offline' | 'conflict' | 'rejected' | 'replaced'（狀態被伺服器版取代，呼叫端應清空復原堆疊）
export function createStore(storage = globalThis.localStorage, { api = null, onEvent = () => {}, debounceMs = 2000 } = {}) {
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

  // ---------- 同步 ----------
  let timer = null, inflight = false, pending = null; // pending = { op_id, grid }：同一份 grid 重送沿用同一個 op_id
  const schedule = (ms = debounceMs) => { if (!api) return; clearTimeout(timer); timer = setTimeout(push, ms); };

  // GET /me（401 → 先取 session 再試一次）→ 以伺服器版取代本機
  async function pull() {
    let r = await api('GET', '/api/me');
    if (!r.ok && r.code === 'unauthorized') { await api('POST', '/api/session', {}); r = await api('GET', '/api/me'); }
    if (!r.ok) return r;
    const { grants, town } = r.data;
    pending = null;
    commit({ grants, grid: town.grid, rev: town.rev, dirty: false });
    return r;
  }

  async function push() {
    if (!state.dirty) return;
    if (inflight) return schedule(500);
    inflight = true;
    const grid = state.grid;
    if (pending?.grid !== grid) pending = { op_id: crypto.randomUUID(), grid };
    let r = await api('PUT', '/api/town', { grid, base_rev: state.rev, op_id: pending.op_id });
    if (!r.ok && r.code === 'unauthorized') { await api('POST', '/api/session', {}); r = await api('PUT', '/api/town', { grid, base_rev: state.rev, op_id: pending.op_id }); }
    inflight = false;
    if (r.ok) {
      pending = null;
      commit({ ...state, rev: r.data.rev, dirty: state.grid !== grid }); // 送出期間又改了 → 還要再送
      if (state.dirty) schedule(); else onEvent({ type: 'synced' });
    } else if (r.code === 'offline') onEvent({ type: 'offline' }); // 回到線上（online 事件）再送
    else if (r.code === 'rate_limited') schedule((r.retry_after ?? 5) * 1000);
    else if (r.code === 'conflict' || r.code === 'invalid') {
      // 409：Sprint 2 才有兩版擇一對話；目前以伺服器版為準
      const p = await pull();
      onEvent({ type: r.code === 'conflict' ? 'conflict' : 'rejected', reason: r.reason });
      if (p.ok) onEvent({ type: 'replaced' });
    }
  }

  return {
    get: () => state,
    set(patch) {
      commit({ ...state, ...patch, ...(patch.grid ? { dirty: true } : {}) });
      if (patch.grid) schedule();
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    reset: () => commit(starterState()),

    // 啟動時：本機有沒送出的修改且版本仍與伺服器相同 → 送本機；否則以伺服器版為準
    async connect() {
      if (!api) return { ok: false, code: 'offline' };
      const local = state;
      await api('POST', '/api/session', {}); // 有 cookie 就沿用、沒有就建帳（先取 session，免得 GET /me 先吃一次 401）
      const r = await pull();
      if (!r.ok) { if (local.dirty) commit({ ...local }); return r; }
      if (local.dirty && local.rev === r.data.town.rev) { commit({ ...state, grid: local.grid, grants: restate(state.grants, local.grid), dirty: true }); await push(); }
      onEvent({ type: 'replaced' });
      return r;
    },
    flush: push,
  };
}
