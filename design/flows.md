# BuildingYourMemory｜flows.md v1（2026-10-21）

> 依據 `06_最終架構方案_v1.0.md` §3、`BRIEF.md` §2 約束、`schema_v1.md` §6 錯誤碼。畫面原型見 Claude Design 畫布（風格板 + F1/F2/F3/F4/F5/F7）。每個畫面附「玩家此刻在想什麼」。
> 文案鍵以 `ui_strings.json` 為準，本檔只寫鍵名（如 `map.checkin`）。

## 0. 總圖：三 tab × 兩態

```
                 ┌────────────── 底欄三 tab（看態才顯示）──────────────┐
                 │   地圖 F4          城鎮 F1            倉庫 F7       │
                 └────┬───────────────┬──────────────────┬───────────┘
                      │               │                  │
                 打卡成功 → F5 記憶卡 ─┤「放進小鎮」      │ 卡片 →「放」
                                      ▼                  ▼
                              ┌──────────────────────────────┐
                              │ 城鎮・擺放態（底欄變倉庫抽屜）  │
                              │  選道路 → F3 俯視塗/擦         │
                              │  選房型 → F2 幽靈落房          │
                              │  頂部橫幅：擺放中・復原・完成   │
                              └──────────────┬───────────────┘
                                             │「完成」
                                             ▼
                                        F1 城鎮・看
```

規則：
- 兩態互斥，沒有第三態。擺放態只能從 F1「擺放」鈕、F5「放進小鎮」、F7 卡片「放」進入；只能從橫幅「完成」離開（含切 tab：切 tab = 先完成再切）。
- 擺放態底欄 = 倉庫抽屜，第一格永遠是道路；選道路時相機補間到正俯視（F3），選房型時回到等角（F2）。同一場景，沒有獨立 2D 頁。
- 打卡 → 記憶卡 = 1 個轉場（F4 → F5）；記憶卡 → 擺放 = 第 2 個轉場。≤ 2 個畫面達成。

## 1. 畫面

### F0 首啟
- 進入：第一次開啟，`POST /api/session` 回贈品（iron + minnan 各 1 棟 stock、8×8 視窗 r=7 預鋪一條路）。
- 畫面：F1 場景直接顯示（不登入、不要定位、無歡迎頁），上方三步引導卡依序：`onboarding.step1_road` → `step2_house` → `step3_map`，右上 `onboarding.skip`。每步完成才進下一步；第 2 步自動進擺放態並預選第一棟房。
- 出口：第 3 步按 `onboarding.done` → 切到 F4 地圖（此時才第一次取定位，由地圖 tab 規則觸發）。
- 玩家此刻在想：「這是什麼？先隨便點點看」——所以第一步只要在格子上滑一下就算完成。

### F1 城鎮・看
- 畫面：3D 等角場景；頂部擴張卡（`town.unlock_progress`，進度條 = 視窗內非 null 格 / 視窗格數）；右上視角 pill；右下 `town.rotate`（4 向快照循環）+ `town.fit`；左下主鈕 `town.mode_place`（附待放棟數）；底欄三 tab。
- 手勢：單指平移、雙指縮放、點房子 → 迷你記憶卡（F6 入口）。
- 出口：`擺放` → F2/F3；tab → F4/F7；達 70% → 解鎖儀式（`town.unlock_ceremony`，900 ms，reduced-motion 時只 toast）。
- 玩家此刻在想：「我的鎮長什麼樣了？還差幾棟會變大？」——進度卡永遠在最上面。

