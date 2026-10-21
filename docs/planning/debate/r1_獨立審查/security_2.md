# 應用資安 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度 | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | `GET /share/:user_id` 以內部 id 當連結：可枚舉全站玩家，且回傳的 grid 含 `lm, at`（打卡地點＋時間）可推住家與作息 | 改 `share/:token`（32 byte 隨機、opt-in、可撤銷）；分享回應只含 `t,id,rot`，剝除 `lm, at` |
| 2 | 高 | `checkins` 永久保存精確 lat/lng，屬個資法「位置資料」，但無保存期限、無刪帳機制 | 伺服器只存 `landmark_id, dist_m, at`（server time），不存原始座標；加 `DELETE /me`（一鍵刪帳＋匯出）與隱私聲明頁 |
| 3 | 高 | `/auth/google` 未定義驗證與 session：若前端直傳 ID token 當憑證，會被重放、跨站盜用 | Workers 驗 `aud/iss/exp/signature`（JWKS 快取），換發自家 session（HttpOnly+Secure+SameSite=Lax cookie，7 天，D1 `sessions` 表可撤銷）；不存 Google token；寫入 API 檢查 `Origin` 白名單 |
| 4 | 中 | 速率限制只寫一句；Workers 無狀態，`/checkin`、`PUT /town` 可被刷（D1 寫入成本＋庫存灌水） | 兩層：Cloudflare Rate Limiting 規則（IP：/checkin 10/min、/town 30/min）＋D1 每人每日上限（打卡 30 次、簽到 1 次）；`/checkin` 帶 client `idempotency_key` 去重 |
| 5 | 中 | GPS 偽造雖「接受」，但零成本的合理性檢查都未做；每日縣市簽到完全信任客戶端縣市 | 伺服器拒收 `accuracy>150 m`；連續兩次打卡隱含速度 >150 km/h 則拒；縣市由伺服器以縣市多邊形判定，不收客戶端縣市；除錯面板的假打卡只動 localStorage，伺服器永不讀 dev 旗標 |
| 6 | 中 | `PUT /town` 整塊 JSON 無大小/結構上限；D1 與秘密保護未提 | `grid_json` ≤ 32 KB、JSON Schema 校驗、未知欄位丟棄；全程參數化查詢；秘密走 `wrangler secret`；開啟 D1 Time Travel；Pages 加 CSP/HSTS，禁 inline script |

## 2. 架構提案
- `workers/auth.js`：Google ID token 驗證、session 簽發/撤銷、`DELETE /me`。
- `workers/guard.js`：中介層—Origin 檢查、session 讀取、D1 計數型限流、請求體大小上限。
- `workers/checkin.js`：距離/冷卻/精度/速度/縣市判定，只寫最小欄位。
- `workers/town.js`：grid schema、鄰路、庫存、解鎖範圍驗證；`If-Match: updated_at` 防覆蓋。
- `workers/share.js`：token 產生/撤銷、去識別化輸出。
- `data/privacy.md` + 前端「資料與授權」頁：隱私聲明、文資局/OSM 標示。
- 前端 `geo.js` 只送 `lat,lng,accuracy,landmark_id,key`，不送時間與縣市。

```
瀏覽器 ──Google ID token──▶ auth.js ─驗簽─▶ session cookie
瀏覽器 ──{lm,lat,lng,acc,key}──▶ guard.js ─限流/Origin─▶ checkin.js
        ◀── {house,+1} ──      │ 丟棄座標      └─▶ D1 checkins(lm,dist,at)
瀏覽器 ──grid_json+If-Match──▶ town.js ─schema/庫存/鄰路─▶ D1 towns
匿名 ──/share/:token──▶ share.js ─去 lm/at─▶ 唯讀 grid
```

## 3. 分工表
| 工作項 | 分工 | 理由 |
|---|---|---|
| 威脅模型與 API 安全規格（本檔擴寫為 `security.md`） | Cowork | 文件與驗收基準 |
| 隱私聲明、保存期限、刪帳/匯出流程文案 | Cowork | 法規解讀與文件 |
| 開放資料授權標示文（文資局「政府資料開放授權條款-第1版」＋OSM ODbL） | Cowork | 授權文字正確性 |
| 縣市多邊形簡化 GeoJSON（ETL 附帶） | Cowork | 資料工程 |
| 安全驗收測試計畫（重放、刷量、越權、超大 JSON） | Cowork | 測試案例設計 |
| 隱私/授權頁與分享開關 UI、刪帳確認流程 | Design | 使用者可理解的同意與撤銷 |
| 分享頁去識別呈現（無地點、無時間） | Design | 介面決定洩漏面 |
| Google ID token 驗證＋session cookie＋Origin 檢查 | Code | 後端實作 |
| 限流（CF 規則＋D1 計數）與 idempotency | Code | 基礎設施 |
| `/checkin` 合理性檢查與最小寫入 | Code | 伺服器邏輯 |
| `PUT /town` schema/大小/樂觀鎖 | Code | 驗證實作 |
| `/share/:token` 與撤銷、`DELETE /me` | Code | API |
| CSP/HSTS 標頭、`wrangler secret`、D1 Time Travel | Code | 部署設定 |
| 安全測試腳本（curl/Node，納入 CI） | Code | 自動化 |

## 4. 需要使用者決定的事
1. 位置資料保存：建議預設「不存原始座標，只存地標 id＋距離＋伺服器時間」；若日後要拍照反作弊再加欄位。
2. 分享連結：建議預設「opt-in、隨機 token、可撤銷、只含建築配置」；地標名稱是否顯示由使用者在分享時勾選。
3. 帳號沿用 Dies-X：建議預設「同一 Google OAuth client 加新 origin，但 D1 與 session 各自獨立」，避免一處外洩波及兩專案。
