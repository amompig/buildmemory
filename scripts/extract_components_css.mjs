// design/components.html 的 .c-* 元件 CSS → src/components.css（原樣複製，不手改）
// Design 更新 components.html 後重跑：node scripts/extract_components_css.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('design/components.html', 'utf8');
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
// 只取元件區塊：從「按鈕」標題起；略過展示用外框（.demo / .stack / .row）
const start = css.indexOf('/* ---------- 按鈕');
if (start < 0) throw new Error('components.html 結構變了：找不到按鈕區塊');
writeFileSync('src/components.css', `/* 自動產生：scripts/extract_components_css.mjs ← design/components.html（勿手改） */\n${css.slice(start).trim()}\n`);
console.log('src/components.css ←', css.slice(start).split('\n').length, '行');
