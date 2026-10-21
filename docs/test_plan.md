# 測試計畫 v0（Sprint 0 驗收）

> 每個 Sprint 開工前補該 Sprint 清單。驗收用真機：iOS Safari + Android Chrome 各一。

## S0-A 單元測試（`node --test tests/rules.test.js`）
- [ ] `rules_truth_table.md` §1–§9 每個案例各一條 test，全綠
- [ ] 首啟贈品 grid 通過 `validateGrid`，`unlockedSize` = 8

## S0-B 渲染
- [ ] 3 房型（iron/minnan/shophouse）各 3 組色票渲染正確，變體只換色不換幾何
- [ ] 256 格全放（混合 3 房型 + 道路）：draw calls ≤ 150（`renderer.info.render.calls`）、iPhone 12 等級 ≥ 30 fps
- [ ] 單一 WebGL context（DevTools 檢查）
- [ ] 4 向相機快照、俯視補間 ≤ 400 ms、相機自動 fit 已解鎖區、未解鎖格霧面

## S0-C 互動（兩態）
- [ ] 看：單指平移、雙指縮放；不會誤塗路
- [ ] 擺放-道路：單指連續塗路；視窗外格不可塗；擦除會 orphan 的路被拒並紅框 + 斜線 + 震動
- [ ] 擺放-房：點倉庫 → 幽靈房跟隨 → 合法格綠 / 非法格紅（occupied / no_road / locked 各測一次）→ 確認落房 → 庫存 −1
- [ ] 擺放中單步復原；「完成」回看模式；雙指永遠是相機
- [ ] 2×2 規則在 rules 通過（渲染 Sprint 2）

## S0-D 存檔
- [ ] 每次編輯 localStorage 立即寫；重新整理後 grid 與庫存一致
- [ ] 解鎖：8×8 填到 45 格 → 自動變 10×10 並顯示進度條

## S0-E 除錯面板 `?dev=1`
- [ ] 模擬座標、假打卡（只動本機 grants）、重設存檔
- [ ] 假打卡案例可重播：圈內 / 邊界 +5 m / acc 250 / 同日重按 / 第 41 次（本機模擬規則回對應錯誤碼）

## S0-F 無障礙與體驗硬指標
- [ ] 觸控目標 ≥ 44 px；文字對比 ≥ 4.5:1
- [ ] `prefers-reduced-motion` 時無補間與震動
- [ ] 任何拒絕都有 `ui_strings[code]` 人話，無裸錯誤碼

## 出場條件
S0-A 全綠 + S0-B draw calls 達標 + S0-C 三種非法格各驗證一次 → 進 Sprint 1。
