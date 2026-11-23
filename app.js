// 성과면담 노트 · 데이터는 Supabase perf_review_sheets (로그인 없이 사용, user_id = null 행만 접근)
(function () {
'use strict';
const SB_URL = 'https://omdyyvqkxxigilxjysbz.supabase.co';
const SB_KEY = 'sb_publishable_g41wwhIMN19UchPheU9Vvg_lAHjnZNf';
const TABLE = 'perf_review_sheets';
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const QS = [
  { id: 'q1', cat: '업무 현황', q: '현재 맡고 있는 고정업무와 실시간업무는 무엇인가요?', fields: [{ k: 'a', l: '고정업무' }, { k: 'b', l: '실시간업무' }] },
  { id: 'q2', cat: '업무 현황', q: '본인이 현재 역할에 얼마나 적응했다고 생각하나요?', hints: ['0~10점 척도'], scale: true, fields: [{ k: 'a', l: '점수를 그렇게 준 이유' }] },
  { id: 'q3', cat: '성과 회고', q: '하반기에 가장 잘했다고 생각하는 업무는 뭐예요?' },
  { id: 'q4', cat: '성과 회고', q: '그 결과를 숫자로 보면 어느 정도였어요?', hints: ['처리 건수', '매출', '시간 단축'] },
  { id: 'q5', cat: '성과 회고', q: '본인이 생각하기에 가장 힘들었지만 해낸 일은요?' },
  { id: 'q6', cat: '성과 회고', q: '본인이 생각하기에 아쉬웠던 점이나 보완하고 싶은 부분은 뭐예요?' },
  { id: 'q7', cat: '만족도·건의', q: '회사 생활 전반에서 만족하는 점이 무엇인가요?', fields: [{ k: 'a', l: '만족하는 점' }, { k: 'b', l: '└ 이 부분을 개선하려면 어떤 게 필요할 것 같아요?' }] },
  { id: 'q8', cat: '만족도·건의', q: '팀에 대해 불편하거나 개선되었으면 하는 점이 있나요?', alt: ['이 면담을 통해 회사에 바라는 점이 있다면?', '회사나 팀에 바라는 점, 건의하고 싶은 게 있어요?'] },
  { id: 'q9', cat: '성장·커리어', q: '배우고 싶은 교육이나 키우고 싶은 역량이 있어요?', hints: ['AI 활용', '통신 직무'] },
  { id: 'q10', cat: '성장·커리어', q: '다음 반기에 새로 맡아보고 싶은 업무가 있어요?' },
  { id: 'q11', cat: '성장·커리어', q: '본인이 생각하는 장기적인 직무 목표는 무엇인가요?', alt: ['이 회사에서 장기적으로 어떤 역할을 담당하고 싶은가요?'] },
  { id: 'q12', cat: '성장·커리어', q: '도움받고 싶은 선배나, 반대로 챙겨주고 싶은 후배가 있어요?' },
  { id: 'q13', cat: '만족도·건의', q: '회사의 업무 방식이나 규정 중 이해되지 않거나 불편한 부분이 있나요?' },
  { id: 'q14', cat: '컨디션', q: '최근 개인적인 이슈나 스트레스 요인이 있나요?' },
  { id: 'q15', cat: '자기 인식', q: '본인이 생각하는 가장 큰 강점/약점은 무엇인가요?', fields: [{ k: 'a', l: '강점' }, { k: 'b', l: '약점' }] },
  { id: 'close', cat: '마무리', q: '기대사항을 한두 문장으로 전달하고, 격려로 마무리', close: true, fields: [{ k: 'a', l: '기대사항 (한두 문장)' }, { k: 'b', l: '격려 멘트' }, { k: 'c', l: '면담자 종합 의견' }] }
];
const SUM = QS.length, TOTAL = QS.length + 1, QN = QS.length - 1;
const fieldsOf = (q) => q.fields || [{ k: 'a', l: '팀원 답변' }];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

const user = { id: 'open' };
let S = { common: null, members: [] };          // common: {id,data}, members: [{id,name,date,sort,data}]
let dirty = new Set(), deleted = new Set();
let UI = ls.get('perf-review-ui', { tab: 'common', idx: {}, prepOpen: true, incPrep: true, hideInstall: false });
let manageOpen = false, menuOpen = false, jumpOpen = false, pendingDelete = null, toast = null;
const cacheKey = () => 'perf-review-cache-' + (user ? user.id : 'x');

// ───────── 저장 ─────────
function saveCache() { ls.set(cacheKey(), { S, dirty: [...dirty], deleted: [...deleted], at: Date.now() }); }
function saveUI() { ls.set('perf-review-ui', UI); }
let ftimer = null, flushing = false, again = false;
function markDirty(id) { dirty.add(id); saveCache(); setStatus('saving'); clearTimeout(ftimer); ftimer = setTimeout(flush, 800); }
function rowOf(id) {
  if (S.common && S.common.id === id) return { id, kind: 'common', name: '공통 준비', review_date: null, sort_order: -1, data: S.common.data };
  const m = S.members.find((x) => x.id === id);
  if (!m) return null;
  return { id, kind: 'member', name: m.name || '', review_date: m.date || null, sort_order: m.sort, data: m.data };
}
async function flush() {
  if (!user) return;
  if (flushing) { again = true; return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  flushing = true; again = false;
  try {
    for (const id of [...deleted]) {
      const { error } = await sb.from(TABLE).delete().eq('id', id);
      if (error) throw error;
      deleted.delete(id);
    }
    const ids = [...dirty];
    const rows = ids.map(rowOf).filter(Boolean);
    ids.forEach((id) => { if (!rowOf(id)) dirty.delete(id); });
    if (rows.length) {
      const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'id' });
      if (error) {
        if (error.code === '23505' && rows.some((r) => r.kind === 'common')) { await adoptServerCommon(); }
        else throw error;
      } else ids.forEach((id) => dirty.delete(id));
    }
    saveCache();
    setStatus(dirty.size || deleted.size ? 'saving' : 'saved');
  } catch (e) {
    console.warn(e);
    if (e && (e.status === 401 || /JWT/i.test(e.message || ''))) { setStatus('error'); }
    else setStatus(navigator.onLine ? 'error' : 'offline');
  }
  flushing = false;
  if (again || dirty.size || deleted.size) { clearTimeout(ftimer); ftimer = setTimeout(flush, again ? 300 : 5000); }
}
async function adoptServerCommon() {
  // 다른 기기에서 먼저 만든 공통 준비가 있으면 합쳐서 그 행을 씀
  const { data } = await sb.from(TABLE).select('*').eq('kind', 'common').limit(1);
  if (data && data[0]) {
    const mine = S.common ? S.common.data : {};
    dirty.delete(S.common && S.common.id);
    S.common = { id: data[0].id, data: Object.assign({}, data[0].data || {}, mine) };
    dirty.add(S.common.id);
  }
}
function setStatus(k) {
  const t = { saving: '저장 중…', saved: '저장됨', offline: '오프라인 · 연결되면 저장', error: '저장 실패 · 다시 시도 중', load: '불러오는 중…' }[k] || '';
  $('status').textContent = t;
}
window.addEventListener('online', () => { if (dirty.size || deleted.size) flush(); else setStatus('saved'); });
window.addEventListener('offline', () => setStatus('offline'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && (dirty.size || deleted.size)) flush(); });

