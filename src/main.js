import './style.css';
import './data.js';
import { GRAPH, GRAPH_TYPES, TIMELINE, LEVEL_COLORS } from './knowledge.js';

const DATA = window.ARCHIVE_DATA || [];

// 公开附件随静态站点同源发布；外部地址仅用于原始馆藏来源链接。
const fsUrl = (p) => encodeURI(p);

const CATS = [
  ['all', '全部资料'],
  ['newspaper', '报纸报道 1920–21'],
  ['archive', '档案馆史料'],
  ['photo-old', '清末旧楼照片'],
  ['photo-new', '民国新楼照片'],
  ['map', '方志城图·地图'],
  ['object', '实物遗存'],
  ['lit', '研究文献'],
  ['doc', '研究文档'],
  ['table', '附表·数据表'],
];
const CAT_LABEL = Object.fromEntries(CATS);
const CAT_SEAL = {
  newspaper: '报', archive: '档', 'photo-old': '照', 'photo-new': '照',
  map: '图', object: '物', lit: '文', doc: '稿', table: '表',
};
const VIEWS = [
  ['home', '总控'],
  ['graph', '关系图谱'],
  ['timeline', '事件时间轴'],
  ['archive', '全部资料'],
];

const state = {
  view: 'home', cat: 'all', q: '', sort: 'date-asc',
  openId: null, detailImg: 0, lightbox: null,
  graphSel: null, graphTypes: new Set(Object.keys(GRAPH_TYPES)),
};

/* ---------- 工具 ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sortKey = (it) => (it.date && /^\d{4}/.test(it.date)) ? it.date : (/\d{4}/.test(it.date || '') ? it.date : '9999');

/* ---------- 路由 ---------- */
function parseHash() {
  const h = location.hash.slice(1);
  if (!h || h === '/') return { view: 'home' };
  if (h.startsWith('/graph')) return { view: 'graph' };
  if (h.startsWith('/timeline')) return { view: 'timeline' };
  if (h.startsWith('/archive')) return { view: 'archive', id: h.slice(8).replace(/^\//, '') || null };
  const id = DATA.some((d) => d.id === h) ? h : decodeURIComponent(h);
  if (DATA.some((d) => d.id === id)) return { view: 'archive', id }; // 兼容旧深链接
  return { view: 'home' };
}
function route() {
  const r = parseHash();
  const viewChanged = state.view !== r.view;
  state.view = r.view;
  state.openId = r.id || null;
  state.detailImg = 0;
  if (viewChanged) state.graphSel = null;
  render();
}
window.addEventListener('hashchange', route);

/* ---------- 骨架 ---------- */
const app = document.getElementById('app');

function render() {
  if (G) { G.stop(); G = null; } // 离开图谱时停止力导循环
  const counts = {};
  DATA.forEach((it) => { counts[it.cat] = (counts[it.cat] || 0) + 1; });
  app.innerHTML = `
  <aside class="sidebar">
    <div class="brand">
      <h1>天津鼓楼<br>资料数据库</h1>
      <div class="sub">GULOU ARCHIVE · 个人研究项目</div>
    </div>
    <nav class="nav" aria-label="视图">
      ${VIEWS.map(([id, label]) => `
        <button data-view="${id}" class="${state.view === id ? 'active' : ''}">
          <span>${label}</span>${id === 'archive' ? `<span class="cnt">${DATA.length}</span>` : ''}
        </button>`).join('')}
      ${state.view === 'archive' ? `<div class="nav-divider">资料分类</div>` + CATS.map(([id, label]) => `
        <button data-cat="${id}" class="sub-cat ${state.cat === id ? 'active' : ''}">
          <span>${label}</span><span class="cnt">${id === 'all' ? DATA.length : (counts[id] || 0)}</span>
        </button>`).join('') : ''}
    </nav>
    <div class="side-foot">共 ${DATA.length} 条记录<br>含 13 份原版面报纸校勘<br>整理截止 2026-11-14</div>
  </aside>
  <div class="main" id="main"></div>`;

  app.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => { location.hash = '#/' + b.dataset.view; }));
  app.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => { state.cat = b.dataset.cat; render(); }));

  const main = app.querySelector('#main');
  if (state.view === 'home') renderHome(main);
  else if (state.view === 'graph') renderGraph(main);
  else if (state.view === 'timeline') renderTimeline(main);
  else renderArchive(main);

  if (state.openId) renderDetail();
}

