# rules.js 真值表 v1（2026-10-21）

> `shared/rules.js` 的規格；每個函式附案例，`tests/rules.test.js` 逐條對應。純函式、無 three/DOM/網路、無時區副作用（時間一律傳入）。

## 0. 常數 `RULES`
```
GRID=16  SIZES=[8,10,12,14,16]  UNLOCK_RATIO=0.70
R_DEFAULT=100  ACC_MAX=200  ACC_TOLERANCE_MAX=50
DAILY_CAP=40  MIN_INTERVAL_S=60  DAY_OFFSET_H=4  TZ_OFFSET_H=8
DAILY_HOUSE='sys:iron'  DAILY_HOUSE_MAX=3  COUNTY_MAX_KM=30
NOTE_MAX=40  MOODS=[0,1,2,3,4]
```

## 1. 格線
| 函式 | 輸入 → 輸出 | 案例 |
|---|---|---|
| `idx(r,c)` | `r*16+c` | (0,0)→0；(1,0)→16；(15,15)→255 |
| `rc(i)` | `[Math.floor(i/16), i%16]` | 17→[1,1] |
| `inBounds(r,c)` | 0≤r,c≤15 | (-1,0)→false；(16,3)→false |
| `window(size)` | `lo=(16-size)/2, hi=lo+size-1` | 8→[4,11]；16→[0,15] |
| `isUnlocked(i,size)` | r、c 皆在 window 內 | i=idx(4,4),8→true；idx(3,4),8→false；idx(0,0),16→true |
| `neighbors4(i)` | 上下左右且在界內 | 0→[1,16]；17→[1,16,18,33] |

## 2. 解鎖
`unlockedSize(grid)`：
```
size=8
while size<16:
  cells = 所有 isUnlocked(i,size) 的格
  filled = cells 中非 null 的數量（road、house、part 都算）
  if filled/cells.length >= 0.70: size += 2 else break
return size
```
| grid | 結果 |
|---|---|
| 全 null | 8 |
| 8×8 視窗 44 格非 null（44/64=0.6875） | 8 |
| 8×8 視窗 45 格非 null（0.703） | 10 |
| 8×8 全滿、10×10 視窗 69/100 | 10 |
| 8×8 全滿、10×10 視窗 70/100 | 12 |
| 16×16 全滿 | 16（不再加） |

## 3. 佔格與放置
`footprint(size, anchor)`：`[1,1]`→`[a]`；`[2,2]`→`[a, a+1, a+16, a+17]`；anchor 在 c=15 或 r=15 時 2×2 → `null`（出界）。

`canPlace(grid, house, anchor, rot, size)` → `{ok:true, cells}` 或 `{ok:false, code:'invalid', reason}`
檢查順序：
1. `rot ∈ {0,1,2,3}` else `reason:'rot'`
2. footprint 非 null，每格 inBounds 且 isUnlocked else `'locked'`
3. 每格 `grid[i] === null` else `'occupied'`
4. footprint 任一格的 neighbors4 中，**不屬於 footprint** 且 `grid[n]?.t === 'road'` 至少一個 else `'no_road'`

| 情境（size=8，道路在 idx(5,5)） | 結果 |
|---|---|
| 1×1 放 idx(5,6) | ok |
| 1×1 放 idx(6,6)（斜角） | no_road |
| 1×1 放 idx(5,5)（路上） | occupied |
| 1×1 放 idx(3,5)（視窗外） | locked |
| 2×2 錨 idx(5,6)，佔 (5,6)(5,7)(6,6)(6,7)；(5,5) 是路 | ok |
| 2×2 錨 idx(5,15) | locked（出界） |
| 2×2 錨 idx(4,6)，(5,6) 已有房 | occupied |

`canPaintRoad(grid, i, size)`：`grid[i]===null && isUnlocked(i,size)`。
`canEraseRoad(grid, i)`：擦掉後，所有相鄰房屋（含 part 的錨點）仍各自至少有一條路 → ok；否則 `invalid 'orphan'`。
| 情境 | 結果 |
|---|---|
| 路 (5,5)，房 (5,6) 只靠它 | orphan |
| 路 (5,5)、(5,7)，房 (5,6) | ok |
| 路無鄰房 | ok |

`removeHouse(grid, anchor)` → 新 grid（錨點與 part 全設 null）+ `ref`；永遠合法。

## 4. 整鎮驗證（伺服器 PUT /town）
`validateGrid(grid, grants, houses)` → `{ok}` 或 `{ok:false, code:'invalid', reason}`（`houses` = houses.json 的 `houses[]`，用來查 size）：
1. `Array.isArray(grid) && grid.length===256`，每格型別合法；**嚴格 schema**：格子出現契約以外的欄位、或 house `id` 不在 `houses` → `'schema'`（客端 store 必須在送出前剝除 UI 專用欄位）
2. `size = unlockedSize(grid)`；所有非 null 格 isUnlocked → `'locked'`
3. 每個 house 格：`ref` 存在於 grants 且 `kind='house'`、`item_id===id`、state ∈ {stock, placed} → `'ref'`；同一 ref 只出現一次 → `'dup_ref'`
4. 每個 house 格依 houses.json size 的 footprint：從屬格必須是 `{t:'part', of:anchor}`；每個 part 格的 `of` 指向真實錨點且自己在其 footprint 內 → `'footprint'`
5. 每棟房 `canPlace` 的鄰路條件成立（以「把自己移除後的 grid」檢查）→ `'no_road'`

