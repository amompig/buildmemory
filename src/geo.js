// geo.js — 定位（只在需要時取一次、不快取、不寫 localStorage）＋ Leaflet 地圖頁（F4）
// 座標只留在這個模組的記憶體裡顯示距離，打卡時送伺服器驗完即丟。
import { distanceM, RULES } from '../shared/rules.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
const WALK_M_PER_MIN = 80;

let leafletLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  leafletLoading ??= new Promise((ok, no) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${LEAFLET}leaflet.css` });
    const js = Object.assign(document.createElement('script'), { src: `${LEAFLET}leaflet.js`, onload: ok, onerror: no });
    document.head.append(css, js);
  });
  return leafletLoading;
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

// 地圖：持久的 DOM（不隨 ui 重繪），切到地圖 tab 時才建立
export function createMap(el, { landmarks, palette }) {
  let map = null, me = null, meRing = null;
  const accent = '#B5532F';
  return {
    async show(pos) {
      await loadLeaflet();
      if (!map) {
        map = L.map(el, { zoomControl: false, attributionControl: true }).setView([pos?.lat ?? 25.042, pos?.lng ?? 121.513], 16);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
        for (const lm of landmarks) {
          L.circle([lm.lat, lm.lng], { radius: lm.r, color: accent, weight: 1, fillOpacity: 0.08 }).addTo(map);
          L.circleMarker([lm.lat, lm.lng], { radius: 6, color: '#fff', weight: 2, fillColor: accent, fillOpacity: 1 }).bindTooltip(lm.name).addTo(map);
        }
      }
      map.invalidateSize();
      if (pos) {
        const ll = [pos.lat, pos.lng];
        // 使用者點 + 50 m 虛線圈（flows.md F4）
        if (!me) {
          me = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: palette?.ghost?.ok ?? '#4F9A7A', fillOpacity: 1 }).addTo(map);
          meRing = L.circle(ll, { radius: 50, color: palette?.ghost?.ok ?? '#4F9A7A', weight: 1.5, dashArray: '4 6', fill: false }).addTo(map);
        } else { me.setLatLng(ll); meRing.setLatLng(ll); }
        map.setView(ll, map.getZoom());
      }
    },
  };
}
