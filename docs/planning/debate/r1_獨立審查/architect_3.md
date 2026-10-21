# 架構師 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度(高/中/低) | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | `inventory` 只存 count，放房時無法對應是哪次打卡，記憶卡（地點/日期）資料鏈斷 | 改「發放帳本」`grants(id,user_id,kind,item_id,landmark_id,at,state)`，state=stock/placed/dismantled；count 用查詢算；格子存 `gid` 指回 grant |
| 2 | 高 | 第二階段部件、碎片各開表 = 遷移 | 帳本 `kind`=house/part/shard 同表，`shards` 表取消；格子 `bp` 存字串 id，日後 `u:<uuid>` 指玩家藍圖，schema 不動 |
| 3 | 中 | 鄰路/解鎖/庫存驗證前端標紅與 Worker 各寫一份，必然漂移 | 單一 `rules.js`（純函式 ESM）兩端 import，Workers 原生支援，無需 bundler |
| 4 | 中 | Sprint 0–1 只有 localStorage，Sprint 2 才登入，本機存檔如何併入帳號未定 | `store.js` 同一 API、local/remote 兩 adapter；首登 `POST /claim` 上傳本機帳本，除錯面板產生的 grant 標 `debug` 不收 |
| 5 | 中 | `updated_at` 後寫者勝會靜默吃掉另一裝置整鎮 | `towns.rev` 整數，PUT 帶 rev，不符回 409 + 最新鎮，客端重載再套用 |
| 6 | 低 | 全台古蹟+歷史建築數千筆一次載入；山區地標常無訊號 | `landmarks/<縣市>.json` 依定位懶載 + `version`；打卡進 op queue 離線排隊，伺服器以客端 `at` 算冷卻但限 24h 內 |

## 2. 架構提案
- 模組清單與邊界
  - `data/`：靜態內容（houses.json 目錄、landmarks/*.json、type_map.csv），建置期產出、執行期唯讀。
  - `kit.js`：藍圖 JSON → THREE.Group 純函式，不碰狀態與 DOM。
  - `rules.js`：格線合法性、解鎖、庫存結算的純函式，前後端共用。
  - `store.js`：唯一狀態持有者＋持久化 adapter（local/remote）＋離線 op queue。
  - `town.js`/`planner.js`/`geo.js`/`map.js`：四個視圖，只依賴 store 與 kit，彼此不互相 import。
  - `index.html`：啟動與路由，無業務邏輯。
  - `worker/`：薄路由＋D1，驗證全委託 rules.js。
  - 依賴方向：views → store → rules；kit 只被 town 用；worker → rules。
  - 演進：第二階段 = 帳本加 `kind:part` ＋ `blueprints(id,owner,json,status)` 表；第三階段 = grant 新增轉讓列（送房）、`relations` 表、blueprints.status 審核，`/share` 路徑重用為互訪。
- 關鍵資料流 / 狀態
```
靜態 JSON ─► store ◄─ localStorage（草稿、queue、除錯）
             │ sync(rev + op queue)
             ▼
          Worker ─► rules.js ◄─ planner 標紅
             ▼
   D1: users / grants(帳本=真相) / checkins / towns(grid_json, rev)
```
所有權：內容歸靜態 JSON；帳本、打卡、鎮快照歸 D1；localStorage 只放草稿與佇列。

## 3. 分工表
| 工作項 | Cowork / Design / Code | 理由（一句） |
|---|---|---|
| houses.json schema 與 8 房型條目 | Cowork | 三方共用契約，最先定 |
| 文資局 ETL、type_map、featured.csv、分縣輸出 | Cowork | 資料工程 |
| 驗收清單＋台北 3 地標實測腳本 | Cowork | 驗收計畫 |
| landmarks 排程重產 | Cowork | 排程任務 |
| 四頁流程、空狀態文案 | Design | 畫面流程 |
| tokens.css 色票＋每房型主色 | Design | 視覺系統 |
| 記憶卡、倉庫卡片元件規格 | Design | 元件 |
| 圖示 SVG | Design | 圖示 |
| rules.js＋單元測試 | Code | 共用核心 |
| store.js 雙 adapter＋op queue | Code | 離線優先 |
| kit.js 補 8 房型＋instancing 量測 | Code | 效能預算 |
| town/planner/geo/map 視圖 | Code | 實作 |
| Worker API、schema.sql、/claim | Code | 後端 |
| Pages 部署、PWA、CI | Code | 部署 |

## 4. 需要使用者決定的事（最多 3 條，附你建議的預設）
1. 離線打卡可否排隊補送？預設：可，客端時間 24h 內有效。
2. 放房是否消耗庫存、拆除回庫？預設：是，grant state 往返。
3. 第一版是否保留不登入的訪客模式？預設：保留，Sprint 2 用 /claim 併入。
