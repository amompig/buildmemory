# design/renderer — blueprint v2.2 的幾何定義（參考用，不在遊戲裡執行）

`iso_renderer.js` 是畫 `docs/review/*.png` 與 Design 畫布兩塊板的同一份程式（從 `Landmarks.dc.html` / `Houses.dc.html` 抽出，`renderVals()` 共用）。kit.js 的 3D 幾何以這裡的算法為準；下表是每個 blueprint 欄位在程式裡的實際換算，格單位（cell）= 一格 footprint。

## 座標與單位

| 名稱 | 程式 | 意義 |
|---|---|---|
| 格 → 世界 | `c`（東 +）、`r`（南 +）、`z`（上 +） | block 的 `at:[c,r]`、`w`、`d`、`h`、`z` 全是格 |
| 2D 投影（只在參考圖） | `pt(c,r,z) = [ox + (c−r)·HW, oy + (c+r)·HH − z]`，HW 24·zoom、HH 12·zoom、FPX = 22·zoom·vScale px / 格 | 3D 不需要；`vScale` 只是參考圖的垂直誇張倍率，**kit.js 用 1** |
| 南面 / 東面 | S 面 = r+d 那面（lit, wall 色）；E 面 = c+w 那面（side = wall × 0.86） | 遊戲三面光：palette.json `three.shade.side_wall_mul` 0.88 可取代 0.86 |
| 疊放 | `on:<id>` → 子 block 原點 = 父 block 原點 + at，底 = 父頂；`z` 再加 | 兩者可同時用 |

## 牆體

| 欄位 | 算法 |
|---|---|
| `h` 或 `floors×floorH` | 牆高（格） |
| `sBot` / `sTop` | 底 / 頂的平面縮放（以 footprint 中心為基準）；中間高度線性內插 `s(z) = sBot + (sTop−sBot)·(z−z0)/h`。101 基座 1→0.7，紀念堂牆 1→0.9 |
| `segments: n` | 同一 block 疊 n 節，每節 `on` 前一節；之後引用此 id 的 block 疊在最後一節上 |
| `shape: 'oct'` | 平面八角：四邊各取 30% / 70% 點（只影響屋頂與頂面；牆仍是四面） |
| `eave2`（0–1） | 重簷的下層簷高度比：在 `z0 + h·eave2` 處插一圈簷（紀念堂、圓山） |
| 轉折線 | 前垂直角線 1.2 px、顏色 side × 0.62；3D 對應：`EdgesGeometry` 閾值 60°、1 px、ink 60% |
| 簷下 AO | 出簷 `eave > 1` 時，牆頂往下 `min(6, 2 + (eave−1)·14)` px 的暗帶（wall × 0.78） |

## 屋頂（`roof`）

共同：`rh = 0.5 · min(w,d) · roofH · 1.1`（格）＝「45° 坡越過半個短邊」的高度 × `roofH`。`eave` 是屋頂底面相對牆頂面的縮放（1.3 = 外推 15% 的短邊 / 長邊各半）。屋脊預設沿長邊，`ridge:'c'|'d'` 可強制。

