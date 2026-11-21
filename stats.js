// Mapory 홈페이지 — 모든 기록(앱 GPS · 구글 타임라인 · 사진 위치 · 추억)을 합친 통계와 배지
// 나라·시도·시군구 경계는 앱과 같은 자료(data/regions.bin, data/towns.bin)를 씁니다.

let C;
const $ = (id) => document.getElementById(id);
let R = null, T = null, CONT = null;     // 경계 자료, 나라→대륙
let cache = null;                        // { sig, res }
let plansDone = null;

export function setup(ctx) {
  C = ctx;
  injectStyle();
  C.TOOLS.stats = { show };
}

// ───────── 경계 자료 읽기 (앱의 RegionSet과 같은 형식) ─────────
async function loadSet(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf), td = new TextDecoder();
  let o = 0;
  const i32 = () => { const v = dv.getInt32(o); o += 4; return v; };
  const f32 = () => { const v = dv.getFloat32(o); o += 4; return v; };
  const utf = () => { const n = dv.getUint16(o); o += 2; const s = td.decode(new Uint8Array(buf, o, n)); o += n; return s; };
  if (i32() !== 0x4D415031) throw new Error('경계 자료 형식이 달라요');
  const nc = i32(), countries = Array.from({ length: nc }, utf);
  const n = i32();
  const S = { countries, n, rc: new Int32Array(n), name: new Array(n), area: new Float32Array(n), a: new Float32Array(n), b: new Float32Array(n), c: new Float32Array(n), e: new Float32Array(n), rings: new Array(n), last: -1 };
  for (let i = 0; i < n; i++) {
    S.rc[i] = i32(); S.name[i] = utf(); S.area[i] = f32();
    S.a[i] = f32(); S.b[i] = f32(); S.c[i] = f32(); S.e[i] = f32();
    const k = i32(), rs = [];
    for (let j = 0; j < k; j++) { const np = i32(), r = new Float32Array(np * 2); for (let q = 0; q < np * 2; q++) r[q] = f32(); rs.push(r); }
    S.rings[i] = rs;
  }
  return S;
}
function inside(S, i, lat, lon) {
  if (lat < S.a[i] || lat > S.b[i] || lon < S.c[i] || lon > S.e[i]) return false;
  let odd = false;
  for (const r of S.rings[i]) {
    const m = r.length / 2;
    for (let k = 0, j = m - 1; k < m; j = k++) {
      const xk = r[k * 2], yk = r[k * 2 + 1], xj = r[j * 2], yj = r[j * 2 + 1];
      if ((yk > lat) !== (yj > lat) && lon < (xj - xk) * (lat - yk) / (yj - yk) + xk) odd = !odd;
    }
  }
  return odd;
}
function find(S, lat, lon) {
  const l = S.last;
  if (l >= 0 && inside(S, l, lat, lon)) return l;
  for (let i = 0; i < S.n; i++) if (i !== l && inside(S, i, lat, lon)) { S.last = i; return i; }
  // 경계를 단순하게 만들며 생긴 틈: 바로 앞 지역 근처면 그 지역으로
  if (l >= 0 && lat > S.a[l] - 0.01 && lat < S.b[l] + 0.01 && lon > S.c[l] - 0.01 && lon < S.e[l] + 0.01) return l;
  return -1;
}

// ───────── 모든 기록을 모아 계산 ─────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function signature() {
  const s = C.segs;
  return `${s.length}|${s[0]?.day}|${s[s.length - 1]?.day}|${C.mems.length}|${C.extra.length}|${C.days.length}`;
}
async function compute(progress) {
  if (!R) {
    progress('나라·지역 경계 자료를 받는 중… (처음 한 번, 약 5MB)');
    [R, T, CONT] = await Promise.all([loadSet('data/regions.bin'), loadSet('data/towns.bin'), fetch('data/continents.json').then(r => r.json())]);
  }
  // 1) 약 500m 칸으로 다녀간 곳 모으기 (같은 칸은 한 번만 경계 검사)
  const cells = new Map();
  const add = (lat, lon, day, src) => {
    const k = Math.round(lat * 200) + ':' + Math.round(lon * 200);
    let c = cells.get(k); if (!c) cells.set(k, c = { lat, lon, days: new Set(), src: new Set() });
    c.days.add(day); c.src.add(src);
  };
  for (const s of C.segs) {
    const step = s.ll.length > 400 ? 2 : 1;
    for (let k = 0; k < s.ll.length; k += step) add(s.ll[k][1], s.ll[k][0], s.day, s.src);
  }
  for (const m of C.mems) add(m.lat, m.lon, C.dayOf(m.ts), 'mem');
  // 2) 칸마다 나라·지역·시군구 찾기
  const KR = R.countries.indexOf('대한민국');
  const res = {
    countries: new Map(), regions: new Map(), towns: new Map(), conts: new Map(),
    dayCountries: new Map(), dayTowns: new Map(),
    ext: { maxLat: -90, minLat: 90, east: false, west: false, maxLon: -180, minLon: 180 },
  };
  const bump = (map, key, c, extra) => {
    let v = map.get(key); if (!v) map.set(key, v = { days: new Set(), first: '9999', src: new Set(), ...extra });
    for (const d of c.days) { v.days.add(d); if (d < v.first) v.first = d; }
    for (const s of c.src) v.src.add(s);
    return v;
  };
  let n = 0; const total = cells.size;
  for (const c of cells.values()) {
    if (++n % 400 === 0) { progress(`다녀간 곳을 나라·지역에 맞춰 보는 중… ${Math.round(n / total * 100)}%`); await sleep(0); }
    const x = res.ext;
    if (c.lat > x.maxLat) x.maxLat = c.lat; if (c.lat < x.minLat) x.minLat = c.lat;
    if (c.lon > x.maxLon) x.maxLon = c.lon; if (c.lon < x.minLon) x.minLon = c.lon;
    if (c.lon >= 0) x.east = true; else x.west = true;
    const r = find(R, c.lat, c.lon);
    if (r < 0) continue;
    const cname = R.countries[R.rc[r]];
    bump(res.countries, cname, c, { cont: CONT[cname] || '' });
    bump(res.regions, r, c);
    if (CONT[cname]) bump(res.conts, CONT[cname], c);
    for (const d of c.days) { let s = res.dayCountries.get(d); if (!s) res.dayCountries.set(d, s = new Set()); s.add(cname); }
    if (R.rc[r] === KR) {
      const t = find(T, c.lat, c.lon);
      if (t >= 0) {
        bump(res.towns, t, c);
        for (const d of c.days) { let s = res.dayTowns.get(d); if (!s) res.dayTowns.set(d, s = new Set()); s.add(t); }
      }
    }
  }
  return res;
}