### F2 城鎮・擺放（房型）
- 進入：F1 擺放鈕 / F5 放進小鎮 / F7 卡片「放」。底欄升起倉庫抽屜（220 ms）；三 tab 隱藏；頂部橫幅 `town.banner_placing`・`town.undo`・`town.done`。
- 畫面：抽屜第一格 `town.tool_road`，之後房型卡片依 `inventory.sort_date` / `sort_county` chips；選中卡片 = accent 框 + tint 底。場景中幽靈房跟著單指；可放 = `ok` 綠格，不可放 = `danger` 紅框 + 45° 斜線 + 震動 10 ms（三重編碼）。
- 回饋：不可放時 toast 一句：`town.cell_locked` / `cell_occupied` / `cell_no_road`。
- 出口：`完成` → F1（存檔，2 s debounce 同步 `PUT /town`）；`復原` 單步，最多 20 步。
- 玩家此刻在想：「放這裡可以嗎？」——綠 / 紅在手指下面，不用看文字。

### F3 城鎮・俯視畫路
- 進入：擺放態選抽屜第一格「道路」→ 相機 320 ms 補間到正俯視，格線變清楚；橫幅文字改「畫路中・單指塗 / 擦」。
- 畫面：下方兩鍵 `town.tool_road`（塗）/ `town.tool_erase`（擦）；塗 = 單指滑過空格即鋪；擦 = 滑過路格即清。鎖定格霧色不可點。
- 拒絕：擦掉會讓相鄰房子沒路 → 該格紅框 + 斜線 + 震動 + toast `town.road_orphan`，不執行。
- 出口：選抽屜任一房型 → 相機回等角（F2）；`完成` → F1。
- 玩家此刻在想：「路要接到哪？」——俯視時路是深灰、空地是淺綠，一眼看出斷點。

### F4 地圖
- 進入：切到地圖 tab 時 `getCurrentPosition` 一次；當日首次成功 → 自動 `POST /daily` → toast `map.daily_toast_house` 或 `daily_toast_shard`。
- 畫面：Leaflet 底圖 + 使用者點 + 50 m 虛線圈；上方位置 pill + 「今天 n / 40」；底板 `map.nearby_title` 最近 3 張地標卡（名稱、`map.preview_house`、距離 m、`map.distance_walk`）；第 1 張在範圍內時 accent 框；大鈕三態：亮 `map.checkin` / 灰 `map.checkin_near` / 外框 `map.checkin_offline`；鈕下一行 `privacy.checkin_hint`。
- 失敗：按下後伺服器回錯誤碼 → toast `error.*`，鈕回到對應態；`location_denied` 時卡片區換成 `map.location_denied` + `location_denied_help`。
- 出口：打卡成功 → F5；tab → F1/F7。
- 玩家此刻在想：「我到了嗎？按下去會不會白跑？」——距離數字最大、按鈕只有一個，不到範圍就直接寫還差幾公尺。

### F5 記憶卡（打卡成功）
- 進入：F4 打卡成功；DOM 底板從下升起（220 ms）蓋在地圖上，不換頁。
- 畫面：`打卡成功・memory.visit_n` + 日期時間；地標名（display 字體）；房型 PNG + 名稱 + 變體；`memory.mood_label` 五鍵（可不選）；`memory.note_placeholder` 單行輸入 + `note_counter`；`memory.skip` 與 `memory.save` 同大同列；主鈕 `memory.cta_place`。
- 行為：略過 / 存 都把房子留在倉庫並關卡（存會 `PUT /grant/:id/memory`）；放進小鎮 = 存 + 直入 F2 並預選這棟。
- 第一次打卡成功後、關卡時才出現 F9 登入提示（可關）。
- 玩家此刻在想：「拿到了！先放還是先寫？」——三個出口都在拇指下面，寫字永遠可跳過。

### F6 記憶卡（回看）
- 進入：F1 點場景中的房子、F7 點卡片。
- 畫面：同 F5 版面但唯讀（心情、一句話灰字顯示，未填則隱藏該段）；底部 `memory.rotate`（已放的）/ `memory.dismantle`（在倉庫的）；標題 `memory.title_view`。
- 玩家此刻在想：「那天我寫了什麼？」——先看字，再看操作。

