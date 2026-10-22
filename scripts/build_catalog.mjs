// 房型目錄：data/houses_tw10.json（一般 10 型）+ data/houses_upgrades.json（升級 15 型）+ data/landmarks_tpe12.json（12 地標各一型）
//          + data/decor.json（基礎部件 6 種）+ data/city_pools.json（每日簽到 / 非精選地標的城市池）→ data/catalog.json
// 前後端都讀產出檔（size 算 footprint、palettes 數決定 seed 範圍、blueprint 給 kit.js）；改來源後重跑：node scripts/build_catalog.mjs
// 色票真值在來源檔（palette.json three.house 只是引用）；地標無變體，只取 palettes[0]
import { readFileSync, writeFileSync } from 'node:fs';

const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const tw = read('data/houses_tw10.json'), up = read('data/houses_upgrades.json'), lm = read('data/landmarks_tpe12.json');
const decorSrc = read('data/decor.json'), pools = read('data/city_pools.json');
const pick = (h, palettes, extra = {}) => ({ id: h.id, name: h.name, size: h.size, daily: !!h.daily, palettes, window_style: h.window_style, door_style: h.door_style, blueprint: h.blueprint, ...extra });
const houses = [
  ...tw.houses.map((h) => pick(h, h.palettes, { line: h.id, tier: 1 })),
  ...up.houses.map((h) => pick(h, h.palettes, { line: h.line, tier: h.tier })),
  ...lm.landmarks.map((h) => pick(h, h.palettes.slice(0, 1))),
];
// 部件沒有變體：palettes 給一組空的（seed 恆 0，色全在 blueprint 的固定色）
const decor = decorSrc.decor.map((d) => ({ id: d.id, name: d.name, layer: d.layer, size: d.size, weight: d.weight, palettes: [{}], blueprint: d.blueprint }));
const ids = new Set();
for (const h of [...houses, ...decor]) {
  if (ids.has(h.id)) throw new Error(`重複 id：${h.id}`);
  ids.add(h.id);
  if (!h.palettes?.length) throw new Error(`缺 palettes：${h.id}`);
}
for (const h of houses) if (h.line && !ids.has(h.line)) throw new Error(`line 指向不存在的房型：${h.id} → ${h.line}`);
for (const g of Object.values(pools.groups)) for (const id of Object.keys(g.weights)) {
  const h = houses.find((x) => x.id === id);
  if (!h || h.size.join() !== '1,1') throw new Error(`城市池只能放 1×1 一般房型：${id}`);
}
const out = {
  data_version: [tw, up, lm, decorSrc, pools].map((x) => x._meta.version).join('+'),
  meta: { sources: ['data/houses_tw10.json', 'data/houses_upgrades.json', 'data/landmarks_tpe12.json', 'data/decor.json', 'data/city_pools.json'], blueprint_version: tw._meta.blueprint_version },
  houses, decor,
  pools: { daily_split: pools.daily_split, groups: Object.fromEntries(Object.entries(pools.groups).map(([k, g]) => [k, g.weights])), default_group: pools.default_group, counties: pools.counties },
};
writeFileSync('data/catalog.json', JSON.stringify(out) + '\n');
console.log(`data/catalog.json ← ${houses.length} 房型、${decor.length} 部件`);
