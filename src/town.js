// town.js — grid → 場景（只渲染，不改狀態）
// 每房型 1 個 InstancedMesh（配色走 kit 的槽位 shader）、道路池、地磚（未解鎖霧面）、幽靈格、相機 fit/4 向/俯視補間。
// 世界座標：格 (r,c) 中心 x=(c-7.5)·CELL、z=(r-7.5)·CELL；北 = -z；rot k = 順時針 k×90°（俯視），門面起始朝 +z。
import * as THREE from 'three';
import { RULES, rc, inBounds, idx, isUnlocked, unlockedSize, footprint } from '../shared/rules.js';
import { bakeCached, houseMaterial, paletteRGB, SLOT_ATTRS, CELL } from './kit.js';

const N = RULES.GRID, CELLS = N * N, HALF = (N - 1) / 2;
const TWEEN_MS = 350;
const PITCH = { iso: 0.85, top: Math.PI / 2 - 0.001 }; // 仰角（rad）
const DIST = { min: 8, max: 260 };

// palette.seed.json three 區塊（Design 出 palette.json 後改讀檔）
const COL = {
  bg: '#8FCFC6', ground: '#7FBFB5', tile: '#A9D9C7', road: '#6F7F8C', fog: '#F6F1E8',
  ok: '#4F9A7A', bad: '#C7453B',
  hemiSky: '#FFF6E8', hemiGround: '#7FB8A8', hemi: 0.9, sun: '#FFF2DC', sunI: 1.25, ambient: 0.25,
};

const cellX = (c) => (c - HALF) * CELL;
const cellZ = (r) => (r - HALF) * CELL;
const ease = (t) => 1 - (1 - t) ** 3;

