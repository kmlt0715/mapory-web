// Mapory 홈페이지 — 넓은 화면·PC에서 더 잘 되는 도구들
// 포스터 지도, 연말 결산 책, 깊이 분석, 여행 계획, 옛 기록 불러오기, 추억 정리, 백업
// index.html이 넘겨주는 공용 창구(C)로 기록을 읽고 씁니다.

let C;               // 공용 창구
const $ = (id) => document.getElementById(id);

export function setup(ctx) {
  C = ctx;
  injectStyle();
  addPage('poster', '🖼️ 포스터 지도', posterHtml(), { init: initPoster });
  addPage('book', '📕 결산 책', bookHtml(), { init: initBook });
  addPage('analysis', '🔍 깊이 분석', analysisHtml(), { init: initAnalysis, show: () => an?.map?.resize() });
  addPage('plans', '📍 여행 계획', plansHtml(), { init: initPlans, show: () => { pl?.map?.resize(); pl?.fog?.draw(); } });
  addPage('workshop', '🗂️ 추억 정리', workshopHtml(), { init: initWorkshop, show: () => { renderWsList(); ws?.map?.resize(); } });
  addPage('import', '📥 옛 기록 불러오기', importHtml(), { init: initImport, show: renderImportState });
  addPage('backup', '💾 백업', backupHtml(), { init: initBackup, show: () => { renderBackupInfo(); loadUsage(); } });
  addPage('apps', '🛍️ 앱 보관함', appsHtml(), { init: renderApps, show: renderApps });
  initUsage();
}

// ───────── 서버(Supabase 무료) 사용량 ─────────
const LIMIT = { db: 500 * 1024 * 1024, storage: 1024 * 1024 * 1024 };
let usage = null;
const mb = (b) => b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + ' GB' : (b / 1024 ** 2).toFixed(b < 10 * 1024 ** 2 ? 1 : 0) + ' MB';
function initUsage() {
  const box = document.createElement('button');
  box.id = 'usageNav'; box.className = 'usageNav'; box.title = '서버 사용량 자세히 보기';
  box.onclick = () => C.go('backup');
  const nav = document.querySelector('nav'), sp = nav.querySelector('.spacer');
  sp.after(box);
  // 테마 고르기
  const th = document.createElement('div'); th.className = 'themePick'; th.setAttribute('role', 'group'); th.setAttribute('aria-label', '화면 테마');
  const cur = localStorage.getItem('mp_theme') || 'dark';
  th.innerHTML = [['dark', '🌙', '다크'], ['light', '☀️', '라이트'], ['space', '🪐', '우주']].map(([k, e, n]) => `<button data-th="${k}" aria-pressed="${k === cur}" title="${n} 테마">${e}<span>${n}</span></button>`).join('');
  th.querySelectorAll('button').forEach(b => b.onclick = () => {
    const k = b.dataset.th; localStorage.setItem('mp_theme', k);
    if (k === 'dark') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = k;
    th.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    C.TOOLS.manual?.show?.();
  });
  box.after(th);
  // 사용 설명서
  const mb2 = document.createElement('button');
  mb2.className = 'manualNav'; mb2.dataset.page = 'manual'; mb2.textContent = '📖 사용 설명서';
  mb2.onclick = () => C.go('manual');
  th.after(mb2);
  const mp = document.createElement('div');
  mp.className = 'page hidden'; mp.id = 'page-manual';
  mp.innerHTML = '<iframe id="manualFrame" title="Mapory 사용 설명서" style="width:100%;height:100%;border:0;display:block"></iframe>';
  document.querySelector('main').appendChild(mp);
  const theme = () => localStorage.getItem('mp_theme') || 'dark';
  C.TOOLS.manual = { show: () => { const f = $('manualFrame'), u = 'manual.html?theme=' + theme(); if (f.dataset.u !== u) { f.dataset.u = u; f.src = u; } } };
  loadUsage();
  setInterval(loadUsage, 10 * 60 * 1000);
}
async function loadUsage() {
  if (C.DEMO) usage = { db: 41 * 1024 ** 2, storage: 236 * 1024 ** 2, files: 612 };
  else {
    const { data, error } = await C.sb.rpc('mapory_usage');
    usage = error ? { error: true } : data;
  }
  renderUsage();
}
function usageBar(label, used, lim) {
  const pct = Math.min(100, used / lim * 100), warn = pct >= 80;
  return `<div class="ub"><div class="row"><span>${label}</span><span class="v">${mb(used)} / ${mb(lim)} · ${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%</span></div>
    <div class="bar"><i style="width:${Math.max(pct, 0.6).toFixed(1)}%;${warn ? 'background:var(--red,#E5533D)' : ''}"></i></div></div>`;
}
function renderUsage() {
  const nav = $('usageNav');
  if (nav) {
    if (!usage || usage.error) nav.innerHTML = `<span>서버 사용량</span><small>${usage?.error ? '설정 필요' : '확인 중…'}</small>`;
    else {
      const p1 = usage.db / LIMIT.db * 100, p2 = usage.storage / LIMIT.storage * 100;
      nav.innerHTML = `<span>서버 사용량</span><div class="mini"><i style="width:${Math.max(1, Math.min(100, p1)).toFixed(1)}%"></i></div><small>기록 ${Math.round(p1)}%</small><div class="mini"><i style="width:${Math.max(1, Math.min(100, p2)).toFixed(1)}%"></i></div><small>사진 ${Math.round(p2)}%</small>`;
    }
  }
  const card = $('usageCard'); if (!card) return;
  if (!usage) { card.innerHTML = '<p class="muted">확인 중…</p>'; return; }
  if (usage.error) {
    card.innerHTML = `<div class="note warn">사용량을 읽으려면 Supabase에서 <b>upgrade-3.sql</b>을 한 번 실행해 주세요. (SQL Editor → New query → 붙여 넣고 Run)</div>`;
    return;
  }
  const per = usage.files ? usage.storage / usage.files : 250 * 1024;
  const left = Math.max(0, Math.floor((LIMIT.storage - usage.storage) / per));
  card.innerHTML = usageBar('🗄️ 기록 (데이터베이스)', usage.db, LIMIT.db) + usageBar(`🖼️ 사진 저장소 (${C.nf.format(usage.files || 0)}장)`, usage.storage, LIMIT.storage) +
    `<p class="muted" style="margin:0">지금 속도라면 사진을 약 ${C.nf.format(left)}장 더 올릴 수 있어요. 데이터베이스 크기에는 서버 기본 구조(약 20~30MB)도 들어 있어요.
    무료 요금제는 한 달에 내려받는 양(5GB)도 한도가 있지만, 이건 Supabase 화면(Settings → Usage)에서만 볼 수 있어요. 80%를 넘으면 막대가 빨갛게 바뀌어요.</p>`;
}

// ───────── 공통: 화면 추가 ─────────
function addPage(id, label, html, { init, show }) {
  const nav = document.querySelector('nav');
  if (!nav.querySelector('.navSep')) {
    const sep = document.createElement('div'); sep.className = 'navSep'; sep.textContent = '도구';
    nav.insertBefore(sep, nav.querySelector('.spacer'));
  }
  const b = document.createElement('button');
  b.dataset.page = id; b.textContent = label;
  b.onclick = () => C.go(id);
  nav.insertBefore(b, nav.querySelector('.spacer'));
  const page = document.createElement('div');
  page.className = 'page hidden'; page.id = 'page-' + id; page.innerHTML = html;
  document.querySelector('main').appendChild(page);
  let ready = false;
  C.TOOLS[id] = { show: () => { if (!ready) { ready = true; init(); } else show?.(); } };
}

function injectStyle() {
  const st = document.createElement('style');
  st.textContent = `
  nav { overflow-y: auto; }
  nav > * { flex-shrink: 0; }
  .usageNav { margin: 6px 6px 4px; background: var(--field); border: 0; border-radius: 12px; padding: 10px 12px; color: var(--sub); font-size: 11px; display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center; text-align: left; cursor: pointer; font-family: inherit; }
  .themePick { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin: 0 6px 6px; background: var(--field); border-radius: 12px; padding: 4px; }
  .themePick button { border: 0; background: none; color: var(--sub); border-radius: 9px; padding: 6px 0 4px; font-size: 15px; display: flex; flex-direction: column; align-items: center; gap: 1px; font-family: inherit; }
  .themePick button span { font-size: 10px; }
  .themePick button[aria-pressed=true] { background: var(--panel); color: var(--txt); font-weight: 700; box-shadow: 0 1px 3px var(--shadow); }
  .manualNav { margin: 0 6px 6px; }
  .usageNav span { grid-column: 1 / -1; font-size: 12px; color: var(--txt); }
  .usageNav .mini { height: 6px; background: var(--grid); border-radius: 3px; overflow: hidden; }
  .usageNav .mini i { display: block; height: 100%; background: var(--amber); }
  .ub { display: flex; flex-direction: column; gap: 6px; }
  .ub .bar { height: 10px; border-radius: 5px; }
  nav .navSep { font-size: 11px; color: var(--sub); padding: 14px 12px 4px; letter-spacing: .08em; opacity: .7; }
  .tool { display: grid; grid-template-columns: 360px minmax(0, 1fr); height: 100%; }
  .tool > .side { background: var(--panel); padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
  .tool > .side h2 { font-size: 22px; margin: 0; }
  .tool > .stage { position: relative; overflow: hidden; background: var(--stage); }
  .side label input[type=text], .side label input[type=search], .side textarea, .side label input[type=datetime-local], .side label input[type=number] {
    width: 100%; min-width: 0; height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--field); color: var(--txt); font-size: 14px; font-family: inherit; }
  .side textarea { height: auto; min-height: 180px; padding: 10px 12px; line-height: 1.6; resize: vertical; }
  .side select { width: 100%; }
  .pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .pills button { height: 34px; border-radius: 17px; border: 1px solid var(--line); background: var(--field); color: var(--sub); padding: 0 12px; font-size: 13px; }
  .pills button[aria-pressed=true] { border-color: var(--amber); background: var(--amber-dark); color: var(--amber-text); font-weight: 700; }
  .note { background: var(--amber-dark); color: var(--amber-text); border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.55; }
  .note.warn { background: #3A1E1A; color: #FFB4A6; }
  .prog { height: 8px; background: var(--grid); border-radius: 4px; overflow: hidden; }
  .prog i { display: block; height: 100%; width: 0; background: var(--amber); transition: width .2s; }
  .btnrow { display: flex; gap: 8px; flex-wrap: wrap; }
  .btnrow .btn { flex: 1; }

  /* 포스터 */
  #pStage { display: grid; place-items: center; padding: 28px; background: #2A3240; }
  #pFrame { position: relative; box-shadow: 0 18px 50px rgba(0,0,0,.45); overflow: hidden; }
  #pMap { position: absolute; left: 0; top: 0; right: 0; }
  #pOver { position: absolute; left: 0; top: 0; pointer-events: none; }
  #pBand { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: .4em; }
  #pBand .t { font-weight: 800; letter-spacing: .02em; }
  #pBand .s { opacity: .85; }
  #pBand .c { opacity: .6; letter-spacing: .12em; }
  #pFrame .maplibregl-ctrl-bottom-right, #pFrame .maplibregl-ctrl-bottom-left { display: none; }

  /* 결산 책 */
  #bookWrap { padding: 28px; display: flex; flex-direction: column; align-items: center; gap: 24px; background: #2A3240; min-height: 100%; }
  .bookpage { width: 794px; height: 1123px; background: #fff; color: #1d232b; box-shadow: 0 10px 40px rgba(0,0,0,.4); position: relative; overflow: hidden; padding: 64px 64px 56px; display: flex; flex-direction: column; gap: 22px; font-family: inherit; flex: none; }
  .bookpage h1 { font-size: 40px; margin: 0; letter-spacing: -.01em; }
  .bookpage h2 { font-size: 28px; margin: 0; }
  .bookpage .kicker { font-size: 13px; letter-spacing: .2em; color: #9a7b3c; font-weight: 700; }
  .bookpage .foot { position: absolute; left: 64px; right: 64px; bottom: 26px; display: flex; justify-content: space-between; font-size: 11px; color: #9aa3ad; }
  .bookpage img.map { width: 100%; border-radius: 14px; display: block; }
  .bk-cover { background: #1A222D; color: #F3EFE6; justify-content: space-between; }
  .bk-cover .yr { font-size: 150px; font-weight: 900; line-height: .9; color: #F5B041; letter-spacing: -.04em; }
  .bk-tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .bk-tile { background: #F5F2EC; border-radius: 16px; padding: 18px 20px; }
  .bk-tile span { font-size: 13px; color: #6b7684; }
  .bk-tile b { display: block; font-size: 30px; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .bk-tile small { display: block; font-size: 12px; color: #6b7684; margin-top: 4px; }
  .bk-hl { display: flex; flex-direction: column; gap: 10px; }
  .bk-hl div { display: flex; justify-content: space-between; border-bottom: 1px solid #eee5d6; padding: 10px 0; font-size: 15px; }
  .bk-hl div b { font-weight: 700; }
  .bk-bars { display: flex; align-items: flex-end; gap: 10px; height: 220px; }
  .bk-bars .m { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; height: 100%; }
  .bk-bars .m i { width: 100%; background: #E0A43A; border-radius: 4px 4px 0 0; min-height: 2px; display: block; }
  .bk-bars .m span { font-size: 12px; color: #6b7684; }
  .bk-bars .m b { font-size: 11px; color: #3b4450; font-weight: 600; white-space: nowrap; }
  .bk-cal { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 1fr); grid-auto-columns: 1fr; gap: 2px; }
  .bk-cal i { aspect-ratio: 1; border-radius: 2px; background: #EFEAE1; display: block; }
  .bk-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .bk-tbl th, .bk-tbl td { padding: 7px 6px; text-align: right; border-bottom: 1px solid #eee5d6; font-variant-numeric: tabular-nums; }
  .bk-tbl th:first-child, .bk-tbl td:first-child { text-align: left; }
  .bk-tbl th { color: #6b7684; font-weight: 600; }
  .bk-months { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .bk-months figure { margin: 0; }
  .bk-months img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; display: block; background: #EFEAE1; }
  .bk-months figcaption { font-size: 12px; color: #3b4450; margin-top: 5px; display: flex; justify-content: space-between; }
  .bk-mems { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 1fr); gap: 18px; flex: 1; min-height: 0; }
  .bk-mem { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .bk-mem .ph { flex: 1; min-height: 0; border-radius: 12px; background: #F5F2EC center/cover no-repeat; display: grid; place-items: center; font-size: 46px; }
  .bk-mem b { font-size: 15px; }
  .bk-mem span { font-size: 12px; color: #6b7684; }
  .bk-mem p { margin: 0; font-size: 12px; color: #3b4450; line-height: 1.5; max-height: 3em; overflow: hidden; }
  .bk-badges { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .bk-badges div { background: #F5F2EC; border-radius: 12px; padding: 10px 6px; text-align: center; font-size: 12px; }
  .bk-badges div i { display: block; font-style: normal; font-size: 26px; }
  #printRoot { display: none; }
  @media print {
    @page { size: A4; margin: 0; }
    html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
    body > *:not(#printRoot) { display: none !important; }
    #printRoot { display: block !important; }
    #printRoot .bookpage { width: 210mm; height: 297mm; box-shadow: none; page-break-after: always; break-after: page; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* 분석 */
  .an-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .an-tbl td, .an-tbl th { padding: 6px 4px; border-bottom: 1px solid var(--grid); text-align: right; font-variant-numeric: tabular-nums; }
  .an-tbl td:first-child, .an-tbl th:first-child { text-align: left; }
  .an-tbl th { color: var(--sub); font-weight: 500; }
  .an-tbl tr.click { cursor: pointer; }
  .an-tbl tr.click:hover td { background: var(--field); }
  #anLegend { position: absolute; right: 16px; bottom: 16px; z-index: 2; }
  .heatkey { width: 180px; height: 10px; border-radius: 5px; background: linear-gradient(90deg, rgba(33,102,172,0), #2166ac, #67a9cf, #fddbc7, #ef8a62, #b2182b); }

  /* 계획 */
  .planItem { display: flex; gap: 10px; align-items: center; background: var(--field); border-radius: 12px; padding: 10px 12px; cursor: pointer; }
  .planItem .e { font-size: 22px; }
  .planItem .x { flex: 1; min-width: 0; }
  .planItem .x b { display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .planItem .x span { font-size: 12px; color: var(--sub); }
  .planItem.done b { color: var(--green); }
  .ppin { width: 38px; height: 38px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #fff; border: 3px solid var(--sky); display: grid; place-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.4); padding: 0; }
  .ppin span { transform: rotate(45deg); font-size: 18px; }
  .ppin.done { border-color: var(--green); }
  .results button { display: block; width: 100%; text-align: left; background: var(--field); border: 0; color: var(--txt); padding: 9px 12px; border-radius: 10px; font-size: 13px; margin-top: 4px; }

  /* 추억 정리 */
  #page-workshop .tool { grid-template-columns: minmax(0, 1fr) 420px; }
  .wsTop { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 18px 20px 10px; }
  .wsTop input[type=search] { flex: 1; min-width: 200px; height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--field); color: var(--txt); font-size: 14px; }
  #wsBulk { display: flex; gap: 8px; align-items: center; padding: 8px 20px; background: var(--amber-dark); color: var(--amber-text); font-size: 14px; }
  #wsList { overflow-y: auto; padding: 4px 20px 40px; }
  .wsRow { display: grid; grid-template-columns: 28px 56px minmax(0, 1fr) 110px; gap: 12px; align-items: center; padding: 8px; border-radius: 12px; cursor: pointer; }
  .wsRow:hover { background: var(--panel); }
  .wsRow.sel { background: var(--amber-dark); }
  .wsRow input { width: 18px; height: 18px; accent-color: var(--amber); }
  .wsRow .th { width: 56px; height: 56px; border-radius: 10px; background: var(--field) center/cover; display: grid; place-items: center; font-size: 24px; }
  .wsRow b { display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wsRow span { font-size: 12px; color: var(--sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .wsRow .d { font-size: 12px; color: var(--sub); text-align: right; }
  .iconGrid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; }
  .iconGrid button { aspect-ratio: 1; border: 1px solid transparent; background: var(--field); border-radius: 8px; font-size: 18px; padding: 0; }
  .iconGrid button[aria-pressed=true] { border-color: var(--amber); background: var(--amber-dark); }
  #wsMap { height: 220px; border-radius: 14px; overflow: hidden; position: relative; }
  .wsPhotos { display: flex; gap: 6px; overflow-x: auto; }
  .wsPhotos img { height: 70px; border-radius: 8px; }
  `;
  document.head.appendChild(st);
}

