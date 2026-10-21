# 工程師 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度 | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | `inventory.count` 語意未定：已放置的房算不算庫存？`PUT /town` 與 `POST /dismantle` 併發可造成負庫存 | count＝總持有量；驗證 placed≤count、拆解 n≤count−placed；兩端點各用 `db.batch()` 交易 |
| 2 | 高 | 「updated_at 後寫者勝」＋本地離線存檔 → 換裝置時舊版覆蓋新版 | towns 加 `version` 整數；PUT 帶 `base_version`，不符回 409 並附伺服器版，前端二選一 |
| 3 | 高 | `/checkin` 寫 checkins 與 inventory 非原子；每日縣市簽到無 API、無縣市判定資料 | `db.batch()`；冷卻用 `UNIQUE(user_id,landmark_id,day)`；新增 `POST /daily`，縣市＝最近地標所屬縣市，免載縣市邊界 |
| 4 | 中 | 鄰路／解鎖範圍／2×2 佔格規則前後端各寫一份必分歧 | 抽 `rules.js` 純函式（ESM），瀏覽器與 Workers 直接共用，單元測試只打它 |
| 5 | 中 | Sprint 0–1 本機存檔如何併入 D1 未定；除錯面板假打卡會污染雲端 | 首次登入只上傳 town 布局，inventory 以伺服器為準；Sprint 1 實測資料捨棄 |
| 6 | 中 | kit 房型由多 mesh 組成，256 格全放會破 150 draw calls | 每房依材質 `mergeGeometries` 成 1–2 mesh；同房型 InstancedMesh（rot 進矩陣）；Sprint 0 先滿格壓測 |

## 2. 架構提案
- 模組清單與邊界
  - `rules.js`：純函式（格合法性、解鎖、放置數統計），前後端共用、零依賴。
  - `store.js`：單一狀態＋localStorage＋API 同步（version、離線佇列）；UI 只讀它。
  - `kit.js`／`town.js`／`planner.js`／`geo.js`：如 spec；渲染層不改狀態，只發事件。
  - `worker/`：`auth`、`checkin`、`daily`、`town`、`dismantle`、`share` 各一檔，import `rules.js`。
  - `scripts/etl_landmarks.py` → `data/*.json`，排程重產後部署。
- 關鍵資料流
```
geo.js ─POST /checkin─▶ batch(checkins, inventory++) ─▶ /me 刷新 store
planner/town ─▶ store{grid,version} ─PUT /town{grid,base_version}─▶
      ├ 200：version+1            └ 409：取伺服器版 → 使用者選
rules.js：前端即時驗證 ＝ Workers 最終驗證（同一份程式）
```

## 3. 分工表
| 工作項 | Cowork / Design / Code | 理由（一句） |
|---|---|---|
| 文資局 ETL＋type_map 人工校對 | Cowork | 資料工程與對照表 |
| featured.csv 精選地標研究 | Cowork | 需研究與手挑 |
| 四頁面流程、色票、空狀態文案 | Design | UI 定義 |
| 2D 塗格畫路手勢原型 | Design | 手感需先驗證 |
| rules.js＋單元測試（node --test） | Code | 核心邏輯最先寫 |
| kit.js 台灣 8 房型藍圖 | Code | 程式生成 |
| town.js 渲染＋instancing 滿格壓測 | Code | 效能預算 |
| planner.js | Code | 畫路邏輯 |
| geo.js＋Leaflet 地圖頁＋模擬定位 | Code | 定位實作 |
| Workers API＋D1 schema／migrations | Code | 後端 |
| Google 登入沿用 Dies-X | Code | 已有可複用 |
| CI（node --test＋wrangler deploy） | Code | 自動化 |
| 測試計畫與各 Sprint 驗收清單 | Cowork | 驗收 |
| 地標資料重產排程 | Cowork | 排程任務 |

## 4. 需要使用者決定的事（最多 3 條，附你建議的預設）
1. 工時：Sprint 0–3 合計 8–11 天偏樂觀（8 房型藍圖、iOS 定位除錯）；預設估算 ×1.5，Sprint 3 的 bloom／移軸改「可選」。
2. 同步衝突 UI：預設「取伺服器版」，本地版保留為草稿可還原。
3. 地圖庫：預設 Leaflet（CDN 直用、無 bundler 友善、較輕）。