/* ---------- 总控首页 ---------- */
function renderHome(main) {
  const counts = {};
  DATA.forEach((it) => { counts[it.cat] = (counts[it.cat] || 0) + 1; });
  main.innerHTML = `
  <div class="home">
    <header class="home-hero">
      <h2>天津鼓楼历史档案<br><span>多源互证研究资料库</span></h2>
      <p>汇集 13 份原版面报纸（逐字转录＋逐条校勘）、天津市档案馆史料、清末与民国照片、方志城图与研究文献，共 ${DATA.length} 条记录。转录与目录证据分级标注，原件取得状态逐条说明。</p>
    </header>
    <div class="home-cards">
      <button class="home-card" data-go="graph">
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="12" r="3.5" fill="currentColor"/><circle cx="39" cy="10" r="3.5" fill="currentColor"/><circle cx="10" cy="38" r="3.5" fill="currentColor"/><circle cx="38" cy="37" r="3.5" fill="currentColor"/><path d="M12 14.5 20 21M36 12.5 28 21M12.5 35.5 20 27M35.5 34.5 28 27" stroke="currentColor" stroke-width="1.6"/></svg>
        <span class="hc-ttl">关系图谱</span>
        <span class="hc-desc">人物 · 机构 · 事件 · 地点 · 文献<br>${GRAPH.nodes.length} 个节点，${GRAPH.edges.length} 条关系，可拖拽缩放</span>
        <span class="hc-cta">进入图谱 →</span>
      </button>
      <button class="home-card" data-go="archive">
        <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="8" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="26" y="8" width="14" height="14" rx="2" fill="currentColor"/><rect x="8" y="26" width="14" height="14" rx="2" fill="currentColor"/><rect x="26" y="26" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        <span class="hc-ttl">全部资料</span>
        <span class="hc-desc">十类档案逐条调阅<br>报纸 ${counts.newspaper || 0} · 档案 ${counts.archive || 0} · 照片 ${(counts['photo-old'] || 0) + (counts['photo-new'] || 0)} · 地图 ${counts.map || 0} · 文献 ${counts.lit || 0}</span>
        <span class="hc-cta">进入资料库 →</span>
      </button>
      <button class="home-card" data-go="timeline">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 8v32" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="13" r="3.5" fill="currentColor"/><circle cx="10" cy="24" r="3.5" fill="currentColor"/><circle cx="10" cy="35" r="3.5" fill="currentColor"/><path d="M18 13h22M18 24h16M18 35h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span class="hc-ttl">事件时间轴</span>
        <span class="hc-desc">从 1918 年目测倾侧到 1922 年题联<br>${TIMELINE.length} 个节点，标注证据等级，可跳回档案原文</span>
        <span class="hc-cta">进入时间轴 →</span>
      </button>
    </div>
    <section class="home-note">
      <h3>读库须知</h3>
      <ul>
        <li>报纸转录以 2026-11-05 校勘记为准；【定】【疑】【阙】三级置信度在详情页逐条标注。</li>
        <li>款项口径分立：九千元为<b>估价</b>、八千余元为<b>承包工价</b>，无决算凭据——任何表述不得称“决算”。</li>
        <li>网络转载照片引用论文前须回溯原始馆藏；方志城图以来源说明中的馆藏信息为准。</li>
        <li>档案馆史料分级使用：目录级记录只证明该条目已经著录，不代替原文；已下载影像提供内容提要与页数，未逐字转录处不作直接引文。</li>
      </ul>
    </section>
  </div>`;
  main.querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => { location.hash = '#/' + b.dataset.go; }));
}

