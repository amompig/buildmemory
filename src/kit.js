// kit.js — blueprint v2.2（data/houses_tw10.json、data/landmarks_tpe12.json）→ bake() 烘成單一幾何；配色在 GPU 上逐棟套用（槽位 shader）
// 幾何算法以 design/renderer/README.md 與 iso_renderer.js 為準；只產幾何，不碰場景與狀態。
// 座標：一格邊長 CELL；c → +x（東）、r → +z（南）、高 → +y；建築底面 y=0、原點 = 佔格中心（town 旋轉時繞這點）。
// 參考圖的 vScale / zoom 只是 2D 誇張倍率，3D 一律 1（Design 回覆 A1）。
// 參考圖只畫得到南、東兩面；3D 會轉視角，北面照南面、西面照東面開窗（winFaces 'S' 時只開南面）。
import * as THREE from 'three';

export const CELL = 2.4;

// 隨 palette 變的槽位；頂點 slot = 索引，-1 = 固定色（寫在頂點色）
export const SLOTS = ['wall', 'roof', 'door', 'accent'];

const GROUND = '#C3DDCC'; // 拱洞可看穿時的地面色（= three.scene.tile）
const GLASS = { rect: '#5F6E7B', arch: '#5F6E7B', round: '#5F6E7B', strip: '#5F6E7B', shoji: '#F3E7C8', lattice: '#4A3B30' };
const WIN_SIZE = { rect: [0.14, 0.16], arch: [0.14, 0.2], round: [0.16, 0.16], lattice: [0.12, 0.12], shoji: [0.14, 0.16], strip: [0.62, 0.09] };
const MIN_PITCH = 0.26, STRIP_PITCH = 0.9, JAMB = 0.03, PROUD = 0.004;

// ---------- 色：{ slot, mul } 或 { hex, mul } ----------
const col = (v, mul = 1) => (typeof v === 'string' && v[0] === '#' ? { hex: v, mul } : { slot: v, mul });
const darker = (c, f) => ({ ...c, mul: c.mul * f });

// ---------- 幾何累積 ----------
// 每個面：點列（凸多邊形）、色、朝外參考點（法線朝遠離 ref 的方向）
// main = 量體（牆、屋頂）：另存一份給主轉折線（EdgesGeometry）；窗、帶、拱洞等細節不描邊
function createSink() {
  const pos = [], rgb = [], slot = [], mainPos = [], tmp = new THREE.Color();
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function poly(pts, c, ref) {
    if (pts.length < 3) return;
    const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
    const cen = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
    const out = sub(cen, ref);
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) pts = pts.slice().reverse();
    const s = c.slot != null ? SLOTS.indexOf(c.slot) : -1;
    if (c.slot != null) tmp.setRGB(c.mul, c.mul, c.mul); else tmp.set(c.hex).multiplyScalar(c.mul);
    for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) {
      pos.push(p[0] * CELL, p[1] * CELL, p[2] * CELL); rgb.push(tmp.r, tmp.g, tmp.b); slot.push(s);
      if (sink.main) mainPos.push(p[0] * CELL, p[1] * CELL, p[2] * CELL);
    }
  }
  function geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
    g.setAttribute('slot', new THREE.Float32BufferAttribute(slot, 1));
    g.computeVertexNormals();
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.Float32BufferAttribute(mainPos, 3));
    return { g, m };
  }
  const sink = { poly, geometry, main: true };
  return sink;
}

