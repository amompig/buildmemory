// kit.js — 程式生成建築部件示範（零外部資產）
import * as THREE from 'three';

export const PAL = {
  sand: 0xF2DDB5, cream: 0xFFF6E8, rose: 0xE9A8A3, lilac: 0xBBA9DC, mint: 0xA9D9C7,
  brick: 0xC9705B, wood: 0x8E6B50, dark: 0x4F5B6B, white: 0xF7F3EE, slate: 0x6F7F8C,
  blue: 0x5B8BC9, terracotta: 0xC97D4B, plaster: 0xF4E6D2, ink: 0x3A3A48, tile: 0x7A8B99,
  glass: 0x9FC8D9, gold: 0xE2B45A, red: 0xC7453B, thatch: 0xC8A86A, green: 0x6FA88A,
};

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  return mats.get(key);
}
export function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; return m;
}
export function cyl(rt, rb, h, color, seg = 24, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; return m;
}
// 三角柱（山牆屋頂用）：寬 w、深 d、高 h，沿 x 軸的山脊
export function prism(w, h, d, color) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(-w / 2, 0, 0);
  const m = new THREE.Mesh(g, mat(color)); m.castShadow = m.receiveShadow = true; return m;
}

// ---------- 部件：窗 ----------
const WINDOWS = {
  plain: (c) => { const g = new THREE.Group(); g.add(box(0.26, 0.34, 0.06, PAL.glass)); g.add(box(0.32, 0.04, 0.08, c.trim, 0, -0.02)); return g; },
  arch: (c) => { const g = new THREE.Group(); g.add(box(0.24, 0.26, 0.06, PAL.glass, 0, 0)); const t = cyl(0.12, 0.12, 0.06, PAL.glass, 16); t.rotation.x = Math.PI / 2; t.position.set(0, 0.26, 0); g.add(t); g.add(box(0.32, 0.04, 0.08, c.trim, 0, -0.02)); return g; },
  koshi: (c) => { // 町家格子窗
    const g = new THREE.Group(); g.add(box(0.5, 0.36, 0.04, PAL.ink));
    for (let i = -2; i <= 2; i++) g.add(box(0.04, 0.36, 0.07, c.trim, i * 0.1, 0, 0.01));
    g.add(box(0.5, 0.04, 0.09, c.trim, 0, 0.17, 0.01)); g.add(box(0.5, 0.04, 0.09, c.trim, 0, -0.04, 0.01));
    return g;
  },
  round: (c) => { const g = new THREE.Group(); const t = cyl(0.16, 0.16, 0.06, PAL.glass, 20); t.rotation.x = Math.PI / 2; t.position.y = 0.18; g.add(t); const r = cyl(0.2, 0.2, 0.04, c.trim, 20); r.rotation.x = Math.PI / 2; r.position.set(0, 0.18, -0.02); g.add(r); return g; },
  shutter: (c) => { const g = WINDOWS.plain(c); g.add(box(0.1, 0.36, 0.05, c.accent, -0.2, 0)); g.add(box(0.1, 0.36, 0.05, c.accent, 0.2, 0)); return g; },
};
// ---------- 部件：門 ----------
const DOORS = {
  plain: (c) => { const g = new THREE.Group(); g.add(box(0.36, 0.6, 0.06, c.door)); g.add(box(0.44, 0.06, 0.1, c.trim, 0, 0.58)); return g; },
  arch: (c) => { const g = new THREE.Group(); g.add(box(0.36, 0.45, 0.06, c.door)); const t = cyl(0.18, 0.18, 0.06, c.door, 16); t.rotation.x = Math.PI / 2; t.position.y = 0.45; g.add(t); return g; },
  noren: (c) => { const g = new THREE.Group(); g.add(box(0.5, 0.62, 0.05, PAL.ink)); const n = box(0.5, 0.3, 0.03, c.accent, 0, 0.34, 0.04); g.add(n); g.add(box(0.02, 0.3, 0.04, PAL.white, -0.08, 0.34, 0.045)); g.add(box(0.02, 0.3, 0.04, PAL.white, 0.08, 0.34, 0.045)); return g; },
  double: (c) => { const g = new THREE.Group(); g.add(box(0.26, 0.62, 0.06, c.door, -0.14)); g.add(box(0.26, 0.62, 0.06, c.door, 0.14)); g.add(box(0.6, 0.06, 0.1, c.trim, 0, 0.62)); return g; },
};
// ---------- 部件：屋頂 ----------
const ROOFS = {
  flat: (w, d, c) => { const g = new THREE.Group(); g.add(box(w + 0.1, 0.08, d + 0.1, c.roof)); g.add(box(w - 0.2, 0.1, d - 0.2, c.wall, 0, 0.08)); return g; },
  gable: (w, d, c, h = 0.7) => { const g = new THREE.Group(); const p = prism(w + 0.2, h, d + 0.3, c.roof); g.add(p); return g; },
  hip: (w, d, c, h = 0.55) => { const g = new THREE.Group(); const geo = new THREE.CylinderGeometry(0.001, 1, h, 4); const m = new THREE.Mesh(geo, mat(c.roof)); m.scale.set((w + 0.3) / 1.414, 1, (d + 0.3) / 1.414); m.rotation.y = Math.PI / 4; m.position.y = h / 2; m.castShadow = true; g.add(m); return g; },
  swallowtail: (w, d, c) => { // 閩南燕尾脊
    const g = ROOFS.gable(w, d, { ...c, roof: c.roof }, 0.55);
    const ridge = box(w + 0.5, 0.06, 0.08, c.accent, 0, 0.55); g.add(ridge);
    [-1, 1].forEach(s => { const tip = box(0.12, 0.22, 0.06, c.accent, s * (w / 2 + 0.22), 0.6); tip.rotation.z = -s * 0.5; g.add(tip); });
    return g;
  },
  dome: (w, d, c) => { const g = new THREE.Group(); const r = Math.min(w, d) / 2; const geo = new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); const m = new THREE.Mesh(geo, mat(c.roof)); m.castShadow = true; g.add(m); return g; },
  thatch: (w, d, c) => { const g = new THREE.Group(); g.add(prism(w + 0.4, 1.1, d + 0.5, c.roof)); g.add(box(w + 0.5, 0.06, 0.12, PAL.wood, 0, 1.08)); return g; },
  pagoda: (w, d, c) => { const g = new THREE.Group(); const geo = new THREE.CylinderGeometry(0.05, 1, 0.4, 4); const m = new THREE.Mesh(geo, mat(c.roof)); m.scale.set((w + 0.5) / 1.414, 1, (d + 0.5) / 1.414); m.rotation.y = Math.PI / 4; m.position.y = 0.2; m.castShadow = true; g.add(m); const cap = box(0.1, 0.25, 0.1, c.accent, 0, 0.4); g.add(cap); return g; },
};
// ---------- 部件：門廊 ----------
const PORCHES = {
  none: () => new THREE.Group(),
  eave: (w, c) => { const g = new THREE.Group(); g.add(box(w + 0.1, 0.06, 0.5, c.roof, 0, 0.78, 0.25)); return g; },
  columns: (w, c) => { const g = new THREE.Group(); g.add(box(w + 0.1, 0.08, 0.7, c.roof, 0, 0.95, 0.35)); [-1, 1].forEach(s => g.add(cyl(0.05, 0.05, 0.95, c.trim, 10, s * (w / 2 - 0.15), 0, 0.6))); g.add(box(w + 0.1, 0.06, 0.7, c.trim, 0, 0, 0.35)); return g; },
  stilts: (w, d, c) => { const g = new THREE.Group(); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.06, 0.06, 0.7, PAL.wood, 8, sx * (w / 2 - 0.15), -0.7, sz * (d / 2 - 0.15))); g.add(box(w + 0.1, 0.06, d + 0.1, PAL.wood, 0, -0.06)); return g; },
};
// ---------- 部件：特殊件 ----------
const EXTRAS = {
  tower: (c, p) => { const g = new THREE.Group(); const h = p.h ?? 2.2; g.add(box(0.5, h, 0.5, c.wall)); const spire = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 4), mat(c.roof)); spire.rotation.y = Math.PI / 4; spire.position.y = h + 0.35; spire.castShadow = true; g.add(spire); g.add(box(0.14, 0.2, 0.05, PAL.ink, 0, h - 0.5, 0.26)); return g; },
  lantern: (c, p) => { const g = new THREE.Group(); g.add(cyl(0.02, 0.02, 0.9, PAL.wood, 6)); const l = cyl(0.11, 0.11, 0.2, PAL.red, 12, 0, 0.7); g.add(l); l.material = mat(PAL.red, { emissive: 0xC7453B, emissiveIntensity: 0.35 }); g.add(cyl(0.12, 0.12, 0.03, PAL.ink, 12, 0, 0.9)); return g; },
  chimney: (c) => { const g = new THREE.Group(); g.add(box(0.18, 0.5, 0.18, c.accent)); g.add(box(0.24, 0.06, 0.24, PAL.dark, 0, 0.5)); return g; },
  windcatcher: (c) => { const g = new THREE.Group(); g.add(box(0.4, 1.2, 0.4, c.wall)); for (let i = 0; i < 3; i++) g.add(box(0.46, 0.05, 0.46, PAL.ink, 0, 0.7 + i * 0.16)); return g; },
  signboard: (c, p) => { const g = new THREE.Group(); g.add(box(0.6, 0.22, 0.05, c.accent)); return g; },
  balcony: (c, p) => { const g = new THREE.Group(); g.add(box(0.8, 0.05, 0.3, c.trim, 0, 0, 0.15)); for (let i = -3; i <= 3; i++) g.add(box(0.03, 0.3, 0.03, c.trim, i * 0.12, 0.05, 0.28)); g.add(box(0.8, 0.03, 0.03, c.trim, 0, 0.33, 0.28)); return g; },
  timber: (c, w, h) => { // 都鐸木構外露
    const g = new THREE.Group(); const n = Math.round(w / 0.5);
    for (let i = 0; i <= n; i++) g.add(box(0.05, h, 0.03, PAL.wood, -w / 2 + i * (w / n), 0, 0));
    g.add(box(w, 0.05, 0.03, PAL.wood, 0, h / 2)); return g;
  },
};