// ───────── 불러오기 ─────────
async function loadAll() {
  setStatus('load');
  const cache = ls.get(cacheKey(), null);
  if (cache && cache.S) { S = cache.S; dirty = new Set(cache.dirty || []); deleted = new Set(cache.deleted || []); render(); }
  if (!navigator.onLine) { setStatus('offline'); if (!S.common) { S.common = { id: newId(), data: {} }; } render(); return; }
  const { data, error } = await sb.from(TABLE).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) { setStatus('error'); render(); return; }
  const local = S;
  const next = { common: null, members: [] };
  for (const r of data) {
    if (deleted.has(r.id)) continue;
    const localRow = dirty.has(r.id) ? (local.common && local.common.id === r.id ? { kind: 'common', v: local.common } : { kind: 'member', v: (local.members || []).find((m) => m.id === r.id) }) : null;
    if (r.kind === 'common') next.common = localRow && localRow.v ? localRow.v : { id: r.id, data: r.data || {} };
    else next.members.push(localRow && localRow.v ? localRow.v : { id: r.id, name: r.name, date: r.review_date || '', sort: r.sort_order, data: r.data || {} });
  }
  (local.members || []).forEach((m) => { if (dirty.has(m.id) && !next.members.find((x) => x.id === m.id)) next.members.push(m); });
  if (!next.common && local.common && dirty.has(local.common.id)) next.common = local.common;
  const firstTime = !data.length && !(local.members || []).length;
  if (!next.common) { next.common = { id: newId(), data: {} }; dirty.add(next.common.id); }
  if (firstTime) {
    for (let i = 1; i <= 3; i++) { const m = { id: newId(), name: '팀원 ' + i, date: '', sort: i, data: {} }; next.members.push(m); dirty.add(m.id); }
  }
  next.members.sort((a, b) => a.sort - b.sort);
  S = next; saveCache(); render();
  if (dirty.size || deleted.size) flush(); else setStatus('saved');
}

