/* ============================================================
   解題心得 — 資料存在 data/solutions.json
   訪客：直接讀網站上的 JSON
   管理：用 GitHub Token 透過 Contents API 讀寫同一個檔案
   ============================================================ */
const REPO      = 'orange0730/orange0730.github.io';
const BRANCH    = 'main';
const DATA_PATH = 'data/solutions.json';
const TOKEN_KEY = 'solutions.ghToken';
const DRAFT_KEY = 'solutions.draft';

/* 常用網站：name 會出現在選單，link 用題號自動產生題目連結 */
const SITES = [
  { name: 'Codeforces', link: id => {
      const m = id.match(/^(\d+)\s*([A-Za-z]\d*)$/);
      return m && `https://codeforces.com/problemset/problem/${m[1]}/${m[2].toUpperCase()}`;
  } },
  { name: 'AtCoder', link: id => {
      const m = id.match(/^([a-z]+\d+)[_-]([a-z]\d*)$/i);
      return m && `https://atcoder.jp/contests/${m[1].toLowerCase()}/tasks/${m[1].toLowerCase()}_${m[2].toLowerCase()}`;
  } },
  { name: 'CSES',       link: id => /^\d+$/.test(id) && `https://cses.fi/problemset/task/${id}` },
  { name: 'ZeroJudge',  link: id => /^[a-z]\d{3}$/i.test(id) && `https://zerojudge.tw/ShowProblem?problemid=${id.toLowerCase()}` },
  { name: 'TIOJ',       link: id => /^\d+$/.test(id) && `https://tioj.ck.tp.edu.tw/problems/${id}` },
  { name: 'LeetCode',   link: () => null },
  { name: 'Luogu',      link: id => /^[A-Z]+\d+$/i.test(id) && `https://www.luogu.com.cn/problem/${id.toUpperCase()}` },
  { name: 'Kattis',     link: id => /^[a-z0-9]+$/i.test(id) && `https://open.kattis.com/problems/${id.toLowerCase()}` },
  { name: 'UVa',        link: () => null },
  { name: 'APCS',       link: () => null },
  { name: 'CPE',        link: () => null },
  { name: 'TOI',        link: () => null },
];

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  items: [],
  site: 'all',
  query: '',
  token: '',
  editingId: null,
};

function storageGet(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function storageSet(key, val) {
  try { val ? localStorage.setItem(key, val) : localStorage.removeItem(key); } catch {}
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function autoLink(site, problemId) {
  const def = SITES.find(s => s.name.toLowerCase() === String(site).trim().toLowerCase());
  const id = String(problemId).trim();
  return (def && id && def.link(id)) || '';
}

/* ============================================================
   MARKDOWN — marked + DOMPurify + highlight.js + KaTeX
   ============================================================ */
marked.setOptions({ gfm: true, breaks: true });

function renderMarkdown(src) {
  // 先把數學式換成佔位符，避免 _ 和 * 被 marked 當成強調語法；程式碼區塊原樣保留
  const math = [];
  const guarded = String(src ?? '').replace(
    /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)|\$\$([\s\S]+?)\$\$|\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g,
    (whole, code, block, inline) => {
      if (code) return code;
      math.push({ tex: block ?? inline, display: block != null });
      return `KATEXMATH${math.length - 1}END`;
    }
  );

  const html = DOMPurify.sanitize(marked.parse(guarded));

  return html.replace(/KATEXMATH(\d+)END/g, (_, i) => {
    const { tex, display } = math[i];
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false });
    } catch {
      return escapeHtml(display ? `$$${tex}$$` : `$${tex}$`);
    }
  });
}

function fillMarkdown(el, src) {
  el.innerHTML = renderMarkdown(src);
  el.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
  el.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
}