// ---------- 量體 ----------
// 平面框（c0..c1 × r0..r1）以中心縮放 s；oct = 四邊各取 30% / 70%
function ring(b, s, y, oct = false) {
  const cx = (b.c0 + b.c1) / 2, cz = (b.r0 + b.r1) / 2, hw = (b.c1 - b.c0) / 2 * s, hd = (b.r1 - b.r0) / 2 * s;
  const sq = [[cx - hw, y, cz - hd], [cx + hw, y, cz - hd], [cx + hw, y, cz + hd], [cx - hw, y, cz + hd]]; // NW NE SE SW
  if (!oct) return sq;
  const o = [];
  for (let i = 0; i < 4; i++) {
    const a = sq[i], q = sq[(i + 1) % 4];
    for (const t of [0.3, 0.7]) o.push([a[0] + (q[0] - a[0]) * t, y, a[2] + (q[2] - a[2]) * t]);
  }
  return o;
}
// 兩圈之間的側面（牆 / 斜裙）＋可選的上下蓋
function loft(sink, lo, hi, c, ref, { top = null, bottom = null } = {}) {
  for (let i = 0; i < lo.length; i++) { const j = (i + 1) % lo.length; sink.poly([lo[i], lo[j], hi[j], hi[i]], c, ref); }
  if (top) sink.poly(hi, top, ref);
  if (bottom) sink.poly(lo, bottom, ref);
}

// ---------- 屋頂 ----------
function hipRoof(sink, b, s, y, h, c, ref) {
  const k = ring(b, s, y), w = b.c1 - b.c0, d = b.r1 - b.r0, along = b.alongC;
  const ins = Math.min(w, d) / 2 / Math.max(w, d) * 0.98;
  const mid = (p, q) => [(p[0] + q[0]) / 2, y + h, (p[2] + q[2]) / 2];
  // 脊兩端：長邊方向的兩個短邊中點往內縮 ins × 長邊
  let a, q;
  if (along) { a = mid(k[0], k[3]); q = mid(k[1], k[2]); } else { a = mid(k[0], k[1]); q = mid(k[3], k[2]); }
  const rA = [a[0] + (q[0] - a[0]) * ins, y + h, a[2] + (q[2] - a[2]) * ins], rB = [q[0] + (a[0] - q[0]) * ins, y + h, q[2] + (a[2] - q[2]) * ins];
  if (along) { // 脊沿 x：北 / 南兩坡為梯形，東西為三角
    sink.poly([k[0], k[1], rB, rA], c.N, ref); sink.poly([k[3], k[2], rB, rA], c.S, ref);
    sink.poly([k[0], k[3], rA], c.W, ref); sink.poly([k[1], k[2], rB], c.E, ref);
  } else {
    sink.poly([k[0], k[3], rB, rA], c.W, ref); sink.poly([k[1], k[2], rB, rA], c.E, ref);
    sink.poly([k[0], k[1], rA], c.N, ref); sink.poly([k[3], k[2], rB], c.S, ref);
  }
  return y + h;
}
function gableRoof(sink, b, s, y, h, c, end, ref) {
  const k = ring(b, s, y), along = b.alongC;
  const mid = (p, q) => [(p[0] + q[0]) / 2, y + h, (p[2] + q[2]) / 2];
  if (along) {
    const rW = mid(k[0], k[3]), rE = mid(k[1], k[2]);
    sink.poly([k[0], k[1], rE, rW], c.N, ref); sink.poly([k[3], k[2], rE, rW], c.S, ref);
    sink.poly([k[0], k[3], rW], end, ref); sink.poly([k[1], k[2], rE], end, ref);
    return { top: y + h, ends: [rW, rE] };
  }
  const rN = mid(k[0], k[1]), rS = mid(k[3], k[2]);
  sink.poly([k[0], k[3], rS, rN], c.W, ref); sink.poly([k[1], k[2], rS, rN], c.E, ref);
  sink.poly([k[0], k[1], rN], end, ref); sink.poly([k[3], k[2], rS], end, ref);
  return { top: y + h, ends: [rN, rS] };
}
// 燕尾：脊線（roof × 0.7）＋兩端翹起的尖（accent）
function swallowTips(sink, ends, c, ridge, span) {
  const [A, B] = ends, dir = [B[0] - A[0], 0, B[2] - A[2]], L = Math.hypot(dir[0], dir[2]) || 1, u = [dir[0] / L, 0, dir[2] / L];
  const perp = [-u[2], 0, u[0]], t = 0.025, k = Math.min(1, span / 0.9); // 尖的大小隨屋深（小廟不致過大）
  const up = (P) => [P[0], P[1] + t * 1.5, P[2]], off = (P, k) => [P[0] + perp[0] * k, P[1], P[2] + perp[2] * k];
  const below = [(A[0] + B[0]) / 2, A[1] - 1, (A[2] + B[2]) / 2];
  sink.poly([off(A, t), off(B, t), up(B), up(A)], ridge, below);
  sink.poly([off(A, -t), off(B, -t), up(B), up(A)], ridge, below);
  for (const [P, sgn] of [[A, -1], [B, 1]]) {
    const tip = [P[0] + u[0] * sgn * 0.09 * k, P[1] + 0.1 * k, P[2] + u[2] * sgn * 0.09 * k];
    const b0 = off(P, t), b1 = off(P, -t), back = [P[0] - u[0] * sgn * 0.06, P[1] + t, P[2] - u[2] * sgn * 0.06];
    sink.poly([b0, b1, tip], c, back); sink.poly([b0, back, tip], c, b1); sink.poly([b1, back, tip], c, b0);
  }
}
function box(sink, f, y0, y1, c, top = c) {
  const lo = ring(f, 1, y0), hi = ring(f, 1, y1), ref = [(f.c0 + f.c1) / 2, (y0 + y1) / 2, (f.r0 + f.r1) / 2];
  loft(sink, lo, hi, c, ref, { top, bottom: c });
}
function finial(sink, b, y, c, size = 0.05) {
  const cx = (b.c0 + b.c1) / 2, cz = (b.r0 + b.r1) / 2;
  box(sink, { c0: cx - size / 2, c1: cx + size / 2, r0: cz - size / 2, r1: cz + size / 2 }, y, y + size * 1.6, c);
}
function dome(sink, b, y, diam, c, tip) {
  const cx = (b.c0 + b.c1) / 2, cz = (b.r0 + b.r1) / 2, r = diam / 2, seg = 12, rings = 5, ref = [cx, y, cz];
  const P = (i, j) => { const th = (i / seg) * Math.PI * 2, ph = (j / rings) * Math.PI / 2; return [cx + Math.cos(th) * Math.cos(ph) * r, y + Math.sin(ph) * r, cz + Math.sin(th) * Math.cos(ph) * r]; };
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const p = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
    sink.poly(j === rings - 1 ? [p[0], p[1], p[2]] : p, c, ref);
  }
  finial(sink, b, y + r, tip, 0.04);
}

