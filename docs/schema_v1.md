# schema v1 — grid / API / 錯誤碼 / 資料檔契約（2026-10-21）

> 三方共用契約。Code 的 `guard()`、`shared/rules.js`、Design 的 `ui_strings.json` 都以本檔為準。改動需升版並同步 06。

## 1. 識別字與命名空間
| 名稱 | 格式 | 例 |
|---|---|---|
| 房型 id | `sys:<slug>`（系統）；第二階段 `u:<uuid>`（玩家藍圖） | `sys:minnan` |
| grant id | UUID v4，伺服器產 | `3f2c…` |
| op_id | UUID v4，**客端產**，每次寫入請求一個；伺服器 `UNIQUE` 去重，重送回同一結果 | — |
| landmark id | `lm:<縣市代碼>-<流水>`；精選 `lm:<縣市代碼>-f<流水>` | `lm:TPE-0123` |
| user id | UUID v4 | — |
| day | `YYYY-MM-DD`，台北時間減 4 小時取日期 | `2026-10-21` |

## 2. Grid
- `grid`：長度 **256** 的陣列；`idx = r * 16 + c`，r 由北到南 0–15，c 由西到東 0–15。
- 格子型別：
```
null                                   空地
{ "t": "road" }
{ "t": "house", "id": "sys:minnan", "ref": "<grantId>", "rot": 0 }   錨點格
{ "t": "part", "of": <anchorIdx> }                                   2×2 從屬格
```
- `rot` ∈ {0,1,2,3}，順時針 90° 次數；rot 0 = 門面朝南（r+1 方向）。rot 只影響渲染，不影響佔格。
- 2×2：錨點 = 左上（最小 r、最小 c）；佔格固定 `{a, a+1, a+16, a+17}`；三個從屬格 `of = a`。
- 解鎖範圍：`size ∈ {8,10,12,14,16}`，視窗 `[(16-size)/2, (16-size)/2 + size)` 於 r、c 兩軸；非 null 格必須在視窗內。`size` 不存檔，由 `rules.unlockedSize(grid)` 推導。
- 序列化：`grid_json = JSON.stringify(grid)`，≤ 32 KB。

## 3. grants（帳本列，`GET /me` 回傳形狀）
```json
{ "id": "uuid", "kind": "house|part|shard|decor", "item_id": "sys:minnan",
  "state": "stock|placed|dismantled", "seed": 0, "landmark_id": "lm:TPE-0123|null",
  "visit_n": 1, "mood": null, "note": null, "at": "2026-10-21T08:12:00Z",
  "consumed_at": null }
```
- `mood` ∈ {null,0,1,2,3,4}；`note` ∈ null 或 NFC 正規化、去控制字元、≤ 40 字（以 code point 計）。
- 碎片數 = `kind='house' AND state='dismantled' AND consumed_at IS NULL` 的列數（第一版 kind 只會是 house）。
- 可用庫存（某房型）= `state='stock'` 列數；放置時該列 → `placed`；拆除 → `stock`。

## 4. Cookie 與 session
| Cookie | 內容 | 屬性 |
|---|---|---|
| `bym_device` | `<userId>.<HMAC-SHA256(userId, DEVICE_SECRET)>` | HttpOnly, Secure, SameSite=Lax, Path=/api, 400 天 |
| `bym_session` | 綁定 Google 後的 session token（D1 `sessions` 可撤銷） | 同上，30 天滑動 |
- 所有寫入請求檢查 `Origin` ∈ 允許清單；不符 → 403 `invalid`。
- 401 時前端只重呼 `POST /api/session`，**不清本機 grid**。

## 5. API
共通：JSON；成功 `200 {…}`；失敗 `{"error":{"code":"…", …參數}}`；伺服器時間一律 ISO-8601 UTC。

