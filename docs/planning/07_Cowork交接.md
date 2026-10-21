# 07 Cowork 交接（規劃 / 資料 / 驗收）

依據：`06_最終架構方案_v1.0.md`。Cowork 的產出是 Design 與 Code 的輸入，**Sprint 0 前兩天先交 §A**。

## A. Sprint 0 前（契約）
| 產出 | 內容 | 給誰 |
|---|---|---|
| `docs/schema_v1.md` | grid 256 格格式、API 請求/回應 body、錯誤碼 enum（too_far/weak_signal/cooldown/rate_limited/daily_cap/conflict/unauthorized/invalid）、grants 欄位 | Code（guard）、Design（ui_strings 鍵） |
| `docs/rules_truth_table.md` | 鄰路、2×2 佔格、解鎖 70%（道路計入）、距離容差、冷卻日界、日上限、簽到上限、拆解 — 每條附輸入/預期輸出案例 | Code（rules.js 測試） |
| `data/houses.json` 外層 | 只定外層 `{id:'sys:minnan', name, size:[1,1]|[2,2], palettes:[…≥3], blueprint:<由 Code 定>}`；`blueprint` 內部結構**由 Code 打通 3 房型後從實物抽出**（R2 投票 4），Cowork 再補 5 筆內容 | Code、Design（主色） |
| 參數表 | 06 §4 原樣 | 全員 |
| `docs/test_plan.md` v0 | Sprint 0 驗收清單（畫路/放房/存檔/滿格 ≤150 calls）；之後每 Sprint 前補該 Sprint 清單 | Code |

## B. Sprint 1（資料）
| 產出 | 步驟 |
|---|---|
| `scripts/etl_landmarks.py` | 文資局開放資料（古蹟 + 歷史建築，含經緯度/類型/縣市）→ 清洗 → `type_map.csv` 對照 → 合併 `featured.csv` → `data/landmarks.json {meta:{source, license:'政府資料開放授權條款-第1版', dataset, fetched_at, data_version}, items:[{id, name, lat, lng, county, house:'sys:…', r, tier:'general'|'featured', blurb}]}` |
| `data/type_map.csv` | 文資局類型關鍵字 → 房型；無法對照 → 該縣市通用房；人工校對一輪 |
| `data/featured.csv` | 每縣市手挑 3–5 個；覆寫 name（好讀化）、r（150–200）、blurb（兩句故事） |
| `docs/security.md` | 威脅模型、反作弊參數、限速規則（給 Cloudflare 儀表板）、濫用測試案例（設計；Sprint 2 由 Code 自動化） |
| 台北實地打卡腳本 | 3 個地標（含 1 個精選）、記錄 GPS accuracy 與結果 — **Sprint 1 驗收用** |
| `docs/privacy.md` | 隱私聲明（只在按下時取一次、只存地標名、匯出/刪帳）、授權標示文、關於頁文案 |
| 排程 | landmarks 重產：每月一次，重跑腳本 → commit → 部署 |

## C. Sprint 2–3（驗收）
| 產出 | 內容 |
|---|---|
| `docs/test_plan.md`（續） | 假打卡案例集（給除錯面板重播）：在圈內/邊界 ±5 m/accuracy 250 m/同日重按/第 41 次/高鐵台北→台中 |
| 合併規則驗收案例 | 四象限：device 有鎮 × Google 有/無鎮；驗 grants 全併入 stock、Google 鎮優先、device grid 退回本機草稿 |
| 可用性實測 | 5 人 × 3 任務（畫路放房 / 找地標打卡 / 翻記憶卡），任務腳本由 Design 提供 |
| 一週留存訪談 | 3–5 位非工程朋友；問「哪一刻想刪」 |

## D. 持續
- 維護 `docs/planning/` 正本與專案文件指標
- 每個新功能先回答「落在 grants 列、grid 格、還是 rules.js 哪一行」；答不出不排第一版