// ---------- 牆面上的平面件（窗、門、拱洞、徽、燈籠）----------
// face：{ len 面長, n 朝外法線, P(t, y) 牆面上沿面參數 t（0..1，由觀者看去左→右）與高度 y 的點 }；收分時隨高度縮放
function faces(b, sAt) {
  const { c0, c1, r0, r1 } = b, cx = (c0 + c1) / 2, cz = (r0 + r1) / 2;
  const at = (y) => { const s = sAt(y), hw = (c1 - c0) / 2 * s, hd = (r1 - r0) / 2 * s; return { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd }; };
  return {
    S: { len: c1 - c0, n: [0, 0, 1], P: (t, y) => { const f = at(y); return [f.x0 + t * (f.x1 - f.x0), y, f.z1]; } },
    N: { len: c1 - c0, n: [0, 0, -1], P: (t, y) => { const f = at(y); return [f.x1 - t * (f.x1 - f.x0), y, f.z0]; } },
    E: { len: r1 - r0, n: [1, 0, 0], P: (t, y) => { const f = at(y); return [f.x1, y, f.z1 - t * (f.z1 - f.z0)]; } },
    W: { len: r1 - r0, n: [-1, 0, 0], P: (t, y) => { const f = at(y); return [f.x0, y, f.z0 + t * (f.z1 - f.z0)]; } },
  };
}
const push = (p, n, k) => [p[0] + n[0] * k, p[1] + n[1] * k, p[2] + n[2] * k];
// 面上的形狀：rect / arch（圓頭，半徑 = 半寬）/ round；中心 (tc, yc)、寬 ww（格）、高 hh（格）
function shapeOn(F, kind, tc, yc, ww, hh) {
  const t0 = tc - ww / 2 / F.len, t1 = tc + ww / 2 / F.len, y0 = yc - hh / 2, y1 = yc + hh / 2;
  if (kind === 'round') {
    const pts = [];
    for (let a = 0; a < 16; a++) { const g = (a / 16) * Math.PI * 2; pts.push(F.P(tc + Math.cos(g) * ww / 2 / F.len, yc + Math.sin(g) * ww / 2)); }
    return pts;
  }
  if (kind === 'arch') {
    const r = ww / 2, pts = [F.P(t0, y0), F.P(t1, y0)];
    for (let a = 0; a <= 6; a++) { const g = (a / 6) * Math.PI; pts.push(F.P(tc + Math.cos(g) * r / F.len, y1 - r + Math.sin(g) * r)); }
    return pts;
  }
  return [F.P(t0, y0), F.P(t1, y0), F.P(t1, y1), F.P(t0, y1)];
}
// 開口＝外框環（凸出 JAMB；環的內側面就是側壁，朝向與光照自然一致）＋退在框後的面板
function opening(sink, F, kind, tc, yc, ww, hh, frame, pane, inner = 0.72) {
  const O = shapeOn(F, kind, tc, yc, ww, hh);
  const I = shapeOn(F, kind, tc, yc, ww * inner, kind === 'round' ? ww * inner : hh * (1 - (1 - inner) * 0.5));
  const n = F.n, Of = O.map((p) => push(p, n, JAMB)), If = I.map((p) => push(p, n, JAMB)), Ip = I.map((p) => push(p, n, PROUD));
  const behind = push(O[0], n, -1), hole = push(F.P(tc, yc), n, PROUD + JAMB / 2);
  for (let i = 0; i < O.length; i++) {
    const j = (i + 1) % O.length;
    sink.poly([Of[i], Of[j], If[j], If[i]], frame, behind);    // 框正面
    sink.poly([O[i], O[j], Of[j], Of[i]], frame, hole);        // 外側（朝外）
    sink.poly([Ip[i], Ip[j], If[j], If[i]], darker(frame, 1.25), push(O[i], n, JAMB / 2)); // 側壁（朝洞心）
  }
  sink.poly(Ip, pane, behind);
}
function panel(sink, F, pts, c, k = PROUD) { sink.poly(pts.map((p) => push(p, F.n, k)), c, push(pts[0], F.n, -1)); }

