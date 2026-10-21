// kit.js — houses.json 藍圖 + palette → bake() 烘成單一幾何（頂點色）
// 起點：samples/kit.js 的部件函式。只產幾何，不碰場景與狀態。
// 座標：一格邊長 CELL；建築底面 y=0、原點 = 佔格中心（2×2 為四格中心，town 旋轉時繞這點）；
// 門面朝 +z（rot 0 = 朝南，r+1 方向）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CELL = 2.4;

// 不隨 palette 變的共用色（palette.seed.json three.shared）
const SHARED = { glass: 0x9FC8D9, wood: 0x8E6B50, ink: 0x3A3A48, white: 0xF7F3EE, metal: 0x9AA3AA };

// 部件只需要顏色；bake 時把每個 mesh 的材質色寫成頂點色
const mats = new Map();
function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshBasicMaterial({ color }));
  return mats.get(color);
}
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z); return m;
}
function cyl(rt, rb, h, color, seg = 16, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y + h / 2, z); return m;
}
// 三角柱（山牆屋頂）：寬 w、深 d、高 h，沿 x 軸的山脊
function prism(w, h, d, color) {
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(-w / 2, 0, 0);
  return new THREE.Mesh(g, mat(color));
}
const group = (...kids) => { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; };

// ---------- 部件：窗 ----------
const WINDOWS = {
  plain: (c) => group(box(0.26, 0.34, 0.06, SHARED.glass), box(0.32, 0.04, 0.08, c.trim, 0, -0.02)),
  arch: (c) => {
    const t = cyl(0.12, 0.12, 0.06, SHARED.glass, 12); t.rotation.x = Math.PI / 2; t.position.set(0, 0.26, 0);
    return group(box(0.24, 0.26, 0.06, SHARED.glass), t, box(0.32, 0.04, 0.08, c.trim, 0, -0.02));
  },
  round: (c) => {
    const t = cyl(0.16, 0.16, 0.06, SHARED.glass, 16); t.rotation.x = Math.PI / 2; t.position.y = 0.18;
    const r = cyl(0.2, 0.2, 0.04, c.trim, 16); r.rotation.x = Math.PI / 2; r.position.set(0, 0.18, -0.02);
    return group(t, r);
  },
  // 鐵窗：外凸的格柵籠
  grille: (c) => {
    const g = WINDOWS.plain(c);
    for (let i = -2; i <= 2; i++) g.add(box(0.025, 0.4, 0.025, SHARED.metal, i * 0.08, -0.03, 0.1));
    g.add(box(0.38, 0.025, 0.14, SHARED.metal, 0, 0.36, 0.05));
    g.add(box(0.38, 0.025, 0.14, SHARED.metal, 0, -0.04, 0.05));
    return g;
  },
};
// ---------- 部件：門 ----------
const DOORS = {
  plain: (c) => group(box(0.36, 0.6, 0.06, c.door), box(0.44, 0.06, 0.1, c.trim, 0, 0.58)),
  double: (c) => group(box(0.26, 0.62, 0.06, c.door, -0.14), box(0.26, 0.62, 0.06, c.door, 0.14), box(0.6, 0.06, 0.1, c.trim, 0, 0.62)),
};
// ---------- 部件：屋頂 ----------
const ROOFS = {
  flat: (w, d, c) => group(box(w + 0.1, 0.08, d + 0.1, c.roof), box(w - 0.2, 0.1, d - 0.2, c.wall, 0, 0.08)),
  gable: (w, d, c, h = 0.7) => group(prism(w + 0.2, h, d + 0.3, c.roof)),
  swallowtail: (w, d, c) => { // 閩南燕尾脊
    const g = ROOFS.gable(w, d, c, 0.55);
    g.add(box(w + 0.3, 0.06, 0.08, c.accent, 0, 0.55));
    [-1, 1].forEach((s) => { const tip = box(0.12, 0.22, 0.06, c.accent, s * (w / 2 + 0.08), 0.6); tip.rotation.z = -s * 0.5; g.add(tip); });
    return g;
  },
};
// ---------- 部件：門廊 ----------
const PORCHES = {
  none: () => new THREE.Group(),
  // 騎樓：一樓退縮成廊道，前緣柱列撐住二樓；h = 一樓高
  arcade: (w, d, c, h) => {
    const g = new THREE.Group();
    const n = 3;
    const step = (w - 0.12) / n, z = 0.54;
    for (let i = 0; i <= n; i++) g.add(box(0.12, h, 0.12, c.wall, -w / 2 + 0.06 + i * step, 0, z));
    for (let i = 0; i < n; i++) g.add(box(step - 0.12, 0.12, 0.12, c.wall, -w / 2 + 0.06 + (i + 0.5) * step, h - 0.12, z)); // 柱間楣樑
    g.add(box(w, 0.04, 0.6, c.trim, 0, 0, 0.3)); // 騎樓地坪
    return g;
  },
};
// ---------- 部件：特殊件 ----------
const EXTRAS = {
  signboard: (c) => group(box(0.6, 0.22, 0.05, c.accent)),
  balcony: (c) => {
    const g = group(box(0.8, 0.05, 0.3, c.trim, 0, 0, 0.15), box(0.8, 0.03, 0.03, c.trim, 0, 0.33, 0.28));
    for (let i = -3; i <= 3; i++) g.add(box(0.03, 0.3, 0.03, c.trim, i * 0.12, 0.05, 0.28));
    return g;
  },
  // 頂樓鐵皮加蓋：小屋身 + 淺斜頂（波浪板用 accent 色條近似）
  rooftop_shed: (c, p) => {
    const w = p.w ?? 1.0, d = p.d ?? 0.9;
    const g = group(box(w, 0.45, d, SHARED.metal));
    const roof = prism(w + 0.15, 0.25, d + 0.15, c.roof); roof.position.y = 0.45; g.add(roof);
    for (let i = -2; i <= 2; i++) g.add(box(0.03, 0.44, 0.02, c.roof, i * (w / 5), 0, d / 2 + 0.01));
    return g;
  },
  // 女兒牆：正面立面往上延伸，帶一條 accent 飾帶
  parapet: (c, p) => {
    const w = p.w ?? 1.4;
    return group(box(w, 0.35, 0.1, c.wall), box(w + 0.04, 0.05, 0.12, c.accent, 0, 0.3));
  },
};

