// 把專案裡所有 .md 鏡像到 Obsidian（旅圖 Jourgram 的跨平台專案記憶），保留原資料夾結構
// 使用者 2026-10-24：.md 除了主資料夾，Obsidian 也要一份；每次改了 .md 就跑一次：node scripts/sync_obsidian.mjs
import { readdirSync, statSync, mkdirSync, copyFileSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = process.cwd();
const DEST = process.env.OBSIDIAN_DIR ?? 'D:/Obsidian/TorchBase/TorchBased/Claude workspace/Jourgram/BuildingYourMemory';
const SKIP = new Set(['.git', 'node_modules', '.wrangler', 'dist']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

let copied = 0, same = 0;
for (const src of walk(ROOT)) {
  const dst = join(DEST, relative(ROOT, src));
  if (existsSync(dst) && readFileSync(dst).equals(readFileSync(src))) { same++; continue; }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  copied++;
}
console.log(`Obsidian ← ${copied} 個更新、${same} 個未變（${DEST}）`);
