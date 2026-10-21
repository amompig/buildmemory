# BuildingYourMemory｜Claude Design 交接包（2026-10-21）

> 本資料夾是 Cowork 交給 Claude Design 的輸入。Design 的產出清單與驗收在 `docs/planning/08_ClaudeDesign交接.md`；本檔補上它需要的素材與骨架。

## 1. 一段話給 Design
手機優先的 Web 小遊戲：到真實地標 GPS 打卡拿到一棟建築，在 16×16 方格小鎮上畫路、放房，蓋出記憶中的紀念小鎮。3D 建築全由程式生成（見 `samples/A–D.png`），所以**質感靠色票與 UI 撐**。風格方向：暖紙感低飽和 + 單一強調色，像記帳城市的親切，不追求紀念碑谷的精雕。

## 2. 不可違反的約束（來自五方審查定案）
1. 三個 tab（地圖 / 城鎮 / 倉庫）× 兩態（看 / 擺放）；規劃 = 相機俯視 + 筆刷，**沒有獨立 2D 頁**
2. 按下打卡到看到記憶卡 **≤ 2 個畫面**；心情 5 鍵與一句話放在記憶卡同一畫面，「略過」與「存」同大
3. 首啟不登入、不先要定位；定位說明只有打卡鈕旁一句話 + 系統原生提示；登入在第一次打卡成功後才提示
4. 每個失敗都有一句人話 + 數值（`ui_strings` 以錯誤碼為鍵），不出現裸錯誤碼或無說明的灰按鈕
5. 觸控 ≥ 44 px、對比 ≥ 4.5:1、非法格用紅框 + 斜線 + 震動三重編碼、`prefers-reduced-motion` 關所有補間
6. 記憶卡與所有面板是 DOM 疊層；房型預覽用預渲 PNG，不開第二個 WebGL
7. 4 向相機快照（無自由旋轉）；擺放中雙指永遠是相機
8. 分享圖預設只含小鎮 + 棟數；縣市 / 日期 / 地標名三個勾選預設關

## 3. 畫面清單（flows.md 要涵蓋）
| # | 畫面 / 狀態 | 關鍵元素 |
|---|---|---|
| F0 | 首啟 | 空地 + 預鋪一條路 + 2 棟在倉庫；三步引導（塗路 → 放房 → 去地圖） |
| F1 | 城鎮・看 | 底欄三 tab；右下 4 向 + fit 按鈕；擴張進度條（70%） |
| F2 | 城鎮・擺放 | 底欄倉庫抽屜（第一格「道路」，之後房型卡片依日期 + 縣市 chips）；幽靈格綠 / 紅；頂部橫幅「擺放中・復原・完成」 |
| F3 | 城鎮・俯視畫路 | 同場景相機補間到正俯視；單指塗 / 擦；orphan 拒絕回饋 |
| F4 | 地圖 | Leaflet 底圖；最近 3 個地標卡（距離、步行分鐘、預告房型）；打卡大鈕（亮 / 「再走約 30 m」/ 「有訊號再按」）；鈕旁隱私一句話 |
| F5 | 記憶卡（打卡成功） | 地標名、日期、第 N 次、房型 PNG、心情 5 鍵、一句話輸入、「略過」=「存」、CTA「放進小鎮」 |
| F6 | 記憶卡（回看） | 同 F5 唯讀；拆解 / 旋轉入口 |
| F7 | 倉庫 | 房型卡片列表（日期 + 縣市 chips 排序）、碎片計數、拆解多選 |
| F8 | 409 衝突 | 兩張 Canvas 2D 縮圖 + 「這支手機・剛才」「另一台・10/20 21:30」，預設較新 |
| F9 | 登入提示 | 第一次打卡成功後 / 想分享時；可關 |
| F10 | 分享面板 | 預覽圖；三個勾選預設關；Web Share 鈕 |
| F11 | 關於 / 隱私 | 資料來源與授權標示、隱私聲明、匯出、刪帳（兩步確認） |
| F12 | 失敗 toast 群 | 9 個錯誤碼各一句（見 ui_strings 骨架） |

## 4. 給 Design 的素材
- `samples/A_presets.png … D_night.png`：程式生成現況；`samples/kit.js` 的 `PAL` 是現用色
- `data/houses.json`：3 房型各 3–4 組 wall/roof/door/accent，可整組重配色，但每房型需 ≥ 3 組且第 0 組為「原色」
- `design/palette.seed.json`：tokens 起點與 `three` 區塊格式
- `design/ui_strings.template.json`：所有鍵已列好，填值即可
- `docs/schema_v1.md` §6：錯誤碼與參數

## 5. 交付格式
`design/flows.md`、`design/tokens.css`、`design/palette.json`、`design/gestures.md`（含動效一節）、`design/ui_strings.json`、`design/components.html`（無 three、純 HTML/CSS 靜態原型，可直接開）、`design/memorycard_storyboard.md`、`design/icons/*.svg`（單色、currentColor）、PWA 圖示 192/512 + maskable。

## 6. 給 Claude Design 的第一句話
> 讀 `design/BRIEF.md` 與 `docs/planning/08_ClaudeDesign交接.md`。先交 Sprint 0 四件：`flows.md`（涵蓋 F0–F12）、`tokens.css` + `palette.json`（從 `palette.seed.json` 出發）、`gestures.md`、`ui_strings.json`（填滿 `ui_strings.template.json` 所有鍵）。每個畫面附一句「玩家此刻在想什麼」。