| 情境 | 結果 |
|---|---|
| 合法鎮 | ok |
| house ref 屬於別人 | ref |
| 兩格同 ref | dup_ref |
| 2×2 少一個 part | footprint |
| part 的 of 指向空格 | footprint |
| 房四周無路 | no_road |
| 房在視窗外 | locked |
| 格子多了 `{t:'house', …, selected:true}` | schema |
| house id `sys:nope` 不在 houses | schema |

測試夾具：houses.json 第一版尚無 2×2 房型，`tests/` 以假房型 `test:big`（size [2,2]）測 footprint；`rules.js` 不得對它特判。Sprint 2 `sys:hakka` 落地後夾具可留。

## 5. 距離與打卡
`distanceM(lat1,lng1,lat2,lng2)`：haversine，地球半徑 6371000。
| 輸入 | 輸出（±1 m） |
|---|---|
| 同點 | 0 |
| (25.0330,121.5654)→(25.0339,121.5654) | 100 |
| (25.0330,121.5654)→(25.0330,121.5664) | 101 |

`checkinDistance(dist, R, acc)`：
```
if acc > 200 → {code:'weak_signal'}
if dist > R + min(acc, 50) → {code:'too_far', dist: Math.round(dist/10)*10}
else ok
```
| dist | R | acc | 結果 |
|---|---|---|---|
| 90 | 100 | 20 | ok |
| 120 | 100 | 20 | ok（容差 120） |
| 121 | 100 | 20 | too_far{120} |
| 149 | 100 | 80 | ok（容差 150，acc 封頂 50） |
| 151 | 100 | 80 | too_far{150} |
| 50 | 100 | 201 | weak_signal |
| 180 | 200 | 0 | ok（精選） |

`tpeDay(isoUtc)`：`(UTC + 8h − 4h)` 取日期。
| UTC | day |
|---|---|
| 2026-10-21T19:59:59Z（TPE 03:59） | 2026-10-21 |
| 2026-10-21T20:00:00Z（TPE 04:00） | 2026-10-22 |
| 2026-10-21T02:00:00Z（TPE 10:00） | 2026-10-21 |

`cooldownUntil(day)`：該 day 的結束時刻 = 次日 04:00 TPE = `${day}T20:00:00Z`。例：day=2026-10-21 → `2026-10-21T20:00:00Z`（即台北 10-22 04:00）。

`canCheckin({existsSameDay, countToday, lastAt, now})`，順序：
| existsSameDay | countToday | now−lastAt | 結果 |
|---|---|---|---|
| true | — | — | cooldown{until} |
| false | 40 | — | daily_cap |
| false | 39 | 30 s | rate_limited{retry_after:30} |
| false | 39 | 60 s | ok |
| false | 0 | 無上一筆 | ok |

`visitN(prevVisits)` = prevVisits + 1。`seed(visitN, paletteCount, rand)`：visitN=1 → 0；否則 `1 + floor(rand * (paletteCount-1))`（1..paletteCount-1）。paletteCount=3：第 2 次 → 1 或 2。

## 6. 每日簽到
`countyOf(lat,lng,landmarks)`：最近地標距離 ≤ 30 km → 其 `county`；否則 null → `invalid`。
`dailyGrant(ironOwned, paletteCount, rand)`：`ironOwned`（stock+placed 的 `sys:iron` 列數）≥ 3 → `{kind:'shard'}`（寫一列 `item_id:'sys:iron', state:'dismantled'`）；否則 `{kind:'house', item_id:'sys:iron', seed: seed(2, paletteCount, rand)}`，即與一般變體同規則、seed ∈ 1..paletteCount−1（iron 4 組 → 1–3；首啟贈品那棟才是 seed 0）。
| ironOwned | 結果 |
|---|---|
| 0, 2 | house |
| 3, 7 | shard |
| 拆解過 2 棟（dismantled 不計） + stock 2 | house |

簽到冷卻：`UNIQUE(user, 'daily', day)`；同日再呼叫 → cooldown{until}。簽到不計入 DAILY_CAP。

## 7. 記憶卡與拆解
`validateMemory({mood, note})`：mood ∈ MOODS 或 null；note → NFC → 去 `\p{Cc}` → trim → 長度（code point）≤ 40，否則 `invalid`；空字串視為 null。
| note | 結果 |
|---|---|
| 40 個「好」 | ok |
| 41 個「好」 | invalid |
| `"a\u0000b"` | ok，存 "ab" |
| 全空白 | ok，存 null |

`canDismantle(grants, ids)`：1 ≤ ids.length ≤ 99；**ids 不得重複**；每個 id 屬於本人且 `state='stock'`；否則 `invalid`。`shards(grants)` = 條件列數。
| ids | 結果 |
|---|---|
| [a]（a stock） | ok |
| [a, a] | invalid |
| [a, b]（b placed） | invalid |
| 100 個 | invalid |

## 8. 版本
`applyTown(base_rev, serverRev, serverGrid)`：相等 → `{ok:true, rev: serverRev+1}`；不等 → `{ok:false, code:'conflict', rev:serverRev, grid:serverGrid}`。

## 9. 首啟贈品（伺服器 `POST /session` 首次）
- grants：`sys:iron` seed 0、`sys:minnan` seed 0，皆 stock。
- grid：8×8 視窗中央橫向一條路 `r=7, c=4..11`（idx 116–123）；其餘 null。
- 驗證：`validateGrid` 必為 ok；`unlockedSize` = 8。