// ───────── 숫자 모으기 (배지·통계용) ─────────
function numbers(G) {
  const appDays = new Map(C.days.map(d => [d.day, d]));
  let walk = 0, car = 0, plane = 0, steps = 0, maxDay = 0, maxWalk = 0, maxSteps = 0, steps10k = 0;
  const allDays = new Set(), srcDays = { app: new Set(), google: new Set(), photo: new Set(), mem: new Set() };
  const dayDist = new Map();
  for (const d of C.days) {
    walk += d.dist_walk; car += d.dist_car; plane += d.dist_plane; steps += d.steps || 0;
    const t = C.total(d); dayDist.set(d.day, t);
    maxDay = Math.max(maxDay, t); maxWalk = Math.max(maxWalk, d.dist_walk); maxSteps = Math.max(maxSteps, d.steps || 0);
    if ((d.steps || 0) >= 10000) steps10k++;
    if (d.track) { allDays.add(d.day); srcDays.app.add(d.day); }
  }
  for (const e of C.extra) {
    allDays.add(e.day);
    if (e.source === 'google') {
      srcDays.google.add(e.day);
      if (!appDays.has(e.day)) { walk += e.dist_walk; car += e.dist_car; plane += e.dist_plane; const t = C.total(e); dayDist.set(e.day, t); maxDay = Math.max(maxDay, t); maxWalk = Math.max(maxWalk, e.dist_walk); }
    } else srcDays.photo.add(e.day);
  }
  for (const m of C.mems) { const d = C.dayOf(m.ts); allDays.add(d); srcDays.mem.add(d); }
  const sorted = [...allDays].sort();
  // 가장 길게 이어서 기록한 날
  let streak = 0, run = 0, prev = null;
  for (const d of sorted) { run = prev && C.addDays(prev, 1) === d ? run + 1 : 1; streak = Math.max(streak, run); prev = d; }
  const first = sorted[0] || C.dayOf(Date.now());
  const yearsSince = (Date.now() - new Date(first + 'T00:00:00').getTime()) / (365.25 * 864e5);
  // 해마다: 12달·4계절 모두 기록한 해가 있는지
  const byYear = new Map();
  for (const d of sorted) { const y = d.slice(0, 4); let s = byYear.get(y); if (!s) byYear.set(y, s = new Set()); s.add(+d.slice(5, 7)); }
  let fullYear = 0, fourSeasons = 0;
  for (const ms of byYear.values()) {
    fullYear = Math.max(fullYear, ms.size);
    const se = new Set([...ms].map(m => m === 12 || m <= 2 ? 0 : m <= 5 ? 1 : m <= 8 ? 2 : 3));
    fourSeasons = Math.max(fourSeasons, se.size);
  }
  // 시각을 아는 기록에서 새벽·이른 아침
  let dawn = 0, early = 0, late = 0;
  for (const s of C.segs) if (s.t) for (let k = 0; k < s.t.length; k += 5) {
    const h = new Date(s.t[k]).getHours();
    if (h < 4) dawn++; else if (h < 6) early++; else if (h >= 23) late++;
  }
  // 추억
  const mPhotos = C.mems.filter(m => (m.photos || []).length).length;
  const icons = new Set(C.mems.map(m => m.icon).filter(Boolean)).size;
  // 지역들
  const KR = R.countries.indexOf('대한민국');
  const krRegions = [...G.regions.keys()].filter(r => R.rc[r] === KR).length;
  const worldRegions = [...G.regions.keys()].filter(r => R.rc[r] !== KR).length;
  const townsBySido = new Map();
  for (const t of G.towns.keys()) { const s = T.countries[T.rc[t]]; townsBySido.set(s, (townsBySido.get(s) || 0) + 1); }
  const sidoTotal = new Map(); for (let i = 0; i < T.n; i++) { const s = T.countries[T.rc[i]]; sidoTotal.set(s, (sidoTotal.get(s) || 0) + 1); }
  const metro = ['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시'];
  const townNames = new Set([...G.towns.keys()].map(t => T.name[t]));
  const memCountries = new Set(C.mems.map(m => { const r = find(R, m.lat, m.lon); return r >= 0 ? R.rc[r] : -1; }).filter(x => x >= 0)).size;
  const x = G.ext;
  return {
    walk, car, plane, tot: walk + car + plane, steps, maxDay, maxWalk, maxSteps, steps10k,
    days: allDays.size, srcDays, streak, first, yearsSince, years: byYear.size, fullYear, fourSeasons,
    dawn, early, late, mems: C.mems.length, mPhotos, icons, memCountries,
    countries: G.countries.size, conts: G.conts.size, krRegions, worldRegions, towns: G.towns.size,
    townsBySido, sidoTotal, metro, townNames,
    maxDayCountries: Math.max(0, ...[...G.dayCountries.values()].map(s => s.size)),
    maxDayTowns: Math.max(0, ...[...G.dayTowns.values()].map(s => s.size)),
    googleDays: srcDays.google.size, photoSpots: C.segs.filter(s => s.src === 'photo' || s.src === 'phone').length,
    maxLat: x.maxLat, minLat: x.minLat, hemis: x.east && x.west, lonSpan: x.maxLon - x.minLon,
    plansDone: plansDone ?? 0, dayDist,
  };
}