// ---------- 組裝：藍圖 → 建築 ----------
export function buildHouse(bp) {
  const c = { wall: PAL.plaster, roof: PAL.terracotta, trim: PAL.white, door: PAL.wood, accent: PAL.rose, ...bp.colors };
  const { w = 1.6, d = 1.4, floors = 1, floorH = 0.95 } = bp.body ?? {};
  const g = new THREE.Group(); const H = floors * floorH;
  const base = bp.body?.shape === 'round' ? cyl(w / 2, w / 2, H, c.wall, 28) : box(w, H, d, c.wall);
  g.add(base);
  // 樓層線
  for (let f = 1; f < floors; f++) g.add(box(w + 0.04, 0.04, d + 0.04, c.trim, 0, f * floorH));
  // 窗：正面 + 右面
  const win = WINDOWS[bp.window ?? 'plain']; const cols = bp.windowCols ?? 2;
  for (let f = 0; f < floors; f++) {
    const y = f * floorH + 0.42;
    const startCol = f === 0 && (bp.door ?? 'plain') !== 'none' ? 1 : 0;
    for (let i = startCol; i < cols; i++) { const wn = win(c); wn.position.set(-w / 2 + (i + 0.5) * (w / cols) + (startCol ? 0 : 0), y, d / 2 + 0.03); g.add(wn); }
    const side = win(c); side.rotation.y = Math.PI / 2; side.position.set(w / 2 + 0.03, y, 0); g.add(side);
  }
  if ((bp.door ?? 'plain') !== 'none') { const dr = DOORS[bp.door ?? 'plain'](c); dr.position.set(-w / 2 + 0.5 * (w / cols), 0, d / 2 + 0.03); g.add(dr); }
  const roof = ROOFS[bp.roof ?? 'gable'](w, d, c); roof.position.y = H; g.add(roof);
  const porch = PORCHES[bp.porch ?? 'none'](w, d, c); porch.position.set(0, 0, d / 2); g.add(porch);
  if (bp.timber) { const t = EXTRAS.timber(c, w, H); t.position.z = d / 2 + 0.02; g.add(t); }
  for (const e of bp.extras ?? []) {
    const ex = EXTRAS[e.type](c, e); ex.position.set(e.x ?? 0, e.y ?? 0, e.z ?? 0); g.add(ex);
  }
  g.userData.bp = bp; return g;
}

