/* WJSIM — app shell */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ed = IOTF.editor, sim = IOTF.sim, iot = IOTF.iot, blocks = IOTF.blocks;
  const host = window.iotfHost || null;
  const VERSION = '1.3.1';
  const app = { path: null, isDirty: false, cm: null };
  IOTF.app = app;
  app.pageTitle = document.title;

  /* ---------- project model ---------- */
  function newProject(mode = 'basic', boardKey = 'esp32') {
    return { app: 'WJSIM', version: 1, name: 'ไม่มีชื่อ', mode, parts: [], wires: [], blocks: null, code: '', codeManual: false, programs: {}, widgets: [], sdFiles: {} };
  }
  function boardPart(boardKey) { return { id: 'board', type: IOTF.BOARDS[boardKey].tag, x: 40, y: 40, rot: 0, attrs: {}, sim: {} }; }

  function openProject(p, opts = {}) {
    sim.stop(true);
    if (!p.parts.some((q) => IOTF.PARTS[q.type] && IOTF.PARTS[q.type].kind === 'board')) p.parts.unshift(boardPart('esp32'));
    p.widgets = p.widgets || []; p.sdFiles = p.sdFiles || {};
    ed.load(p);
    // one program per board; older files kept a single program at the top level
    if (!p.programs) p.programs = {};
    const first = ed.board();
    if (first && !p.programs[first.id]) p.programs[first.id] = { blocks: p.blocks || null, code: p.code || '', codeManual: !!p.codeManual };
    app.curBoard = null;
    iot.reset();
    showProgram();
    $('wireStyle').value = p.wireStyle || 'ortho';
    selectRightTab(p.mode === 'advanced' && (p.codeManual || blocks.isEmpty()) ? 'code' : 'blocks');
    renderChecks();
    $('serialOut').textContent = ''; $('sdOut').textContent = 'ยังไม่มีไฟล์';
    app.path = opts.path || null; app.isDirty = !!opts.dirty; updateTitle();
    if (IOTF.projects) IOTF.projects.hide();
    if (app.cm) setTimeout(writeAutosave, 0);
  }

  /* ---------- one program per board ---------- */
  const prog = (id) => ed.project.programs[id] || (ed.project.programs[id] = { blocks: null, code: '', codeManual: false });
  function stashActive() {
    if (!app.curBoard || !ed.part(app.curBoard) || !app.cm) return;
    const pr = prog(app.curBoard);
    pr.blocks = blocks.save(); pr.code = app.cm.getValue(); pr.codeManual = !!ed.project.codeManual;
  }
  function showProgram() {
    const b = ed.board(); if (!b) return;
    if (app.curBoard === b.id) { syncModeUI(); renderBoardSwitch(); return; }
    stashActive();
    app.curBoard = b.id;
    const pr = prog(b.id);
    blocks.load(pr.blocks); blocks.refreshPins();
    ed.project.blocks = pr.blocks;
    if (pr.codeManual && pr.code) setCode(pr.code, true); else regen();
    syncModeUI(); renderBoardSwitch();
  }
  function renderBoardSwitch() {
    const box = $('boardSwitch'), bs = ed.boards();
    box.hidden = bs.length < 2;
    if (bs.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '<span class="muted small">โค้ดของ</span>' + bs.map((b) => `<button class="chip ${b === ed.board() ? 'on' : ''}" data-id="${b.id}">${ed.boardName(b).replace(/[&<>"]/g, '')}</button>`).join('');
    box.querySelectorAll('button').forEach((x) => x.onclick = () => ed.setActiveBoard(x.dataset.id));
  }
  // C++ for every board, for running them together
  function programsForRun() {
    stashActive();
    const cur = ed.board();
    return ed.boards().map((b) => {
      if (b === cur) return { board: b, code: ed.project.codeManual ? app.cm.getValue() : blocks.code() };
      const pr = prog(b.id);
      if (pr.codeManual && pr.code) return { board: b, code: pr.code };
      const keep = ed.project.activeBoard;
      ed.project.activeBoard = b.id;
      try { return { board: b, code: blocks.codeFor(pr.blocks) }; } finally { ed.project.activeBoard = keep; }
    });
  }

  /* ---------- code editor ---------- */
  let settingCode = false;
  function setCode(text, manual) {
    settingCode = true; app.cm.setValue(text); settingCode = false;
    ed.project.code = text; ed.project.codeManual = !!manual;
    clearErrMarks(); updateCodeSource();
  }
  function regen() {
    const code = blocks.code();
    setCode(code, false);
  }
  function updateCodeSource() {
    $('codeSource').textContent = ed.project.codeManual ? 'แก้ไขเอง — Block จะไม่เขียนทับโค้ดนี้' : 'สร้างจาก Block อัตโนมัติ (พิมพ์แก้ได้เลย)';
    $('btnRegen').hidden = !ed.project.codeManual;
  }
  let errMark = null;
  function clearErrMarks() { if (errMark !== null) { app.cm.removeLineClass(errMark, 'background', 'cm-errline'); errMark = null; } }
  app.markError = function (line, boardId) {
    if (boardId && ed.part(boardId) && boardId !== app.curBoard) ed.setActiveBoard(boardId);
    clearErrMarks();
    const ln = Math.max(0, Math.min(app.cm.lineCount() - 1, line - 1));
    errMark = app.cm.addLineClass(ln, 'background', 'cm-errline');
    selectRightTab('code');
    app.cm.scrollIntoView({ line: ln, ch: 0 }, 80);
  };

  /* ---------- UI sync ---------- */
  function syncModeUI() {
    const basic = ed.isBasic();
    document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === ed.project.mode));
    const sel = $('boardSelect'), cur = ed.board() ? IOTF.PARTS[ed.board().type].board : 'esp32';
    sel.innerHTML = Object.entries(IOTF.BOARDS).filter(([k, b]) => !basic || b.level === 'basic' || k === cur).map(([k, b]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${b.name}</option>`).join('');
    $('btnAutoPower').hidden = basic;
    ed.renderPalette(); ed.hint();
  }
  function renderChecks() {
    const list = ed.check();
    const errs = list.filter((c) => c.lvl === 'err').length, warns = list.filter((c) => c.lvl === 'warn').length;
    const b = $('checkBadge');
    b.hidden = !(errs || warns); b.textContent = errs || warns; b.className = 'badge' + (errs ? '' : ' warn');
    $('checkList').innerHTML = list.map((c, i) => `<div class="check ${c.lvl}" data-i="${i}"><span class="ic">${c.lvl === 'err' ? '!' : c.lvl === 'warn' ? '!' : '✓'}</span><span>${c.msg}</span></div>`).join('');
    $('checkList').querySelectorAll('.check').forEach((d) => d.onclick = () => { const c = list[+d.dataset.i]; if (c.part) ed.select(c.part); });
    document.querySelectorAll('.part.err').forEach((x) => x.classList.remove('err'));
    list.filter((c) => c.lvl === 'err' && c.part && ed.els[c.part]).forEach((c) => ed.els[c.part].wrap.classList.add('err'));
    return list;
  }
  function updateTitle() {
    const name = ed.project.name || 'ไม่มีชื่อ';
    $('projName').textContent = (app.isDirty ? '● ' : '') + name;
    // on the web keep the page's own title until the person starts a project of their own
    if (host || app.isDirty) document.title = `${app.isDirty ? '● ' : ''}${name} — WJSIM`;
    else document.title = app.pageTitle;
    if (host && host.setTitle) host.setTitle(document.title);
    try { localStorage.setItem('iotforge-autosave-dirty', app.isDirty ? '1' : ''); } catch (e) { /* storage unavailable */ }
    const sb = $('btnSave');
    if (sb) { sb.classList.toggle('dirty', app.isDirty); $('saveLabel').textContent = app.isDirty || !ed.project.dashId ? 'บันทึก' : 'บันทึกแล้ว'; }
  }
  app.updateTitle = updateTitle;
  let saveT = null;
  app.dirty = function () {
    app.isDirty = true; updateTitle();
    clearTimeout(saveT);
    saveT = setTimeout(writeAutosave, 600);
  };
  // the open project is kept in the browser so a reload or crash comes back to it
  function writeAutosave() {
    clearTimeout(saveT);
    try { localStorage.setItem('iotforge-autosave', JSON.stringify(snapshotProject())); localStorage.setItem('iotforge-autosave-dirty', app.isDirty ? '1' : ''); } catch (e) { /* storage unavailable */ }
  }
  app.writeAutosave = writeAutosave;
  function snapshotProject() {
    const p = ed.project;
    stashActive();
    p.blocks = blocks.save();
    p.code = app.cm.getValue();
    return p;
  }

  /* ---------- tabs & splitters ---------- */
  function selectRightTab(t) {
    document.querySelectorAll('#rightTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    ['blocks', 'code', 'dash', 'check'].forEach((k) => { $('pane-' + k).hidden = k !== t; });
    if (t === 'blocks') setTimeout(blocks.resize, 0);
    if (t === 'code') setTimeout(() => app.cm.refresh(), 0);
    if (t === 'dash') iot.renderWidgets();
  }
  app.selectRightTab = selectRightTab;
  function initSplitters() {
    const root = document.documentElement;
    const drag = (el, axis) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const mv = (ev) => {
        if (axis === 'x') root.style.setProperty('--rightW', Math.max(300, Math.min(window.innerWidth - 500, window.innerWidth - ev.clientX)) + 'px');
        else root.style.setProperty('--bottomH', Math.max(90, Math.min(window.innerHeight - 250, window.innerHeight - ev.clientY)) + 'px');
        blocks.resize(); app.cm.refresh();
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    drag($('splitRight'), 'x'); drag($('splitBottom'), 'y');
  }

  /* ---------- run ---------- */
  async function toggleRun() {
    if (sim.running) { sim.stop(); updateRunBtn(); return; }
    clearErrMarks();
    const checks = renderChecks();
    const errs = checks.filter((c) => c.lvl === 'err');
    if (errs.length) toast(`วงจรมีปัญหา ${errs.length} ข้อ อุปกรณ์ที่ต่อไม่ครบจะไม่ทำงาน (ดูแท็บ ตรวจวงจร)`);
    if (!ed.project.codeManual) setCode(blocks.code(), false);
    await sim.start(programsForRun());
    updateRunBtn();
  }
  function updateRunBtn() { const b = $('btnRun'); b.textContent = sim.running ? '■ หยุด' : '▶ เริ่มจำลอง'; b.classList.toggle('stop', sim.running); }
  app.restart = async () => { sim.stop(true); await toggleRun(); };
  const origStop = sim.stop;
  sim.stop = function (q) { origStop(q); updateRunBtn(); };

  /* ---------- files ---------- */
  function fileName() { return (ed.project.name || 'project').replace(/[\\/:*?"<>|]/g, '_'); }
  async function save(as) {
    const snap = Object.assign({}, snapshotProject()); delete snap.dashId;
    const data = JSON.stringify(snap, null, 1);
    if (host && host.saveProject) {
      const r = await host.saveProject(data, as ? null : app.path, fileName() + '.iotf');
      if (!r) return false;
      app.path = r.path; ed.project.name = r.name.replace(/\.iotf$/i, '');
    } else {
      const name = prompt('ชื่อไฟล์โปรเจกต์', fileName()); if (!name) return false;
      ed.project.name = name; snap.name = name; download(name + '.iotf', JSON.stringify(snap, null, 1), 'application/json');
    }
    toast('บันทึกเป็นไฟล์แล้ว');
    return true;
  }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function open() {
    if (!confirmDiscard()) return;
    if (host && host.openProject) {
      const r = await host.openProject(); if (!r) return;
      loadFromText(r.text, r.path, r.name);
    } else {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.iotf,.json';
      i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then((t) => loadFromText(t, null, f.name)); };
      i.click();
    }
  }
  function loadFromText(text, path, name) {
    try {
      const p = JSON.parse(text);
      if (!p || !Array.isArray(p.parts)) throw new Error('ไม่ใช่ไฟล์โปรเจกต์ WJSIM');
      p.name = p.name && p.name !== 'ไม่มีชื่อ' ? p.name : (name || 'project').replace(/\.(iotf|json)$/i, '');
      openProject(p, { path });
      toast('เปิด ' + p.name);
    } catch (e) { alert('เปิดไฟล์ไม่ได้: ' + e.message); }
  }
  app.loadFromText = loadFromText;
  app.snapshot = () => snapshotProject();
  app.openProject = openProject; app.newProject = newProject; app.boardPart = boardPart; app.download = download;
  async function exportIno() {
    const code = ed.project.codeManual ? app.cm.getValue() : blocks.code();
    const header = `// ${ed.project.name} — ส่งออกจาก WJSIM สำหรับบอร์ด ${ed.boardDef().name}\n`;
    if (host && host.exportIno) await host.exportIno(header + code, fileName() + '.ino');
    else download(fileName() + '.ino', header + code, 'text/plain');
  }
  function confirmDiscard() { return !app.isDirty || confirm('โปรเจกต์ปัจจุบันยังไม่ได้บันทึก ต้องการทิ้งการแก้ไขไหม?'); }
  app.confirmDiscard = confirmDiscard;
  function newProj() {
    if (!confirmDiscard()) return;
    const p = newProject(ed.project ? ed.project.mode : 'basic');
    p.parts.push(boardPart('esp32'));
    openProject(p);
  }

  /* ---------- examples / about dialogs ---------- */
  app.showExamples = () => showExamples();
  function showExamples() {
    const m = $('modal'), dlg = $('dialog');
    const card = (t) => `<div class="tcard" data-id="${t.id}"><b>${t.title}</b><span class="muted small">${t.desc}</span><div class="small" style="margin-top:6px;color:#e87d0d">${IOTF.BOARDS[t.board].name}</div></div>`;
    dlg.innerHTML = `<h2>ตัวอย่างโปรเจกต์</h2><p class="muted small">เลือกแล้วเปิดได้ทันที กด ▶ เริ่มจำลอง เพื่อดูผล</p>
      <h4>Basic — ต่อง่าย เขียนด้วย Block</h4><div class="grid">${IOTF.TEMPLATES.filter((t) => t.mode === 'basic').map(card).join('')}</div>
      <h4>Advanced — ต่อวงจรเองครบ เขียน C++</h4><div class="grid">${IOTF.TEMPLATES.filter((t) => t.mode === 'advanced').map(card).join('')}</div>
      <div class="foot"><button class="btn" id="exClose">ปิด</button></div>`;
    m.hidden = false;
    $('exClose').onclick = () => { m.hidden = true; };
    dlg.querySelectorAll('.tcard').forEach((c) => c.onclick = () => { if (!confirmDiscard()) return; m.hidden = true; loadTemplate(c.dataset.id); });
  }
  function loadTemplate(id) {
    const t = IOTF.TEMPLATES.find((x) => x.id === id); if (!t) return;
    const p = newProject(t.mode, t.board);
    p.name = t.title;
    p.parts.push(boardPart(t.board));
    (t.boards || []).forEach((x) => p.parts.push({ id: x.id, type: IOTF.BOARDS[x.board].tag, x: x.x, y: x.y, rot: 0, attrs: {}, sim: {}, name: x.name }));
    if (t.boards) p.parts[0].name = t.boardName || (t.board === 'esp32' ? 'ESP32' : IOTF.BOARDS[t.board].name) + ' #1';
    t.parts.forEach((q) => p.parts.push({ id: q.id, type: q.type, x: q.x, y: q.y, rot: q.rot || 0, attrs: Object.assign({}, IOTF.PARTS[q.type].attrs, q.attrs || {}), sim: Object.fromEntries(Object.entries(IOTF.PARTS[q.type].sim).map(([k, v]) => [k, (q.sim || {})[k] ?? v[0]])) }));
    const colors = ['#4aa3ff', '#3ddc84', '#ffb020', '#c084fc', '#f472b6', '#22d3ee', '#a3e635', '#fb923c'];
    p.wires = t.wires.map(([a, ap, bp], i) => ({ id: 'w' + i, a: { p: a, pin: ap }, b: { p: t.wires[i][3] || 'board', pin: bp }, color: colors[i % colors.length], auto: t.mode === 'basic' }));
    p.blocks = t.blocks || null;
    p.code = t.code || ''; p.codeManual = !!t.code;
    p.programs = { board: { blocks: p.blocks, code: p.code, codeManual: p.codeManual } };
    (t.boards || []).forEach((x) => { p.programs[x.id] = { blocks: x.blocks || null, code: x.code || '', codeManual: !!x.code }; });
    p.activeBoard = 'board';
    p.widgets = (t.widgets || []).map((w, i) => Object.assign({ id: 'wg' + i }, w));
    openProject(p, { dirty: false });
    if (t.power) { ed.autoPower(); ed.undo = []; }
    renderChecks();
    ed.fitView();
    app.isDirty = false; updateTitle();
  }
  app.loadTemplate = loadTemplate;
  function showAbout() {
    const m = $('modal'), dlg = $('dialog');
    dlg.innerHTML = `<h2>WJSIM ${VERSION}</h2>
      <p>โปรแกรมจำลองวงจร IoT ใช้งานแบบออฟไลน์ ฟรี และเป็นโอเพนซอร์ส (MIT License)</p>
      <h4>คีย์ลัด</h4><p class="small">Ctrl/⌘+S บันทึกลงโปรเจกต์ของฉัน · Ctrl/⌘+Shift+S บันทึกเป็นไฟล์ · Ctrl/⌘+O เปิดไฟล์ · Ctrl/⌘+N ใหม่ · Ctrl/⌘+Enter เริ่ม/หยุดจำลอง · Ctrl/⌘+Z ย้อน · R หมุนชิ้นส่วน · Delete ลบ · Esc ยกเลิกการต่อสาย · ล้อเมาส์ ซูม · ลากพื้นที่ว่าง เลื่อนมุมมอง</p>
      <h4>เครดิตและสัญญาอนุญาต</h4>
      <p class="small"><b>ภาพอุปกรณ์ 50 ชิ้น</b> จาก wokwi-elements 1.9.2 © 2020 Uri Shaked — MIT License<br>
      <b>ภาพอุปกรณ์ 7 ชิ้น</b> (pH, TDS, Load Cell, RC522, NEO-6M, SX1278, Relay 4 ช่อง) วาดขึ้นใหม่สำหรับ WJSIM — MIT License<br>
      <b>Blockly</b> 13 © Google LLC — Apache License 2.0<br>
      <b>CodeMirror</b> 5 © Marijn Haverbeke and others — MIT License<br>
      <b>Electron</b> © OpenJS Foundation and Electron contributors — MIT License</p>
      <p class="small muted">ข้อความสัญญาอนุญาตฉบับเต็มอยู่ในไฟล์ LICENSE, CREDITS.md และโฟลเดอร์ vendor ของแอป · ชื่อผลิตภัณฑ์ เช่น Arduino และ ESP32 เป็นเครื่องหมายการค้าของเจ้าของแต่ละราย WJSIM ไม่มีส่วนเกี่ยวข้องกับเจ้าของเหล่านั้น</p>
      <h4>ข้อจำกัดของตัวจำลอง</h4>
      <p class="small muted">โค้ด C++ ถูกแปลงไปรันในตัวจำลอง รองรับคำสั่ง Arduino ทั่วไปและไลบรารียอดนิยม (WiFi, PubSubClient, DHT, Servo, LiquidCrystal_I2C, Adafruit SSD1306/ILI9341/NeoPixel/MPU6050, HX711, MFRC522, TinyGPSPlus, LoRa, RTClib, SD, Keypad, Stepper, IRremote) รองรับ struct, ESP-NOW, WiFiUDP, WebServer/HTTPClient ระหว่างหลายบอร์ด แต่ยังไม่รองรับ class/template ที่เขียนเอง และไม่ได้จำลองไฟฟ้าแบบละเอียด ควรทดสอบกับบอร์ดจริงก่อนใช้งานจริง</p>
      <div class="foot"><button class="btn pri" id="abClose">ปิด</button></div>`;
    m.hidden = false; $('abClose').onclick = () => { m.hidden = true; };
  }

  let toastT = null;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
  app.toast = toast;

  /* ---------- wiring up ---------- */
  function init() {
    ed.initStage(); ed.initPalette(); blocks.init(); iot.init();
    app.cm = CodeMirror($('codeHost'), { mode: 'text/x-c++src', theme: 'material-darker', lineNumbers: true, matchBrackets: true, autoCloseBrackets: true, indentUnit: 2, tabSize: 2, value: '' });
    if (IOTF.autocomplete) IOTF.autocomplete.attach(app.cm);
    app.cm.on('change', () => {
      if (settingCode) return;
      ed.project.code = app.cm.getValue(); ed.project.codeManual = true; clearErrMarks(); updateCodeSource(); app.dirty();
    });
    blocks.onChange(() => {
      if (!ed.project) return;
      if (!ed.project.codeManual) regen();
      else if (!app.warnedManual) { app.warnedManual = true; toast('โค้ด C++ ถูกแก้เองอยู่ กด "↺ ใช้โค้ดจาก Block" ถ้าต้องการให้ Block สร้างโค้ดใหม่'); }
      app.dirty();
    });
    ed.onChange((kind) => {
      if (kind === 'load') return;
      if (kind === 'board') { blocks.refreshPins(); if (!ed.project.codeManual) regen(); syncModeUI(); renderBoardSwitch(); }
      if (kind === 'active' || kind === 'board-added') { if (!sim.running || kind === 'active') showProgram(); }
      if (kind !== 'sim') renderChecks();
      app.dirty();
    });
    $('btnRegen').onclick = () => { if (confirm('แทนที่โค้ดที่แก้เองด้วยโค้ดจาก Block?')) { regen(); app.dirty(); } };

    document.querySelectorAll('#modeSeg button').forEach((b) => b.onclick = () => {
      if (sim.running || ed.project.mode === b.dataset.mode) return;
      ed.project.mode = b.dataset.mode;
      syncModeUI(); renderChecks(); ed.renderWires(); ed.renderProps();
      if (b.dataset.mode === 'advanced') {
        toast('Advanced: ต้องต่อไฟเลี้ยง/กราวด์เอง กด "⚡ ต่อไฟ/กราวด์ให้อัตโนมัติ" ในแท็บตรวจวงจรได้');
        if (renderChecks().some((c) => c.lvl === 'err')) selectRightTab('check');
      } else toast('Basic: ไฟเลี้ยงและกราวด์ต่อให้อัตโนมัติ');
      app.dirty();
    });
    $('boardSelect').onchange = (e) => {
      if (sim.running) return;
      const before = ed.project.wires.length;
      ed.setBoard(e.target.value);
      const lost = before - ed.project.wires.length;
      if (lost > 0) toast(`ลบสาย ${lost} เส้น เพราะ ${ed.boardDef().name} ไม่มีขาเดียวกัน`);
    };
    $('btnRun').onclick = toggleRun;
    const saveDash = () => IOTF.projects.save();
    $('btnNew').onclick = newProj; $('btnOpen').onclick = open; $('btnSave').onclick = saveDash;
    $('btnDash').onclick = () => IOTF.projects.show();
    IOTF.projects.init();
    if (IOTF.cloud) IOTF.cloud.init();
    $('btnExamples').onclick = showExamples; $('btnExport').onclick = exportIno; $('btnAbout').onclick = showAbout;
    $('wireStyle').onchange = (e) => ed.setWireStyle(e.target.value);
    $('btnRoute').onclick = () => { ed.autoRoute(); toast('จัดสายเรียบร้อย กด Ctrl+Z เพื่อย้อนกลับได้'); };
    $('btnClearBends').onclick = () => ed.clearBends();
    $('btnAutoPower').onclick = () => { const n = ed.autoPower(); toast(n ? `เพิ่มสายไฟ/กราวด์ ${n} เส้น` : 'ต่อไฟครบแล้ว'); renderChecks(); };
    document.querySelectorAll('#rightTabs button').forEach((b) => b.onclick = () => selectRightTab(b.dataset.tab));
    document.querySelectorAll('#bottomTabs button[data-tab]').forEach((b) => b.onclick = () => {
      document.querySelectorAll('#bottomTabs button[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
      ['serial', 'lora', 'files'].forEach((k) => { $('bpane-' + k).hidden = k !== b.dataset.tab; });
    });
    $('btnClearSerial').onclick = () => { $('serialOut').textContent = ''; $('loraOut').textContent = ''; };
    $('serialIn').onkeydown = (e) => { if (e.key !== 'Enter') return; const v = e.target.value; e.target.value = ''; sim.serialSend(v + '\n'); const s = document.createElement('span'); s.className = 'sinfo'; s.textContent = '» ' + v + '\n'; $('serialOut').appendChild(s); };
    const closeModal = () => { $('modal').hidden = true; if (app.onModalClose) { const f = app.onModalClose; app.onModalClose = null; f(); } };
    $('modal').addEventListener('pointerdown', (e) => { if (e.target === $('modal')) closeModal(); });
    initSplitters();
    window.addEventListener('resize', () => { blocks.resize(); });

    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      // letter shortcuts use the physical key, so they still work with a Thai keyboard layout (R types "พ")
      const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
      const typing = e.target.closest && (e.target.closest('input,textarea,select,.CodeMirror,.blocklyWidgetDiv,#blocklyDiv'));
      if (host && mod && ['s', 'o', 'n', 'enter', 'z', 'y', 'e'].includes(k)) return;
      if (mod && k === 's') { e.preventDefault(); if (e.shiftKey) save(true); else saveDash(); return; }
      if (mod && k === 'o') { e.preventDefault(); open(); return; }
      if (mod && k === 'n' && !e.shiftKey) { e.preventDefault(); newProj(); return; }
      if (mod && k === 'enter') { e.preventDefault(); toggleRun(); return; }
      if (typing) return;
      if (!$('dash').hidden) { if (k === 'escape' && !$('modal').hidden) closeModal(); return; } // the editor is behind the dashboard
      if (mod && k === 'z') { e.preventDefault(); ed.undoStep(e.shiftKey); return; }
      if (mod && k === 'y') { e.preventDefault(); ed.undoStep(true); return; }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); ed.deleteSel(); return; }
      if (k === 'r' && !mod) { ed.rotateSel(); return; }
      if (k === 'escape') { ed.cancelArm(); closeModal(); }
    });
    window.addEventListener('beforeunload', (e) => { if (app.isDirty && !host) { e.preventDefault(); e.returnValue = ''; } });

    window.__iotfIsDirty = () => app.isDirty;
    // undo/redo from the app menu goes to whatever has focus
    function smartUndo(redo) {
      const a = document.activeElement;
      if (a && a.closest && a.closest('.CodeMirror')) { redo ? app.cm.redo() : app.cm.undo(); return; }
      if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) { document.execCommand(redo ? 'redo' : 'undo'); return; }
      if (a && a.closest && a.closest('#blocklyDiv')) { blocks.ws.undo(!!redo); return; }
      ed.undoStep(!!redo);
    }
    if (host) {
      host.onMenu && host.onMenu((cmd) => {
        ({ new: newProj, open, save: saveDash, saveAs: () => save(true), projects: () => IOTF.projects.show(), export: exportIno, examples: showExamples, about: showAbout, run: toggleRun, undo: () => smartUndo(false), redo: () => smartUndo(true) }[cmd] || (() => { }))();
      });
      host.onOpenFile && host.onOpenFile((r) => { if (confirmDiscard()) loadFromText(r.text, r.path, r.name); });
    }

    // start: restore autosave or show the first example
    let restored = false;
    try {
      const s = localStorage.getItem('iotforge-autosave');
      if (s) { const p = JSON.parse(s); if (p && Array.isArray(p.parts)) { openProject(p, { dirty: localStorage.getItem('iotforge-autosave-dirty') === '1' }); restored = true; } }
    } catch (e) { /* ignore */ }
    if (!restored) loadTemplate('blink');
    // open on "My projects" when there is something saved
    IOTF.projects.count().then((n) => { if (n) IOTF.projects.show(); }).catch(() => { });
    if (host && host.ready) host.ready();
  }
  window.addEventListener('DOMContentLoaded', init);
})();
