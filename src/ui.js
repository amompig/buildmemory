// ui.js — DOM 疊層：元件 class 與文案照 design/components.html、design/ui_strings.json 原樣使用
// 不碰 three、不改 store：使用者操作一律轉成 intent 交給 onIntent。
import * as R from '../shared/rules.js';

const { RULES, isUnlocked, unlockedSize } = R;

// ui_strings.json 沒有的鍵（Code 新增，待 Design 補進 ui_strings）
const FALLBACK = {
  town: { progress_title: '我的小鎮 · {size}×{size}', road_unlimited: '無限', drawer_title: '倉庫 · 依日期' },
  login: { done: '綁好了', failed: '綁定沒有成功，再試一次', unavailable: '登入還沒開放' },
  map: { today: '今天 {n} / 40', checkin_ok: '打卡成功 · 第 {visit} 次來', range: '走進 {n} m 內就能打卡', relocate: '重新定位', daily_toast_decor: '今天的部件已入倉庫' },
  memory: { variant_origin: '原色', variant_n: '變體 {n}', footprint: '佔 {n} 格 · 進倉庫', note_label: '一句話', optional: '可跳過' },
  error: { invalid: '這一步沒存成功，再試一次' },
  // 合成升級：Design 尚未給文案（docs/spec_upgrade_2026-10-22.md），暫代
  inventory: { merge_title: '可以升級', merge_hint: '兩棟換一棟大一號的', merge: '合成', merged: '升級成 {name}', merge_fail: '這兩棟沒辦法合成' },
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
  locate: svg('<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  check: svg('<path d="m5 12 4.5 4.5L19 7"/>', 'c-icon c-icon--s'),
  paint: svg('<path d="M7 20 9.5 4h5L17 20"/><path d="M12 7v2M12 12v2.5M12 17v2"/>', 'c-icon c-icon--s'),
  erase: svg('<path d="m5 15 8-8 6 6-5 5H8.5z"/><path d="M8.5 18H20"/>', 'c-icon c-icon--s'),
};
// 心情 5 鍵：design/components.html §3 的 SVG 原樣（順序 = ui_strings memory.mood）
const MOOD_SVG = [
  '<circle cx="12" cy="12" r="9"/><path d="M8 13.5c1 2 2.5 3 4 3s3-1 4-3"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M9 14.5c1 .8 2 1.2 3 1.2s2-.4 3-1.2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M9 15h6"/><path d="M8 9.5c.6-.6 1.4-.6 2 0M14 9.5c.6-.6 1.4-.6 2 0"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M9 14.5c1 .8 2 1.2 3 1.2s2-.4 3-1.2"/><path d="M9 9.5h.01M15 9.5h.01"/><path d="M16.5 12.5v2.5"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M9 15.5h6"/><path d="M8 10h3M13 10h3"/>',
].map((d) => svg(d));
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

  root.innerHTML = '<div class="ui-top"></div><div class="ui-bottom"></div><div class="ui-page"></div><div class="ui-sheet"></div><div class="ui-memory"></div><div class="ui-toast" role="status" aria-live="polite"></div>';
  const $ = (sel) => root.querySelector(sel);
  // toast 永遠浮在底部疊層（底欄／抽屜／記憶卡）上方 12 px：量最高那層
  const ro = new ResizeObserver(() => root.style.setProperty('--stack-h', `${Math.max($('.ui-bottom').offsetHeight, $('.ui-sheet').offsetHeight, $('.ui-memory').offsetHeight)}px`));
  ro.observe($('.ui-bottom')); ro.observe($('.ui-sheet')); ro.observe($('.ui-memory'));
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
    for (const g of grants.filter((x) => (x.kind === 'house' || x.kind === 'decor') && x.state === state).sort((a, b) => (a.at < b.at ? 1 : -1))) {
      const k = `${g.item_id}|${county(g)}|${day(g)}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(g);
    }
    return [...m.values()];
  }
  const houseName = (g) => byId.get(g.item_id)?.name ?? g.item_id;
  const meta = (g, n) => [COUNTY[county(g)] ?? county(g), day(g), `×${n}`].filter(Boolean).join(' · ');
  // 房型縮圖：預渲 PNG（Sprint 1）之前，用該變體的屋頂／牆色塊佔位
  // 房子小圖：kit.js 預烘的 assets/previews/<id>__<seed>.png（scripts 由 Code 產出、Design 審）；沒有該變體時退回原色
  const swatch = (g, cls = 'c-slot__img') => {
    const h = byId.get(g.item_id), seed = h?.palettes?.[g.seed] ? g.seed : 0, f = `assets/previews/${String(g.item_id).replace(':', '-')}__${seed}`;
    return `<img class="${cls}" alt="" loading="lazy" src="${esc(f)}.png" srcset="${esc(f)}.png 1x, ${esc(f)}@2x.png 2x">`;
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
    // 可合成：同系列同階的待放房子 ≥ 2 棟（規則以 shared/rules.js canMerge 為準，伺服器會再驗）
    const byKey = new Map();
    for (const g of s.grants) {
      const h = byId.get(g.item_id);
      if (g.kind !== 'house' || g.state !== 'stock' || !h?.line || h.tier >= 3) continue;
      const k = `${h.line}|${h.tier}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(g);
    }
    const merges = [...byKey.values()].filter((gs) => gs.length >= 2).map((gs) =>
      `<div class="c-card merge-card">${swatch(gs[0], 'c-stockrow__img')}<span class="c-stockrow__body"><span class="c-stockrow__name">${esc(houseName(gs[0]))} ×${gs.length}</span><span class="c-label">${esc(t('inventory.merge_hint'))}</span></span>`
      + `${btn('merge', esc(t('inventory.merge')), { a: gs[0].id, b: gs[1].id }, 'c-btn c-btn--primary')}</div>`).join('');
    return `${login}${merges ? `<div class="c-label">${esc(t('inventory.merge_title'))}</div>${merges}` : ''}<div class="inv-head"><span class="c-chip" aria-pressed="true">${esc(t('inventory.sort_date'))}</span></div>`
      + (stock.length || placed.length ? `<div class="inv">${stock.map((gs) => row(gs, 'stock')).join('')}${placed.map((gs) => row(gs, 'placed')).join('')}</div>` : `<p class="c-dialog__body">${esc(t('inventory.empty'))}</p>`)
      + btn('about', esc(t('privacy.about_title')), null, 'c-btn c-btn--ghost inv-about');
  }

  // F4 地圖：上方定位 pill＋今日次數；底板＝最近 3 個地標卡＋打卡大鈕（三態）＋隱私一句話
  function mapTop(s, g) {
    const today = R.tpeDay(new Date().toISOString());
    const n = s.grants.filter((x) => x.landmark_id && R.tpeDay(x.at) === today).length;
    // 位置 pill：最近地標所在縣市（不做反向地理編碼——座標不送第三方）
    const where = g.status === 'ok' && g.near[0] ? (COUNTY[g.near[0].lm.county] ?? g.near[0].lm.county) : t('map.locating');
    return `<div class="hud-pills"><span class="c-chip map-where">${ICON.locate}${esc(where)}</span><span class="c-chip">${esc(t('map.today', { n }))}</span></div>`;
  }
  function mapPanel(g) {
    if (g.status === 'denied') {
      return `<div class="c-sheet map-panel"><div class="c-dialog__title">${esc(t('map.location_denied'))}</div><div class="c-dialog__body">${esc(t('map.location_denied_help'))}</div>${btn('locate', esc(t('common.retry')), null, 'c-btn c-btn--primary')}</div>`;
    }
    if (g.status !== 'ok') return `<div class="c-sheet map-panel"><div class="c-dialog__body">${esc(t('map.locating'))}</div></div>`;
    if (!g.near.length || g.near[0].dist > RULES.COUNTY_MAX_KM * 1000) return `<div class="c-sheet map-panel"><div class="c-dialog__body">${esc(t('map.empty_no_landmark'))}</div></div>`;
    const cards = g.near.map((x, i) => {
      const hot = i === 0 && x.inRange, house = byId.get(x.lm.house);
      return `<div class="c-card${hot ? ' c-card--hot' : ''} lm-card">${swatch({ item_id: x.lm.house, seed: 0 }, 'c-stockrow__img')}`
        + `<div class="c-stockrow__body"><div class="c-stockrow__name">${esc(x.lm.name)}</div><div class="c-stockrow__state">${esc(t('map.preview_house', { name: house?.name ?? x.lm.house }))}</div></div>`
        + `<div class="c-stockrow__right"><div class="c-stockrow__qty"${hot ? ' style="color:var(--accent)"' : ''}>${x.dist >= 1000 ? `${(x.dist / 1000).toFixed(1)} km` : `${x.dist} m`}</div><div class="c-stockrow__state">${esc(t('map.distance_walk', { min: x.min }))}</div></div></div>`;
    }).join('');
    const first = g.near[0];
    // 灰鈕一定帶原因：不在範圍 → 「再走約 N m」；離線 → 「有訊號再按」
    const big = g.offline
      ? `<button class="c-btn c-btn--outline-muted c-btn--big" disabled>${esc(t('map.checkin_offline'))}</button>`
      : first.inRange
        ? btn('checkin', esc(t('map.checkin', { name: first.lm.name })), { landmark_id: first.lm.id }, 'c-btn c-btn--primary c-btn--big c-btn--float', g.busy ? 'disabled' : '')
        : `<button class="c-btn c-btn--primary c-btn--big" disabled>${esc(t('map.checkin_near', { dist: first.short }))}</button>`;
    return `<div class="hud-bar"><span class="hud-cam">${btn('locate', ICON.locate, null, 'c-iconbtn c-iconbtn--float', `aria-label="${esc(t('map.relocate'))}"`)}</span></div>`
      + `<div class="c-sheet map-panel"><div class="map-panel__head"><span class="c-label">${esc(t('map.nearby_title'))}</span><span class="c-label">${esc(t('map.range', { n: 50 }))}</span></div>${cards}${big}<div class="c-label" style="text-align:center">${esc(t('privacy.checkin_hint'))}</div></div>`;
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
        $('.ui-top').innerHTML = v.tab === 'map' ? mapTop(s, v.geo) : '';
        $('.ui-page').innerHTML = v.tab === 'inventory' ? inventoryPage(s) : '';
        $('.ui-bottom').innerHTML = (v.tab === 'map' ? mapPanel(v.geo) : '') + tabbar(v.tab);
        return;
      }
      $('.ui-page').innerHTML = '';
      const tool = v.tool, road = tool?.kind === 'road';
      if (v.mode === 'view') {
        const n = s.grants.filter((g) => (g.kind === 'house' || g.kind === 'decor') && g.state === 'stock').length;
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

    // F5 記憶卡（打卡成功）：DOM 只建一次，打字中不會被重繪洗掉；心情／字數在本地更新
    openMemory({ grant, landmark, visit }) {
      const h = byId.get(grant.item_id), moods = t('memory.mood');
      const when = new Date(grant.at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replaceAll('/', '.');
      const el = $('.ui-memory');
      el.innerHTML = `<div class="c-sheet"><div class="c-memory__top"><div class="c-memory__ok">${ICON.check}<span>${esc(t('map.checkin_ok', { visit }))}</span></div><div class="c-memory__date">${esc(when)}</div></div>`
        + `<h3 class="c-memory__name">${esc(landmark?.name ?? '')}</h3>`
        + `<div class="c-memory__preview">${swatch(grant, 'mem-img')}<div><div class="c-memory__house">${esc(h?.name ?? grant.item_id)}</div><div class="c-memory__sub">${esc(grant.seed ? t('memory.variant_n', { n: grant.seed }) : t('memory.variant_origin'))}</div><div class="c-memory__sub">${esc(t('memory.footprint', { n: (h?.size?.[0] ?? 1) * (h?.size?.[1] ?? 1) }))}</div></div></div>`
        + `<div><div class="c-label" style="display:flex;justify-content:space-between"><span>${esc(t('memory.mood_label'))}</span><span>${esc(t('memory.optional'))}</span></div>`
        + `<div class="c-moods" style="margin-top:8px">${MOOD_SVG.map((ic, i) => `<button class="c-mood" data-mood="${i}" aria-label="${esc(Array.isArray(moods) ? moods[i] : i)}" aria-pressed="false">${ic}</button>`).join('')}</div></div>`
        + `<div><label class="c-label" for="mem-note">${esc(t('memory.note_label'))}</label><div class="c-input" style="margin-top:6px"><input id="mem-note" type="text" maxlength="40" placeholder="${esc(t('memory.note_placeholder'))}"><span class="c-input__count">${esc(t('memory.note_counter', { n: 0 }))}</span></div></div>`
        + `<div class="c-memory__pair"><button class="c-btn c-btn--ghost" data-mem="skip">${esc(t('memory.skip'))}</button><button class="c-btn c-btn--secondary" data-mem="save">${esc(t('memory.save'))}</button></div>`
        + `<button class="c-btn c-btn--primary" data-mem="place">${esc(t('memory.cta_place'))}</button></div>`;
      let mood = null;
      const input = el.querySelector('#mem-note'), count = el.querySelector('.c-input__count');
      input.addEventListener('input', () => { count.textContent = t('memory.note_counter', { n: [...input.value].length }); });
      el.onclick = (e) => {
        const m = e.target.closest('[data-mood]');
        if (m) {
          const i = +m.dataset.mood;
          mood = mood === i ? null : i; // 再按一次取消
          el.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.mood === mood)));
          return;
        }
        const a = e.target.closest('[data-mem]');
        if (a) onIntent({ type: 'memory', action: a.dataset.mem, grantId: grant.id, mood, note: input.value });
      };
    },
    closeMemory() { const el = $('.ui-memory'); el.innerHTML = ''; el.onclick = null; },

    // F12：一次一則、新則取代舊則；3 s（reduced-motion 4 s）
    toast(msg, ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 4000 : 3000) {
      const el = $('.ui-toast');
      el.innerHTML = `<div class="c-toast"><span>${esc(msg)}</span></div>`;
      el.classList.add('show');
      clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
    },
  };
}

// ---------- ?dev=1 除錯面板（只在本機）：模擬座標 → 地圖頁與打卡走真的 API，由伺服器判定 ----------
const M_PER_DEG_LAT = 111195;
export function mountDev({ landmarks, onSim }) {
  const el = document.createElement('details');
  el.id = 'dev'; el.open = true;
  el.innerHTML = `<summary>dev · 模擬座標</summary>
    <label>地標 <select name="lm">${landmarks.map((l, i) => `<option value="${i}">${esc(l.name)}</option>`).join('')}</select></label>
    <label>往北偏移 (m) <input name="north" value="0"></label><label>acc (m) <input name="acc" value="20"></label>
    <button data-dev="apply">套用</button><button data-dev="off">關閉模擬</button>`;
  document.body.appendChild(el);
  const f = (n) => el.querySelector(`[name=${n}]`);
  el.addEventListener('click', (e) => {
    const k = e.target.dataset?.dev;
    if (k === 'apply') {
      const lm = landmarks[+f('lm').value];
      onSim({ lat: lm.lat + +f('north').value / M_PER_DEG_LAT, lng: lm.lng, acc: +f('acc').value });
    } else if (k === 'off') onSim(null);
  });
}
