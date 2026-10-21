# 08 Claude Design 交接（UI / 視覺 / 互動）

依據：`06_最終架構方案_v1.0.md` §3 玩家流程、§6 設計底線。輸入：`samples/A–D.png`（程式生成風格現況）、`docs/schema_v1.md`（錯誤碼 enum）、`data/houses.json`（房型與主色）。

## 產出清單
| 檔案 | 內容 | 驗收 |
|---|---|---|
| `design/flows.md` | 三 tab（地圖/城鎮/倉庫）× 兩態（看/擺放）流程圖；首啟三步引導；打卡 → 記憶卡 → 放進小鎮；409 對話；登入時機；分享面板 | 按下打卡到記憶卡 ≤ 2 個畫面 |
| `design/tokens.css` + `design/palette.json` | 暖紙感低飽和 + 單一強調色；字級/間距；`palette.json` 含 `three` 區塊（每房型 3–4 組牆/屋頂/門色，供 kit.js `bake` 重烘）；日夜只動燈光色，不動材質色 | 對比 ≥ 4.5:1 |
| `design/gestures.md` | 兩態狀態表：看（單指平移/雙指縮放/4 向按鈕）、擺放（底欄選道路或房 → 單指塗路或幽靈落房 → 完成/單步復原；雙指永遠是相機）；動效一節（幽靈吸附、落房、解鎖儀式，皆可被 reduced-motion 關閉） | 無模式殘留 |
| `design/ui_strings.json` | 以錯誤碼為鍵（9 個）：`too_far`「再走約 {dist} m」、`weak_signal`「訊號弱，到戶外再按」、`cooldown`「今天來過了，明早 4 點後再來」、`daily_cap`「今天已收 40 棟，明天再來」、`rate_limited`、`conflict`、`unauthorized`、`invalid`、`offline`「有訊號再按」；空狀態、引導、隱私一句話「只在按下時取一次，只存地標名」、簽到 toast「今天的通用房已入倉庫」/「鐵窗厝滿了，收為碎片」 | 無裸錯誤碼 |
| `design/memorycard_storyboard.md` | 打卡成功序列分鏡：定位圓圈收斂 → 房子長出 → 記憶卡 → 放進小鎮；每段時長與 reduced-motion 替代 | ≤ 2 個畫面 |
| `design/components.html` | 無 three 的靜態原型：底欄倉庫卡片（橫向捲動、依日期 + 縣市 chips）、工具列、記憶卡（地名/日期/第 N 次/心情 5 鍵/一句話，「略過」與「存」同大）、409 對話（兩張縮圖 + 裝置/時間）、分享面板（三個勾選預設關） | Code 直接取 CSS |
| `design/icons/*.svg` | 工具圖示、心情 5 鍵、道路、拆解、4 向；PWA 圖示與啟動畫面（唯一手工圖資） | 單色可換色 |
| 可用性檢核表 + 任務腳本 | 觸控 ≥ 44 px、對比、雙編碼（紅框 + 斜線 + 震動）、reduced-motion；3 個任務給 Cowork 實測 | — |

## 設計約束（不可違反）
- 單一 Three.js 場景；規劃 = 相機俯視 + 筆刷，沒有獨立 2D 頁
- 記憶卡用 DOM 疊層；房型預覽用啟動時預渲 PNG，不開第二 WebGL context
- 心情與一句話在記憶卡同一畫面，可跳過
- 首啟不登入、不先要定位；定位提示只在打卡鈕旁一句話 + 系統原生提示
- 分享圖預設只含小鎮 + 棟數

## 順序
Sprint 0：flows、tokens + palette、gestures、ui_strings、components.html（底欄/工具列/記憶卡/409 對話/分享面板一次做齊，之後只微調）→ Sprint 1：memorycard_storyboard、SVG → Sprint 2：409 對話與倉庫排序微調 → Sprint 3：無障礙檢核、PWA 圖示
