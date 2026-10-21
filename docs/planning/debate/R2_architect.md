# 架構師 R2 定案

## A. 回應詰問
| 來自 | 詰問摘要 | 接受/部分/拒絕 | 理由 |
|---|---|---|---|
| 工程師 #1、資安 #2、設計師（矛盾點） | 離線 pending ops 佇列 → 第一版必須在線 | 接受 | 客端時間與落地座標兩者都是後門；只留 `op_id` 冪等欄 |
| 使用者（矛盾點） | 離線排隊「只記錄不拒」用當時客端時間 | 拒絕 | 伺服器依客端時間發 grant 即後門；無訊號提示「有訊號再按」，鎮仍可看快取版 |
| 資安 #1 | 匯入帳本 → `device_id` 伺服器簽發 HMAC/HttpOnly，`/claim` 只綁定，未綁定 30 天清 | 部分接受 | 綁定全收；30 天清理需 cron，第一版不做——未綁定資料無座標，風險低，第二階段加一行 scheduled SQL |
| 工程師 #6、使用者 #6 | Cowork 先定 Schema v1 → Code 先打通 3 房型再抽 | 部分接受 | 藍圖/houses schema 從實物抽；但 grid 256 格、API body、錯誤碼 enum 由 Cowork 先定一頁，guard 與 ui_strings 都依賴它 |
| 使用者 #6 | counties.json、分縣懶載、blueprints 表、執行期 Schema 驗證 | 部分接受 | 前三項砍；Schema 驗證只在伺服器 API 入口做（資安必要），客端不做 |
| 設計師 #4 | 交接檔加 gestures.md、motion.json、components.html、palette three 區塊、錯誤碼 enum | 部分接受 | 除 motion.json 外全收；第一版動效少，寫進 gestures.md 一節，少一檔 |
| 設計師 #6、使用者 #4、工程師（矛盾點） | 三 tab＋模式取代四頁；409 先拉伺服器版再編輯；地標整檔內嵌；可用性實測歸 Cowork | 接受 | 同一 grid 同一場景，無第二套座標；整檔 < 1 MB 一個 `data_version` |

## B. 投票
1. 兩態：`edit.js` 只收「塗路／落房」兩種 intent，狀態機少一態。
2. 30 次／200 m：容差 `R+min(acc,50)` 已封頂，200 m 以上拒收訊息反而清楚。
3. 錯誤碼＋數值：`rules.js` 回 `{code, dist|until|retry_after}`，客端預檢與伺服器拒絕同一函式，ui_strings 以 code 為鍵。
4. Code 先 3 房型；API/grid/錯誤碼 schema 由 Cowork 先定（見 A）。
5. 第一版不做。
6. 通用房 ×1 色票變體、上限 3；到頂直接以 `dismantled` 入帳＝1 碎片，不加型別不加規則。
7. 接受；草稿只在 localStorage，縮圖用 Canvas 2D 畫 grid。
8. 接受；mood enum、note 存 grant 列、伺服器正規化。
9. 保留 70%＋進度條：`rules.unlock(grid)` 純函式，無伺服器計數依賴。
10. 2 棟＋預鋪路，兩棟不同房型，由伺服器發給 `device_id`。

## C. 底線與提醒
1. **依賴單向**：views → `store.js` → `shared/rules.js`；rules 無 three/DOM，Worker import 同一檔；違反者不合併。
2. **單一帳本**：`grants(kind,state,…)` 每筆一列，格子只存 `ref` 與 `sys:`/`u:` 命名空間 id；不再出現 count 表或第二張物品表。
3. **所有權與上限**：內容歸靜態 JSON（`data_version`）、狀態歸 D1（`rev`）、localStorage 只做快取；前端模組 ≤10、後端 3 檔、無 cron。

提醒整合者：第二階段每項擴充（part、decor、`u:` 藍圖、第二座鎮、送房）都必須是「加一個 kind 或加一列」，而非「改一張表」——現在定欄位時用這句檢驗。