// ───────── 배지 목록 (섹션별) ─────────
const K = 1000;
function badgeSections(N) {
  const ladder = (vals, list) => list.map(([goal, e, t, d]) => ({ e, t, d, v: vals, goal }));
  const all = (n, name) => N.townsBySido.get(name) >= (N.sidoTotal.get(name) || 99) ? 1 : 0;
  return [
    { title: '🚶 걷기', items: ladder(N.walk / K, [
      [5, '👟', '첫 산책', '걸어서 5km'], [10, '🚶', '동네 한 바퀴', '걸어서 10km'], [42.195, '🏅', '마라톤 완주', '걸어서 42.195km'], [100, '🥾', '백 리 길', '걸어서 100km'],
      [250, '🗺️', '도보 여행자', '걸어서 250km'], [500, '🏔️', '국토 종단', '걸어서 500km (서울–부산 왕복쯤)'], [1000, '🌄', '천 리 길 두 번', '걸어서 1,000km'], [2000, '🧭', '순례자', '걸어서 2,000km'],
      [3000, '🐪', '실크로드 한 구간', '걸어서 3,000km'], [5000, '🌏', '대륙 횡단', '걸어서 5,000km'], [10000, '👑', '걷기의 신', '걸어서 10,000km']]) },
    { title: '🚗 움직인 거리', items: ladder(N.tot / K, [
      [100, '🚲', '첫 백 킬로', '모두 100km'], [500, '🚗', '주말 여행자', '모두 500km'], [1000, '🛣️', '천 킬로', '모두 1,000km'], [5000, '🚄', '대륙을 달리다', '모두 5,000km'],
      [10000, '🌐', '지구 1/4', '모두 10,000km'], [20000, '🌗', '지구 반 바퀴', '모두 20,000km'], [40075, '🌍', '지구 한 바퀴', '모두 40,075km'], [80150, '🌍', '지구 두 바퀴', '모두 80,150km'],
      [200000, '🛰️', '궤도 여행자', '모두 200,000km'], [384400, '🌕', '달까지', '모두 384,400km']]) },
    { title: '✈️ 하늘길', items: ladder(N.plane / K, [
      [300, '🛫', '첫 비행', '비행기로 300km'], [2000, '✈️', '국제선 탑승객', '비행기로 2,000km'], [10000, '🌤️', '구름 위 단골', '비행기로 10,000km'], [20000, '🧳', '마일리지 수집가', '비행기로 20,000km'],
      [40075, '🌎', '하늘로 지구 한 바퀴', '비행기로 40,075km'], [100000, '🛩️', '하늘의 주민', '비행기로 100,000km']]) },
    { title: '👣 걸음', items: [
      ...ladder(N.steps, [[100000, '👣', '십만 걸음', '누적 10만 보'], [500000, '🦶', '오십만 걸음', '누적 50만 보'], [1e6, '💯', '백만 걸음', '누적 100만 보'], [3e6, '🏃', '삼백만 걸음', '누적 300만 보'], [1e7, '🏆', '천만 걸음', '누적 1,000만 보'], [2e7, '🐘', '이천만 걸음', '누적 2,000만 보']]),
      ...ladder(N.steps10k, [[1, '🔟', '만보 첫날', '하루 1만 보 이상 1일'], [10, '📈', '만보 열흘', '하루 1만 보 이상 10일'], [50, '💪', '만보 습관', '하루 1만 보 이상 50일'], [100, '🔥', '만보 백일', '하루 1만 보 이상 100일'], [365, '🏵️', '만보 일 년', '하루 1만 보 이상 365일']]),
      ...ladder(N.maxSteps, [[20000, '⚡', '2만 보의 날', '하루 2만 보'], [30000, '🌪️', '3만 보의 날', '하루 3만 보'], [40000, '🦿', '4만 보의 날', '하루 4만 보']])] },
    { title: '📅 꾸준함', items: [
      ...ladder(N.days, [[1, '🌱', '첫 기록', '기록한 날 1일'], [7, '🌿', '일주일', '기록한 날 7일'], [30, '🍀', '한 달', '기록한 날 30일'], [100, '🌳', '백 일', '기록한 날 100일'], [200, '🌲', '이백 일', '기록한 날 200일'],
        [365, '🎄', '일 년치', '기록한 날 365일'], [500, '🏞️', '오백 일', '기록한 날 500일'], [1000, '🗻', '천 일', '기록한 날 1,000일'], [2000, '🏯', '이천 일', '기록한 날 2,000일'], [3650, '🏛️', '십 년치', '기록한 날 3,650일']]),
      ...ladder(N.streak, [[3, '🔗', '사흘 연속', '이어서 3일'], [7, '⛓️', '일주일 연속', '이어서 7일'], [14, '📿', '보름 연속', '이어서 14일'], [30, '🎗️', '한 달 연속', '이어서 30일'], [60, '🧶', '두 달 연속', '이어서 60일'], [100, '💎', '백 일 연속', '이어서 100일'], [200, '🪐', '이백 일 연속', '이어서 200일'], [365, '♾️', '일 년 연속', '이어서 365일']])] },
    { title: '🗓️ 세월', items: [
      ...ladder(N.yearsSince, [[1, '🎂', '1주년', '첫 기록부터 1년'], [2, '🎉', '2주년', '첫 기록부터 2년'], [3, '🎊', '3주년', '첫 기록부터 3년'], [5, '🏺', '5주년', '첫 기록부터 5년'], [10, '📜', '10주년', '첫 기록부터 10년'], [20, '🗿', '20주년', '첫 기록부터 20년']]),
      ...ladder(N.years, [[2, '📆', '두 해의 기록', '기록이 있는 해 2개'], [5, '📚', '다섯 해의 기록', '기록이 있는 해 5개'], [10, '🏛️', '열 해의 기록', '기록이 있는 해 10개']]),
      ...ladder(N.fourSeasons, [[4, '🍂', '사계절', '한 해에 봄·여름·가을·겨울 모두 기록']]),
      ...ladder(N.fullYear, [[12, '🗓️', '열두 달', '한 해에 열두 달 모두 기록']])] },
    { title: '🌍 나라와 대륙', items: [
      ...ladder(N.countries, [[2, '🛂', '첫 해외', '나라 2곳'], [3, '🧳', '세 나라', '나라 3곳'], [5, '🌐', '다섯 나라', '나라 5곳'], [7, '🗽', '일곱 나라', '나라 7곳'], [10, '🌏', '열 나라', '나라 10곳'],
        [15, '🗺️', '열다섯 나라', '나라 15곳'], [20, '🏳️', '스무 나라', '나라 20곳'], [30, '🌎', '서른 나라', '나라 30곳'], [50, '🌍', '쉰 나라', '나라 50곳'], [75, '🧭', '세계 여행자', '나라 75곳'], [100, '👑', '백 개국', '나라 100곳']]),
      ...ladder(N.conts, [[2, '🌉', '두 대륙', '대륙 2곳'], [3, '🗼', '세 대륙', '대륙 3곳'], [4, '🏛️', '네 대륙', '대륙 4곳'], [5, '🌋', '다섯 대륙', '대륙 5곳'], [6, '🐧', '여섯 대륙', '대륙 6곳 (남극 빼고 모두)']]),
      ...ladder(N.worldRegions, [[5, '📍', '해외 지역 5곳', '해외의 주·도 5곳'], [20, '🧩', '해외 지역 20곳', '해외의 주·도 20곳'], [50, '🗃️', '해외 지역 50곳', '해외의 주·도 50곳'], [100, '🗂️', '해외 지역 100곳', '해외의 주·도 100곳']])] },
    { title: '🧭 지구 끝까지', items: [
      { e: '🌐', t: '동반구·서반구', d: '그리니치 자오선 양쪽 모두', v: N.hemis ? 1 : 0, goal: 1 },
      { e: '🔄', t: '남반구', d: '적도 아래로', v: N.minLat < 0 ? 1 : 0, goal: 1 },
      ...ladder(N.maxLat, [[45, '🧥', '북위 45도', '북위 45° 넘어서'], [50, '🧣', '북위 50도', '북위 50° 넘어서'], [60, '🦌', '북위 60도', '북위 60° 넘어서'], [66.56, '🐻‍❄️', '북극권', '북위 66.56° 넘어서']]),
      ...ladder(-N.minLat, [[23.44, '🌴', '남회귀선', '남위 23.44° 아래로'], [40, '🌊', '남위 40도', '남위 40° 아래로']]),
      ...ladder(N.lonSpan, [[90, '📐', '지구 1/4 폭', '가장 동쪽과 서쪽이 경도 90° 넘게'], [180, '🌗', '지구 반대편', '가장 동쪽과 서쪽이 경도 180° 넘게']])] },
    { title: '🇰🇷 시·도', items: [
      ...ladder(N.krRegions, [[1, '🏠', '우리 시·도', '시·도 1곳'], [3, '🚌', '세 시·도', '시·도 3곳'], [5, '🚞', '다섯 시·도', '시·도 5곳'], [8, '🚅', '여덟 시·도', '시·도 8곳'], [10, '🗾', '열 시·도', '시·도 10곳'], [13, '🏞️', '열셋 시·도', '시·도 13곳'], [17, '🇰🇷', '전국 일주', '시·도 17곳 모두']]),
      { e: '🍊', t: '제주', d: '제주특별자치도 가 보기', v: (N.townsBySido.get('제주특별자치도') || 0) > 0 ? 1 : 0, goal: 1 },
      { e: '🏝️', t: '울릉도·독도', d: '울릉군 가 보기', v: N.townNames.has('울릉군') ? 1 : 0, goal: 1 },
      { e: '🌁', t: '광역시 순례', d: '특별시·광역시 7곳 모두', v: N.metro.filter(m => (N.townsBySido.get(m) || 0) > 0).length, goal: 7 }] },
    { title: '🏘️ 시·군·구', items: [
      ...ladder(N.towns, [[5, '🏡', '다섯 동네', '시·군·구 5곳'], [10, '🏘️', '열 동네', '시·군·구 10곳'], [20, '🚏', '스무 동네', '시·군·구 20곳'], [30, '🚉', '서른 동네', '시·군·구 30곳'], [50, '🗺️', '쉰 동네', '시·군·구 50곳'],
        [75, '🧭', '일흔다섯 동네', '시·군·구 75곳'], [100, '💯', '백 동네', '시·군·구 100곳'], [150, '🏆', '백오십 동네', '시·군·구 150곳'], [200, '👑', '이백 동네', '시·군·구 200곳'], [T.n, '🇰🇷', '전국 정복', `시·군·구 ${T.n}곳 모두`]]),
      { e: '🏙️', t: '서울 25구', d: '서울특별시 구 모두', v: N.townsBySido.get('서울특별시') || 0, goal: N.sidoTotal.get('서울특별시') || 25 },
      { e: '⚓', t: '부산 정복', d: '부산광역시 구·군 모두', v: N.townsBySido.get('부산광역시') || 0, goal: N.sidoTotal.get('부산광역시') || 16 },
      { e: '🏞️', t: '경기 정복', d: '경기도 시·군 모두', v: N.townsBySido.get('경기도') || 0, goal: N.sidoTotal.get('경기도') || 31 },
      { e: '🌲', t: '강원 정복', d: '강원특별자치도 시·군 모두', v: N.townsBySido.get('강원특별자치도') || 0, goal: N.sidoTotal.get('강원특별자치도') || 18 },
      { e: '🌺', t: '제주 정복', d: '제주시·서귀포시 모두', v: N.townsBySido.get('제주특별자치도') || 0, goal: N.sidoTotal.get('제주특별자치도') || 2 }] },
    { title: '🏃 대단했던 하루', items: [
      ...ladder(N.maxDay / K, [[50, '🚗', '먼 나들이', '하루에 50km'], [100, '🛣️', '하루 100km', '하루에 100km'], [300, '🚄', '하루 300km', '하루에 300km'], [500, '🏎️', '하루 500km', '하루에 500km'], [1000, '✈️', '하루 1,000km', '하루에 1,000km'], [5000, '🌏', '하루 5,000km', '하루에 5,000km']]),
      ...ladder(N.maxWalk / K, [[10, '🚶', '하루 10km 걷기', '하루에 걸어서 10km'], [20, '🥾', '하루 20km 걷기', '하루에 걸어서 20km'], [30, '🏔️', '하루 30km 걷기', '하루에 걸어서 30km'], [42.195, '🏅', '하루 마라톤', '하루에 걸어서 42.195km']]),
      ...ladder(N.maxDayCountries, [[2, '🛃', '하루 두 나라', '하루에 나라 2곳'], [3, '🎌', '하루 세 나라', '하루에 나라 3곳']]),
      ...ladder(N.maxDayTowns, [[5, '🚌', '하루 다섯 동네', '하루에 시·군·구 5곳'], [10, '🚐', '하루 열 동네', '하루에 시·군·구 10곳'], [20, '🚀', '하루 스무 동네', '하루에 시·군·구 20곳']])] },
    { title: '📍 추억', items: [
      ...ladder(N.mems, [[1, '📌', '첫 추억', '추억 1개'], [10, '📝', '추억 10개', '추억 10개'], [30, '📒', '추억 30개', '추억 30개'], [50, '📔', '추억 50개', '추억 50개'], [100, '📚', '추억 100개', '추억 100개'], [300, '🗄️', '추억 300개', '추억 300개'], [500, '🏛️', '추억 500개', '추억 500개'], [1000, '💫', '추억 1,000개', '추억 1,000개']]),
      ...ladder(N.mPhotos, [[10, '📷', '사진 추억 10', '사진 있는 추억 10개'], [100, '🖼️', '사진 추억 100', '사진 있는 추억 100개'], [500, '🎞️', '사진 추억 500', '사진 있는 추억 500개']]),
      ...ladder(N.icons, [[5, '🎨', '다섯 가지 아이콘', '서로 다른 아이콘 5개'], [10, '🌈', '열 가지 아이콘', '서로 다른 아이콘 10개'], [20, '🎪', '스무 가지 아이콘', '서로 다른 아이콘 20개']]),
      ...ladder(N.memCountries, [[3, '✉️', '세 나라의 추억', '추억을 남긴 나라 3곳'], [10, '💌', '열 나라의 추억', '추억을 남긴 나라 10곳']])] },
    { title: '⏰ 시간', items: [
      ...ladder(N.dawn, [[1, '🌙', '올빼미', '새벽 0~4시에 움직임']]), ...ladder(N.early, [[1, '🌅', '아침형 인간', '새벽 4~6시에 움직임']]), ...ladder(N.late, [[1, '🌃', '밤 산책', '밤 11시 넘어 움직임']])] },
    { title: '📥 옛 기록', items: [
      ...ladder(N.googleDays, [[1, '🗂️', '타임라인 불러옴', '구글 타임라인 1일'], [30, '📂', '타임라인 한 달', '구글 타임라인 30일'], [365, '🗃️', '타임라인 일 년', '구글 타임라인 365일'], [1000, '🏺', '타임라인 천 일', '구글 타임라인 1,000일']]),
      ...ladder(N.photoSpots, [[10, '📸', '사진 위치 10곳', '사진 위치 10곳'], [100, '🖼️', '사진 위치 100곳', '사진 위치 100곳'], [1000, '🎞️', '사진 위치 1,000곳', '사진 위치 1,000곳'], [5000, '📽️', '사진 위치 5,000곳', '사진 위치 5,000곳']]),
      ...ladder(N.yearsSince, [[10, '🕰️', '십 년 전의 나', '10년 넘은 기록이 있음']])] },
    { title: '🎯 여행 계획', items: ladder(N.plansDone, [[1, '✅', '계획 실천', '가고 싶던 곳 1곳 다녀옴'], [3, '🎯', '셋 다녀옴', '가고 싶던 곳 3곳'], [10, '🏹', '열 곳 다녀옴', '가고 싶던 곳 10곳'], [30, '🧗', '버킷리스트', '가고 싶던 곳 30곳'], [50, '🏆', '꿈을 이루다', '가고 싶던 곳 50곳']]) },
  ];
}