/* ---------- 全部资料（原档案库） ---------- */
function thumbOf(it) {
  const imgs = (it.files || []).filter((f) => f.kind === 'image');
  if (!imgs.length) return null;
  return imgs.find((f) => f.label.includes('预览')) || imgs.find((f) => f.label.includes('合并')) || imgs[0];
}
function filtered() {
  const q = state.q.trim().toLowerCase();
  let list = DATA.filter((it) => state.cat === 'all' || it.cat === state.cat);
  if (q) {
    list = list.filter((it) =>
      [it.title, it.paper, it.date, it.author, it.archiveId, it.status, it.source, it.summary, it.transcription, (it.notes || []).join(' '), (it.tags || []).join(' ')]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
  }
  list = [...list].sort((a, b) => {
    if (state.sort === 'title') return String(a.title).localeCompare(String(b.title), 'zh');
    const ka = sortKey(a), kb = sortKey(b);
    return state.sort === 'date-desc' ? String(kb).localeCompare(String(ka)) : String(ka).localeCompare(String(kb));
  });
  return list;
}

function renderArchive(main) {
  main.innerHTML = `
    <div class="toolbar">
      <label class="search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="q" type="search" placeholder="检索题名、转录原文、校勘记、来源…" value="${esc(state.q)}" aria-label="检索">
      </label>
      <select class="sortsel" id="sort" aria-label="排序">
        <option value="date-asc" ${state.sort === 'date-asc' ? 'selected' : ''}>按年代 · 从早到晚</option>
        <option value="date-desc" ${state.sort === 'date-desc' ? 'selected' : ''}>按年代 · 从晚到早</option>
        <option value="title" ${state.sort === 'title' ? 'selected' : ''}>按题名</option>
      </select>
    </div>
    <div class="result-line" id="resultLine"></div>
    <div class="grid" id="grid"></div>`;
  main.querySelector('#q').addEventListener('input', (e) => { state.q = e.target.value; renderGrid(); });
  main.querySelector('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
  renderGrid();
}

function renderGrid() {
  const list = filtered();
  const grid = app.querySelector('#grid');
  app.querySelector('#resultLine').textContent =
    `${CAT_LABEL[state.cat]} · ${list.length} 条${state.q.trim() ? ` · 检索“${state.q.trim()}”` : ''}`;
  if (!list.length) {
    grid.innerHTML = `<div class="empty"><div class="big">未检得匹配记录</div><div>换个关键词试试，或清除检索条件</div></div>`;
    return;
  }
  grid.innerHTML = list.map((it) => {
    const th = thumbOf(it);
    return `
    <button class="card" data-id="${esc(it.id)}">
      <span class="seal">${it.private ? '私' : (CAT_SEAL[it.cat] || '档')}</span>
      <span class="thumb">${th
        ? `<img loading="lazy" src="${fsUrl(th.path)}" alt="${esc(it.title)}" onerror="this.parentNode.innerHTML='<span class=ph>影像读取失败</span>'">`
        : `<span class="ph">${esc(it.title)}</span>`}</span>
      <span class="meta">
        <span class="ttl">${esc(it.title)}</span>
        <span class="row">${it.paper ? `<span>${esc(it.paper)}</span>` : ''}${it.date ? `<span>${esc(it.date)}</span>` : ''}${it.page ? `<span>${esc(it.page)}</span>` : ''}${it.author ? `<span>${esc(it.author)}</span>` : ''}</span>
      </span>
    </button>`;
  }).join('');
  grid.querySelectorAll('.card').forEach((c) =>
    c.addEventListener('click', () => { state.openId = c.dataset.id; state.detailImg = 0; renderDetail(); }));
}

/* ---------- 详情覆盖层 ---------- */
function renderDetail() {
  const it = DATA.find((d) => d.id === state.openId);
  if (!it) return;
  const images = [
    ...(it.files || []).filter((f) => f.kind === 'image'),
    ...(it.crops || []),
  ];
  const cur = images[Math.min(state.detailImg, Math.max(images.length - 1, 0))];

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
  <div class="panel" role="dialog" aria-modal="true" aria-label="${esc(it.title)}">
    <div class="panel-head">
      <div style="flex:1;min-width:0">
        <h2>${esc(it.title)}</h2>
        <div class="facts">
          ${it.paper ? `<span>报名：${esc(it.paper)}</span>` : ''}
          ${it.date ? `<span>日期：${esc(it.date)}</span>` : ''}
          ${it.page ? `<span>版次：${esc(it.page)}</span>` : ''}
          ${it.author ? `<span>${it.cat === 'archive' ? '责任者' : '作者'}：${esc(it.author)}</span>` : ''}
          ${it.group ? `<span>组别：${esc(it.group)}</span>` : ''}
          ${it.archiveId ? `<span>档号：${esc(it.archiveId)}</span>` : ''}
          ${it.status ? `<span>原件状态：${esc(it.status)}</span>` : ''}
          <span>类别：${CAT_LABEL[it.cat] || it.cat}</span>
          ${it.private ? `<span style="color:var(--cinnabar-deep)">本机私有 · 未公开</span>` : ''}
        </div>
      </div>
    </div>
    <div class="panel-body">
      <div class="viewer">
        <div class="stage">
          ${cur
            ? `<img src="${fsUrl(cur.path)}" alt="${esc(cur.label)}" title="点击放大" onerror="this.parentNode.innerHTML='<div class=noimg>影像读取失败</div>'">`
            : `<div class="noimg">本条目无图像文件${(it.files || []).length ? '，请从右侧文件清单打开' : ''}</div>`}
        </div>
        ${images.length > 1 ? `<div class="thumbs">
          ${images.map((f, i) => `
            <button data-img="${i}" class="${i === state.detailImg ? 'active' : ''}" title="${esc(f.label)}">
              <img loading="lazy" src="${fsUrl(f.path)}" alt="" onerror="this.closest('button').style.display='none'">
            </button>`).join('')}
        </div>` : ''}
      </div>
      <div class="dossier">
        ${it.transcription ? `<section><h3>原文转录</h3><div class="transcript">${esc(it.transcription)}</div></section>` : ''}
        ${it.summary ? `<section><h3>说明</h3><p style="font-size:14.5px">${esc(it.summary)}</p></section>` : ''}
        ${it.source ? `<section><h3>来源</h3><p style="font-size:14.5px">${esc(it.source)}</p></section>` : ''}
        ${(it.notes || []).length ? `<section><h3>${it.cat === 'archive' ? '档案注记' : '校勘记'}（${it.notes.length} 条）</h3>
          <ul class="notes">${it.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}
        ${(it.files || []).length ? `<section><h3>文件</h3><div class="filelinks">
          ${it.files.map((f) => `<a href="${fsUrl(f.path)}" target="_blank" rel="noopener">
            <span>${esc(f.label)}</span><span class="kind">${esc(f.path.split('/').pop())}</span></a>`).join('')}
        </div></section>` : ''}
        ${(it.tags || []).length ? `<section><h3>标签</h3><div class="tagrow">${it.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></section>` : ''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);

  const close = () => { ov.remove(); state.openId = null; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelectorAll('.thumbs button').forEach((b) =>
    b.addEventListener('click', () => { state.detailImg = +b.dataset.img; ov.remove(); renderDetail(); }));
  const stageImg = ov.querySelector('.stage img');
  if (stageImg) stageImg.addEventListener('click', () => openLightbox(fsUrl(cur.path), it.title));
}

/* ---------- 灯箱 ---------- */
function openLightbox(src, caption) {
  if (state.lightbox) state.lightbox.remove();
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <div class="lb-tools">
      <button data-z="in" aria-label="放大">＋</button>
      <button data-z="out" aria-label="缩小">－</button>
      <button data-z="reset" aria-label="复位">1:1</button>
      <button data-z="close" aria-label="关闭">✕</button>
    </div>
    <img src="${src}" alt="${esc(caption || '')}">
    <div class="lb-hint">滚轮缩放 · 拖拽平移 · 双击复位 · Esc 关闭</div>`;
  document.body.appendChild(lb);
  state.lightbox = lb;

  const img = lb.querySelector('img');
  let scale = 1, tx = 0, ty = 0;
  const fit = () => {
    const r = Math.min(innerWidth / img.naturalWidth, innerHeight / img.naturalHeight, 1) * 0.92;
    scale = r || 1; tx = 0; ty = 0; apply();
  };
  const apply = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; };
  if (img.complete && img.naturalWidth) fit(); else img.addEventListener('load', fit);

  lb.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    scale = Math.min(Math.max(scale * k, 0.05), 12);
    apply();
  }, { passive: false });

  let drag = null;
  img.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX - tx, y: e.clientY - ty };
    img.classList.add('dragging');
    img.setPointerCapture(e.pointerId);
  });
  img.addEventListener('pointermove', (e) => {
    if (!drag) return;
    tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply();
  });
  img.addEventListener('pointerup', () => { drag = null; img.classList.remove('dragging'); });
  img.addEventListener('dblclick', fit);

  const closeLb = () => { lb.remove(); state.lightbox = null; };
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  lb.querySelectorAll('.lb-tools button').forEach((b) => b.addEventListener('click', () => {
    const z = b.dataset.z;
    if (z === 'close') closeLb();
    else if (z === 'reset') fit();
    else { scale = Math.min(Math.max(scale * (z === 'in' ? 1.4 : 1 / 1.4), 0.05), 12); apply(); }
  }));
}

