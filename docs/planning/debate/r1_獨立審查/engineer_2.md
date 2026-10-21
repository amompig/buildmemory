# 工程師 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度 | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | `grid_json` 以 `updated_at` 後寫者勝：換裝置時舊端會覆寫新端，客戶端時鐘也不可信 | towns 加伺服器遞增 `version`；`PUT /town` 帶 `base_version`，不符回 409 + 最新狀態，前端重載再放。仍是整塊存取 |
| 2 | 高 | 庫存只有 count，「記憶卡」（取得地點／日期）無法對應到格子；放置與拆解缺「可用數 = count − 已放置」檢查 | checkins 加 `house_id, status(owned/placed/dismantled)`；格子存 `ck`（checkin id）；inventory 改成由 checkins 推導；`/town`、`/dismantle` 用 D1 `batch()` 原子驗證 |
| 3 | 高 | kit.js 一棟 = 數十 mesh，16×16 放滿達數千 draw call，遠超 150 | 每個 PRESET 烘焙一次：`mergeGeometries` + 頂點色 → 單一幾何；每房型一個 `InstancedMesh`（rot 寫進 instance matrix），全鎮 <30 call；以 `instanceId` 選取 |
| 4 | 中 | Pages 與 Worker 不同網域時登入 cookie 成第三方，iOS Safari 會擋 | API 放 Pages Functions（`functions/api/[[path]].js`）綁 D1：同源、單次部署 |
| 5 | 中 | 每日縣市簽到無 API、無資料表，伺服器也無法判斷縣市 | 併入 checkins：`landmark_id='daily:<縣市>'`，冷卻用 Asia/Taipei 日界；縣市取最近地標（≤30 km）所屬縣市，免載縣界 |
| 6 | 中 | Sprint 0 要 8 房型 + 3 模組 1–2 天不實際；燕尾、騎樓、龍柱、2×2 等手刻部件是最大時間黑洞 | Sprint 0 只做 iron／minnan／shophouse，其餘色塊占位，每房型限時 2 h；bloom／移軸降為可選 |

## 2. 架構提案
- `rules.js`（ES module，前端與 Functions 共用）：鄰路、解鎖範圍、2×2 佔位、haversine、冷卻等純函式。
- `store.js`：`load/save/version` 介面；Sprint 0 走 localStorage，Sprint 2 換 D1，存檔帶 `schema` 版號。
- `kit.js`：藍圖 → Group；加 `bake(preset)` 輸出合併幾何。
- `town.js`：InstancedMesh 池、instanceId 選取、擴張。
- `planner.js`：Canvas 2D 塗路，呼叫 rules 標紅。
- `geo.js`：watchPosition、附近地標、模擬面板；打卡附 `accuracy`，伺服器接受距離 ≤ R + min(accuracy, 50)。
- `functions/api/*`：auth／me／checkin／town／dismantle／share；地標 JSON 以 import 內嵌並帶 `data_version`，前端版本不符即拒絕。
- `scripts/etl_landmarks.py`：ETL + type_map + featured → `data/landmarks.json`。

Grid 格式：256 長陣列，`null | {t:'road'} | {t:'house',id,rot,ck} | {t:'part',of:idx}`（2×2 從屬格）。

```
GPS → geo.js ─POST /checkin(+accuracy,data_version)→ rules 驗證 → checkins(owned)
倉庫(由 checkins 推導) → planner/town 編輯 grid → store.save
  ─PUT /town{grid,base_version}→ rules 驗證 + ck 歸屬/唯一 → batch(): status、version++
  409 → 取回最新 → 重載
```

## 3. 分工表
| 工作項 | Cowork / Design / Code | 理由（一句） |
|---|---|---|
| 文資局 ETL、type_map、featured.csv | Cowork | 資料工程與人工校對 |
| 地標 JSON 排程重產 | Cowork | 排程任務 |
| 除錯面板規格、Sprint 驗收用例、測試計畫 | Cowork | 驗收與測試計畫 |
| rules.js + `node --test` 單元測試 | Code | 純函式，前後端共用 |
| kit.js 補房型 + bake 烘焙 | Code | 程式生成與效能 |
| town.js／planner.js | Code | 渲染與互動實作 |
| Pages Functions API、D1 schema／migration | Code | 後端實作 |
| Google 登入沿用 Dies-X | Code | 既有程式重用 |
| Playwright 手機視口 + `setGeolocation` E2E | Code | 打卡流程可自動化 |
| 實機效能量測（draw call／幀率） | Code | 效能調校 |
| 唯讀分享頁 | Code | 可選實作 |
| 四頁流程、底欄倉庫、記憶卡、空狀態文案 | Design | 畫面流程 |
| 色票、日夜、材質方向 | Design | 視覺風格 |
| 擴張解鎖與打卡回饋動效原型 | Design | 互動原型 |

## 4. 需要使用者決定的事（最多 3 條，附你建議的預設）
1. API 位置：Pages Functions 同源（建議）vs 獨立 Worker。
2. 庫存模型：checkins 實例制（建議，記憶卡需要）vs 保留 count 表。
3. 衝突策略：`version` + 409（建議）vs 後寫者勝。
