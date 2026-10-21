# 台北 12 地標 — 3D / 幾何資料來源調查（2026-10-22）

> 目的：地標房型不靠「看照片猜」，而是有真模型就用真模型降面，沒有的才走 blueprint v2.1。本檔列出每個來源的內容、授權、取得方式、能用到什麼程度；逐棟對照在 §4。

## 1. 來源總表

| # | 來源 | 內容 | 授權 / 費用 | 取得 | 對本專案的用途 |
|---|---|---|---|---|---|
| S1 | **TDAL 臺灣數位模型庫**（文化部 → 文策院 TAICCA）https://tdal.tw | 337 棟建築模型，台北地標 13 棟（§4），高面數 .fbx/.mb/.max + 4K 貼圖 | **CC BY 可商用**，每棟 NT$ 600–3,000（總統府 3,000，其餘多為 1,000）；需註冊會員購買下載 | 網站購買下載；網站內建 3D 預覽可免費轉任意角度看 | 直接降面成遊戲用低模（最佳）；或當多角度參考 |
| S2 | **臺北市宗教建築 3D 模型庫**（臺北市民政局，data.gov.tw #121136） | 43 棟寺廟 / 教會 KMZ（Google Earth COLLADA + 貼圖），含 **龍山寺本體 + 牌坊** | **政府資料開放授權條款第 1 版**（可商用、需標示）免費 | CSV 內每棟一個 `https://canet.civil.taipei/tp90-1/model/<id>.kmz` 直連 | 龍山寺、保安宮、霞海城隍廟等可直接轉 glTF 用 |
| S3 | **國土測繪中心 3D 國家底圖**（3dmaps.nlsc.gov.tw） | 全台 LOD1 建物（LiDAR DSM 高度 + 建物框 + 樓層數）；臺北 113 年版；另有「知名地標 LOD3 模型（數位授權本平臺展示）」22 棟（五都） | 瀏覽免費；實體圖資下載需自然人憑證登入且 **已改收費**；LOD3 地標僅限平台展示 | 平台點建物 → 「建物屬性」面板（建物 ID、樓層數、樓高 m、建物框來源） | 每棟真實**樓高 / 樓層數 / 平面框**（校正 blueprint 比例）；LOD3 當多角度參考 |
| S4 | **臺北市多維度測繪管理系統 / TPGIS**（3d.land.gov.taipei、uddtp.gitbook.io/tpgis） | 臺北市 LOD1 積木模型（每兩年更新）、LOD2 真實模型（信義區等示範區）、影像 mesh | 未標示；需洽都發局 | 線上瀏覽 | 參考 |
| S5 | **Wikimedia Commons / DuckDuckGo 圖片** | 多角度照片、空拍 | 僅觀察 | 瀏覽 | 已用於 v2.1（Commons 429 限流時改用 DDG） |
| S6 | **OpenStreetMap** | 建物輪廓 + 部分 `height` / `building:levels` | ODbL（需標示、衍生資料同授權） | Overpass API | 全台通用：非地標建物的平面與高度 |
| S7 | 商用模型市集（cgtrader / fab / free3d / Sketchfab） | 台北 101、圓山等有第三方模型 | 逐一看授權，多為付費且禁再散布 | 購買 | 101 / 圓山的備案 |

## 2. 關鍵發現

1. **8 / 12 棟有官方高品質模型可買（S1，CC BY）**：總統府、監察院、臺北賓館、林安泰古厝、中正紀念堂、北門承恩門、西門紅樓、迪化街街屋（全祥茶莊街屋）。全部買下約 **NT$ 10,000**。另有 剝皮寮、臺北郵便局、中山堂、台灣銀行、自來水博物館、小南門 / 東門 / 南門 / 西門（舊城門）可擴充地標清單。
2. **龍山寺免費**（S2，OGDL）：KMZ → COLLADA → glTF，一條指令可轉。
3. **101、圓山大飯店、國立臺灣博物館沒有開放模型**：S3 的 LOD3 地標層只能看不能下載；走 blueprint v2.1（現況）或 S7 購買。
4. **S3 的建物屬性是免費的「比例尺」**：點一下就有樓高與樓層（例：台北 101 建物 ID 2VN107ATTL，96 層，395.02 m，LiDAR DSM）。12 棟逐一查一次，寫進 `real_floors` / `real_height_m`，blueprint 的 floors × floorH 就不用猜。
5. TDAL 模型面數極高（紅樓 68 萬、總統府 600 萬、紀念堂 5,100 萬面），**必須降面**到 ≤ 5k 面 / 棟並重烘低解析貼圖，才符合 ≤ 150 draw calls 與手機記憶體；降面後風格要回到低飽和色票（貼圖量化到 palette 家族）。

## 3. 建議管線（取代「看照片填 blueprint」）