// ---------- 地塊 / 道路 ----------
export function tile(color = PAL.mint, s = 2.4) { const t = box(s, 0.16, s, color); t.position.y = -0.08; return t; }
export function road(s = 2.4, dir = 'h', color = PAL.slate) {
  const g = new THREE.Group(); g.add(box(s, 0.12, s, color, 0, -0.12));
  const lines = dir === 'x' ? 2 : 1;
  const dash = (rot) => { for (let i = -2; i <= 2; i++) { const b = box(0.3, 0.02, 0.06, PAL.white, i * 0.5, 0.0, 0); b.rotation.y = rot; g.add(b); } };
  if (dir === 'h' || dir === 'x') dash(0); if (dir === 'v' || dir === 'x') dash(Math.PI / 2);
  return g;
}
export function tree(color = PAL.green) { const g = new THREE.Group(); g.add(cyl(0.05, 0.07, 0.4, PAL.wood, 6)); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(color)); c.position.y = 0.6; c.castShadow = true; g.add(c); return g; }

// ---------- 預設藍圖（系統內建基礎房型）----------
export const PRESETS = {
  machiya: { name: '京都町家', body: { w: 1.6, d: 1.5, floors: 2, floorH: 0.85 }, window: 'koshi', windowCols: 2, door: 'noren', roof: 'hip', porch: 'eave', colors: { wall: PAL.sand, roof: PAL.dark, trim: PAL.wood, accent: PAL.blue }, extras: [{ type: 'lantern', x: 0.9, z: 0.95 }] },
  minnan: { name: '閩南紅磚厝', body: { w: 2.0, d: 1.3, floors: 1, floorH: 1.0 }, window: 'round', windowCols: 3, door: 'double', roof: 'swallowtail', colors: { wall: PAL.brick, roof: PAL.terracotta, trim: PAL.cream, door: PAL.red, accent: PAL.gold } },
  santorini: { name: '聖托里尼', body: { w: 1.4, d: 1.4, floors: 2, floorH: 0.9, shape: 'round' }, window: 'arch', windowCols: 2, door: 'arch', roof: 'dome', colors: { wall: PAL.white, roof: PAL.blue, trim: PAL.blue, door: PAL.blue, accent: PAL.blue } },
  dutch: { name: '荷蘭運河屋', body: { w: 1.2, d: 1.6, floors: 3, floorH: 0.8 }, window: 'plain', windowCols: 2, door: 'plain', roof: 'gable', colors: { wall: PAL.rose, roof: PAL.dark, trim: PAL.white, door: PAL.ink, accent: PAL.white }, extras: [{ type: 'chimney', x: 0.4, y: 2.7, z: -0.3 }] },
  tudor: { name: '英式都鐸', body: { w: 1.8, d: 1.4, floors: 2, floorH: 0.85 }, window: 'shutter', windowCols: 3, door: 'arch', roof: 'gable', timber: true, colors: { wall: PAL.cream, roof: PAL.slate, trim: PAL.wood, door: PAL.wood, accent: PAL.wood }, extras: [{ type: 'chimney', x: -0.6, y: 1.9, z: 0 }] },
  gassho: { name: '合掌造', body: { w: 2.0, d: 1.4, floors: 1, floorH: 0.9 }, window: 'koshi', windowCols: 3, door: 'plain', roof: 'thatch', colors: { wall: PAL.sand, roof: PAL.thatch, trim: PAL.wood, door: PAL.wood, accent: PAL.wood } },
  thai: { name: '泰式高腳屋', body: { w: 1.6, d: 1.4, floors: 1, floorH: 0.9 }, window: 'plain', windowCols: 2, door: 'plain', roof: 'gable', porch: 'stilts', colors: { wall: PAL.wood, roof: PAL.red, trim: PAL.sand, door: PAL.ink, accent: PAL.gold } },
  yazd: { name: '波斯風塔宅', body: { w: 1.8, d: 1.6, floors: 1, floorH: 1.0 }, window: 'arch', windowCols: 3, door: 'arch', roof: 'flat', colors: { wall: PAL.sand, roof: PAL.sand, trim: PAL.sand, door: PAL.blue, accent: PAL.blue }, extras: [{ type: 'windcatcher', x: 0.5, y: 1.0, z: -0.4 }] },
  tower: { name: '塔樓（特殊件示範）', body: { w: 1.4, d: 1.4, floors: 1, floorH: 0.9 }, window: 'arch', windowCols: 2, door: 'arch', roof: 'hip', colors: { wall: PAL.lilac, roof: PAL.rose, trim: PAL.white, door: PAL.ink, accent: PAL.white }, extras: [{ type: 'tower', x: 0.5, y: 0.9, z: -0.4, h: 1.6 }] },
  mix: { name: '混搭：町家窗 × 紅磚厝 × 風塔', body: { w: 2.0, d: 1.4, floors: 2, floorH: 0.85 }, window: 'koshi', windowCols: 3, door: 'noren', roof: 'swallowtail', porch: 'columns', colors: { wall: PAL.brick, roof: PAL.terracotta, trim: PAL.cream, door: PAL.ink, accent: PAL.gold }, extras: [{ type: 'windcatcher', x: -0.6, y: 2.25, z: -0.3 }, { type: 'lantern', x: 1.1, z: 0.9 }] },
};
