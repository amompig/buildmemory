# Design 回覆 Code 需求（Design → Code，2026-10-22）

> 對應 `docs/requests_to_design_2026-10-22.md` 逐條。前提不變：不買模型，12 地標 + 10 一般房型全部走 blueprint v2.2 → kit.js。

## A. 會卡住 kit.js 的

### 1. 渲染器原始碼 → `design/renderer/` ✅

| 檔案 | 內容 |
|---|---|
| `design/renderer/iso_renderer.js` | 單檔、可 `node` 執行、可 `require`。`LandmarksBoard` / `HousesBoard` 兩份 `data()`，`renderVals()` 共用。`render('landmarks'|'houses')` 回每棟的 parts（含繪製次序、每個 entry 的 3D box） |
| `design/renderer/README.md` | **每個 blueprint 欄位的實際算法**：`rh = 0.5·min(w,d)·roofH·1.1`、`eave` 是屋頂底面相對牆頂的縮放、`hip2` / `mansard` / `swallowtail` 的分段比例、`arch` 弧線 7 點取樣、`sBot/sTop` 線性內插、`segments`、`domeScale`、窗的 (t, z) 排列與 `faceLen/0.26`、門面一樓規則、側壁方向、繪製次序四條 |
| `design/renderer/Landmarks.dc.html` / `Houses.dc.html` | 畫布原檔（含 HTML 模板），備查 |
| `scripts/design_check/` | `verify_order.js`（兩條硬規則）、`verify_edges.js`（循環被打斷處）、`preview.js` + `shot2.js`（截圖） |

**給 kit.js 的注意**：`vScale` / `zoom` 只是參考圖的誇張倍率，3D 一律 1；`cols:true` 是舊欄位（只剩圓山主體用），新作法柱子是 0.06 格實體 block（id 前綴 `pc/mc/fc/ac/cp`）。

### 2. 色票單一真值 ✅

決定：**`data/houses_tw10.json` 的 `palettes[]` 為準**，`palette.json three.house` 改成引用（`_source` + `_ids` 清單），不再重複列色。地標同理：`three.landmark._source = data/landmarks_tpe12.json#landmarks[].palettes`，地標無變體。

`sys:iron` 的 roof 以 houses_tw10 的 `#B9B5A8`（混凝土平頂）為準；舊的 `#8A8F95` 是 houses.json v1 的值，作廢。

建置檢查：`palette.json three.house._ids` 必須等於 houses_tw10 的 id 清單（10 型），順序一致。

### 3. 房型清單定案 ✅

| 項目 | 定案 |
|---|---|
| `sys:minnan` | **刪除**，由 `sys:sanheyuan`（三合院，3×2）取代；閩南紅磚語彙都在三合院與林安泰 |
| `sys:shophouse` | **確認 3×1**（三連棟騎樓）；1×1 的單棟街屋留給地標 `lm:TPE-f09` 迪化街（1×2） |
| `data/houses.json` | 由 `houses_tw10.json` 取代（`_meta.supersedes` 已寫明）；Code 切換後刪 houses.json |
| 房型數 | 10：iron, apartment, tilehighrise, shophouse, factory, sanheyuan, temple, jpdorm, village, farmhouse |

## B. 需要定義的

### 4. 一般房型怎麼取得 — 提案，待使用者裁決一點

依企畫基準 v0.1 §53 與 06 最終架構：

| 來源 | 給什麼 | 狀態 |
|---|---|---|
| 每日簽到 `/daily` | `sys:iron` ×1（持有 ≤ 3 → 碎片） | 既有規則，不動 |
| 精選地標打卡（12 棟） | 該地標 `lm:*` | 既有 |
| **非精選地標打卡**（文資局全量） | `data/type_map.csv`：文資局「類型 / 用途」關鍵字 → `sys:*`：寺廟 / 宮 / 祠 → `sys:temple`；宅第 / 古厝 / 三合院 → `sys:sanheyuan`；日式宿舍 / 官舍 → `sys:jpdorm`；街屋 / 商店 → `sys:shophouse`；眷村 → `sys:village`；工廠 / 倉庫 / 糖廠 / 菸廠 → `sys:factory`；農舍 / 穀倉 → `sys:farmhouse`；對不到 → **該縣市通用房型** | 提案：這就是其餘 9 型的主要來源 |
| 縣市通用房型 | 台北 / 新北 / 桃園 / 台中 / 高雄 → `sys:apartment`；其餘縣市 → `sys:farmhouse`；（可選）六都市中心 ≥ 12 層的 `sys:tilehighrise` 給打卡時 `acc ≤ 30 m` 的加成 | 提案 |

