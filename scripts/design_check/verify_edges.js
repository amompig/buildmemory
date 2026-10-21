const fs=require('fs');
for (const f of ['Landmarks','Houses']){
let src=fs.readFileSync(`../town/project/${f}.dc.html`,'utf8');const m=src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
// expose isBehind/overlaps by injecting a hook
let code=m[1].replace('blocks = ordered;','blocks = ordered; blocks.__chk={isBehind:isBehind,overlaps:overlaps};');
class DCLogic{};const C=eval('('+code+')');
const items=new C().renderVals().items; const data=new C().data();
items.forEach((it,k)=>{const d=data[k]; const {isBehind,overlaps}=it.blocks.__chk; let viol=[];
 for(let i=0;i<it.blocks.length;i++)for(let j=i+1;j<it.blocks.length;j++){const A=it.blocks[i],B=it.blocks[j]; if(!overlaps(A.sb,B.sb))continue; if(isBehind(B.box,A.box)&&!isBehind(A.box,B.box)){const nm=b=>b.box.roofOf!==undefined?'R:'+d.blocks[b.box.roofOf].id:d.blocks[b.box.id].id; viol.push(nm(B)+'→'+nm(A));}}
 console.log(it.id.padEnd(18), viol.length?('cycle-breaks: '+viol.join(', ')):'clean');});}