// ---------- 一個 block ----------
function buildBlock(sink, B, ctx) {
  const { c0, c1, r0, r1, y0, h } = B, w = c1 - c0, d = r1 - r0, yt = y0 + h;
  const sB = B.sBot ?? 1, sT = B.sTop ?? 1, ev = B.eave ?? 1, roofH = B.roofH ?? 1;
  const sAt = (y) => sB + (sT - sB) * Math.min(1, Math.max(0, (y - y0) / Math.max(1e-6, h)));
  const wall = col(B.color?.wall ?? 'wall'), roof = col(B.color?.roof ?? 'roof'), accent = col(B.color?.accent ?? 'accent'), door = col('door');
  const ref = [(c0 + c1) / 2, y0 + h / 2, (r0 + r1) / 2], above = (y) => [ref[0], y, ref[2]];
  const oct = B.shape === 'oct';
  const geo = { c0, c1, r0, r1, alongC: B.ridge ? B.ridge === 'c' : w >= d };
  const roofC = { S: roof, N: darker(roof, 0.9), W: darker(roof, 0.95), E: darker(roof, 0.85) };
  const fascia = darker(roof, 0.7);
  const slab = h <= 0.03 && !B.z;
  sink.main = true;

  // 牆（重簷 eave2：牆身中途插一圈簷）
  if (B.eave2 && !slab) {
    const ye = y0 + h * B.eave2, se = sAt(ye);
    loft(sink, ring(geo, sB, y0), ring(geo, se, ye), wall, ref);
    loft(sink, ring(geo, ev * 0.95, ye), ring(geo, ev * 0.95, ye + 0.03), fascia, above(ye), { top: roof, bottom: fascia });
    loft(sink, ring(geo, se, ye), ring(geo, sT, yt), wall, ref);
  } else loft(sink, ring(geo, sB, y0), ring(geo, sT, yt), wall, ref, { bottom: wall });
  // 頂面：flat 用屋頂色；dome / spire 以牆頂為座；其餘被屋頂蓋住
  if (!B.roof || B.roof === 'flat' || B.roof === 'dome' || B.roof === 'spire') sink.poly(ring(geo, sT, yt, oct), B.roof === 'flat' || !B.roof ? roof : wall, ref);
  if (slab) return;
  const F = faces(geo, sAt), ALL = ['S', 'N', 'E', 'W'];
  sink.main = false;

  // 簷下 AO 帶（wall × 0.78），寬度隨簷深：參考圖 px / 22 → 格
  if (ev > 1 && B.roof && !['flat', 'dome', 'spire'].includes(B.roof)) {
    const ao = Math.min(6, 2 + (ev - 1) * 14) / 22;
    for (const k of ALL) panel(sink, F[k], [F[k].P(0, yt - ao), F[k].P(1, yt - ao), F[k].P(1, yt), F[k].P(0, yt)], darker(wall, 0.78));
  }
  // 橫帶：每層一條 accent
  if (B.bands > 1) for (let k = 1; k < B.bands; k++) {
    const yb = y0 + (k * h) / B.bands;
    for (const f of ALL) panel(sink, F[f], [F[f].P(0, yb - 0.035), F[f].P(1, yb - 0.035), F[f].P(1, yb), F[f].P(0, yb)], accent, PROUD * 2);
  }
  // 舊欄位 cols：南面 n 根細柱（只剩圓山主體與小廟拜亭用）
  if (B.cols) {
    const n = Math.max(2, Math.round(d * 4 * (w >= 2 ? 1.5 : 1)));
    const cc = ctx.id === 'lm:TPE-f11' && B.id === 'main' ? col('#C7453B') : accent;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, hw = 0.02 / F.S.len; panel(sink, F.S, [F.S.P(t - hw, y0), F.S.P(t + hw, y0), F.S.P(t + hw, yt), F.S.P(t - hw, yt)], cc, PROUD * 3); }
  }

  // 窗：一層一排、窗心 0.55 層高；每面欄數受最小窗距限制；門面一樓中央不開窗
  const ws = B.window ?? ctx.windowStyle ?? 'rect', cols = B.windowCols ?? 2;
  const glass = col(B.color?.window ?? GLASS[ws] ?? GLASS.rect), frame = darker(wall, 0.6);
  const doorFace = B.door || B.arch;
  if (cols > 0 && ws !== 'none') {
    const rows = B.winRows || B.bands || 1, fH = h / rows, [ww, wh] = WIN_SIZE[ws] ?? WIN_SIZE.rect;
    const kind = ws === 'arch' ? 'arch' : ws === 'round' ? 'round' : 'rect';
    for (const f of B.winFaces === 'S' ? ['S'] : ALL) {
      const Fc = F[f], south = f === 'S';
      const n = ws === 'strip' ? Math.max(1, Math.floor(Fc.len / STRIP_PITCH)) : Math.max(1, Math.min(cols, Math.floor(Fc.len / MIN_PITCH)));
      for (let fl = 0; fl < rows; fl++) {
        const yc = y0 + (fl + 0.55) * fH;
        if (fl === 0 && doorFace && south && n <= 2) continue;
        for (let i = 0; i < n; i++) {
          const tc = (i + 0.5) / n;
          if (fl === 0 && doorFace && south && Math.abs(tc - 0.5) < 0.5 / n + 0.01) continue;
          opening(sink, Fc, kind, tc, yc, ws === 'strip' ? Math.min(ww, (Fc.len / n) * 0.8) : ww, wh, frame, glass);
          if (ws === 'lattice' || ws === 'shoji') { // 十字中框
            panel(sink, Fc, shapeOn(Fc, 'rect', tc, yc, ww * 0.08, wh * 0.9), frame, JAMB * 0.5);
            panel(sink, Fc, shapeOn(Fc, 'rect', tc, yc, ww * 0.9, wh * 0.08), frame, JAMB * 0.5);
          }
        }
      }
    }
  }
  // 門（南面一樓中央，寬 0.16、高 min(0.8h, 0.26)）；有拱洞時不另畫門
  if (B.door && !B.arch) {
    const dh = Math.min(h * 0.8, 0.26);
    opening(sink, F.S, ctx.doorStyle === 'arch' ? 'arch' : 'rect', 0.5, y0 + dh / 2, 0.16, dh, frame, door, 0.8);
  }
  // 拱洞（南面挖入）：外框 wall × 0.42、內洞 wall × 0.3；through = 看穿到地面（北面也開）
  if (B.arch) {
    const { t, w: aw, h: ah, through } = B.arch, hh = h * ah;
    panel(sink, F.S, shapeOn(F.S, 'arch', t, y0 + hh / 2, aw * F.S.len, hh), darker(wall, 0.42));
    panel(sink, F.S, shapeOn(F.S, 'arch', t, y0 + hh * 0.4, aw * 0.62 * F.S.len, hh * 0.8), through ? col(GROUND) : darker(wall, 0.3), PROUD * 2);
    if (through) {
      panel(sink, F.N, shapeOn(F.N, 'arch', 1 - t, y0 + hh / 2, aw * F.S.len, hh), darker(wall, 0.42));
      panel(sink, F.N, shapeOn(F.N, 'arch', 1 - t, y0 + hh * 0.4, aw * 0.62 * F.S.len, hh * 0.8), col(GROUND), PROUD * 2);
    }
  }
  // 古錢圓徽：每面一枚，0.86h、半徑 0.17 格；外環 #4F5B6B、內 wall × 1.05、中孔
  if (B.medallion) for (const f of ALL) {
    const yc = y0 + h * 0.86;
    panel(sink, F[f], shapeOn(F[f], 'round', 0.5, yc, 0.34, 0.34), col('#4F5B6B'));
    panel(sink, F[f], shapeOn(F[f], 'round', 0.5, yc, 0.24, 0.24), darker(wall, 1.05), PROUD * 2);
    panel(sink, F[f], shapeOn(F[f], 'round', 0.5, yc, 0.075, 0.075), col('#4F5B6B'), PROUD * 3);
  }
  // 燈籠：南面 0.7h、t = 0.12 / 0.88
  if (B.lantern) for (const t of [0.12, 0.88]) {
    const p = F.S.P(t, y0 + h * 0.7);
    box(sink, { c0: p[0] - 0.03, c1: p[0] + 0.03, r0: p[2] + 0.01, r1: p[2] + 0.07 }, p[1] - 0.04, p[1] + 0.04, col('#C7453B'));
  }

  // 屋頂：rh = 45° 坡越過半個短邊 × roofH（× 1.1）
  sink.main = true;
  const rh = 0.5 * Math.min(w, d) * roofH * 1.1;
  const eaveBase = (s) => loft(sink, ring(geo, s, yt - 0.03, oct), ring(geo, s, yt, oct), fascia, above(yt - 0.015), { bottom: fascia }); // 簷口板＋簷下
  const skirt = (s0, ya, s1, yb, isOct = false) => loft(sink, ring(geo, s0, ya, isOct), ring(geo, s1, yb, isOct), roof, above(ya));
  const band = (s, ya, yb, isOct = false) => loft(sink, ring(geo, s, ya, isOct), ring(geo, s, yb, isOct), wall, above(ya));
  const cap = (s, y, c, isOct = false) => sink.poly(ring(geo, s, y, isOct), c, above(y - 1));
  switch (B.roof) {
    case 'hip': case 'pagoda':
      eaveBase(ev);
      if (oct) { skirt(ev, yt, ev * 0.12, yt + rh, true); cap(ev * 0.12, yt + rh, roof, true); finial(sink, geo, yt + rh, accent); }
      else hipRoof(sink, geo, ev, yt, rh, roofC, above(yt - 1));
      break;
    case 'gable': eaveBase(ev); gableRoof(sink, geo, ev, yt, rh, roofC, wall, above(yt - 1)); break;
    case 'mansard': eaveBase(ev); skirt(ev, yt, ev * 0.72, yt + rh * 0.7); cap(ev * 0.72, yt + rh * 0.7, darker(roof, 1.06)); break;
    case 'hip2': {
      eaveBase(ev);
      const y1 = yt + rh * 0.45;
      skirt(ev, yt, ev * (oct ? 0.62 : 0.6), y1, oct); band(ev * (oct ? 0.62 : 0.6), y1, y1 + rh * 0.3, oct);
      sink.poly(ring(geo, ev * 0.78, y1 + rh * 0.3, oct), fascia, above(y1 + rh)); // 上簷底面
      if (oct) { skirt(ev * 0.78, y1 + rh * 0.3, ev * 0.1, y1 + rh * 1.2, true); cap(ev * 0.1, y1 + rh * 1.2, roof, true); finial(sink, geo, y1 + rh * 1.2, accent); }
      else finial(sink, geo, hipRoof(sink, geo, ev * 0.78, y1 + rh * 0.3, rh * 0.8, roofC, above(y1)), accent);
      break;
    }
    case 'swallowtail': case 'swallowtail2': {
      eaveBase(ev);
      let yg = yt, e = ev;
      if (B.roof === 'swallowtail2') {
        skirt(ev, yt, ev * 0.62, yt + rh * 0.4); band(ev * 0.62, yt + rh * 0.4, yt + rh * 0.65);
        yg = yt + rh * 0.65; e = ev * 0.8;
        sink.poly(ring(geo, e, yg), fascia, above(yg + 1));
      }
      swallowTips(sink, gableRoof(sink, geo, e, yg, rh * 0.9, roofC, wall, above(yg - 1)).ends, accent, fascia, Math.min(w, d));
      break;
    }
    case 'dome': { // 鼓座（頂面縮 0.8）＋穹頂；直徑由參考圖的螢幕寬換回格（÷√2）
      const s = sT * 0.8;
      loft(sink, ring(geo, s, yt), ring(geo, s, yt + 0.08), darker(wall, 0.95), above(yt), { top: darker(roof, 0.8) });
      dome(sink, geo, yt + 0.08, ((w + d) / 2) * 1.15 * sT * (B.domeScale ?? 1) / Math.SQRT2, roof, accent);
      break;
    }
    case 'spire': {
      const cx = (c0 + c1) / 2, cz = (r0 + r1) / 2;
      box(sink, { c0: cx - 0.015, c1: cx + 0.015, r0: cz - 0.015, r1: cz + 0.015 }, yt, yt + h, wall);
      break;
    }
    default: break;
  }
}