// 幽靈格貼圖：外框 + 合法淡填色 / 非法斜線（顏色之外的第二編碼）
function ghostTexture(color, stripes) {
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = color; g.globalAlpha = 0.28; g.fillRect(0, 0, s, s); g.globalAlpha = 1;
  g.strokeStyle = color;
  if (stripes) {
    g.lineWidth = 10;
    for (let k = -s; k < 2 * s; k += 32) { g.beginPath(); g.moveTo(k, s); g.lineTo(k + s, 0); g.stroke(); }
  }
  g.lineWidth = 14; g.strokeRect(7, 7, s - 14, s - 14);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTown(canvas, { houses, reducedMotion = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.add(new THREE.HemisphereLight(COL.hemiSky, COL.hemiGround, COL.hemi));
  const sun = new THREE.DirectionalLight(COL.sun, COL.sunI); sun.position.set(5, 10, 7); scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, COL.ambient));
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);

  // 底盤 + 地磚（未解鎖格混霧色）
  const base = new THREE.Mesh(new THREE.BoxGeometry(N * CELL + 0.6, 0.3, N * CELL + 0.6), new THREE.MeshLambertMaterial({ color: COL.ground }));
  base.position.y = -0.25; scene.add(base);
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.96, 0.1, CELL * 0.96), new THREE.MeshLambertMaterial(), CELLS);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < CELLS; i++) { const [r, c] = rc(i); tiles.setMatrixAt(i, m4.makeTranslation(cellX(c), -0.05, cellZ(r))); }
  const tileOn = new THREE.Color(COL.tile), tileOff = new THREE.Color(COL.tile).lerp(new THREE.Color(COL.fog), 0.55);
  tiles.frustumCulled = false; scene.add(tiles);

  // 道路池：一個 InstancedMesh，count = 路格數
  const roads = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.06, CELL), new THREE.MeshLambertMaterial({ color: COL.road }), CELLS);
  roads.count = 0; roads.frustumCulled = false; scene.add(roads);

  // 每房型一個 InstancedMesh；每棟 5 色寫在 iWall…iTrim
  const kinds = new Map();
  for (const h of houses) {
    const geo = bakeCached(h).clone();
    for (const a of SLOT_ATTRS) geo.setAttribute(a, new THREE.InstancedBufferAttribute(new Float32Array(CELLS * 3), 3));
    const mesh = new THREE.InstancedMesh(geo, houseMaterial, CELLS);
    mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh);
    kinds.set(h.id, { h, mesh });
  }

  // 幽靈：地面框（依 footprint 大小縮放）+ 半透明房
  const ghostTex = { ok: ghostTexture(COL.ok, false), bad: ghostTexture(COL.bad, true) };
  const ghostCell = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: ghostTex.ok, transparent: true, depthWrite: false }));
  ghostCell.renderOrder = 2; ghostCell.visible = false; scene.add(ghostCell);
  const ghostHouseMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false });
  const ghostHouse = new THREE.Mesh(undefined, ghostHouseMat);
  ghostHouse.renderOrder = 3; ghostHouse.visible = false; scene.add(ghostHouse);

  // ---------- 相機 ----------
  const cam = { x: 0, z: 0, dist: 40, yaw: 0, pitch: PITCH.iso };
  let dir = 0, top = false, tween = null, size = 0;
  // 斜視 = 45° 角；俯視轉正，格線與螢幕邊平行（畫路好對格）
  const yawOf = (d) => (top ? 0 : Math.PI / 4) + (d * Math.PI) / 2;
  const yawTo = () => { const diff = yawOf(dir) - cam.yaw; return cam.yaw + diff - 2 * Math.PI * Math.round(diff / (2 * Math.PI)); };
  cam.yaw = yawOf(0);

  function place() {
    const h = cam.dist * Math.cos(cam.pitch);
    camera.position.set(cam.x + h * Math.sin(cam.yaw), cam.dist * Math.sin(cam.pitch), cam.z + h * Math.cos(cam.yaw));
    // up = 地面上的「前方」：斜視時與世界 y 等效，正俯視時也不會退化
    camera.up.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    camera.lookAt(cam.x, 0, cam.z);
  }
  function animateTo(to) {
    to = { ...tween?.to, ...to }; // 補間中再下指令：沿用未完成的目標（例如俯視中途按 4 向）
    if (reducedMotion) { Object.assign(cam, to); tween = null; } else tween = { from: { ...cam }, to, t0: performance.now() };
    kick();
  }
  // 已解鎖區（四角 × 地面/屋頂高）完整入鏡的距離：投影到螢幕、依最外點縮放距離，迭代幾次收斂
  function fitDist() {
    resize();
    const saved = { ...cam }, h = (size * CELL) / 2, pts = [];
    for (const y of [0, 3]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(new THREE.Vector3(sx * h, y, sz * h));
    Object.assign(cam, tween?.to ?? {}, { x: 0, z: 0 });
    for (let k = 0; k < 4; k++) {
      place(); camera.updateMatrixWorld();
      const m = Math.max(...pts.map((p) => { const v = p.clone().project(camera); return Math.max(Math.abs(v.x), Math.abs(v.y)); }));
      cam.dist *= m / 0.92;
    }
    const d = THREE.MathUtils.clamp(cam.dist, DIST.min, DIST.max);
    Object.assign(cam, saved);
    return d;
  }
  // 視窗中心：size 都是偶數，視窗以格線 (7.5) 對稱 → 世界原點
  const fit = () => animateTo({ x: 0, z: 0, dist: fitDist() });

  // ---------- 繪製（按需）----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio();
    if (canvas.width === Math.round(w * pr) && canvas.height === Math.round(h * pr)) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  let raf = 0;
  function frame(now) {
    raf = 0;
    resize();
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / TWEEN_MS), e = ease(k);
      for (const key of Object.keys(tween.to)) cam[key] = tween.from[key] + (tween.to[key] - tween.from[key]) * e;
      if (k === 1) tween = null;
    }
    place();
    renderer.render(scene, camera);
    if (tween) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function groundAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera);
    return ray.ray.intersectPlane(ground, new THREE.Vector3());
  }

  const ry = new THREE.Matrix4(), mt = new THREE.Matrix4();
  function houseMatrix(hs, a, rot) {
    const [r, c] = rc(a), dx = (hs[1] - 1) / 2, dz = (hs[0] - 1) / 2;
    return mt.makeTranslation(cellX(c + dx), 0, cellZ(r + dz)).multiply(ry.makeRotationY((-rot * Math.PI) / 2));
  }

  return {
    renderer, camera, scene,

    // state = store.get()：{ grid, grants }
    update({ grid, grants }) {
      const seedOf = new Map(grants.map((g) => [g.id, g.seed]));
      const nextSize = unlockedSize(grid);
      for (let i = 0; i < CELLS; i++) tiles.setColorAt(i, isUnlocked(i, nextSize) ? tileOn : tileOff);
      tiles.instanceColor.needsUpdate = true;

      roads.count = 0;
      for (const k of kinds.values()) k.mesh.count = 0;
      for (let i = 0; i < CELLS; i++) {
        const v = grid[i];
        if (v?.t === 'road') { const [r, c] = rc(i); roads.setMatrixAt(roads.count++, m4.makeTranslation(cellX(c), 0.03, cellZ(r))); }
        else if (v?.t === 'house' && kinds.has(v.id)) {
          const { h, mesh } = kinds.get(v.id), n = mesh.count++;
          mesh.setMatrixAt(n, houseMatrix(h.size, i, v.rot));
          const rgb = paletteRGB(h, seedOf.get(v.ref) ?? 0);
          SLOT_ATTRS.forEach((a, s) => mesh.geometry.attributes[a].array.set(rgb.subarray(s * 3, s * 3 + 3), n * 3));
        }
      }
      roads.instanceMatrix.needsUpdate = true;
      for (const { mesh } of kinds.values()) {
        mesh.instanceMatrix.needsUpdate = true;
        for (const a of SLOT_ATTRS) mesh.geometry.attributes[a].needsUpdate = true;
      }
      if (nextSize !== size) { size = nextSize; fit(); }
      kick();
    },

    // 螢幕座標 → 格 idx（射線打 y=0 平面）；格外回 null
    cellAt(clientX, clientY) {
      const p = groundAt(clientX, clientY);
      if (!p) return null;
      const r = Math.round(p.z / CELL + HALF), c = Math.round(p.x / CELL + HALF);
      return inBounds(r, c) ? idx(r, c) : null;
    },

    // ghost = null 關閉；{ anchor, ok, size:[h,w], houseId?, rot? }（2×2 超出格線時只畫錨點格）
    setGhost(ghost) {
      ghostCell.visible = ghostHouse.visible = false;
      if (ghost) {
        const hs = footprint(ghost.size ?? [1, 1], ghost.anchor) ? ghost.size ?? [1, 1] : [1, 1];
        const [r, c] = rc(ghost.anchor);
        ghostCell.position.set(cellX(c + (hs[1] - 1) / 2), 0.08, cellZ(r + (hs[0] - 1) / 2));
        ghostCell.scale.set(hs[1], 1, hs[0]);
        ghostCell.material.map = ghost.ok ? ghostTex.ok : ghostTex.bad;
        ghostCell.visible = true;
        const k = ghost.houseId && kinds.get(ghost.houseId);
        if (k) {
          ghostHouse.geometry = k.mesh.geometry;
          ghostHouse.matrixAutoUpdate = false;
          ghostHouse.matrix.copy(houseMatrix(hs, ghost.anchor, ghost.rot ?? 0));
          ghostHouseMat.color.set(ghost.ok ? COL.ok : COL.bad);
          ghostHouse.visible = true;
        }
      }
      kick();
    },

    // 4 向快照：d = 0..3（每次 90°）；俯視切換；看模式的平移 / 縮放
    view(d) {
      dir = ((d % 4) + 4) % 4;
      animateTo({ yaw: yawTo() }); // 走最短方向
    },
    get dir() { return dir; },
    topDown(on) { top = !!on; animateTo({ pitch: top ? PITCH.top : PITCH.iso, yaw: yawTo() }); },
    get isTopDown() { return top; },
    fit,
    // 手指從 (x0,y0) 拖到 (x1,y1)：讓原本在手指下的地面點跟著手指（射線取地面點，斜視也精確）
    pan(x0, y0, x1, y1) {
      place(); camera.updateMatrixWorld();
      const a = groundAt(x0, y0), b = groundAt(x1, y1);
      if (!a || !b) return;
      const lim = (N * CELL) / 2;
      cam.x = THREE.MathUtils.clamp(cam.x + a.x - b.x, -lim, lim);
      cam.z = THREE.MathUtils.clamp(cam.z + a.z - b.z, -lim, lim);
      tween = null; kick();
    },
    // 以螢幕點 (x,y) 為中心縮放（雙指中點／滑鼠位置不動）；省略則以畫面中心
    zoom(factor, x, y) {
      place(); camera.updateMatrixWorld();
      const a = x == null ? null : groundAt(x, y);
      cam.dist = THREE.MathUtils.clamp(cam.dist / factor, DIST.min, DIST.max);
      if (a) {
        place(); camera.updateMatrixWorld();
        const b = groundAt(x, y), lim = (N * CELL) / 2;
        if (b) { cam.x = THREE.MathUtils.clamp(cam.x + a.x - b.x, -lim, lim); cam.z = THREE.MathUtils.clamp(cam.z + a.z - b.z, -lim, lim); }
      }
      tween = null; kick();
    },

    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    renderNow() { frame(performance.now()); return this.stats(); },
  };
}
