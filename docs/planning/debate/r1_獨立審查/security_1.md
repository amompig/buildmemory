# 應用資安 審查與規劃

## 1. 審查發現（最多 6 條，依嚴重度排序）
| # | 嚴重度(高/中/低) | 問題 | 建議（定案內可行） |
|---|---|---|---|
| 1 | 高 | `/checkin` 只驗距離＋冷卻；DevTools 直接 POST 假座標即可一晚刷遍全台，庫存失去意義 | 加三道伺服器規則：每人每日打卡 ≤ 20、相鄰兩次打卡位移速度 > 150 km/h 拒絕、同 IP 每分鐘 ≤ 5 次；lat/lng 精度截至小數 3 位 |
| 2 | 高 | `POST /auth/google` 若直接信前端送來的 id_token 或自製 session 格式，可偽造帳號 | Worker 用 Google JWKS 驗 id_token（iss/aud/exp/nonce），換發自簽 HS256 session JWT（7 天），放 HttpOnly+Secure+SameSite=Strict Cookie；id_token 不落地、不入 log |
| 3 | 中 | `checkins` 存原始 lat/lng 等同保存行蹤軌跡，屬個資法位置資料，外洩風險與保存義務同時成立 | 最小蒐集：D1 只存 `landmark_id, at`；座標在 Worker 驗完即丟；記憶卡顯示地標名即可；checkins 保存 1 年後只留計數 |
| 4 | 中 | `/share/:user_id` 可枚舉；自增 id 更易被掃出全站玩家與其足跡 | user id 用 UUID；分享改隨機 `share_token`（可撤銷、預設關閉）；分享頁不帶打卡時間 |
| 5 | 中 | `PUT /town` 整塊 JSON 無大小與結構限制，可塞爆 D1 或觸發 JSON 炸彈 | body ≤ 32 KB、schema 校驗（256 格、t/id/rot 皆 enum）、每人每分鐘 ≤ 10 次 |
| 6 | 低 | 開放資料授權未在前端標示；`updated_at` 後寫者勝會靜默蓋掉另一裝置的城鎮 | 地圖頁與關於頁固定標示「資料來源：文化部文資局，政府資料開放授權條款」；PUT 帶 `base_updated_at`，不符回 409 由前端提示 |

## 2. 架構提案
- Worker `auth.js`：驗 Google id_token、簽/驗 session、Origin 檢查（CSRF）
- Worker `guard.js`：速率限制（KV 計數，IP＋user 雙鍵）、body 上限、schema 校驗，所有路由共用
- Worker `checkin.js`：距離/冷卻/速度/日上限判定，只寫 `landmark_id`
- Worker `town.js`：grid 合法性＋樂觀鎖
- Worker `privacy.js`：`GET /me/export`、`DELETE /me`（個資法當事人權利，一併清 inventory/town/checkins）
- 前端 `geo.js`：僅在按下打卡時取定位，不快取、不寫 localStorage

```
瀏覽器 ─按打卡→GPS→ POST /checkin {lm,lat,lng}（Cookie session）
Worker: session→guard限速→距離≤R→冷卻/速度/日上限→D1 寫 checkins(lm,at)、inventory++
        └ lat/lng 用完即丟：不入 D1、不入 log、不回傳
```

## 3. 分工表
| 工作項 | Cowork / Design / Code | 理由（一句） |
|---|---|---|
| 威脅模型與反作弊參數表（上限、速度、半徑） | Cowork | 規則要先定案再寫碼 |
| 隱私政策與資料保存期限文件 | Cowork | 個資法告知義務，需人審 |
| 開放資料授權標示文案與位置 | Cowork→Design | 法務文字由 Cowork，版面由 Design |
| 打卡失敗/被限速的提示文案與狀態 | Design | 被拒時不洩漏規則細節但要能理解 |
| 分享連結開關與撤銷的 UI | Design | 預設關閉需明確可見 |
| Google 登入驗證與 session Cookie | Code | Workers 實作 |
| guard 中介層（限速、body、schema） | Code | 全路由共用 |
| /checkin 伺服器規則與座標即丟 | Code | 核心資安點 |
| /town 樂觀鎖與 409 處理 | Code | 防跨裝置覆寫 |
| 匯出/刪帳 API 與前端入口 | Code | 當事人權利 |
| D1 schema：UUID、share_token、索引 | Code | 防枚舉 |
| 濫用測試腳本（假座標、重放、刷量） | Cowork 規劃→Code 執行 | 驗收用 |
| 保存期限排程（checkins 匿名化） | Cowork | 排程任務歸 Cowork |

## 4. 需要使用者決定的事（最多 3 條，附你建議的預設）
1. checkins 是否完全不存座標？建議預設：不存，只存地標 id 與時間。
2. 每日打卡上限與速度門檻數值？建議預設：20 次/日、150 km/h。
3. 分享連結是否納入第一版？建議預設：Sprint 3 才做，且用隨機 token、預設關閉。