// ───────── 화면 ─────────
let busy = false;
async function show() {
  if (busy) return;
  const box = $('statsBox'); if (!box) return;
  const sig = signature();
  if (!cache || cache.sig !== sig) {
    busy = true;
    box.innerHTML = `<h2>나의 기록</h2><div class="card"><span class="muted" id="stProg">모든 기록을 모으는 중…</span><div class="prog"><i style="width:30%"></i></div></div>`;
    try {
      if (plansDone == null && !C.DEMO) { const { data } = await C.sb.from('plans').select('done_day'); plansDone = (data || []).filter(p => p.done_day).length; }
      const G = await compute((t) => { const el = $('stProg'); if (el) el.textContent = t; });
      cache = { sig, G };
    } catch (e) {
      box.innerHTML = `<h2>나의 기록</h2><div class="note warn">통계를 만들지 못했어요: ${C.esc(e.message || e)}</div>`;
      busy = false; return;
    }
    busy = false;
  }
  render(cache.G);
}

function render(G) {
  const N = numbers(G), S = C.summary || {};
  const fd = (d) => d.replaceAll('-', '.');
  const pct = (v, g) => Math.max(0, Math.min(1, v / g));
  let h = `<h2>나의 기록 <span class="muted" style="font-size:15px">앱 GPS · 구글 타임라인 · 사진 위치 · 추억을 모두 합쳤어요</span></h2>`;
  // 큰 숫자
  h += `<div class="tiles">
    <div class="tile"><span>움직인 거리</span><b class="a">${C.fmtDist(N.tot)}</b><small>지구 ${(N.tot / 40075000).toFixed(2)}바퀴</small></div>
    <div class="tile"><span>기록한 날</span><b>${C.nf.format(N.days)}일</b><small>${fd(N.first)}부터 · ${N.yearsSince < 1 ? Math.round(N.yearsSince * 12) + '개월' : N.yearsSince.toFixed(1) + '년'}</small></div>
    <div class="tile"><span>가 본 나라</span><b class="a">${N.countries}곳</b><small>대륙 ${N.conts}곳 · 해외 지역 ${N.worldRegions}곳</small></div>
    <div class="tile"><span>대한민국</span><b>${N.krRegions} / 17 시·도</b><small>시·군·구 ${N.towns} / ${T.n}곳</small></div>
    <div class="tile"><span>걸음</span><b>${C.nf.format(N.steps)}보</b><small>1만 보 넘은 날 ${N.steps10k}일</small></div>
    <div class="tile"><span>추억</span><b>${C.nf.format(N.mems)}개</b><small>사진 있는 추억 ${N.mPhotos}개</small></div>
  </div>`;
  // 이동 수단, 기록 출처, 지구에서 밝힌 곳(앱)
  h += `<div class="grid" style="margin-top:14px">
    <div class="card"><span class="muted">이동 수단</span>
      <div class="row"><span>🚶 걷기</span><span class="v">${C.fmtDist(N.walk)}</span></div>${C.bar(N.walk / Math.max(1, N.tot))}
      <div class="row"><span>🚗 차 · 기차</span><span class="v">${C.fmtDist(N.car)}</span></div>${C.bar(N.car / Math.max(1, N.tot), 'sky')}
      <div class="row"><span>✈️ 비행기</span><span class="v">${C.fmtDist(N.plane)}</span></div>${C.bar(N.plane / Math.max(1, N.tot), 'green')}</div>
    <div class="card"><span class="muted">어디서 온 기록일까</span>
      <div class="row"><span>📱 앱 GPS</span><span class="v">${N.srcDays.app.size}일</span></div>
      <div class="row"><span>🗺️ 구글 타임라인</span><span class="v">${N.srcDays.google.size}일</span></div>
      <div class="row"><span>📷 사진 위치</span><span class="v">${N.srcDays.photo.size}일 · ${C.nf.format(N.photoSpots)}곳</span></div>
      <div class="row"><span>📍 추억</span><span class="v">${N.srcDays.mem.size}일</span></div></div>
    <div class="card"><span class="muted">지구에서 밝힌 넓이 (앱 GPS 기준)</span><div class="big">${C.fmtPct(S.earthPct ?? 0)}</div><span>${C.fmtArea(S.area ?? 0)} · 이어서 기록한 최장 ${N.streak}일</span></div>
  </div>`;
  // 해마다
  const years = new Map();
  const addY = (d, k, v) => { const y = d.slice(0, 4); let o = years.get(y); if (!o) years.set(y, o = { days: new Set(), dist: 0, countries: new Set(), newC: 0, newT: 0 }); if (k === 'd') o.days.add(d); if (k === 'dist') o.dist += v; };
  for (const [d, v] of N.dayDist) addY(d, 'dist', v);
  for (const d of [...N.srcDays.app, ...N.srcDays.google, ...N.srcDays.photo, ...N.srcDays.mem]) addY(d, 'd');
  for (const [d, cs] of G.dayCountries) { const o = years.get(d.slice(0, 4)); if (o) cs.forEach(c => o.countries.add(c)); }
  for (const v of G.countries.values()) { const o = years.get(v.first.slice(0, 4)); if (o) o.newC++; }
  for (const v of G.towns.values()) { const o = years.get(v.first.slice(0, 4)); if (o) o.newT++; }
  const ys = [...years.keys()].sort().reverse();
  h += `<section><h2>해마다</h2><div class="card" style="overflow-x:auto"><table class="an-tbl"><tr><th>해</th><th>기록한 날</th><th>움직인 거리</th><th>다녀간 나라</th><th>처음 간 나라</th><th>처음 간 시·군·구</th></tr>` +
    ys.map(y => { const o = years.get(y); return `<tr><td>${y}년</td><td>${o.days.size}일</td><td>${o.dist ? C.fmtDist(o.dist) : '-'}</td><td>${o.countries.size || '-'}</td><td>${o.newC || '-'}</td><td>${o.newT || '-'}</td></tr>`; }).join('') + `</table></div></section>`;
  // 나라
  const appPct = new Map((S.countries || []).map(c => [c.name, c]));
  const cl = [...G.countries.entries()].sort((a, b) => b[1].days.size - a[1].days.size);
  const regTotal = new Map(); for (let i = 0; i < R.n; i++) { const c = R.countries[R.rc[i]]; regTotal.set(c, (regTotal.get(c) || 0) + 1); }
  const regByC = new Map(); for (const r of G.regions.keys()) { const c = R.countries[R.rc[r]]; if (!regByC.has(c)) regByC.set(c, []); regByC.get(c).push(r); }
  const srcIcon = (set) => [set.has('app') && '📱', set.has('google') && '🗺️', (set.has('photo') || set.has('phone')) && '📷', set.has('mem') && '📍'].filter(Boolean).join('');
  h += `<section><h2>가 본 나라 <span class="muted" style="font-size:16px">${cl.length}곳 · ${[...G.conts.keys()].join(', ')}</span></h2><div class="grid">`;
  for (const [name, v] of cl) {
    const regs = (regByC.get(name) || []).sort((a, b) => G.regions.get(b).days.size - G.regions.get(a).days.size);
    const ap = appPct.get(name);
    h += `<div class="card"><div class="row"><h3>${C.esc(name)}</h3><span class="v">${srcIcon(v.src)}</span></div>
      <span class="muted">${v.cont} · 처음 ${fd(v.first)} · ${v.days.size}일 · 지역 ${regs.length} / ${regTotal.get(name) || '?'}${ap ? ` · 밝힌 넓이 ${C.fmtPct(ap.pct)}` : ''}</span>
      ${C.bar(regs.length / Math.max(1, regTotal.get(name) || 1), 'sky')}
      ${regs.slice(0, 6).map(r => `<div class="row"><span>${C.esc(R.name[r])}</span><span class="v">${G.regions.get(r).days.size}일</span></div>`).join('')}
      ${regs.length > 6 ? `<span class="muted">외 ${regs.length - 6}곳</span>` : ''}</div>`;
  }
  h += `</div></section>`;
  // 대한민국 시군구
  const townPct = new Map((S.towns || []).map(t => [t.name, t]));
  const sidos = [...N.sidoTotal.keys()];
  h += `<section><h2>대한민국 시·군·구 <span class="muted" style="font-size:16px">${N.towns} / ${T.n}곳</span></h2><div class="grid">`;
  for (const sd of sidos.sort((a, b) => (N.townsBySido.get(b) || 0) / N.sidoTotal.get(b) - (N.townsBySido.get(a) || 0) / N.sidoTotal.get(a))) {
    const got = N.townsBySido.get(sd) || 0, tot = N.sidoTotal.get(sd);
    const names = [...G.towns.keys()].filter(t => T.countries[T.rc[t]] === sd).sort((a, b) => G.towns.get(b).days.size - G.towns.get(a).days.size);
    h += `<div class="card" style="gap:8px"><div class="row"><h3>${C.esc(sd)}</h3><b style="color:${got ? 'var(--amber)' : 'var(--sub)'}">${got} / ${tot}</b></div>${C.bar(got / tot, got === tot ? 'green' : '')}
      <span class="muted" style="line-height:1.7">${names.length ? names.map(t => { const tp = townPct.get(sd.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, '') + ' ' + T.name[t]) || townPct.get(T.name[t]); return C.esc(T.name[t]) + (tp ? ` <span style="color:var(--green)">${C.fmtPct(tp.pct)}</span>` : ''); }).join(' · ') : '아직 없어요'}</span></div>`;
  }
  h += `</div></section>`;
  // 배지
  const secs = badgeSections(N);
  const allB = secs.flatMap(s => s.items), gotN = allB.filter(b => b.v >= b.goal).length;
  h += `<section><h2>배지 <span class="muted" style="font-size:16px">${gotN} / ${allB.length}개 모음</span></h2>${C.bar(gotN / allB.length)}`;
  for (const s of secs) {
    const g = s.items.filter(b => b.v >= b.goal).length;
    h += `<h3 class="bsec">${s.title} <span class="muted">${g} / ${s.items.length}</span></h3><div class="badges">`;
    for (const b of s.items) {
      const got = b.v >= b.goal, p = pct(b.v, b.goal);
      const vt = b.goal === 1 ? '' : `${fmtN(Math.min(b.v, b.goal))} / ${fmtN(b.goal)}`;
      h += `<div class="badge ${got ? 'got' : ''}" title="${C.esc(b.d)}"><div class="e">${b.e}</div><b>${C.esc(b.t)}</b><span>${C.esc(b.d)}</span>
        ${got ? '' : `<div class="bar" style="margin-top:6px;height:5px"><i style="width:${(p * 100).toFixed(1)}%"></i></div>${vt ? `<span style="font-size:10px">${vt}</span>` : ''}`}</div>`;
    }
    h += `</div>`;
  }
  h += `</section>`;
  // 앱이 계산한 것들 (자주 가는 곳)
  if (S.places?.length) {
    h += `<section><h2>자주 가는 곳 <span class="muted" style="font-size:15px">앱 기록 기준</span></h2><div class="grid">`;
    S.places.forEach((p, i) => { h += `<div class="card"><h3>${['🥇', '🥈', '🥉'][i] ?? i + 1} ${C.esc(p.name || (p.near ? p.near + ' 근처' : '이름 없는 곳'))}</h3><span class="muted">${p.visits}번 머묾 · 모두 ${C.hours(p.ms)}</span></div>`; });
    h += `</div></section>`;
  }
  h += `<p class="muted" style="margin-top:24px">나라·지역은 약 500m 칸 단위로 판단해요. 경계 자료: Natural Earth, 통계청. 밝힌 넓이(%)는 폰 앱이 10m 칸으로 계산한 값이에요.</p>`;
  $('statsBox').innerHTML = h;
}
function fmtN(v) { return v >= 100 ? C.nf.format(Math.round(v)) : v >= 10 ? (Math.round(v * 10) / 10).toString() : (Math.round(v * 100) / 100).toString(); }

function injectStyle() {
  const st = document.createElement('style');
  st.textContent = `
  .bsec { margin: 26px 0 10px; font-size: 17px; display: flex; gap: 10px; align-items: baseline; }
  .bsec .muted { font-size: 13px; }
  #page-stats .badge span { display: block; }
  #page-stats .tiles .tile b { font-size: 22px; }
  `;
  document.head.appendChild(st);
}
