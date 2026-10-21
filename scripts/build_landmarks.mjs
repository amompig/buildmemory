// landmarks_tpe12.json（Design：名稱／半徑／tier／房型）+ landmark_coords.json（座標）→ data/landmarks.json（schema_v1 §7）
// 精選地標打卡給該地標自己的房型（lm:*，blueprint v2.2，見 data/catalog.json）
// 前後端都讀產出檔；改來源後重跑：node scripts/build_landmarks.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('data/landmarks_tpe12.json', 'utf8'));
const { coords, _meta } = JSON.parse(readFileSync('data/landmark_coords.json', 'utf8'));
const items = src.landmarks.map((l) => {
  const c = coords[l.id];
  if (!c) throw new Error(`缺座標：${l.id}`);
  return { id: l.id, name: l.name, lat: c.lat, lng: c.lng, county: l.county, house: l.house, r: l.r, tier: l.tier, blurb: l.blurb ?? l.observed ?? '' };
});
const out = {
  meta: { source: `${_meta.source}（座標）；名稱與半徑：data/landmarks_tpe12.json`, license: 'ODbL（座標）', dataset: 'tpe12', fetched_at: _meta.fetched_at, data_version: src._meta.version },
  items,
};
writeFileSync('data/landmarks.json', JSON.stringify(out, null, 1) + '\n');
console.log(`data/landmarks.json ← ${items.length} 筆`);
