// gestures.js — 指標事件 → 語意事件（不碰規則、不碰 three）；門檻照 design/gestures.md §3
// 兩態：看（單指平移）／擺放（單指＝筆刷或幽靈）；雙指永遠是相機（平移＋縮放）。
// 語意事件（onEvent 收到）：
//   { type:'pan', x0,y0,x1,y1 }   { type:'zoom', factor, x,y }   { type:'tap', x,y }（看模式）
//   { type:'brushStart'|'brushMove', x,y }  { type:'brushEnd' }（擺放模式單指）
//   { type:'lift', x,y }（長按 400 ms，兩態皆有）
const SLOP = 8;         // px：pan 起算、tap 判定
const TAP_MS = 250;
const LONG_MS = 400;
const AFTER_TWO_MS = 150; // 第二指抬起後這段時間內不恢復單指動作

export function createGestures(el, { getMode, onEvent }) {
  const pts = new Map(); // pointerId → {x,y}
  let one = null; // 單指狀態：{ x0, y0, t0, moved, brushing, lifted, timer }
  let two = null; // 雙指狀態：{ mx, my, d }
  let quietUntil = 0;

  const mid = () => { const [a, b] = [...pts.values()]; return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
  const endOne = () => {
    if (!one) return;
    clearTimeout(one.timer);
    if (one.brushing) onEvent({ type: 'brushEnd' });
    one = null;
  };

  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    try { el.setPointerCapture(e.pointerId); } catch { /* 合成事件沒有真的指標：不影響手勢 */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      if (performance.now() < quietUntil) return;
      one = { x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, brushing: false, lifted: false };
      one.timer = setTimeout(() => {
        if (one && !one.moved && pts.size === 1) { one.lifted = true; navigator.vibrate?.(10); onEvent({ type: 'lift', x: one.x0, y: one.y0 }); }
      }, LONG_MS);
    } else if (pts.size === 2) { endOne(); two = mid(); } // 第二指落下：立刻取消單指，交給相機
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
    if (!one.moved) clearTimeout(one.timer);
    // 長按拿起後：手指移動 = 搬著幽靈走
    if (getMode() === 'view' && !one.lifted) {
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
    if (two) { if (pts.size < 2) { two = null; quietUntil = performance.now() + AFTER_TWO_MS; } return; }
    if (pts.size > 0 || !one) return;
    clearTimeout(one.timer);
    if (one.brushing) onEvent({ type: 'brushEnd' });
    else if (one.lifted) onEvent({ type: 'brushEnd' }); // 長按拿起後原地放手 = 放回去
    else if (!one.moved && e.type === 'pointerup' && performance.now() - one.t0 < TAP_MS) {
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
