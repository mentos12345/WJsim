/* WJSIM — "My projects" dashboard and the project store.
 * Projects live in this app's IndexedDB (browser or desktop app), so nothing leaves the computer.
 * The dashboard lists them with a small map of the circuit; Save puts the open project into it. */
(function () {
  'use strict';
  const IOTF = window.IOTF;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- store (IndexedDB, with an in-memory fallback) ---------- */
  const DB = 'wjsim', STORE = 'projects';
  let dbp = null, memory = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    if (!d) { memory = memory || new Map(); const r = fn(null); return r && typeof r === 'object' && 'result' in r ? r.result : r; }
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
      const r = fn(s);
      t.oncomplete = () => resolve(r && 'result' in r ? r.result : r);
      t.onerror = () => reject(t.error);
    });
  }
  const store = {
    all: () => tx('readonly', (s) => (s ? s.getAll() : { result: [...memory.values()] })),
    get: (id) => tx('readonly', (s) => (s ? s.get(id) : { result: memory.get(id) })),
    put: (rec) => tx('readwrite', (s) => (s ? s.put(rec) : memory.set(rec.id, rec))),
    del: (id) => tx('readwrite', (s) => (s ? s.delete(id) : memory.delete(id))),
  };
  const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- a small map of the circuit, drawn from the live editor ---------- */
  const CAT_COL = { 'บอร์ด': '#e87d0d', 'เซ็นเซอร์': '#4aa3ff', 'จอแสดงผล': '#3ddc84', 'ไฟและเสียง': '#ffb020', 'อินพุต': '#c084fc', 'มอเตอร์': '#f472b6', 'โมดูล': '#22d3ee' };
  function thumbnail() {
    const ed = IOTF.editor, parts = ed.project.parts;
    if (!parts.length) return '';
    const boxes = parts.map((p) => {
      const n = ed.els[p.id], w = n ? ((p.rot || 0) % 180 ? n.h : n.w) : 80, h = n ? ((p.rot || 0) % 180 ? n.w : n.h) : 60;
      return { p, x: p.x, y: p.y, w, h };
    });
    const x0 = Math.min(...boxes.map((b) => b.x)) - 20, y0 = Math.min(...boxes.map((b) => b.y)) - 20;
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + 20, y1 = Math.max(...boxes.map((b) => b.y + b.h)) + 20;
    let s = '';
    ed.project.wires.forEach((w) => {
      const a = ed.pinPos(w.a.p, w.a.pin), b = ed.pinPos(w.b.p, w.b.pin); if (!a || !b) return;
      const pts = [a].concat(w.points || []).concat([b]).map((q) => `${Math.round(q.x)},${Math.round(q.y)}`).join(' ');
      s += `<polyline points="${pts}" fill="none" stroke="${esc(w.color || '#888')}" stroke-width="3" opacity=".8"/>`;
    });
    boxes.forEach((b) => {
      const d = IOTF.PARTS[b.p.type] || {}, c = CAT_COL[d.cat] || '#888', board = d.kind === 'board';
      s = (board ? `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="#202124" stroke="${c}" stroke-width="4"/>` : '') + s;
      if (!board) s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="8" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="3"/>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
  }

  /* ---------- save / open ---------- */
  function summary(p) {
    const boards = p.parts.filter((q) => (IOTF.PARTS[q.type] || {}).kind === 'board');
    const b = boards[0] && IOTF.PARTS[boards[0].type];
    return { mode: p.mode, board: b ? b.name + (boards.length > 1 ? ` ×${boards.length}` : '') : '', parts: p.parts.length - boards.length, wires: p.wires.length };
  }
  async function saveCurrent(name) {
    const app = IOTF.app, p = app.snapshot();
    if (name) p.name = name;
    if (!p.dashId) p.dashId = newId();
    const old = await store.get(p.dashId);
    const rec = Object.assign({ id: p.dashId, createdAt: Date.now() }, old ? { createdAt: old.createdAt } : {}, summary(p), { name: p.name, updatedAt: Date.now(), thumb: thumbnail(), data: JSON.parse(JSON.stringify(p)) });
    await store.put(rec);
    return rec;
  }
  // Save button: first time asks for a name, after that saves in place
  async function save(opts = {}) {
    const app = IOTF.app, p = IOTF.editor.project;
    const known = p.dashId && await store.get(p.dashId);
    if (!known || opts.rename) {
      const name = await askName(known ? 'เปลี่ยนชื่อโปรเจกต์' : 'บันทึกโปรเจกต์', p.name && p.name !== 'ไม่มีชื่อ' ? p.name : '');
      if (!name) return false;
      p.name = name;
    }
    try { await saveCurrent(); } catch (e) { app.toast('บันทึกไม่ได้: ' + e.message); return false; }
    app.isDirty = false; app.updateTitle();
    app.toast(`บันทึก "${p.name}" ลงในโปรเจกต์ของฉันแล้ว`);
    if (!$('dash').hidden) render();
    return true;
  }
  async function openRec(id) {
    const app = IOTF.app;
    const rec = await store.get(id); if (!rec) return;
    if (!app.confirmDiscard()) return;
    const p = JSON.parse(JSON.stringify(rec.data)); p.dashId = rec.id; p.name = rec.name;
    app.openProject(p, { dirty: false });
    hide();
    app.toast('เปิด ' + rec.name);
  }

  /* ---------- small in-page dialogs (prompt/confirm are not available everywhere) ---------- */
  function askName(title, value) {
    return new Promise((resolve) => {
      const m = $('modal'), dlg = $('dialog');
      dlg.innerHTML = `<h2>${esc(title)}</h2><p class="muted small">ตั้งชื่อให้จำได้ง่าย เช่น "สวนรดน้ำอัตโนมัติ"</p>
        <input id="nameIn" class="namein" maxlength="80" value="${esc(value)}" placeholder="ชื่อโปรเจกต์">
        <div class="foot"><button class="btn" id="nameCancel">ยกเลิก</button><button class="btn primary" id="nameOk">บันทึก</button></div>`;
      m.hidden = false;
      const inp = $('nameIn'); inp.focus(); inp.select();
      const done = (v) => { m.hidden = true; resolve(v); };
      $('nameOk').onclick = () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } done(v); };
      $('nameCancel').onclick = () => done(null);
      inp.onkeydown = (e) => { if (e.key === 'Enter') $('nameOk').click(); if (e.key === 'Escape') done(null); };
    });
  }

  /* ---------- dashboard ---------- */
  let sort = 'recent', query = '';
  function ago(t) {
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return Math.floor(s / 60) + ' นาทีที่แล้ว';
    if (s < 86400) return Math.floor(s / 3600) + ' ชั่วโมงที่แล้ว';
    if (s < 172800) return 'เมื่อวาน';
    return new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  async function render() {
    let list = [];
    try { list = await store.all(); } catch (e) { list = []; }
    const total = list.length;
    if (query) list = list.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()) || (r.board || '').toLowerCase().includes(query.toLowerCase()));
    list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'th') : (a, b) => b.updatedAt - a.updatedAt);
    const cur = IOTF.editor.project, curId = cur && cur.dashId;
    $('dashCount').textContent = total ? `${total} โปรเจกต์` : '';
    $('dashBack').hidden = !(cur && cur.parts && cur.parts.length);
    $('dashBack').textContent = cur && IOTF.app.isDirty ? `กลับไปที่ "${cur.name}" (ยังไม่ได้บันทึก)` : `กลับไปที่ "${cur ? cur.name : ''}"`;
    const grid = $('dashGrid');
    if (!total) {
      grid.innerHTML = `<div class="dempty"><b>ยังไม่มีโปรเจกต์ที่บันทึกไว้</b><p class="muted">สร้างโปรเจกต์ใหม่ หรือเปิดตัวอย่าง แล้วกด "บันทึก" ที่แถบด้านบน โปรเจกต์จะมาอยู่ที่หน้านี้</p></div>`;
      return;
    }
    if (!list.length) { grid.innerHTML = `<div class="dempty"><p class="muted">ไม่พบโปรเจกต์ที่ตรงกับ "${esc(query)}"</p></div>`; return; }
    grid.innerHTML = list.map((r) => `<article class="pcard ${r.id === curId ? 'cur' : ''}" data-id="${r.id}" tabindex="0">
      <div class="pthumb">${r.thumb || ''}${r.id === curId ? '<span class="pnow">เปิดอยู่</span>' : ''}</div>
      <div class="pbody"><div class="pname" title="${esc(r.name)}">${esc(r.name)}</div>
        <div class="pmeta"><span class="lv ${r.mode === 'advanced' ? 'a' : ''}">${r.mode === 'advanced' ? 'Advanced' : 'Basic'}</span><span>${esc(r.board)}</span><span>${r.parts} ชิ้น</span></div>
        <div class="ptime muted small">แก้ไข ${ago(r.updatedAt)}</div></div>
      <div class="pacts"><button data-act="open" class="btn primary">เปิด</button><button data-act="more" class="btn icon" title="เพิ่มเติม" aria-label="เพิ่มเติม">⋯</button></div>
      <div class="pmenu" hidden><button data-act="rename">เปลี่ยนชื่อ</button><button data-act="dup">ทำสำเนา</button><button data-act="export">ส่งออกไฟล์ .iotf</button><button data-act="del" class="danger">ลบ</button></div>
      <div class="pconfirm" hidden><span>ลบ "${esc(r.name)}" ถาวร?</span><button data-act="delyes" class="btn danger">ลบ</button><button data-act="delno" class="btn">ยกเลิก</button></div>
    </article>`).join('');
  }
  async function cardAction(card, act) {
    const id = card.dataset.id, app = IOTF.app;
    const rec = await store.get(id); if (!rec) return;
    if (act === 'open') return openRec(id);
    if (act === 'more') { const m = card.querySelector('.pmenu'); document.querySelectorAll('.pmenu').forEach((x) => { if (x !== m) x.hidden = true; }); m.hidden = !m.hidden; return; }
    card.querySelector('.pmenu').hidden = true;
    if (act === 'rename') {
      const name = await askName('เปลี่ยนชื่อโปรเจกต์', rec.name); if (!name) return;
      rec.name = name; rec.data.name = name; await store.put(rec);
      if (IOTF.editor.project.dashId === id) { IOTF.editor.project.name = name; app.updateTitle(); }
      return render();
    }
    if (act === 'dup') {
      const copy = JSON.parse(JSON.stringify(rec)); copy.id = newId(); copy.name = rec.name + ' (สำเนา)'; copy.data.name = copy.name; copy.data.dashId = copy.id; copy.createdAt = copy.updatedAt = Date.now();
      await store.put(copy); app.toast('ทำสำเนาแล้ว'); return render();
    }
    if (act === 'export') { const d = Object.assign({}, rec.data); delete d.dashId; app.download(rec.name.replace(/[\\/:*?"<>|]/g, '_') + '.iotf', JSON.stringify(d, null, 1), 'application/json'); return; }
    if (act === 'del') { card.querySelector('.pconfirm').hidden = false; return; }
    if (act === 'delno') { card.querySelector('.pconfirm').hidden = true; return; }
    if (act === 'delyes') {
      await store.del(id);
      if (IOTF.editor.project.dashId === id) delete IOTF.editor.project.dashId;
      app.toast(`ลบ "${rec.name}" แล้ว`); return render();
    }
  }
  function newFromDash(mode) {
    const app = IOTF.app;
    if (!app.confirmDiscard()) return;
    const board = $('dashBoard').value;
    const p = app.newProject(mode, board); p.parts.push(app.boardPart(board));
    app.openProject(p);
    hide();
  }
  function show() {
    const d = $('dash');
    $('dashBoard').innerHTML = Object.entries(IOTF.BOARDS).map(([k, b]) => `<option value="${k}">${b.name}${b.level === 'basic' ? '' : ' (Advanced)'}</option>`).join('');
    d.hidden = false; document.body.classList.add('dash-open');
    render();
    setTimeout(() => $('dashSearch').focus(), 30);
  }
  function hide() { $('dash').hidden = true; document.body.classList.remove('dash-open'); }

  function init() {
    const d = $('dash'); if (!d) return;
    $('dashClose').onclick = hide; $('dashBack').onclick = hide;
    $('dashNewBasic').onclick = () => newFromDash('basic');
    $('dashNewAdv').onclick = () => newFromDash('advanced');
    $('dashExamples').onclick = () => { hide(); IOTF.app.showExamples(); };
    $('dashImport').onclick = () => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.iotf,.json';
      i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(async (t) => { IOTF.app.loadFromText(t, null, f.name); hide(); }); };
      i.click();
    };
    $('dashSearch').oninput = (e) => { query = e.target.value.trim(); render(); };
    $('dashSort').onchange = (e) => { sort = e.target.value; render(); };
    $('dashGrid').addEventListener('click', (e) => {
      const card = e.target.closest('.pcard'); if (!card) return;
      const b = e.target.closest('button[data-act]');
      if (b) { e.stopPropagation(); cardAction(card, b.dataset.act); return; }
      if (e.target.closest('.pthumb')) cardAction(card, 'open');
    });
    $('dashGrid').addEventListener('keydown', (e) => { const card = e.target.closest('.pcard'); if (card && e.key === 'Enter' && e.target === card) cardAction(card, 'open'); });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.pmenu, [data-act="more"]')) document.querySelectorAll('.pmenu').forEach((x) => { x.hidden = true; }); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !d.hidden && $('modal').hidden && IOTF.editor.project.parts.length) hide(); });
  }

  IOTF.projects = { save, show, hide, init, store, count: async () => (await store.all()).length, thumbnail };
})();
