# Design 回覆：升級版本、城市池、基礎部件（Design → Code，2026-10-22）

> 對應 `docs/spec_upgrade_2026-10-22.md` §3 四項。✅ = Design 已交付；❓ = 數字或規則待使用者定，Code 先照 Design 提案實作、留常數可改。
> 畫布：Claude Design「升級版本與基礎部件」三塊板（Main 15 型 / Parts 6 種 / Rules 池與機率）；原檔在 `design/renderer/Upgrades.dc.html`、`Parts.dc.html`、`Rules.dc.html`。

## 1. 升級版本 15 張 blueprint v2.2 ✅

檔案：`data/houses_upgrades.json`（欄位同 `houses_tw10.json`，另加 `line`、`tier`、`label`）。

| 原型 | 1×2（tier 2） | 1×3（tier 2） | 2×2（tier 3） |
|---|---|---|---|
| sys:iron 鐵窗透天厝 | sys:iron-2 雙併透天（5F + 4F） | sys:iron-3 三連棟透天（4/5/4F，藍鐵皮頂） | sys:iron-4 街角透天群（L 型 4/5/6F + 後院車棚） |
| sys:apartment 老公寓 | sys:apartment-2 雙拼公寓 | sys:apartment-3 三拼公寓（右戶加蓋 6F） | sys:apartment-4 L 型公寓（中庭 + 樹） |
| sys:tilehighrise 電梯大樓 | sys:tilehighrise-2 雙併 14F | sys:tilehighrise-3 裙樓 2F + 板樓 12F | sys:tilehighrise-4 雙塔 15F + 12F |
| sys:temple 小廟 | sys:temple-2 廟 + 廂房 + 金爐 | sys:temple-3 三川殿（龍門 / 虎門） | sys:temple-4 二進廟宇（天井 + 護室） |
| sys:jpdorm 日式宿舍 | sys:jpdorm-2 二戶建 | sys:jpdorm-3 和洋折衷官舍（洋館 + 庭） | sys:jpdorm-4 高等官舍（L 型 + 庭園池） |

| 項目 | 定義 |
|---|---|
| 尺寸 | `size = [面寬 c, 進深 r]`，門面朝南。spec 的「1×2」= `[2,1]`、「1×3」= `[3,1]` |
| id | `sys:<原型>-<佔格數>`；`line` = 原型 id；`tier` 1 / 2 / 3 |
| 比例 | 與原型同一把尺（樓層 0.3、電梯大樓 0.25；窗 0.14×0.16；鐵窗籠外推 0.1）。升級版只放大量體、加戶數與院落，三項不可省略特徵保留 |
| 變體 | `palettes` 複製自原型、順序相同（seed 意義不變）。鄰戶固定色（第 2、3 戶牆、招牌）不隨變體換 |
| 檢查 | `verify_order` 兩條硬規則 15 型全 ok；block id 唯一；量體不出 footprint（附著物外推 ≤ 0.1，同原型慣例） |
| 縮圖 | 照 B6-b 規格預烘：15 型 × 3 變體 = 45 張 + 剪影 15 張 |

### Code 要改的地方

1. **佔格**：`rules.footprint` 目前只有 1×1、2×2。新增 `[2,1]`、`[3,1]`；錨點 = 最小 r、最小 c，從屬格 `{t:'part', of:a}` 同 2×2。
2. **旋轉**：非正方形在 rot 1 / 3 時佔格轉成 `[1,2]`、`[1,3]`。schema v1 §2「rot 只影響渲染，不影響佔格」要改版。
3. **catalog**：`build_catalog.mjs` 加讀 `houses_upgrades.json`；`dailyPool` 仍只取 tier 1（size 1×1 + `sys:` 篩選已涵蓋，升級版 size 不是 1×1）。

## 2. 各城市 1×1 池 ✅ 提案 / ❓ 權重待使用者定

檔案：`data/city_pools.json`。每個縣市都含全部 5 種，只調權重。這樣任何一型在任何縣市都湊得到兩棟，合成不會被地區卡住。非精選地標打卡用同一個池。

| 池 | 縣市 | 鐵窗厝 | 老公寓 | 電梯大樓 | 小廟 | 日式宿舍 |
|---|---|---|---|---|---|---|
| 都會 metro | TPE NWT KEE TAO HSZ HSQ TXG KHH | 30 | **30** | **25** | 10 | 5 |
| 古城 heritage | TNN CYI ILA HUA TTT | 30 | 20 | 5 | **25** | **20** |
| 鄉鎮 rural（default） | MIA CHA NAN YUN CYQ PIF PEN KIN LIE、其他 | **45** | 15 | 5 | **25** | 10 |

`dailyPool(houses, county)` → `groups[counties[county] ?? default_group].weights`，加權抽。

## 3. 基礎部件 ✅

檔案：`data/decor.json`（`grants.kind = 'decor'`，id `dc:<slug>`，每個都有 blueprint v2.2）。

| id | 名稱 | layer | 權重 |
|---|---|---|---|
| dc:lamp | 路燈 | road | 20 |
| dc:streettree | 行道樹 | road | 25 |
| dc:mailbox | 郵筒（綠 + 紅） | road | 10 |
| dc:banyan | 老榕樹（樹下圓凳） | lot | 10 |
| dc:scooters | 機車停車格 | lot | 20 |
| dc:garden | 小花圃 | lot | 15 |

| 規則 | 內容 |
|---|---|
| road（路上） | 只放在路格，每格最多 1 個；不佔格、不影響臨路判定與道路連通。grid：`{"t":"road","deco":{"id":"dc:lamp","ref":"<grantId>"}}` |
| lot（空地） | 佔 1 格；不需臨路；不算路（旁邊的房子仍要另外接路）；可 rot。grid：`{"t":"deco","id":"dc:banyan","ref":"<grantId>","rot":0}` |
| 擦路 | 路上有部件 → 部件自動回倉庫，不擋擦路（`canEraseRoad` 的 orphan 規則不變） |
| 其他 | 部件不能合成、不能升級；沒有持有上限；道路維持不限量，不進簽到池 |
| 渲染 | 路上部件的 blueprint 含示意路面 `road` / `ln0` / `ln1`，疊到既有路格時跳過這三個 block |

schema v1 §2 要加 `deco` 欄位與 `t:'deco'` 型別；`validateGrid` 的嚴格 schema 同步。

## 4. 每日簽到比例 ❓ Design 提案

- 先抽 kind：**房子 70 / 部件 30**；房子從城市池抽，部件照上表權重抽。
- 只算簽到的話，大約多久合成一次：都會老公寓約 10 天一棟第 2 階、19–24 天一棟 2×2；都會日式宿舍要 4–5 個月，去古城打卡會快很多。

## 5. 要使用者決定

1. 簽到房子 / 部件比例 70 / 30？
2. **1×2 能不能和 1×3 合成？** 兩者 item_id 不同，照 spec「同 item_id」不能互合。Design 建議可以（合成鍵 = `line + tier`），不然第二次升級平均要多 1 棟第 2 階。
3. 三種城市池的分類與權重照表用？

## 變更檔案

`data/houses_upgrades.json`、`data/decor.json`、`data/city_pools.json`（皆新）、`design/renderer/Upgrades.dc.html`、`Parts.dc.html`、`Rules.dc.html`（新，畫布原檔）、本檔。未改既有檔。