/* ---------- 关系图谱 ---------- */
function renderGraph(main) {
  main.innerHTML = `
  <div class="graph-wrap">
    <div class="graph-bar">
      <label class="search" style="max-width:300px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="gq" type="search" placeholder="定位节点：人名 / 机构 / 条目号…" aria-label="定位节点">
      </label>
      <div class="legend" id="legend">
        ${Object.entries(GRAPH_TYPES).map(([k, t]) => `
          <button class="lg on" data-t="${k}" aria-pressed="true"><i style="background:${GRAPH_TYPES[k].color}"></i>${GRAPH_TYPES[k].label}</button>`).join('')}
      </div>
    </div>
    <div class="graph-stage" id="gstage">
      <svg id="gsvg" role="img" aria-label="鼓楼资料关系图谱"></svg>
      <div class="g-info" id="ginfo" hidden></div>
      <div class="g-hint">拖拽节点 · 滚轮缩放 · 空白处拖动平移 · 点击节点看详情</div>
    </div>
  </div>`;
  initGraph();

  main.querySelector('#gq').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const hit = q && GRAPH.nodes.find((n) =>
      n.label.toLowerCase().includes(q) || n.name.toLowerCase().includes(q));
    if (hit) selectNode(hit.id, true);
    else if (!q) selectNode(null);
  });
  main.querySelectorAll('#legend .lg').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.t;
    if (state.graphTypes.has(t)) state.graphTypes.delete(t); else state.graphTypes.add(t);
    b.classList.toggle('on', state.graphTypes.has(t));
    b.setAttribute('aria-pressed', state.graphTypes.has(t));
    applyTypeFilter();
  }));
}