function plainExcerpt(md, len = 110) {
  const text = String(md ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(#+|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~|$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > len ? text.slice(0, len) + '…' : text;
}

/* ============================================================
   GITHUB API
   ============================================================ */
function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function gh(path, opts = {}, token = state.token) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message || msg; } catch {}
    const err = new Error(`GitHub ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* 讀最新版本（含 sha），檔案不存在時回傳空資料 */
async function ghReadData(token = state.token) {
  try {
    const file = await gh(`/contents/${DATA_PATH}?ref=${BRANCH}&t=${Date.now()}`, {}, token);
    // 超過 1MB 時 contents API 不回傳內容，改用 blob API
    const b64 = file.content || (await gh(`/git/blobs/${file.sha}`, {}, token)).content;
    return { sha: file.sha, data: normalize(JSON.parse(b64ToUtf8(b64))) };
  } catch (err) {
    if (err.status === 404) return { sha: null, data: normalize({}) };
    throw err;
  }
}

/* 以最新檔案為基礎套用修改再寫回，避免覆蓋別台裝置的變更；sha 衝突時重試一次 */
async function ghCommit(mutate, message) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { sha, data } = await ghReadData();
    mutate(data.solutions);
    try {
      await gh(`/contents/${DATA_PATH}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          branch: BRANCH,
          content: utf8ToB64(JSON.stringify(data, null, 2) + '\n'),
          ...(sha ? { sha } : {}),
        }),
      });
      return data.solutions;
    } catch (err) {
      if (err.status !== 409 || attempt === 1) throw err;
    }
  }
}

function normalize(raw) {
  return { solutions: Array.isArray(raw?.solutions) ? raw.solutions : [] };
}

/* ============================================================
   DATA LOADING
   ============================================================ */
async function loadData() {
  if (state.token) {
    try {
      state.items = (await ghReadData()).data.solutions;
      return;
    } catch (err) {
      console.warn('從 GitHub 讀取失敗，改用網站上的檔案', err);
    }
  }
  try {
    const res = await fetch(DATA_PATH, { cache: 'no-cache' });
    state.items = res.ok ? normalize(await res.json()).solutions : [];
  } catch {
    state.items = [];
  }
}

function sortedItems() {
  return [...state.items].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
}

/* ============================================================
   LIST RENDERING
   ============================================================ */
function matchesQuery(item, q) {
  if (!q) return true;
  const hay = [item.site, item.problemId, item.title, (item.tags || []).join(' '), item.content]
    .join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(word => hay.includes(word));
}

function renderFilters() {
  const counts = {};
  state.items.forEach(it => { counts[it.site] = (counts[it.site] || 0) + 1; });
  const sites = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  if (state.site !== 'all' && !counts[state.site]) state.site = 'all';

  const row = $('#solFilters');
  row.hidden = sites.length < 2;
  row.innerHTML = [
    `<button class="filter-btn${state.site === 'all' ? ' active' : ''}" data-site="all">全部 <span class="sol-n">${state.items.length}</span></button>`,
    ...sites.map(s =>
      `<button class="filter-btn${state.site === s ? ' active' : ''}" data-site="${escapeHtml(s)}">${escapeHtml(s)} <span class="sol-n">${counts[s]}</span></button>`
    ),
  ].join('');
}

