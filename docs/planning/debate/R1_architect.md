# 架構師 詰問 R1

## 詰問（最多 6 條，依重要性排序）
| # | 對象 | 被詰問的提案 | 問題 | 我的替代方案 |
|---|---|---|---|---|
| 1 | 資安 | 6 個 worker 檔 + guard + cron | 一人維護 7 個後端檔加排程；既不存座標，cron「保存期限彙整」無對象；token 撤銷可懶做 | 後端三檔：`functions/api/[[path]].js`（路由＋guard 包裝函式）、`_lib/handlers.js`、`shared/rules.js`。限速用 Cloudflare 儀表板規則、CSP/HSTS 用 Pages `_headers`、備份用 D1 Time Travel，皆零程式碼；cron 第一版不做 |
| 2 | 工程師 | 1/3 保留 `inventory.count`；2/3 `houses` 表只裝房 | 使用者要變體、心情、第 N 次，設計師要記憶卡永久綁單棟——count 做不到；只裝房的表到第二階段 part 又要遷移 | `grants` 每筆一列、`kind` 通用，加欄 `seed, mood, note, visit_n`；碎片不設表＝`state='dismantled' AND consumed_at IS NULL` 的列數 |
| 3 | 使用者 | 變體 / 心情 / 裝飾 / 第二座鎮 | 四項都動資料模型，不先開欄日後全是遷移 | 變體：伺服器發 `seed`，kit.js 由 seed 決定參數，格子只存 `ref`；心情/一句：存 grant 列，拆解後保留；裝飾：`kind=decor`、格子 `{t:'decor',ref}`、免鄰路；第二座鎮：`towns(id, user_id, status)` 主鍵今天就不用 user_id，schema 預留、功能不做 |
| 4 | 設計師 | planner 併入 town 同場景 | 同場景接受，但「planner 降為輸入層」會讓 town.js 兼渲染、手勢、規則成神模組 | `gestures.js`→語意事件→`edit.js`（原 planner：只呼叫 rules 改 store，無 DOM 無 three）→`store`→`town.js` 只渲染；memorycard/onboarding 併入 `ui.js`；前端模組上限 10 個 |
| 5 | 資安 | 速度 >150 km/h 拒絕；accuracy >150 m 拒收 | 高鐵 300 km/h，台北→台中當日打卡被判作弊；市區飄移正是使用者最常卡住處 | 速度門檻 ≥350 km/h 或不做，靠日上限＋`UNIQUE(user,lm,day)`；距離採工程師 `R + min(acc,50)`；速度用前一筆的地標座標算，不需存使用者座標 |
| 6 | 工程師 | 首登只上傳 grid 草稿、庫存歸零 | grid 的 `ref` 指向不存在的 grant → 整張鎮非法；使用者明列「換裝置資料丟」即刪 App 時刻 | 採工程師 1/3 的 `device_id` 匿名帳號：Sprint 1 起打卡即由伺服器驗、記在匿名帳；登入只是 `UPDATE users SET google_sub`，零匯入邏輯 |

## 矛盾點（他人方案彼此衝突，我選邊）
- 工程師「首登庫存歸零」vs 使用者「合併不丟」→ 選匿名帳號綁定（#6），兩邊同時滿足。
- 資安「accuracy >150 m 拒收」vs 使用者「半徑放寬到 200 m」→ 選工程師公式，accuracy 上限交 Cowork 參數表。
- 資安「UNIQUE(user,lm,day)」vs spec「滾動 24 h 冷卻」→ 選自然日（台灣時區），可冪等可索引；冷卻屬可調參數不違定案。
- 使用者「簽到給裝飾」vs spec「通用房 ×1」→ 定案保留通用房；`kind=decor` 先開欄，第一版是否發放交使用者。

## 無條件接受
- 工程師：Pages Functions 同源；`rules.js` 雙端共用；bake + InstancedMesh；Sprint 0 改 3–4 天；grid 256 陣列含 `{t:'part',of}`；`POST /daily`。
- 資安：JWKS 驗證＋HttpOnly session；UUID user id；`/share/:token` opt-in 去識別；不存原始座標；`DELETE /me` + export；body/schema 上限；`idempotency_key`（＝我方 op_id）。
- 設計師：`gestures.js` 三態狀態機；`ui.js` 只讀 state 發 intent；tokens 單一來源同步材質；記憶卡綁單棟。
- 使用者：免登入先玩；打卡兩步內；變體＋第 N 次；分享圖片優先。

## 我願意讓步的自家提案（最多 3 條）
1. 訪客模式「store 雙 adapter + 一次性匯入」→ 改為匿名帳號（#6），store 只剩 remote + localStorage 快取。
2. 離線 pending ops 佇列 → 第一版不做，只留 `op_id` 冪等欄位。
3. `counties.json` point-in-polygon → 採工程師「最近地標 ≤30 km 所屬縣市」。
