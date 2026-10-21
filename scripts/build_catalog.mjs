// 房型目錄：data/houses_tw10.json（一般 10 型）+ data/landmarks_tpe12.json（12 地標各一型）→ data/catalog.json
// 前後端都讀產出檔（size 算 footprint、palettes 數決定 seed 範圍、blueprint 給 kit.js）；改來源後重跑：node scripts/build_catalog.mjs
// 色票真值在來源檔（palette.json three.house 只是引用）；地標無變體，只取 palettes[0]
import { readFileSync, writeFileSync } from 'node:fs';

const tw = JSON.parse(readFileSync('data/houses_tw10.json', 'utf8'));
const lm = JSON.parse(readFileSync('data/landmarks_tpe12.json', 'utf8'));
const pick = (h, palettes) => ({ id: h.id, name: h.name, size: h.size, daily: !!h.daily, palettes, window_style: h.window_style, door_style: h.door_style, blueprint: h.blueprint });
const houses = [...tw.houses.map((h) => pick(h, h.palettes)), ...lm.landmarks.map((h) => pick(h, h.palettes.slice(0, 1)))];
const ids = new Set();
for (const h of houses) {
  if (ids.has(h.id)) throw new Error(`重複 id：${h.id}`);
  ids.add(h.id);
  if (!h.palettes?.length) throw new Error(`缺 palettes：${h.id}`);
}
const out = { data_version: `${tw._meta.version}+${lm._meta.version}`, meta: { sources: ['data/houses_tw10.json', 'data/landmarks_tpe12.json'], versions: [tw._meta.version, lm._meta.version], blueprint_version: tw._meta.blueprint_version }, houses };
writeFileSync('data/catalog.json', JSON.stringify(out) + '\n');
console.log(`data/catalog.json ← ${houses.length} 型`);
