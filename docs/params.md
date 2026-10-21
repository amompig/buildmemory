# 參數表 v1.0（= 06 §4，`rules.js` 的 `RULES` 常數來源）

| 參數 | 值 | 常數名 |
|---|---|---|
| 打卡半徑 R | 一般 100 m；精選 150–200 m（landmarks.json 每筆 `r`） | `R_DEFAULT=100` |
| 距離容差 | `R + min(accuracy, 50)` | `ACC_TOLERANCE_MAX=50` |
| accuracy 拒收 | > 200 m → `weak_signal` | `ACC_MAX=200` |
| 冷卻 | 每人每地標每自然日 1 次；日界 = 台北 04:00 | `DAY_OFFSET_H=4`, `TZ_OFFSET_H=8` |
| 日上限 / 最小間隔 | 40 次/日；60 s | `DAILY_CAP=40`, `MIN_INTERVAL_S=60` |
| 每日簽到 | 1 次/日，不計入日上限；通用房 `sys:iron` 持有 ≤ 3，到頂給 1 碎片 | `DAILY_HOUSE`, `DAILY_HOUSE_MAX=3` |
| 縣市判定 | 最近地標 ≤ 30 km | `COUNTY_MAX_KM=30` |
| 變體 | palettes[0] 原色（第 1 次）；第 2 棟起 seed ∈ 1..n-1 | — |
| 拆解比率 | 1 棟 → 1 碎片；部件包 = 5 碎片（第二階段） | — |
| 城鎮 | 16×16；初始 8×8；填滿 70%（道路計入）解鎖一圈 | `SIZES`, `UNLOCK_RATIO=0.70` |
| 建築 | 1×1；夥房/廟 2×2 | houses.json `size` |
| 首啟贈品 | `sys:iron` + `sys:minnan` 各 1、預鋪路 idx 116–123 | — |
| 存檔 | body ≤ 32 KB；note ≤ 40 字；session 30 天滑動；device cookie 400 天 | `NOTE_MAX=40` |
| 草稿 | 409 落選版本本機保留 30 天 | — |
| 渲染預算 | ≤ 150 draw calls、單一 WebGL context、pixelRatio ≤ 1.5 | — |
| 限速 | `/checkin` 30/min/IP；`/auth` 10/min/IP；`/town` 30/min/user | — |
| 速度檢查 | **無** | — |
