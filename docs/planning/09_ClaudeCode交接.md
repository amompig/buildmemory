# 09 Claude Code 交接（實作 / 部署 / 測試）

依據：`06_最終架構方案_v1.0.md` §2 架構、§4 參數、§5 Sprint。起點：`samples/kit.js`（10 藍圖雛形、部件函式）。輸入契約：`docs/schema_v1.md`、`docs/rules_truth_table.md`、`data/houses.json`、`design/*`。

## 工作守則（寫進專案 CLAUDE.md）
1. 純 Three.js + 原生 ES module、無 bundler、CDN importmap；Cloudflare Pages + Pages Functions + D1
2. 依賴單向：views → `store.js` → `shared/rules.js`；rules 無 three/DOM/網路，前後端同一檔
3. 單一帳本 `grants`；不得新增 count 表或第二張物品表；擴充只能加 kind 或加列
4. 客端自報的身分、時間、庫存一律不信；座標不進 D1/log/localStorage
5. 渲染預算：每房型 1 個 baked 幾何 + 1 個 InstancedMesh；單一 WebGL context；≤ 150 draw calls
6. 前端 ≤ 10 模組、後端 3 檔、無 cron；每個失敗回 `{code, 數值}`，前端用 `ui_strings[code]`

## 檔案結構
```
index.html  src/{store,api,kit,town,edit,gestures,geo,ui}.js  shared/rules.js
functions/api/[[path]].js  functions/_lib/handlers.js  schema.sql  wrangler.toml  _headers
data/{houses,landmarks}.json  design/{tokens.css,palette.json,ui_strings.json,icons/}
tests/rules.test.js（node --test）  tests/abuse.sh  scripts/etl_landmarks.py（Cowork 維護）
```

## Sprint 0（3–4 天）驗收：手機瀏覽器可畫路、放房、存檔；256 格滿放 ≤ 150 calls
- [ ] `shared/rules.js`：依真值表實作 + `node --test` 全綠
- [ ] `kit.js`：讀 houses.json；`bake(preset, palette)` → mergeGeometries + 頂點色；footprint；先 iron/minnan/shophouse，其餘色塊占位，每房型限時 2 h
- [ ] `town.js`：每房型 InstancedMesh（`instanceColor` 變體）、道路池、raycast→cell、幽靈格 + 綠/紅 + 斜線、相機 fit/4 向/俯視補間
- [ ] `gestures.js` 兩態 → `edit.js`（rules → store；含擺放中單步復原）；2×2 佔格規則在 rules.js 本 Sprint 完成，2×2 房型渲染在 Sprint 2
- [ ] `store.js`：localStorage 立即寫；`ui.js` 骨架（三 tab、底欄、toast）
- [ ] 除錯面板 `?dev=1`：模擬座標、假打卡（只動本機）、重設
- [ ] 滿格壓測 + pixelRatio ≤ 1.5；bloom/移軸不做

## Sprint 1（3–4 天）驗收：台北 3 地標實地打卡拿到房、記憶卡可寫
- [ ] `schema.sql`（users/grants/checkins/towns，`PRAGMA user_version` 遷移）
- [ ] `[[path]].js`：`guard()`（Origin、device/session cookie、body ≤ 32 KB、schema、D1 計數限速 `/town 30/min/user`）；`POST /session` 簽發 HMAC device cookie + 首啟贈品（2 棟不同房型 + 預鋪路）；`GET /me`
- [ ] 401 處理：只重新取 session，不清本機 grid；離線時打卡鈕顯示 `offline` 文案
- [ ] `/checkin`：acc ≤ 200、`dist ≤ R + min(acc,50)`、`UNIQUE(user,lm,day)`（台北 −4 h）、日 ≤ 40、間隔 ≥ 60 s、seed/visit_n、座標即丟；`/daily`：最近地標 ≤ 30 km 判縣市、iron ≥ 3 → 碎片
- [ ] `geo.js`：按打卡時 `getCurrentPosition` 一次；Leaflet + OSM 圖磚附近地標；「再走約 N m」預檢用同一 rules 函式
- [ ] 記憶卡（DOM）+ `PUT /grant/:id/memory`（mood enum、note NFC ≤ 40、`textContent`）；房型預覽 = 啟動時每房型預渲 1 張 PNG（同一 renderer），兼作倉庫卡片圖
- [ ] 每日簽到前端入口：地圖 tab 當日首次定位成功 → 自動 `POST /daily` → toast
- [ ] landmarks.json build 內嵌 + `data_version` 檢查；Cloudflare Rate Limiting 規則；`_headers` CSP/HSTS

## Sprint 2（3–4 天）驗收：換裝置資料不丟；重放/刷量/大 payload 被擋
- [ ] `POST /auth/google`：JWKS 驗證、綁定、30 天滑動 session；合併規則（06 §2.5）：grants 全併入 stock、Google 鎮優先、device grid 退回本機草稿
- [ ] `PUT /town {grid, base_rev}`：schema/鄰路/範圍/ref 歸屬/placed ≤ 持有，batch 更新 state，409 回伺服器版；前端開 App 先拉伺服器版、衝突只在「看」模式、Canvas 2D 縮圖、草稿本機 30 天
- [ ] `/dismantle`、`/me/export`、`DELETE /me`
- [ ] 剩餘 5 房型（hakka/jp_dorm/baroque/temple + 精選型）；2×2 佔格
- [ ] `tests/abuse.sh`（Cowork 案例自動化）納入 CI；Playwright 手機視口 + `setGeolocation` E2E（打卡 → 記憶卡 → 放房一條路）

## Sprint 3（3–4 天）驗收：可公開試玩
- [ ] 分享圖：主 canvas `toBlob` + Web Share；三個勾選預設關；`/share/:token` opt-in（可選）
- [ ] PWA（manifest、SW 只快取靜態與 `GET /me`）；擴張 70% 進度條 + 解鎖儀式
- [ ] 關於/隱私頁（文案來自 `docs/privacy.md`）：資料來源與授權標示、隱私聲明、匯出與刪帳入口
- [ ] 日夜只動燈光/霧/色調映射（可選）；後製（可選，reduced-motion 關）
- [ ] CI：`node --test` + `wrangler pages deploy`

## 不做（第一版）
離線排隊打卡、速度檢查、cron、counties.json、分縣懶載、第二 WebGL context、結構變體、裝飾件發放（`kind=decor` 只開 enum）、`blueprints` 表