// ---------- 藍圖 → 絕對座標的 block 列表（展開 segments、解析 on / z）----------
export function resolveBlocks(bp) {
  const blocks = bp.blocks.map((b) => ({ ...b })), raw = [];
  for (const b of blocks) {
    if (!b.segments) { raw.push(b); continue; }
    let prev = b.on;
    for (let s = 0; s < b.segments; s++) {
      const nb = { ...b, id: s === 0 ? b.id : b.id + s, on: prev, at: s === 0 ? b.at : [0, 0] };
      delete nb.segments; raw.push(nb); prev = nb.id;
    }
    for (const o of blocks) if (o.on === b.id) o.on = prev; // 引用此 id 的 block 疊在最後一節
  }
  const byId = new Map(raw.map((b) => [b.id, b])), memo = new Map();
  const place = (b) => {
    if (memo.has(b.id)) return memo.get(b.id);
    let c = b.at[0], r = b.at[1], y0 = b.z ?? 0;
    if (b.on) { const p = place(byId.get(b.on)); c += p.c; r += p.r; y0 = p.y0 + p.h + (b.z ?? 0); }
    const v = { c, r, y0, h: b.h ?? (b.floors ?? 0) * (b.floorH ?? 0) };
    memo.set(b.id, v); return v;
  };
  return raw.map((b) => { const p = place(b); return { ...b, c0: p.c, c1: p.c + b.w, r0: p.r, r1: p.r + b.d, y0: p.y0, h: p.h }; });
}

