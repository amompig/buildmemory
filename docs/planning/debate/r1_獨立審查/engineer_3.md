# 工程師 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度(高/中/低) | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | `inventory(count)` 語意未定（總持有或未放置），而記憶卡要顯示「取得地點與日期」，count 無法追溯單棟來源；拆解時也不知拆哪一棟 | 改為每棟一列 `houses(id,user_id,house_id,checkin_id,state:stock/placed/dismantled)`，格子只存 `house_row_id`；lm/at 由 join checkins 取得 |
| 2 | 高 | 整塊 `grid_json` 後寫者勝：A 裝置離線編輯、B 裝置放房後，A 上傳會整塊覆蓋 B，且伺服器只驗「≤ 庫存」擋不住 | `towns` 加 `version` 整數；PUT 帶 `base_version`，不符回 409 並附雲端 grid；前端提示「用本機／用雲端」二選一，不做細格合併 |
| 3 | 高 | kit.js 房型是多 mesh 的 Group，InstancedMesh 要求同 geometry+material；放滿 200 棟 × 20 mesh 遠超 150 draw calls | kit.js 每個 PRESET 輸出一份 `mergeGeometries` 後的 BufferGeometry（顏色寫進 vertex color，單一 MeshStandardMaterial）；town.js 每房型一個 InstancedMesh，rot 寫 instance matrix，點選用 `instanceId` 反查格子 |
| 4 | 中 | 鄰路／解鎖範圍／庫存驗證前後端各寫一份必然漂移；Worker 需讀 landmarks.json 做距離與半徑驗證，但規格說「不進 D1」未定如何讀 | 抽 `rules.js` 純函式 ESM，前端 `<script type=module>` 與 Worker 同一檔；Worker 用 wrangler 的 JSON import 於 build 時內嵌 landmarks.json（約數千筆 <1 MB 可行） |
| 5 | 中 | Sprint 0–1 存 localStorage，Sprint 2 才登入：匿名期的打卡與城鎮如何併入帳號未定義；每日縣市簽到無 API，縣市判定方式未定 | Sprint 1 即建 Worker `/checkin`，用 cookie `device_id` 匿名記錄；登入時 `POST /auth/google` 帶 device_id 合併。新增 `POST /daily {lat,lng}`，縣市 = 最近地標所在縣市（免反向地理編碼） |
| 6 | 低 | Sprint 0「1–2 天」含 8 藍圖＋幾何合併＋planner＋town 太樂觀；iOS 定位需 HTTPS＋使用者手勢 | Sprint 0 改 3–4 天，先以 1 房型打通 planner→town→instancing 再補藍圖；定位只在按「打卡」時 `getCurrentPosition`，不用 watchPosition |

## 2. 架構提案
- `rules.js`：純函式（鄰路、範圍、庫存計數、擴張 70%、haversine、冷卻），前後端共用、可 `node --test`。
- `kit.js`：PRESET → 合併幾何＋footprint（1×1／2×2），不含場景邏輯。
- `town.js`：grid → 每房型 InstancedMesh ＋ 道路 InstancedMesh；raycast → cell。
- `planner.js`：Canvas 2D 塗路／擦除，產生 grid 修改，呼叫 rules 標紅。
- `geo.js`：取位、附近地標、打卡、模擬面板。
- `store.js`：單一 state（grid, houses, version, dirty）；localStorage 立即寫、2 秒 debounce 同步雲端。
- `api.js`：fetch 封裝、401 重登、409 衝突回呼。
- `worker/`：auth / me / checkin / daily / town / dismantle / share；D1 migrations 以 SQL 檔版本化。
- `scripts/etl_landmarks.py` ＋ `data/`：靜態 JSON，重跑重部署。

```
GPS →geo.js→ POST /checkin ──驗距離/冷卻(rules)──→ D1 houses +1 → GET /me → store
store(grid,houses,version) →planner/town 編輯→ rules.validate → localStorage
   → PUT /town{grid,base_version} → 200{version} ／ 409{server grid} → 使用者二選一
```

## 3. 分工表
| 工作項 | Cowork / Design / Code | 理由（一句） |
|---|---|---|
| 文資局 ETL、type_map.csv 人工校對 | Cowork | 資料工程與對照表屬規劃側 |
| featured.csv 精選地標（名稱、半徑、文案） | Cowork | 需查證與人工挑選 |
| 四頁流程、底欄倉庫拖放、規劃模式紅格 | Design | 手機互動流程決定可用性 |
| 色票、日夜調色、記憶卡版面 | Design | 補程式生成的質感差距 |
| 空狀態、打卡／冷卻／409 衝突文案與圖示 | Design | 文案與狀態回饋 |
| kit.js 8 房型藍圖＋幾何合併 | Code | 核心渲染資產 |
| rules.js ＋ node 單元測試 | Code | 規則共用是正確性基礎 |
| town.js instancing ＋ planner.js | Code | 3D／2D 編輯實作 |
| geo.js ＋ Leaflet 地圖頁 | Code | 定位與地圖整合 |
| Worker API、D1 schema、409 同步 | Code | 後端與衝突處理 |
| 匿名→帳號合併規則 | Cowork→Code | 先定規則再實作 |
| 手機效能量測（draw call、FPS 門檻） | Code | Sprint 0 驗收項 |
| 驗收計畫、台北實地打卡腳本 | Cowork | 測試計畫與排程 |
| CI：node --test ＋ wrangler deploy | Code | 一人開發需自動化 |

## 4. 需要使用者決定的事（最多 3 條，附你建議的預設）
1. 庫存改「每棟一列」還是維持 count？預設：每棟一列（記憶卡、拆解、驗證都更單純）。
2. 409 衝突時預設行為？預設：顯示二選一，不自動覆蓋。
3. 地圖庫？預設：Leaflet ＋ OSM 柵格圖磚（無金鑰、輕量）；MapLibre 留待需要向量樣式時。
