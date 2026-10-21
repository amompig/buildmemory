const fs=require('fs');
for (const f of ['Landmarks','Houses']){
const src=fs.readFileSync(`../town/project/${f}.dc.html`,'utf8');const m=src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);class DCLogic{};const C=eval('('+m[1]+')');
const items=new C().renderVals().items; const data=new C().data();
items.forEach((it,k)=>{const d=data[k]; let bad=[]; const pos={}; it.blocks.forEach((b,i)=>pos[String(b.box.id)]=i); const n=it.blocks.length; it.blocks.forEach(b=>{if(b.box.roofOf!==undefined && pos[String(b.box.roofOf)]>pos[String(b.box.id)]) bad.push(d.blocks[b.box.roofOf].id); if(b.box.on>=0){ if(pos[String(b.box.on)]>pos[String(b.box.id)]) bad.push('on:'+d.blocks[b.box.id].id); const pr='roof'+b.box.on; if(pos[pr]!==undefined && pos[pr]>pos[String(b.box.id)]) bad.push('onroof:'+d.blocks[b.box.id].id);} });
const raw=d.blocks.length; const expect=raw + it.blocks.filter(b=>b.box.roofOf!==undefined).length; // segments expand so compare >=
console.log(it.id.padEnd(18), n, bad.length?('BAD '+bad.join(',')):'ok');});}
