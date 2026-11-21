// Mapory 홈페이지 — 헬스체크: 폰 걸음 + 갤럭시 워치(수면·심장·몸·운동)
let C;
const $ = (id) => document.getElementById(id);
const UI = { tab: 'sum' };
const TABS = [['sum', '🩺 오늘의 컨디션'], ['steps', '👣 걸음'], ['sleep', '😴 수면'], ['heart', '❤️ 심장'], ['body', '⚖️ 몸'], ['ex', '🏋️ 운동']];
const ST = { deep: ['깊은 잠', '#3B5BDB'], light: ['얕은 잠', '#7FB6F2'], rem: ['렘수면', '#B583F2'], awake: ['깸', '#F5B041'], sleep: ['잠', '#7FB6F2'] };

export function setup(ctx) {
  C = ctx;
  injectStyle();
  C.TOOLS.days = { show };
}

// ───────── 자료 꺼내기 ─────────
let H = new Map();
function load() { H = new Map(C.health.map(r => [r.day, r.data || {}])); }
const today = () => C.dayOf(Date.now());
const lastN = (n) => { const out = []; for (let k = n - 1; k >= 0; k--) { const d = C.addDays(today(), -k); out.push([d, H.get(d)]); } return out; };
const series = (n, f) => lastN(n).map(([d, o]) => [d, o ? f(o) : null]).map(([d, v]) => [d, v == null || Number.isNaN(v) ? null : v]);
const latest = (f) => { const ds = [...H.keys()].sort().reverse(); for (const d of ds) { const v = f(H.get(d)); if (v != null) return [d, v]; } return [null, null]; };
const avgOf = (arr) => { const v = arr.map(x => x[1]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const hm = (min) => { if (min == null) return '-'; const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`; };
const clock = (ms) => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const short = (d) => d ? `${+d.slice(5, 7)}.${+d.slice(8)}` : '';
const nf = (v, k = 0) => v == null ? '-' : v.toLocaleString('ko-KR', { maximumFractionDigits: k, minimumFractionDigits: k });

// ───────── 그림 도구 ─────────
/** 꺾은선 (빈 날은 끊김). pts: [[day, value]] */
function line(pts, { h = 150, color = 'var(--amber)', unit = '', dec = 0, band = null, fill = true } = {}) {
  const W = 600, vals = pts.map(p => p[1]).filter(v => v != null);
  if (!vals.length) return `<div class="hEmpty" style="height:${h}px">아직 기록이 없어요</div>`;
  let lo = Math.min(...vals), hi = Math.max(...vals); if (band) { lo = Math.min(lo, band[0]); hi = Math.max(hi, band[1]); }
  const pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad;
  const x = (i) => (i / Math.max(1, pts.length - 1)) * (W - 8) + 4, y = (v) => h - 18 - (v - lo) / (hi - lo) * (h - 30);
  let d = '', area = '', pen = false, first = null, lastX = 0;
  // 측정하지 않은 날은 건너뛰고 앞뒤 측정값을 이어 그림
  pts.forEach(([, v], i) => { if (v == null) return; d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; if (first == null) first = x(i); lastX = x(i); pen = true; });
  if (fill && first != null) area = `<path d="${d} L${lastX} ${h - 18} L${first} ${h - 18} Z" fill="${color}" opacity=".12"/>`;
  const dots = pts.map(([day, v], i) => v == null ? '' : `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="9" fill="transparent" data-tip="${C.fmtDayLabel(day)}<br><b>${nf(v, dec)}${unit}</b>"/><circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.2" fill="${color}" pointer-events="none"/>`).join('');
  const bandR = band ? `<rect x="0" y="${y(band[1])}" width="${W}" height="${Math.max(0, y(band[0]) - y(band[1]))}" fill="#4CB66B" opacity=".08"/>` : '';
  return `<svg viewBox="0 0 ${W} ${h}" class="hLine" preserveAspectRatio="none" style="height:${h}px">${bandR}
    <text x="4" y="12" class="ax">${nf(hi - pad, dec)}${unit}</text><text x="4" y="${h - 22}" class="ax">${nf(lo + pad, dec)}${unit}</text>
    ${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/>${dots}
    <text x="4" y="${h - 3}" class="ax">${short(pts[0][0])}</text><text x="${W - 4}" y="${h - 3}" class="ax" text-anchor="end">${short(pts[pts.length - 1][0])}</text></svg>`;
}
/** 쌓은 막대. rows: [[day, {key: value}]] */
function stack(rows, keys, { h = 170, max = null, goal = null, unit = '' } = {}) {
  const tot = rows.map(([, o]) => o ? keys.reduce((a, [k]) => a + (o[k] || 0), 0) : 0);
  const mx = max || Math.max(1, ...tot, goal || 0) * 1.08;
  const bars = rows.map(([d, o], i) => `<div class="sb" data-tip="${C.fmtDayLabel(d)}<br>${o ? keys.map(([k, n]) => `${n} ${o[k] ? fmtv(o[k], unit) : '-'}`).join('<br>') : '기록 없음'}">${o ? keys.map(([k, , col]) => `<i style="height:${((o[k] || 0) / mx * 100).toFixed(2)}%;background:${col}"></i>`).join('') : ''}</div>`).join('');
  return `<div class="sBars" style="height:${h}px">${goal ? `<div class="goalLine" style="bottom:${(goal / mx * 100).toFixed(1)}%"><span>${fmtv(goal, unit)}</span></div>` : ''}${bars}</div>
    <div class="row muted" style="font-size:11px"><span>${short(rows[0][0])}</span><span>${short(rows[rows.length - 1][0])}</span></div>`;
}
const fmtv = (v, unit) => unit === 'min' ? hm(v) : nf(v) + unit;
function legend(keys) { return `<span class="legend">${keys.map(([, n, c]) => `<i style="background:${c}"></i>${n}`).join(' ')}</span>`; }
function tile(label, value, sub = '', col = '') { return `<div class="tile"><span>${label}</span><b ${col ? `style="color:${col}"` : ''}>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`; }

// ───────── 판정 (참고용) ─────────
const rhrNote = (v) => v == null ? '' : v < 60 ? '낮은 편 (운동하는 몸)' : v <= 80 ? '보통 범위' : '높은 편';
const spo2Note = (v) => v == null ? '' : v >= 95 ? '정상 범위' : v >= 90 ? '조금 낮음' : '낮음 · 확인 필요';
function bpNote(s, d) {
  if (s == null) return ['', ''];
  if (s >= 140 || d >= 90) return ['고혈압 범위', '#E5533D'];
  if (s >= 130 || d >= 80) return ['주의 (고혈압 전단계)', '#F59E0B'];
  if (s >= 120) return ['약간 높음', '#F5B041'];
  return ['정상', '#4CB66B'];
}
function sleepScore(s) {
  if (!s) return null;
  const dur = Math.min(1, s.asleep / 450), deep = Math.min(1, (s.deep || 0) / Math.max(1, s.asleep) / 0.18), rem = Math.min(1, (s.rem || 0) / Math.max(1, s.asleep) / 0.22), eff = s.inBed ? s.asleep / s.inBed : 0.9;
  return Math.round(45 * dur + 20 * deep + 20 * rem + 15 * Math.min(1, eff / 0.92));
}

// ───────── 화면 ─────────
function show() {
  load();
  const box = $('healthBox'); if (!box) return;
  box.classList.add('hWrap');
  box.innerHTML = `<div class="hHead"><h2>🩺 헬스체크</h2><span class="muted">폰 걸음 + 갤럭시 워치 (헬스 커넥트)</span></div>
    <div class="stTabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-t="${k}" aria-selected="${UI.tab === k}">${t}</button>`).join('')}</div>
    <div class="hBody" id="hBody"></div>`;
  box.querySelectorAll('.stTabs button').forEach(b => b.onclick = () => { UI.tab = b.dataset.t; box.querySelectorAll('.stTabs button').forEach(x => x.setAttribute('aria-selected', x === b)); paint(); });
  paint();
}
function paint() {
  const el = $('hBody');
  if (UI.tab === 'steps') { C.renderDays(el); return; }
  const noWatch = !C.hasHealth ? `<div class="note warn">워치 기록을 받으려면 Supabase에서 <b>upgrade-5.sql</b>을 한 번 실행하고, 폰 앱(빌드 32 이상) 설정 → 삼성 헬스 연동 → '권한 다시 설정'에서 모두 허용한 뒤 동기화해 주세요.</div>`
    : !H.size ? `<div class="note">아직 워치 기록이 올라오지 않았어요. 폰 앱 설정 → 삼성 헬스 연동 → '권한 다시 설정'에서 모두 허용하고 '지금 동기화'를 눌러 주세요.</div>` : '';
  el.innerHTML = noWatch + ({ sum: tabSum, sleep: tabSleep, heart: tabHeart, body: tabBody, ex: tabEx })[UI.tab]();
  el.querySelectorAll('[data-tip]').forEach(x => { x.onmousemove = (e) => C.showTip(e, x.dataset.tip); x.onmouseleave = C.hideTip; });
  el.querySelectorAll('[data-go]').forEach(x => x.onclick = () => $('healthBox').querySelector(`.stTabs button[data-t="${x.dataset.go}"]`).click());
}

function hypno(s, h = 120) {
  if (!s?.flow?.length) return `<div class="hEmpty" style="height:${h}px">단계 기록이 없어요</div>`;
  const tot = s.inBed || s.flow.reduce((a, f) => Math.max(a, f[0] + f[1]), 1);
  const lv = { awake: 0, rem: 1, light: 2, sleep: 2, deep: 3 };
  const blocks = s.flow.map(([o, m, st]) => `<i style="left:${(o / tot * 100).toFixed(2)}%;width:${Math.max(0.3, m / tot * 100).toFixed(2)}%;top:${lv[st] * 25}%;background:${ST[st][1]}" data-tip="${ST[st][0]} ${m}분<br>${clock(s.start + o * 60000)}~${clock(s.start + (o + m) * 60000)}"></i>`).join('');
  return `<div class="hyp" style="height:${h}px"><div class="hypL"><span>깸</span><span>렘</span><span>얕은</span><span>깊은</span></div><div class="hypB">${blocks}</div></div>
    <div class="row muted" style="font-size:11px;margin-left:44px"><span>${clock(s.start)} 잠듦</span><span>${clock(s.end)} 깸</span></div>`;
}

function tabSum() {
  const t = today(), y = C.addDays(t, -1);
  const day = C.days.find(d => d.day === t), steps = day?.steps || 0, goal = C.STEP_GOAL();
  const o = H.get(t) || {}, sl = o.sleep || H.get(y)?.sleep;
  const [, rhr] = latest(x => x.rhr), [, hrv] = latest(x => x.hrv), [, spo2] = latest(x => x.spo2?.avg), [wd, w] = latest(x => x.weight), [, fat] = latest(x => x.fat), [bpd, bp] = latest(x => x.bp);
  const rhr30 = avgOf(series(30, x => x.rhr)), sc = sleepScore(sl);
  const [bpn, bpc] = bpNote(bp?.sys, bp?.dia);
  const scoreCol = sc == null ? '' : sc >= 80 ? '#4CB66B' : sc >= 60 ? 'var(--amber)' : '#E5533D';
  const spark = (key, f, col, unit, dec = 0) => `<div class="spark" data-go="${key}">${line(series(30, f), { h: 54, color: col, unit, dec, fill: false })}</div>`;
  return `<div class="hGrid4">
    <div class="card clickable" data-go="steps"><span class="muted">👣 오늘 걸음</span><b class="hBig">${nf(steps)}<small>보</small></b>${C.bar(steps / goal, steps >= goal ? 'green' : '')}<span class="muted">목표 ${nf(goal)}보의 ${Math.round(steps / goal * 100)}%</span></div>
    <div class="card clickable" data-go="sleep"><span class="muted">😴 지난밤 잠</span><b class="hBig">${sl ? hm(sl.asleep) : '-'}</b><span class="muted">${sl ? `${clock(sl.start)} → ${clock(sl.end)} · 수면 점수 <b style="color:${scoreCol}">${sc}</b>` : '기록 없음'}</span></div>
    <div class="card clickable" data-go="heart"><span class="muted">❤️ 안정 시 심박</span><b class="hBig">${nf(rhr)}<small>bpm</small></b><span class="muted">${rhrNote(rhr)}${rhr30 ? ` · 30일 평균 ${nf(rhr30)}` : ''}</span></div>
    <div class="card clickable" data-go="body"><span class="muted">⚖️ 몸무게</span><b class="hBig">${nf(w, 1)}<small>kg</small></b><span class="muted">${fat != null ? `체지방 ${nf(fat, 1)}%` : ''}${wd ? ` · ${short(wd)} 측정` : ''}</span></div>
  </div>
  <div class="hGrid4">
    <div class="card"><span class="muted">🫁 혈중 산소 (최근)</span><b style="font-size:22px">${nf(spo2, 1)}%</b><span class="muted">${spo2Note(spo2)}</span></div>
    <div class="card"><span class="muted">📈 심박 변이도 HRV</span><b style="font-size:22px">${nf(hrv)} ms</b><span class="muted">높을수록 회복이 잘 된 상태</span></div>
    <div class="card"><span class="muted">🩸 혈압 (최근)</span><b style="font-size:22px">${bp ? `${bp.sys}/${bp.dia}` : '-'}</b><span class="muted" style="color:${bpc}">${bpn}${bpd ? ` · ${short(bpd)}` : ''}</span></div>
    <div class="card"><span class="muted">🔥 오늘 활동 칼로리</span><b style="font-size:22px">${nf(o.akcal)} kcal</b><span class="muted">${o.kcal ? `하루 총 ${nf(o.kcal)} kcal` : ''}${o.floors ? ` · ${nf(o.floors)}층 오름` : ''}</span></div>
  </div>
  <div class="hGrid3">
    <div class="card"><div class="row"><span class="muted">수면 시간 · 30일</span></div>${spark('sleep', x => x.sleep?.asleep / 60, '#7FB6F2', '시간', 1)}</div>
    <div class="card"><div class="row"><span class="muted">안정 시 심박 · 30일</span></div>${spark('heart', x => x.rhr, '#E5533D', 'bpm')}</div>
    <div class="card"><div class="row"><span class="muted">몸무게 · 30일</span></div>${spark('body', x => x.weight, 'var(--amber)', 'kg', 1)}</div>
  </div>
  <p class="muted" style="margin:0">숫자 옆의 판정은 일반적인 참고 기준이에요. 몸 상태가 걱정되면 의료진과 상의해 주세요.</p>`;
}

function tabSleep() {
  const days = lastN(30).map(([d, o]) => [d, o?.sleep || null]);
  const have = days.filter(x => x[1]);
  const [ld, last] = latest(x => x.sleep);
  const avg = (k) => have.length ? have.reduce((a, [, s]) => a + (s[k] || 0), 0) / have.length : null;
  const bedAvg = have.length ? have.reduce((a, [, s]) => { const d = new Date(s.start); let m = d.getHours() * 60 + d.getMinutes(); if (m < 720) m += 1440; return a + m; }, 0) / have.length : null;
  const wakeAvg = have.length ? have.reduce((a, [, s]) => { const d = new Date(s.end); return a + d.getHours() * 60 + d.getMinutes(); }, 0) / have.length : null;
  const mm = (m) => m == null ? '-' : `${Math.floor(m / 60) % 24}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  const bedSd = have.length > 2 ? Math.sqrt(have.reduce((a, [, s]) => { const d = new Date(s.start); let m = d.getHours() * 60 + d.getMinutes(); if (m < 720) m += 1440; return a + (m - bedAvg) ** 2; }, 0) / have.length) : null;
  const sc = sleepScore(last);
  const keys = [['deep', '깊은 잠', ST.deep[1]], ['light', '얕은 잠', ST.light[1]], ['rem', '렘수면', ST.rem[1]], ['awake', '깸', ST.awake[1]]];
  const pct = (k) => last ? Math.round((last[k] || 0) / Math.max(1, last.inBed) * 100) : 0;
  return `<div class="hGrid2">
    <div class="card"><div class="row"><h3>지난밤 ${ld ? `<span class="muted">${C.fmtDayLabel(ld)}</span>` : ''}</h3><b style="font-size:22px">${last ? hm(last.asleep) : '-'}</b></div>
      ${hypno(last)}
      <div class="stPills">${keys.map(([k, n, c]) => `<span><i style="background:${c}"></i>${n} ${last ? hm(last[k] || 0) : '-'} <small>${pct(k)}%</small></span>`).join('')}</div></div>
    <div class="card hNums">
      <div><span>수면 점수 (어림)</span><b style="color:${sc == null ? '' : sc >= 80 ? '#4CB66B' : sc >= 60 ? 'var(--amber)' : '#E5533D'}">${sc ?? '-'}</b><small>시간·깊은 잠·렘·효율로 계산</small></div>
      <div><span>30일 평균 수면</span><b>${hm(avg('asleep'))}</b><small>권장 7~9시간</small></div>
      <div><span>평균 잠드는 시각</span><b>${mm(bedAvg)}</b><small>${bedSd != null ? `들쭉날쭉 ±${Math.round(bedSd)}분` : ''}</small></div>
      <div><span>평균 깨는 시각</span><b>${mm(wakeAvg)}</b></div>
      <div><span>평균 깊은 잠</span><b>${hm(avg('deep'))}</b></div>
      <div><span>평균 렘수면</span><b>${hm(avg('rem'))}</b></div>
    </div>
  </div>
  <div class="card"><div class="row"><h3>최근 30일 수면</h3>${legend(keys)}</div>${stack(days, keys, { h: 190, goal: 420, unit: 'min' })}</div>`;
}

