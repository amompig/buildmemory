# design_check — 畫布渲染器的自動檢查（2026-10-22）

對 `design/canvas/project/Landmarks.dc.html` 與 `Houses.dc.html`（Claude Design 畫布的兩塊板）跑：

1. `node verify_order.js` — 兩條硬規則：本體在自己的屋頂之前、父量體與其屋頂在疊上去的子量體之前。全部要 `ok`。
2. `node verify_edges.js` — 列出畫面上重疊、且被判定「A 在 B 後面」卻畫在 B 之後的每一對（循環被打斷的地方）。目標：地標 0–1 對、一般建築只剩陽台 / 冷氣 / 通風球這類小附件。
3. `node preview.js <board> out.html && node shot2.js out.html` — 把每張卡截成 `card_N.png`（2×）供肉眼核對；右下角是純色剪影。

腳本預期路徑 `../town/project/*.dc.html`，複製到別處時改第一行路徑即可。
