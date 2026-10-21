// iso_renderer.js — BuildingYourMemory blueprint v2.2 的 2D 等角參考渲染器（Design → Code，2026-10-22）
// 用途：只當幾何定義的參考，不在遊戲裡執行。docs/review/*.png 與 Design 畫布的兩塊板就是這份程式畫的。
// 來源：design/renderer/Landmarks.dc.html / Houses.dc.html 的 <script type="text/x-dc">，data() 兩份、renderVals() 共用同一份。
// 執行：node iso_renderer.js [landmarks|houses]  → 印出每棟的 block 數 / 繪製次序；require 後可用 render(board) 取得 parts。
// 幾何公式速查見 README.md。
'use strict';
class DCLogic {}

class LandmarksBoard extends DCLogic {
  shade(hex, f) { var n = parseInt(hex.slice(1), 16); var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f); return '#' + [r, g, b].map(function (v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }).join(''); }
  poly(pts) { return 'polygon(' + pts.map(function (p) { return p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(', ') + ')'; }
  data() {
    var self = this;
    // v2.2：block 可帶 z（底部抬高，格單位）、arch [tc, w, h, through]（南面挖入拱洞）、winFaces 'S'、domeScale；柱子是實體 block
    var STONE = '#8E8A80', PAVE = '#D9CFB8', COURT = '#9FBFA6', WHITE = '#F7F3EE', GREY = '#B9B5A8';
    function B(id, c, r, w, d, h, roof, o) { return Object.assign({ id: id, c: c, r: r, w: w, d: d, h: h, roof: roof, win: 0 }, o || {}); }
    function solid(id, c, r, w, d, h, col, z, on) { return B(id, c, r, w, d, h, 'flat', { wall: col, roofColor: col, z: z || 0, on: on }); }
    function columns(pre, c, r, w, n, h, col, z, size) { var s = size || 0.06, o = []; for (var i = 0; i < n; i++) { var x = c + (i + 0.5) / n * w - s / 2; o.push(solid(pre + i, x, r - s, s, s, h, col, z || 0)); } return o; }
    function stairs(pre, c, r, w, d, n, stepH, col, z) { var o = []; for (var k = 0; k < n; k++) { var ins = k * (w * 0.06); o.push(solid(pre + k, c + ins, r, w - 2 * ins, d * (1 - k / n), stepH, col, (z || 0) + k * stepH)); } return o; }
    return [
      { id: 'lm:TPE-f01', name: '北門（承恩門）', size: [1, 1], real: 2, vScale: 1.3, zoom: 1.1, obs: '三項不能省略：挖穿基座的門洞（可看穿到後方）、基座頂的女牆讓城牆有厚度、城樓 hip 兩層出簷。基座 0.75、城樓 0.7，窗：一圓兩方。',
        p: { wall: '#B8503A', roof: '#5E5A55', door: '#4A4642', accent: STONE }, chips: ['門洞 挖穿 可看穿', '女牆 城牆厚度', 'hip 出簷 1.35 兩層', '圓窗 ×1 方窗 ×2'],
        blocks: [ B('base', 0, 0, 1, 1, 0.75, 'flat', { wall: STONE, roofColor: '#9A9690', arch: [0.5, 0.34, 0.62, true] }),
          solid('pF', 0, 0.93, 1, 0.07, 0.07, '#7F7B76', 0, 'base'), solid('pL', 0, 0, 0.07, 1, 0.07, '#7F7B76', 0, 'base'), solid('pR', 0.93, 0, 0.07, 1, 0.07, '#7F7B76', 0, 'base'), solid('pB', 0, 0, 1, 0.07, 0.07, '#7F7B76', 0, 'base'),
          B('gate', 0.14, 0.14, 0.72, 0.72, 0.7, 'hip', { on: 'base', eave: 1.35, roofH: 1.0, win: 2, winRows: 1, wstyle: 'round' }) ] },
      { id: 'lm:TPE-f02', name: '總統府', size: [3, 2], real: 5, vScale: 1.5, obs: '三項不能省略：3 格長的前後翼 + 兩個中庭（日字）、中央入口退縮 0.12 並有柱廊車寄、塔樓 : 主樓 = 2.4。窗洞改為框 + 內嵌，四角與中棟各一座方錐角樓。',
        p: { wall: '#B8503A', roof: '#6F7F8C', door: '#4F5B6B', accent: WHITE }, chips: ['日字 長翼 + 2 中庭', '中央退縮入口 + 柱廊 ×4', '塔 : 主樓 2.4', '窗洞有框深', '角樓 ×5'],
        blocks: [ B('sideL', 0, 0, 0.4, 2, 0.5, 'hip', { eave: 1.05, roofH: 0.7, win: 1, winRows: 3, bands: 3, winFaces: 'S' }),
          B('sideR', 2.6, 0, 0.4, 2, 0.5, 'hip', { eave: 1.05, roofH: 0.7, win: 3, winRows: 3, bands: 3 }),
          B('rear', 0.4, 0, 2.2, 0.45, 0.5, 'hip', { eave: 1.05, roofH: 0.7, win: 3, winRows: 3, bands: 3, winFaces: 'S' }),
          solid('courtN', 0.4, 0.45, 2.2, 0.33, 0.01, COURT),
          B('mid', 0.4, 0.78, 2.2, 0.4, 0.5, 'hip', { eave: 1.05, roofH: 0.7, win: 3, winRows: 3, bands: 3, winFaces: 'S' }),
          B('midPav', 0.9, 0, 0.4, 0.4, 0.1, 'hip', { on: 'mid', eave: 1.1, roofH: 1.6 }),
          solid('courtS', 0.4, 1.18, 2.2, 0.37, 0.01, COURT),
          B('frontL', 0, 1.55, 1.15, 0.45, 0.6, 'hip', { eave: 1.05, roofH: 0.7, win: 3, winRows: 3, bands: 3, winFaces: 'S' }),
          B('frontR', 1.85, 1.55, 1.15, 0.45, 0.6, 'hip', { eave: 1.05, roofH: 0.7, win: 3, winRows: 3, bands: 3, winFaces: 'S' }),
          B('center', 1.15, 1.55, 0.7, 0.33, 0.6, 'flat', { roofColor: '#A8473A', win: 0, bands: 3, arch: [0.5, 0.3, 0.4] }),
          solid('canopy', 1.2, 1.88, 0.6, 0.12, 0.03, WHITE, 0.3),
          B('pavL', 0.02, 0.02, 0.4, 0.41, 0.12, 'hip', { on: 'frontL', eave: 1.1, roofH: 1.5 }),
          B('pavR', 0.73, 0.02, 0.4, 0.41, 0.12, 'hip', { on: 'frontR', eave: 1.1, roofH: 1.5 }),
          B('pavRL', -0.38, 0.02, 0.4, 0.41, 0.12, 'hip', { on: 'rear', eave: 1.1, roofH: 1.5 }),
          B('pavRR', 2.18, 0.02, 0.4, 0.41, 0.12, 'hip', { on: 'rear', eave: 1.1, roofH: 1.5 }),
          B('tower', 0.17, 0, 0.36, 0.33, 0.9, 'hip', { on: 'center', eave: 1.35, roofH: 1.6, win: 1, winRows: 3, bands: 4, winFaces: 'S' }) ]
          .concat(columns('pc', 1.2, 2.0, 0.6, 4, 0.3, WHITE)) },
      { id: 'lm:TPE-f03', name: '中正紀念堂', size: [3, 3], real: 3, vScale: 1.5, obs: '三項不能省略：地面三段 → 基座三段台階的入口軸線（台階北緣對齊基座邊、頂階與基座同高）、正面大拱門挖入牆體、藍瓦八角重簷（下簷貼牆頂外挑、上簷內縮）。牆面收分 1→0.9、角墩 ×4 高 1.12 在下簷之下。牌樓在廣場另一端，不在 3×3 內。',
        p: { wall: WHITE, roof: '#4A6FA5', door: '#3A3A48', accent: '#E2B45A' }, chips: ['兩段台階 軸線 對齊基座', '大拱門 挖入', 'hip2 八角 重簷', '牆面收分', '角墩 ×4'],
        blocks: [ solid('plinth', 0, 0, 3, 2.75, 0.16, '#F2EEE6'),
          solid('plinth2', 0.25, 0.2, 2.5, 2.3, 0.1, '#F4F0E8', 0, 'plinth'),
          B('hall', 0.25, 0.15, 2, 2, 1.3, 'hip2', { on: 'plinth2', eave: 1.3, roofH: 0.8, shape: 'oct', sBot: 1.0, sTop: 0.9, arch: [0.5, 0.2, 0.5] }),
          B('bNW', 0.17, 0.07, 0.4, 0.4, 1.12, 'flat', { on: 'plinth2', roofColor: '#EDE9E0', sBot: 1, sTop: 0.85 }),
          B('bNE', 1.93, 0.07, 0.4, 0.4, 1.12, 'flat', { on: 'plinth2', roofColor: '#EDE9E0', sBot: 1, sTop: 0.85 }),
          B('bSW', 0.17, 1.83, 0.4, 0.4, 1.12, 'flat', { on: 'plinth2', roofColor: '#EDE9E0', sBot: 1, sTop: 0.85 }),
          B('bSE', 1.93, 1.83, 0.4, 0.4, 1.12, 'flat', { on: 'plinth2', roofColor: '#EDE9E0', sBot: 1, sTop: 0.85 }) ]
          .concat(stairs('st', 0.3, 2.75, 2.4, 0.25, 3, 0.053, '#E6E1D6'))
          .concat(stairs('su', 0.7, 2.5, 1.6, 0.25, 3, 0.034, '#EDE9E0', 0.16)) },
      { id: 'lm:TPE-f04', name: '國立臺灣博物館', size: [3, 1], real: 2, vScale: 1.2, wstyle: 'arch', obs: '三項不能省略：凹入的六柱門廊（柱後是退縮 0.2 的牆，可看穿）、柱上三角山牆投影、三段寬台階。圓頂在鼓座上、兩翼較低且有拱窗。',
        p: { wall: '#D9D4C7', roof: '#7F9A8C', door: '#4F5B6B', accent: WHITE }, chips: ['凹入柱廊 ×6 可看穿', '三角山牆 on 柱', '寬台階 3 段', 'dome on drum'],
        blocks: [ B('wingL', 0, 0, 1, 0.8, 1.6, 'hip', { eave: 1.08, win: 3, winRows: 2, wstyle: 'arch', winFaces: 'S' }),
          B('wingR', 2, 0, 1, 0.8, 1.6, 'hip', { eave: 1.08, win: 3, winRows: 2, wstyle: 'arch' }),
          B('center', 1, 0, 1, 0.65, 1.75, 'flat', { roofColor: '#CFC7B4', win: 1, winRows: 2, winFaces: 'S', arch: [0.5, 0.26, 0.42] }),
          B('drum', 0.15, 0.05, 0.7, 0.55, 0.3, 'dome', { on: 'center', domeScale: 1.6, wall: '#E6E1D6' }),
          B('pediment', 1.02, 0.6, 0.96, 0.32, 0.14, 'gable', { z: 1.6, ridge: 'd', eave: 1.12, roofColor: '#CFC7B4', wall: '#E6E1D6' }) ]
          .concat(columns('pc', 1.05, 0.9, 0.9, 6, 1.6, WHITE, 0, 0.07))
          .concat(stairs('st', 0.95, 0.9, 1.1, 0.1, 3, 0.04, '#CFC7B4')) },
      { id: 'lm:TPE-f05', name: '西門紅樓', size: [1, 2], real: 2, vScale: 1.3, zoom: 1.05, obs: '三項不能省略：兩層八角主樓主導（高出十字樓一倍）、低矮十字翼（脊樑 + 橫翼兩道 gable 屋頂）、入口拱門挖入 + 台階。紅磚、白飾帶 ×2。',
        p: { wall: '#B8503A', roof: '#4F5B6B', door: '#8E6B50', accent: WHITE }, chips: ['八角主樓 2F 主導', '十字翼 1F gable ×2', '拱門 挖入 + 台階', 'bands ×2'],
        blocks: [ B('spine', 0.28, 0, 0.44, 1.05, 0.55, 'gable', { eave: 1.05, win: 1, winRows: 1 }),
          B('transept', 0, 0.35, 1, 0.38, 0.55, 'gable', { eave: 1.05, win: 2, winRows: 1, winFaces: 'S' }),
          B('oct', 0, 1.0, 1, 0.9, 1.1, 'hip', { eave: 1.12, roofH: 0.75, shape: 'oct', win: 2, winRows: 2, bands: 2, wstyle: 'arch', arch: [0.5, 0.22, 0.32] }) ]
          .concat(stairs('st', 0.3, 1.9, 0.4, 0.1, 2, 0.04, GREY)) },
      { id: 'lm:TPE-f06', name: '艋舺龍山寺', size: [3, 3], real: 1, vScale: 1.2, wstyle: 'lattice', dstyle: 'arch', obs: '三項不能省略：前殿 / 正殿 / 後殿三道燕尾屋頂群（正殿最高且獨立在中庭）、正殿與前殿的柱廊（柱後牆退縮，可看穿）、前埕 + 中庭兩個開放空間。鐘鼓樓 hip2 在護室上。',
        p: { wall: '#B8503A', roof: '#C97D4B', door: '#C7453B', accent: '#E2B45A' }, chips: ['屋頂群 前 / 正 / 後', '正殿 + 前殿 柱廊 可看穿', '前埕 + 中庭', '鐘鼓樓 hip2 ×2'],
        blocks: [ B('rear', 0, 0, 3, 0.65, 0.85, 'swallowtail', { eave: 1.15, win: 3, winRows: 1, winFaces: 'S' }),
          B('sideL', 0, 0.65, 0.5, 1.55, 0.55, 'hip', { eave: 1.05, win: 1, winRows: 1 }),
          B('sideR', 2.5, 0.65, 0.5, 1.55, 0.55, 'hip', { eave: 1.05, win: 1, winRows: 1 }),
          B('bell', 0, 0.5, 0.5, 0.5, 0.85, 'hip2', { on: 'sideL', eave: 1.3, roofH: 1.1, win: 1, winRows: 1 }),
          B('drum', 0, 0.5, 0.5, 0.5, 0.85, 'hip2', { on: 'sideR', eave: 1.3, roofH: 1.1, win: 1, winRows: 1 }),
          solid('court', 0.5, 0.65, 2.0, 1.55, 0.02, PAVE),
          B('mainBody', 1.05, 0.95, 0.9, 0.7, 1.3, 'flat', { roofColor: '#A8473A', win: 1, winRows: 1, winFaces: 'S', arch: [0.5, 0.3, 0.5] }),
          B('mainRoof', 1.0, 0.95, 1.0, 0.95, 0.25, 'swallowtail2', { z: 1.3, eave: 1.4, roofH: 1.2, wall: '#A8473A' }),
          B('frontBody', 0, 2.2, 3, 0.3, 0.75, 'flat', { roofColor: '#A8473A', win: 2, winRows: 1, winFaces: 'S', lantern: true, arch: [0.5, 0.14, 0.5] }),
          B('frontRoof', 0, 2.2, 3, 0.5, 0.2, 'swallowtail', { z: 0.75, eave: 1.2, roofH: 1.0, wall: '#A8473A' }),
          solid('plaza', 0, 2.7, 3, 0.3, 0.01, PAVE),
          solid('lampL', 0.8, 2.88, 0.06, 0.06, 0.3, STONE), solid('lampR', 2.14, 2.88, 0.06, 0.06, 0.3, STONE) ]
          .concat(columns('mc', 1.05, 1.9, 0.9, 4, 1.3, '#B5452E'))
          .concat(columns('fc', 0.2, 2.7, 2.6, 6, 0.75, '#B5452E')) },
      { id: 'lm:TPE-f07', name: '臺北賓館', size: [2, 1], real: 2, vScale: 1.3, zoom: 1.05, wstyle: 'arch', obs: '三項不能省略：中央入口退縮 0.13 + 四根有厚度的柱子撐出車寄、馬薩式屋頂兩層（下陡上緩）、兩端角樓屋頂高出主屋脊。中央圓頂小塔、拱窗 ×4。',
        p: { wall: '#E6E1D6', roof: '#4F5B6B', door: '#4A4642', accent: GREY }, chips: ['中央退縮 + 柱 ×4', 'mansard 斜面 + 平頂', '角樓 ×2 高出', '中央 dome'],
        blocks: [ B('mainL', 0, 0, 0.75, 0.85, 1.0, 'mansard', { eave: 1.08, roofH: 1.0, win: 2, winRows: 2, bands: 2, wstyle: 'arch', winFaces: 'S' }),
          B('mainR', 1.25, 0, 0.75, 0.85, 1.0, 'mansard', { eave: 1.08, roofH: 1.0, win: 2, winRows: 2, bands: 2, wstyle: 'arch' }),
          B('center', 0.75, 0, 0.5, 0.72, 1.0, 'mansard', { eave: 1.08, roofH: 1.0, win: 1, winRows: 2, bands: 2, winFaces: 'S', arch: [0.5, 0.3, 0.42] }),
          B('pavL', 0.02, 0.05, 0.4, 0.75, 0.45, 'mansard', { on: 'mainL', eave: 1.1, roofH: 1.4 }),
          B('pavR', 0.33, 0.05, 0.4, 0.75, 0.45, 'mansard', { on: 'mainR', eave: 1.1, roofH: 1.4 }),
          B('cupola', 0.05, 0.15, 0.4, 0.42, 0.3, 'dome', { on: 'center', domeScale: 1.3 }),
          solid('porch', 0.72, 0.72, 0.56, 0.26, 0.04, '#E6E1D6', 0.48),
          solid('rail', 0.72, 0.95, 0.56, 0.03, 0.08, GREY, 0.52) ]
          .concat(columns('pc', 0.76, 0.98, 0.48, 4, 0.48, WHITE, 0, 0.07)) },
      { id: 'lm:TPE-f08', name: '監察院', size: [2, 2], real: 2, vScale: 1.3, wstyle: 'arch', obs: '三項不能省略：L 形沿街兩翼圍出後方中庭、轉角入口退縮 + 四柱門廊 + 拱門、鼓座上的大圓頂主導屋頂層級（翼端小圓頂為從）。紅磚白橫帶 ×3、拱窗。',
        p: { wall: '#B8503A', roof: '#7F9A8C', door: '#4F5B6B', accent: WHITE }, chips: ['L 形 + 中庭', '轉角入口退縮 + 柱 ×4', '鼓座 + 大 dome', '翼端小 dome ×2', 'bands ×3'],
        blocks: [ B('wingN', 0, 0, 0.9, 1, 1.0, 'hip', { eave: 1.06, win: 2, winRows: 2, bands: 3, wstyle: 'arch' }),
          solid('court', 0.9, 0, 1.1, 1, 0.01, COURT),
          B('corner', 0, 1, 1, 0.85, 1.05, 'flat', { roofColor: '#A8473A', win: 2, winRows: 2, bands: 3, wstyle: 'arch', arch: [0.5, 0.26, 0.4] }),
          B('wingE', 1, 1.1, 1, 0.9, 1.0, 'hip', { eave: 1.06, win: 3, winRows: 2, bands: 3, wstyle: 'arch', winFaces: 'S' }),
          B('drum', 0.2, 0.15, 0.6, 0.55, 0.35, 'dome', { on: 'corner', domeScale: 1.3, wall: '#C9705B', bands: 2 }),
          B('domeN', 0.25, 0.05, 0.4, 0.4, 0.2, 'dome', { on: 'wingN', domeScale: 1.1 }),
          B('domeE', 0.55, 0.25, 0.4, 0.4, 0.2, 'dome', { on: 'wingE', domeScale: 1.1 }),
          solid('canopy', 0.25, 1.85, 0.5, 0.15, 0.04, WHITE, 0.45) ]
          .concat(columns('pc', 0.28, 2.0, 0.44, 4, 0.45, WHITE)) },
      { id: 'lm:TPE-f09', name: '迪化街街屋', size: [1, 2], real: 2, vScale: 1.3, obs: '三項不能省略：一樓退縮 0.25 的騎樓（柱有厚度、二樓跨越）、中段天井把長屋切成前後兩段、巴洛克山牆高出平頂。二樓三連拱窗、後段低矮 gable。',
        p: { wall: '#CFC7B4', roof: '#6F7F8C', door: '#8E6B50', accent: GREY }, chips: ['騎樓 退縮 + 柱 ×2', '天井 切前後段', '山牆 parapet 高出', '三連拱窗'],
        blocks: [ B('rear', 0, 0, 1, 0.9, 0.7, 'gable', { eave: 1.05, win: 1, winRows: 1 }),
          solid('well', 0.1, 0.9, 0.8, 0.25, 0.01, PAVE),
          solid('ground', 0, 1.15, 1, 0.6, 0.35, '#BFB7A4'),
          B('upper', 0, 1.15, 1, 0.85, 0.55, 'flat', { z: 0.35, roofColor: GREY, win: 3, winRows: 1, wstyle: 'arch', winFaces: 'S' }),
          B('parapet', 0.08, 0.72, 0.84, 0.1, 0.35, 'gable', { on: 'upper', ridge: 'd', eave: 1.0, wall: GREY }),
          solid('door', 0.3, 1.75, 0.4, 0.03, 0.3, '#8E6B50') ]
          .concat(columns('ac', 0, 2.0, 1, 2, 0.35, '#D9D4C7', 0, 0.08)) },
      { id: 'lm:TPE-f10', name: '台北 101', size: [3, 3], real: 101, vScale: 1.5, zoom: 0.7, obs: '三項不能省略：3×3 寬基座 + 兩層裙樓（塔身只佔基地 1.3×1.3）、倒梯形基座 1→0.7 向上收分、八節竹節每節上寬下窄外擴 1.1。塔冠兩段 + 尖塔。',
        p: { wall: '#7A9E99', roof: '#5C6A72', door: '#3A3A48', accent: '#9FC8D9' }, chips: ['3×3 寬基座 + 裙樓兩層', '倒梯形基座 1→0.7', '竹節 ×8 外擴 1.1', '塔冠 + 尖塔 1 格'],
        blocks: [ B('podium', 0, 0, 3, 3, 0.4, 'flat', { roofColor: '#B9D6DC', wall: '#9FC8D9', win: 3, winRows: 1, wstyle: 'strip', winColor: '#DCEBF0' }),
          B('podium2', 0.15, 0.1, 2.7, 1.0, 0.3, 'flat', { on: 'podium', roofColor: '#B9D6DC', wall: '#9FC8D9', win: 3, winRows: 1, wstyle: 'strip', winColor: '#DCEBF0' }),
          B('base', 0.85, 1.2, 1.3, 1.3, 1.9, 'flat', { on: 'podium', sBot: 1.0, sTop: 0.7, medal: true }),
          B('seg', 0.2, 0.2, 0.9, 0.9, 0.6, 'flat', { on: 'base', sBot: 0.8, sTop: 1.1, segments: 8 }),
          B('cap', 0.22, 0.22, 0.46, 0.46, 0.3, 'flat', { on: 'seg', sBot: 1, sTop: 0.75, wall: '#5C6A72' }),
          B('cap2', 0.1, 0.1, 0.26, 0.26, 0.25, 'flat', { on: 'cap', sBot: 1, sTop: 0.7, wall: '#5C6A72' }),
          B('spire', 0.1, 0.1, 0.06, 0.06, 0.95, 'spire', { on: 'cap2', wall: '#5C6A72' }) ] },
      { id: 'lm:TPE-f11', name: '圓山大飯店', size: [3, 2], real: 14, vScale: 1.5, obs: '三項不能省略：單一 2×1.2 方體 14 層（紅柱分割 ×7 橫帶）、金瓦重簷歇山（下簷環繞 11 樓、上簷出簷 1.45 極大）、正面牌樓門廊（六根實體柱 + 屋頂，可看穿）。低矮翼樓向後延伸。',
        p: { wall: '#B8503A', roof: '#C9A24A', door: '#8F3F22', accent: '#F2E4C8' }, chips: ['2×1.2 單一方體', 'hip2 重簷 出簷 1.45', '牌樓門廊 柱 ×6 可看穿', 'bands ×7 + 紅柱'],
        blocks: [ B('main', 0, 0.1, 2, 1.2, 1.25, 'hip2', { eave: 1.45, eave2: 0.8, roofH: 0.8, bands: 7, cols: true, arch: [0.5, 0.22, 0.2] }),
          B('wing', 2, 0.35, 1, 0.7, 0.35, 'hip', { eave: 1.1, roofColor: '#B5452E', win: 2, winRows: 2 }),
          B('porteRoof', 0.55, 1.35, 0.9, 0.3, 0.1, 'hip', { z: 0.28, eave: 1.35, roofH: 1.0, wall: '#B5452E' }) ]
          .concat(columns('pc', 0.6, 1.62, 0.8, 6, 0.28, '#C7453B')) },
      { id: 'lm:TPE-f12', name: '林安泰古厝', size: [3, 2], real: 1, vScale: 1.2, wstyle: 'lattice', obs: '三項不能省略：正身高、護龍低且向前的 U 字（屋脊高度差）、挖出來的前埕 + 矮圍牆開口、半月池在前。單層紅磚、橙瓦燕尾脊 ×3、小方窗木門。',
        p: { wall: '#C9705B', roof: '#C97D4B', door: '#8E6B50', accent: '#E2B45A' }, chips: ['正身高 / 護龍低', '埕 + 矮牆開口', '半月池', 'swallowtail ×3'],
        blocks: [ B('main', 0, 0, 3, 0.8, 0.9, 'swallowtail', { eave: 1.2, roofH: 0.6, win: 3, winRows: 1, winFaces: 'S', door: true }),
          B('wingL', 0, 0.8, 0.6, 1.0, 0.65, 'swallowtail', { eave: 1.1, roofH: 0.6, win: 1, winRows: 1 }),
          B('wingR', 2.4, 0.8, 0.6, 1.0, 0.65, 'swallowtail', { eave: 1.1, roofH: 0.6, win: 1, winRows: 1 }),
          solid('court', 0.6, 0.8, 1.8, 1.0, 0.02, PAVE),
          solid('wallL', 0.6, 1.78, 0.55, 0.05, 0.12, GREY), solid('wallR', 1.85, 1.78, 0.55, 0.05, 0.12, GREY),
          solid('pond', 0.8, 1.86, 1.4, 0.13, 0.01, '#9FC8D9') ] }
    ];
  }
  renderVals() {
    var self = this;
    var SW = 448, SH = 320;
    var items = this.data().map(function (L) {
      var zoom = L.zoom || 1, vScale = L.vScale || 1;
      var HW = 24 * zoom, HH = 12 * zoom, FPX = 22 * zoom * vScale;
      var W = L.size[0], D = L.size[1];
      var ox = SW / 2 + (D - W) * HW / 2, oy = SH - (W + D) * HH - 22;
      // expand segments
      var raw = [];
      L.blocks.forEach(function (b) {
        if (b.segments) {
          var prev = b.on;
          for (var s = 0; s < b.segments; s++) {
            var nb = Object.assign({}, b, { id: b.id + (s === 0 ? '' : s), on: prev, c: s === 0 ? b.c : (b.w * (1 - 1) / 2), r: s === 0 ? b.r : 0 });
            delete nb.segments;
            if (s > 0) { nb.c = 0; nb.r = 0; }
            raw.push(nb); prev = nb.id;
          }
          // let later blocks that reference b.id stack on the last segment
          L.blocks.forEach(function (o) { if (o.on === b.id) o.on = prev; });
        } else raw.push(b);
      });
      var byId = {};
      raw.forEach(function (b) { byId[b.id] = b; });
      function place(b) {
        var c = b.c, r = b.r, z0 = (b.z || 0) * FPX;
        if (b.on) { var pb = byId[b.on]; var pp = place(pb); c += pp.c; r += pp.r; z0 = pp.z0 + pp.h + (b.z || 0) * FPX; }
        return { c: c, r: r, z0: z0, h: (b.h !== undefined ? b.h : b.fl * b.fh) * FPX };
      }
      function pt(c, r, z) { return [ox + (c - r) * HW, oy + (c + r) * HH - z]; }
      var ground = { l: ox - D * HW, t: oy, w: (W + D) * HW, h: (W + D) * HH, clip: self.poly([[D * HW, 0], [(W + D) * HW, W * HH], [W * HW, (W + D) * HH], [0, D * HH]]) };
      var pad = 0.25, PW = W + 2 * pad, PD = D + 2 * pad;
      var plot = { l: ox - PD * HW, t: oy - pad * 2 * HH, w: (PW + PD) * HW, h: (PW + PD) * HH, clip: self.poly([[PD * HW, 0], [(PW + PD) * HW, PW * HH], [PW * HW, (PW + PD) * HH], [0, PD * HH]]) };
      var blocks = raw.map(function (b) {
        var P = place(b);
        var c = P.c, r = P.r, w = b.w, d = b.d, z0 = P.z0, h = P.h;
        var rowsN = b.winRows || Math.min(b.fl || 1, 3);
        var fpx = h / Math.max(1, rowsN);
        var bandStep = b.bands ? h / b.bands : fpx;
        var roofH = b.roofH || 1;
        var wall = b.wall || L.p.wall, roof = b.roofColor || L.p.roof, accent = b.accent || L.p.accent, door = L.p.door;
        var side = self.shade(wall, 0.86), roofDark = self.shade(roof, 0.8), winC = b.winColor || '#F3E7C8';
        var sB = b.sBot || 1, sT = b.sTop || 1, ev = b.eave || 1;
        var Tg = pt(c, r, 0), Rg = pt(c + w, r, 0), Bg = pt(c + w, r + d, 0), Lg = pt(c, r + d, 0);
        var C = [(Tg[0] + Bg[0]) / 2, (Tg[1] + Bg[1]) / 2];
        function sc(p, s) { return [C[0] + (p[0] - C[0]) * s, C[1] + (p[1] - C[1]) * s]; }
        var maxS = Math.max(sB, sT, ev);
        var left = C[0] - (w + d) * HW / 2 * maxS - 8, top = Tg[1] - z0 - h - 90;
        var cw = (w + d) * HW * maxS + 16, ch = (w + d) * HH * maxS + z0 + h + 100;
        function rel(p, z) { return [p[0] - left, p[1] - z - top]; }
        var parts = [], roofParts = [], target = parts; // roofParts = the overhanging roof, painted as its own layer above everything lower than the eave
        function add(pts, bg) { target.push({ l: 0, t: 0, w: cw, h: ch, bg: bg, clip: self.poly(pts), r: '0' }); }
        function face(zA, sA, zB, sBv) { // walls between height zA (scale sA) and zB (scale sB)
          add([rel(sc(Lg, sBv), zB), rel(sc(Bg, sBv), zB), rel(sc(Bg, sA), zA), rel(sc(Lg, sA), zA)], wall);
          add([rel(sc(Bg, sBv), zB), rel(sc(Rg, sBv), zB), rel(sc(Rg, sA), zA), rel(sc(Bg, sA), zA)], side);
          // line hierarchy: the front vertical corner is the primary plane-change line (1.2px, darkest)
          if (zB - zA > 6 && w >= 0.1 && d >= 0.1) { var e0 = rel(sc(Bg, sA), zA), e1 = rel(sc(Bg, sBv), zB); add([[e0[0] - 0.6, e0[1]], [e0[0] + 0.6, e0[1]], [e1[0] + 0.6, e1[1]], [e1[0] - 0.6, e1[1]]], self.shade(side, 0.62)); }
        }
        var zt = z0 + h;
        function topPoly(s, z) {
          var pts = [Tg, Rg, Bg, Lg].map(function (p) { return rel(sc(p, s), z); });
          if (b.shape === 'oct') {
            var o = [];
            for (var i = 0; i < 4; i++) { var a = pts[i], q = pts[(i + 1) % 4]; o.push([a[0] + (q[0] - a[0]) * 0.3, a[1] + (q[1] - a[1]) * 0.3]); o.push([a[0] + (q[0] - a[0]) * 0.7, a[1] + (q[1] - a[1]) * 0.7]); }
            return o;
          }
          return pts;
        }
        if (h > 0.5) {
          if (b.eave2) {
            var ze = z0 + h * b.eave2;
            var se = sB + (sT - sB) * b.eave2;
            face(z0, sB, ze, se);
            add(topPoly(ev * 0.95, ze + 3), roof); add(topPoly(ev * 0.95, ze), roofDark);
            face(ze, se, zt, sT);
          } else face(z0, sB, zt, sT);
        }
        // top / roof
        if (h > 0.5) {
          // ambient occlusion under an overhanging eave: a soft dark band on both walls just below the roof
          if (ev > 1.0 && b.roof !== 'flat') { var ao = Math.min(6, 2 + (ev - 1) * 14); add([rel(sc(Lg, sT), zt), rel(sc(Bg, sT), zt), rel(sc(Bg, sT), zt - ao), rel(sc(Lg, sT), zt - ao)], self.shade(wall, 0.78)); add([rel(sc(Bg, sT), zt), rel(sc(Rg, sT), zt), rel(sc(Rg, sT), zt - ao), rel(sc(Bg, sT), zt - ao)], self.shade(side, 0.78)); }
          if (b.roof !== 'flat' && b.roof !== 'dome' && b.roof !== 'spire') { var evv = b.eave || 1; target = roofParts; add(topPoly(evv, zt - 2.5), self.shade(roof, 0.7)); add(topPoly(evv, zt), roof); target = parts; }
          else add(topPoly(sT, zt), b.roof === 'flat' ? (b.id === 'base' || b.id.indexOf('seg') === 0 || b.id === 'cap' ? self.shade(wall, 1.08) : roof) : roof);
        } else add(topPoly(1, zt), wall);
        // bands (balcony / stripes)
        if (b.bands && h > 0.5) {
          for (var k = 1; k < b.bands; k++) {
            var hz = z0 + k * bandStep, f = (hz - z0) / h, s1 = sB + (sT - sB) * f;
            add([rel(sc(Lg, s1), hz), rel(sc(Bg, s1), hz), rel(sc(Bg, s1), hz - 1.5), rel(sc(Lg, s1), hz - 1.5)], accent);
            add([rel(sc(Bg, s1), hz), rel(sc(Rg, s1), hz), rel(sc(Rg, s1), hz - 1.5), rel(sc(Bg, s1), hz - 1.5)], self.shade(accent, 0.88));
          }
        }
        // columns on south face
        if (b.cols && h > 0.5) {
          var nc = Math.max(2, Math.round(d * 4 * (w >= 2 ? 1.5 : 1)));
          for (var i = 0; i < nc; i++) {
            var t = (i + 0.5) / nc;
            var a0 = sc(Lg, sB), b0 = sc(Bg, sB);
            var x = a0[0] + t * (b0[0] - a0[0]), y = a0[1] + t * (b0[1] - a0[1]);
            parts.push({ l: x - left - 1, t: y - zt - top, w: 2, h: h, bg: b.id === 'main' && L.id === 'lm:TPE-f11' ? '#C7453B' : accent, clip: 'none', r: '0' });
          }
        }
        // windows — drawn IN the face plane (parallelograms that follow the projection), aligned to floors, with a recess jamb
        // wstyle: rect | arch | round | lattice | shoji | strip | none ; sizes in cells (stylized scale: 0.14 × 0.16)
        var wstyle = b.wstyle || L.wstyle || 'rect';
        var winCols = b.win === undefined ? 2 : b.win;
        var glass = b.winColor || (wstyle === 'shoji' ? '#F3E7C8' : (wstyle === 'lattice' ? '#4A3B30' : '#5F6E7B'));
        function faceP(f, t, z) { // point on face f ('S' or 'E') at param t (0..1) and height z (px above ground)
          var ff = (z - z0) / Math.max(1, h), s = sB + (sT - sB) * Math.min(1, Math.max(0, ff));
          var A = f === 'S' ? sc(Lg, s) : sc(Bg, s), Q = f === 'S' ? sc(Bg, s) : sc(Rg, s);
          return rel([A[0] + t * (Q[0] - A[0]), A[1] + t * (Q[1] - A[1])], z);
        }
        function quad(f, t0, t1, zA, zB) { return [faceP(f, t0, zA), faceP(f, t1, zA), faceP(f, t1, zB), faceP(f, t0, zB)]; }
        function archPts(f, t0, t1, zA, zB, len) { // rect with a semicircular head, in the face plane
          var tc = (t0 + t1) / 2, rt = (t1 - t0) / 2, rz = rt * len; // rz: radius in px (face length px per unit t)
          var pts = [faceP(f, t0, zA), faceP(f, t1, zA)];
          for (var a = 0; a <= 6; a++) { var ang = a / 6 * Math.PI; pts.push(faceP(f, tc + rt * Math.cos(ang), zB - rz + rz * Math.sin(ang))); }
          return pts;
        }
        function roundPts(f, tc, zc, rt, len) { var pts = []; for (var a = 0; a < 10; a++) { var ang = a / 10 * Math.PI * 2; pts.push(faceP(f, tc + rt * Math.cos(ang), zc + rt * len * Math.sin(ang))); } return pts; }
        function drawWindow(f, tc, zc, faceLen) { // faceLen: cells along the face
          var ww = wstyle === 'strip' ? 0.62 : (wstyle === 'lattice' ? 0.12 : (wstyle === 'round' ? 0.16 : 0.14));
          var whc = wstyle === 'strip' ? 0.09 : (wstyle === 'lattice' ? 0.12 : (wstyle === 'round' ? 0.16 : (wstyle === 'arch' ? 0.2 : 0.16)));
          var rt = ww / 2 / faceLen, zh = whc * FPX, lenPx = faceLen * Math.sqrt(HW * HW + HH * HH) ;
          var t0 = tc - rt, t1 = tc + rt, zA = zc - zh / 2, zB = zc + zh / 2;
          var frame = f === 'S' ? self.shade(wall, 0.6) : self.shade(side, 0.6);
          var jamb = f === 'S' ? side : wall; // the visible reveal of a recessed opening is lit like the face it faces
          var paneC = f === 'S' ? glass : self.shade(glass, 0.88);
          var jt = Math.min(0.3, 0.03 / faceLen / (2 * rt)) * (t1 - t0); // jamb width 0.03 cell
          if (wstyle === 'round') { add(roundPts(f, tc, zc, rt, lenPx), frame); add(roundPts(f, tc + (f === 'S' ? jt * 0.5 : -jt * 0.5), zc, rt * 0.72, lenPx), paneC); return; }
          if (wstyle === 'arch') { add(archPts(f, t0, t1, zA, zB, lenPx), frame); add(f === 'S' ? quad(f, t0 + 0.08 * (t1 - t0), t0 + jt + 0.08 * (t1 - t0), zA + 1, zB - 1) : quad(f, t1 - jt - 0.08 * (t1 - t0), t1 - 0.08 * (t1 - t0), zA + 1, zB - 1), jamb); add(archPts(f, t0 + 0.14 * (t1 - t0) + (f === 'S' ? jt : 0), t1 - 0.14 * (t1 - t0) - (f === 'S' ? 0 : jt), zA + 1, zB - 1.2, lenPx * 0.72), paneC); return; }
          add(quad(f, t0, t1, zA, zB), frame);
          if (f === 'S') { add(quad(f, t0 + 0.1 * (t1 - t0), t0 + 0.1 * (t1 - t0) + jt, zA + 1, zB - 1), jamb); add(quad(f, t0 + 0.1 * (t1 - t0) + jt, t1 - 0.1 * (t1 - t0), zA + 1, zB - 1), paneC); }
          else { add(quad(f, t1 - 0.1 * (t1 - t0) - jt, t1 - 0.1 * (t1 - t0), zA + 1, zB - 1), jamb); add(quad(f, t0 + 0.1 * (t1 - t0), t1 - 0.1 * (t1 - t0) - jt, zA + 1, zB - 1), paneC); }
          if (wstyle === 'lattice' || wstyle === 'shoji') { var mc = (t0 + t1) / 2; add(quad(f, mc - 0.04 * (t1 - t0), mc + 0.04 * (t1 - t0), zA + 1, zB - 1), frame); add(quad(f, t0, t1, zc - 0.5, zc + 0.5), frame); }
        }
        if (winCols > 0 && h > 0.5 && wstyle !== 'none') {
          var rows = b.winRows || b.bands || Math.min(b.fl || 1, 3);
          var fH = h / rows; // one window row per floor, centred in the floor → windows and bands agree
          var faces = b.winFaces === 'S' ? ['S'] : ['S', 'E'];
          faces.forEach(function (f) {
            var faceLen = f === 'S' ? w : d;
            var n = Math.max(1, Math.min(winCols, Math.floor(faceLen / 0.26))); // rhythm: never closer than 0.26 cell
            if (wstyle === 'strip') n = Math.max(1, Math.floor(faceLen / 0.9));
            for (var fl = 0; fl < rows; fl++) {
              var zc = z0 + (fl + 0.55) * fH;
              if (fl === 0 && (b.door || b.arch) && f === 'S' && n <= 2) continue; // ground floor on the door face: door only
              for (var i2 = 0; i2 < n; i2++) { var tc = (i2 + 0.5) / n; if (fl === 0 && (b.door || b.arch) && f === 'S' && Math.abs(tc - 0.5) < 0.5 / n + 0.01) continue; drawWindow(f, tc, zc, faceLen); }
            }
          });
        }
        // door — in the face plane, ground floor centre of the south face
        if (b.door && !b.arch && h > 0.5) {
          var dw = 0.16 / w, dh = Math.min(h * 0.8, 0.26 * FPX), dst = (b.dstyle || L.dstyle || 'rect');
          var dpts = dst === 'arch' ? archPts('S', 0.5 - dw / 2, 0.5 + dw / 2, z0, z0 + dh, w * Math.sqrt(HW * HW + HH * HH)) : quad('S', 0.5 - dw / 2, 0.5 + dw / 2, z0, z0 + dh);
          add(dpts, self.shade(wall, 0.6)); add(quad('S', 0.5 - dw / 2 + 0.03 / w, 0.5 - dw / 2 + 0.06 / w, z0, z0 + dh - 1), side);
          add(dst === 'arch' ? archPts('S', 0.5 - dw / 2 + 0.06 / w, 0.5 + dw / 2 - 0.02 / w, z0, z0 + dh - 1, w * Math.sqrt(HW * HW + HH * HH) * 0.7) : quad('S', 0.5 - dw / 2 + 0.06 / w, 0.5 + dw / 2 - 0.02 / w, z0, z0 + dh - 1), door);
        }
        // arch opening carved into the south face (negative space)
        if (b.arch && h > 0.5) {
          var tc = b.arch[0], aw = b.arch[1], ah = b.arch[2], thru = b.arch[3];
          var La2 = sc(Lg, sB), Ba2 = sc(Bg, sB);
          var fp = function (t, z) { return rel([La2[0] + t * (Ba2[0] - La2[0]), La2[1] + t * (Ba2[1] - La2[1])], z0 + z); };
          var eLen = Math.sqrt(Math.pow(Ba2[0] - La2[0], 2) + Math.pow(Ba2[1] - La2[1], 2));
          var archPoly = function (cx, half, hh) {
            var rpx = half * eLen, pts = [fp(cx - half, 0), fp(cx + half, 0)];
            for (var a = 0; a <= 6; a++) { var ang = a / 6 * Math.PI; pts.push(fp(cx + half * Math.cos(ang), hh - rpx + rpx * Math.sin(ang))); }
            return pts;
          };
          add(archPoly(tc, aw / 2, h * ah), self.shade(wall, 0.42));
          add(archPoly(tc, aw / 2 * 0.62, h * ah * 0.8), thru ? '#C3DDCC' : self.shade(wall, 0.3));
        }
        // medallions (south face, upper)
        if (b.medal) { // 古錢圓徽：每面一枚，畫在牆面平面內
          var mz = z0 + h * 0.86, mlen = Math.sqrt(HW * HW + HH * HH);
          [['S', w], ['E', d]].forEach(function (fd) { var rt = 0.17 / fd[1]; add(roundPts(fd[0], 0.5, mz, rt, fd[1] * mlen), '#4F5B6B'); add(roundPts(fd[0], 0.5, mz, rt * 0.7, fd[1] * mlen), self.shade(wall, 1.05)); add(roundPts(fd[0], 0.5, mz, rt * 0.22, fd[1] * mlen), '#4F5B6B'); });
        }
        // lanterns at front corners
        if (b.lantern) {
          var lz = z0 + h * 0.7, La = sc(Lg, sB), Ba = sc(Bg, sB);
          [0.12, 0.88].forEach(function (t) { parts.push({ l: La[0] + t * (Ba[0] - La[0]) - left - 3, t: La[1] + t * (Ba[1] - La[1]) - lz - top - 4, w: 6, h: 8, bg: '#C7453B', clip: 'none', r: '3px' }); });
        }
        function inset(s, dz) { return topPoly(s, zt + dz * roofH); }
        target = roofParts;
        // roof forms (on top at zt) — real sloped planes so the silhouette carries the roof, not stacked slabs
        var rk = b.roof;
        var rh = 0.5 * Math.min(w, d) * FPX * roofH * 1.1; // 45° slope over half the short side, × roofH
        var alongC = b.ridge ? b.ridge === 'c' : w >= d; // ridge runs along the longer side unless ridge:'c'|'d' says otherwise
        var roofLite = self.shade(roof, 1.06), roofSide = roofDark, roofBack = self.shade(roof, 0.9);
        function corners(s, z) { return { T: rel(sc(Tg, s), z), R: rel(sc(Rg, s), z), B: rel(sc(Bg, s), z), L: rel(sc(Lg, s), z) }; }
        function mid(a, q) { return [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2]; }
        function hipRoof(s, z, height) { // 4 slopes meeting at a ridge; a square plan gives a point
          var k = corners(s, z), zr = z + height;
          var ins = Math.min(w, d) / 2 / Math.max(w, d) * 0.98; // how far the ridge ends sit in from the ends (fraction of long side)
          var rW, rE;
          if (alongC) { var nw = corners(s, zr); var a = mid(nw.T, nw.L), q = mid(nw.R, nw.B); rW = [a[0] + (q[0] - a[0]) * ins, a[1] + (q[1] - a[1]) * ins]; rE = [q[0] + (a[0] - q[0]) * ins, q[1] + (a[1] - q[1]) * ins]; }
          else { var nw2 = corners(s, zr); var a2 = mid(nw2.T, nw2.R), q2 = mid(nw2.L, nw2.B); rW = [a2[0] + (q2[0] - a2[0]) * ins, a2[1] + (q2[1] - a2[1]) * ins]; rE = [q2[0] + (a2[0] - q2[0]) * ins, q2[1] + (a2[1] - q2[1]) * ins]; }
          if (alongC) { add([k.T, k.R, rE, rW], roofBack); add([k.T, k.L, rW], roofBack); add([k.L, k.B, rE, rW], roof); add([k.B, k.R, rE], roofSide); }
          else { add([k.T, k.R, rE, rW], roofBack); add([k.T, k.L, rE, rW], roofLite); add([k.L, k.B, rE], roof); add([k.R, k.B, rE, rW], roofSide); }
          return zr;
        }
        function gableRoof(s, z, height, endColor) { // two slopes + triangular gable ends
          var k = corners(s, z), kt = corners(s, z + height);
          if (alongC) { var rW = mid(kt.T, kt.L), rE = mid(kt.R, kt.B); add([k.T, k.R, rE, rW], roofBack); add([k.L, k.B, rE, rW], roof); add([k.R, k.B, rE], endColor); }
          else { var rN = mid(kt.T, kt.R), rS = mid(kt.L, kt.B); add([k.T, k.L, rS, rN], roofLite); add([k.R, k.B, rS, rN], roofSide); add([k.L, k.B, rS], endColor); }
          return z + height;
        }
        function frustum(s0, zA, s1, zB, cS, cE) { // sloped skirt between two rectangles (lower eave of a 重簷, octagonal hall roof)
          var a = corners(s0, zA), q = corners(s1, zB);
          add([a.T, a.R, q.R, q.T], roofBack); add([a.T, a.L, q.L, q.T], roofBack);
          add([a.L, a.B, q.B, q.L], cS || roof); add([a.B, a.R, q.R, q.B], cE || roofSide);
        }
        function octFrustum(s0, zA, s1, zB) { var p0 = topPoly(s0, zA), p1 = topPoly(s1, zB); for (var i = 0; i < 8; i++) { var j = (i + 1) % 8; add([p0[i], p0[j], p1[j], p1[i]], i >= 3 && i <= 5 ? roof : (i === 6 || i === 2 ? roofSide : roofBack)); } }
        function finial(z, col) { target.push({ l: C[0] - left - 3, t: C[1] - z - top - 8, w: 6, h: 8, bg: col || accent, clip: 'none', r: '50%' }); }
        if (rk === 'hip' || rk === 'pagoda') {
          if (b.shape === 'oct') { octFrustum(ev, zt, ev * 0.12, zt + rh); finial(zt + rh); }
          else hipRoof(ev, zt, rh);
        }
        if (rk === 'gable') gableRoof(ev, zt, rh, wall);
        if (rk === 'mansard') { frustum(ev, zt, ev * 0.72, zt + rh * 0.7); add(topPoly(ev * 0.72, zt + rh * 0.7), roofLite); }
        if (rk === 'hip2') {
          var z1 = zt + rh * 0.45;
          if (b.shape === 'oct') { octFrustum(ev, zt, ev * 0.62, z1); var p = topPoly(ev * 0.62, z1), p2 = topPoly(ev * 0.62, z1 + rh * 0.3); for (var i6 = 0; i6 < 8; i6++) { var j6 = (i6 + 1) % 8; add([p[i6], p[j6], p2[j6], p2[i6]], i6 >= 3 && i6 <= 5 ? wall : side); } octFrustum(ev * 0.78, z1 + rh * 0.3, ev * 0.1, z1 + rh * 1.2); finial(z1 + rh * 1.2); }
          else { frustum(ev, zt, ev * 0.6, z1); var k1 = corners(ev * 0.6, z1), k2 = corners(ev * 0.6, z1 + rh * 0.3); add([k1.L, k1.B, k2.B, k2.L], wall); add([k1.B, k1.R, k2.R, k2.B], side); var zr2 = hipRoof(ev * 0.78, z1 + rh * 0.3, rh * 0.8); finial(zr2); }
        }
        if (rk === 'swallowtail' || rk === 'swallowtail2') {
          var zg = zt;
          if (rk === 'swallowtail2') { frustum(ev, zt, ev * 0.62, zt + rh * 0.4); var g1 = corners(ev * 0.62, zt + rh * 0.4), g2 = corners(ev * 0.62, zt + rh * 0.65); add([g1.L, g1.B, g2.B, g2.L], wall); add([g1.B, g1.R, g2.R, g2.B], side); zg = zt + rh * 0.65; ev = ev * 0.8; }
          var ztop = gableRoof(ev, zg, rh * 0.9, wall);
          // 燕尾：屋脊兩端翹起的小尖
          var kt3 = corners(ev, ztop);
          var tipA = alongC ? mid(kt3.T, kt3.L) : mid(kt3.T, kt3.R), tipB = alongC ? mid(kt3.R, kt3.B) : mid(kt3.L, kt3.B);
          add([[tipA[0] - 1, tipA[1] + 2], [tipA[0] + 3, tipA[1] + 1], [tipA[0] - 2, tipA[1] - 5]], accent);
          add([[tipB[0] + 1, tipB[1] + 2], [tipB[0] - 3, tipB[1] + 1], [tipB[0] + 2, tipB[1] - 5]], accent);
          add([[tipA[0], tipA[1] + 1.2], [tipB[0], tipB[1] + 1.2], [tipB[0], tipB[1] - 0.6], [tipA[0], tipA[1] - 0.6]], self.shade(roof, 0.7));
        }
        if (rk === 'dome') {
          add(inset(sT * 0.8, 2), roofDark); add(inset(sT * 0.8, 6), self.shade(wall, 0.95)); // drum
          var dia = (w + d) / 2 * HW * 1.15 * sT * (b.domeScale || 1);
          target.push({ l: C[0] - left - dia / 2, t: C[1] - zt - top - dia * 0.6 - 1, w: dia, h: dia * 0.8, bg: roof, clip: 'none', r: '50% 50% 45% 45%' });
          target.push({ l: C[0] - left - dia / 2, t: C[1] - zt - top - dia * 0.6 - 1, w: dia * 0.5, h: dia * 0.8, bg: self.shade(roof, 1.08), clip: 'none', r: '100% 0 0 100% / 50% 0 0 50%' });
          target.push({ l: C[0] - left - 2, t: C[1] - zt - top - dia * 0.6 - 7, w: 4, h: 7, bg: accent, clip: 'none', r: '2px' });
        }
        if (rk === 'spire') { target.push({ l: C[0] - left - 1.5, t: C[1] - z0 - top - h - 4, w: 3, h: h + 4, bg: '#5C6A72', clip: 'none', r: '2px' }); }
        function keyOf(bb) { var pp = place(bb); if (bb.on) return keyOf(byId[bb.on]) + 0.3 + (pp.z0 * 0.001); var hh = bb.h !== undefined ? bb.h : bb.fl * bb.fh; if (hh <= 0.03 && !bb.z) return -100 + (pp.c + bb.w) + (pp.r + bb.d); return (pp.c + bb.w) + (pp.r + bb.d); } // ground slabs (court, field, pond) always paint first
        var key = keyOf(b);
        var roofTop = roofParts.length ? (rk === 'dome' ? h / FPX + Math.min(w, d) * 0.6 : (zt + rh * (rk === 'hip2' ? 1.75 : 1)) / FPX - z0 / FPX) : 0;
        return { key: key, left: left, top: top, w: cw, h: ch, parts: parts, roofParts: roofParts, roofH: roofTop };
      });
      // painter's order: A is behind B when A is entirely west, entirely north or entirely below B (separating axis); ground slabs first; key breaks ties
      var onIdx = {}; raw.forEach(function (bb, i) { onIdx[bb.id] = i; });
      var entries = [];
      blocks.forEach(function (bl, i) { var bb = raw[i], pp = place(bb); var hh = bb.h !== undefined ? bb.h : bb.fl * bb.fh;
        bl.box = { id: i, on: bb.on ? onIdx[bb.on] : -1, c0: pp.c, c1: pp.c + bb.w, r0: pp.r, r1: pp.r + bb.d, z0: pp.z0 / FPX, z1: pp.z0 / FPX + hh, slab: hh <= 0.03 && !bb.z };
        entries.push(bl);
        if (bl.roofParts.length) { var ev2 = bb.eave || 1, cx = (bl.box.c0 + bl.box.c1) / 2, cy = (bl.box.r0 + bl.box.r1) / 2, hw2 = bb.w / 2 * ev2, hd2 = bb.d / 2 * ev2;
          entries.push({ key: bl.key + 0.0005, left: bl.left, top: bl.top, w: bl.w, h: bl.h, parts: bl.roofParts, roofParts: [], box: { id: 'roof' + i, roofOf: i, on: -1, c0: cx - hw2, c1: cx + hw2, r0: cy - hd2, r1: cy + hd2, z0: bl.box.z1, z1: bl.box.z1 + bl.roofH, slab: false } }); }
      });
      blocks = entries;
      // screen bounding box per entry: two entries that never overlap on screen need no ordering edge (this removes most false cycles)
      function sbOf(bl) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; bl.parts.forEach(function (p) {
        if (p.clip === 'none') { x0 = Math.min(x0, bl.left + p.l); y0 = Math.min(y0, bl.top + p.t); x1 = Math.max(x1, bl.left + p.l + p.w); y1 = Math.max(y1, bl.top + p.t + p.h); }
        else { var nums = p.clip.match(/-?[\d.]+/g).map(Number); for (var q = 0; q < nums.length; q += 2) { x0 = Math.min(x0, bl.left + nums[q]); x1 = Math.max(x1, bl.left + nums[q]); y0 = Math.min(y0, bl.top + nums[q + 1]); y1 = Math.max(y1, bl.top + nums[q + 1]); } } });
        return { x0: x0, y0: y0, x1: x1, y1: y1 }; }
      blocks.forEach(function (bl) { bl.sb = sbOf(bl); });
      function overlaps(a, b) { return a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5; }
      var byId2 = {}; blocks.forEach(function (o) { byId2[String(o.box.id)] = o; });
      var EPS = 0.02;
      function behind(A, B) { if (A.slab && !B.slab) return true; if (B.slab && !A.slab) return false; return A.c1 <= B.c0 + EPS || A.r1 <= B.r0 + EPS || A.z1 <= B.z0 + EPS; }
      // intersecting boxes (a corner buttress embedded in a hall) have no separating axis: the one that reaches further
      // toward the viewer on the axis where they overlap least is in front (further south when they share columns, further east when they share rows)
      function isBehind(A, B) {
        if (B.roofOf === A.id) return true;  if (A.roofOf === B.id) return false;   // a body is under its own roof
        var pA = A.roofOf !== undefined ? byId2[String(A.roofOf)].box.on : A.on, pB = B.roofOf !== undefined ? byId2[String(B.roofOf)].box.on : B.on; // parent of a block, or of a roof's body
        if (pA >= 0 && (pA === B.id || pA === B.roofOf)) return false; if (pB >= 0 && (pB === A.id || pB === A.roofOf)) return true; // a stacked block (and its roof) sits on top of its parent (and its parent's roof)
        var ab = behind(A, B), ba = behind(B, A);
        if (ab !== ba) return ab;
        if (A.slab || B.slab) return A.slab && !B.slab;
        var oc = Math.min(A.c1, B.c1) - Math.max(A.c0, B.c0), orr = Math.min(A.r1, B.r1) - Math.max(A.r0, B.r0);
        if (oc >= orr) return A.r1 < B.r1 - EPS; // share columns → compare south extent
        return A.c1 < B.c1 - EPS;                 // share rows → compare east extent
      }
      var ordered = [], state = {};
      var byKey = blocks.slice().sort(function (a, b) { return a.key - b.key; });
      // cycles are unavoidable with L-shaped plans; the two relations that must never be broken are
      // body → its roof and parent → stacked child, so an entry reached while its body / parent is still open is deferred and emitted right after it
      var deferred = {};
      function sidOf(bl) { return String(bl.box.id); }
      function open_(id) { var st = state[String(id)]; return st === 1 || st === 3; }
      function emit(bl) { if (state[sidOf(bl)] === 2) return; state[sidOf(bl)] = 2; ordered.push(bl); var ds = (deferred[bl.box.id] || []).slice(); delete deferred[bl.box.id]; ds.sort(function (x, y) { return (x.box.roofOf !== undefined ? 0 : 1) - (y.box.roofOf !== undefined ? 0 : 1); }); ds.forEach(emit); }
      function defer(bl, id) { if (state[sidOf(bl)]) return; (deferred[id] = deferred[id] || []).push(bl); state[sidOf(bl)] = 3; }
      function visit(bl) {
        var sid = sidOf(bl); if (state[sid]) return;
        function need(id) { // make sure `id` is painted before bl; if it cannot be yet (open or deferred), defer bl behind it
          var e = byId2[String(id)]; if (!state[String(id)]) visit(e);
          if (state[String(id)] !== 2) { defer(bl, id); return false; } return true;
        }
        if (bl.box.roofOf !== undefined) { if (!need(bl.box.roofOf)) return; }
        else if (bl.box.on >= 0) { // a stacked child waits for its parent AND the parent's roof (it sits on top of both)
          // the parent is painted in its own natural position; the child is simply emitted right after the parent (or the parent's roof)
          var pr = byId2['roof' + bl.box.on];
          if (state[String(bl.box.on)] !== 2 || (pr && state[sidOf(pr)] !== 2)) { defer(bl, pr ? pr.box.id : bl.box.on); return; }
        }
        if (state[sid]) return; // may have been painted (or deferred) while its parent was being visited
        state[sid] = 1;
        byKey.forEach(function (o) { if (o !== bl && overlaps(o.sb, bl.sb) && isBehind(o.box, bl.box)) visit(o); });
        emit(bl);
      }
      byKey.forEach(visit);
      blocks = ordered;
      // fit: scale the whole scene so its bounding box fills the 448×320 frame (relative scale is kept by size + zoom, fit only normalises margins)
      var bx0 = plot.l, by0 = plot.t, bx1 = plot.l + plot.w, by1 = plot.t + plot.h;
      blocks.forEach(function (bl) { bl.parts.forEach(function (p) {
        if (p.clip === 'none') { bx0 = Math.min(bx0, bl.left + p.l); by0 = Math.min(by0, bl.top + p.t); bx1 = Math.max(bx1, bl.left + p.l + p.w); by1 = Math.max(by1, bl.top + p.t + p.h); }
        else { var nums = p.clip.match(/-?[\d.]+/g).map(Number); for (var q = 0; q < nums.length; q += 2) { bx0 = Math.min(bx0, bl.left + nums[q]); bx1 = Math.max(bx1, bl.left + nums[q]); by0 = Math.min(by0, bl.top + nums[q + 1]); by1 = Math.max(by1, bl.top + nums[q + 1]); } }
      }); });
      var bw = Math.max(1, bx1 - bx0), bh = Math.max(1, by1 - by0);
      // one shared display scale (1.25) so relative size between landmarks is kept; only a scene too tall for the frame (101) is reduced to fit
      var fs = Math.min((SW - 48) / bw, (SH - 40) / bh, 1.25 * (L.fit || 1));
      var fit = { s: +fs.toFixed(3), tx: +((SW - bw * fs) / 2 - bx0 * fs).toFixed(1), ty: +((SH - bh * fs) / 2 - by0 * fs).toFixed(1) };
      var ss = Math.min(84 / bw, 56 / bh);
      var sil = { s: +ss.toFixed(3), tx: +((96 - bw * ss) / 2 - bx0 * ss).toFixed(1), ty: +((66 - bh * ss) / 2 - by0 * ss).toFixed(1) };
      return {
        id: L.id, name: L.name, obs: L.obs, chips: L.chips, sizeText: W + '×' + D, blockCount: raw.length, realFloors: L.real,
        wall: L.p.wall, roof: L.p.roof, door: L.p.door, accent: L.p.accent,
        ground: ground, plot: plot, blocks: blocks, fit: fit, sil: sil
      };
    });
    return { items: items };
  }
}