function tabHeart() {
  const [td, o] = latest(x => x.hrH ? x : null);
  const hrH = o?.hrH || [];
  const W = 600, h = 170, vals = hrH.filter(v => v != null);
  let hourChart = '<div class="hEmpty" style="height:170px">아직 기록이 없어요</div>';
  if (vals.length) {
    const lo = Math.min(...vals) - 5, hi = Math.max(...vals) + 5, bw = W / 24;
    hourChart = `<svg viewBox="0 0 ${W} ${h}" class="hLine" preserveAspectRatio="none" style="height:${h}px">${hrH.map((v, i) => v == null ? '' : `<rect x="${(i * bw + 3).toFixed(1)}" y="${(h - 18 - (v - lo) / (hi - lo) * (h - 30)).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${((v - lo) / (hi - lo) * (h - 30)).toFixed(1)}" rx="3" fill="${v > 100 ? '#E5533D' : '#F28B82'}" data-tip="${i}시~${i + 1}시<br><b>평균 ${v} bpm</b>"/>`).join('')}
      ${[0, 6, 12, 18].map(i => `<text x="${i * bw + 4}" y="${h - 3}" class="ax">${i}시</text>`).join('')}</svg>`;
  }
  const r90 = series(90, x => x.rhr), hrv90 = series(90, x => x.hrv), sp30 = series(30, x => x.spo2?.avg), spMin = series(30, x => x.spo2?.min), resp = series(30, x => x.resp);
  return `<div class="hGrid2">
    <div class="card"><div class="row"><h3>시간대별 심박 <span class="muted">${td ? C.fmtDayLabel(td) : ''}</span></h3><span class="muted">${o?.hr ? `평균 ${o.hr.avg} · 최저 ${o.hr.min} · 최고 ${o.hr.max} bpm` : ''}</span></div>${hourChart}</div>
    <div class="card"><div class="row"><h3>안정 시 심박 · 90일</h3><span class="muted">${rhrNote(avgOf(r90.slice(-7)))}</span></div>${line(r90, { h: 170, color: '#E5533D', unit: 'bpm', band: [50, 80] })}</div>
  </div>
  <div class="hGrid3">
    <div class="card"><div class="row"><h3>심박 변이도 HRV · 90일</h3></div>${line(hrv90, { h: 130, color: '#B583F2', unit: 'ms' })}<span class="muted">높을수록 몸이 잘 회복된 날이에요. 내 평소 값과 비교해서 보세요.</span></div>
    <div class="card"><div class="row"><h3>혈중 산소 · 30일</h3></div>${line(sp30, { h: 130, color: '#7FB6F2', unit: '%', dec: 1, band: [95, 100] })}<span class="muted">밤 최저 평균 ${nf(avgOf(spMin), 0)}% · ${spo2Note(avgOf(sp30))}</span></div>
    <div class="card"><div class="row"><h3>잘 때 호흡수 · 30일</h3></div>${line(resp, { h: 130, color: '#4CB66B', unit: '회', dec: 1, band: [12, 20] })}<span class="muted">분당 호흡 횟수 · 보통 12~20회</span></div>
  </div>`;
}