const hex = (s) => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);
const DEFAULTS = { wall: 0xF4E6D2, roof: 0xC97D4B, door: 0x8E6B50, accent: 0xE9A8A3 };

// palette（palettes 的一組）→ 依 SLOTS 順序的 RGB（線性色彩空間，與頂點色一致）
// seed 超出範圍時退回第 0 組原色
export function paletteRGB(house, seed) {
  const p = house.palettes?.[seed] ?? house.palettes?.[0] ?? {};
  const out = new Float32Array(SLOTS.length * 3), c = new THREE.Color();
  SLOTS.forEach((k, i) => c.setHex(hex(p[k] ?? DEFAULTS[k])).toArray(out, i * 3));
  return out;
}

// house = 房型一筆（houses_tw10 / landmarks_tpe12 的形狀）→ { g: 單一 BufferGeometry（position / normal / color / slot），m: 量體幾何（給轉折線）}
// 原點 = 佔格中心；同房型所有變體共用這份幾何；搭配 houseMaterial + 每棟槽位色 = 1 個 draw call
function build(house) {
  const sink = createSink(), [W, D] = house.size;
  if (house.blueprint) {
    const ctx = { id: house.id, windowStyle: house.window_style, doorStyle: house.door_style };
    for (const b of resolveBlocks(house.blueprint)) buildBlock(sink, b, ctx);
  } else box(sink, { c0: W * 0.15, c1: W * 0.85, r0: D * 0.15, r1: D * 0.85 }, 0, 0.5, col('wall'), col('roof')); // 沒有藍圖：色塊
  const { g, m } = sink.geometry();
  for (const x of [g, m]) { x.translate((-W / 2) * CELL, 0, (-D / 2) * CELL); x.computeBoundingBox(); }
  return { g, m };
}
export const bake = (house) => build(house).g;