let G = null; // 图谱运行时

function initGraph() {
  const svg = document.getElementById('gsvg');
  const stage = document.getElementById('gstage');
  const W = () => stage.clientWidth, H = () => stage.clientHeight;
  const cx = () => W() / 2, cy = () => H() / 2;

  const nodes = GRAPH.nodes.map((n, i) => ({
    ...n, x: cx() + Math.cos(i) * 220, y: cy() + Math.sin(i) * 220, vx: 0, vy: 0,
  }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = GRAPH.edges.map((e) => ({ ...e, S: byId[e.s], T: byId[e.t] }));
  const adj = {};
  edges.forEach((e) => { (adj[e.s] = adj[e.s] || new Set()).add(e.t); (adj[e.t] = adj[e.t] || new Set()).add(e.s); });

  svg.innerHTML = `<g class="vp"><g class="elines"></g><g class="elabels"></g><g class="enodes"></g></g>`;
  const vp = svg.querySelector('.vp');
  const glines = svg.querySelector('.elines');
  const glabels = svg.querySelector('.elabels');
  const gnodes = svg.querySelector('.enodes');

  const NS = 'http://www.w3.org/2000/svg';
  edges.forEach((e) => {
    e.el = document.createElementNS(NS, 'line');
    glines.appendChild(e.el);
    e.tx = document.createElementNS(NS, 'text');
    e.tx.setAttribute('class', 'e-label');
    e.tx.textContent = e.label;
    glabels.appendChild(e.tx);
  });
  nodes.forEach((n) => {
    n.el = document.createElementNS(NS, 'g');
    n.el.setAttribute('class', 'g-node t-' + n.type);
    n.el.setAttribute('tabindex', '0');
    n.el.setAttribute('role', 'button');
    n.el.setAttribute('aria-label', n.name);
    const r = n.hub ? 20 : n.type === 'doc' ? 7 : 12;
    n.r = r;
    n.el.innerHTML = `<circle r="${r}"></circle><text y="${r + 13}">${esc(n.label)}</text>`;
    gnodes.appendChild(n.el);
  });

  // 力导布局
  function tick() {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 1;
        const f = 2600 / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    edges.forEach((e) => {
      const rest = (e.S.type === 'doc' || e.T.type === 'doc') ? 70 : 120;
      let dx = e.T.x - e.S.x, dy = e.T.y - e.S.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - rest) * 0.02;
      dx /= d; dy /= d;
      e.S.vx += dx * f; e.S.vy += dy * f;
      e.T.vx -= dx * f; e.T.vy -= dy * f;
    });
    nodes.forEach((n) => {
      n.vx += (cx() - n.x) * 0.004; n.vy += (cy() - n.y) * 0.004;
      n.vx *= 0.82; n.vy *= 0.82;
      if (!n.fixed) { n.x += n.vx; n.y += n.vy; }
    });
  }
  for (let i = 0; i < 160; i++) tick(); // 预迭代，避免开场炸开

  let k = 1, tx = 0, ty = 0;
  const applyVP = () => vp.setAttribute('transform', `translate(${tx},${ty}) scale(${k})`);

  function paint() {
    nodes.forEach((n) => n.el.setAttribute('transform', `translate(${n.x},${n.y})`));
    edges.forEach((e) => {
      e.el.setAttribute('x1', e.S.x); e.el.setAttribute('y1', e.S.y);
      e.el.setAttribute('x2', e.T.x); e.el.setAttribute('y2', e.T.y);
      e.tx.setAttribute('x', (e.S.x + e.T.x) / 2);
      e.tx.setAttribute('y', (e.S.y + e.T.y) / 2 - 3);
    });
  }
  paint(); applyVP();

  let raf = null, live = true;
  const loop = () => { tick(); paint(); if (live) raf = requestAnimationFrame(loop); };
  loop();
  G = { nodes, edges, byId, adj, select: null, stop: () => { live = false; cancelAnimationFrame(raf); } };

  // 交互
  const toGraph = (ev) => {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(vp.getCTM().inverse());
  };
  let panning = null;
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.g-node')) return;
    panning = { x: ev.clientX - tx, y: ev.clientY - ty };
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener('pointermove', (ev) => {
    if (panning) { tx = ev.clientX - panning.x; ty = ev.clientY - panning.y; applyVP(); }
  });
  svg.addEventListener('pointerup', () => { panning = null; });
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const nk = Math.min(Math.max(k * (ev.deltaY < 0 ? 1.12 : 1 / 1.12), 0.3), 4);
    const mx = ev.offsetX, my = ev.offsetY;
    tx = mx - (mx - tx) * (nk / k); ty = my - (my - ty) * (nk / k);
    k = nk; applyVP();
  }, { passive: false });

  nodes.forEach((n) => {
    let drag = null, moved = false;
    n.el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      drag = toGraph(ev); moved = false;
      n.fixed = true;
      n.el.setPointerCapture(ev.pointerId);
    });
    n.el.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const p = toGraph(ev);
      if (Math.hypot(p.x - drag.x, p.y - drag.y) > 3) moved = true;
      n.x = p.x; n.y = p.y; n.vx = n.vy = 0;
    });
    n.el.addEventListener('pointerup', () => {
      drag = null; n.fixed = false;
      if (!moved) selectNode(state.graphSel === n.id ? null : n.id);
    });
    n.el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectNode(state.graphSel === n.id ? null : n.id); }
    });
  });
}