// ---------- 組裝：藍圖 → 建築（Group）----------
function buildHouse(bp, c) {
  const { w = 1.6, d = 1.4, floors = 1, floorH = 0.95 } = bp.body ?? {};
  const g = new THREE.Group(); const H = floors * floorH;
  const arcade = bp.porch === 'arcade';
  // 騎樓時一樓牆面退縮 0.6
  const recess = arcade ? 0.6 : 0;
  g.add(box(w, floorH, d - recess, c.wall, 0, 0, -recess / 2));
  if (floors > 1) g.add(box(w, H - floorH, d, c.wall, 0, floorH, 0));
  for (let f = 1; f < floors; f++) g.add(box(w + 0.04, 0.04, d + 0.04, c.trim, 0, f * floorH));

  const win = WINDOWS[bp.window ?? 'plain']; const cols = bp.windowCols ?? 2;
  const hasDoor = (bp.door ?? 'plain') !== 'none';
  for (let f = 0; f < floors; f++) {
    const y = f * floorH + 0.42;
    const front = d / 2 + 0.03 - (f === 0 ? recess : 0);
    const startCol = f === 0 && hasDoor ? 1 : 0;
    for (let i = startCol; i < cols; i++) { const wn = win(c); wn.position.set(-w / 2 + (i + 0.5) * (w / cols), y, front); g.add(wn); }
    const side = win(c); side.rotation.y = Math.PI / 2; side.position.set(w / 2 + 0.03, y, 0); g.add(side);
  }
  if (hasDoor) { const dr = DOORS[bp.door ?? 'plain'](c); dr.position.set(-w / 2 + 0.5 * (w / cols), 0, d / 2 + 0.03 - recess); g.add(dr); }
  const roof = ROOFS[bp.roof ?? 'gable'](w, d, c); roof.position.y = H; g.add(roof);
  const porch = PORCHES[bp.porch ?? 'none'](w, d, c, floorH); porch.position.set(0, 0, d / 2 - recess); g.add(porch);
  for (const e of bp.extras ?? []) {
    const ex = EXTRAS[e.type](c, e); ex.position.set(e.x ?? 0, e.y ?? 0, e.z ?? 0); g.add(ex);
  }
  return g;
}

// 沒有 blueprint 的房型：佔滿格子的色塊
function placeholder(size, c) {
  return group(box(size[1] * CELL * 0.7, 1.2, size[0] * CELL * 0.7, c.wall), box(size[1] * CELL * 0.74, 0.12, size[0] * CELL * 0.74, c.roof, 0, 1.2));
}

const hex = (s) => (typeof s === 'string' ? parseInt(s.replace('#', ''), 16) : s);
function colorsOf(palette) {
  const p = palette ?? {};
  return {
    wall: hex(p.wall ?? 0xF4E6D2), roof: hex(p.roof ?? 0xC97D4B), door: hex(p.door ?? SHARED.wood),
    accent: hex(p.accent ?? 0xE9A8A3), trim: hex(p.trim ?? SHARED.white),
  };
}

// house = houses.json 的一筆；palette = house.palettes[seed]
// 回傳單一 BufferGeometry（position / normal / color），搭配 vertexColors 材質即為 1 個 draw call
export function bake(house, palette) {
  const c = colorsOf(palette);
  const root = house.blueprint ? buildHouse(house.blueprint, c) : placeholder(house.size, c);
  root.updateMatrixWorld(true);

  const parts = [];
  const col = new THREE.Color();
  root.traverse((m) => {
    if (!m.isMesh) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    g.deleteAttribute('uv');
    col.copy(m.material.color);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g);
    m.geometry.dispose();
  });
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  merged.computeBoundingBox();
  return merged;
}

// 依 (房型, seed) 快取；seed 超出範圍時退回原色
const cache = new Map();
export function bakeSeed(house, seed) {
  const s = house.palettes?.[seed] ? seed : 0;
  const key = `${house.id}#${s}`;
  if (!cache.has(key)) cache.set(key, bake(house, house.palettes?.[s]));
  return cache.get(key);
}

// 所有房型共用一個材質：顏色全在頂點上
export const houseMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
