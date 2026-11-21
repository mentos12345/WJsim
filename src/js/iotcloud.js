/* WJSIM — a simulated IoT cloud in the style of Arduino Cloud.
 * The project keeps a list of cloud variables (name, type, permission) and a cloud dashboard.
 * A sketch that does `#include "thingProperties.h"` gets the variables declared for it, and
 * ArduinoCloud.update() keeps them in step with the cloud: values the board changes go up,
 * values changed on the dashboard or by another board come down and run onXxxChange().
 * Everything stays inside the app (and other app windows through the bus); nothing leaves the computer. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ed = IOTF.editor;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const C = { values: {}, ver: 0, hist: {}, conn: {} };
  IOTF.iotcloud = C;

  const TYPES = { bool: 'เปิด/ปิด (bool)', int: 'จำนวนเต็ม (int)', float: 'ทศนิยม (float)', String: 'ข้อความ (String)' };
  const PERMS = { READWRITE: 'อ่านและเขียน', READ: 'บอร์ดส่งขึ้นอย่างเดียว' };
  const WTYPES = { switch: 'สวิตช์', push: 'ปุ่มกด', slider: 'แถบเลื่อน', value: 'ค่าตัวเลข/ข้อความ', gauge: 'เกจวัด', status: 'ไฟสถานะ', chart: 'กราฟ', messenger: 'ช่องส่งข้อความ' };
  const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
  const RESERVED = new Set('int float char long double bool boolean void String byte if else for while do switch case break return true false HIGH LOW setup loop delay new class const this SSID PASS'.split(' '));
  C.TYPES = TYPES; C.PERMS = PERMS; C.WTYPES = WTYPES;
  C.validName = (n) => NAME.test(n) && !RESERVED.has(n);

  const cfg = () => { const p = ed.project || {}; if (!p.cloud) p.cloud = { vars: [], widgets: [] }; return p.cloud; };
  C.cfg = cfg;
  C.vars = () => cfg().vars;
  C.find = (name) => cfg().vars.find((v) => v.name === name);
  const cbName = (n) => 'on' + n[0].toUpperCase() + n.slice(1) + 'Change';
  C.cbName = cbName;

  C.coerce = function (type, v) {
    if (type === 'bool') return typeof v === 'string' ? /^(1|true|on|high)$/i.test(v.trim()) : !!v;
    if (type === 'int') { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : 0; }
    if (type === 'float') { const n = Number(v); return Number.isFinite(n) ? n : 0; }
    return String(v ?? '');
  };
  const show = (v, type) => (v === undefined ? '—' : type === 'bool' ? (v ? 'true' : 'false') : type === 'float' ? String(Math.round(v * 100) / 100) : String(v));

  /* ---------- the cloud store ---------- */
  // src: board id, 'dash' (this window's dashboard) or 'remote' (another window)
  C.set = function (name, value, src, label, fromBus) {
    const d = C.find(name), type = d ? d.type : typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'float' : 'String';
    const v = C.coerce(type, value);
    const cur = C.values[name];
    C.values[name] = { v, ver: ++C.ver, src, label: label || src, t: Date.now() };
    const h = C.hist[name] || (C.hist[name] = []);
    const n = type === 'bool' ? (v ? 1 : 0) : Number(v);
    if (Number.isFinite(n)) { h.push(n); if (h.length > 60) h.shift(); }
    if (!cur || cur.v !== v) log(`<span class="t">${esc(name)}</span> = ${esc(show(v, type))} <span class="d">← ${esc(label || src)}</span>`);
    if (!fromBus && IOTF.iot && IOTF.iot.busSend) IOTF.iot.busSend({ type: 'iotcloud', name, v, label: label || src });
    updateValue(name);
  };
  C.get = (name) => C.values[name];
  C.fromBus = (msg) => { if (typeof msg.name === 'string' && NAME.test(msg.name) && ['string', 'number', 'boolean'].includes(typeof msg.v)) C.set(msg.name, msg.v, 'remote', 'หน้าต่างอื่น', true); };

  /* ---------- thingProperties.h ---------- */
  const forBoard = (boardId) => cfg().vars.filter((v) => !v.board || v.board === '*' || v.board === boardId);
  const init = (t) => (t === 'bool' ? 'false' : t === 'String' ? '""' : '0');
  function headerLines(boardId, code) {
    const vs = forBoard(boardId), L = [];
    L.push('const char SSID[] = "WJSIM-WiFi";', 'const char PASS[] = "";', '');
    vs.forEach((v) => { if (v.perm !== 'READ' && new RegExp('\\b' + cbName(v.name) + '\\b').test(code || '')) L.push(`void ${cbName(v.name)}();`); });
    vs.forEach((v) => L.push(`${v.type} ${v.name} = ${init(v.type)};`));
    L.push('', 'void initProperties() {');
    vs.forEach((v) => {
      const cb = v.perm !== 'READ' && new RegExp('\\b' + cbName(v.name) + '\\b').test(code || '') ? cbName(v.name) : 'NULL';
      const policy = v.every > 0 ? `${v.every} * SECONDS` : 'ON_CHANGE';
      L.push(`  ArduinoCloud.addProperty(${v.name}, ${v.perm === 'READ' ? 'READ' : 'READWRITE'}, ${policy}, ${cb});`);
    });
    L.push('}', '', 'WiFiConnectionHandler ArduinoIoTPreferredConnection(SSID, PASS);');
    return L;
  }
  C.headerText = (boardId, code) => ['// thingProperties.h — สร้างให้อัตโนมัติจากตัวแปรในแท็บ คลาวด์ (แก้ที่แท็บนั้น)', '#include <ArduinoIoTCloud.h>', '#include <Arduino_ConnectionHandler.h>', ''].concat(headerLines(boardId, code)).join('\n');
  // swap the include line for the generated header, on that one line so error line numbers stay right
  C.expand = function (code, boardId) {
    if (!/^[ \t]*#\s*include\s*[<"]thingProperties\.h[>"]/m.test(code || '')) return code;
    const one = headerLines(boardId, code).filter((l) => l && !/^void \w+\(\);$/.test(l)).join(' '); // prototypes aren't needed here
    return code.replace(/^[ \t]*#\s*include\s*[<"]thingProperties\.h[>"].*$/m, one);
  };
  // the variables a sketch needs: add any that are missing (used by the blocks)
  C.ensure = function (uses) {
    let added = false;
    uses.forEach((type, name) => {
      if (!C.validName(name) || C.find(name)) return;
      cfg().vars.push({ name, type, perm: 'READWRITE', board: '*' }); added = true;
    });
    if (added) { render(); if (IOTF.app) IOTF.app.dirty(); }
  };

  /* ---------- boards ("things") ---------- */
  C.setConn = function (dev, state) { C.conn[dev.id] = { name: dev.name, state }; renderThings(); };
  C.onRun = function (on) { if (!on) Object.values(C.conn).forEach((c) => { c.state = 0; }); renderThings(); };

  /* ---------- panel ---------- */
  function log(html) {
    const o = $('cloudLog'); if (!o) return;
    const d = document.createElement('div'); d.innerHTML = `<span class="d">${new Date().toLocaleTimeString()}</span> ${html}`;
    o.appendChild(d); while (o.childNodes.length > 200) o.firstChild.remove();
    o.scrollTop = o.scrollHeight;
  }
  C.log = log;
  function renderThings() {
    const box = $('cloudThings'); if (!box || !ed.project) return;
    const boards = ed.boards ? ed.boards() : [];
    box.innerHTML = boards.map((b) => {
      const c = C.conn[b.id], st = c ? c.state : 0;
      const t = st === 2 ? 'ออนไลน์' : st === 1 ? 'กำลังเชื่อมต่อ…' : 'ออฟไลน์';
      return `<span class="thing s${st}" title="Thing ของ ${esc(ed.boardName(b))}"><i></i>${esc(ed.boardName(b))} · ${t}</span>`;
    }).join('') || '<span class="muted small">ยังไม่มีบอร์ด</span>';
  }
  function boardOptions(sel) {
    const opts = [['*', 'ทุกบอร์ด (ซิงก์กัน)']].concat((ed.boards ? ed.boards() : []).map((b) => [b.id, ed.boardName(b)]));
    return opts.map(([k, l]) => `<option value="${esc(k)}"${k === (sel || '*') ? ' selected' : ''}>${esc(l)}</option>`).join('');
  }
  function renderVars() {
    const box = $('cloudVars'); if (!box || !ed.project) return;
    const vs = cfg().vars;
    if (!vs.length) { box.innerHTML = '<p class="muted small">ยังไม่มีตัวแปร กด "+ ตัวแปร" แล้วใช้ชื่อนั้นในโค้ดได้เลย (ในโหมด Basic ใช้บล็อกหมวด คลาวด์ ระบบจะสร้างตัวแปรให้เอง)</p>'; return; }
    box.innerHTML = `<table class="ctable"><thead><tr><th>ชื่อ</th><th>ชนิด</th><th>สิทธิ์</th><th>บอร์ด</th><th>ค่าล่าสุด</th><th></th></tr></thead><tbody>${vs.map((v, i) => `
      <tr data-i="${i}"><td class="mono">${esc(v.name)}</td><td>${esc(v.type)}</td><td>${v.perm === 'READ' ? 'READ' : 'READ/WRITE'}${v.every > 0 ? ` · ทุก ${v.every} วิ` : ''}</td>
      <td>${esc(!v.board || v.board === '*' ? 'ทุกบอร์ด' : (ed.part(v.board) ? ed.boardName(ed.part(v.board)) : v.board))}</td>
      <td class="cval mono" data-name="${esc(v.name)}">${esc(show(C.values[v.name] && C.values[v.name].v, v.type))}</td>
      <td><button class="tb small cedit" title="แก้ไข">✎</button><button class="tb small cdel" title="ลบ">×</button></td></tr>`).join('')}</tbody></table>`;
    box.querySelectorAll('.cdel').forEach((b) => { b.onclick = () => { const i = +b.closest('tr').dataset.i, name = vs[i].name; vs.splice(i, 1); cfg().widgets = cfg().widgets.filter((w) => w.var !== name); render(); IOTF.app && IOTF.app.dirty(); }; });
    box.querySelectorAll('.cedit').forEach((b) => { b.onclick = () => openVar(vs[+b.closest('tr').dataset.i]); });
  }
  function openVar(v) {
    const m = $('modal'), dlg = $('dialog'), isNew = !v;
    v = v || { name: '', type: 'float', perm: 'READWRITE', board: '*', every: 0 };
    dlg.innerHTML = `<h2>${isNew ? 'เพิ่ม' : 'แก้ไข'}ตัวแปรคลาวด์</h2>
      <p class="muted small">ตัวแปรนี้จะถูกประกาศให้ในไฟล์ thingProperties.h ของบอร์ด ใช้ในโค้ดได้เลยเหมือน Arduino Cloud</p>
      <div class="frm">
        <label>ชื่อตัวแปร</label><input id="cvName" value="${esc(v.name)}" placeholder="เช่น temperature" spellcheck="false">
        <label>ชนิด</label><select id="cvType">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}"${k === v.type ? ' selected' : ''}>${l}</option>`).join('')}</select>
        <label>สิทธิ์</label><select id="cvPerm">${Object.entries(PERMS).map(([k, l]) => `<option value="${k}"${k === (v.perm || 'READWRITE') ? ' selected' : ''}>${k === 'READ' ? 'READ' : 'READ/WRITE'} — ${l}</option>`).join('')}</select>
        <label>ส่งค่าขึ้นเมื่อ</label><select id="cvEvery"><option value="0">ค่าเปลี่ยน (ON_CHANGE)</option>${[1, 2, 5, 10, 30, 60].map((s) => `<option value="${s}"${v.every === s ? ' selected' : ''}>ทุก ${s} วินาที</option>`).join('')}</select>
        <label>บอร์ด (Thing)</label><select id="cvBoard">${boardOptions(v.board)}</select>
      </div>
      <p class="muted small" id="cvErr" style="color:var(--bad)"></p>
      <div class="foot"><button class="btn" id="cvCancel">ยกเลิก</button><button class="btn pri" id="cvOk">${isNew ? 'เพิ่ม' : 'บันทึก'}</button></div>`;
    m.hidden = false;
    $('cvName').focus();
    $('cvCancel').onclick = () => { m.hidden = true; };
    $('cvOk').onclick = () => {
      const name = $('cvName').value.trim();
      if (!C.validName(name)) { $('cvErr').textContent = 'ชื่อต้องเป็นภาษาอังกฤษ ขึ้นต้นด้วยตัวอักษร ใช้ได้แค่ A-Z a-z 0-9 _ และไม่ซ้ำกับคำสงวนของ C++'; return; }
      if (C.find(name) && C.find(name) !== v) { $('cvErr').textContent = 'มีตัวแปรชื่อนี้แล้ว'; return; }
      const old = v.name;
      Object.assign(v, { name, type: $('cvType').value, perm: $('cvPerm').value, every: +$('cvEvery').value || 0, board: $('cvBoard').value });
      if (isNew) cfg().vars.push(v);
      else if (old !== name) cfg().widgets.forEach((w) => { if (w.var === old) w.var = name; });
      m.hidden = true; render(); IOTF.app && IOTF.app.dirty();
    };
  }

  /* ---------- cloud dashboard ---------- */
  function renderWidgets() {
    const box = $('cwidgets'); if (!box || !ed.project) return;
    const ws = cfg().widgets;
    box.innerHTML = ws.length ? '' : '<p class="muted small" style="grid-column:1/-1">ยังไม่มีวิดเจ็ต กด "+ วิดเจ็ต" แล้วผูกกับตัวแปรคลาวด์</p>';
    ws.forEach((w) => {
      const d = document.createElement('div'), v = C.find(w.var) || { type: 'float' };
      d.className = 'widget' + (w.type === 'chart' ? ' wide' : ''); d.dataset.cid = w.id;
      let inner = '';
      if (w.type === 'value') inner = '<div class="wv">—</div>';
      if (w.type === 'gauge') inner = `<svg class="gauge" width="130" height="78" viewBox="0 0 130 78"><path d="M15 70A50 50 0 0 1 115 70" stroke="#3a3a3a" stroke-width="12" fill="none" stroke-linecap="round"/><path class="arc" d="" stroke="#00979d" stroke-width="12" fill="none" stroke-linecap="round"/><text class="gv" x="65" y="66" text-anchor="middle" fill="currentColor" font-size="17" font-weight="700">—</text></svg>`;
      if (w.type === 'chart') inner = '<div class="wv" style="font-size:16px">—</div><canvas></canvas>';
      if (w.type === 'switch') inner = '<button class="wbtn">ปิด</button>';
      if (w.type === 'push') inner = '<button class="wbtn">กด</button>';
      if (w.type === 'slider') inner = `<div class="wv" style="font-size:18px">${w.min ?? 0}</div><input type="range" min="${+(w.min ?? 0)}" max="${+(w.max ?? 100)}" step="${v.type === 'float' ? 'any' : 1}" value="${+(w.min ?? 0)}">`;
      if (w.type === 'status') inner = '<div style="display:flex;align-items:center;gap:10px;margin-top:10px"><span class="lamp"></span><span class="wv" style="font-size:16px;margin:0">—</span></div>';
      if (w.type === 'messenger') inner = '<div class="cmsg log"></div><div class="pubrow"><input placeholder="ข้อความ"><button class="tb small">ส่ง</button></div>';
      d.innerHTML = `<button class="wx" title="ลบวิดเจ็ต">×</button><div class="wt">${esc(w.title || w.var)}${w.unit ? ' (' + esc(w.unit) + ')' : ''}</div><div class="wtopic">☁ ${esc(w.var)}</div>${inner}`;
      box.appendChild(d);
      d.querySelector('.wx').onclick = () => { cfg().widgets = ws.filter((x) => x !== w); renderWidgets(); IOTF.app && IOTF.app.dirty(); };
      const write = (val) => {
        if (v.perm === 'READ') { IOTF.app && IOTF.app.toast && IOTF.app.toast(`ตัวแปร ${w.var} เป็น READ บอร์ดส่งขึ้นอย่างเดียว เปลี่ยนจาก Dashboard ไม่ได้`); updateWidget(w); return; }
        C.set(w.var, val, 'dash', 'Dashboard');
      };
      if (w.type === 'switch') d.querySelector('.wbtn').onclick = () => { const cur = C.values[w.var]; write(!(cur && cur.v)); };
      if (w.type === 'push') {
        const b = d.querySelector('.wbtn');
        b.onpointerdown = () => write(v.type === 'bool' ? true : 1);
        b.onpointerup = b.onpointerleave = () => { const cur = C.values[w.var]; if (cur && cur.v && cur.src === 'dash') write(v.type === 'bool' ? false : 0); };
      }
      if (w.type === 'slider') { const r = d.querySelector('input'); r.oninput = () => { d.querySelector('.wv').textContent = r.value; }; r.onchange = () => write(Number(r.value)); }
      if (w.type === 'messenger') { const i = d.querySelector('input'), go = () => { if (i.value) { write(i.value); i.value = ''; } }; d.querySelector('button.tb').onclick = go; i.onkeydown = (e) => { if (e.key === 'Enter') go(); }; }
      updateWidget(w);
    });
  }
  function updateWidget(w) {
    const d = document.querySelector(`.widget[data-cid="${w.id}"]`); if (!d) return;
    const cur = C.values[w.var], v = C.find(w.var) || { type: 'float' };
    if (!cur) return;
    const val = cur.v, n = Number(val);
    if (w.type === 'value' || w.type === 'chart') d.querySelector('.wv').textContent = show(val, v.type) + (w.unit ? ' ' + w.unit : '');
    if (w.type === 'gauge') {
      const min = +(w.min ?? 0), max = +(w.max ?? 100), k = Math.max(0, Math.min(1, (n - min) / (max - min || 1)));
      const a = Math.PI * (1 - k), x = 65 + 50 * Math.cos(a), y = 70 - 50 * Math.sin(a);
      d.querySelector('.arc').setAttribute('d', k > 0.001 ? `M15 70A50 50 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}` : '');
      d.querySelector('.gv').textContent = show(val, v.type) + (w.unit ? ' ' + w.unit : '');
    }
    if (w.type === 'switch') { const b = d.querySelector('.wbtn'); b.classList.toggle('on', !!val); b.textContent = val ? 'เปิด' : 'ปิด'; }
    if (w.type === 'push') d.querySelector('.wbtn').classList.toggle('on', !!val);
    if (w.type === 'slider' && Number.isFinite(n)) { d.querySelector('input').value = n; d.querySelector('.wv').textContent = show(val, v.type); }
    if (w.type === 'status') { const on = !!val && val !== '0'; const l = d.querySelector('.lamp'); l.classList.toggle('on', on); d.querySelector('.wv').textContent = show(val, v.type); }
    if (w.type === 'messenger') { const o = d.querySelector('.cmsg'); const line = document.createElement('div'); line.innerHTML = `<span class="d">${esc(cur.label)}:</span> ${esc(val)}`; if (o.dataset.ver !== String(cur.ver)) { o.dataset.ver = cur.ver; o.appendChild(line); o.scrollTop = o.scrollHeight; } }
    const cv = d.querySelector('canvas');
    if (cv && IOTF.iot && IOTF.iot.drawChart) IOTF.iot.drawChart(cv, C.hist[w.var] || []);
  }
  function updateValue(name) {
    const cell = document.querySelector(`.cval[data-name="${name}"]`), v = C.find(name);
    if (cell) cell.textContent = show(C.values[name] && C.values[name].v, v ? v.type : 'String');
    cfg().widgets.forEach((w) => { if (w.var === name) updateWidget(w); });
  }
  function openWidget() {
    const vs = cfg().vars;
    if (!vs.length) { openVar(); return; }
    const m = $('modal'), dlg = $('dialog');
    dlg.innerHTML = `<h2>เพิ่มวิดเจ็ตคลาวด์</h2>
      <div class="frm">
        <label>ตัวแปร</label><select id="cwVar">${vs.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.type)})</option>`).join('')}</select>
        <label>ชนิด</label><select id="cwType">${Object.entries(WTYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
        <label>ชื่อที่แสดง</label><input id="cwTitle" placeholder="เช่น อุณหภูมิห้อง">
        <label>หน่วย</label><input id="cwUnit" placeholder="เช่น °C">
        <label>ค่าต่ำสุด / สูงสุด</label><div style="display:flex;gap:6px"><input id="cwMin" type="number" value="0"><input id="cwMax" type="number" value="100"></div>
      </div>
      <div class="foot"><button class="btn" id="cwCancel">ยกเลิก</button><button class="btn pri" id="cwOk">เพิ่ม</button></div>`;
    const suggest = () => { const v = C.find($('cwVar').value); $('cwType').value = v.type === 'bool' ? (v.perm === 'READ' ? 'status' : 'switch') : v.type === 'String' ? (v.perm === 'READ' ? 'value' : 'messenger') : v.perm === 'READ' ? 'gauge' : 'slider'; };
    $('cwVar').onchange = suggest; suggest();
    m.hidden = false;
    $('cwCancel').onclick = () => { m.hidden = true; };
    $('cwOk').onclick = () => {
      const name = $('cwVar').value;
      cfg().widgets.push({ id: 'c' + Math.random().toString(36).slice(2, 8), type: $('cwType').value, var: name, title: $('cwTitle').value.trim() || name, unit: $('cwUnit').value.trim(), min: +$('cwMin').value, max: +$('cwMax').value });
      m.hidden = true; renderWidgets(); IOTF.app && IOTF.app.dirty();
    };
  }
  function showHeader() {
    const b = ed.board(), code = IOTF.app && IOTF.app.cm ? IOTF.app.cm.getValue() : '';
    const m = $('modal'), dlg = $('dialog');
    dlg.innerHTML = `<h2>thingProperties.h · ${esc(b ? ed.boardName(b) : '')}</h2>
      <p class="muted small">ไฟล์นี้สร้างให้อัตโนมัติเหมือนใน Arduino Cloud เมื่อโค้ดมีบรรทัด <code>#include "thingProperties.h"</code> ตัวแปรด้านล่างจะใช้ได้ทันที</p>
      <pre class="log mono" style="height:auto;max-height:50vh;white-space:pre">${esc(C.headerText(b ? b.id : '', code))}</pre>
      <div class="foot"><button class="btn pri" id="chClose">ปิด</button></div>`;
    m.hidden = false; $('chClose').onclick = () => { m.hidden = true; };
  }
  // a starting sketch in the shape Arduino Cloud generates
  C.sketch = function (boardId) {
    const vs = forBoard(boardId), cbs = vs.filter((v) => v.perm !== 'READ');
    return ['/*', '  Sketch สำหรับ WJSIM IoT Cloud (รูปแบบเดียวกับ Arduino Cloud)', '  ตัวแปรคลาวด์ประกาศอยู่ใน thingProperties.h แล้ว:',
      ...vs.map((v) => `    ${v.type} ${v.name};  ${v.perm === 'READ' ? '// READ' : '// READ/WRITE'}`), '*/', '', '#include "thingProperties.h"', '',
      'void setup() {', '  Serial.begin(9600);', '  delay(1500);', '', '  initProperties();', '  ArduinoCloud.begin(ArduinoIoTPreferredConnection);', '  setDebugMessageLevel(2);', '  ArduinoCloud.printDebugInfo();', '}', '',
      'void loop() {', '  ArduinoCloud.update();', '  // เขียนโค้ดของคุณที่นี่', '}', '',
      ...cbs.flatMap((v) => ['/*', `  เรียกทุกครั้งที่ ${v.name} ถูกเปลี่ยนจากคลาวด์ (Dashboard หรือบอร์ดอื่น)`, '*/', `void ${cbName(v.name)}() {`, '  // ทำอะไรเมื่อค่าเปลี่ยน', '}', ''])].join('\n');
  };
  function insertSketch() {
    const app = IOTF.app; if (!app || !app.cm) return;
    if (ed.isBasic && ed.isBasic()) { app.toast && app.toast('โหมด Basic ใช้บล็อกหมวด คลาวด์ แทน (สลับเป็น Advanced เพื่อเขียน C++)'); return; }
    const b = ed.board(), cur = app.cm.getValue();
    if (/thingProperties\.h/.test(cur) && !confirmReplace()) return;
    app.setCode(C.sketch(b ? b.id : ''), true);
    app.selectRightTab('code');
  }
  const confirmReplace = () => !document.hidden; // the code tab keeps undo, so replacing is safe

  function render() { renderThings(); renderVars(); renderWidgets(); }
  C.render = render;
  C.reset = function () { C.values = {}; C.hist = {}; C.conn = {}; const o = $('cloudLog'); if (o) o.innerHTML = ''; render(); };
  C.init = function () {
    $('btnCloudVar').onclick = () => openVar();
    $('btnCloudWidget').onclick = openWidget;
    $('btnCloudHeader').onclick = showHeader;
    $('btnCloudSketch').onclick = insertSketch;
    render();
  };
})();