function applyTypeFilter() {
  if (!G) return;
  G.nodes.forEach((n) => {
    const on = state.graphTypes.has(n.type);
    n.el.style.display = on ? '' : 'none';
  });
  G.edges.forEach((e) => {
    e.el.style.display = (state.graphTypes.has(e.S.type) && state.graphTypes.has(e.T.type)) ? '' : 'none';
    e.tx.style.display = e.el.style.display;
  });
}

function selectNode(id, panTo) {
  state.graphSel = id;
  const info = document.getElementById('ginfo');
  if (!G) return;
  G.nodes.forEach((n) => n.el.classList.toggle('sel', n.id === id));
  // 高亮邻接
  const nb = id ? G.adj[id] || new Set() : null;
  G.nodes.forEach((n) => n.el.classList.toggle('dim', !!(id && n.id !== id && !nb.has(n.id))));
  G.edges.forEach((e) => {
    const hot = id && (e.s === id || e.t === id);
    e.el.classList.toggle('hot', !!hot);
    e.el.classList.toggle('dim', !!(id && !hot));
    e.tx.classList.toggle('hot', !!hot);
    e.tx.classList.toggle('dim', !!(id && !hot));
  });
  if (!id) { info.hidden = true; return; }

  const n = G.byId[id];
  const rel = G.edges.filter((e) => e.s === id || e.t === id);
  info.hidden = false;
  info.innerHTML = `
    <div class="gi-head">
      <span class="gi-type" style="background:${GRAPH_TYPES[n.type].color}">${GRAPH_TYPES[n.type].label}</span>
      <button class="xbtn" data-gclose aria-label="关闭">✕</button>
    </div>
    <h3>${esc(n.name)}</h3>
    <p>${esc(n.desc)}</p>
    ${rel.length ? `<div class="gi-rel"><h4>关联（${rel.length}）</h4><ul>
      ${rel.map((e) => {
        const other = e.s === id ? e.T : e.S;
        return `<li><button data-goto="${other.id}">${esc(other.label)}</button><span>${esc(e.label)}</span></li>`;
      }).join('')}</ul></div>` : ''}
    ${n.ref ? `<button class="gi-open" data-arch="${esc(n.ref)}">在资料库中查看档案 →</button>` : ''}
    ${n.refCat ? `<button class="gi-open" data-catjump="${esc(n.refCat)}">浏览该类别全部档案 →</button>` : ''}`;
  info.querySelector('[data-gclose]').addEventListener('click', () => selectNode(null));
  info.querySelectorAll('[data-goto]').forEach((b) =>
    b.addEventListener('click', () => selectNode(b.dataset.goto, true)));
  const archBtn = info.querySelector('[data-arch]');
  if (archBtn) archBtn.addEventListener('click', () => { location.hash = '#/archive/' + archBtn.dataset.arch; });
  const catBtn = info.querySelector('[data-catjump]');
  if (catBtn) catBtn.addEventListener('click', () => {
    state.cat = catBtn.dataset.catjump; location.hash = '#/archive';
  });
}

