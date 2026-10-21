# 工程師 詰問 R1

## 詰問（最多 6 條，依重要性排序）
| # | 對象 | 被詰問的提案 | 問題 | 我的替代方案 |
|---|---|---|---|---|
| 1 | 架構師 | 離線 pending ops 佇列、客端時間 24 h 冪等重放 | 重放的座標與時間全由客端供給，伺服器驗不了，等於開後門；與 rev 樂觀鎖互斥；一人多養一套 op log | 第一版打卡必須在線（圖磚本就要網路）；無訊號時提示「有訊號再按」；只快取 `GET /me` 供離線看鎮 |
| 2 | 資安 | 相鄰打卡速度 > 150 km/h 拒絕 | 高鐵 300 km/h：台北站打卡、1 h 後台中站必被誤殺 | 刪速度檢查；改 `UNIQUE(user,landmark,tw_day)` + 日上限 20 + 最小間隔 60 s；冷卻改台灣曆日 |
| 3 | 使用者 | 第 2 棟起用藍圖參數抖動出屋頂/招牌/形狀變體 | InstancedMesh 前提是同一幾何；結構變體每種多一份幾何與 draw call，150 預算立刻破 | 第一版只做 `instanceColor` 色票抖動（3–4 組）+ 記憶卡「第 N 次」；結構變體 = 獨立 preset id，第二階段做 |
| 4 | UI 設計師 | tokens 同步到 Three.js 材質色、日夜兩套 | 我方 `bake()` 把顏色烘成頂點色，烘完材質色改不動，兩案相撞 | 頂點色存調色盤索引，或啟動時依 palette.json 重烘（8 房型 < 50 ms）；日夜只動燈光/霧/色調映射 |
| 5 | UI 設計師 | 記憶卡內 3D 轉台預覽重用 kit.js | 另開 canvas = 第二個 WebGL context，iOS Safari 易黑屏 | 單一 renderer：`setScissor` 畫在主 canvas 卡片區，或啟動時每房型預渲 1 張 PNG |
| 6 | 架構師 | Cowork 先定藍圖 JSON Schema v1，kit.js 只解譯 houses.json | kit.js 尚無 8 房型，先寫 schema 是憑空定格式，必改兩次 | Code 先用 `PRESETS` 打通 3 房型，Cowork 再從實物抽 schema v1 與 houses.json；`sys:` 命名空間現在就用 |

## 矛盾點（他人方案彼此衝突，我選邊）
- 資安：checkins 90 天/1 年後彙整為計數；使用者：翻記憶卡、第 N 次、時間軸 → 選使用者：座標已不存，`(landmark_id, at, mood, note)` 是遊戲內容，保存至刪帳；刪 cron 彙整。
- 使用者：免登入先玩；資安：user_id 只取自 session、dev 資料永不信；架構師：匯入三種分歧 → 選「匿名 `device_id` cookie 也是伺服器帳本」：送房、簽到、打卡全由伺服器發 grant 給 device_id，登入時 `POST /claim` 改掛 user_id；本機帳本可信度問題消失。
- 架構師：landmarks 分縣懶載；我方：Worker build 整檔內嵌 → 選整檔：數千筆 < 1 MB，同一 `data_version`。
- 設計師：4 向快照 vs 自由旋轉 → 選 4 向：排序、吸附、2×2 旋轉全簡化。
- 可用性實測 Design（架構師 1/3）vs Cowork（設計師 3/3）→ Cowork。

## 無條件接受
- 資安：JWKS 驗 id_token、HttpOnly session、檢 Origin；/share 隨機 token、去 lm/at；不存原始座標；body ≤ 32 KB + schema；授權 meta；CSP/HSTS 走 Pages `_headers`。
- 架構師：通用帳本 `items`（每筆一列 + state）取代 inventory/shards；格子存 `sys:<id>`；`shared/rules.js` 雙端共用；store.js 雙 adapter；三方交接介面。
- UI 設計師：規劃併入同一 Three.js 場景（道路也走 InstancedMesh 池）；gestures.js 三態；DOM 疊層；相機 fit + 幽靈格放大；reduced-motion 關後製。
- 使用者：首啟送房 + 預鋪路；心情 + 一句話存 grant 列（天氣第一版只存時段）；簽到改裝飾件 + 鐵窗厝上限；擴張改打卡數/新縣市；精選半徑 150–200 m；出圖用主 canvas `toBlob` + Web Share。

## 我願意讓步的自家提案
1. 縣市判定：放棄「最近地標 ≤ 30 km」，改架構師 bbox 粗判（同放 rules.js）。
2. Sprint 1 cookie `device_id` 從可選升為必做。
3. 放棄獨立 planner.js Canvas 2D，planner 降為塗格輸入層。