// ───────── 데이터 도우미 ─────────
const mem = (id) => S.members.find((m) => m.id === id);
const MD = (m) => { m.data.prep = m.data.prep || {}; m.data.ans = m.data.ans || {}; m.data.score = m.data.score || {}; return m.data; };
const curTab = () => (UI.tab === 'common' || mem(UI.tab) ? UI.tab : 'common');
const curIdx = () => Math.min(Math.max(UI.idx[curTab()] || 0, 0), TOTAL - 1);
function isDone(tab, q) {
  if (tab === 'common') return !!((S.common && S.common.data[q.id]) || '').trim();
  const d = MD(mem(tab));
  if (q.scale && d.score[q.id] != null) return true;
  return fieldsOf(q).some((f) => (d.ans[q.id + '.' + f.k] || '').trim());
}
const doneCount = (tab) => QS.filter((q) => isDone(tab, q)).length;

// ───────── 화면 ─────────
function renderTabs() {
  const t = curTab();
  let h = `<button class="tab ${t === 'common' ? 'on' : ''}" data-tab="common">공통 준비</button>`;
  S.members.forEach((m) => { h += `<button class="tab ${t === m.id ? 'on' : ''}" data-tab="${m.id}">${esc(m.name || '이름 없음')}${doneCount(m.id) >= QN ? '<span class="dot"></span>' : ''}</button>`; });
  h += `<button class="tab add" id="addTab">+ 추가</button>`;
  $('tabs').innerHTML = h;
  $('tabs').querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { UI.tab = b.dataset.tab; jumpOpen = false; toast = null; saveUI(); render(); });
  $('addTab').onclick = () => { manageOpen = true; menuOpen = false; addMember(); };
  const on = $('tabs').querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function addMember() {
  const sort = S.members.reduce((a, m) => Math.max(a, m.sort), 0) + 1;
  const m = { id: newId(), name: '팀원 ' + (S.members.length + 1), date: '', sort, data: {} };
  S.members.push(m); markDirty(m.id); render();
  setTimeout(() => { const el = document.querySelector(`[data-name="${m.id}"]`); if (el) { el.focus(); el.select(); } }, 60);
}
function renderMenu() {
  if (!menuOpen) { $('menu').innerHTML = ''; return; }
  $('menu').innerHTML = `<div class="panel"><h2>메뉴</h2><div class="menu-list">
    <button id="mManage">면담자 관리 <small>이름 · 면담일 · 순서</small></button>
    <button id="mSync">지금 저장하기 <small>서버와 다시 맞추기</small></button></div></div>`;
  $('mManage').onclick = () => { manageOpen = true; menuOpen = false; render(); };
  $('mSync').onclick = () => { menuOpen = false; renderMenu(); S.members.forEach((m) => dirty.add(m.id)); if (S.common) dirty.add(S.common.id); flush(); };
}
function renderManage() {
  if (!manageOpen) { $('manage').innerHTML = ''; return; }
  let h = `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><h2>면담자 관리</h2><button class="btn sm" id="mClose">닫기</button></div>
  <p class="muted">이름과 면담일은 바로 저장돼요. 삭제하면 그 팀원의 기록도 함께 지워져요.</p>`;
  if (!S.members.length) h += `<p class="muted">아직 면담자가 없어요.</p>`;
  S.members.forEach((m, i) => {
    h += `<div class="mrow"><div class="r"><input class="in-text" type="text" data-name="${m.id}" value="${esc(m.name)}" placeholder="이름">
      <div class="ord"><button data-up="${m.id}" aria-label="위로" ${i ? '' : 'disabled'}>↑</button><button data-down="${m.id}" aria-label="아래로" ${i < S.members.length - 1 ? '' : 'disabled'}>↓</button></div></div>
      <div class="r"><span class="lab">면담일</span><input type="date" data-date="${m.id}" value="${esc(m.date)}"><button class="btn sm danger" data-del="${m.id}">삭제</button></div>`;
    if (pendingDelete === m.id) h += `<div class="confirm">${esc(m.name)} 님과 면담 기록을 삭제할까요? 되돌릴 수 없어요.<div class="r"><button class="btn sm danger-fill" data-delok="${m.id}">삭제</button><button class="btn sm" data-delno>취소</button></div></div>`;
    h += `</div>`;
  });
  h += `<button class="btn" id="addM">+ 면담자 추가</button></div>`;
  $('manage').innerHTML = h;
  $('mClose').onclick = () => { manageOpen = false; pendingDelete = null; renderManage(); };
  const q = (s) => $('manage').querySelectorAll(s);
  q('[data-name]').forEach((i) => i.oninput = () => { mem(i.dataset.name).name = i.value; markDirty(i.dataset.name); renderTabs(); });
  q('[data-date]').forEach((i) => i.onchange = () => { mem(i.dataset.date).date = i.value; markDirty(i.dataset.date); });
  q('[data-del]').forEach((b) => b.onclick = () => { pendingDelete = b.dataset.del; renderManage(); });
  q('[data-delno]').forEach((b) => b.onclick = () => { pendingDelete = null; renderManage(); });
  q('[data-delok]').forEach((b) => b.onclick = () => {
    const id = b.dataset.delok; S.members = S.members.filter((m) => m.id !== id); dirty.delete(id); deleted.add(id);
    delete UI.idx[id]; if (UI.tab === id) UI.tab = 'common'; pendingDelete = null; saveUI(); saveCache(); setStatus('saving'); flush(); render();
  });
  const move = (id, d) => { const i = S.members.findIndex((m) => m.id === id), j = i + d; if (j < 0 || j >= S.members.length) return; [S.members[i], S.members[j]] = [S.members[j], S.members[i]]; S.members.forEach((m, k) => { if (m.sort !== k + 1) { m.sort = k + 1; markDirty(m.id); } }); render(); };
  q('[data-up]').forEach((b) => b.onclick = () => move(b.dataset.up, -1));
  q('[data-down]').forEach((b) => b.onclick = () => move(b.dataset.down, 1));
  $('addM').onclick = addMember;
}
function renderProg() {
  const t = curTab(), i = curIdx();
  $('barFill').style.width = Math.round((i + 1) / TOTAL * 100) + '%';
  $('pgBtn').textContent = (i < SUM ? (QS[i].close ? '마무리' : (i + 1) + ' / ' + QN) : '요약') + ' ▾';
  if (!jumpOpen) { $('jump').innerHTML = ''; return; }
  let h = `<div class="grid">`;
  QS.forEach((q, k) => { h += `<button class="${isDone(t, q) ? 'done' : ''} ${k === i ? 'cur' : ''}" data-j="${k}">${q.close ? '끝' : k + 1}</button>`; });
  h += `<button class="wide ${i === SUM ? 'cur' : ''}" data-j="${SUM}">요약·내보내기</button></div>`;
  $('jump').innerHTML = h;
  $('jump').querySelectorAll('[data-j]').forEach((b) => b.onclick = () => { jumpOpen = false; go(+b.dataset.j); });
}
function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight + 2, el.closest('details') ? 70 : 110) + 'px'; }
function installHint() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || UI.hideInstall) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="install"><div>${ios ? '<b>홈 화면에 앱으로 설치</b> · Safari 아래 공유 버튼 → <b>홈 화면에 추가</b>' : '<b>홈 화면에 앱으로 설치</b> · ' + (deferredPrompt ? '<button class="btn sm pri" id="doInstall" style="margin-left:4px">설치하기</button>' : 'Chrome 메뉴(⋮) → <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>')}</div><button class="x" id="hideInstall" aria-label="닫기">×</button></div>`;
}
function renderCard(dir) {
  const t = curTab(), i = curIdx();
  if (i === SUM) { renderSummary(dir); return; }
  const q = QS[i], isC = t === 'common', m = isC ? null : mem(t);
  let h = (i === 0 ? installHint() : '') + `<div class="card ${dir ? 'slide-' + dir : ''}"><div class="meta"><span class="chip">${esc(q.cat)}</span><span class="who">${isC ? '모든 팀원 공통 준비' : esc(m.name) + ' 면담 기록'}</span></div>
  <p class="q">${q.close ? '' : `<span class="no">${i + 1}.</span>`}${esc(q.q)}</p>`;
  (q.alt || []).forEach((a) => { h += `<p class="alt"><b>또는</b>${esc(a)}</p>`; });
  if (q.hints && !q.scale) h += `<div class="hints">${q.hints.map((x) => `<span class="hint">예: ${esc(x)}</span>`).join('')}</div>`;
  if (isC) {
    h += `<div><label class="lb">내 준비 메모 · 팀원이 답을 못할 때 꺼낼 내 관점</label><textarea data-k="common" placeholder="${q.close ? '모두에게 공통으로 전할 기대사항이나 격려 멘트를 적어두세요' : '예상 답변, 먼저 꺼낼 예시, 꼬리질문 등을 적어두세요'}">${esc(S.common.data[q.id] || '')}</textarea></div>`;
  } else {
    const d = MD(m), cm = (S.common.data[q.id] || '').trim(), mp = d.prep[q.id] || '';
    h += `<details class="prep" id="prepBox" ${UI.prepOpen ? 'open' : ''}><summary>내 준비 <span class="car">${cm || mp.trim() ? '작성됨' : '비어 있음'} · ${UI.prepOpen ? '접기' : '펼치기'}</span></summary><div class="pin">`;
    if (cm) h += `<div class="common"><b>공통 준비</b>${esc(cm)}</div>`;
    h += `<textarea data-k="prep" placeholder="${esc(m.name)} 님에게 맞춰 미리 정리할 내용">${esc(mp)}</textarea></div></details>`;
    if (q.scale) {
      const sc = d.score[q.id];
      h += `<div><label class="lb">팀원이 말한 점수</label><div class="scale"><input type="range" min="0" max="10" step="1" value="${sc == null ? 5 : sc}" data-k="score"><span class="sv" id="sv">${sc == null ? '–' : sc}<small>/10</small></span></div><div class="ticks"><span>0</span><span>5</span><span>10</span></div>
      <button class="btn sm ghost" id="clearScore" ${sc == null ? 'hidden' : ''}>점수 지우기</button></div>`;
    }
    fieldsOf(q).forEach((f) => { h += `<div><label class="lb">${esc(f.l)}</label><textarea data-k="ans" data-f="${f.k}" placeholder="${q.close ? '' : '팀원이 말한 내용을 받아 적으세요'}">${esc(d.ans[q.id + '.' + f.k] || '')}</textarea></div>`; });
  }
  h += `</div>`;
  $('main').innerHTML = h;
  bindCard(q, t);
}
function bindCard(q, t) {
  const hi = $('hideInstall'); if (hi) hi.onclick = () => { UI.hideInstall = true; saveUI(); renderCard(); };
  const di = $('doInstall'); if (di) di.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); try { await deferredPrompt.userChoice; } catch (e) {} deferredPrompt = null; renderCard(); };
  $('main').querySelectorAll('textarea').forEach((el) => {
    autoGrow(el);
    el.addEventListener('input', () => {
      const k = el.dataset.k;
      if (k === 'common') { S.common.data[q.id] = el.value; markDirty(S.common.id); }
      else { const m = mem(t), d = MD(m); if (k === 'prep') d.prep[q.id] = el.value; else d.ans[q.id + '.' + el.dataset.f] = el.value; markDirty(m.id); }
      autoGrow(el);
    });
  });
  const r = $('main').querySelector('input[type=range]');
  if (r) r.addEventListener('input', () => { const m = mem(t); MD(m).score[q.id] = +r.value; $('sv').innerHTML = r.value + '<small>/10</small>'; $('clearScore').hidden = false; markDirty(m.id); });
  const cs = $('clearScore'); if (cs) cs.onclick = () => { const m = mem(t); delete MD(m).score[q.id]; markDirty(m.id); renderCard(); };
  const pb = $('prepBox'); if (pb) pb.addEventListener('toggle', () => { UI.prepOpen = pb.open; saveUI(); const c = pb.querySelector('.car'); if (c) c.textContent = c.textContent.replace(/접기|펼치기/, pb.open ? '접기' : '펼치기'); pb.querySelectorAll('textarea').forEach(autoGrow); });
}

// ───────── 요약 · 보고서 ─────────
function reportData(t) {
  const isC = t === 'common', m = isC ? null : mem(t), d = isC ? null : MD(m), inc = UI.incPrep;
  const items = QS.map((q, i) => {
    const o = { title: q.close ? '마무리' : (i + 1) + '. ' + q.q, alt: q.alt || [], parts: [], score: null, prep: '' };
    if (isC) o.parts = [{ l: '내 준비', v: S.common.data[q.id] || '' }];
    else {
      if (q.scale) o.score = d.score[q.id] == null ? null : d.score[q.id];
      o.parts = fieldsOf(q).map((f) => ({ l: f.l, v: d.ans[q.id + '.' + f.k] || '' }));
      if (inc) o.prep = [S.common.data[q.id] || '', d.prep[q.id] || ''].map((s) => s.trim()).filter(Boolean).join('\n');
    }
    return o;
  });
  return { isC, name: isC ? '공통 준비' : m.name, date: isC ? '' : m.date, items };
}
function reportText(t) {
  const d = reportData(t), L = [];
  L.push(d.isC ? '[성과면담 공통 준비 노트]' : `[성과면담 기록] ${d.name}` + (d.date ? ` · 면담일 ${d.date}` : '')); L.push('');
  d.items.forEach((it) => {
    L.push('■ ' + it.title); it.alt.forEach((a) => L.push('  (또는) ' + a));
    if (it.score != null) L.push('  - 점수: ' + it.score + ' / 10');
    it.parts.forEach((p) => L.push('  - ' + (it.parts.length > 1 ? p.l + ': ' : '') + (p.v.trim() ? p.v.trim().replace(/\n/g, '\n    ') : '(기록 없음)')));
    if (it.prep) L.push('  · 면담자 준비 메모: ' + it.prep.replace(/\n/g, '\n    '));
    L.push('');
  });
  return L.join('\n');
}
function renderSummary(dir) {
  const t = curTab(), d = reportData(t);
  const answered = d.isC ? doneCount('common') : doneCount(t);
  let h = `<div class="card ${dir ? 'slide-' + dir : ''}"><div class="meta"><span class="chip">요약</span><span class="who">${d.isC ? '공통 준비 노트' : esc(d.name) + (d.date ? ' · ' + esc(d.date) : '')}</span></div>
  <p class="q">${d.isC ? '내 준비 한눈에 보기' : esc(d.name) + ' 님 면담 요약'}</p>
  <div class="stat"><div><b>${answered}</b><span>작성한 카드</span></div><div><b>${SUM - answered}</b><span>빈 카드</span></div><div><b>${d.isC ? '–' : (d.items[1].score == null ? '–' : d.items[1].score)}</b><span>적응도 점수</span></div></div>`;
  if (toast) h += `<div class="toast ${toast.c || ''}">${esc(toast.m)}</div>`;
  h += `<div class="exp">${d.isC ? '' : `<label class="chk"><input type="checkbox" id="incPrep" ${UI.incPrep ? 'checked' : ''}> 보고서에 내 준비 메모 포함</label>`}
    <div class="r"><button class="btn pri" id="exDocx">Word 보고서 저장</button><button class="btn" id="exCopy">텍스트 복사</button></div>
    <p class="muted">파일 이름: ${esc(fname(t, 'docx'))}</p></div><div class="sum">`;
  d.items.forEach((it) => {
    const has = it.parts.some((p) => p.v.trim()) || it.score != null;
    h += `<div class="it"><p class="qq">${esc(it.title)}</p>`;
    if (it.score != null) h += `<p class="aa"><span class="l">점수 · </span>${it.score} / 10</p>`;
    it.parts.forEach((p) => { if (p.v.trim()) h += `<p class="aa">${it.parts.length > 1 ? `<span class="l">${esc(p.l)} · </span>` : ''}${esc(p.v.trim())}</p>`; });
    if (!has) h += `<p class="aa empty">기록 없음</p>`;
    if (it.prep) h += `<p class="pp">내 준비 · ${esc(it.prep)}</p>`;
    h += `</div>`;
  });
  h += `</div></div>`;
  $('main').innerHTML = h;
  const ip = $('incPrep'); if (ip) ip.onchange = () => { UI.incPrep = ip.checked; saveUI(); toast = null; renderSummary(); };
  $('exCopy').onclick = async () => { try { await navigator.clipboard.writeText(reportText(t)); flash('복사했어요. 메신저나 평가 시스템에 붙여넣으세요.'); } catch (e) { flash('복사하지 못했어요.', 'err'); } };
  $('exDocx').onclick = () => exportDocx(t);
}
function flash(m, c) { toast = { m, c }; renderSummary(); setTimeout(() => { toast = null; if (curIdx() === SUM) renderSummary(); }, 5000); }
function fname(t, ext) { const d = reportData(t); const nm = (d.name || '팀원').replace(/[\\/:*?"<>|]/g, '').trim() || '팀원'; return d.isC ? `성과면담_공통준비.${ext}` : `성과면담_${nm}${d.date ? '_' + d.date : ''}.${ext}`; }
async function buildDocx(t) {
  const X = window.docx; if (!X) throw new Error('nolib');
  const d = reportData(t), ch = [];
  const lines = (s, o) => String(s).split('\n').map((x, i) => new X.TextRun(Object.assign({ text: x, break: i ? 1 : 0 }, o || {})));
  ch.push(new X.Paragraph({ children: [new X.TextRun({ text: 'WAVENET', bold: true, size: 18, color: '3D6EF2' })] }));
  ch.push(new X.Paragraph({ heading: X.HeadingLevel.TITLE, children: [new X.TextRun({ text: d.isC ? '성과면담 공통 준비 노트' : '성과면담 기록 · ' + d.name, bold: true, size: 36, color: '141A26' })] }));
  ch.push(new X.Paragraph({ spacing: { after: 240 }, border: { bottom: { style: X.BorderStyle.SINGLE, size: 8, color: '3D6EF2', space: 6 } }, children: [new X.TextRun({ text: (d.date ? '면담일 ' + d.date + '    ' : '') + '작성일 ' + new Date().toLocaleDateString('ko-KR'), color: '6B7385', size: 19 })] }));
  d.items.forEach((it) => {
    ch.push(new X.Paragraph({ heading: X.HeadingLevel.HEADING_2, spacing: { before: 280, after: 80 }, children: [new X.TextRun({ text: it.title, bold: true, size: 23, color: '141A26' })] }));
    it.alt.forEach((a) => ch.push(new X.Paragraph({ children: [new X.TextRun({ text: '또는 ' + a, color: '6B7385', size: 19 })] })));
    if (it.score != null) ch.push(new X.Paragraph({ children: [new X.TextRun({ text: '점수  ', bold: true, color: '3D6EF2' }), new X.TextRun({ text: it.score + ' / 10', bold: true })] }));
    it.parts.forEach((p) => { const v = p.v.trim(); ch.push(new X.Paragraph({ spacing: { after: 80 }, children: [...(it.parts.length > 1 ? [new X.TextRun({ text: p.l + '  ', bold: true, color: '6B7385' })] : []), ...(v ? lines(v) : [new X.TextRun({ text: '기록 없음', color: 'A3AABA' })])] })); });
    if (it.prep) ch.push(new X.Paragraph({ shading: { type: X.ShadingType.CLEAR, fill: 'EEF3FF', color: 'auto' }, spacing: { before: 60, after: 60 }, children: [new X.TextRun({ text: '면담자 준비 메모', bold: true, size: 18, color: '3D6EF2' }), ...String(it.prep).split('\n').map((x) => new X.TextRun({ text: x, break: 1, size: 18, color: '4A5568' }))] }));
  });
  const doc = new X.Document({ styles: { default: { document: { run: { font: 'Malgun Gothic', size: 21 } } } }, sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: ch }] });
  return X.Packer.toBlob(doc);
}
async function exportDocx(t) {
  let blob;
  try { blob = await buildDocx(t); } catch (e) { flash('보고서를 만들지 못했어요. 앱을 새로고침한 뒤 다시 눌러주세요.', 'err'); return; }
  const name = fname(t, 'docx');
  const file = new File([blob], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); flash('보고서를 보냈어요: ' + name); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000);
  flash('보고서를 저장했어요: ' + name);
}

// ───────── 이동 ─────────
function go(i, dir) { UI.idx[curTab()] = Math.min(Math.max(i, 0), TOTAL - 1); toast = null; saveUI(); renderProg(); renderCard(dir); renderNav(); window.scrollTo({ top: 0 }); }
function renderNav() { const i = curIdx(); $('prevBtn').style.visibility = i ? 'visible' : 'hidden'; $('nextBtn').textContent = i === SUM - 1 ? '요약 보기 →' : i === SUM ? '처음으로' : '다음 →'; }
function render() { if (!S.common) return; renderTabs(); renderMenu(); renderManage(); renderProg(); renderCard(); renderNav(); }
$('prevBtn').onclick = () => go(curIdx() - 1, 'r');
$('nextBtn').onclick = () => go(curIdx() === SUM ? 0 : curIdx() + 1, 'l');
$('pgBtn').onclick = () => { jumpOpen = !jumpOpen; renderProg(); };
$('menuBtn').onclick = () => { menuOpen = !menuOpen; renderMenu(); window.scrollTo({ top: 0 }); };
let sx = 0, sy = 0, st = null;
$('main').addEventListener('touchstart', (e) => { st = e.target.closest('textarea,input,summary,button,.sum') ? null : e.touches[0]; if (st) { sx = st.clientX; sy = st.clientY; } }, { passive: true });
$('main').addEventListener('touchend', (e) => { if (!st) return; const c = e.changedTouches[0], dx = c.clientX - sx, dy = c.clientY - sy; st = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) { if (dx < 0 && curIdx() < TOTAL - 1) go(curIdx() + 1, 'l'); else if (dx > 0 && curIdx() > 0) go(curIdx() - 1, 'r'); } }, { passive: true });

// ───────── 설치 · 로그인 ─────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (S.common && curIdx() === 0) renderCard(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

$('boot').hidden = true; $('app').hidden = false; loadAll();
})();
