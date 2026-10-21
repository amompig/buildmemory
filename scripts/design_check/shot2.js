const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:960,height:2100},deviceScaleFactor:2});await p.goto('file://'+process.cwd()+'/'+process.argv[2]);
const cards=await p.$$('.card');
for(let i=0;i<cards.length;i++){await cards[i].screenshot({path:`card_${i+1}.png`});}
await b.close();})();
