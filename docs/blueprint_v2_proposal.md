# blueprint v2 提案 — 任意佔格 + 多體量 + 接法（2026-10-21，Design 提給 Cowork / Code）

> 起因：地標房型用 1×1 / 2×2 單一方體做不出辨識度（總統府的塔樓、龍山寺的中庭、101 的裙樓）。本提案改三份契約：`houses.json` 的 blueprint、`schema_v1.md` §2 grid、`rules_truth_table.md` §3 佔格。先寫在 `data/landmarks_tpe12.json`（12 棟已照 v2 填好），系統房型 3 棟維持 v1 可相容讀取。

## 1. 變更總表

| 項目 | v1 | v2 |
|---|---|---|
| `size` | `[1,1]` 或 `[2,2]` | `[w, d]`，w、d ∈ {1,2,3}，可非方形（1×2、3×1、2×3、3×3） |
| 佔格 | 錨點 + 固定 `{a, a+1, a+16, a+17}` | 錨點 = 最小 r、最小 c；佔格 = w×d 矩形展開；除錨點外全部 `{t:'part', of:a}` |
| `rot` | 只影響渲染 | rot 1 / 3 時 w、d 對調，佔格跟著轉；錨點仍是旋轉後矩形的左上 |
| blueprint | 單一 `body` | `blocks[]` 多體量 + `joins[]` 接法 |
| 層高 | 整棟一個 floors | 每個 block 自己的 floors × floorH |
| 中庭 | 無 | block `floors: 0`，佔格但 h≈0，地面色 |

## 2. blueprint v2 結構

```json
"blueprint": {
  "blocks": [
    { "id": "front", "at": [0, 1], "w": 3, "d": 1, "floors": 4, "floorH": 0.85,
      "roof": "hip", "window": "arch", "windowCols": 6, "door": "arch", "porch": "none",
      "extras": [ { "type": "bands", "rows": 4 } ] },
    { "id": "tower", "on": "front", "at": [1.2, 0.2], "w": 0.6, "d": 0.6, "floors": 3, "floorH": 0.9, "roof": "hip" }
  ],
  "joins": [
    { "a": "tower", "b": "front", "type": "stack" },
    { "a": "rear",  "b": "front", "type": "shared_wall" }
  ]
}
```

| 欄位 | 意義 |
|---|---|
| `at` | 相對錨點格的偏移 `[c, r]`，單位格，可小數（塔樓置中） |
| `on` | 疊在哪個 block 上；有 `on` 時 `at` 相對該 block 原點，底高 = 該 block 頂 |
| `w / d` | 體量寬深，單位格，可小數；所有 block 的投影必須落在 `size` 內 |
| `floors / floorH` | h = floors × floorH（格單位）；`floors: 0` = 中庭 / 平台 |
| `roof` | `flat` `gable` `hip` `hip2` `swallowtail` `swallowtail2` `dome` `pagoda` `spire` |
| `color` | 覆寫 wall / roof / door / accent（例如石基用 accent、中庭用地面綠） |
| 其餘 | `window` `windowCols` `door` `porch` `special` `extras` 同 v1 |

### joins 四種

| type | 意思 | bake 時 |
|---|---|---|
| `shared_wall` | a、b 相鄰共用一面牆 | 合併接觸面、不畫內牆、窗不開在接觸面 |
| `stack` | a 疊在 b 的屋頂上 | b 在 a 投影處改 flat；a 的底 = b 的頂 |
| `courtyard` | a 是中庭，b 是圍它的體量 | a 只畫地面；b 朝 a 的面照常開窗 |
| `colonnade` | a、b 之間只有柱列 | 畫柱、不畫牆；a 的屋頂延伸到 b |

南面（門面）= `r+1` 方向，與 v1 rot 0 定義一致。

## 3. rules.js 要改的函式

| 函式 | v2 |
|---|---|
| `footprint(size, anchor, rot)` | `[w,d] = rot%2 ? [d,w] : [w,d]`；回傳 `anchor + dr*16 + dc`（dr<d, dc<w）；任一格出界 → `null` |
| `canPlace` | 步驟 2–4 不變，只是 footprint 來源變 |
| `validateGrid` 步驟 4 | 從屬格數 = w×d − 1；`part.of` 指向錨點且在其 footprint 內 |
| `validateGrid` 步驟 1 schema | `rot` 仍 ∈ {0,1,2,3}；`size` 從 houses / landmarks 查，不信客端 |
| `unlockedSize` | 不變（part 算非 null） |

真值表新增案例：
- `size [3,1]` 錨 idx(5,5) rot 0 → `[85,86,87]`；rot 1 → `[85,101,117]`
- `size [2,3]` 錨 c=15 → `null`（出界）
- 3×3 放在 8×8 視窗邊 (4,9) → `locked`（c=9+2=11 ok，r=4 ok；若 (4,10) → c=12 出視窗 → locked）
- 中庭格也是 `part`，不能塗路、不能再放房

## 4. kit.js bake()

1. 逐 block 產幾何：方體 + 屋頂型式 + 窗 / 門 / 柱 / 橫帶（extras）。
2. 依 `joins` 處理接觸面（`shared_wall` 刪面、`stack` 刪 b 頂面被蓋的部分、`colonnade` 只留柱）。
3. 合併成一個 geometry；InstancedMesh 仍以房型為單位（同房型共用），`instanceColor` 走 palettes。
4. footprint 由 `size` 給，不由 blocks 推（blocks 可小於 size，留空為庭）。
5. 預渲 PNG 一樣每房型一張，取 rot 0 南面視角。

繪製預算：12 棟地標每棟 2–5 個 block，面數估 v1 的 2–3 倍；仍是每房型一個 draw call，256 格 ≤ 150 calls 不受影響。

## 5. 相容

- v1 blueprint（有 `body` 無 `blocks`）照舊讀：等同一個 block `at [0,0]`、`w d = body.w body.d`。
- `houses.json` 現有 3 房型不用改；`landmarks_tpe12.json` 的 12 棟直接是 v2。
- 第二階段玩家藍圖（`u:<uuid>`）也用 v2 結構，部件層（kind=part）對應的是 block 裡的 window / door / roof 欄位。

## 6. 需要 Cowork 裁決

1. 非方形佔格是否開放到玩家房型，還是只給地標（精選）？建議：第一版只給精選。
2. `rot` 改變佔格後，擺放時幽靈格要預覽旋轉後的矩形；gestures.md 需加「轉向鈕在擺放態旋轉幽靈」一行（Design 可補）。
3. 最大 3×3 是否足夠：龍山寺、紀念堂已用到 3×3，4×4 暫不開。