function tabBody() {
  const days = [...H.keys()].sort(); const span = Math.min(365, days.length ? Math.round((Date.now() - new Date(days[0] + 'T00:00:00').getTime()) / 864e5) + 1 : 90);
  const wS = series(span, x => x.weight), fS = series(span, x => x.fat);
  const [, w] = latest(x => x.weight), [, fat] = latest(x => x.fat), [, bmr] = latest(x => x.bmr), [, lean] = latest(x => x.lean), [, water] = latest(x => x.water), [, ht] = latest(x => x.height);
  const bmi = w && ht ? w / ((ht / 100) ** 2) : null;
  const bmiN = bmi == null ? '' : bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '비만 전단계' : '비만';
  const w30 = wS.slice(-30).filter(x => x[1] != null), dw = w30.length > 1 ? w30[w30.length - 1][1] - w30[0][1] : null;
  const bps = [...H.entries()].filter(([, o]) => o.bp).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  const bpRows = bps.slice(-8).reverse().map(([d, o]) => { const [n, c] = bpNote(o.bp.sys, o.bp.dia); return `<div class="row" style="font-size:13px"><span>${C.fmtDayLabel(d)}</span><span><b>${o.bp.sys}/${o.bp.dia}</b> <span style="color:${c}">${n}</span></span></div>`; }).join('');
  return `<div class="tiles" style="grid-template-columns:repeat(6,1fr)">
    ${tile('몸무게', w != null ? nf(w, 1) + ' kg' : '-', dw != null ? `30일 ${dw >= 0 ? '+' : ''}${nf(dw, 1)} kg` : '', 'var(--amber)')}
    ${tile('체지방률', fat != null ? nf(fat, 1) + '%' : '-')}
    ${tile('골격근·제지방', lean != null ? nf(lean, 1) + ' kg' : '-')}
    ${tile('체수분', water != null ? nf(water, 1) + ' kg' : '-')}
    ${tile('기초대사량', bmr != null ? nf(bmr) + ' kcal' : '-')}
    ${tile('BMI', bmi ? nf(bmi, 1) : '-', bmi ? bmiN + (ht ? ` · 키 ${nf(ht)}cm` : '') : '키 기록이 있으면 계산돼요')}
  </div>
  <div class="hGrid2">
    <div class="card"><div class="row"><h3>몸무게</h3><span class="muted">${span}일</span></div>${line(wS, { h: 190, color: 'var(--amber)', unit: 'kg', dec: 1 })}</div>
    <div class="card"><div class="row"><h3>체지방률</h3><span class="muted">${span}일</span></div>${line(fS, { h: 190, color: '#B583F2', unit: '%', dec: 1 })}</div>
  </div>
  <div class="hGrid2">
    <div class="card"><div class="row"><h3>혈압</h3><span class="muted">최근 ${bps.length}번</span></div>
      ${bps.length ? line(bps.map(([d, o]) => [d, o.bp.sys]), { h: 110, color: '#E5533D', unit: '', fill: false }) : '<div class="hEmpty" style="height:110px">혈압 기록이 없어요 (워치 혈압 측정은 처음에 커프로 보정이 필요해요)</div>'}</div>
    <div class="card" style="gap:6px"><h3>최근 측정</h3>${bpRows || '<span class="muted">아직 없어요</span>'}</div>
  </div>`;
}

