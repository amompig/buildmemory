// ui.js — DOM 疊層（三 tab、城鎮工具列／擺放橫幅／倉庫抽屜、toast、?dev=1 面板）
// 不碰 three、不改 store：使用者操作一律轉成 intent 交給 onIntent。
import * as R from '../shared/rules.js';

const { RULES, isUnlocked, unlockedSize } = R;

// ui_strings 還沒由 Design 填值時的暫用文案（鍵同 design/ui_strings.template.json；town.place_here / town.remove 為新增鍵）
const FALLBACK = {
  town: {
    tab: '城鎮', mode_view: '看', mode_place: '擺放', banner_placing: '擺放中', undo: '復原', done: '完成',
    tool_road: '道路', rotate: '旋轉', fit: '置中', place_here: '放這裡', remove: '收回倉庫',
    cell_locked: '這格還沒解鎖', cell_occupied: '這格已經有東西了', cell_no_road: '房子要貼著路',
    road_orphan: '拿掉這段路，旁邊的房子就沒路了', unlock_progress: '擴張 {n}%', empty: '倉庫空了，去地圖打卡吧',
  },
  map: { tab: '地圖' },
  inventory: { tab: '倉庫', empty: '倉庫空了，去地圖打卡吧' },
  error: {
    too_far: '再走約 {dist} m', weak_signal: '定位訊號太弱，到空曠一點再試', cooldown: '今天來過這裡了，{until} 後再來',
    daily_cap: '今天打卡次數到上限了', rate_limited: '{retry_after} 秒後再試', invalid: '這樣不行喔', offline: '有訊號再按',
  },
};
// 錯誤參數轉人話（時間轉台北時間）
const fmtParams = (r) => ({ ...r, until: r.until && new Date(r.until).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ICON = { left: '⟲', right: '⟳', fit: '⤢' };

export function createUI(root, { strings = {}, houses, onIntent }) {
  const byId = new Map(houses.map((h) => [h.id, h]));
  const t = (key, params = {}) => {
    const [a, b] = key.split('.');
    const raw = strings[a]?.[b] || FALLBACK[a]?.[b] || key;
    return raw.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
  };
  // 規則拒絕原因 → 人話（不出現裸錯誤碼）
  const reasonText = (r) => ({ locked: t('town.cell_locked'), occupied: t('town.cell_occupied'), no_road: t('town.cell_no_road'), orphan: t('town.road_orphan') }[r.reason] ?? t(`error.${r.code}`, fmtParams(r)));

  root.innerHTML = '<div class="ui-top"></div><div class="ui-side"></div><div class="ui-bottom"></div><div class="ui-page"></div><div class="toast" role="status" aria-live="polite"></div>';
  const $ = (sel) => root.querySelector(sel);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-intent]');
    if (b) onIntent({ type: b.dataset.intent, ...JSON.parse(b.dataset.arg || '{}') });
  });
  const btn = (intent, label, arg, cls = '') => `<button class="${cls}" data-intent="${intent}"${arg ? ` data-arg='${esc(JSON.stringify(arg))}'` : ''}>${label}</button>`;

  function progress(grid) {
    const size = unlockedSize(grid);
    if (size >= RULES.GRID) return '';
    let cells = 0, filled = 0;
    for (let i = 0; i < grid.length; i++) if (isUnlocked(i, size)) { cells++; if (grid[i] !== null) filled++; }
    const pct = Math.min(100, Math.round((filled / cells / RULES.UNLOCK_RATIO) * 100));
    return `<div class="progress" aria-label="${esc(t('town.unlock_progress', { n: pct }))}"><i style="width:${pct}%"></i><span>${esc(t('town.unlock_progress', { n: pct }))}</span></div>`;
  }

  function card(g, active) {
    const h = byId.get(g.item_id), wall = h?.palettes?.[g.seed]?.wall ?? h?.palettes?.[0]?.wall ?? '#ccc';
    return btn('tool', `<i class="swatch" style="background:${esc(wall)}"></i>${esc(h?.name ?? g.item_id)}<small>${esc(g.at.slice(5, 10).replace('-', '/'))}</small>`,
      { tool: { kind: 'house', grantId: g.id } }, `card${active ? ' on' : ''}`);
  }

  return {
    t, reasonText,

    // s = { grid, grants }；v = { tab, mode, tool, ghost, sel, canUndo }
    render(s, v) {
      root.dataset.tab = v.tab; root.dataset.mode = v.mode;
      const tabs = ['map', 'town', 'inventory'].map((k) => btn('tab', esc(t(`${k}.tab`)), { tab: k }, v.tab === k ? 'on' : '')).join('');
      const stock = s.grants.filter((g) => g.kind === 'house' && g.state === 'stock').sort((a, b) => (a.at < b.at ? 1 : -1));

      if (v.tab !== 'town') {
        $('.ui-top').innerHTML = $('.ui-side').innerHTML = '';
        $('.ui-page').innerHTML = v.tab === 'map'
          ? '<p class="muted">地圖與打卡：Sprint 1</p>'
          : (stock.length ? `<ul class="inv">${stock.map((g) => `<li>${card(g, false)}</li>`).join('')}</ul>` : `<p class="muted">${esc(t('inventory.empty'))}</p>`);
        $('.ui-bottom').innerHTML = `<nav class="tabs">${tabs}</nav>`;
        return;
      }
      $('.ui-page').innerHTML = '';
      const tool = v.tool;
      if (v.mode === 'view') {
        $('.ui-top').innerHTML = progress(s.grid);
        $('.ui-side').innerHTML = btn('view', ICON.left, { delta: -1 }) + btn('view', ICON.right, { delta: 1 }) + btn('fit', ICON.fit);
        $('.ui-bottom').innerHTML = `<div class="bar">${btn('mode', esc(t('town.mode_place')), { mode: 'place' }, 'primary')}</div><nav class="tabs">${tabs}</nav>`;
        return;
      }
      // 擺放：頂部橫幅「擺放中・復原・完成」；選中房／幽靈時的動作列；底欄抽屜（第一格道路）
      $('.ui-top').innerHTML = `<div class="banner"><b>${esc(t('town.banner_placing'))}</b>${btn('undo', esc(t('town.undo')), null, v.canUndo ? '' : 'dim')}${btn('done', esc(t('town.done')), null, 'primary')}</div>`;
      $('.ui-side').innerHTML = btn('view', ICON.left, { delta: -1 }) + btn('view', ICON.right, { delta: 1 }) + btn('fit', ICON.fit);
      let actions = '';
      if (tool?.kind === 'house' && v.ghost) actions = btn('rotateGhost', esc(t('town.rotate'))) + btn('confirm', esc(t('town.place_here')), null, v.ghost.ok ? 'primary' : 'dim');
      else if (v.sel != null) actions = btn('rotateSel', esc(t('town.rotate'))) + btn('removeSel', esc(t('town.remove')));
      const drawer = btn('tool', esc(t('town.tool_road')), { tool: tool?.kind === 'road' ? null : { kind: 'road' } }, `card road${tool?.kind === 'road' ? ' on' : ''}`)
        + stock.map((g) => card(g, tool?.grantId === g.id)).join('');
      $('.ui-bottom').innerHTML = `${actions ? `<div class="bar">${actions}</div>` : ''}<div class="drawer">${drawer}</div>`;
    },

    toast(msg) {
      const el = $('.toast');
      el.textContent = msg; el.classList.add('show');
      clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200);
    },
  };
}

