/* Wongjorn — in-app MQTT broker, dashboard widgets, LoRa radio, and a bus between app windows */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const ed = IOTF.editor;
  const iot = { subs: [], retained: {}, hist: {}, last: {} };
  IOTF.iot = iot;
  const winId = Math.random().toString(36).slice(2, 8);

  /* ---------- bus between windows (Electron IPC or BroadcastChannel) ---------- */
  let bc = null;
  function busSend(msg) {
    msg.from = winId;
    if (window.iotfHost && window.iotfHost.busSend) window.iotfHost.busSend(msg);
    else if (bc) bc.postMessage(msg);
  }
  function busRecv(msg) {
    if (!msg || msg.from === winId) return;
    if (msg.type === 'mqtt') deliver(msg.topic, msg.payload, msg.retain, true);
    if (msg.type === 'lora') {
      loraLog(`รับ (${(msg.freq / 1e6).toFixed(0)} MHz): ${msg.text}`);
      if (IOTF.sim.running) IOTF.sim.loraReceive(msg.text);
    }
  }
  if (window.iotfHost && window.iotfHost.onBus) window.iotfHost.onBus(busRecv);
  else if ('BroadcastChannel' in window) { bc = new BroadcastChannel('iotforge-bus'); bc.onmessage = (e) => busRecv(e.data); }

  /* ---------- broker ---------- */
  function match(filter, topic) {
    const f = filter.split('/'), t = topic.split('/');
    for (let i = 0; i < f.length; i++) {
      if (f[i] === '#') return true;
      if (i >= t.length) return false;
      if (f[i] !== '+' && f[i] !== t[i]) return false;
    }
    return f.length === t.length;
  }
  iot.subscribe = function (cid, filter, cb) {
    iot.subs.push({ cid, filter, cb });
    Object.entries(iot.retained).forEach(([t, m]) => { if (match(filter, t)) cb(t, m); });
  };
  iot.unsubscribe = (cid, filter) => { iot.subs = iot.subs.filter((s) => !(s.cid === cid && s.filter === filter)); };
  iot.unsubscribeAll = (cid) => { iot.subs = iot.subs.filter((s) => s.cid !== cid); };
  function deliver(topic, payload, retain, remote) {
    if (retain) iot.retained[topic] = payload;
    log(`<span class="t">${esc(topic)}</span> ${esc(payload)}${remote ? ' <span class="d">(จากหน้าต่างอื่น)</span>' : ''}`);
    iot.last[topic] = payload;
    const h = iot.hist[topic] || (iot.hist[topic] = []);
    const n = parseFloat(payload); if (!Number.isNaN(n)) { h.push(n); if (h.length > 60) h.shift(); }
    iot.subs.slice().forEach((s) => { if (match(s.filter, topic)) { try { s.cb(topic, payload); } catch (e) { console.error(e); } } });
    updateWidgets(topic);
  }
  iot.publish = function (topic, payload, retain, from) {
    if (from && ed.isBasic() && !(ed.project.widgets || []).some((w) => w.topic === topic) && !/^\$/.test(topic)) {
      const name = topic.split('/').pop();
      addWidget({ type: 'value', title: name, topic, chart: true });
    }
    deliver(topic, payload, retain, false);
    busSend({ type: 'mqtt', topic, payload, retain });
  };

  /* ---------- log ---------- */
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function log(html, cls) {
    const box = $('mqttLog'); const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = `<span class="d">${new Date().toLocaleTimeString()}</span> ${cls ? esc(html) : html}`;
    box.appendChild(d); while (box.childNodes.length > 80) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }
  iot.log = log;
  iot.setWifi = (text, ok) => { const e = $('netStatus'); e.textContent = text; e.style.color = ok ? '#3cb371' : ''; };
  iot.onRun = (on) => {
    if (on) { iot.subs = iot.subs.filter((s) => s.cid === 'dash'); iot.setWifi('WiFi: ยังไม่เชื่อมต่อ'); }
    else { iot.subs = iot.subs.filter((s) => s.cid === 'dash'); iot.setWifi('WiFi: (หยุดจำลอง)'); }
  };

  /* ---------- LoRa ---------- */
  function loraLog(t) { const o = $('loraOut'); o.textContent += `[${new Date().toLocaleTimeString()}] ${t}\n`; o.scrollTop = o.scrollHeight; }
  iot.loraSend = function (text, freq) {
    loraLog(`ส่ง (${(freq / 1e6).toFixed(0)} MHz): ${text}`);
    busSend({ type: 'lora', text, freq });
  };

  /* ---------- dashboard widgets ---------- */
  const TYPES = { value: 'ตัวเลข/ข้อความ', gauge: 'เกจวัด', chart: 'กราฟเส้น', switch: 'สวิตช์ เปิด/ปิด', button: 'ปุ่มกด', slider: 'แถบเลื่อน', led: 'ไฟแสดงสถานะ', text: 'ช่องส่งข้อความ' };
  iot.TYPES = TYPES;
  function addWidget(w) {
    ed.project.widgets = ed.project.widgets || [];
    w.id = w.id || Math.random().toString(36).slice(2, 8);
    ed.project.widgets.push(w);
    renderWidgets();
    IOTF.app && IOTF.app.dirty();
  }
  iot.addWidget = addWidget;
  function renderWidgets() {
    const box = $('widgets'); const ws = ed.project.widgets || [];
    iot.subs = iot.subs.filter((s) => s.cid !== 'dash');
    box.innerHTML = ws.length ? '' : '<p class="muted small" style="grid-column:1/-1">ยังไม่มีวิดเจ็ต กด "+ เพิ่มวิดเจ็ต" หรือ (ในโหมด Basic) ให้บอร์ดส่งค่าแล้วระบบจะสร้างให้เอง</p>';
    ws.forEach((w) => {
      const d = document.createElement('div');
      d.className = 'widget' + (w.type === 'chart' || w.chart ? ' wide' : ''); d.dataset.id = w.id;
      let inner = '';
      if (w.type === 'value') inner = `<div class="wv">—</div>` + (w.chart ? '<canvas></canvas>' : '');
      if (w.type === 'gauge') inner = `<svg class="gauge" width="130" height="78" viewBox="0 0 130 78"><path d="M15 70A50 50 0 0 1 115 70" stroke="#3a3a3a" stroke-width="12" fill="none" stroke-linecap="round"/><path class="arc" d="" stroke="#e87d0d" stroke-width="12" fill="none" stroke-linecap="round"/><text class="gv" x="65" y="66" text-anchor="middle" fill="#e6e6e6" font-size="17" font-weight="700">—</text></svg>`;
      if (w.type === 'chart') inner = '<div class="wv" style="font-size:16px">—</div><canvas></canvas>';
      if (w.type === 'switch') inner = `<button class="wbtn">ปิด</button>`;
      if (w.type === 'button') inner = `<button class="wbtn">${esc(w.on || '1')}</button>`;
      if (w.type === 'slider') inner = `<div class="wv" style="font-size:18px">${w.min ?? 0}</div><input type="range" min="${w.min ?? 0}" max="${w.max ?? 100}" value="${w.min ?? 0}">`;
      if (w.type === 'led') inner = `<div style="display:flex;align-items:center;gap:10px;margin-top:10px"><span class="lamp" style="width:26px;height:26px;border-radius:50%;background:#3a3a3a;display:inline-block"></span><span class="wv" style="font-size:16px;margin:0">—</span></div>`;
      if (w.type === 'text') inner = `<div class="pubrow"><input placeholder="ข้อความ"><button class="tb small">ส่ง</button></div>`;
      d.innerHTML = `<button class="wx" title="ลบวิดเจ็ต">×</button><div class="wt">${esc(w.title || w.topic)}${w.unit ? ' (' + esc(w.unit) + ')' : ''}</div><div class="wtopic">${esc(w.topic)}</div>${inner}`;
      box.appendChild(d);
      d.querySelector('.wx').onclick = () => { ed.project.widgets = ws.filter((x) => x !== w); renderWidgets(); IOTF.app && IOTF.app.dirty(); };
      const pub = (v) => iot.publish(w.topic, String(v), !!w.retain, null);
      if (w.type === 'switch') { const b = d.querySelector('.wbtn'); b.onclick = () => { const on = !b.classList.contains('on'); setSwitch(b, on, w); pub(on ? (w.on || '1') : (w.off || '0')); }; }
      if (w.type === 'button') d.querySelector('.wbtn').onclick = () => pub(w.on || '1');
      if (w.type === 'slider') { const r = d.querySelector('input'); r.oninput = () => { d.querySelector('.wv').textContent = r.value; }; r.onchange = () => pub(r.value); }
      if (w.type === 'text') { const i = d.querySelector('input'), go = () => { if (i.value) { pub(i.value); i.value = ''; } }; d.querySelector('button.tb').onclick = go; i.onkeydown = (e) => { if (e.key === 'Enter') go(); }; }
      if (['value', 'gauge', 'chart', 'switch', 'led', 'slider'].includes(w.type)) iot.subs.push({ cid: 'dash', filter: w.topic, cb: () => { } });
      updateWidget(w);
    });
  }
  iot.renderWidgets = renderWidgets;
  function setSwitch(b, on, w) { b.classList.toggle('on', on); b.textContent = on ? 'เปิด' : 'ปิด'; }
  function updateWidgets(topic) { (ed.project.widgets || []).forEach((w) => { if (w.topic && (w.topic === topic || topic === undefined)) updateWidget(w); }); }
  function updateWidget(w) {
    const d = document.querySelector(`.widget[data-id="${w.id}"]`); if (!d) return;
    const v = iot.last[w.topic];
    if (v === undefined) return;
    const n = parseFloat(v);
    if (w.type === 'value' || w.type === 'chart') { d.querySelector('.wv').textContent = v + (w.unit && !Number.isNaN(n) ? ' ' + w.unit : ''); }
    if (w.type === 'gauge') {
      const min = +(w.min ?? 0), max = +(w.max ?? 100), k = Math.max(0, Math.min(1, (n - min) / (max - min || 1)));
      const a = Math.PI * (1 - k), x = 65 + 50 * Math.cos(a), y = 70 - 50 * Math.sin(a);
      d.querySelector('.arc').setAttribute('d', k > 0.001 ? `M15 70A50 50 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}` : '');
      d.querySelector('.gv').textContent = Number.isNaN(n) ? v : (Math.round(n * 10) / 10) + (w.unit ? ' ' + w.unit : '');
    }
    if (w.type === 'switch') setSwitch(d.querySelector('.wbtn'), v === (w.on || '1') || /^(on|true|1)$/i.test(v), w);
    if (w.type === 'led') { const on = /^(1|on|true|high)$/i.test(v.trim()) || (n > 0); d.querySelector('.lamp').style.background = on ? '#3cff7a' : '#3a3a3a'; d.querySelector('.lamp').style.boxShadow = on ? '0 0 12px #3cff7a' : 'none'; d.querySelector('.wv').textContent = v; }
    if (w.type === 'slider' && !Number.isNaN(n)) { d.querySelector('input').value = n; d.querySelector('.wv').textContent = n; }
    const cv = d.querySelector('canvas');
    if (cv) drawChart(cv, iot.hist[w.topic] || []);
  }
  function drawChart(cv, data) {
    const r = cv.getBoundingClientRect(); const W = Math.max(100, r.width | 0), H = 80, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; const k = cv.getContext('2d'); k.scale(dpr, dpr);
    k.clearRect(0, 0, W, H); if (data.length < 2) return;
    const mn = Math.min(...data), mx = Math.max(...data), span = mx - mn || 1;
    k.strokeStyle = '#3a3a3a'; k.lineWidth = 1; [0.25, 0.5, 0.75].forEach((f) => { k.beginPath(); k.moveTo(0, H * f); k.lineTo(W, H * f); k.stroke(); });
    k.strokeStyle = '#e87d0d'; k.lineWidth = 2; k.beginPath();
    data.forEach((v, i) => { const x = i / (data.length - 1) * (W - 4) + 2, y = H - 6 - (v - mn) / span * (H - 14); i ? k.lineTo(x, y) : k.moveTo(x, y); });
    k.stroke();
    k.fillStyle = '#9a9a9a'; k.font = '10px system-ui'; k.fillText(mx.toFixed(1), 4, 10); k.fillText(mn.toFixed(1), 4, H - 2);
  }

  iot.openAddWidget = function () {
    const m = $('modal'), dlg = $('dialog');
    dlg.innerHTML = `<h2>เพิ่มวิดเจ็ต Dashboard</h2><p class="muted small">วิดเจ็ตจะ subscribe/publish ผ่าน MQTT topic ที่กำหนด ใช้คู่กับ PubSubClient ในโค้ด</p>
      <div class="frm">
        <label>ชนิด</label><select id="wType">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <label>ชื่อ</label><input id="wTitle" placeholder="เช่น อุณหภูมิห้อง">
        <label>MQTT topic</label><input id="wTopic" placeholder="เช่น home/temp">
        <label>หน่วย</label><input id="wUnit" placeholder="เช่น °C">
        <label>ค่าต่ำสุด / สูงสุด</label><div style="display:flex;gap:6px"><input id="wMin" type="number" value="0"><input id="wMax" type="number" value="100"></div>
        <label>ข้อความ เปิด / ปิด</label><div style="display:flex;gap:6px"><input id="wOn" value="1"><input id="wOff" value="0"></div>
      </div>
      <div class="foot"><button class="btn" id="wCancel">ยกเลิก</button><button class="btn pri" id="wOk">เพิ่ม</button></div>`;
    m.hidden = false;
    $('wCancel').onclick = () => { m.hidden = true; };
    $('wOk').onclick = () => {
      const topic = $('wTopic').value.trim(); if (!topic) { $('wTopic').focus(); return; }
      addWidget({ type: $('wType').value, title: $('wTitle').value.trim() || topic, topic, unit: $('wUnit').value.trim(), min: +$('wMin').value, max: +$('wMax').value, on: $('wOn').value, off: $('wOff').value });
      m.hidden = true;
    };
  };

  iot.init = function () {
    $('btnAddWidget').onclick = iot.openAddWidget;
    const sendPub = () => { const t = $('pubTopic').value.trim(); if (!t) return; iot.publish(t, $('pubMsg').value, false, null); $('pubMsg').value = ''; };
    $('btnPub').onclick = sendPub; $('pubMsg').onkeydown = (e) => { if (e.key === 'Enter') sendPub(); };
    $('loraIn').onkeydown = (e) => {
      if (e.key !== 'Enter' || !e.target.value) return;
      const t = e.target.value; e.target.value = '';
      loraLog(`รับ (จำลอง): ${t}`);
      if (IOTF.sim.running) IOTF.sim.loraReceive(t);
    };
  };
  iot.reset = function () { iot.retained = {}; iot.hist = {}; iot.last = {}; iot.subs = []; $('mqttLog').innerHTML = ''; $('loraOut').textContent = ''; renderWidgets(); };
})();