function tabEx() {
  const rows = lastN(30).map(([d, o]) => [d, o ? { akcal: o.akcal || 0, floors: o.floors || 0 } : null]);
  const all = [...H.entries()].flatMap(([d, o]) => (o.ex || []).map(e => ({ ...e, day: d }))).sort((a, b) => b.start - a.start);
  const in30 = all.filter(e => e.day >= C.addDays(today(), -29));
  const byType = new Map(); for (const e of in30) { const v = byType.get(e.t) || { n: 0, min: 0 }; v.n++; v.min += e.min; byType.set(e.t, v); }
  const types = [...byType.entries()].sort((a, b) => b[1].min - a[1].min), tmax = Math.max(1, ...types.map(t => t[1].min));
  const [, vo2] = latest(x => x.vo2), vo2S = series(180, x => x.vo2);
  const akAvg = avgOf(rows.map(([d, o]) => [d, o?.akcal || null])), floors30 = rows.reduce((a, [, o]) => a + (o?.floors || 0), 0);
  const minutes30 = in30.reduce((a, e) => a + e.min, 0);
  return `<div class="tiles" style="grid-template-columns:repeat(5,1fr)">
    ${tile('30일 운동', `${in30.length}번`, `모두 ${hm(minutes30)}`, 'var(--amber)')}
    ${tile('주당 운동 시간', hm(minutes30 / 30 * 7), '권장 150분 이상')}
    ${tile('하루 활동 칼로리', akAvg ? nf(akAvg) + ' kcal' : '-', '30일 평균')}
    ${tile('30일 오른 층', nf(floors30) + '층', `에펠탑 ${nf(floors30 * 3 / 330, 1)}번`)}
    ${tile('최대산소섭취량', vo2 != null ? nf(vo2, 1) : '-', 'VO2max · 심폐 체력')}
  </div>
  <div class="hGrid2">
    <div class="card"><div class="row"><h3>활동 칼로리 · 30일</h3>${legend([[0, '활동 칼로리', '#F28B82']])}</div>${stack(rows, [['akcal', '활동 칼로리', '#F28B82']], { h: 170, unit: ' kcal' })}</div>
    <div class="card"><h3>운동 종류 · 30일</h3>${types.length ? types.map(([t, v]) => `<div class="row" style="font-size:13px"><span style="width:80px">${t}</span><div class="bar" style="flex:1;margin:0 10px;align-self:center"><i style="width:${(v.min / tmax * 100).toFixed(1)}%"></i></div><span class="v">${v.n}번 · ${hm(v.min)}</span></div>`).join('') : '<span class="muted">최근 30일 운동 기록이 없어요</span>'}
      ${vo2S.some(x => x[1] != null) ? `<span class="muted" style="margin-top:8px">최대산소섭취량 · 180일</span>${line(vo2S, { h: 80, color: '#4CB66B', dec: 1, fill: false })}` : ''}</div>
  </div>
  <div class="card"><h3>최근 운동</h3><div class="exList">${all.slice(0, 12).map(e => `<div><b>${e.t}</b><span>${C.fmtDayLabel(e.day)} ${clock(e.start)} · ${hm(e.min)}</span></div>`).join('') || '<span class="muted">아직 없어요</span>'}</div></div>`;
}