const cache = new Map();
const built = (house) => { if (!cache.has(house.id)) cache.set(house.id, build(house)); return cache.get(house.id); };
export const bakeCached = (house) => built(house).g;

// 主轉折線（palette.json three.edges）：量體上夾角 ≥ threshold 的邊；窗框、橫帶不描邊
const edgeCache = new Map();
export function bakeEdges(house, thresholdDeg = 60) {
  if (!edgeCache.has(house.id)) edgeCache.set(house.id, new THREE.EdgesGeometry(built(house).m, thresholdDeg));
  return edgeCache.get(house.id);
}

// 每棟槽位色的 instanced 屬性名（依 SLOTS 順序）
export const SLOT_ATTRS = SLOTS.map((k) => `i${k[0].toUpperCase()}${k.slice(1)}`);

// 所有房型共用一個材質：固定色在頂點色；槽位面的頂點色是明暗倍率，乘上每棟的 iWall…iAccent
export const houseMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
// 例：slot < 0.5 ? iWall : slot < 1.5 ? iRoof : … : iAccent
const PICK = SLOT_ATTRS.slice(0, -1).map((a, i) => `slot < ${i}.5 ? ${a} : `).join('') + SLOT_ATTRS.at(-1);
houseMaterial.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', ['#include <common>', 'attribute float slot;', ...SLOT_ATTRS.map((a) => `attribute vec3 ${a};`)].join('\n'))
    .replace('#include <color_vertex>', `#include <color_vertex>\nif (slot > -0.5) vColor = (${PICK}) * color;`);
};
houseMaterial.customProgramCacheKey = () => 'bym-slots-v22';