/* ---------- 事件时间轴 ---------- */
function renderTimeline(main) {
  main.innerHTML = `
  <div class="tl-wrap">
    <header class="tl-head">
      <h2>鼓楼重修事件时间轴</h2>
      <p>以 13 份原版面报纸为主，并纳入档案目录线索；每个节点标注证据等级。点击条目号可跳回档案原文、目录或版面影像。</p>
      <div class="tl-legend">
        ${Object.entries(LEVEL_COLORS).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join('')}
      </div>
    </header>
    <ol class="tl">
      ${TIMELINE.map((ev) => `
      <li class="tl-item">
        <div class="tl-dot" style="border-color:${LEVEL_COLORS[ev.level]}"><i style="background:${LEVEL_COLORS[ev.level]}"></i></div>
        <div class="tl-card">
          <div class="tl-meta">
            <span class="tl-date">${esc(ev.date)}</span>
            <span class="tl-level" style="color:${LEVEL_COLORS[ev.level]};border-color:${LEVEL_COLORS[ev.level]}">${esc(ev.level)}${ev.levelNote ? ' · ' + esc(ev.levelNote) : ''}</span>
          </div>
          <h3>${esc(ev.title)}</h3>
          <p>${esc(ev.desc)}</p>
          ${ev.links.length ? `<div class="tl-links">${ev.links.map(([id, label]) => `
            <button data-arch="${esc(id)}">${esc(label)} →</button>`).join('')}</div>` : ''}
        </div>
      </li>`).join('')}
    </ol>
    <div class="tl-gap">
      <h3>尚待查证（不得先行断言）</h3>
      <ul>
        <li>1921 年 11 月至 1922 年 2 月各报“落成／竣工／報竣／驗收”报道：未补检前，不能断言“无总结性报道”。</li>
        <li>决算与付款凭证：现无任何凭据，行文只准称“工程报价八千余元”。</li>
        <li>1921 年重建设计图纸本体：查档方向为直隶省公署档（河北省档案馆）与天津警察厅档（天津市档案馆）。</li>
      </ul>
    </div>
  </div>`;
  main.querySelectorAll('[data-arch]').forEach((b) =>
    b.addEventListener('click', () => { location.hash = '#/archive/' + b.dataset.arch; }));
}

/* ---------- 全局键盘 ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.lightbox) { state.lightbox.remove(); state.lightbox = null; return; }
    const ov = document.querySelector('.overlay');
    if (ov) { ov.remove(); state.openId = null; return; }
    if (state.graphSel) selectNode(null);
  }
});

route();