### F7 倉庫
- 畫面：標題 + 待放 / 已放棟數；右上 `inventory.shards` pill + `inventory.dismantle` 鈕；chips `sort_date` / `sort_county`（= 時間軸）；卡片列：房型縮圖、名稱、縣市 + 日期 chips、來源地標、數量或座標、待放 / 已放。
- 拆解模式：按 `拆解` → 僅 stock 卡片出現勾選框，已放卡片淡出 45%；底部列 `common.cancel` + 紅鈕 `inventory.dismantle_confirm`（n=0 時灰）；確認後 `POST /dismantle` → 碎片 +n，記憶卡保留。
- 出口：點待放卡片「放」→ F2 並預選；點已放卡片 → F6。
- 玩家此刻在想：「我去過哪裡、拿了什麼？」——日期排序就是旅程時間軸。

### F8 409 衝突
- 進入：只在看態、`PUT /town` 回 `conflict{rev, grid}` 時彈對話（擺放態中先完成再處理）。
- 畫面：`conflict.title`、`conflict.body`；兩張 Canvas 2D 縮圖並排，上標 `conflict.this_device` / `conflict.other_device`；預設選較新（伺服器版）；按鈕 `conflict.keep_newer`（主）/ `keep_this`（次）；確認後 toast `conflict.draft_saved`。
- 玩家此刻在想：「哪個是我剛改的？」——縮圖加「剛才」字樣比時間戳好認。

### F9 登入提示
- 進入：第一次打卡成功關卡後、換裝置開啟、或按分享時。永遠是可關的底板，不擋場景。
- 畫面：`login.prompt_title`、`login.prompt_body`、`login.google`（主）、`login.later`（次）。綁定成功 toast `login.merged`。
- 玩家此刻在想：「不想註冊」——所以標題講好處，不講帳號。

### F10 分享面板（Sprint 3）
- 畫面：預覽圖（主 canvas `toBlob`，預設只含小鎮 + 棟數）；三個勾選 `share.toggle_county` / `toggle_date` / `toggle_names` 預設關，改了預覽即時更新；主鈕 `share.share`（Web Share）。
- 玩家此刻在想：「不想露出我住哪」——預設最少，要露出是自己勾的。

### F11 關於 / 隱私
- 進入：地圖 tab 右上「i」或倉庫底部連結。
- 畫面：`privacy.about_title`；資料來源 `about_source` + `about_license`；`privacy.checkin_hint` 展開版（不存座標、只存地標名與伺服器時間）；`privacy.export`；`privacy.delete_account` → 二步：輸入框 + `privacy.delete_confirm`。
- 玩家此刻在想：「你們到底存了我什麼？」——一句話講完，匯出鈕在旁邊證明。

### F12 失敗 toast 群
- 統一樣式：深墨底、紙色字、13 px、底欄上方 12 px、3 s 自動消失、可滑掉；一次只顯示一則，新則取代舊則。
- 九個錯誤碼各一句：`error.too_far` … `error.offline`（見 ui_strings）；`unauthorized` 只在重連失敗 > 3 s 才顯示。
- 規則：每句有數值或下一步；沒有「錯誤」「失敗」「代碼」字眼；不出現無說明的灰按鈕——灰鈕上一定寫原因（`map.checkin_near` / `checkin_offline`）。

## 2. 驗收對照
| 約束 | 對應 |
|---|---|
| 三 tab × 兩態，無獨立 2D 頁 | §0；F3 = 同場景相機俯視 |
| 打卡 → 記憶卡 ≤ 2 畫面 | F4 → F5（1 轉場） |
| 心情 + 一句話同畫面，略過 = 存同大 | F5 |
| 首啟不登入不定位；登入在第一次打卡後 | F0、F9 |
| 每個失敗一句人話 + 數值 | F12、ui_strings.error |
| 觸控 ≥ 44、對比 ≥ 4.5、三重編碼、reduced-motion | tokens.css、F2/F3、gestures.md §4 |
| 記憶卡與面板 DOM 疊層、PNG 預覽 | F5/F6/F7 |
| 4 向快照、雙指永遠是相機 | F1、gestures.md §1 |
| 分享圖預設只含小鎮 + 棟數 | F10 |