```
有模型 (S1 / S2)                           沒模型 (101 / 圓山 / 博物館)
  │                                           │
  ├─ fbx / kmz → Blender → glTF               ├─ S3 查樓高、樓層、平面框
  ├─ Decimate 到 ≤ 5k 面，保留體量輪廓          ├─ S5 多角度照片
  ├─ 貼圖 → 單色/色票量化（低飽和家族）          └─ blueprint v2.1（blocks + joins）→ kit.js bake
  ├─ 對齊格子：footprint 由 S3 建物框量成 w×d
  └─ 輸出 landmarks/<id>.glb（≤ 300 KB）
```

- kit.js 新增 `kind: "glb"` 房型：載入預烘 GLB，InstancedMesh 不適用（每棟獨一），每棟 1 draw call，12 棟上限內。
- 日夜只動燈光，GLB 材質用單色 + 頂點色即可。
- 授權標示：TDAL CC BY → 關於頁列「模型：文化內容策進院 TDAL（CC BY）」；OGDL → 「臺北市政府民政局」。

## 4. 逐棟對照

| # | 地標 | 最佳來源 | 模型資訊 | 樓高 / 樓層（S3） | 處理 |
|---|---|---|---|---|---|
| f01 | 北門（承恩門） | S1 `T202111160004` | 25 萬面 / fbx 8 MB / NT$1,000 / CC BY | 待查 | 降面 |
| f02 | 總統府 | S1 `T202111020004` | 602 萬面 / fbx 166 MB / NT$3,000 / CC BY（1970 年代前樣貌） | 待查 | 降面 |
| f03 | 中正紀念堂 | S1 `T202111020044` | 5,098 萬面 / fbx 1.36 GB / NT$1,000 / CC BY | 待查 | 降面（重） |
| f04 | 國立臺灣博物館 | 無模型 | — | 待查 | blueprint v2.1 |
| f05 | 西門紅樓 | S1 `T202111030008` | 68 萬面 / fbx 18 MB / NT$1,000 / CC BY | 待查 | 降面 |
| f06 | 艋舺龍山寺 | **S2 免費** `108003.kmz` + `108003A.kmz`（牌坊） | KMZ（COLLADA） | 待查 | kmz → glTF → 降面 |
| f07 | 臺北賓館 | S1 `T202111020038` | 1,130 萬面 / fbx 353 MB / NT$1,000 / CC BY | 待查 | 降面 |
| f08 | 監察院 | S1 `T202111020027` | 276 萬面 / fbx 59 MB / NT$1,000 / CC BY | 待查 | 降面 |
| f09 | 迪化街街屋 | S1 `T202111040012`（全祥茶莊街屋） | 40 萬面 / fbx 12 MB / NT$1,000 / CC BY | 待查 | 降面；可代表迪化街街屋型 |
| f10 | 台北 101 | 無開放模型（S3 LOD3 僅展示） | — | **96 層 / 395.02 m**（ID 2VN107ATTL） | blueprint v2.1；或 S7 購買 |
| f11 | 圓山大飯店 | 無開放模型 | — | 待查 | blueprint v2.1；或 S7 |
| f12 | 林安泰古厝 | S1 `T202111020040` | 616 萬面 / fbx 215 MB / NT$1,000 / CC BY | 待查 | 降面 |

可加入清單的額外地標（S1 都有）：剝皮寮 `T202111020034`、臺北郵便局 `T202111030002`、中山堂 `T202111020006`、台灣銀行 `T202111030027`、自來水博物館 `T202111030015`、小南門 / 東門 / 南門 / 西門寶成門。

## 5. 需要你決定

1. 是否購買 S1 的 8 棟（約 NT$ 10,000）走降面管線；或先只買 2 棟（北門 8 MB、紅樓 18 MB，各 NT$1,000）驗證降面效果再決定。
2. 龍山寺 KMZ 可立刻轉；要不要我先做這一棟當管線範例。
3. 101 / 圓山 / 博物館維持 blueprint，還是找 S7 付費模型。

## 6. 連結

- TDAL 首頁 https://tdal.tw ；北部地區列表 https://tdal.tw/tw/3DModels/tag/Northern_Taiwan/
- 臺北市宗教建築 3D 模型庫 https://data.gov.tw/dataset/121136 （CSV：https://data.taipei/api/dataset/d8718826-54cf-4cba-ba92-088b1658c7c6/resource/bf338b29-e36b-4131-aab5-25c7342b2139/download）
- NLSC 3D 國家底圖 https://3dmaps.nlsc.gov.tw ；LOD3 地標公告 https://www.nlsc.gov.tw/NLSC_Content.aspx?n=1742&sms=9680&s=317594 ；三維建物屬性表 https://3dmaps.nlsc.gov.tw/NLSC/uploadData/三維建物模型屬性表.pdf ；供應費用 https://www.nlsc.gov.tw/cp.aspx?n=1549
- TPGIS 三維建物 https://uddtp.gitbook.io/tpgis/ch2-1/2.4 ；臺北市多維度測繪 https://3d.land.gov.taipei
- TDAL 背景報導：中時 2018 https://www.chinatimes.com/realtimenews/20180622003523-260405 ；哇哇 3C https://ez3c.tw/10220
