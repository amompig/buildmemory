// gestures.js — 指標事件 → 語意事件（不碰規則、不碰 three）
// 兩態：看（單指平移）／擺放（單指＝筆刷或幽靈）；雙指永遠是相機（平移＋縮放）。
// 語意事件（onEvent 收到）：
//   { type:'pan', x0,y0,x1,y1 }   { type:'zoom', factor, x,y }   { type:'tap', x,y }（看模式）
//   { type:'brushStart'|'brushMove', x,y }  { type:'brushEnd' }（擺放模式單指）
const SLOP = 6; // px：超過才算拖曳（避免雙指落下前的第一指先畫到）

export function createGestures(el, { getMode, onEvent }) {
  const pts = new Map(); // pointerId → {x,y}
  let one = null; // 單指狀態：{ x0, y0, moved, brushing }
  let two = null; // 雙指狀態：{ mx, my, d }

  const mid = () => { const [a, b] = [...pts.values()]; return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
  const endBrush = () => { if (one?.brushing) onEvent({ type: 'brushEnd' }); };

  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    try { el.setPointerCapture(e.pointerId); } catch { /* 合成事件沒有真的指標：不影響手勢 */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) one = { x0: e.clientX, y0: e.clientY, moved: false, brushing: false };
    else if (pts.size === 2) { endBrush(); one = null; two = mid(); } // 第二指落下：筆刷收尾，轉相機
  });

  el.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const prev = { ...p };
    p.x = e.clientX; p.y = e.clientY;
    if (two && pts.size === 2) {
      const now = mid();
      onEvent({ type: 'pan', x0: two.mx, y0: two.my, x1: now.mx, y1: now.my });
      if (two.d > 0 && now.d > 0) onEvent({ type: 'zoom', factor: now.d / two.d, x: now.mx, y: now.my });
      two = now;
      return;
    }
    if (!one) return;
    if (!one.moved && Math.hypot(p.x - one.x0, p.y - one.y0) < SLOP) return;
    if (getMode() === 'view') {
      onEvent({ type: 'pan', x0: one.moved ? prev.x : one.x0, y0: one.moved ? prev.y : one.y0, x1: p.x, y1: p.y });
    } else if (!one.brushing) {
      one.brushing = true;
      onEvent({ type: 'brushStart', x: one.x0, y: one.y0 });
      onEvent({ type: 'brushMove', x: p.x, y: p.y });
    } else onEvent({ type: 'brushMove', x: p.x, y: p.y });
    one.moved = true;
  });

  const up = (e) => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size === 1) { two = null; one = null; return; } // 雙指放掉一指：剩下那指不接續（避免誤塗）
    if (pts.size > 0 || !one) return;
    if (one.brushing) onEvent({ type: 'brushEnd' });
    else if (!one.moved && e.type === 'pointerup') {
      // 點一下：看模式 = tap；擺放模式 = 一格的筆刷
      if (getMode() === 'view') onEvent({ type: 'tap', x: one.x0, y: one.y0 });
      else { onEvent({ type: 'brushStart', x: one.x0, y: one.y0 }); onEvent({ type: 'brushEnd' }); }
    }
    one = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  // 桌機：滾輪縮放
  el.addEventListener('wheel', (e) => { e.preventDefault(); onEvent({ type: 'zoom', factor: Math.exp(-e.deltaY * 0.0015), x: e.clientX, y: e.clientY }); }, { passive: false });
}
