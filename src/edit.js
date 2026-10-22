// edit.js — 語意事件 → rules 驗證 → store 修改（塗路/擦路/落房/拆除/旋轉）+ 擺放中復原
// 基礎部件（grant.kind 'decor'）走同一組 check / place / remove / rotate：路上部件疊在路格、空地部件佔 1 格
// 無 DOM、無 three。失敗回 rules 同形狀 { ok:false, code:'invalid', reason }。
import * as R from '../shared/rules.js';

const fail = (reason) => ({ ok: false, code: 'invalid', reason });

// houses = 房型＋部件（catalog.houses ∪ catalog.decor）
export function createEditor(store, houses) {
  const byId = new Map(houses.map((h) => [h.id, h]));
  const setState = (grants, ref, state) => grants.map((x) => (x.id === ref ? { ...x, state } : x));
  // 復原堆疊：每步存編輯前的 {grid, grants}，最多 20 步；一筆連續塗路（beginStroke…endStroke）算一步；done() 清空
  let history = [];
  let stroke = null;
  const snap = () => { const { grid, grants } = store.get(); return { grid, grants }; };
  const UNDO_MAX = 20; // gestures.md §3
  const push = (h) => { history.push(h); if (history.length > UNDO_MAX) history.shift(); };
  const apply = (patch) => { if (!stroke) push(snap()); store.set(patch); return { ok: true }; };
  const anchorOf = (grid, i) => (grid[i]?.t === 'part' ? grid[i].of : i);

  return {
    beginStroke() { stroke = snap(); },
    endStroke() {
      if (stroke && stroke.grid !== store.get().grid) push(stroke);
      stroke = null;
    },

    paintRoad(i) {
      const { grid } = store.get();
      if (grid[i]?.t === 'road') return { ok: true }; // 拖過已有的路：不算錯
      if (!R.canPaintRoad(grid, i, R.unlockedSize(grid))) return fail(grid[i] === null ? 'locked' : 'occupied');
      const next = grid.slice(); next[i] = { t: 'road' };
      return apply({ grid: next });
    },

    eraseRoad(i) {
      const { grid } = store.get();
      if (grid[i]?.t !== 'road') return fail('not_road');
      const r = R.canEraseRoad(grid, i);
      if (!r.ok) return r;
      const next = grid.slice(); next[i] = null;
      // 路上有部件 → 部件自動回倉庫，不擋擦路
      return apply(grid[i].deco ? { grid: next, grants: setState(store.get().grants, grid[i].deco.ref, 'stock') } : { grid: next });
    },

    // 幽靈預覽：同 placeHouse 的檢查，不改 store
    checkHouse(grantId, anchor, rot = 0) {
      const { grid, grants } = store.get();
      const g = grants.find((x) => x.id === grantId);
      if (!g || !['house', 'decor'].includes(g.kind) || g.state !== 'stock' || !byId.has(g.item_id)) return fail('ref');
      if (g.kind === 'decor') {
        const r = R.canPlaceDeco(grid, byId.get(g.item_id), anchor, R.unlockedSize(grid));
        return r.ok ? { ok: true, cells: [anchor] } : r;
      }
      return R.canPlace(grid, byId.get(g.item_id), anchor, rot, R.unlockedSize(grid));
    },

    placeHouse(grantId, anchor, rot = 0) {
      const r = this.checkHouse(grantId, anchor, rot);
      if (!r.ok) return r;
      const { grid, grants } = store.get();
      const g = grants.find((x) => x.id === grantId);
      const next = grid.slice();
      if (g.kind === 'decor') next[anchor] = byId.get(g.item_id).layer === 'road' ? { t: 'road', deco: { id: g.item_id, ref: g.id } } : { t: 'deco', id: g.item_id, ref: g.id, rot };
      else for (const i of r.cells) next[i] = i === anchor ? { t: 'house', id: g.item_id, ref: g.id, rot } : { t: 'part', of: anchor };
      return apply({ grid: next, grants: setState(grants, g.id, 'placed') });
    },

    // i 可以是錨點或從屬格；也收部件（空地部件 → 空格、路上部件 → 留下路）
    removeHouse(i) {
      const { grid, grants } = store.get();
      const v = grid[i];
      if (v?.t === 'deco' || v?.deco) {
        const next = grid.slice(); next[i] = v.t === 'deco' ? null : { t: 'road' };
        return apply({ grid: next, grants: setState(grants, v.t === 'deco' ? v.ref : v.deco.ref, 'stock') });
      }
      const a = anchorOf(grid, i);
      if (grid[a]?.t !== 'house') return fail('not_house');
      const { grid: next, ref } = R.removeHouse(grid, a);
      return apply({ grid: next, grants: grants.map((x) => (x.id === ref ? { ...x, state: 'stock' } : x)) });
    },

    // 非方形房轉向後佔格會變：先拿掉自己，再用新 rot 檢查一次能不能放
    rotate(i) {
      const { grid } = store.get();
      if (grid[i]?.t === 'deco') { const next = grid.slice(); next[i] = { ...grid[i], rot: (grid[i].rot + 1) % 4 }; return apply({ grid: next }); }
      const a = anchorOf(grid, i);
      if (grid[a]?.t !== 'house') return fail('not_house');
      const house = grid[a], rot = (house.rot + 1) % 4;
      const { grid: without } = R.removeHouse(grid, a);
      const r = R.canPlace(without, byId.get(house.id) ?? { size: [1, 1] }, a, rot, R.unlockedSize(grid));
      if (!r.ok) return r;
      const next = without;
      for (const c of r.cells) next[c] = c === a ? { ...house, rot } : { t: 'part', of: a };
      return apply({ grid: next });
    },

    canUndo: () => history.length > 0,
    undo() {
      if (!history.length) return fail('empty');
      store.set(history.pop());
      return { ok: true };
    },
    done() { history = []; stroke = null; },
  };
}
