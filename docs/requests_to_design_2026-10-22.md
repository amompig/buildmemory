# 給 Design 的需求（Code → Design，2026-10-22）

> 前提（使用者已定）：不買 TDAL / 商用模型；12 地標 + 一般房型全部走 blueprint v2.2，由 Code 寫 kit.js 轉成 Three.js 3D。

## A. 會卡住 kit.js 的（請優先）

1. **渲染器原始碼**：`docs/review/*.png` 那份 2D 斜角畫布的程式（JS/HTML）請放進 `design/renderer/`。
   - 用途：只當幾何定義的參考，不在遊戲裡執行。
   - 原因：blueprint 欄位的實際算法目前只寫在文字裡。這些包括 `roofH` 45° 倍率怎麼換算、`eave` / `eave2` 的出簷、`hip2` / `mansard` / `swallowtail` 的斜面構成、`arch` 的弧線取樣、`sBot` / `sTop` 收分、`segments`、`domeScale`、窗的 (t, z) 排列與 `faceLen / 0.26` 上限。沒有程式，我只能照文字重寫，3D 結果會和預覽圖不一樣。
2. **色票只能有一份真值**：`palette.json three.house` 與 `houses_tw10.json` 各自的 `palettes` 不一致。例：`sys:iron` 的 roof 一個是 `#8A8F95`，一個是 `#B9B5A8`。
   - 請指定以哪一份為準，另一份刪掉或改成引用。
   - 地標的 `palettes` 目前只寫在 `landmarks_tpe12.json`，也請一併說明。
3. **房型清單定案**：
   - `houses_tw10` 沒有 `sys:minnan`。請確認是刪除，還是由 `sys:sanheyuan` 取代。
   - `sys:shophouse` 從 1×1 改成 3×1，請確認。
   - 確認後 `palette.json` 的房型數要和清單一致，這是建置檢查。

## B. 需要定義，否則我得自己猜

4. **一般房型怎麼取得**：10 型裡只有 `sys:iron` 標 `daily: true`。其餘 9 型（公寓、大樓、工廠……）玩家怎麼拿到？
   - 地標打卡現在給的是該地標自己的 `lm:*` 房型。
   - 這屬於遊戲規則，可能要和使用者一起定（flows.md 目前沒寫）。
5. **3D 的線條與驗收**：文件裡的線寬（1.2 px、2.5 px）是 2D 螢幕像素，3D 會隨縮放變。我的做法如下，請 Design 確認可以接受：
   - 主轉折線用 `EdgesGeometry`（≥ 60°）、固定 1 px、ink 60%。
   - 簷口與雨遮靠 AO 帶，窗框不描邊。
   - 驗收：同視角的純色剪影 PNG 對照 `docs/review` 的剪影。
6. **倉庫格與底板的縮圖**：c-slot 和 F6 底板要用房屋小圖。請在以下兩種做法中選一種：
   - (a) Design 從畫布輸出每型 PNG（指定尺寸、透明背景），放 `assets/previews/`；
   - (b) Code 用 kit.js 預烘，輸出後交 Design 審。

## C. 小事

7. `houses_tw10.json _meta.note` 的「v2.2：屋頂改為斜面…」重複貼了 3 次。
8. 請在 `ui_strings.json` 補上這些 key。Code 目前用的是暫代文字（在 `src/ui.js` 的 FALLBACK）：
   - `town.progress_title` / `town.road_unlimited` / `town.drawer_title`
   - `login.done` / `login.failed` / `login.unavailable`
   - `map.today` / `map.checkin_ok` / `map.range` / `map.relocate`
   - `memory.variant_origin` / `memory.variant_n` / `memory.footprint` / `memory.note_label` / `memory.optional`
9. **地圖配色**（使用者若選 MapLibre 方案才需要）：請在 `palette.json` 加 `map` 區塊，內容為街廓、道路、公園、水、建物、背景色。目前我是照 F4 原型取色暫代。