**要使用者決定的一點**：`sys:apartment` / `sys:tilehighrise` 這兩型沒有對應的文資類型，只能當「縣市通用」或「每日簽到輪替」。建議每日簽到改為縣市輪替（台北 iron → apartment → tilehighrise 三型輪流，持有各 ≤ 3），這會動到 `rules_truth_table.md §6` 的 `DAILY_HOUSE` 常數。未決前 Code 照現狀（iron）實作即可。

### 5. 3D 線條與驗收 ✅ 接受

- 主轉折線 `EdgesGeometry` 閾值 60°、固定 1 px、ink 60% → 已寫進 `palette.json three.edges`。
- 簷口與雨遮靠 AO 帶（wall × 0.78，寬度隨簷深）、窗框不描邊；側牆 0.86（`three.shade.side_wall_mul` 已從 0.88 改 0.86 與參考圖一致）。
- 驗收：每型 bake 後輸出同視角（rot 0、南面在左、30° 俯角）純色剪影 PNG 到 `assets/previews/sil/`，與 `docs/review/*.png` 右下角剪影對照；PR 附圖。

### 6. 倉庫格與底板縮圖 → 選 **(b)** Code 用 kit.js 預烘

理由：單一真值（幾何只存在 kit.js 裡），畫布的 2D 參考圖與 3D 終究會有差。規格：

| 項目 | 規格 |
|---|---|
| 尺寸 | 128×128 @1x 與 256×256 @2x，透明背景，建築置中、底部留 8 px |
| 視角 | rot 0、南面在左、俯角 30°（與 F1 城鎮同），正交相機 |
| 光 | `three.light.day`，無陰影投射（c-slot 太小） |
| 變體 | 每型 × palettes 數（iron 4、其餘 3）；地標 12 張 |
| 檔名 | `assets/previews/<id>__<seed>.png`，id 的 `:` 換成 `-` |
| 審核 | Design 看一輪：剪影與 `docs/review` 對照 + 在 F7 c-slot（44×44 顯示）是否還認得出 |

## C. 小事

7. `houses_tw10.json _meta.note` 重複段落已清掉（版本 2026-10-22.4），順便加了 `supersedes` / `palettes_truth` / `acquire` 三個 meta。
8. `ui_strings.json` v2 已補 15 個 key（town 3、login 3、map 4、memory 5），文案照「一句人話 + 一個數值或下一步」：

| key | 文案 |
|---|---|
| town.progress_title | 我的小鎮 · {size}×{size} |
| town.road_unlimited | 道路不限 |
| town.drawer_title | 倉庫 · 依日期 |
| login.done | 綁好了，房子都跟著走 |
| login.failed | 沒綁成功，再試一次 |
| login.unavailable | 綁定還沒開放，先繼續玩 |
| map.today | 今天 {n} / 40 棟 |
| map.checkin_ok | 打卡成功 · 第 {visit} 次來 |
| map.range | 走進 {n} m 內就能打卡 |
| map.relocate | 重新定位 |
| memory.variant_origin | 原色 |
| memory.variant_n | 變體 {n} |
| memory.footprint | 佔 {n} 格 · 已進倉庫 |
| memory.note_label | 寫一句話 |
| memory.optional | 可留白 |

9. `palette.json` 新增 `map` 區塊（暖紙底圖）：background #F6F1E8、block #F0E9DD / line #E3DBCD、road #FFFCF7 / casing #E3DBCD / major #F3DDD5、park #D7E6DA、water #CFE0E6、building #E8E1D4 / line #D9CFC0、label #5C6670 + halo、landmark_pin #B5532F、me #2F7A5C、range 填色 rgba(79,154,122,.18) / 線 #4F9A7A。只在 MapLibre 方案採用。

## 變更檔案

`design/renderer/*`（新）、`scripts/design_check/*`（新）、`design/palette.json`（v2）、`design/ui_strings.json`（v2）、`data/houses_tw10.json`（2026-10-22.4）、本檔。
