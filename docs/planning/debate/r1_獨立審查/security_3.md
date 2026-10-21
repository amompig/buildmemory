# 應用資安 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度(高/中/低) | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | `/share/:user_id` 可枚舉；分享頁若含「記憶卡」會外洩打卡座標與時間＝個人行蹤 | 改 `/share/:token`（32 byte 隨機、可撤銷重產、預設關閉）；回應只含 grid 與房型 id，不含 checkins |
| 2 | 高 | `/auth/google` 未定義驗證；若 Google token 存 localStorage 長用，XSS 即可盜用、重放 | Workers 只收 Google ID token，驗簽（JWKS 快取）與 aud/iss/exp，用後即棄；改發自家 session cookie（HttpOnly+Secure+SameSite=Lax，7 天）；Workers 掛 Pages 同網域 `/api/*` |
| 3 | 高 | 打卡可重放、可腳本批次刷多地標；「每地標 24h」擋不住 | 座標只信伺服器端 `landmarks.json`；`(user,landmark,day)` 唯一索引擋競態；每人每小時 ≤ 10 次；相鄰打卡換算速度 > 150 km/h 拒絕並記 flag；Cloudflare Rate Limiting：/checkin 30/min/IP、/auth 10/min/IP |
| 4 | 中 | `checkins.lat/lng` 存精確座標違反個資法最小蒐集（第 5 條），且非必要 | 只存 `landmark_id, at, dist_m`；90 天後彙整為計數；首次定位前顯示同意與隱私說明；刪帳號＝刪全部 |
| 5 | 中 | `PUT /town`、`/dismantle n` 無大小與範圍限制、無交易，可塞大 payload、負數 | body ≤ 32 KB、schema 驗證、n 為 1–99；inventory/shards 用 D1 batch 交易；user_id 只取自 session；prepared statements；每日 D1 export 備份 |
| 6 | 低 | 開放資料與底圖授權標示缺位 | 關於頁與 `landmarks.json` meta 標示「文化部文化資產局／政府資料開放授權條款第 1 版」+ 資料集名稱 + 取得日；MapLibre 圖磚依供應商 attribution |

## 2. 架構提案
- `workers/auth.js`：驗 Google ID token、發/撤 session、`/me`。
- `workers/mw.js`：session 解析、速率計數、統一錯誤回應。
- `rules.js`（前後端共用純函式）：距離、鄰路、庫存、解鎖範圍；前端先驗、Workers 再驗。
- `workers/checkin.js`：冷卻唯一索引、速度檢查、交易寫 inventory。
- `workers/town.js`、`dismantle.js`：schema + rules.js，交易寫入。
- `workers/share.js`：token 產生/撤銷、去個資唯讀投影。
- `workers/cron.js`：90 天打卡彙整、過期 token 清理。
- 前端 `geo.js`：只在按打卡時取一次定位，不背景追蹤；除錯面板僅 `?dev=1`，後端不信任。

```
瀏覽器 ─Google ID token→ /api/auth/google ─驗 JWKS→ Set-Cookie(session)
瀏覽器 ─{landmark_id,lat,lng}+cookie→ /api/checkin
  → session → rate limit → rules.distance(landmarks.json)
  → 唯一索引(冷卻) → 速度檢查
  → D1 batch[ checkins(landmark_id,at,dist_m), inventory++ ]
```

## 3. 分工表
| 工作項 | Cowork / Design / Code | 理由（一句） |
|---|---|---|
| 威脅模型與安全需求清單維護 | Cowork | 規劃文件 |
| 隱私政策、同意文案、保存期限表 | Cowork | 法規文件 |
| 開放資料授權標示與來源 meta | Cowork | ETL 一併產出 |
| 定位同意畫面、分享開關與撤銷 UI | Design | 使用者流程 |
| 分享頁去個資資訊層級 | Design | 畫面決定洩漏面 |
| Google ID token 驗證 + session cookie | Code | Workers 實作 |
| `rules.js` 共用驗證 + 單元測試 | Code | 前後端一致 |
| /checkin 冷卻索引、速度檢查、交易 | Code | 反刷核心 |
| Rate Limiting 規則與 WAF | Code | 部署設定 |
| D1 schema（唯一索引、share_token）與 migration | Code | 資料層 |
| cron：彙整、token 清理、備份 | Code | Cron Triggers |
| 濫用測試腳本（重放、批次刷、大 payload） | Cowork | 驗收測試 |
| 上線前安全 checklist | Cowork | 跨工具交接 |

## 4. 需要使用者決定的事（最多 3 條，附你建議的預設）
1. 是否保留原始打卡座標？預設：不存，只存 `dist_m` 與 `landmark_id`。
2. 分享頁是否顯示取得地點與日期？預設：只顯示地標名，不顯示日期；分享預設關閉。
3. Workers 掛同網域 `/api/*`（cookie）或分網域（Bearer）？預設：同網域 cookie。
