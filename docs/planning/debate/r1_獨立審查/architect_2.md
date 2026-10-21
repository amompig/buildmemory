# 軟體架構師 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度(高/中/低) | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | 鄰路/範圍/庫存規則在 planner.js 與 Worker 各寫一份，必漂移 | 抽 `shared/rules.js`（純函式無 DOM），Pages 與 Workers 皆直接 ES import；單元測試用 node 跑 |
| 2 | 高 | `inventory(house_id)`、`shards` 綁死整棟，第二階段改部件需遷移 | 第一天即用 `items(user_id, kind, item_id, count)`，kind∈house/part/shard；格子 `id` 加命名空間 `h:minnan`／`bp:<uuid>` |
| 3 | 中 | 庫存語意未定：count 含已放置？拆解能拆掉已放置的？ | items=持有總數，placed 由 grid 推導；PUT /town 驗 placed≤count；dismantle 驗 count−placed≥n |
| 4 | 中 | Sprint 0–1 本機打卡，Sprint 2 登入後無法事後驗證 | 登入前為訪客沙盒；首次登入只匯 grid 當草稿，庫存歸零重算 |
| 5 | 中 | `updated_at` 後寫者勝，手機時鐘不可信 | 伺服器配發整數 rev；PUT 帶 rev，不符回 409＋伺服器版本，前端二選一 |
| 6 | 低 | 房型目錄在 PRESETS 與 houses.json 雙存；`/share/:user_id` 曝露序號 | houses.json 為正本（id/size/name/k），PRESETS 同 id 索引；分享改隨機 slug |

## 2. 架構提案
- `shared/rules.js`：格子合法性、庫存核算、距離/冷卻；零相依，雙端共用。
- `data/*.json`：唯讀內容（houses、landmarks 依縣市分檔），Cowork 排程重產。
- `kit.js`：藍圖→Group，只依賴 three，不知狀態。
- `state.js`：單一 store（items、grid、rev、待送佇列）＋localStorage 持久化＋同步。
- `planner.js`／`town.js`：只讀寫 state，互不 import。
- `geo.js`：定位、附近地標、呼叫 /checkin；離線提示需網路。
- `worker.js`：單檔路由＋D1，驗證僅呼叫 rules.js；`schema.sql` 以 `PRAGMA user_version` 管遷移。
- 擴充點：第二階段加 `blueprints(id, owner_id, source, status, json)`，格子引用 `bp:`；第三階段加 `friends`、`transfers`，blueprint status=review 即審核。

```
data/*.json(唯讀,部署更新)      D1 權威: items / checkins / towns.rev
   │                                  ▲
kit.js ◄─ town.js / planner.js        │ PUT /town{grid,rev} → 409 合併
              └──► state.js ─debounce─┘
                   localStorage=草稿+UI偏好，永不當庫存權威
geo.js ─► POST /checkin ─► items++ ─► GET /me 覆寫本機 items
```
交接介面：Cowork 產 `data/*.json`、`type_map.csv`、`featured.csv`、`test_plan.md`；Design 產 `design/tokens.css`、`ui_strings.json`、`flows.md`、SVG 圖示；Code 消費上述並產 `src/`、`schema.sql`、`wrangler.toml`。一人原則：無框架、無 ORM、無 build；規則單檔、store 單檔、Worker 單檔。

## 3. 分工表
| 工作項 | Cowork / Design / Code | 理由（一句） |
|---|---|---|
| 規則真值表（鄰路、擴張、拆解） | Cowork | rules.js 與測試的共同依據 |
| 文資局 ETL＋type_map＋featured | Cowork | 資料工程與人工校對 |
| houses.json 結構與內容 | Cowork | 內容正本，Code 只讀 |
| 驗收腳本（假打卡案例集） | Cowork | 除錯面板直接重播 |
| landmarks 排程重產 | Cowork | 台股小鎮同法 |
| 四頁流程與線框 | Design | 手機優先互動 |
| tokens.css（色票、日夜） | Design | kit.js 調色直接引用 |
| 圖示、空狀態、記憶卡文案 | Design | 以 ui_strings.json 交付 |
| shared/rules.js＋單元測試 | Code | 雙端共用核心 |
| kit.js 補齊 8 房型 | Code | 既有雛形延伸 |
| state.js＋localStorage＋同步 | Code | 離線優先骨幹 |
| planner／town／geo | Code | 畫面實作 |
| worker.js＋schema.sql＋CI | Code | 部署與 D1 |
| 效能量測（draw calls、instancing） | Code | Sprint 0 先量 |

## 4. 需要使用者決定的事（最多 3 條，附你建議的預設）
1. 訪客登入時是否匯入本機庫存？預設：不匯入，只匯 grid 草稿。
2. 打卡是否允許離線排隊補送？預設：否，第一版須線上。
3. 每日縣市簽到如何判縣市？預設：伺服器以縣市 bbox JSON 粗判 lat/lng。