| roof | 構成 |
|---|---|
| `flat` | 頂面一片；有 `sTop` 時頂面縮放 |
| `hip` | 四坡交於一條脊：脊兩端內縮 `min(w,d)/2/max(w,d)` × 長邊；正方形平面 → 攢尖一點 |
| `gable` | 兩坡 + 兩端三角山牆（牆色）；`ridge:'d'` 時山牆面南（博物館山牆、街屋 parapet） |
| `mansard` | 斜裙從 `eave` 收到 `eave·0.72`、高 `rh·0.7`，上面平頂 |
| `hip2`（重簷） | 下裙 `eave → eave·0.6`、高 `rh·0.45`；牆帶高 `rh·0.3`（牆色）；上坡 `hip` 底 `eave·0.78`、高 `rh·0.8`；頂端寶頂 |
| `hip2` + `oct` | 同上但用八角 frustum：下裙 `eave → eave·0.62`，上坡 `eave·0.78 → eave·0.1` |
| `swallowtail` | `gable` 高 `rh·0.9` + 脊兩端翹起的燕尾（accent）+ 脊線（roof × 0.7） |
| `swallowtail2` | 先一圈下裙 `eave → eave·0.62` 高 `rh·0.4`、牆帶 `rh·0.25`，再以 `eave·0.8` 畫 `swallowtail` |
| `dome` | 鼓座 = 頂面縮放 0.8 的兩層；穹頂直徑 `(w+d)/2 · 1.15 · sTop · domeScale`（格 → 乘 HW）；頂尖 accent |
| `spire` | 細柱，高 = `h`；用 `wall` 色 |
| 屋頂分色 | 南坡 roof、東坡 roof × 0.8、北／西坡 roof × 0.9、西坡（ridge d 時）roof × 1.06；簷口板 2.5 px roof × 0.7 |

## 開口（畫在牆面平面內）

| 欄位 | 算法 |
|---|---|
| `window` / `wstyle` | `rect` 0.14×0.16、`arch` 0.14×0.20（圓頭半徑 = 半寬）、`round` ⌀0.16、`lattice` 0.12² + 十字中框、`shoji` rect 暖白 + 中框、`strip` 0.62×0.09、`none` |
| 排列 | 一層一排：`rows = winRows ‖ bands ‖ floors`，窗心 z = `z0 + (row + 0.55)·h/rows`；每面欄數 `n = min(windowCols, floor(faceLen/0.26))`，`strip` 用 `floor(faceLen/0.9)`；窗心 t = `(i+0.5)/n` |
| 門面一樓 | 有 `door` 或 `arch` 的南面一樓：中央一欄不開窗；`n ≤ 2` 整排不開 |
| 深度 | 框 = 牆色 × 0.6；側壁 0.03 格，南面窗的側壁用 side 色、東面窗的側壁用 wall 色（側壁朝向的面）；玻璃 `winColor` ‖ 日景 #5F6E7B（東面 × 0.88）、shoji #F3E7C8、lattice #4A3B30 |
| `winFaces:'S'` | 只開南面 |
| `door` | 南面一樓中央，寬 0.16 格、高 `min(0.8h, 0.26)`；`dstyle:'arch'` 圓頭；有 `arch` 時不另畫門 |
| `arch:[t, w, h, through]` | 南面挖入的拱洞：中心 t（0–1）、寬 w、高 h（都是面的比例）；外框 wall × 0.42，內洞 wall × 0.3；`through` 時內洞用地面色（北門可看穿） |
| `bands: n` | 每層一條 1.5 px accent 橫帶（n = 層數） |
| `cols` | 舊欄位：在南面畫 n 根 2 px 柱（圓山）；新作法是 0.06 格的實體 block（`columns()` helper） |
| `medallion` | 每面一枚古錢環：圓心 0.86h、半徑 0.17 格；外環 #4F5B6B、內 wall × 1.05、中孔 #4F5B6B |
| `lantern` | 南面 0.7h、t = 0.12 / 0.88 兩盞 6×8 px #C7453B |

## 繪製次序（kit.js 用 z-buffer 就不需要，但部件層級要一致）

1. 地面板（`h ≤ 0.03` 且無 `z`）永遠最先。
2. 出簷屋頂是**獨立一層**：box 從簷口起算，所有低於簷口的量體先畫、屋頂再蓋。
3. 兩條硬規則：本體 → 自己的屋頂；父量體與其屋頂 → 疊上去的子量體（及子量體的屋頂）。
4. 其餘用分離軸（整個在西 / 北 / 下方 → 在後面），相交時比「朝觀者的延伸」（共用欄位比南緣、共用列比東緣）；只對畫面重疊的部件建邊。

驗證腳本在 `scripts/design_check/`。
