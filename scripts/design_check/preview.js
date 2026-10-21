// Render a board's renderVals() output into a standalone HTML for screenshot checks
const fs=require('fs');
const file=process.argv[2], out=process.argv[3];
const src=fs.readFileSync(file,'utf8');
const m=src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
class DCLogic{}
const Component=eval('('+m[1]+')');
const items=new Component().renderVals().items;
let html='<!doctype html><meta charset="utf-8"><body style="margin:0;background:#F6F1E8;font-family:sans-serif"><div style="display:grid;grid-template-columns:repeat(2,448px);gap:16px;padding:16px">';
for(const it of items){
  html+=`<div><div class="card" style="position:relative;width:448px;height:320px;background:#DCE8E2;border-radius:12px;overflow:hidden">`;
  html+=`<div style="position:absolute;left:0;top:0;width:448px;height:320px;transform:translate(${it.fit?it.fit.tx:0}px,${it.fit?it.fit.ty:0}px) scale(${it.fit?it.fit.s:1});transform-origin:0 0">`;
  html+=`<div style="position:absolute;left:${it.plot.l}px;top:${it.plot.t}px;width:${it.plot.w}px;height:${it.plot.h}px;background:#A6C9B8;clip-path:${it.plot.clip}"></div>`;
  html+=`<div style="position:absolute;left:${it.ground.l}px;top:${it.ground.t}px;width:${it.ground.w}px;height:${it.ground.h}px;background:#C3DDCC;clip-path:${it.ground.clip}"></div>`;
  for(const b of it.blocks){
    html+=`<div style="position:absolute;left:${b.left}px;top:${b.top}px;width:${b.w}px;height:${b.h}px">`;
    for(const p of b.parts) html+=`<div style="position:absolute;left:${p.l}px;top:${p.t}px;width:${p.w}px;height:${p.h}px;background:${p.bg};clip-path:${p.clip};border-radius:${p.r}"></div>`;
    html+='</div>';
  }
  html+='</div>';
  if(it.sil){
    html+=`<div style="position:absolute;right:8px;bottom:8px;width:96px;height:72px;background:#FFFCF7;border-radius:8px;overflow:hidden"><div style="position:absolute;left:0;top:0;width:448px;height:320px;transform:translate(${it.sil.tx}px,${it.sil.ty}px) scale(${it.sil.s});transform-origin:0 0">`;
    for(const b of it.blocks){ html+=`<div style="position:absolute;left:${b.left}px;top:${b.top}px;width:${b.w}px;height:${b.h}px">`; for(const p of b.parts) html+=`<div style="position:absolute;left:${p.l}px;top:${p.t}px;width:${p.w}px;height:${p.h}px;background:#2F3B46;clip-path:${p.clip};border-radius:${p.r}"></div>`; html+='</div>'; }
    html+='</div></div>';
  }
  html+=`<div style="position:absolute;left:10px;top:10px;font-size:11px;padding:3px 8px;border-radius:999px;background:#FFFCF7;color:#5C6670">${it.id} ${it.name} · ${it.sizeText} · ${it.blockCount}</div></div></div>`;
}
html+='</div></body>';
fs.writeFileSync(out,html);
