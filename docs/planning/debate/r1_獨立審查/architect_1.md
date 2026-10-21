# 架構師 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度(高/中/低) | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | `inventory(house_id,count)` 與 `shards` 各自成表，第二階段改部件必遷移 | 第一天就用通用 `items(user_id,kind,item_id,count)`，kind∈house/part/pack/shard；碎片只是一列 |
| 2 | 高 | grid 格 `id` 直指房型，玩家自組藍圖/UGC 進來要改格式 | 格存 `bp` 字串加命名空間：`sys:minnan`，日後 `u:<uuid>`；藍圖 JSON schema v1 現在定，PRESETS 搬進 `data/houses.json`，kit.js 只解譯 |
| 3 | 高 | 無訊號地標（山區/離島）打卡會丟；`updated_at` 後寫者勝受裝置時鐘影響 | 經濟操作（打卡/拆解/簽到）走本機 `pending ops` 佇列，client 產 op_id，伺服器冪等重放；城鎮快照用伺服器 `version` 整數 LWW，衝突 409 回伺服器版 |
| 4 | 中 | 鄰路/庫存/解鎖規則前後端各寫一份會分岔 | 抽 `shared/rules.js` 純 ES module（無 three/DOM）：Pages 靜態載入、Worker 直接 import，單測只測它 |
| 5 | 中 | 庫存與已放置數雙帳 | items 只存「擁有」，可用＝擁有−grid 內計數；checkins 另存當時 house_id，對照表改版可重算 |
| 6 | 低 | `/share/:user_id` 可枚舉；每日縣市簽到伺服器判不了縣市 | 改 `share_token`；加 `data/counties.json`（政府縣市界），前後端共用 point-in-polygon |

## 2. 架構提案
- `data/`：靜態 JSON（landmarks/houses/counties），Cowork 產出，帶 `data_version`，前端與 Worker 共讀
- `shared/rules.js`：純規則（鄰路、庫存、解鎖、距離），零相依
- `store.js`：唯一碰 localStorage/API 的模組；持快照＋pending ops＋version
- `kit.js`/`town.js`/`planner.js`/`geo.js`：只讀寫記憶體 state，不碰儲存與網路
- `worker/`：路由＋D1；表 users、items、towns(grid_json,version)、checkins、ops(op_id 冪等日誌)；第二階段加 blueprints，第三階段送房＝ops 新 kind
- localStorage：訪客模式正本；登入後僅為快取＋佇列，登入時一次性匯入

```
data/*.json ──┐
shared/rules ─┼→ store.js ⇄ api.js ⇄ worker(D1)
              │     ↕ state
      kit→town / planner / geo
pending ops →(上線)→ POST /ops 冪等重放 → 回 items+town@version
```

## 3. 分工表
| 工作項 | Cowork / Design / Code | 理由（一句） |
|---|---|---|
| spec 正本、規則驗收案例 | Cowork | 文件與測試計畫 |
| 文資局 ETL、type_map、featured、counties.json、排程重產 | Cowork | 資料工程 |
| 藍圖/格/items 的 JSON Schema v1 | Cowork | 三方契約，先於程式 |
| 4 頁＋除錯面板流程、線框、原型 | Design | UI/UX 流程 |
| `tokens.css`＋日夜 `palette.json`（kit.js 材質讀） | Design | 色票進程式生成 |
| 圖示 SVG、空狀態與記憶卡文案 `i18n/zh-TW.json` | Design | 文案與圖示 |
| 手機可用性實測 | Design | 可用性檢查 |
| kit.js 8 房型＋houses.json 化 | Code | 實作 |
| store/town/planner/geo 前端 | Code | 實作 |
| shared/rules.js＋單測 | Code | 規則共用 |
| Worker API、D1 migration、wrangler、CI | Code | 部署 |
| 效能量測（draw calls/instancing） | Code | 效能調校 |
| 部署後實地驗收（台北打卡） | Cowork | 驗收 |

## 4. 需要使用者決定的事（最多 3 條，附你建議的預設）
1. API 放 Pages Functions（同 repo 單一部署）或獨立 Worker — 預設 Pages Functions（底層仍是 Workers＋D1）
2. 訪客模式是否正式支援（未登入可玩，登入一次性匯入）— 預設是，Sprint 0/1 本就如此
3. 碎片是否併入 items、取消 shards 表 — 預設併入
