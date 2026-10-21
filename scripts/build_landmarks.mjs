// landmarks_tpe12.json（Design：名稱／半徑／tier）+ landmark_coords.json（座標、過渡房型）→ data/landmarks.json（schema_v1 §7）
// 前後端都讀產出檔；改來源後重跑：node scripts/build_landmarks.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('data/landmarks_tpe12.json', 'utf8'));
const { coords, _meta } = JSON.parse(readFileSync('data/landmark_coords.json', 'utf8'));
const items = src.landmarks.map((l) => {
  const c = coords[l.id];
  if (!c) throw new Error(`缺座標：${l.id}`);
  return { id: l.id, name: l.name, lat: c.lat, lng: c.lng, county: l.county, house: c.house_interim, r: l.r, tier: l.tier, blurb: l.blurb ?? l.observed ?? '' };
});
const out = {
  meta: { source: `${_meta.source}（座標）；名稱與半徑：data/landmarks_tpe12.json`, license: 'ODbL（座標）', dataset: 'tpe12', fetched_at: _meta.fetched_at, data_version: src._meta.version },
  items,
};
writeFileSync('data/landmarks.json', JSON.stringify(out, null, 1) + '\n');
console.log(`data/landmarks.json ← ${items.length} 筆`);