function injectStyle() {
  const st = document.createElement('style');
  st.textContent = `
  #page-days .scroll.hWrap { height: 100%; display: flex; flex-direction: column; gap: 0; box-sizing: border-box; padding-bottom: 20px; }
  .hWrap .hHead h2 { margin: 0 0 12px; }
  .hBody { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 14px; }
  .hGrid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .hGrid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .hGrid2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; }
  .hBig { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .hBig small { font-size: 14px; color: var(--sub); margin-left: 4px; font-weight: 500; }
  .hLine { width: 100%; display: block; overflow: visible; }
  .hLine .ax { font-size: 10px; fill: var(--sub); }
  .hEmpty { display: grid; place-items: center; color: var(--sub); font-size: 13px; background: var(--field); border-radius: 12px; }
  .spark { cursor: pointer; }
  .sBars { position: relative; display: flex; align-items: flex-end; gap: 3px; }
  .sb { flex: 1; height: 100%; display: flex; flex-direction: column-reverse; }
  .sb i { display: block; width: 100%; }
  .sb i:last-child { border-radius: 3px 3px 0 0; }
  .hyp { display: flex; gap: 8px; }
  .hypL { width: 36px; display: grid; grid-template-rows: repeat(4, 1fr); font-size: 10px; color: var(--sub); align-items: center; }
  .hypB { position: relative; flex: 1; background: var(--field); border-radius: 8px; overflow: hidden; }
  .hypB i { position: absolute; height: 25%; border-radius: 2px; }
  .stPills { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; }
  .stPills i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; }
  .stPills small { color: var(--sub); }
  .exList { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
  .exList div { background: var(--field); border-radius: 10px; padding: 8px 12px; display: flex; flex-direction: column; }
  .exList b { font-size: 14px; } .exList span { font-size: 12px; color: var(--sub); }
  @media (max-width: 1100px) { .hGrid4, .hGrid3, .hGrid2 { grid-template-columns: 1fr 1fr; } }
  `;
  document.head.appendChild(st);
}
