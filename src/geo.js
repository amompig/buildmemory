// geo.js — 定位（只在需要時取一次、不快取、不寫 localStorage）＋ MapLibre 地圖頁（F4）
// 座標只留在這個模組的記憶體裡顯示距離，打卡時送伺服器驗完即丟。
import { distanceM, RULES } from '../shared/rules.js';

const MAPLIBRE = 'https://unpkg.com/maplibre-gl@4.7.1/dist/';
const WALK_M_PER_MIN = 80;

let libLoading = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve();
  libLoading ??= new Promise((ok, no) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${MAPLIBRE}maplibre-gl.css` });
    const js = Object.assign(document.createElement('script'), { src: `${MAPLIBRE}maplibre-gl.js`, onload: ok, onerror: no });
    document.head.append(css, js);
  });
  return libLoading;
}

// 取一次定位 → { ok, lat, lng, acc } 或 { ok:false, code:'location_denied'|'weak_signal'|'offline' }
// sim：本機 ?dev=1 的模擬座標（上線版不會給）
export function locate(sim) {
  if (sim) return Promise.resolve({ ok: true, ...sim });
  if (!navigator.geolocation) return Promise.resolve({ ok: false, code: 'location_denied' });
  return new Promise((done) => navigator.geolocation.getCurrentPosition(
    (p) => done({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
    (e) => done({ ok: false, code: e.code === 1 ? 'location_denied' : 'weak_signal' }),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  ));
}

// 依距離排序的附近地標；inRange 用與伺服器相同的容差 R + min(acc, 50)
export function nearby(pos, landmarks, n = 3) {
  return landmarks.map((lm) => {
    const d = distanceM(pos.lat, pos.lng, lm.lat, lm.lng);
    const reach = lm.r + Math.min(pos.acc, RULES.ACC_TOLERANCE_MAX);
    return { lm, dist: Math.round(d), inRange: pos.acc <= RULES.ACC_MAX && d <= reach, short: Math.max(0, Math.ceil((d - reach) / 10) * 10), min: Math.max(1, Math.round(d / WALK_M_PER_MIN)) };
  }).sort((a, b) => a.dist - b.dist).slice(0, n);
}

// 地圖（照 Design F4 原型）：OpenFreeMap 向量圖磚（免金鑰）＋自訂樣式＝米色街廓、白路、淡綠公園、無字；
// 水滴標記（最近＝accent＋深色名牌、其餘＝灰＋紙色名牌）、使用者點＋50 m 虛線圈。持久 DOM，切到地圖 tab 時才建立。
// 配色：design/palette.json 的 map 區塊（缺值時退回同檔定稿值）
const MAP0 = {
  background: '#F6F1E8', block: '#F0E9DD', block_line: '#E3DBCD', road: '#FFFCF7', road_casing: '#E3DBCD', road_major: '#F3DDD5',
  park: '#D7E6DA', water: '#CFE0E6', building: '#E8E1D4', building_line: '#D9CFC0',
  landmark_pin: '#B5532F', me: '#2F7A5C', range_fill: 'rgba(79,154,122,.18)', range_line: '#4F9A7A',
};
const MUTE = '#8B949C'; // 非最近地標的灰標記 = css ink-3
const roadW = (lo, hi) => ['interpolate', ['linear'], ['zoom'], 14, lo, 18, hi];
const MINOR = ['in', 'class', 'minor', 'service', 'path'], MAJOR = ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk', 'motorway'];
const styleOf = (C) => ({
  version: 8,
  sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': C.background } },
    { id: 'landuse', type: 'fill', source: 'omt', 'source-layer': 'landuse', paint: { 'fill-color': C.block, 'fill-outline-color': C.block_line } },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.park } },
    { id: 'landcover', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', 'class', 'grass', 'wood'], paint: { 'fill-color': C.park } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
    { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 15, paint: { 'fill-color': C.building, 'fill-outline-color': C.building_line } },
    { id: 'road-minor-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: MINOR, paint: { 'line-color': C.road_casing, 'line-width': roadW(3, 12) } },
    { id: 'road-major-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: MAJOR, paint: { 'line-color': C.road_casing, 'line-width': roadW(5.5, 25) } },
    { id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: MINOR, paint: { 'line-color': C.road, 'line-width': roadW(2, 10) } },
    { id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: MAJOR, paint: { 'line-color': C.road_major, 'line-width': roadW(4, 22) } },
  ],
});
const pin = (color) => `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 35s12-12.2 12-21A12 12 0 0 0 2 14c0 8.8 12 21 12 21z" fill="${color}"/><circle cx="14" cy="14" r="4.5" fill="#fff"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
// 半徑 m 的圓（64 邊形，經度依緯度修正）
function ringGeo({ lat, lng }, m) {
  const dLat = m / 111195, dLng = dLat / Math.cos((lat * Math.PI) / 180), pts = [];
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * 2 * Math.PI; pts.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: pts } };
}
const pointGeo = ({ lat, lng }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } });

export function createMap(el, { landmarks, colors = {} }) {
  const C = { ...MAP0, ...colors };
  let map = null, ready = null;
  const markers = new Map();
  function paint(near) {
    const hot = near?.[0];
    for (const lm of landmarks) {
      const isHot = hot?.lm.id === lm.id;
      const label = isHot ? `${lm.name} · ${hot.dist >= 1000 ? `${(hot.dist / 1000).toFixed(1)} km` : `${hot.dist} m`}` : lm.name;
      markers.get(lm.id).getElement().innerHTML = pin(isHot ? C.landmark_pin : MUTE) + `<span class="bym-tip${isHot ? ' bym-tip--hot' : ''}">${esc(label)}</span>`;
    }
  }
  return {
    async show(pos, near) {
      await loadMapLibre();
      if (!map) {
        map = new maplibregl.Map({
          container: el, style: styleOf(C), center: [pos?.lng ?? 121.513, pos?.lat ?? 25.042], zoom: 16,
          attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right'); // 署名來自圖磚 TileJSON；底部被底板蓋住，放右上 pill 下方
        for (const lm of landmarks) {
          const e = document.createElement('div'); e.className = 'bym-pin';
          markers.set(lm.id, new maplibregl.Marker({ element: e, anchor: 'bottom' }).setLngLat([lm.lng, lm.lat]).addTo(map));
        }
        ready = new Promise((ok) => map.on('load', () => {
          const none = { type: 'FeatureCollection', features: [] };
          map.addSource('ring', { type: 'geojson', data: none });
          map.addSource('me', { type: 'geojson', data: none });
          map.addLayer({ id: 'ring', type: 'line', source: 'ring', paint: { 'line-color': C.range_line, 'line-width': 1.5, 'line-dasharray': [3, 4] } });
          map.addLayer({ id: 'halo', type: 'circle', source: 'me', paint: { 'circle-radius': 14, 'circle-color': C.range_fill } });
          map.addLayer({ id: 'me', type: 'circle', source: 'me', paint: { 'circle-radius': 6, 'circle-color': C.me, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
          ok();
        }));
      }
      map.resize();
      paint(near);
      if (pos) {
        // 底板蓋住下半部：padding 讓自己落在可見區中間
        map.jumpTo({ center: [pos.lng, pos.lat], padding: { top: 0, bottom: document.querySelector('.map-panel')?.offsetHeight ?? 0, left: 0, right: 0 } });
        await ready;
        map.getSource('ring').setData(ringGeo(pos, 50));
        map.getSource('me').setData(pointGeo(pos));
      }
    },
  };
}