function renderList() {
  const list = $('#solList');
  const items = sortedItems().filter(it =>
    (state.site === 'all' || it.site === state.site) && matchesQuery(it, state.query)
  );

  $('#solCount').textContent = state.items.length
    ? (items.length === state.items.length ? `共 ${items.length} 篇` : `找到 ${items.length} / ${state.items.length} 篇`)
    : '';

  if (!state.items.length) {
    list.innerHTML = `<div class="sol-empty">${state.token
      ? '還沒有任何心得，按右上角「＋ 新增心得」寫下第一篇吧。'
      : '目前還沒有解題心得，敬請期待。'}</div>`;
    return;
  }
  if (!items.length) {
    list.innerHTML = '<div class="sol-empty">沒有符合條件的題目。</div>';
    return;
  }

  list.innerHTML = items.map(it => `
    <article class="sol-card" tabindex="0" data-id="${escapeHtml(it.id)}">
      <div class="sol-card-top">
        <span class="sol-site">${escapeHtml(it.site)}</span>
        <span class="sol-pid">${escapeHtml(it.problemId)}</span>
        ${it.date ? `<span class="sol-date">${escapeHtml(it.date)}</span>` : ''}
      </div>
      <h3 class="sol-card-title">${escapeHtml(it.title || `${it.site} ${it.problemId}`)}</h3>
      <p class="sol-card-excerpt">${escapeHtml(plainExcerpt(it.content))}</p>
      ${(it.tags || []).length ? `<div class="card-tags">${it.tags.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    </article>
  `).join('');
}

function render() {
  renderFilters();
  renderList();
}

/* ============================================================
   MODALS
   ============================================================ */
function openModal(id) {
  $(id).hidden = false;
  document.body.classList.add('sol-modal-open');
}
function closeModal(id) {
  $(id).hidden = true;
  if ($$('.sol-modal').every(m => m.hidden)) document.body.classList.remove('sol-modal-open');
}

/* ── 檢視 ── */
function openView(id, push = true) {
  const it = state.items.find(x => x.id === id);
  if (!it) return;

  $('#viewMeta').innerHTML = `
    <span class="sol-site">${escapeHtml(it.site)}</span>
    <span class="sol-pid">${escapeHtml(it.problemId)}</span>
    ${it.date ? `<span class="sol-date">${escapeHtml(it.date)}</span>` : ''}`;
  $('#viewTitle').textContent = it.title || `${it.site} ${it.problemId}`;
  $('#viewSub').innerHTML = [
    /^https?:\/\//i.test(it.url || '') ? `<a href="${escapeHtml(it.url)}" target="_blank" rel="noopener" class="card-link">前往題目 →</a>` : '',
    (it.tags || []).length ? `<div class="card-tags">${it.tags.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}</div>` : '',
  ].join('');
  fillMarkdown($('#viewBody'), it.content);
  $('#viewFoot').innerHTML = state.token
    ? `<button class="btn btn-sm btn-ghost" data-edit="${escapeHtml(it.id)}">編輯</button>`
    : '';

  if (push && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  openModal('#viewModal');
  $('#viewModal .sol-modal-panel').scrollTop = 0;
}

function closeView() {
  closeModal('#viewModal');
  if (location.hash) history.pushState(null, '', location.pathname + location.search);
}

/* ── 編輯 ── */
const form = () => $('#editForm');

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function openEditor(id = null) {
  if (!state.token) { openAdmin(); return; }
  const it = id ? state.items.find(x => x.id === id) : null;
  state.editingId = it ? it.id : null;

  let draft = null;
  if (!it) { try { draft = JSON.parse(storageGet(DRAFT_KEY) || 'null'); } catch {} }
  const src = it || draft || {};

  const f = form();
  f.site.value      = src.site || '';
  f.problemId.value = src.problemId || '';
  f.title.value     = src.title || '';
  f.url.value       = src.url || '';
  f.tags.value      = (Array.isArray(src.tags) ? src.tags.join(', ') : src.tags) || '';
  f.date.value      = src.date || today();
  f.content.value   = src.content || '';
  f.url.dataset.auto = it ? '' : (f.url.value ? '' : '1');

  $('#editTitle').textContent = it ? `編輯：${it.site} ${it.problemId}` : '新增解題心得';
  $('#editDelete').hidden = !it;
  setStatus('#editStatus', draft && !it ? '已載入上次未儲存的草稿' : '');
  setPane('write');
  updatePreview();
  closeModal('#viewModal');
  openModal('#editModal');
  (it ? f.content : f.site).focus();
}

function readForm() {
  const f = form();
  return {
    site:      f.site.value.trim(),
    problemId: f.problemId.value.trim(),
    title:     f.title.value.trim(),
    url:       f.url.value.trim(),
    tags:      f.tags.value.split(/[,，、]/).map(t => t.trim()).filter(Boolean),
    date:      f.date.value || today(),
    content:   f.content.value,
  };
}

function makeId(site, problemId, taken) {
  const base = `${site}-${problemId}`.toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-+|-+$/g, '') || 'note';
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

let previewTimer = 0;
function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const src = form().content.value;
    if (src.trim()) fillMarkdown($('#editPreview'), src);
    else $('#editPreview').innerHTML = '<p class="sol-preview-empty">預覽會顯示在這裡</p>';
  }, 120);
}

function setPane(pane) {
  $('#mdSplit').dataset.pane = pane;
  $$('.sol-md-tabs .filter-btn').forEach(b => b.classList.toggle('active', b.dataset.pane === pane));
}

function setStatus(sel, text, kind = '') {
  const el = $(sel);
  el.textContent = text;
  el.dataset.kind = kind;
}

function saveDraft() {
  if (state.editingId) return;
  const v = readForm();
  storageSet(DRAFT_KEY, (v.site || v.problemId || v.content.trim()) ? JSON.stringify(v) : '');
}

async function submitEditor(e) {
  e.preventDefault();
  const v = readForm();
  if (!v.site || !v.problemId) { setStatus('#editStatus', '請填寫網站和題號', 'error'); return; }
  if (!v.url) v.url = autoLink(v.site, v.problemId);

  const editingId = state.editingId;
  const now = new Date().toISOString();
  let savedId = editingId;

  $('#editSave').disabled = true;
  setStatus('#editStatus', '儲存中…');
  try {
    state.items = await ghCommit(list => {
      const idx = editingId ? list.findIndex(x => x.id === editingId) : -1;
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...v, updatedAt: now };
      } else {
        savedId = makeId(v.site, v.problemId, new Set(list.map(x => x.id)));
        list.push({ id: savedId, ...v, createdAt: now, updatedAt: now });
      }
    }, `${editingId ? 'Update' : 'Add'} solution: ${v.site} ${v.problemId}`);

    if (!editingId) storageSet(DRAFT_KEY, '');
    closeModal('#editModal');
    render();
    openView(savedId);
    flash('已儲存並 commit 到 GitHub，網站約 1 分鐘後更新');
  } catch (err) {
    setStatus('#editStatus', `儲存失敗：${err.message}`, 'error');
  } finally {
    $('#editSave').disabled = false;
  }
}

async function deleteCurrent() {
  const id = state.editingId;
  const it = state.items.find(x => x.id === id);
  if (!it || !confirm(`確定要刪除「${it.site} ${it.problemId}」的心得嗎？`)) return;

  $('#editDelete').disabled = true;
  setStatus('#editStatus', '刪除中…');
  try {
    state.items = await ghCommit(list => {
      const idx = list.findIndex(x => x.id === id);
      if (idx >= 0) list.splice(idx, 1);
    }, `Delete solution: ${it.site} ${it.problemId}`);
    closeModal('#editModal');
    history.replaceState(null, '', location.pathname + location.search);
    render();
    flash('已刪除');
  } catch (err) {
    setStatus('#editStatus', `刪除失敗：${err.message}`, 'error');
  } finally {
    $('#editDelete').disabled = false;
  }
}

/* ── 管理（Token） ── */
function openAdmin() {
  const f = $('#adminForm');
  f.token.value = '';
  f.token.placeholder = state.token ? '已登入（輸入新的 token 可替換）' : 'github_pat_…';
  $('#adminLogout').hidden = !state.token;
  setStatus('#adminStatus', '');
  openModal('#adminModal');
  f.token.focus();
}

async function submitAdmin(e) {
  e.preventDefault();
  const token = $('#adminForm').token.value.trim();
  if (!token) { setStatus('#adminStatus', '請貼上 token', 'error'); return; }

  setStatus('#adminStatus', '驗證中…');
  try {
    const { data } = await ghReadData(token);
    state.token = token;
    state.items = data.solutions;
    storageSet(TOKEN_KEY, token);
    closeModal('#adminModal');
    updateAdminUi();
    render();
    flash('已進入管理模式');
  } catch (err) {
    setStatus('#adminStatus', `驗證失敗：${err.message}`, 'error');
  }
}

function logout() {
  state.token = '';
  storageSet(TOKEN_KEY, '');
  closeModal('#adminModal');
  updateAdminUi();
  render();
  flash('已登出管理模式');
}

function updateAdminUi() {
  $('#solAddBtn').hidden = !state.token;
  $('#solAdminLabel').textContent = state.token ? '已登入' : '管理';
  $('#solAdminBtn').classList.toggle('is-on', !!state.token);
}

let flashTimer = 0;
function flash(text) {
  let el = $('.sol-flash');
  if (!el) {
    el = document.createElement('div');
    el.className = 'sol-flash';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ============================================================
   ROUTING — #id 直接打開某一篇
   ============================================================ */
function syncHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && state.items.some(x => x.id === id)) openView(id, false);
  else closeModal('#viewModal');
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  state.token = storageGet(TOKEN_KEY);
  $('#siteOptions').innerHTML = SITES.map(s => `<option value="${s.name}">`).join('');
  updateAdminUi();

  // 列表
  $('#solSearch').addEventListener('input', e => { state.query = e.target.value.trim(); renderList(); });
  $('#solFilters').addEventListener('click', e => {
    const btn = e.target.closest('[data-site]');
    if (!btn) return;
    state.site = btn.dataset.site;
    render();
  });
  $('#solList').addEventListener('click', e => {
    const card = e.target.closest('.sol-card');
    if (card) openView(card.dataset.id);
  });
  $('#solList').addEventListener('keydown', e => {
    const card = e.target.closest('.sol-card');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openView(card.dataset.id); }
  });

  // 按鈕
  $('#solAddBtn').addEventListener('click', () => openEditor());
  $('#solAdminBtn').addEventListener('click', openAdmin);
  $('#viewFoot').addEventListener('click', e => {
    const btn = e.target.closest('[data-edit]');
    if (btn) openEditor(btn.dataset.edit);
  });

  // 關閉 modal
  $('#viewModal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeView(); });
  $('#adminModal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal('#adminModal'); });
  $('#editModal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal('#editModal'); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#adminModal').hidden) closeModal('#adminModal');
    else if (!$('#editModal').hidden) closeModal('#editModal');
    else if (!$('#viewModal').hidden) closeView();
  });

  // 編輯器
  const f = form();
  f.addEventListener('submit', submitEditor);
  f.addEventListener('input', e => {
    if (e.target === f.url) f.url.dataset.auto = f.url.value ? '' : '1';
    if ((e.target === f.site || e.target === f.problemId) && f.url.dataset.auto) {
      f.url.value = autoLink(f.site.value, f.problemId.value);
    }
    if (e.target === f.content) updatePreview();
    saveDraft();
  });
  f.content.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      f.content.setRangeText('    ', f.content.selectionStart, f.content.selectionEnd, 'end');
      updatePreview();
    }
  });
  f.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); f.requestSubmit(); }
  });
  $$('.sol-md-tabs .filter-btn').forEach(b => b.addEventListener('click', () => setPane(b.dataset.pane)));
  $('#editDelete').addEventListener('click', deleteCurrent);

  // 管理
  $('#adminForm').addEventListener('submit', submitAdmin);
  $('#adminLogout').addEventListener('click', logout);

  $('#solList').innerHTML = '<div class="sol-empty">載入中…</div>';
  await loadData();
  render();
  syncHash();
  window.addEventListener('popstate', syncHash);
});