| 端點 | 請求 | 回應 | 失敗碼 |
|---|---|---|---|
| `POST /api/session` | `{}` | `{user_id, data_version}` + Set-Cookie；首次建立時發贈品（2 棟不同房型 stock + 預鋪路 grid） | — |
| `POST /api/auth/google` | `{id_token}` | `{user_id, merged: bool}` + Set-Cookie session | `unauthorized`, `invalid` |
| `GET /api/me` | — | `{user_id, bound: bool, grants:[…], town:{id, grid, rev}, shards:int, data_version, server_time}` | `unauthorized` |
| `POST /api/checkin` | `{landmark_id, lat, lng, acc, op_id}` | `{grant, checkin:{landmark_id, day, visit_n}}` | `weak_signal`, `too_far{dist}`, `cooldown{until}`, `daily_cap`, `rate_limited{retry_after}`, `invalid` |
| `POST /api/daily` | `{lat, lng, acc, op_id}` | `{grant, county, kind:"house"|"shard"}` | `cooldown{until}`（當日已領）, `weak_signal`, `invalid`（判不到縣市） |
| `PUT /api/town` | `{grid, base_rev, op_id}` | `{rev}` | `conflict{rev, grid}`, `invalid{reason}` |
| `PUT /api/grant/:id/memory` | `{mood, note}` | `{grant}` | `invalid` |
| `POST /api/dismantle` | `{ids:[…], op_id}` | `{shards}` | `invalid` |
| `GET /api/me/export` | — | 全部 grants + town + checkins（JSON 檔） | — |
| `DELETE /api/me` | `{confirm:"DELETE"}` | `{}` | `invalid` |
| `POST /api/share` / `DELETE /api/share` | — | `{token}` / `{}` | — |
| `GET /api/share/:token` | — | `{grid:[只含 t,id,rot,of]}` | `invalid` |

伺服器驗證順序（`/checkin`）：schema → session → 限速 → `acc ≤ 200` → 地標存在 → `dist ≤ R + min(acc,50)` → `UNIQUE(user, landmark, day)` → 日計數 < 40 → 與上一筆打卡間隔 ≥ 60 s → 寫入（batch）。座標在回應前丟棄，不入 log。

`PUT /town` 驗證：`rev == base_rev` → `rules.validateGrid(grid, grants, houses)`（含嚴格 schema：多餘欄位、未知房型 id 皆 `invalid{reason:'schema'}`）→ batch 更新 grant state → `rev + 1`。客端送出前必須剝除 UI 專用欄位。

## 6. 錯誤碼（`rules.js` 回傳 / `ui_strings.json` 鍵）
| code | HTTP | 參數 | 觸發 |
|---|---|---|---|
| `too_far` | 422 | `dist`（m，取整到 10） | 距離 > R + min(acc,50) |
| `weak_signal` | 422 | — | acc > 200 m |
| `cooldown` | 429 | `until`（ISO） | 同地標同日已打卡 / 當日已簽到 |
| `daily_cap` | 429 | — | 當日打卡 ≥ 40 |
| `rate_limited` | 429 | `retry_after`（秒） | 間隔 < 60 s 或限速 |
| `conflict` | 409 | `rev`, `grid` | base_rev 過期 |
| `unauthorized` | 401 | — | 無/失效 cookie |
| `invalid` | 400/403/422 | `reason`（可選，僅供除錯） | schema/規則不符 |
| `offline` | — | — | 前端專用：無網路 |

## 7. 資料檔
### houses.json
```json
{ "data_version": "2026-10-21.1",
  "houses": [ { "id": "sys:minnan", "name": "閩南紅磚厝", "size": [1,1],
                "palettes": [ {"wall":"#C9705B","roof":"#C97D4B","door":"#C7453B"}, … ≥3 ],
                "blueprint": { … 由 Code 打通 3 房型後定 … } } ] }
```
### landmarks.json
```json
{ "meta": { "source": "文化部文化資產局", "license": "政府資料開放授權條款-第1版",
            "dataset": "…", "fetched_at": "2026-10-21", "data_version": "2026-10-21.1" },
  "items": [ { "id": "lm:TPE-0123", "name": "…", "lat": 25.0, "lng": 121.5, "county": "TPE",
               "house": "sys:minnan", "r": 100, "tier": "general|featured", "blurb": "…(精選才有)" } ] }
```
- 縣市代碼：TPE 台北、NWT 新北、TAO 桃園、HSZ 新竹市、HSQ 新竹縣、MIA 苗栗、TXG 台中、CHA 彰化、NAN 南投、YUN 雲林、CYI 嘉義市、CYQ 嘉義縣、TNN 台南、KHH 高雄、PIF 屏東、ILA 宜蘭、HUA 花蓮、TTT 台東、PEN 澎湖、KIN 金門、LIE 連江。
- 前端啟動與 `GET /me` 比對 `data_version`，不符即重新載入資料檔。

## 8. 限制總表
| 項目 | 值 |
|---|---|
| body | ≤ 32 KB |
| grid | 256 格 |
| note | ≤ 40 字 |
| dismantle ids | 1–99 |
| 限速 | `/checkin` 30/min/IP；`/auth` 10/min/IP；`/town` 30/min/user |
