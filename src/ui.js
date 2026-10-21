// ui.js — DOM 疊層：元件 class 與文案照 design/components.html、design/ui_strings.json 原樣使用
// 不碰 three、不改 store：使用者操作一律轉成 intent 交給 onIntent。
import * as R from '../shared/rules.js';

const { RULES, isUnlocked, unlockedSize } = R;

// ui_strings.json 沒有的鍵（Code 新增，待 Design 補進 ui_strings）
const FALLBACK = {
  town: { progress_title: '我的小鎮 · {size}×{size}', road_unlimited: '無限', drawer_title: '倉庫 · 依日期' },
  login: { done: '綁好了', failed: '綁定沒有成功，再試一次', unavailable: '登入還沒開放' },
  error: { invalid: '這一步沒存成功，再試一次' },
};
// 錯誤參數轉人話（時間轉台北時間）
const fmtParams = (r) => ({ ...r, until: r.until && new Date(r.until).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// 圖示：design/components.html 的 SVG 原樣
const svg = (d, cls = 'c-icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  rotate: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'),
  fit: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  map: svg('<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  town: svg('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-6h4v6"/>'),
  inventory: svg('<path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M4 7.5 12 11l8-3.5M12 11v9"/>'),
  paint: svg('<path d="M7 20 9.5 4h5L17 20"/><path d="M12 7v2M12 12v2.5M12 17v2"/>', 'c-icon c-icon--s'),
  erase: svg('<path d="m5 15 8-8 6 6-5 5H8.5z"/><path d="M8.5 18H20"/>', 'c-icon c-icon--s'),
};
const ROAD_SLOT_IMG = '<span class="c-slot__img" style="display:flex;align-items:center;justify-content:center"><span style="width:44px;height:22px;background:#6F7F8C;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></span></span>';
const COUNTY = { TPE: '台北', NWT: '新北' };

export function createUI(root, { strings = {}, houses, landmarks = [], onIntent }) {
  const byId = new Map(houses.map((h) => [h.id, h]));
  const lmById = new Map(landmarks.map((l) => [l.id, l]));
  const t = (key, params = {}) => {
    const [a, b] = key.split('.');
    const raw = strings[a]?.[b] || FALLBACK[a]?.[b] || key;
    return typeof raw === 'string' ? raw.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '') : raw;
  };
  // 規則拒絕原因 → 人話（不出現裸錯誤碼）
  const reasonText = (r) => ({ locked: t('town.cell_locked'), occupied: t('town.cell_occupied'), no_road: t('town.cell_no_road'), orphan: t('town.road_orphan') }[r.reason] ?? t(`error.${r.code}`, fmtParams(r)));

  root.innerHTML = '<div class="ui-top"></div><div class="ui-bottom"></div><div class="ui-page"></div><div class="ui-sheet"></div><div class="ui-toast" role="status" aria-live="polite"></div>';
  const $ = (sel) => root.querySelector(sel);
  // toast 永遠浮在底部疊層（底欄／抽屜／記憶卡）上方 12 px：量最高那層
  const ro = new ResizeObserver(() => root.style.setProperty('--stack-h', `${Math.max($('.ui-bottom').offsetHeight, $('.ui-sheet').offsetHeight)}px`));
  ro.observe($('.ui-bottom')); ro.observe($('.ui-sheet'));
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-intent]');
    if (b && !b.disabled) onIntent({ type: b.dataset.intent, ...JSON.parse(b.dataset.arg || '{}') });
  });
  const attrs = (intent, arg) => `data-intent="${intent}"${arg ? ` data-arg='${esc(JSON.stringify(arg))}'` : ''}`;
  const btn = (intent, label, arg, cls = '', extra = '') => `<button class="${cls}" ${attrs(intent, arg)} ${extra}>${label}</button>`;

  // 同房型＋同縣市＋同日期的房疊成一張（×n）；選取時拿最新那棟
  const county = (g) => lmById.get(g.landmark_id)?.county ?? '';
  const day = (g) => g.at.slice(5, 10).replace('-', '.');
  function groups(grants, state) {
    const m = new Map();
    for (const g of grants.filter((x) => x.kind === 'house' && x.state === state).sort((a, b) => (a.at < b.at ? 1 : -1))) {
      const k = `${g.item_id}|${county(g)}|${day(g)}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(g);
    }
    return [...m.values()];
  }
  const houseName = (g) => byId.get(g.item_id)?.name ?? g.item_id;
  const meta = (g, n) => [COUNTY[county(g)] ?? county(g), day(g), `×${n}`].filter(Boolean).join(' · ');
  // 房型縮圖：預渲 PNG（Sprint 1）之前，用該變體的屋頂／牆色塊佔位
  const swatch = (g, cls = 'c-slot__img') => {
    const h = byId.get(g.item_id), p = h?.palettes?.[g.seed] ?? h?.palettes?.[0] ?? {};
    return `<span class="${cls}" style="display:flex;align-items:flex-end;justify-content:center"><span style="width:34px;height:34px;border-radius:6px;background:linear-gradient(${esc(p.roof ?? '#999')} 0 35%, ${esc(p.wall ?? '#ccc')} 35%)"></span></span>`;
  };

  // F1 擴張卡：進度條 = 視窗內非 null 格 / 視窗格數；文字 = 還差幾格到 70%
  function progressCard(grid) {
    const size = unlockedSize(grid);
    if (size >= RULES.GRID) return '';
    let cells = 0, filled = 0;
    for (let i = 0; i < grid.length; i++) if (isUnlocked(i, size)) { cells++; if (grid[i] !== null) filled++; }
    const left = Math.max(0, Math.ceil(cells * RULES.UNLOCK_RATIO) - filled);
    return `<div class="c-card hud-progress"><div class="hud-progress__row"><b>${esc(t('town.progress_title', { size }))}</b><span>${esc(t('town.unlock_progress', { n: left }))}</span></div>`
      + `<div class="c-progress"><span style="width:${Math.round((filled / cells) * 100)}%"></span></div></div>`;
  }
  const tabbar = (tab) => `<nav class="c-tabbar" aria-label="主分頁">${['map', 'town', 'inventory'].map((k) =>
    `<button class="c-tab" ${attrs('tab', { tab: k })}${tab === k ? ' aria-current="page"' : ''}>${ICON[k]}${esc(t(`${k}.tab`))}</button>`).join('')}</nav>`;
  // 右下：轉向（南→西→北→東循環；俯視畫路時停用）＋看全鎮
  const camBtns = (top) => btn('view', ICON.rotate, { delta: 1 }, 'c-iconbtn c-iconbtn--float', `aria-label="${esc(t('town.rotate'))}"${top ? ' disabled' : ''}`)
    + btn('fit', ICON.fit, null, 'c-iconbtn c-iconbtn--float', `aria-label="${esc(t('town.fit'))}"`);

  // F7 倉庫（拆解多選 Sprint 2）
  function inventoryPage(s) {
    const login = s.bound === false
      ? `<div class="c-card login-cta"><div class="c-dialog__title">${esc(t('login.prompt_title'))}</div><p class="c-dialog__body">${esc(t('login.prompt_body'))}</p>${btn('login', esc(t('login.google')), null, 'c-btn c-btn--primary')}</div>` : '';
    const row = (gs, state) => {
      const g = gs[0], lm = lmById.get(g.landmark_id);
      return `<button class="c-stockrow${state === 'placed' ? ' is-dim' : ''}" ${attrs(state === 'stock' ? 'placeFrom' : 'noop', { grantId: g.id })}>${swatch(g, 'c-stockrow__img')}`
        + `<span class="c-stockrow__body"><span class="c-stockrow__name">${esc(houseName(g))}</span><span class="c-stockrow__tags">${county(g) ? `<span class="c-tag">${esc(COUNTY[county(g)] ?? county(g))}</span>` : ''}<span class="c-tag">${esc(day(g))}</span>${lm ? `<span class="c-stockrow__state">${esc(lm.name)}</span>` : ''}</span></span>`
        + `<span class="c-stockrow__right"><span class="c-stockrow__qty">×${gs.length}</span><span class="c-stockrow__state${state === 'stock' ? ' c-stockrow__state--stock' : ''}">${state === 'stock' ? '待放' : '已放'}</span></span></button>`;
    };
    const stock = groups(s.grants, 'stock'), placed = groups(s.grants, 'placed');
    return `${login}<div class="inv-head"><span class="c-chip" aria-pressed="true">${esc(t('inventory.sort_date'))}</span><span style="flex:1"></span><span class="c-chip">${esc(t('inventory.shards', { n: R.shards(s.grants) }))}</span></div>`
      + (stock.length || placed.length ? `<div class="inv">${stock.map((gs) => row(gs, 'stock')).join('')}${placed.map((gs) => row(gs, 'placed')).join('')}</div>` : `<p class="c-dialog__body">${esc(t('inventory.empty'))}</p>`);
  }

  // F6 迷你記憶卡（看態點房子）
  function sheet(s, v) {
    if (v.tab !== 'town' || v.mode !== 'view' || v.sel == null) return '';
    const cell = s.grid[v.sel], g = s.grants.find((x) => x.id === cell?.ref);
    if (!g) return '';
    const lm = lmById.get(g.landmark_id), moods = t('memory.mood');
    const note = [g.mood != null && Array.isArray(moods) ? moods[g.mood] : null, g.note].filter(Boolean).join(' · ');
    return `<div class="c-sheet"><div class="c-memory__top"><span class="c-label">${esc(t('memory.title_view'))}</span><span class="c-memory__date">${esc(g.at.slice(0, 10).replaceAll('-', '.'))}</span></div>`
      + `<h3 class="c-memory__name">${esc(lm?.name ?? houseName(g))}</h3><div class="c-memory__sub">${esc(houseName(g))}${g.visit_n > 1 ? ` · ${esc(t('memory.visit_n', { n: g.visit_n }))}` : ''}</div>`
      + (note ? `<div class="c-dialog__body">${esc(note)}</div>` : '')
      + `<div class="c-memory__pair">${btn('closeSheet', esc(t('common.close')), null, 'c-btn c-btn--ghost')}${btn('rotateSel', esc(t('memory.rotate')), null, 'c-btn c-btn--secondary')}</div></div>`;
  }

  return {
    t, reasonText,

    // s = { grid, grants, bound }；v = { tab, mode, tool, erase, ghost, sel, canUndo }
    render(s, v) {
      root.dataset.tab = v.tab; root.dataset.mode = v.mode;
      $('.ui-sheet').innerHTML = sheet(s, v);
      if (v.tab !== 'town') {
        $('.ui-top').innerHTML = '';
        $('.ui-page').innerHTML = v.tab === 'inventory' ? inventoryPage(s) : '';
        $('.ui-bottom').innerHTML = tabbar(v.tab);
        return;
      }
      $('.ui-page').innerHTML = '';
      const tool = v.tool, road = tool?.kind === 'road';
      if (v.mode === 'view') {
        const n = s.grants.filter((g) => g.kind === 'house' && g.state === 'stock').length;
        $('.ui-top').innerHTML = progressCard(s.grid);
        // 左下主鈕「擺放」（附待放棟數）、右下轉向＋看全鎮
        $('.ui-bottom').innerHTML = `<div class="hud-bar">${btn('mode', `${esc(t('town.mode_place'))}${n ? ` · ${n}` : ''}`, { mode: 'place' }, 'c-btn c-btn--primary c-btn--float hud-place')}<span class="hud-cam">${camBtns(false)}</span></div>${tabbar('town')}`;
        return;
      }
      // F2 / F3：橫幅（擺放中・復原・完成）＋倉庫抽屜（第一格道路），三 tab 隱藏
      const title = road ? `${t('town.banner_placing')} · ${t('town.tool_road')}` : t('town.banner_placing');
      $('.ui-top').innerHTML = `<div class="c-banner"><span class="c-banner__title">${esc(title)}</span><span class="hud-row">`
        + `${btn('undo', esc(t('town.undo')), null, 'c-banner__btn', v.canUndo ? '' : 'disabled')}${btn('done', esc(t('town.done')), null, 'c-banner__btn c-banner__btn--primary')}</span></div>`;
      const roadTools = road ? '<div class="hud-tools">'
        + `<button class="c-btn c-btn--float ${v.erase ? 'c-btn--ghost' : 'hud-tool--on'}" ${attrs('erase', { on: false })} aria-pressed="${!v.erase}">${ICON.paint}${esc(t('town.tool_road'))}</button>`
        + `<button class="c-btn c-btn--float ${v.erase ? 'hud-tool--on' : 'c-btn--ghost'}" ${attrs('erase', { on: true })} aria-pressed="${!!v.erase}">${ICON.erase}${esc(t('town.tool_erase'))}</button></div>` : '';
      const slots = `<button class="c-slot" ${attrs('tool', { tool: road ? null : { kind: 'road' } })} aria-pressed="${road}">${ROAD_SLOT_IMG}<span><span class="c-slot__name">${esc(t('town.tool_road'))}</span><br><span class="c-slot__meta">${esc(t('town.road_unlimited'))}</span></span></button>`
        + groups(s.grants, 'stock').map((gs) => {
          const on = gs.some((g) => g.id === tool?.grantId);
          return `<button class="c-slot" ${attrs('tool', { tool: { kind: 'house', grantId: gs[0].id } })} aria-pressed="${on}">${swatch(gs[0])}<span><span class="c-slot__name">${esc(houseName(gs[0]))}</span><br><span class="c-slot__meta">${esc(meta(gs[0], gs.length))}</span></span></button>`;
        }).join('');
      $('.ui-bottom').innerHTML = `<div class="hud-bar"><span style="flex:1"></span><span class="hud-cam">${camBtns(road)}</span></div>${roadTools}<div class="c-drawer"><div class="c-drawer__head"><span class="c-label">${esc(t('town.drawer_title'))}</span></div><div class="c-drawer__scroll">${slots}</div></div>`;
    },

    // F12：一次一則、新則取代舊則；3 s（reduced-motion 4 s）
    toast(msg, ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 4000 : 3000) {
      const el = $('.ui-toast');
      el.innerHTML = `<div class="c-toast"><span>${esc(msg)}</span></div>`;
      el.classList.add('show');
      clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
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
