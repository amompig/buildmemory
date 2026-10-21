// 把上線需要的檔複製到 dist/（白名單）；wrangler 只上傳 dist/。docs/tests/參考照片不會上線。
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const FILES = ['index.html', '_headers', 'src', 'shared', 'data', 'design/ui_strings.template.json'];
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/design', { recursive: true });
for (const f of FILES) cpSync(f, `dist/${f}`, { recursive: true });
console.log('dist/ ←', FILES.join(', '));