class HousesBoard extends LandmarksBoard {
  data() {
    var self = this;
    // 風格化尺度：樓層 0.3 格、窗洞 0.14×0.16、欄杆厚 0.03、簷深 0.12–0.25、冷氣 0.1×0.08、鐵窗籠外推 0.1
    var IRON = '#4F5B6B', STEEL = '#B9BEC2', SHEET = '#6E8A9C', CONC = '#B9B5A8', RAIL = '#8E8A80';
    function B(id, c, r, w, d, h, roof, o) { return Object.assign({ id: id, c: c, r: r, w: w, d: d, h: h, roof: roof, win: 0 }, o || {}); }
    function solid(id, c, r, w, d, h, col, z) { return B(id, c, r, w, d, h, 'flat', { wall: col, roofColor: col, z: z }); }
    function balconies(pre, c, r, w, n, step, col) { var o = []; for (var k = 1; k <= n; k++) { var z = k * step; o.push(solid(pre + 'b' + k, c, r, w, 0.12, 0.04, col, z - 0.04)); o.push(solid(pre + 'r' + k, c, r + 0.09, w, 0.03, 0.1, RAIL, z)); } return o; }
    function cages(pre, c, r, w, floors, cols, step, z0) { var o = []; for (var k = 0; k < floors; k++) for (var i = 0; i < cols; i++) { var x = c + (i + 0.5) / cols * w - 0.07; o.push(solid(pre + 'c' + k + i, x, r, 0.14, 0.1, 0.17, IRON, z0 + k * step + 0.08)); } return o; }
    function acs(pre, c, r, list) { return list.map(function (p, i) { return solid(pre + 'ac' + i, c + p[0], r, 0.1, 0.08, 0.08, '#D9D4C7', p[1]); }); }
    function columns(pre, c, r, w, n, h, col) { var o = []; for (var i = 0; i < n; i++) { var x = c + (i + 0.5) / n * w - 0.03; o.push(solid(pre + 'col' + i, x, r - 0.06, 0.06, 0.06, h, col || '#D9D4C7', 0)); } return o; }
    function tank(id, c, r, z, on) { return B(id, c, r, 0.14, 0.14, 0.16, 'dome', { on: on, wall: STEEL, roofColor: STEEL }); }
    return [
      { id: 'sys:iron', name: '鐵窗透天厝', size: [1, 1], real: 4, vScale: 1.3, obs: '不可省略：窄面寬高樓（0.6 格寬、4 層）、外推鐵窗籠（深度）、頂樓鐵皮加蓋 + 水塔。一樓鐵捲門、招牌附著在二樓牆面。',
        p: { wall: '#D9D4C7', roof: CONC, door: IRON, accent: '#C7453B' }, chips: ['窄高 0.6×1', '鐵窗籠 ×8 外推', '加蓋 + 水塔', '鐵捲門'],
        blocks: [ B('body', 0.2, 0, 0.6, 1, 1.2, 'flat', { roofColor: CONC, win: 2, winRows: 4, winFaces: 'S', winColor: '#5C6A72', bands: 0 }),
          solid('door', 0.3, 1.0, 0.4, 0.03, 0.26, IRON, 0),
          solid('sign', 0.22, 1.0, 0.56, 0.05, 0.12, '#C7453B', 0.36) ]
          .concat(cages('f', 0.2, 1.0, 0.6, 3, 2, 0.3, 0.3))
          .concat([ B('shed', 0.05, 0.1, 0.5, 0.8, 0.22, 'gable', { on: 'body', roofH: 0.6, roofColor: SHEET, wall: '#9A9A94' }), tank('tank', 0.44, 0.05, 0, 'body') ]) },
      { id: 'sys:apartment', name: '老公寓（五樓）', size: [1, 1], real: 5, vScale: 1.3, obs: '不可省略：寬面量體（整格寬、進深 0.8）、每層兩戶的重複懸挑陽台 + 欄杆厚度、外掛冷氣與鐵窗。後方樓梯間量體高出屋頂，頂樓水塔。',
        p: { wall: '#CFC7B4', roof: CONC, door: IRON, accent: RAIL }, chips: ['整格寬 1×0.8', '陽台 ×5 懸挑', '冷氣 ×4', '樓梯間 + 水塔'],
        blocks: [ B('body', 0, 0.1, 1, 0.8, 1.5, 'flat', { roofColor: CONC, win: 3, winRows: 5, winFaces: 'S', winColor: '#5C6A72' }),
          solid('stair', 0.4, 0.08, 0.22, 0.12, 1.7, '#C4BBA8', 0),
          solid('shop', 0.05, 0.9, 0.9, 0.03, 0.26, IRON, 0) ]
          .concat(balconies('a', 0.08, 0.9, 0.84, 5, 0.3, '#E6E1D6'))
          .concat(acs('a', 0, 0.9, [[0.12, 0.62], [0.78, 0.62], [0.12, 1.22], [0.78, 0.92]]))
          .concat([ tank('tank', 0.08, 0.1, 0, 'body') ]) },
      { id: 'sys:tilehighrise', name: '磁磚電梯大樓', size: [1, 1], real: 12, vScale: 1.3, obs: '不可省略：整格寬 12 層量體、每層雨遮 + 內凹窗洞的節奏、梯廳核心筒突出屋頂。磁磚用細分割線（bands）而非單色。',
        p: { wall: '#E6DCCB', roof: '#9A9A94', door: IRON, accent: CONC }, chips: ['1×0.9 12F', '雨遮 ×12', '窗洞內凹 3×6', '核心筒 + 機房'],
        blocks: [ B('body', 0.05, 0.05, 0.9, 0.9, 3.0, 'flat', { roofColor: '#9A9A94', win: 3, winRows: 12, winFaces: 'S', winColor: '#7A8B99', bands: 12 }),
          solid('core', 0.35, 0.02, 0.3, 0.2, 3.3, '#D4C9BA', 0),
          solid('lobby', 0.3, 0.95, 0.4, 0.03, 0.3, '#7A8B99', 0) ]
          .concat(balconies('t', 0.08, 0.95, 0.35, 11, 0.25, '#D9D4C7'))
          .concat([ tank('tank', 0.08, 0.7, 0, 'body'), B('mech', 0.1, 0.1, 0.25, 0.25, 0.12, 'flat', { on: 'body', wall: CONC, roofColor: CONC }) ]) },
      { id: 'sys:shophouse', name: '連棟騎樓街屋', size: [3, 1], real: 3, vScale: 1.3, obs: '不可省略：一樓退縮的騎樓負空間（柱列有厚度、上層跨越）、三戶連續量體各自不同高度與顏色、鐵捲門與招牌附著在柱間。',
        p: { wall: '#D9D4C7', roof: RAIL, door: '#8E6B50', accent: '#C9705B' }, chips: ['3×1 三連棟', '騎樓退縮 0.3', '柱列 ×6', '招牌附柱間'],
        blocks: [0, 1, 2].reduce(function (acc, i) {
          var cols = ['#D9D4C7', '#E9C9A8', '#CFC7B4'][i], hs = [0.9, 1.0, 0.85][i], x = i;
          acc.push(solid('g' + i, x, 0, 1, 0.7, 0.3, self.shade(cols, 0.9), 0));
          acc.push(B('u' + i, x, 0, 1, 1, hs - 0.3, 'flat', { z: 0.3, wall: cols, roofColor: CONC, win: 2, winRows: 2, winFaces: 'S', bands: 2 }));
          acc.push(solid('d' + i, x + 0.25, 0.7, 0.5, 0.03, 0.26, IRON, 0));
          acc.push(solid('s' + i, x + 0.1, 1.0, 0.8, 0.05, 0.12, ['#C9705B', '#4A6FA5', '#2F7A5C'][i], 0.36));
          return acc.concat(columns('p' + i, x, 1.0, 1, 2, 0.3));
        }, []) },
      { id: 'sys:factory', name: '鐵皮工廠', size: [3, 2], real: 1, vScale: 1.3, wstyle: 'strip', obs: '不可省略：橫向大跨距量體（3×1.6）、挑高雙坡鐵皮屋頂（屋脊 + 通風球）、正面大鐵捲門洞。側邊低矮辦公室、卸貨雨棚。',
        p: { wall: '#9FB3BF', roof: SHEET, door: IRON, accent: STEEL }, chips: ['3×1.6 大跨距', '挑高 0.75', '通風球 ×3', '大門洞 + 卸貨棚'],
        blocks: [ B('hall', 0, 0, 2.4, 1.6, 0.75, 'gable', { eave: 1.05, roofH: 0.35, win: 2, winRows: 1, winColor: '#D9E2E8' }),
          solid('door', 0.5, 1.6, 0.8, 0.03, 0.55, IRON, 0),
          solid('canopy', 0.4, 1.6, 1.0, 0.3, 0.03, STEEL, 0.58),
          solid('office', 2.4, 0.3, 0.6, 0.9, 0.32, '#D9D4C7', 0),
          B('v1', 0.5, 0.75, 0.12, 0.12, 0.08, 'dome', { on: 'hall', z: 0.3, wall: STEEL, roofColor: STEEL }),
          B('v2', 1.15, 0.75, 0.12, 0.12, 0.08, 'dome', { on: 'hall', z: 0.3, wall: STEEL, roofColor: STEEL }),
          B('v3', 1.8, 0.75, 0.12, 0.12, 0.08, 'dome', { on: 'hall', z: 0.3, wall: STEEL, roofColor: STEEL }) ]
          .concat(columns('cp', 0.4, 1.9, 1.0, 2, 0.58, STEEL)) },
      { id: 'sys:sanheyuan', name: '三合院', size: [3, 2], real: 1, vScale: 1.3, wstyle: 'lattice', obs: '不可省略：正身（高、燕尾脊）主、護龍（低、向前）從的 U 字平面、挖出來的前埕與院落、前方矮圍牆開口。',
        p: { wall: '#C9705B', roof: '#C97D4B', door: '#8E6B50', accent: '#E2B45A' }, chips: ['3×2 U 字', '正身高 / 護龍低', '埕 + 圍牆', 'swallowtail'],
        blocks: [ B('main', 0, 0, 3, 0.75, 0.48, 'swallowtail', { eave: 1.15, win: 3, winRows: 1, winFaces: 'S', door: true }),
          B('wingL', 0, 0.75, 0.6, 1.1, 0.32, 'hip', { eave: 1.1, win: 1, winRows: 1 }),
          B('wingR', 2.4, 0.75, 0.6, 1.1, 0.32, 'hip', { eave: 1.1, win: 1, winRows: 1 }),
          solid('court', 0.6, 0.75, 1.8, 1.1, 0.01, '#D9CFB8', 0),
          solid('wallL', 0.6, 1.9, 0.6, 0.05, 0.1, '#B9B5A8', 0),
          solid('wallR', 1.8, 1.9, 0.6, 0.05, 0.1, '#B9B5A8', 0) ] },
      { id: 'sys:temple', name: '小廟（土地公廟）', size: [1, 1], real: 1, vScale: 1.3, wstyle: 'lattice', obs: '不可省略：主入口軸線上的層級——台階、前埕、柱廊拜亭、深簷正殿；重簷燕尾脊 + 脊飾；燈籠在柱上。',
        p: { wall: '#B8503A', roof: '#C97D4B', door: '#C7453B', accent: '#E2B45A' }, chips: ['軸線層級 4 段', '重簷燕尾 出簷 1.35', '拜亭柱廊', '台階 + 前埕'],
        blocks: [ solid('plinth', 0.1, 0.05, 0.8, 0.9, 0.06, '#B9B5A8', 0),
          B('hall', 0.18, 0.08, 0.64, 0.5, 0.5, 'swallowtail2', { on: 'plinth', eave: 1.35, roofH: 1.2, win: 1, winRows: 1, winFaces: 'S', door: true, lantern: true }),
          B('porch', 0.22, 0.58, 0.56, 0.3, 0.38, 'swallowtail', { on: 'plinth', eave: 1.3, cols: true }),
          solid('steps', 0.3, 0.95, 0.4, 0.08, 0.03, '#CFC7B4', 0) ] },
      { id: 'sys:jpdorm', name: '日式木造宿舍', size: [1, 1], real: 1, vScale: 1.3, wstyle: 'shoji', obs: '不可省略：抬高基座（通風）、黑瓦寄棟大出簷（1.3）、前方緣側 + 深雨庇；雨淋板木牆、玄關小屋頂。台灣脈絡：高基座、深簷、通風口。',
        p: { wall: '#8E6B50', roof: IRON, door: '#5E5A55', accent: '#D9D4C7' }, chips: ['基座 0.12 架高', '黑瓦 hip 出簷 1.3', '緣側 + 雨庇', '玄關 gable'],
        blocks: [ solid('plinth', 0.05, 0.05, 0.9, 0.9, 0.12, '#9A9A94', 0),
          B('house', 0.1, 0.05, 0.8, 0.62, 0.4, 'hip', { on: 'plinth', eave: 1.3, roofH: 1.2, win: 3, winRows: 1, winColor: '#F3E7C8', door: true }),
          solid('engawa', 0.1, 0.67, 0.8, 0.18, 0.03, '#A68A6C', 0.12),
          solid('hisashi', 0.08, 0.66, 0.84, 0.22, 0.03, IRON, 0.46),
          B('genkan', 0.62, 0.84, 0.26, 0.1, 0.3, 'gable', { on: 'plinth', eave: 1.2 }) ] },
      { id: 'sys:village', name: '眷村連棟平房', size: [3, 1], real: 1, vScale: 1.3, obs: '不可省略：共用一片屋頂的重複單元（戶界牆露出）、每戶前院矮牆、各戶自加的鐵皮雨棚顏色不同；水塔、曬衣架等增生物。',
        p: { wall: '#CFC7B4', roof: '#9A9A94', door: IRON, accent: '#7F9A8C' }, chips: ['3×1 四連棟', '共用 gable 頂', '前院 ×4 矮牆', '雨棚 ×4 異色'],
        blocks: [ B('row', 0, 0, 3, 0.55, 0.32, 'gable', { eave: 1.04, roofH: 0.8, win: 4, winRows: 1, winFaces: 'S', door: true }),
          solid('yard', 0, 0.55, 3, 0.45, 0.01, '#D9CFB8', 0) ]
          .concat([0, 1, 2, 3].reduce(function (acc, i) {
            var x = i * 0.75;
            acc.push(solid('div' + i, x, 0.55, 0.03, 0.45, 0.1, '#B9B5A8', 0));
            acc.push(solid('fw' + i, x + 0.05, 0.97, 0.65, 0.03, 0.1, '#B9B5A8', 0));
            acc.push(solid('awn' + i, x + 0.05, 0.55, 0.65, 0.28, 0.03, ['#7F9A8C', '#6E8A9C', '#B5452E', '#9A9A94'][i], 0.22));
            return acc;
          }, []))
          .concat([ tank('tank', 2.3, 0.1, 0, 'row') ]) },
      { id: 'sys:farmhouse', name: '新式農舍', size: [2, 2], real: 3, vScale: 1.3, obs: '不可省略：基地比例（房子只佔 2×2 的四分之一，其餘是田與前庭）、一樓半開放的柱廊停車空間、寬簷斜頂 + 二三樓陽台；角落儲藏工作間。',
        p: { wall: '#E6DCCB', roof: '#B5452E', door: '#8E6B50', accent: '#D9D4C7' }, chips: ['2×2 基地 / 房 1×0.8', '一樓半開放', 'hip 出簷 1.25', '儲藏間 + 圍牆'],
        blocks: [ solid('field', 0, 0, 2, 2, 0.01, '#B9C9A4', 0),
          solid('wallF', 0, 1.97, 2, 0.03, 0.08, '#B9B5A8', 0),
          solid('ground', 0.5, 0.3, 1.0, 0.55, 0.3, '#D9D4C7', 0),
          B('body', 0.5, 0.3, 1.0, 0.8, 0.6, 'hip', { z: 0.3, eave: 1.25, roofH: 1.3, win: 2, winRows: 2, winFaces: 'S', bands: 2 }),
          solid('shed', 1.55, 1.5, 0.4, 0.4, 0.25, '#9FB3BF', 0) ]
          .concat(columns('fc', 0.5, 1.1, 1.0, 3, 0.3, '#D9D4C7'))
          .concat(balconies('f', 0.5, 1.1, 1.0, 1, 0.6, '#D9D4C7')) }
    ];
  }
}

function render(board) { return (board === 'houses' ? new HousesBoard() : new LandmarksBoard()).renderVals().items; }
if (typeof module !== 'undefined') module.exports = { LandmarksBoard, HousesBoard, render };
if (typeof require !== 'undefined' && require.main === module) {
  var which = process.argv[2] || 'landmarks';
  render(which).forEach(function (it) { console.log(it.id, it.sizeText, 'entries', it.blocks.length); });
}