// ---------- ?dev=1 除錯面板：模擬座標、假打卡（只動本機 grants）、重設 ----------
// 地標資料 Sprint 1 才有；這裡兩個假地標只供本機規則重播。假打卡紀錄只在記憶體、不存座標。
const DEV_LMS = [
  { id: 'lm:DEV-1', name: 'DEV 台北車站', lat: 25.0478, lng: 121.5170, r: 100, house: 'sys:shophouse' },
  { id: 'lm:DEV-2', name: 'DEV 大稻埕', lat: 25.0563, lng: 121.5099, r: 100, house: 'sys:minnan' },
];
const M_PER_DEG_LAT = 111195;

export function mountDev({ store, ui, houses, onReset }) {
  let log = []; // { lm, day, at }
  const el = document.createElement('details');
  el.id = 'dev'; el.open = true;
  el.innerHTML = `<summary>dev</summary>
    <label>地標 <select name="lm">${DEV_LMS.map((l, i) => `<option value="${i}">${esc(l.name)}</option>`).join('')}</select></label>
    <label>lat <input name="lat"></label><label>lng <input name="lng"></label><label>acc (m) <input name="acc" value="20"></label>
    <button data-dev="here">站到地標上</button><button data-dev="checkin">打卡</button>
    <div>案例重播：<button data-dev="in">圈內</button><button data-dev="edge">邊界 +5 m</button><button data-dev="acc">acc 250</button><button data-dev="again">同日重按</button><button data-dev="cap">第 41 次</button></div>
    <button data-dev="reset">重設存檔</button><div class="out"></div>`;
  document.body.appendChild(el);
  const f = (n) => el.querySelector(`[name=${n}]`);
  const lm = () => DEV_LMS[+f('lm').value];
  const at = (northM) => { f('lat').value = (lm().lat + northM / M_PER_DEG_LAT).toFixed(6); f('lng').value = lm().lng.toFixed(6); };
  const show = (msg) => { el.querySelector('.out').textContent = msg; ui.toast(msg); };

  // 與伺服器 /checkin 同順序：距離 → 同地標同日 → 日上限 → 間隔
  function checkin(entries, now = new Date().toISOString()) {
    const L = lm(), lat = +f('lat').value, lng = +f('lng').value, acc = +f('acc').value;
    const d = R.checkinDistance(R.distanceM(lat, lng, L.lat, L.lng), L.r, acc);
    if (!d.ok) return show(`${d.code}：${ui.reasonText(d)}`);
    const day = R.tpeDay(now);
    const c = R.canCheckin({ existsSameDay: entries.some((x) => x.lm === L.id && x.day === day), countToday: entries.filter((x) => x.day === day).length, lastAt: entries.at(-1)?.at ?? null, now });
    if (!c.ok) return show(`${c.code}：${ui.reasonText(c)}`);
    const h = houses.find((x) => x.id === L.house), visit = R.visitN(entries.filter((x) => x.lm === L.id).length);
    const grant = { id: crypto.randomUUID(), kind: 'house', item_id: h.id, state: 'stock', seed: R.seed(visit, h.palettes.length, Math.random()),
      landmark_id: L.id, visit_n: visit, mood: null, note: null, at: now, consumed_at: null };
    entries.push({ lm: L.id, day, at: now });
    store.set({ grants: [...store.get().grants, grant] });
    show(`ok：拿到 ${h.name}（第 ${visit} 次，seed ${grant.seed}）`);
  }
  const ago = (s) => new Date(Date.now() - s * 1000).toISOString();
  el.addEventListener('click', (e) => {
    const k = e.target.dataset?.dev;
    if (!k) return;
    if (k === 'here') at(0);
    else if (k === 'checkin') checkin(log);
    else if (k === 'in') { at(50); f('acc').value = 20; checkin([]); }
    else if (k === 'edge') { f('acc').value = 20; at(lm().r + 20 + 5); checkin([]); }
    else if (k === 'acc') { at(0); f('acc').value = 250; checkin([]); }
    else if (k === 'again') { at(0); f('acc').value = 20; const day = R.tpeDay(new Date().toISOString()); checkin([{ lm: lm().id, day, at: ago(3600) }]); }
    else if (k === 'cap') {
      at(0); f('acc').value = 20;
      const day = R.tpeDay(new Date().toISOString());
      checkin(Array.from({ length: RULES.DAILY_CAP }, (_, i) => ({ lm: `lm:DEV-x${i}`, day, at: ago(3600 + i) })));
    } else if (k === 'reset') { log = []; store.reset(); onReset(); show('已重設'); }
  });
  at(0);
}