// ───────── 공통 도구 ─────────
const today = () => C.dayOf(Date.now());
const thisYear = () => new Date().getFullYear();
function rangeOf(key) {
  const t = today(), y = thisYear();
  if (key === 'year') return [`${y}-01-01`, t];
  if (key === 'last') return [`${y - 1}-01-01`, `${y - 1}-12-31`];
  if (key === 'month') return [t.slice(0, 8) + '01', t];
  if (key === 'd30') return [C.addDays(t, -29), t];
  const all = C.segs.map(s => s.day).concat(C.days.map(d => d.day)).sort();
  return [all[0] || t, t];
}
function download(name, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/** 엑셀에서 한글이 깨지지 않는 CSV */
function csv(rows) {
  const cell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
function distM(la1, lo1, la2, lo2) {
  const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(a)));
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const km = (m) => C.fmtDist(m);
const ICONS = Object.keys(C_ICONS());
function C_ICONS() { return { '✈️': 1, '🍽️': 1, '☕': 1, '🍺': 1, '🍰': 1, '🛍️': 1, '🏠': 1, '💼': 1, '📚': 1, '🏃': 1, '⛰️': 1, '🌊': 1, '🏕️': 1, '🌸': 1, '🚗': 1, '🎬': 1, '🎵': 1, '🎮': 1, '📷': 1, '❤️': 1, '👪': 1, '👫': 1, '🐶': 1, '🎂': 1, '🏨': 1, '⛳': 1, '🏥': 1, '⛪': 1, '⭐': 1 }; }

/** 지도 화면 → 화면 좌표 변환 (지도가 돌지 않으므로 축마다 1차식, 빠름) */
function projector(map) {
  const c = map.getCenter(), z = map.getZoom();
  const dd = Math.min(20, 360 / 2 ** z * 0.25);
  const la1 = Math.max(-80, Math.min(80, c.lat)), lo1 = c.lng, la2 = la1 > 0 ? la1 - dd : la1 + dd, lo2 = lo1 + dd;
  const p1 = map.project([lo1, la1]), p2 = map.project([lo2, la2]);
  const ax = (p2.x - p1.x) / (C.mercX(lo2) - C.mercX(lo1)), bx = p1.x - ax * C.mercX(lo1);
  const ay = (p2.y - p1.y) / (C.mercY(la2) - C.mercY(la1)), by = p1.y - ay * C.mercY(la1);
  return { ax, bx, ay, by, mpp: 40075016.686 * Math.cos(la1 * Math.PI / 180) / Math.abs(ax) };
}
/** 고른 날의 길을 캔버스에 경로로 */
function tracePath(ctx, P, pick, w, h) {
  const margin = 40;
  ctx.beginPath();
  for (const s of C.segs) {
    if (!pick(s.day)) continue;
    let px = P.ax * s.mx[0] + P.bx, py = P.ay * s.my[0] + P.by, pen = false;
    if (s.mx.length === 1) { ctx.moveTo(px, py); ctx.lineTo(px + 0.01, py); continue; }
    for (let k = 1; k < s.mx.length; k++) {
      const x = P.ax * s.mx[k] + P.bx, y = P.ay * s.my[k] + P.by;
      if (Math.abs(x - px) + Math.abs(y - py) < 0.8 && k < s.mx.length - 1) continue;
      if (Math.max(x, px) < -margin || Math.min(x, px) > w + margin || Math.max(y, py) < -margin || Math.min(y, py) > h + margin) { pen = false; px = x; py = y; continue; }
      if (!pen) { ctx.moveTo(px, py); pen = true; }
      ctx.lineTo(x, y); px = x; py = y;
    }
  }
}

// 포스터·책에 쓰는 그림 테마
const THEMES = {
  fog:   { name: '안개 지도', fog: '#EEF1F4', band: '#FFFFFF', ink: '#1A222D', sub: '#6B7684' },
  night: { name: '밤하늘', base: '#0B1220', line: '#F5B041', glow: true, band: '#0B1220', ink: '#F3EFE6', sub: '#9AA7B8' },
  neon:  { name: '네온', base: '#07070D', line: '#FF2E88', core: '#FFD6EA', glow: true, band: '#07070D', ink: '#FFFFFF', sub: '#C2A9D3' },
  paper: { name: '종이', base: '#F3EEE3', line: '#B83A2E', band: '#F3EEE3', ink: '#2B2B2B', sub: '#7A7368', serif: true },
  blue:  { name: '청사진', base: '#123C69', line: '#FFFFFF', band: '#0E3157', ink: '#FFFFFF', sub: '#A9C3E0', grid: true },
};
/**
 * 지도 그림 위에 테마대로 덧그림. ctx는 CSS 픽셀 기준으로 맞춰져 있어야 합니다.
 * fade: 지도 배경을 얼마나 덮을지(0~1, 안개 테마는 무시)
 */
function paintTheme(ctx, map, theme, pick, w, h, fade = 0.86) {
  const T = THEMES[theme], P = projector(map);
  ctx.save();
  if (T.fog) {
    ctx.globalAlpha = 0.92; ctx.fillStyle = T.fog; ctx.fillRect(0, 0, w, h);
    const stroke = Math.max(10 / P.mpp, 2.2);
    tracePath(ctx, P, pick, w, h);
    ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [a, k] of [[0.3, 2.4], [0.55, 1.6], [1, 1]]) { ctx.globalAlpha = a; ctx.lineWidth = stroke * k; ctx.stroke(); }
    ctx.restore();
    return;
  }
  ctx.globalAlpha = fade; ctx.fillStyle = T.base; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
  if (T.grid) {
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  const lw = Math.max(1.1, Math.min(3, 6 / P.mpp + 1));
  tracePath(ctx, P, pick, w, h);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (T.glow) {
    ctx.strokeStyle = T.line;
    for (const [a, k] of [[0.08, 7], [0.16, 3.6], [0.5, 1.8]]) { ctx.globalAlpha = a; ctx.lineWidth = lw * k; ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = T.core || T.line; ctx.lineWidth = lw * 0.8; ctx.stroke();
  } else {
    ctx.globalAlpha = 0.9; ctx.strokeStyle = T.line; ctx.lineWidth = lw; ctx.stroke();
  }
  ctx.restore();
}

/**
 * 보이지 않는 곳에 지도를 하나 띄워 고화질 사진을 찍는 도구.
 * cssW×cssH 크기로 그리되 pixelRatio배로 촘촘하게 그립니다.
 */
class Snapper {
  constructor(cssW, cssH, pixelRatio, withBase = true) {
    this.w = cssW; this.h = cssH; this.k = pixelRatio; this.withBase = withBase;
    this.box = document.createElement('div');
    this.box.style.cssText = `position:fixed;left:-20000px;top:0;width:${cssW}px;height:${cssH}px;`;
    document.body.appendChild(this.box);
    this.map = new maplibregl.Map({
      container: this.box, style: withBase ? C.STYLE : { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#000' } }] },
      center: [127, 37.5], zoom: 10, interactive: false, attributionControl: false, fadeDuration: 0,
      pixelRatio, maxCanvasSize: [8192, 8192], canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    this.ready = new Promise(r => this.map.once('load', r));
  }
  async idle() {
    await this.ready;
    await new Promise(r => { const t = setTimeout(r, 9000); this.map.once('idle', () => { clearTimeout(t); r(); }); this.map.triggerRepaint(); });
    await sleep(50);
  }
  /** view: { bounds, padding } 또는 { center, zoom } */
  async snap(view, theme, pick, fade) {
    await this.ready;
    if (view.bounds) {
      const cam = this.map.cameraForBounds(view.bounds, { padding: view.padding ?? 30, maxZoom: view.maxZoom ?? 15 });
      if (cam) this.map.jumpTo(cam);
    } else this.map.jumpTo({ center: view.center, zoom: view.zoom });
    await this.idle();
    const out = document.createElement('canvas');
    out.width = Math.round(this.w * this.k); out.height = Math.round(this.h * this.k);
    const ctx = out.getContext('2d');
    if (this.withBase) ctx.drawImage(this.map.getCanvas(), 0, 0, out.width, out.height);
    else { ctx.fillStyle = THEMES[theme].base || '#fff'; ctx.fillRect(0, 0, out.width, out.height); }
    // 안개는 구멍을 뚫어 그리므로 따로 그린 뒤 지도 위에 겹칩니다.
    const layer = document.createElement('canvas'); layer.width = out.width; layer.height = out.height;
    const lc = layer.getContext('2d'); lc.setTransform(this.k, 0, 0, this.k, 0, 0);
    paintTheme(lc, this.map, theme, pick, this.w, this.h, this.withBase ? fade : 1);
    ctx.drawImage(layer, 0, 0);
    return out;
  }
  remove() { this.map.remove(); this.box.remove(); }
}

function rangePills(id, keys = ['all', 'year', 'last', 'month', 'd30']) {
  const names = { all: '전체', year: '올해', last: '작년', month: '이번 달', d30: '최근 30일', custom: '직접 고르기' };
  return `<div class="pills" id="${id}">${keys.map(k => `<button data-k="${k}" aria-pressed="${k === keys[0]}">${names[k]}</button>`).join('')}</div>`;
}
function bindPills(id, onPick) {
  const box = $(id);
  box.querySelectorAll('button').forEach(b => b.onclick = () => {
    box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    onPick(b.dataset.k);
  });
}

// ═════════ 1. 포스터 지도 ═════════
function posterHtml() {
  return `<div class="tool">
  <div class="side">
    <h2>🖼️ 포스터 지도</h2>
    <p class="muted" style="margin:0">다닌 길을 액자에 걸 수 있는 고화질 그림으로 만들어요. 오른쪽 지도를 끌고 확대해서 담을 곳을 정하세요.</p>
    <label>기간</label>${rangePills('pRange', ['all', 'year', 'last', 'custom'])}
    <div class="range hidden" id="pCustom"><input type="date" id="pFrom"><span class="muted">–</span><input type="date" id="pTo"></div>
    <label>테마</label><div class="pills" id="pTheme">${Object.entries(THEMES).map(([k, t], i) => `<button data-k="${k}" aria-pressed="${i === 0}">${t.name}</button>`).join('')}</div>
    <label class="chk" id="pFadeBox"><input type="checkbox" id="pFade" checked> 지도 배경을 희미하게 보여주기</label>
    <label>모양<select id="pSize">
      <option value="0.7071">세로 (A3·A2 용지)</option><option value="1.4142">가로 (A3·A2 용지)</option>
      <option value="0.8">세로 (8×10 액자)</option><option value="1">정사각형</option><option value="0.4615">휴대폰 배경</option></select></label>
    <label>제목<input type="text" id="pTitle" maxlength="40"></label>
    <label>부제목<input type="text" id="pSub" maxlength="60" placeholder="비워 두면 기간·거리를 자동으로 넣어요"></label>
    <label>화질<select id="pQual"><option value="3000">보통 (긴 변 3,000px · 화면·A4)</option><option value="6000" selected>인쇄용 (긴 변 6,000px · A3~A2)</option></select></label>
    <div class="btnrow"><button class="btn" id="pFit">다닌 곳에 맞추기</button><button class="btn primary" id="pMake">🖼️ 그림으로 저장</button></div>
    <div class="prog hidden" id="pProg"><i></i></div>
    <span class="muted" id="pMsg"></span>
  </div>
  <div class="stage" id="pStage"><div id="pFrame"><div id="pMap"></div><canvas id="pOver"></canvas><div id="pBand"><div class="t" id="pBT"></div><div class="s" id="pBS"></div><div class="c" id="pBC"></div></div></div></div>
</div>`;
}
let po = null;
function initPoster() {
  po = { theme: 'fog', range: rangeOf('all'), key: 'all' };
  $('pTitle').value = '나의 Mapory';
  const frame = $('pFrame'), stage = $('pStage');
  po.map = new maplibregl.Map({ container: 'pMap', style: C.STYLE, center: [126.978, 37.5665], zoom: 11, dragRotate: false, attributionControl: false, maxPitch: 0 });
  po.map.touchZoomRotate.disableRotation();
  const over = $('pOver'), octx = over.getContext('2d');
  const pick = (d) => d >= po.range[0] && d <= po.range[1];
  po.draw = () => {
    const w = over.clientWidth, h = over.clientHeight, dpr = devicePixelRatio || 1;
    if (!w) return;
    over.width = w * dpr; over.height = h * dpr;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, w, h);
    paintTheme(octx, po.map, po.theme, pick, w, h, $('pFade').checked ? 0.86 : 1);
  };
  po.map.on('move', po.draw); po.map.on('load', () => { po.fit(); po.draw(); });
  po.layout = () => {
    const ratio = +$('pSize').value;              // 가로/세로
    const sw = stage.clientWidth - 56, sh = stage.clientHeight - 56;
    let w = Math.min(sw, sh * ratio), h = w / ratio;
    w = Math.floor(w); h = Math.floor(h);
    const band = Math.round(Math.min(w, h) * 0.2 + (ratio < 1 ? h * 0.02 : 0));
    frame.style.width = w + 'px'; frame.style.height = h + 'px';
    const mh = h - band;
    $('pMap').style.height = mh + 'px'; over.style.width = w + 'px'; over.style.height = mh + 'px';
    const band$ = $('pBand'); band$.style.height = band + 'px';
    const T = THEMES[po.theme];
    band$.style.background = T.band; band$.style.color = T.ink;
    band$.style.fontFamily = T.serif ? 'Georgia, "Nanum Myeongjo", serif' : 'inherit';
    const u = Math.min(w, h) / 100;
    $('pBT').style.fontSize = (u * 6.2) + 'px'; $('pBS').style.fontSize = (u * 2.6) + 'px'; $('pBC').style.fontSize = (u * 1.7) + 'px';
    $('pBS').style.color = T.sub; $('pBC').style.color = T.sub;
    po.size = { w, h, band, mh };
    po.map.resize(); po.text(); po.draw();
  };
  po.text = () => {
    const ds = C.days.filter(d => pick(d.day));
    const dist = ds.reduce((s, d) => s + C.total(d), 0);
    const fmtD = (s) => s.replaceAll('-', '.');
    $('pBT').textContent = $('pTitle').value || ' ';
    $('pBS').textContent = $('pSub').value || `${fmtD(po.range[0])} – ${fmtD(po.range[1])} · ${km(dist)} · ${ds.length}일`;
    const c = po.map.getCenter();
    $('pBC').textContent = `${Math.abs(c.lat).toFixed(4)}°${c.lat >= 0 ? 'N' : 'S'}  ${Math.abs(c.lng).toFixed(4)}°${c.lng >= 0 ? 'E' : 'W'}  ·  MAPORY`;
  };
  po.map.on('moveend', po.text);
  po.fit = () => { const b = C.boundsOf(pick); if (b) po.map.fitBounds(b, { padding: 40, maxZoom: 15, duration: 0 }); };
  bindPills('pRange', (k) => {
    po.key = k; $('pCustom').classList.toggle('hidden', k !== 'custom');
    if (k === 'custom') { $('pFrom').value ||= po.range[0]; $('pTo').value ||= po.range[1]; po.range = [$('pFrom').value, $('pTo').value]; }
    else po.range = rangeOf(k);
    if (k === 'year') $('pTitle').value = `${thisYear()} 나의 Mapory`;
    if (k === 'last') $('pTitle').value = `${thisYear() - 1} 나의 Mapory`;
    po.fit(); po.text(); po.draw();
  });
  $('pFrom').onchange = $('pTo').onchange = () => { let a = $('pFrom').value, b = $('pTo').value; if (a && b) { if (a > b) [a, b] = [b, a]; po.range = [a, b]; po.fit(); po.text(); po.draw(); } };
  bindPills('pTheme', (k) => { po.theme = k; $('pFadeBox').classList.toggle('hidden', k === 'fog'); po.layout(); });
  $('pFade').onchange = po.draw;
  $('pSize').onchange = () => { po.layout(); };
  $('pTitle').oninput = $('pSub').oninput = po.text;
  $('pFit').onclick = po.fit;
  $('pMake').onclick = makePoster;
  new ResizeObserver(() => po.layout()).observe(stage);
  po.layout();
}
async function makePoster() {
  const btn = $('pMake'); btn.disabled = true;
  $('pProg').classList.remove('hidden'); $('pProg').firstElementChild.style.width = '15%';
  $('pMsg').textContent = '고화질로 그리는 중… 지도 조각을 받느라 10~30초쯤 걸려요.';
  const { w, h, band, mh } = po.size;
  const longPx = +$('pQual').value, k = longPx / Math.max(w, h);
  const T = THEMES[po.theme];
  const withBase = po.theme === 'fog' || $('pFade').checked;
  let snap;
  try {
    snap = new Snapper(w, mh, k, withBase);
    $('pProg').firstElementChild.style.width = '45%';
    const pick = (d) => d >= po.range[0] && d <= po.range[1];
    const img = await snap.snap({ center: po.map.getCenter(), zoom: po.map.getZoom() }, po.theme, pick, $('pFade').checked ? 0.86 : 1);
    $('pProg').firstElementChild.style.width = '85%';
    const out = document.createElement('canvas');
    out.width = Math.round(w * k); out.height = Math.round(h * k);
    const c = out.getContext('2d');
    c.drawImage(img, 0, 0);
    c.fillStyle = T.band; c.fillRect(0, img.height, out.width, out.height - img.height);
    // 글자: 미리보기와 같은 비율
    const u = Math.min(w, h) / 100 * k, cx = out.width / 2, top = img.height, bh = out.height - img.height;
    const fam = T.serif ? 'Georgia, "Nanum Myeongjo", serif' : getComputedStyle(document.body).fontFamily;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = T.ink; c.font = `800 ${u * 6.2}px ${fam}`; c.fillText($('pBT').textContent, cx, top + bh * 0.36);
    c.fillStyle = T.sub; c.font = `500 ${u * 2.6}px ${fam}`; c.fillText($('pBS').textContent, cx, top + bh * 0.62);
    c.globalAlpha = 0.7; c.font = `500 ${u * 1.7}px ${fam}`; c.fillText($('pBC').textContent.replace(/ /g, '\u2009'), cx, top + bh * 0.82);
    const blob = await new Promise(r => out.toBlob(r, 'image/png'));
    download(`mapory-poster-${po.range[0]}_${po.range[1]}.png`, blob);
    $('pMsg').textContent = `저장했어요 (${out.width}×${out.height}px). 사진관이나 인쇄소에 PNG 파일을 그대로 맡기면 돼요.`;
    $('pProg').firstElementChild.style.width = '100%';
  } catch (e) {
    $('pMsg').textContent = '그림을 만들지 못했어요: ' + (e.message || e) + ' (화질을 "보통"으로 낮춰 보세요)';
  } finally {
    snap?.remove(); btn.disabled = false; setTimeout(() => $('pProg').classList.add('hidden'), 1500);
  }
}

// ═════════ 2. 연말 결산 책 ═════════
function bookHtml() {
  return `<div class="tool">
  <div class="side">
    <h2>📕 연말 결산 책</h2>
    <p class="muted" style="margin:0">한 해의 지도, 숫자, 달마다의 길, 추억을 책처럼 엮어요. 다 만들어지면 인쇄하거나 PDF로 저장하세요.</p>
    <label>연도<select id="bYear"></select></label>
    <label>이름<input type="text" id="bName" maxlength="20" placeholder="예: 영진"></label>
    <label class="chk"><input type="checkbox" id="bMonths" checked> 열두 달의 길 지도 넣기</label>
    <label class="chk"><input type="checkbox" id="bPhotoOnly"> 사진 있는 추억만 넣기</label>
    <button class="btn primary" id="bMake">📕 책 만들기</button>
    <button class="btn" id="bPrint" disabled>🖨️ 인쇄 · PDF로 저장</button>
    <div class="prog hidden" id="bProg"><i></i></div>
    <span class="muted" id="bMsg"></span>
    <div class="note">인쇄 창에서 대상(프린터)을 <b>PDF로 저장</b>으로 고르면 파일로 남아요. 여백은 '없음', 배경 그래픽은 켜 주세요.</div>
  </div>
  <div class="stage" style="overflow:auto"><div id="bookWrap"><p class="muted" style="margin-top:40px">왼쪽에서 연도를 고르고 '책 만들기'를 눌러 주세요.</p></div></div>
</div>`;
}
function initBook() {
  const years = [...new Set(C.days.map(d => d.day.slice(0, 4)))].sort().reverse();
  if (!years.length) years.push(String(thisYear()));
  $('bYear').innerHTML = years.map(y => `<option>${y}</option>`).join('');
  $('bName').value = localStorage.getItem('mp_name') || '';
  $('bMake').onclick = makeBook;
  $('bPrint').onclick = () => {
    let root = $('printRoot');
    if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
    root.innerHTML = $('bookWrap').innerHTML;
    setTimeout(() => window.print(), 200);
  };
}
async function makeBook() {
  const Y = $('bYear').value, name = $('bName').value.trim();
  localStorage.setItem('mp_name', name);
  const a = `${Y}-01-01`, b = `${Y}-12-31`;
  const inY = (d) => d >= a && d <= b;
  const ds = C.days.filter(d => inY(d.day));
  const ms = C.mems.filter(m => inY(C.dayOf(m.ts)));
  const btn = $('bMake'); btn.disabled = true; $('bPrint').disabled = true;
  const prog = (p, t) => { $('bProg').classList.remove('hidden'); $('bProg').firstElementChild.style.width = p + '%'; $('bMsg').textContent = t; };
  prog(5, '숫자를 세는 중…');
  let pageNo = 0;
  const foot = () => `<div class="foot"><span>MAPORY · ${Y}</span><span>${++pageNo}</span></div>`;
  const sum = (f) => ds.reduce((s, d) => s + (f(d) || 0), 0);
  const tot = sum(C.total), walk = sum(d => d.dist_walk), car = sum(d => d.dist_car), plane = sum(d => d.dist_plane), steps = sum(d => d.steps), area = sum(d => d.area_km2);
  const maxBy = (f) => ds.reduce((m, d) => (!m || f(d) > f(m)) ? d : m, null);
  const bestWalk = maxBy(d => d.dist_walk), bestTot = maxBy(C.total), bestSteps = maxBy(d => d.steps || 0);
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, '0'), md = ds.filter(d => d.day.slice(5, 7) === mm);
    return { m: i + 1, dist: md.reduce((s, d) => s + C.total(d), 0), steps: md.reduce((s, d) => s + (d.steps || 0), 0), n: md.length, mem: ms.filter(x => C.dayOf(x.ts).slice(5, 7) === mm).length, area: md.reduce((s, d) => s + d.area_km2, 0) };
  });
  const bestMonth = byMonth.reduce((m, x) => x.dist > m.dist ? x : m, byMonth[0]);
  const pages = [];
  let snap = null;
  try {
    // 표지 지도
    prog(12, '표지 지도를 그리는 중…');
    snap = new Snapper(666, 560, 2.4, true);
    const yb = C.boundsOf(inY);
    let coverImg = '';
    if (yb) coverImg = (await snap.snap({ bounds: yb, padding: 30 }, 'fog', inY)).toDataURL('image/jpeg', 0.9);
    pages.push(`<div class="bookpage bk-cover">
      <div><div class="kicker" style="color:#F5B041">MAPORY YEARBOOK</div><div class="yr">${Y}</div>
        <h1 style="margin-top:14px">${C.esc(name ? name + '의 한 해' : '나의 한 해')}</h1></div>
      ${coverImg ? `<img class="map" src="${coverImg}" alt="">` : ''}
      <div style="display:flex;justify-content:space-between;font-size:16px;color:#C9D2DD"><span>${ds.length}일을 기록했고</span><span>${km(tot)}를 움직였어요</span></div>
    </div>`);
    pageNo++;

    // 숫자로 보는 한 해
    const earth = tot / 40075000 * 100;
    pages.push(`<div class="bookpage"><div class="kicker">IN NUMBERS</div><h2>숫자로 보는 ${Y}</h2>
      <div class="bk-tiles">
        <div class="bk-tile"><span>움직인 거리</span><b>${km(tot)}</b><small>지구 한 바퀴의 ${earth.toFixed(earth < 1 ? 2 : 1)}%</small></div>
        <div class="bk-tile"><span>걸은 거리</span><b>${km(walk)}</b><small>마라톤 ${(walk / 42195).toFixed(1)}번</small></div>
        <div class="bk-tile"><span>걸음 수</span><b>${C.nf.format(steps)}</b><small>하루 평균 ${C.nf.format(Math.round(steps / Math.max(1, ds.filter(d => d.steps).length)))}걸음</small></div>
        <div class="bk-tile"><span>새로 밝힌 넓이</span><b>${C.fmtArea(area)}</b><small>축구장 ${C.nf.format(Math.round(area * 1e6 / 7140))}개</small></div>
        <div class="bk-tile"><span>차 · 기차</span><b>${km(car)}</b><small>서울–부산 ${(car / 325000).toFixed(1)}번</small></div>
        <div class="bk-tile"><span>비행기</span><b>${km(plane)}</b><small>${plane ? '하늘 위에서 보낸 거리' : '올해는 땅 위에서'}</small></div>
        <div class="bk-tile"><span>기록한 날</span><b>${ds.length}일</b><small>1년 중 ${Math.round(ds.length / 365 * 100)}%</small></div>
        <div class="bk-tile"><span>남긴 추억</span><b>${ms.length}개</b><small>사진 ${ms.reduce((s, m) => s + (m.photos || []).length, 0)}장</small></div>
      </div>
      <div class="bk-hl">
        ${bestWalk ? `<div><span>가장 많이 걸은 날</span><b>${C.fmtDayLabel(bestWalk.day)} · ${km(bestWalk.dist_walk)}</b></div>` : ''}
        ${bestTot ? `<div><span>가장 멀리 움직인 날</span><b>${C.fmtDayLabel(bestTot.day)} · ${km(C.total(bestTot))}</b></div>` : ''}
        ${bestSteps?.steps ? `<div><span>걸음이 가장 많았던 날</span><b>${C.fmtDayLabel(bestSteps.day)} · ${C.nf.format(bestSteps.steps)}걸음</b></div>` : ''}
        ${bestMonth?.dist ? `<div><span>가장 부지런했던 달</span><b>${bestMonth.m}월 · ${km(bestMonth.dist)}</b></div>` : ''}
      </div>${foot()}</div>`);

    // 달마다
    const maxD = Math.max(1, ...byMonth.map(x => x.dist));
    const dset = new Map(ds.map(d => [d.day, C.total(d)]));
    const maxDay = Math.max(1, ...dset.values());
    const start = new Date(`${Y}-01-01T00:00:00`); const cells = [];
    for (let i = 0; i < start.getDay(); i++) cells.push('<i style="visibility:hidden"></i>');
    for (let d = new Date(start); d.getFullYear() === +Y; d.setDate(d.getDate() + 1)) {
      const v = dset.get(C.dayOf(d.getTime())) || 0;
      const t = v ? 0.18 + 0.82 * Math.sqrt(v / maxDay) : 0;
      cells.push(`<i style="${v ? `background:rgba(224,164,58,${t.toFixed(2)})` : ''}"></i>`);
    }
    pages.push(`<div class="bookpage"><div class="kicker">MONTH BY MONTH</div><h2>달마다 얼마나 움직였을까</h2>
      <div class="bk-bars">${byMonth.map(x => `<div class="m"><b>${x.dist ? (x.dist / 1000).toFixed(0) + 'km' : ''}</b><i style="height:${(x.dist / maxD * 100).toFixed(1)}%"></i><span>${x.m}월</span></div>`).join('')}</div>
      <div><div class="muted" style="color:#6b7684;font-size:13px;margin-bottom:6px">하루하루 — 진할수록 많이 움직인 날</div><div class="bk-cal">${cells.join('')}</div></div>
      <table class="bk-tbl"><thead><tr><th>달</th><th>기록한 날</th><th>움직인 거리</th><th>걸음</th><th>새로 밝힌 넓이</th><th>추억</th></tr></thead>
      <tbody>${byMonth.map(x => `<tr><td>${x.m}월</td><td>${x.n}일</td><td>${x.dist ? km(x.dist) : '-'}</td><td>${x.steps ? C.nf.format(x.steps) : '-'}</td><td>${x.area ? C.fmtArea(x.area) : '-'}</td><td>${x.mem || '-'}</td></tr>`).join('')}</tbody></table>
      ${foot()}</div>`);

    // 열두 달의 길
    if ($('bMonths').checked) {
      snap.remove(); snap = new Snapper(300, 300, 2, true);
      const figs = [];
      for (let i = 0; i < 12; i++) {
        prog(25 + i * 5, `${i + 1}월 지도를 그리는 중…`);
        const mm = String(i + 1).padStart(2, '0'), pick = (d) => d.slice(0, 7) === `${Y}-${mm}`;
        const bb = C.boundsOf(pick);
        let src = '';
        if (bb) src = (await snap.snap({ bounds: bb, padding: 18 }, 'fog', pick)).toDataURL('image/jpeg', 0.85);
        figs.push(`<figure>${src ? `<img src="${src}" alt="">` : '<img alt="">'}<figcaption><b>${i + 1}월</b><span>${byMonth[i].dist ? km(byMonth[i].dist) : '기록 없음'}</span></figcaption></figure>`);
      }
      pages.push(`<div class="bookpage"><div class="kicker">TWELVE MAPS</div><h2>열두 달의 길</h2><div class="bk-months">${figs.join('')}</div>${foot()}</div>`);
    }

    // 추억
    prog(88, '추억을 엮는 중…');
    let list = [...ms].sort((x, y) => x.ts - y.ts);
    if ($('bPhotoOnly').checked) list = list.filter(m => (m.photos || []).length);
    list = list.slice(0, 120);
    for (let i = 0; i < list.length; i += 6) {
      const part = list.slice(i, i + 6);
      pages.push(`<div class="bookpage"><div class="kicker">MEMORIES</div><h2>${i === 0 ? '올해의 추억' : '추억, 이어서'}</h2><div class="bk-mems">${part.map(m => {
        const u = C.firstPhoto(m);
        return `<div class="bk-mem"><div class="ph" style="${u ? `background-image:url('${u}')` : ''}">${u ? '' : C.esc(m.icon || '📍')}</div>
          <b>${C.esc(m.icon)} ${C.esc(m.title || '제목 없음')}</b><span>${C.fmtDate(m.ts)}</span>${m.body ? `<p>${C.esc(m.body.slice(0, 140))}</p>` : ''}</div>`;
      }).join('')}</div>${foot()}</div>`);
    }

    // 마무리
    const S = C.summary;
    const badges = (S?.badges || []).filter(x => x.got);
    const towns = (S?.towns || []).slice().sort((x, y) => y.area - x.area).slice(0, 8);
    pages.push(`<div class="bookpage"><div class="kicker">SO FAR</div><h2>지금까지 모은 것들</h2>
      ${badges.length ? `<div class="bk-badges">${badges.slice(0, 16).map(x => `<div><i>${x.emoji}</i>${C.esc(x.title)}</div>`).join('')}</div>` : ''}
      ${towns.length ? `<table class="bk-tbl"><thead><tr><th>가장 많이 밝힌 동네</th><th>밝힌 넓이</th><th>정복률</th></tr></thead><tbody>${towns.map(t => `<tr><td>${C.esc(t.name)}</td><td>${C.fmtArea(t.area)}</td><td>${t.pct.toFixed(1)}%</td></tr>`).join('')}</tbody></table>` : ''}
      <div style="margin-top:auto;text-align:center;padding:40px 0"><div style="font-size:30px;font-weight:800">${Number(Y) + 1}에도 함께 걸어요</div>
      <div style="color:#6b7684;margin-top:8px">${C.esc(name || '')} · ${today().replaceAll('-', '.')} 엮음</div></div>${foot()}</div>`);

    $('bookWrap').innerHTML = pages.join('');
    prog(100, `${pages.length}쪽짜리 책을 만들었어요. 아래로 넘겨 보고 인쇄하거나 PDF로 저장하세요.`);
    $('bPrint').disabled = false;
  } catch (e) {
    $('bMsg').textContent = '책을 만들지 못했어요: ' + (e.message || e);
  } finally {
    snap?.remove(); btn.disabled = false; setTimeout(() => $('bProg').classList.add('hidden'), 1500);
  }
}

// ═════════ 3. 깊이 분석 ═════════
function analysisHtml() {
  return `<div class="tool">
  <div class="side">
    <h2>🔍 깊이 분석</h2>
    <p class="muted" style="margin:0">자주 다닌 곳일수록 지도가 붉게 달아올라요. 기간과 요일을 바꿔 보세요.</p>
    <label>기간</label>${rangePills('anRange', ['all', 'year', 'last', 'month', 'd30'])}
    <label>요일</label><div class="pills" id="anDow"><button data-k="all" aria-pressed="true">전체</button>${'일월화수목금토'.split('').map((d, i) => `<button data-k="${i}" aria-pressed="false">${d}</button>`).join('')}<button data-k="wk" aria-pressed="false">평일</button><button data-k="we" aria-pressed="false">주말</button></div>
    <div class="tiles" id="anTiles" style="grid-template-columns:1fr 1fr"></div>
    <div><h3 style="margin-bottom:6px">자주 간 곳</h3><p class="muted" style="margin:0 0 6px">약 200m 칸으로 나눠, 들른 날이 많은 순서예요. 누르면 지도에서 보여줘요.</p><table class="an-tbl" id="anTop"></table></div>
    <div><h3 style="margin-bottom:6px">요일별 평균</h3><table class="an-tbl" id="anWeek"></table></div>
    <div class="btnrow"><button class="btn" id="anCsvDays">하루 기록 CSV</button><button class="btn" id="anCsvTop">자주 간 곳 CSV</button></div>
    <p class="muted" style="margin:0">CSV는 엑셀·구글 시트에서 바로 열려요.</p>
  </div>
  <div class="stage"><div id="anMap" class="mapbox"></div><div class="float" id="anLegend"><div class="muted" style="margin-bottom:6px">가끔 → 자주</div><div class="heatkey"></div></div></div>
</div>`;
}
let an = null;
function initAnalysis() {
  an = { range: rangeOf('all'), dow: 'all' };
  an.map = C.makeMap('anMap');
  an.map.on('load', () => {
    // 배경 지도를 어둡게 눌러서 열지도가 잘 보이게
    for (const l of an.map.getStyle().layers) {
      try {
        if (l.type === 'background') an.map.setPaintProperty(l.id, 'background-color', '#10161F');
        else if (l.type === 'fill') an.map.setPaintProperty(l.id, 'fill-opacity', 0.25);
        else if (l.type === 'line') an.map.setPaintProperty(l.id, 'line-opacity', 0.25);
        else if (l.type === 'symbol') an.map.setPaintProperty(l.id, 'text-opacity', 0.55);
      } catch (e) {}
    }
    an.map.addSource('heat', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    an.map.addLayer({ id: 'heat', type: 'heatmap', source: 'heat', paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'n'], 1, 0.25, 5, 0.6, 30, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 12, 1.4, 16, 2.2],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 8, 14, 16, 17, 30],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(33,102,172,0)', 0.15, '#2166ac', 0.35, '#67a9cf', 0.55, '#fddbc7', 0.75, '#ef8a62', 1, '#b2182b'],
      'heatmap-opacity': 0.9 } });
    an.map.addLayer({ id: 'heatpt', type: 'circle', source: 'heat', minzoom: 15, paint: { 'circle-radius': 3, 'circle-color': '#fddbc7', 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 17, 0.7] } });
    runAnalysis(true);
  });
  bindPills('anRange', (k) => { an.range = rangeOf(k); runAnalysis(true); });
  bindPills('anDow', (k) => { an.dow = k; runAnalysis(false); });
  $('anCsvDays').onclick = () => {
    const rows = [['날짜', '요일', '총 이동(km)', '걷기(km)', '차·기차(km)', '비행기(km)', '걸음', '새로 밝힌 넓이(m²)']];
    for (const d of C.days) rows.push([d.day, C.DOW[new Date(d.day + 'T00:00:00').getDay()], (C.total(d) / 1000).toFixed(2), (d.dist_walk / 1000).toFixed(2), (d.dist_car / 1000).toFixed(2), (d.dist_plane / 1000).toFixed(2), d.steps ?? '', Math.round(d.area_km2 * 1e6)]);
    download('mapory-days.csv', csv(rows), 'text/csv');
  };
  $('anCsvTop').onclick = () => {
    const rows = [['순위', '이름', '위도', '경도', '들른 날', '처음', '마지막']];
    (an.top || []).forEach((t, i) => rows.push([i + 1, t.name, t.lat.toFixed(5), t.lon.toFixed(5), t.days, t.first, t.last]));
    download('mapory-places.csv', csv(rows), 'text/csv');
  };
}
function dowOk(day) {
  if (an.dow === 'all') return true;
  const w = new Date(day + 'T00:00:00').getDay();
  if (an.dow === 'wk') return w >= 1 && w <= 5;
  if (an.dow === 'we') return w === 0 || w === 6;
  return w === +an.dow;
}
function runAnalysis(fit) {
  if (!an.map._ready) return;
  const pick = (d) => d >= an.range[0] && d <= an.range[1] && dowOk(d);
  // 약 40m 칸(열지도)과 약 200m 칸(자주 간 곳)으로 모읍니다. 같은 날 여러 번 지나가도 하루로 셉니다.
  const fine = new Map(), coarse = new Map();
  for (const s of C.segs) {
    if (!pick(s.day)) continue;
    for (const [lo, la] of s.ll) {
      const fk = Math.round(la / 0.0004) + ':' + Math.round(lo / 0.0005);
      let f = fine.get(fk); if (!f) fine.set(fk, f = { la, lo, d: new Set() }); f.d.add(s.day);
      const ck = Math.round(la / 0.002) + ':' + Math.round(lo / 0.0025);
      let c = coarse.get(ck); if (!c) coarse.set(ck, c = { la: 0, lo: 0, k: 0, d: new Set() });
      c.la += la; c.lo += lo; c.k++; c.d.add(s.day);
    }
  }
  const feats = [];
  for (const f of fine.values()) feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lo, f.la] }, properties: { n: f.d.size } });
  an.map.getSource('heat').setData({ type: 'FeatureCollection', features: feats });
  // 자주 간 곳
  const near = (la, lo) => { let best = null, bd = 260; for (const m of C.mems) { const d = distM(la, lo, m.lat, m.lon); if (d < bd) { bd = d; best = m; } } return best; };
  an.top = [...coarse.values()].sort((x, y) => y.d.size - x.d.size).slice(0, 15).map(c => {
    const la = c.la / c.k, lo = c.lo / c.k, m = near(la, lo), ds = [...c.d].sort();
    return { lat: la, lon: lo, days: c.d.size, first: ds[0], last: ds[ds.length - 1], name: m ? `${m.icon || '📍'} ${m.title || '추억 근처'}` : '이름 없는 곳' };
  });
  $('anTop').innerHTML = `<tr><th>곳</th><th>들른 날</th><th>마지막</th></tr>` + (an.top.length ? an.top.map((t, i) =>
    `<tr class="click" data-i="${i}"><td>${i + 1}. ${C.esc(t.name)}</td><td>${t.days}일</td><td>${t.last.slice(2).replaceAll('-', '.')}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">이 기간에는 기록이 없어요.</td></tr>');
  $('anTop').querySelectorAll('tr.click').forEach(r => r.onclick = () => { const t = an.top[+r.dataset.i]; an.map.flyTo({ center: [t.lon, t.lat], zoom: 15.5 }); });
  // 숫자
  const ds = C.days.filter(d => pick(d.day));
  const multi = [...fine.values()].filter(f => f.d.size >= 10).length;
  const tot = ds.reduce((s, d) => s + C.total(d), 0);
  $('anTiles').innerHTML = `
    <div class="tile"><span>고른 날</span><b>${ds.length}일</b></div>
    <div class="tile"><span>움직인 거리</span><b>${km(tot)}</b></div>
    <div class="tile"><span>지나간 칸(약 40m)</span><b>${C.nf.format(fine.size)}</b></div>
    <div class="tile"><span>10일 넘게 지나간 칸</span><b class="a">${C.nf.format(multi)}</b><small>같은 길을 반복한 곳</small></div>`;
  // 요일별 평균 (요일 선택과 상관없이 기간 안에서)
  const inR = C.days.filter(d => d.day >= an.range[0] && d.day <= an.range[1]);
  const wk = Array.from({ length: 7 }, () => ({ n: 0, dist: 0, steps: 0, sn: 0 }));
  for (const d of inR) { const w = wk[new Date(d.day + 'T00:00:00').getDay()]; w.n++; w.dist += C.total(d); if (d.steps) { w.steps += d.steps; w.sn++; } }
  const maxW = Math.max(1, ...wk.map(w => w.n ? w.dist / w.n : 0));
  $('anWeek').innerHTML = `<tr><th>요일</th><th>평균 거리</th><th></th><th>평균 걸음</th></tr>` + wk.map((w, i) => {
    const avg = w.n ? w.dist / w.n : 0;
    return `<tr><td>${C.DOW[i]}</td><td>${w.n ? km(avg) : '-'}</td><td style="width:70px"><div class="bar"><i style="width:${(avg / maxW * 100).toFixed(1)}%"></i></div></td><td>${w.sn ? C.nf.format(Math.round(w.steps / w.sn)) : '-'}</td></tr>`;
  }).join('');
  if (fit) { const b = C.boundsOf(pick); if (b) an.map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 700 }); }
}

// ═════════ 4. 여행 계획 ═════════
function plansHtml() {
  return `<div class="tool">
  <div class="side">
    <h2>📍 여행 계획</h2>
    <p class="muted" style="margin:0">가고 싶은 곳을 찍어 두세요. 나중에 실제로 그곳을 지나가면 저절로 <b style="color:var(--green)">가 본 곳</b>으로 바뀌어요.</p>
    <div class="note warn hidden" id="plWarn">서버에 '여행 계획' 칸이 아직 없어요. Supabase에서 upgrade-2.sql을 실행해 주세요.</div>
    <label>장소 찾기<input type="search" id="plQ" placeholder="예: 경주 불국사, 오사카성"></label>
    <div class="results" id="plRes"></div>
    <p class="muted" style="margin:0">또는 지도에서 원하는 곳을 <b>클릭</b>하세요.</p>
    <h3 id="plTodoH">가고 싶은 곳</h3><div id="plTodo" style="display:flex;flex-direction:column;gap:6px"></div>
    <h3 id="plDoneH">가 본 곳</h3><div id="plDone" style="display:flex;flex-direction:column;gap:6px"></div>
  </div>
  <div class="stage"><div id="plMap" class="mapbox"></div></div>
</div>`;
}
let pl = null;
async function initPlans() {
  pl = { items: [], markers: [] };
  pl.map = C.makeMap('plMap');
  pl.fog = new C.Fog(pl.map);
  pl.map.on('load', () => { const b = C.boundsOf(() => true); if (b) pl.map.fitBounds(b, { padding: 60, maxZoom: 13, duration: 0 }); pl.fog.draw(); });
  pl.map.on('click', (e) => { if (e.originalEvent.target.closest('.ppin')) return; planForm({ lat: e.lngLat.lat, lon: e.lngLat.lng }); });
  let tmr;
  $('plQ').oninput = () => { clearTimeout(tmr); tmr = setTimeout(searchPlace, 450); };
  if (C.DEMO) pl.items = [{ id: 'd1', lat: 37.5796, lon: 126.977, title: '경복궁', note: '', icon: '⛪', done_day: null }, { id: 'd2', lat: 35.6586, lon: 139.7454, title: '도쿄 타워', note: '', icon: '⭐', done_day: null }, { id: 'd3', lat: 37.5512, lon: 126.9882, title: '남산타워', note: '야경 보기', icon: '🌸', done_day: null }];
  else {
    const { data, error } = await C.sb.from('plans').select('*').order('created_at');
    if (error) { $('plWarn').classList.remove('hidden'); pl.noTable = true; } else pl.items = data;
  }
  await checkVisited();
  renderPlans();
}
async function searchPlace() {
  const q = $('plQ').value.trim();
  if (q.length < 2) { $('plRes').innerHTML = ''; return; }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=ko&q=${encodeURIComponent(q)}`).then(r => r.json());
    $('plRes').innerHTML = r.length ? r.map((x, i) => `<button data-i="${i}">${C.esc(x.display_name)}</button>`).join('') : '<p class="muted">찾지 못했어요.</p>';
    $('plRes').querySelectorAll('button').forEach(b => b.onclick = () => {
      const x = r[+b.dataset.i]; const lat = +x.lat, lon = +x.lon;
      pl.map.flyTo({ center: [lon, lat], zoom: 14 });
      planForm({ lat, lon, title: x.display_name.split(',')[0] });
      $('plRes').innerHTML = ''; $('plQ').value = '';
    });
  } catch (e) { $('plRes').innerHTML = '<p class="muted">장소 찾기에 실패했어요. 잠시 뒤 다시 해 보세요.</p>'; }
}
/** 아직 안 간 곳 근처(150m)를 지나간 날이 있으면 '가 본 곳'으로 */
async function checkVisited() {
  for (const p of pl.items) {
    if (p.done_day) continue;
    const dLa = 150 / 111320, dLo = 150 / (111320 * Math.cos(p.lat * Math.PI / 180));
    let found = null;
    for (const s of C.segs) {
      if (found && s.day >= found) continue;
      for (const [lo, la] of s.ll) if (Math.abs(la - p.lat) < dLa && Math.abs(lo - p.lon) < dLo && distM(la, lo, p.lat, p.lon) < 150) { found = s.day; break; }
    }
    if (found) {
      p.done_day = found;
      if (!C.DEMO && !pl.noTable) await C.sb.from('plans').update({ done_day: found }).eq('id', p.id);
    }
  }
}
function renderPlans() {
  pl.markers.forEach(m => m.remove()); pl.markers = [];
  const todo = pl.items.filter(p => !p.done_day), done = pl.items.filter(p => p.done_day).sort((a, b) => b.done_day.localeCompare(a.done_day));
  const item = (p) => `<div class="planItem ${p.done_day ? 'done' : ''}" data-id="${p.id}"><span class="e">${C.esc(p.icon || '📍')}</span><div class="x"><b>${p.done_day ? '✓ ' : ''}${C.esc(p.title || '이름 없는 곳')}</b><span>${p.done_day ? C.fmtDayLabel(p.done_day) + '에 다녀옴' : C.esc(p.note || '아직 안 가 봤어요')}</span></div></div>`;
  $('plTodoH').textContent = `가고 싶은 곳 ${todo.length}`; $('plDoneH').textContent = `가 본 곳 ${done.length}`;
  $('plTodo').innerHTML = todo.map(item).join('') || '<p class="muted" style="margin:0">아직 없어요.</p>';
  $('plDone').innerHTML = done.map(item).join('') || '<p class="muted" style="margin:0">아직 없어요.</p>';
  document.querySelectorAll('#plTodo .planItem, #plDone .planItem').forEach(el => el.onclick = () => {
    const p = pl.items.find(x => String(x.id) === el.dataset.id); pl.map.flyTo({ center: [p.lon, p.lat], zoom: 15 }); planForm(p);
  });
  for (const p of pl.items) {
    const el = document.createElement('button'); el.className = 'ppin' + (p.done_day ? ' done' : ''); el.innerHTML = `<span>${C.esc(p.icon || '📍')}</span>`;
    el.setAttribute('aria-label', p.title); el.onclick = (e) => { e.stopPropagation(); planForm(p); };
    pl.markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(pl.map));
  }
}
function planForm(p) {
  const isNew = !p.id;
  const icons = ['📍', '⭐', '✈️', '🍽️', '☕', '⛰️', '🌊', '🏕️', '🌸', '⛪', '🏨', '🎵'];
  $('dlgBox').innerHTML = `<div class="top"><div><h3>${isNew ? '가고 싶은 곳 추가' : '계획 고치기'}</h3><div class="muted">${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}${p.done_day ? ` · ${C.fmtDayLabel(p.done_day)}에 다녀옴` : ''}</div></div><button class="x" id="dlgX" aria-label="닫기">✕</button></div>
    <div class="side" style="background:none;padding:0;gap:12px;display:flex;flex-direction:column">
      <label>이름<input type="text" id="pfT" maxlength="40" value="${C.esc(p.title || '')}"></label>
      <div class="iconGrid" id="pfI">${icons.map(i => `<button type="button" aria-pressed="${(p.icon || '📍') === i}">${i}</button>`).join('')}</div>
      <label>메모<input type="text" id="pfN" maxlength="80" value="${C.esc(p.note || '')}"></label>
      <div class="btnrow">${isNew ? '' : '<button class="btn" id="pfDel">삭제</button>'}<button class="btn primary" id="pfSave">저장</button></div>
    </div>`;
  $('dlg').showModal();
  let icon = p.icon || '📍';
  $('pfI').querySelectorAll('button').forEach(b => b.onclick = () => { icon = b.textContent; $('pfI').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $('dlgX').onclick = () => $('dlg').close();
  $('pfT').focus();
  $('pfSave').onclick = async () => {
    if (pl.noTable) { alertDlg('먼저 Supabase에서 upgrade-2.sql을 실행해 주세요.'); return; }
    const row = { lat: p.lat, lon: p.lon, title: $('pfT').value.trim(), note: $('pfN').value.trim(), icon };
    if (C.DEMO) { if (isNew) pl.items.push({ ...row, id: 'd' + Date.now(), done_day: null }); else Object.assign(p, row); }
    else if (isNew) { const { data, error } = await C.sb.from('plans').insert(row).select().single(); if (error) return alertDlg(error.message); pl.items.push(data); }
    else { const { error } = await C.sb.from('plans').update(row).eq('id', p.id); if (error) return alertDlg(error.message); Object.assign(p, row); }
    $('dlg').close(); await checkVisited(); renderPlans();
  };
  if (!isNew) $('pfDel').onclick = async () => {
    if (!C.DEMO) { const { error } = await C.sb.from('plans').delete().eq('id', p.id); if (error) return alertDlg(error.message); }
    pl.items = pl.items.filter(x => x !== p); $('dlg').close(); renderPlans();
  };
}
function alertDlg(msg) { $('dlgBox').innerHTML = `<div class="top"><h3>알림</h3><button class="x" id="dlgX" aria-label="닫기">✕</button></div><p>${C.esc(msg)}</p>`; if (!$('dlg').open) $('dlg').showModal(); $('dlgX').onclick = () => $('dlg').close(); }

// ═════════ 5. 추억 정리 작업실 ═════════
function workshopHtml() {
  return `<div class="tool">
  <div style="display:flex;flex-direction:column;min-height:0;height:100%">
    <div class="wsTop"><h2 style="margin:0 12px 0 0;font-size:22px">🗂️ 추억 정리</h2>
      <input type="search" id="wsQ" placeholder="제목·글로 찾기">
      <select id="wsIcon" style="width:auto"><option value="">모든 아이콘</option></select>
      <select id="wsSort" style="width:auto"><option value="new">최근 것부터</option><option value="old">오래된 것부터</option><option value="nophoto">사진 없는 것</option><option value="notitle">제목 없는 것</option></select>
    </div>
    <div class="note warn hidden" id="wsWarn" style="margin:0 20px 8px">서버에 '추억 정리' 칸이 아직 없어서 고칠 수 없어요. Supabase에서 upgrade-2.sql을 실행해 주세요.</div>
    <div id="wsBulk" class="hidden"><span id="wsN"></span><select id="wsBIcon" style="width:auto;height:34px"><option value="">아이콘 한꺼번에 바꾸기…</option></select><button class="btn" id="wsBDel" style="height:34px">고른 추억 지우기</button><button class="btn" id="wsBNone" style="height:34px">고르기 취소</button></div>
    <div id="wsList"></div>
  </div>
  <div class="side" id="wsEdit"><p class="muted">왼쪽에서 추억을 누르면 여기서 고칠 수 있어요. 여러 개를 체크하면 한꺼번에 아이콘을 바꾸거나 지울 수 있어요.</p>
    <div class="note">홈페이지에서 고친 내용은 앱이 다음에 동기화할 때 폰에도 반영돼요. (앱 설정 → 홈페이지 동기화 → 지금 동기화)</div></div>
</div>`;
}
let ws = null;
function initWorkshop() {
  ws = { sel: new Set(), cur: null };
  if (!C.hasWebCols) $('wsWarn').classList.remove('hidden');
  const opts = ICONS.map(i => `<option value="${i}">${i} ${C.ICON_NAMES[i] || ''}</option>`).join('');
  $('wsIcon').innerHTML += opts; $('wsBIcon').innerHTML += opts;
  $('wsQ').oninput = $('wsIcon').onchange = $('wsSort').onchange = renderWsList;
  $('wsBNone').onclick = () => { ws.sel.clear(); renderWsList(); };
  $('wsBIcon').onchange = async () => {
    const icon = $('wsBIcon').value; if (!icon) return;
    await saveMems([...ws.sel].map(id => ({ id, icon })));
    $('wsBIcon').value = ''; ws.sel.clear(); renderWsList();
  };
  $('wsBDel').onclick = () => confirmDel([...ws.sel]);
  renderWsList();
}
function wsFiltered() {
  const q = $('wsQ').value.trim().toLowerCase(), ic = $('wsIcon').value, sort = $('wsSort').value;
  let l = C.mems.filter(m => (!q || (m.title + ' ' + m.body).toLowerCase().includes(q)) && (!ic || m.icon === ic));
  if (sort === 'nophoto') l = l.filter(m => !(m.photos || []).length);
  if (sort === 'notitle') l = l.filter(m => !m.title);
  return l.sort((a, b) => sort === 'old' ? a.ts - b.ts : b.ts - a.ts);
}
function renderWsList() {
  if (!ws) return;
  const l = wsFiltered();
  $('wsList').innerHTML = l.length ? l.map(m => {
    const u = C.firstPhoto(m);
    return `<div class="wsRow ${ws.sel.has(m.id) ? 'sel' : ''}" data-id="${m.id}"><input type="checkbox" ${ws.sel.has(m.id) ? 'checked' : ''} aria-label="고르기">
      <div class="th" style="${u ? `background-image:url('${u}')` : ''}">${u ? '' : C.esc(m.icon || '📍')}</div>
      <div style="min-width:0"><b>${C.esc(m.icon)} ${C.esc(m.title || '제목 없음')}</b><span>${C.esc(m.body || '')}</span></div><div class="d">${C.fmtDate(m.ts)}</div></div>`;
  }).join('') : '<p class="muted" style="padding:20px">맞는 추억이 없어요.</p>';
  $('wsList').querySelectorAll('.wsRow').forEach(r => {
    const id = +r.dataset.id;
    r.querySelector('input').onclick = (e) => { e.stopPropagation(); if (e.target.checked) ws.sel.add(id); else ws.sel.delete(id); renderWsList(); };
    r.onclick = () => wsOpen(id);
  });
  $('wsBulk').classList.toggle('hidden', !ws.sel.size);
  $('wsN').textContent = `${ws.sel.size}개 고름`;
}
function wsOpen(id) {
  const m = C.mems.find(x => x.id === id); if (!m) return;
  ws.cur = { ...m };
  const d = new Date(m.ts), local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const imgs = (m.photos || []).map(p => C.pUrl(p)).filter(Boolean);
  $('wsEdit').innerHTML = `<h3 style="font-size:18px">추억 고치기</h3>
    ${imgs.length ? `<div class="wsPhotos">${imgs.map(u => `<img src="${u}" alt="">`).join('')}</div>` : ''}
    <label>제목<input type="text" id="weT" maxlength="60" value="${C.esc(m.title)}"></label>
    <label>날짜·시간<input type="datetime-local" id="weD" value="${local}"></label>
    <label>아이콘</label><div class="iconGrid" id="weI"><button type="button" aria-pressed="${!m.icon}" title="기본 핀">·</button>${ICONS.map(i => `<button type="button" aria-pressed="${m.icon === i}" title="${C.ICON_NAMES[i] || ''}">${i}</button>`).join('')}</div>
    <label>글 (길게 써도 돼요)<textarea id="weB">${C.esc(m.body)}</textarea></label>
    <label>위치 — 핀을 끌어서 옮길 수 있어요</label><div id="wsMap"></div>
    <div class="btnrow"><button class="btn" id="weDel">지우기</button><button class="btn primary" id="weSave">저장</button></div>
    <span class="muted" id="weMsg"></span>`;
  $('weI').querySelectorAll('button').forEach(b => b.onclick = () => { ws.cur.icon = b.textContent === '·' ? '' : b.textContent; $('weI').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  ws.map?.remove();
  ws.map = new maplibregl.Map({ container: 'wsMap', style: C.STYLE, center: [m.lon, m.lat], zoom: 15, dragRotate: false, attributionControl: false });
  const mk = new maplibregl.Marker({ draggable: true, color: '#F5B041' }).setLngLat([m.lon, m.lat]).addTo(ws.map);
  mk.on('dragend', () => { const p = mk.getLngLat(); ws.cur.lat = p.lat; ws.cur.lon = p.lng; });
  $('weSave').onclick = async () => {
    const t = new Date($('weD').value).getTime();
    const ch = { id, title: $('weT').value.trim(), body: $('weB').value, icon: ws.cur.icon, lat: ws.cur.lat, lon: ws.cur.lon, ts: Number.isFinite(t) ? t : m.ts };
    if (await saveMems([ch])) $('weMsg').textContent = '저장했어요. 앱에는 다음 동기화 때 반영돼요.';
    renderWsList();
  };
  $('weDel').onclick = () => confirmDel([id]);
}
async function saveMems(changes) {
  if (!C.hasWebCols) { alertDlg('먼저 Supabase에서 upgrade-2.sql을 실행해 주세요.'); return false; }
  for (const ch of changes) {
    const { id, ...rest } = ch;
    if (!C.DEMO) {
      const { error } = await C.sb.from('memories').update({ ...rest, web_edited: true }).eq('id', id);
      if (error) { alertDlg('저장하지 못했어요: ' + error.message); return false; }
    }
    const m = C.mems.find(x => x.id === id); if (m) Object.assign(m, rest);
  }
  C.refresh();
  return true;
}
function confirmDel(ids) {
  $('dlgBox').innerHTML = `<div class="top"><h3>추억 ${ids.length}개를 지울까요?</h3><button class="x" id="dlgX" aria-label="닫기">✕</button></div>
    <p>홈페이지에서 바로 사라지고, 앱이 다음에 동기화할 때 폰에서도 사진과 함께 지워져요. 되돌릴 수 없어요.</p>
    <div class="btnrow"><button class="btn" id="cdNo">그만두기</button><button class="btn primary" id="cdYes">지우기</button></div>`;
  $('dlg').showModal();
  $('dlgX').onclick = $('cdNo').onclick = () => $('dlg').close();
  $('cdYes').onclick = async () => {
    if (!C.hasWebCols) { alertDlg('먼저 Supabase에서 upgrade-2.sql을 실행해 주세요.'); return; }
    for (const id of ids) {
      if (!C.DEMO) { const { error } = await C.sb.from('memories').update({ web_deleted: true }).eq('id', id); if (error) { alertDlg('지우지 못했어요: ' + error.message); return; } }
    }
    C.mems = C.mems.filter(m => !ids.includes(m.id));
    ids.forEach(id => ws.sel.delete(id));
    $('dlg').close(); C.refresh(); renderWsList();
    $('wsEdit').innerHTML = `<p class="muted">${ids.length}개를 지웠어요.</p>`;
  };
}

// ═════════ 6. 옛 기록 불러오기 ═════════
function importHtml() {
  return `<div class="tool">
  <div class="side">
    <h2>📥 옛 기록 불러오기</h2>
    <p class="muted" style="margin:0">Mapory를 쓰기 전의 흔적도 안개 지도에 채울 수 있어요. 불러온 기록은 앱 기록과 따로 보관되고, 홈페이지 지도·포스터·분석에 함께 나와요.</p>
    <div class="note warn hidden" id="imWarn">서버에 '옛 기록' 칸이 아직 없어요. Supabase에서 upgrade-2.sql을 실행해 주세요.</div>
    <div class="card" style="padding:16px;gap:10px;background:var(--field)">
      <h3>🗺️ 구글 타임라인</h3>
      <p class="muted" style="margin:0">휴대폰 설정 → 위치 → 타임라인 → <b>타임라인 내보내기</b>로 받은 Timeline.json, 또는 예전 구글 테이크아웃의 위치 기록(.json, 여러 개 가능)을 고르세요.</p>
      <input type="file" id="imG" accept=".json,application/json" multiple>
    </div>
    <div class="card" style="padding:16px;gap:10px;background:var(--field)">
      <h3>📷 옛 사진 위치</h3>
      <p class="muted" style="margin:0">위치 정보가 담긴 사진을 고르면 찍은 곳의 안개가 걷혀요. 사진 자체는 올리지 않고 위치와 날짜만 읽어요. 사진 위치는 선으로 잇지 않고, 여정 영상에도 넣지 않아요.</p>
      <input type="file" id="imP" accept="image/*,.heic,.heif" multiple>
      <label class="chk" style="font-size:13px"><input type="checkbox" id="imPDir"> 폴더째 고르기</label>
    </div>
    <div class="prog hidden" id="imProg"><i></i></div>
    <div id="imResult"></div>
    <h3>불러온 기록</h3><div id="imState" class="muted"></div>
    <p class="muted" style="margin:0">지도의 <b style="color:var(--amber)">주황 점</b>(사진 위치)을 누르면 하나씩 지울 수 있어요. 내가 간 곳이 아닌 사진(받은 사진 등)을 정리할 때 쓰세요.</p>
  </div>
  <div class="stage"><div id="imMap" class="mapbox"></div></div>
</div>`;
}
let im = null;
function initImport() {
  im = { pending: null };
  if (!C.hasExtra) $('imWarn').classList.remove('hidden');
  im.map = C.makeMap('imMap');
  im.map.on('load', () => {
    im.map.addSource('imp', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    im.map.addLayer({ id: 'imp-l', type: 'line', source: 'imp', paint: { 'line-color': '#7FB6F2', 'line-width': 3 } });
    im.map.addLayer({ id: 'imp-p', type: 'circle', source: 'imp', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': '#F5B041', 'circle-radius': 6.5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    showImportOnMap();
    // 사진 위치 점을 누르면 하나씩 지울 수 있음
    im.map.on('mouseenter', 'imp-p', () => { im.map.getCanvas().style.cursor = 'pointer'; });
    im.map.on('mouseleave', 'imp-p', () => { im.map.getCanvas().style.cursor = ''; });
    im.map.on('click', 'imp-p', (e) => {
      const f = e.features?.[0]; if (!f || !f.properties.src || im.pending) return;
      const { src, day, i } = f.properties;
      // 지도에 그려진 좌표는 반올림돼 있으므로, 저장된 기록에서 원래 좌표를 다시 꺼냄
      const row = C.extra.find(x => x.source === src && x.day === day); if (!row) return;
      const all = row.track.split(' ').flatMap(part => C.decode(part)); if (!all[i]) return;
      const [lat, lon] = all[i];
      const box = document.createElement('div'); box.className = 'pop';
      box.innerHTML = `<div class="t">${src === 'phone' ? '📱 폰 사진 위치' : '📷 사진 위치'}</div><div class="d">${C.fmtDayLabel(day)} · ${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
        <p class="muted" style="margin:6px 0">내가 간 곳이 아니면(받은 사진 등) 지우세요.${src === 'phone' ? ' 다음 동기화 때 폰에서도 사라져요.' : ''}</p>
        <button class="btn" style="height:36px;width:100%">이 위치 지우기</button>`;
      const pop = new maplibregl.Popup({ offset: 10, maxWidth: '260px' }).setLngLat([lon, lat]).setDOMContent(box).addTo(im.map);
      box.querySelector('button').onclick = async () => { pop.remove(); await removeExtraPoint(src, day, i); };
    });
  });
  $('imPDir').onchange = () => { const i = $('imP'); if ($('imPDir').checked) i.setAttribute('webkitdirectory', ''); else i.removeAttribute('webkitdirectory'); };
  $('imG').onchange = () => importGoogle([...$('imG').files]);
  $('imP').onchange = () => importPhotos([...$('imP').files]);
  renderImportState();
}
function renderImportState() {
  if (!im) return;
  const by = {};
  for (const e of C.extra) { by[e.source] ??= { n: 0, a: e.day, b: e.day }; const x = by[e.source]; x.n++; if (e.day < x.a) x.a = e.day; if (e.day > x.b) x.b = e.day; }
  const name = { google: '🗺️ 구글 타임라인', photo: '📷 사진 위치 (홈페이지에서 불러옴)', phone: '📱 폰 사진 위치 (앱에서 올림)' };
  $('imState').innerHTML = Object.keys(by).length ? Object.entries(by).map(([k, x]) =>
    `<div class="row" style="align-items:center;margin-bottom:8px"><span>${name[k] || k} · ${x.n}일 (${x.a} ~ ${x.b})</span><button class="btn" data-del="${k}" style="height:34px">지우기</button></div>`).join('') : '아직 없어요.';
  $('imState').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const src = b.dataset.del;
    if (src === 'phone' && !confirm('폰에서 올린 사진 위치를 모두 지울까요? 다음 동기화 때 폰 지도에서도 사라져요.')) return;
    if (!C.DEMO) { const { error } = await C.sb.from('extra_days').delete().eq('source', src); if (error) return alertDlg(error.message); }
    C.extra = C.extra.filter(e => e.source !== src); C.refresh(); renderImportState(); showImportOnMap();
  });
}
function showImportOnMap(rows, fit = true) {
  if (!im?.map?._ready) return;
  const saved = !rows;
  rows ||= C.extra;
  const feats = [];
  for (const r of rows) {
    const pts = (r.track || '').split(' ').flatMap(part => C.decode(part)); if (!pts.length) continue;
    // 사진 위치는 점마다 보여주고(선으로 잇지 않음), 저장된 것은 눌러서 지울 수 있게
    const src = r.source || im.pending?.source;
    if (pts.length > 1 && src === 'google') feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map(p => [p[1], p[0]]) } });
    if (src === 'photo' || src === 'phone' || pts.length === 1)
      pts.forEach((p, i) => feats.push({ type: 'Feature', properties: saved ? { src, day: r.day, i } : {}, geometry: { type: 'Point', coordinates: [p[1], p[0]] } }));
  }
  im.map.getSource('imp').setData({ type: 'FeatureCollection', features: feats });
  const la = [], lo = [];
  for (const f of feats) { const cs = f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates; for (const c of cs) { lo.push(c[0]); la.push(c[1]); } }
  if (fit && la.length) im.map.fitBounds([[Math.min(...lo), Math.min(...la)], [Math.max(...lo), Math.max(...la)]], { padding: 60, maxZoom: 14, duration: 600 });
}
/** 불러온 옛 기록에서 점 하나를 지움 (그날 점이 하나도 안 남으면 그날 기록을 지움) */
async function removeExtraPoint(src, day, idx) {
  const row = C.extra.find(e => e.source === src && e.day === day); if (!row) return;
  const rest = row.track.split(' ').flatMap(part => C.decode(part)).filter((p, i) => i !== idx);
  if (!C.DEMO) {
    const q = C.sb.from('extra_days');
    const { error } = rest.length ? await q.update({ track: C.encodeLine(rest), updated_at: new Date().toISOString() }).eq('source', src).eq('day', day)
      : await q.delete().eq('source', src).eq('day', day);
    if (error) return alertDlg('지우지 못했어요: ' + error.message);
  }
  if (rest.length) row.track = C.encodeLine(rest); else C.extra = C.extra.filter(e => e !== row);
  C.refresh(); renderImportState(); showImportOnMap(null, false);
}
/** "37.123°, 127.456°", "geo:37.1,127.4", {latitudeE7..} 등 여러 모양의 좌표를 읽음 */
function parseLL(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    const m = v.replace('geo:', '').match(/(-?\d+(?:\.\d+)?)\D+?(-?\d+(?:\.\d+)?)/);
    return m ? [+m[1], +m[2]] : null;
  }
  if (v.latitudeE7 != null) return [v.latitudeE7 / 1e7, v.longitudeE7 / 1e7];
  if (v.latE7 != null) return [v.latE7 / 1e7, v.lngE7 / 1e7];
  if (v.latLng) return parseLL(v.latLng);
  if (v.LatLng) return parseLL(v.LatLng);
  if (v.point) return parseLL(v.point);
  if (v.placeLocation) return parseLL(v.placeLocation.latLng || v.placeLocation);
  return null;
}
const tms = (v) => { if (v == null) return NaN; if (typeof v === 'number') return v; if (/^\d+$/.test(v)) return +v; return Date.parse(v); };
/** 구글 타임라인 여러 형식 → [{t, lat, lon, visit?}] */
function googlePoints(j) {
  const out = [];
  const add = (ll, t, visit = false) => { if (ll && Number.isFinite(t) && Math.abs(ll[0]) <= 90 && Math.abs(ll[1]) <= 180) out.push({ lat: ll[0], lon: ll[1], t, visit }); };
  // 예전 테이크아웃 Records.json
  if (Array.isArray(j.locations)) for (const p of j.locations) add(parseLL(p), tms(p.timestamp ?? p.timestampMs), false);
  // 예전 테이크아웃 월별 Semantic Location History
  if (Array.isArray(j.timelineObjects)) for (const o of j.timelineObjects) {
    const a = o.activitySegment, v = o.placeVisit;
    if (a) {
      const t0 = tms(a.duration?.startTimestamp ?? a.duration?.startTimestampMs), t1 = tms(a.duration?.endTimestamp ?? a.duration?.endTimestampMs);
      add(parseLL(a.startLocation), t0);
      for (const p of a.simplifiedRawPath?.points || []) add(parseLL(p), tms(p.timestamp ?? p.timestampMs));
      for (const p of a.waypointPath?.waypoints || []) add(parseLL(p), NaN);
      add(parseLL(a.endLocation), t1);
    }
    if (v) add(parseLL(v.location), tms(v.duration?.startTimestamp ?? v.duration?.startTimestampMs), true);
  }
  // 새 휴대폰 내보내기 (안드로이드 Timeline.json)
  const segsArr = Array.isArray(j.semanticSegments) ? j.semanticSegments : Array.isArray(j) ? j : null;
  if (segsArr) for (const s of segsArr) {
    const t0 = tms(s.startTime);
    if (s.visit) add(parseLL(s.visit.topCandidate?.placeLocation ?? s.visit.topCandidate), t0, true);
    if (s.activity) { add(parseLL(s.activity.start), t0); add(parseLL(s.activity.end), tms(s.endTime)); }
    for (const p of s.timelinePath || []) add(parseLL(p.point ?? p), p.time ? tms(p.time) : t0 + (+(p.durationMinutesOffsetFromStartTime) || 0) * 60000);
  }
  if (Array.isArray(j.rawSignals)) for (const r of j.rawSignals) if (r.position) add(parseLL(r.position.LatLng ?? r.position.latLng), tms(r.position.timestamp));
  return out;
}
/** 점들을 날짜별 길로: 시간 순서대로 한 줄로 잇기 */
function pointsToDays(pts, joinLines) {
  pts.sort((a, b) => a.t - b.t);
  const byDay = new Map();
  for (const p of pts) { const d = C.dayOf(p.t); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(p); }
  const rows = [];
  for (const [day, ps] of byDay) {
    const parts = []; let cur = [], curT = []; const tParts = []; let walk = 0, car = 0, plane = 0, last = null;
    const t0 = new Date(day + 'T00:00:00').getTime();
    for (const p of ps) {
      if (last) {
        const d = distM(last.lat, last.lon, p.lat, p.lon);
        if (d < 8) continue;
        const dt = (p.t - last.t) / 1000, v = dt > 0 ? d / dt : Infinity;
        // 앱 기록처럼 끊긴 사이도 이어 붙입니다 (하루치를 시간 순서대로 한 줄로)
        if (v > 70) plane += d; else if (v > 2.8) car += d; else if (dt > 0) walk += d;
      }
      cur.push([p.lat, p.lon]); curT.push(Number.isFinite(p.t) ? Math.max(0, Math.round((p.t - t0) / 1000)) : 0); last = p;
    }
    if (cur.length) { parts.push(cur); tParts.push(curT); }
    // 시각(그날 0시부터 초)도 함께 담아 여정 영상에서 속도·이동 수단을 알 수 있게
    rows.push({ day, track: parts.map(C.encodeLine).join(' '), times: tParts.map(C.encodeNums).join(' '), dist_walk: walk, dist_car: car, dist_plane: plane });
  }
  return rows.sort((a, b) => a.day.localeCompare(b.day));
}
async function importGoogle(files) {
  if (!files.length) return;
  const prog = $('imProg'); prog.classList.remove('hidden');
  const pts = [];
  try {
    for (let i = 0; i < files.length; i++) {
      $('imResult').innerHTML = `<p class="muted">${C.esc(files[i].name)} 읽는 중… (${i + 1}/${files.length})</p>`;
      prog.firstElementChild.style.width = ((i + 0.5) / files.length * 90) + '%';
      const j = JSON.parse(await files[i].text());
      pts.push(...googlePoints(j));
      await sleep(10);
    }
  } catch (e) { $('imResult').innerHTML = `<div class="note warn">파일을 읽지 못했어요: ${C.esc(e.message)}<br>파일이 너무 크면(수백 MB) 월별 파일로 나눠 고르세요.</div>`; prog.classList.add('hidden'); return; }
  prog.firstElementChild.style.width = '100%'; setTimeout(() => prog.classList.add('hidden'), 800);
  if (!pts.length) { $('imResult').innerHTML = '<div class="note warn">위치 기록을 찾지 못했어요. 타임라인 내보내기 파일이 맞는지 확인해 주세요.</div>'; return; }
  previewImport('google', pointsToDays(pts, true), pts.length);
}
async function importPhotos(files) {
  files = files.filter(f => /\.(jpe?g|heic|heif|png|tiff?|dng|webp)$/i.test(f.name) || f.type.startsWith('image/'));
  if (!files.length) return;
  const prog = $('imProg'); prog.classList.remove('hidden');
  $('imResult').innerHTML = '<p class="muted">사진 읽는 도구를 준비하는 중…</p>';
  const exifr = (await import('https://esm.sh/exifr@7/dist/full.esm.mjs')).default;
  const pts = []; let noGps = 0;
  for (let i = 0; i < files.length; i++) {
    if (i % 10 === 0) { $('imResult').innerHTML = `<p class="muted">사진 ${i + 1} / ${files.length} 읽는 중… (위치 있는 사진 ${pts.length}장)</p>`; prog.firstElementChild.style.width = (i / files.length * 100) + '%'; await sleep(0); }
    try {
      const o = await exifr.parse(files[i], { gps: true, pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef'] });
      const t = (o?.DateTimeOriginal || o?.CreateDate)?.getTime?.() ?? files[i].lastModified;
      if (o && Number.isFinite(o.latitude) && Number.isFinite(o.longitude) && (o.latitude || o.longitude)) pts.push({ lat: o.latitude, lon: o.longitude, t });
      else noGps++;
    } catch (e) { noGps++; }
  }
  prog.firstElementChild.style.width = '100%'; setTimeout(() => prog.classList.add('hidden'), 800);
  if (!pts.length) { $('imResult').innerHTML = `<div class="note warn">위치 정보가 있는 사진이 없어요. (${files.length}장 모두 위치 없음)</div>`; return; }
  previewImport('photo', pointsToDays(pts, false), pts.length, noGps);
}
function previewImport(source, rows, nPts, noGps = 0) {
  im.pending = { source, rows };
  const a = rows[0]?.day, b = rows[rows.length - 1]?.day;
  const appDays = new Set(C.days.map(d => d.day)), overlap = rows.filter(r => appDays.has(r.day)).length;
  $('imResult').innerHTML = `<div class="card" style="padding:16px;gap:8px;background:var(--field)">
    <b>${rows.length}일치를 찾았어요</b>
    <span class="muted">${a} ~ ${b} · 위치 ${C.nf.format(nPts)}개${noGps ? ` · 위치 없는 사진 ${noGps}장은 건너뜀` : ''}${overlap ? ` · 앱 기록과 겹치는 날 ${overlap}일은 길만 합쳐서 보여줘요` : ''}</span>
    <span class="muted">오른쪽 지도에서 미리 보고, 맞으면 저장하세요.</span>
    <div class="btnrow"><button class="btn" id="imCancel">그만두기</button><button class="btn primary" id="imSave">저장</button></div></div>`;
  showImportOnMap(rows);
  $('imCancel').onclick = () => { im.pending = null; $('imResult').innerHTML = ''; showImportOnMap(); };
  $('imSave').onclick = saveImport;
}
async function saveImport() {
  const { source, rows } = im.pending;
  if (!C.hasExtra) { alertDlg('먼저 Supabase에서 upgrade-2.sql을 실행해 주세요.'); return; }
  // 사진은 여러 번에 나눠 불러올 수 있으니 같은 날의 기존 점과 합칩니다.
  const merged = rows.map(r => {
    const old = C.extra.find(e => e.source === source && e.day === r.day);
    if (!old || source !== 'photo') return r;
    // 예전에 불러온 점과 새 점을 합쳐 한 줄로 (같은 자리는 한 번만)
    const seen = new Set(), all = [];
    for (const t of [old.track, r.track]) for (const part of t.split(' ')) for (const p of C.decode(part)) { const k = p[0].toFixed(5) + ',' + p[1].toFixed(5); if (!seen.has(k)) { seen.add(k); all.push(p); } }
    return { ...r, track: C.encodeLine(all), times: '' };
  });
  $('imSave').disabled = true;
  if (!C.DEMO) {
    for (let i = 0; i < merged.length; i += 200) {
      $('imSave').textContent = `저장 중… ${Math.min(i + 200, merged.length)}/${merged.length}`;
      let batch = merged.slice(i, i + 200).map(r => ({ ...r, source }));
      let { error } = await C.sb.from('extra_days').upsert(batch, { onConflict: 'user_id,source,day' });
      // 서버에 시각(times) 칸이 아직 없으면 시각 없이 저장
      if (error && /times/.test(error.message)) ({ error } = await C.sb.from('extra_days').upsert(batch.map(({ times, ...r }) => r), { onConflict: 'user_id,source,day' }));
      if (error) { alertDlg('저장하지 못했어요: ' + error.message); $('imSave').disabled = false; return; }
    }
  }
  const keep = C.extra.filter(e => !(e.source === source && merged.some(r => r.day === e.day)));
  C.extra = [...keep, ...merged.map(r => ({ ...r, source }))].sort((x, y) => x.day.localeCompare(y.day));
  C.refresh(); im.pending = null;
  $('imResult').innerHTML = `<div class="note">${merged.length}일치를 저장했어요. 🗺️ 지도에서 안개가 걷힌 걸 확인해 보세요.</div>`;
  renderImportState(); showImportOnMap();
}

// ═════════ 7. 백업 ═════════
function backupHtml() {
  return `<div class="scroll" style="max-width:820px">
  <h2>💾 백업</h2>
  <p class="muted">서버에 있는 Mapory 기록을 내 컴퓨터에 내려받아요. 휴대폰을 바꾸거나 잃어버려도, 서버에 문제가 생겨도 기록을 지킬 수 있어요.</p>
  <div class="card" style="margin-top:18px"><h3>☁️ 서버 사용량 (Supabase 무료 한도)</h3><div id="usageCard" style="display:flex;flex-direction:column;gap:12px"></div></div>
  <div class="card" style="margin-top:14px"><h3>📦 전체 백업 (zip 파일 하나)</h3>
    <div id="bkInfo" class="muted"></div>
    <label class="chk"><input type="checkbox" id="bkPhotos" checked> 사진도 함께 받기</label>
    <button class="btn primary" id="bkAll" style="align-self:flex-start">📦 전체 백업 내려받기</button>
    <div class="prog hidden" id="bkProg"><i></i></div><span class="muted" id="bkMsg"></span></div>
  <div class="grid" style="margin-top:14px">
    <div class="card"><h3>🛰️ GPX (다닌 길)</h3><p class="muted" style="margin:0">구글 어스, 스트라바, 등산 앱 등 대부분의 지도 프로그램에서 열려요.</p>${rangePills('bkGpxR', ['all', 'year', 'last', 'month'])}<button class="btn" id="bkGpx">GPX 내려받기</button></div>
    <div class="card"><h3>📊 CSV (하루 기록·추억)</h3><p class="muted" style="margin:0">엑셀이나 구글 시트에서 바로 열려요.</p><div class="btnrow"><button class="btn" id="bkCsvD">하루 기록</button><button class="btn" id="bkCsvM">추억 목록</button></div></div>
  </div>
  <div class="note" style="margin-top:14px">zip 안에 '읽어 주세요.txt'가 들어 있어요. 길은 날마다 GPX와 days.json 두 가지로 담겨서, 나중에 다른 프로그램으로 옮길 때도 쓸 수 있어요.</div>
</div>`;
}
function initBackup() {
  renderBackupInfo(); renderUsage();
  bindPills('bkGpxR', (k) => { $('bkGpxR').dataset.k = k; });
  $('bkGpx').onclick = () => { const [a, b] = rangeOf($('bkGpxR').dataset.k || 'all'); download(`mapory-${a}_${b}.gpx`, gpx((d) => d >= a && d <= b), 'application/gpx+xml'); };
  $('bkCsvD').onclick = () => download('mapory-days.csv', daysCsv(), 'text/csv');
  $('bkCsvM').onclick = () => download('mapory-memories.csv', memsCsv(), 'text/csv');
  $('bkAll').onclick = backupAll;
}
function renderBackupInfo() {
  if (!$('bkInfo')) return;
  const nPhotos = C.mems.reduce((s, m) => s + (m.photos || []).length, 0);
  $('bkInfo').textContent = `하루 기록 ${C.nf.format(C.days.length)}일 · 추억 ${C.nf.format(C.mems.length)}개 · 사진 ${C.nf.format(nPhotos)}장${C.extra.length ? ` · 불러온 옛 기록 ${C.nf.format(C.extra.length)}일` : ''}`;
}
function gpx(pick) {
  const x = (s) => C.esc(s);
  let out = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Mapory" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>Mapory</name><time>${new Date().toISOString()}</time></metadata>\n`;
  for (const m of C.mems) if (pick(C.dayOf(m.ts))) out += `<wpt lat="${m.lat.toFixed(6)}" lon="${m.lon.toFixed(6)}"><time>${new Date(m.ts).toISOString()}</time><name>${x((m.icon ? m.icon + ' ' : '') + (m.title || '추억'))}</name>${m.body ? `<desc>${x(m.body)}</desc>` : ''}</wpt>\n`;
  const byDay = new Map();
  for (const s of C.segs) if (pick(s.day)) { if (!byDay.has(s.day)) byDay.set(s.day, []); byDay.get(s.day).push(s); }
  for (const [day, ss] of byDay) {
    out += `<trk><name>${day}</name>\n`;
    for (const s of ss) out += '<trkseg>' + s.ll.map(([lo, la]) => `<trkpt lat="${la.toFixed(5)}" lon="${lo.toFixed(5)}"/>`).join('') + '</trkseg>\n';
    out += '</trk>\n';
  }
  return out + '</gpx>\n';
}
function daysCsv() {
  const rows = [['날짜', '요일', '총 이동(km)', '걷기(km)', '차·기차(km)', '비행기(km)', '걸음', '새로 밝힌 넓이(m²)']];
  for (const d of C.days) rows.push([d.day, C.DOW[new Date(d.day + 'T00:00:00').getDay()], (C.total(d) / 1000).toFixed(2), (d.dist_walk / 1000).toFixed(2), (d.dist_car / 1000).toFixed(2), (d.dist_plane / 1000).toFixed(2), d.steps ?? '', Math.round(d.area_km2 * 1e6)]);
  return csv(rows);
}
function memsCsv() {
  const rows = [['날짜', '시간', '아이콘', '제목', '글', '위도', '경도', '사진 수']];
  for (const m of [...C.mems].sort((a, b) => a.ts - b.ts)) { const d = new Date(m.ts); rows.push([C.dayOf(m.ts), d.toTimeString().slice(0, 5), m.icon, m.title, m.body, m.lat.toFixed(6), m.lon.toFixed(6), (m.photos || []).length]); }
  return csv(rows);
}
async function backupAll() {
  const btn = $('bkAll'); btn.disabled = true;
  const prog = (p, t) => { $('bkProg').classList.remove('hidden'); $('bkProg').firstElementChild.style.width = p + '%'; $('bkMsg').textContent = t; };
  try {
    prog(3, '압축 도구를 준비하는 중…');
    const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
    const zip = new JSZip();
    const stamp = today();
    zip.file('읽어 주세요.txt', [
      `Mapory 백업 — ${stamp}`, '',
      'days.csv        하루 기록 (엑셀로 열기)',
      'days.json       하루 기록 + 길(구글 인코딩 폴리라인, 조각은 띄어쓰기로 구분)',
      'tracks.gpx      다닌 길 전체 + 추억 위치 (지도 프로그램으로 열기)',
      'memories.csv    추억 목록 (엑셀로 열기)',
      'memories.json   추억 전체 (사진 파일 이름 포함)',
      'photos/         추억 사진 (서버에 올라간 크기, 긴 변 1,600px)',
      'summary.json    달성률·동네·배지 등 앱이 계산한 요약',
      'plans.json      여행 계획 (있다면)',
      'extra_days.json 불러온 옛 기록 (있다면)', '',
    ].join('\r\n'));
    prog(8, '기록을 담는 중…');
    zip.file('days.csv', daysCsv());
    zip.file('days.json', JSON.stringify(C.days, null, 1));
    zip.file('memories.csv', memsCsv());
    zip.file('memories.json', JSON.stringify(C.mems.map(m => ({ ...m, date: new Date(m.ts).toISOString() })), null, 1));
    if (C.summary) zip.file('summary.json', JSON.stringify(C.summary, null, 1));
    if (C.extra.length) zip.file('extra_days.json', JSON.stringify(C.extra, null, 1));
    if (!C.DEMO) { const { data } = await C.sb.from('plans').select('*'); if (data?.length) zip.file('plans.json', JSON.stringify(data, null, 1)); }
    prog(15, '길을 GPX로 바꾸는 중…'); await sleep(10);
    zip.file('tracks.gpx', gpx(() => true));
    if ($('bkPhotos').checked && !C.DEMO) {
      const names = [...new Set(C.mems.flatMap(m => (m.photos || []).map(p => p.replace(/^v:/, ''))))];
      let done = 0, fail = 0;
      const q = [...names];
      const worker = async () => {
        while (q.length) {
          const n = q.shift();
          try {
            const { data, error } = await C.sb.storage.from('photos').download(`${C.uid}/${n}`);
            if (error) throw error;
            zip.file('photos/' + n, data);
          } catch (e) { fail++; }
          done++;
          prog(15 + done / names.length * 65, `사진 받는 중… ${done} / ${names.length}${fail ? ` (실패 ${fail})` : ''}`);
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }
    prog(82, 'zip 파일로 묶는 중…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } }, (m) => prog(82 + m.percent * 0.17, `zip 파일로 묶는 중… ${Math.round(m.percent)}%`));
    download(`mapory-backup-${stamp}.zip`, blob);
    prog(100, `백업 파일을 내려받았어요 (${(blob.size / 1048576).toFixed(1)} MB). 외장 하드나 클라우드에 한 부 더 보관해 두면 든든해요.`);
  } catch (e) {
    $('bkMsg').textContent = '백업하지 못했어요: ' + (e.message || e);
  } finally { btn.disabled = false; setTimeout(() => $('bkProg').classList.add('hidden'), 2000); }
}


// ───────── 앱 보관함 (영스토어) ─────────
function appsHtml() {
  return `<div class="scroll" style="max-width:820px">
    <h2 style="margin:0 0 4px">🛍️ 앱 보관함</h2>
    <p class="muted" style="margin:0 0 16px">개발자 권영진이 만든 앱을 받는 곳이에요. 초대받은 계정만 볼 수 있어요.</p>
    <div class="card" id="appsGuide" style="margin-bottom:14px">
      <b>처음 설치하는 법</b>
      <ol style="margin:8px 0 0;padding-left:20px;line-height:1.8">
        <li>휴대폰에서 이 페이지를 열고 <b>영스토어</b>의 <b>받기</b>를 눌러 설치해요. (출처를 알 수 없는 앱 설치를 허용해 주세요)</li>
        <li>영스토어를 열고 같은 계정으로 로그인해요.</li>
        <li>그다음부터는 영스토어에서 다른 앱을 받고, 새 버전이 나오면 알림이 와요.</li>
      </ol>
    </div>
    <div id="appsList" style="display:grid;gap:12px"></div>
  </div>`;
}
async function renderApps() {
  const box = $('appsList'); if (!box) return;
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const size = (b) => b >= 1e6 ? (b / 1e6).toFixed(1) + 'MB' : Math.round(b / 1e3) + 'KB';
  let list;
  if (C.DEMO) list = [
    { pkg: 'app.mystore', name: '영스토어', emoji: '🛍️', color: '#7FB6F2', description: '권영진이 만든 앱을 찾고 받고 최신으로 유지하는 앱스토어', version_name: '1.0', size_bytes: 9.8e6, updated_at: new Date().toISOString(), notes: '' },
    { pkg: 'app.mapory', name: 'Mapory', emoji: '🗺️', color: '#F5B041', description: '다녀간 만큼 안개가 걷히는 지도 일기장', version_name: '0.39', size_bytes: 31.2e6, updated_at: new Date().toISOString(), notes: 'GPS 끊긴 구간은 잇지 않음' },
  ];
  else {
    box.innerHTML = '<p class="muted">불러오는 중…</p>';
    const { data, error } = await C.sb.from('app_catalog').select('*').eq('hidden', false).order('sort').order('name');
    if (error) { box.innerHTML = `<div class="card"><b>아직 준비가 안 됐어요.</b><p class="muted" style="margin:6px 0 0">서버에 앱 목록 표가 없어요. Supabase SQL Editor에서 upgrade-6.sql을 실행해 주세요.<br>(${esc(error.message)})</p></div>`; return; }
    list = data || [];
  }
  if (!list.length) { box.innerHTML = '<div class="card"><p class="muted" style="margin:0">아직 올라온 앱이 없어요. GitHub에 SUPABASE_SERVICE_KEY 비밀 값을 넣으면 다음 빌드부터 여기에 올라와요.</p></div>'; return; }
  box.innerHTML = list.map((a) => `<div class="card" style="flex-direction:row;gap:14px;align-items:center">
      <div style="width:56px;height:56px;border-radius:14px;display:grid;place-items:center;font-size:30px;flex:none;background:${esc(a.color)}33">${esc(a.emoji)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:17px">${esc(a.name)} <span class="muted" style="font-weight:400;font-size:13px">${esc(a.version_name)} · ${size(a.size_bytes || 0)}</span></div>
        <div class="muted" style="font-size:13px">${esc(a.description)}</div>
        ${a.notes ? `<div style="font-size:12px;margin-top:4px">바뀐 점: ${esc(a.notes)}</div>` : ''}
        <div class="muted" style="font-size:11px;margin-top:2px">${new Date(a.updated_at).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })} 올림</div>
      </div>
      <button class="btn primary" data-apk="${esc(a.apk_path || '')}" data-name="${esc(a.pkg)}.apk">받기</button>
    </div>`).join('');
  box.querySelectorAll('button[data-apk]').forEach((b) => b.onclick = async () => {
    if (C.DEMO) return alertDlg('체험 모드에서는 받을 수 없어요.');
    b.disabled = true; b.textContent = '준비 중…';
    const { data, error } = await C.sb.storage.from('apps').createSignedUrl(b.dataset.apk, 600, { download: b.dataset.name });
    b.disabled = false; b.textContent = '받기';
    if (error) return alertDlg('파일을 받지 못했어요: ' + error.message);
    location.href = data.signedUrl;
  });
}
