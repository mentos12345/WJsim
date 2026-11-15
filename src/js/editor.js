/* Wongjorn — circuit editor: parts, wires, nets, checks, properties */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const P = IOTF.PARTS, B = IOTF.BOARDS;
  const SIG_COLORS = ['#4aa3ff', '#3ddc84', '#ffb020', '#c084fc', '#f472b6', '#22d3ee', '#a3e635', '#fb923c'];
  const FIVE_V = ['hc-sr04', 'lcd1602', 'lcd2004', 'iotf-relay4', 'ks2e-m-dc5', 'servo', 'hx711', 'iotf-tds', 'iotf-ph', 'gas-sensor', 'pir-motion-sensor', 'iotf-neo6m', 'microsd-card', 'ds1307'];
  const OPTIONAL = new Set(['NC', 'DOUT', 'DO', 'IRQ', 'INT', 'AD0', 'XCL', 'XDA', 'CD', 'SQW', 'V0', 'RW', 'D0', 'D1', 'D2', 'D3', 'K', 'LED', 'DP', 'COM.2', '1.r', '2.r', '1', '3', 'SEL']);

  const ed = {
    project: null, els: {}, sel: null, selWire: null, armed: null,
    zoom: 1.5, panX: 40, panY: 30, running: false, undo: [], redo: [],
    listeners: []
  };
  IOTF.editor = ed;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const base = (pin) => pin.replace(/\.\d+$/, '');
  ed.onChange = (fn) => ed.listeners.push(fn);
  function changed(kind) { ed.listeners.forEach((f) => f(kind || 'circuit')); }
  function snapshot() {
    ed.undo.push(JSON.stringify({ parts: ed.project.parts, wires: ed.project.wires }));
    if (ed.undo.length > 60) ed.undo.shift();
    ed.redo = [];
  }
  ed.undoStep = function (redo) {
    const from = redo ? ed.redo : ed.undo, to = redo ? ed.undo : ed.redo;
    if (!from.length || ed.running) return;
    to.push(JSON.stringify({ parts: ed.project.parts, wires: ed.project.wires }));
    const s = JSON.parse(from.pop());
    ed.project.parts = s.parts; ed.project.wires = s.wires;
    ed.sel = ed.selWire = null; rebuild(); changed();
  };

  /* ---------- project ---------- */
  ed.board = () => ed.project.parts.find((p) => P[p.type] && P[p.type].kind === 'board');
  ed.boardDef = () => { const b = ed.board(); return b ? B[P[b.type].board] : null; };
  ed.part = (id) => ed.project.parts.find((p) => p.id === id);
  ed.def = (p) => P[p.type];
  ed.isBasic = () => !ed.project || ed.project.mode === 'basic';

  ed.load = function (project) {
    ed.project = project;
    ed.undo = []; ed.redo = []; ed.sel = ed.selWire = null; ed.armed = null;
    rebuild(); fitView(); changed('load');
  };

  ed.addPart = function (type, x, y, opts = {}) {
    const d = P[type];
    if (!d) return null;
    if (!opts.noUndo) snapshot();
    if (d.kind === 'board') {
      const old = ed.board();
      if (old) { ed.setBoard(d.board, true); return old; }
    }
    const p = { id: opts.id || uid(), type, x: Math.round(x), y: Math.round(y), rot: opts.rot || 0, attrs: Object.assign({}, d.attrs, opts.attrs || {}), sim: {} };
    Object.entries(d.sim).forEach(([k, v]) => { p.sim[k] = opts.sim && k in opts.sim ? opts.sim[k] : v[0]; });
    ed.project.parts.push(p);
    mountPart(p);
    if (ed.isBasic() && !opts.noAutoWire && d.kind !== 'board') autoWire(p);
    if (!opts.silent) { select(p.id); renderWires(); changed(); }
    return p;
  };

  ed.removePart = function (id) {
    const p = ed.part(id);
    if (!p || ed.running) return;
    snapshot();
    ed.project.parts = ed.project.parts.filter((q) => q !== p);
    ed.project.wires = ed.project.wires.filter((w) => w.a.p !== id && w.b.p !== id);
    const n = ed.els[id]; if (n) n.wrap.remove(); delete ed.els[id];
    if (ed.sel === id) select(null);
    renderWires(); changed();
  };

  ed.addWire = function (a, b, opts = {}) {
    if (a.p === b.p && a.pin === b.pin) return null;
    if (ed.project.wires.some((w) => (same(w.a, a) && same(w.b, b)) || (same(w.a, b) && same(w.b, a)))) return null;
    if (!opts.noUndo) snapshot();
    const w = { id: uid(), a, b, color: opts.color || wireColor(a, b), auto: !!opts.auto };
    ed.project.wires.push(w);
    if (!opts.silent) { renderWires(); changed(); }
    return w;
  };
  const same = (x, y) => x.p === y.p && x.pin === y.pin;
  ed.removeWire = function (id) {
    if (ed.running) return;
    snapshot();
    ed.project.wires = ed.project.wires.filter((w) => w.id !== id);
    if (ed.selWire === id) { ed.selWire = null; renderProps(); }
    renderWires(); changed();
  };

  function pinSignal(p, pin) {
    const n = ed.els[p.id];
    const info = n && n.el.pinInfo ? n.el.pinInfo.find((q) => q.name === pin) : null;
    const s = info && info.signals ? info.signals.find((x) => x.type === 'power') : null;
    return s ? s.signal : null;
  }
  function wireColor(a, b) {
    const pa = ed.part(a.p), pb = ed.part(b.p);
    const sa = pa && pinSignal(pa, a.pin), sb = pb && pinSignal(pb, b.pin);
    if (sa === 'GND' || sb === 'GND' || /^GND/.test(a.pin) || /^GND/.test(b.pin)) return '#6b6b6b';
    if (sa === 'VCC' || sb === 'VCC') return '#e5484d';
    return SIG_COLORS[ed.project.wires.length % SIG_COLORS.length];
  }

  /* ---------- board helpers ---------- */
  ed.boardPins = function () {
    const b = ed.board(); if (!b) return [];
    return ed.els[b.id] ? ed.els[b.id].el.pinInfo : [];
  };
  ed.boardPinForGpio = function (gpio) {
    const bd = ed.boardDef();
    const pin = ed.boardPins().find((q) => bd.gpio(base(q.name)) === gpio);
    return pin ? pin.name : null;
  };
  ed.gpioOfBoardPin = function (name) { const bd = ed.boardDef(); return bd ? bd.gpio(base(name)) : undefined; };
  function powerPinOfBoard(kind, forType) {
    const pins = ed.boardPins();
    if (kind === 'GND') { const g = pins.filter((q) => q.signals && q.signals.some((s) => s.signal === 'GND')); return g.length ? g[0].name : null; }
    const v = pins.filter((q) => q.signals && q.signals.some((s) => s.signal === 'VCC'));
    const want5 = FIVE_V.includes(forType);
    const pick = v.find((q) => want5 ? /^(5V|VIN)/.test(q.name) : /^(3V3|3\.3V|VCC)/.test(q.name)) || v.find((q) => /^(5V|3V3|3\.3V|VCC)/.test(q.name)) || v[0];
    return pick ? pick.name : null;
  }

  ed.setBoard = function (boardKey, noUndo) {
    const bd = B[boardKey]; if (!bd) return;
    const old = ed.board();
    if (!noUndo) snapshot();
    const tag = bd.tag;
    if (old && P[old.type].board === boardKey) return;
    let x = 60, y = 60, oldId = null, map = {};
    if (old) {
      x = old.x; y = old.y; oldId = old.id;
      const obd = B[P[old.type].board];
      ed.project.wires.forEach((w) => [w.a, w.b].forEach((e) => { if (e.p === oldId) map[e.pin] = { gpio: obd.gpio(base(e.pin)), power: pinSignal(old, e.pin) }; }));
      ed.project.parts = ed.project.parts.filter((p) => p !== old);
      if (ed.els[oldId]) ed.els[oldId].wrap.remove(); delete ed.els[oldId];
    }
    const nb = { id: oldId || uid(), type: tag, x, y, rot: 0, attrs: {}, sim: {} };
    ed.project.parts.unshift(nb); mountPart(nb);
    // remap wires by gpio number / power type
    ed.project.wires = ed.project.wires.filter((w) => {
      for (const e of [w.a, w.b]) {
        if (e.p !== nb.id) continue;
        const m = map[e.pin]; let np = null;
        if (m && m.power) np = powerPinOfBoard(m.power, null);
        else if (m && m.gpio !== undefined) np = ed.boardPinForGpio(m.gpio);
        if (!np) return false;
        e.pin = np;
      }
      return true;
    });
    renderWires(); changed('board');
  };

  /* ---------- Basic auto wiring ---------- */
  function usedGpios() {
    const b = ed.board(), s = new Set(); if (!b) return s;
    ed.project.wires.forEach((w) => [w.a, w.b].forEach((e) => { if (e.p === b.id) { const g = ed.gpioOfBoardPin(e.pin); if (g !== undefined) s.add(g); } }));
    return s;
  }
  function autoWire(p) {
    const b = ed.board(), bd = ed.boardDef(), d = P[p.type];
    if (!b || !bd) return;
    const used = usedGpios();
    for (const [pin, need] of d.sig) {
      let g;
      if (need === 'sda') g = bd.i2c.sda;
      else if (need === 'scl') g = bd.i2c.scl;
      else {
        const reserved = new Set([bd.i2c.sda, bd.i2c.scl]);
        let pool = need === 'analog' ? bd.analog : need === 'pwm' ? bd.pwmPreferred.concat(bd.digital) : bd.digital;
        if (need !== 'analog') pool = pool.filter((n) => !(bd.inputOnly || []).includes(n));
        g = pool.find((n) => !used.has(n) && !reserved.has(n));
        if (g === undefined) g = pool.find((n) => !used.has(n));
      }
      if (g === undefined) continue;
      const bp = ed.boardPinForGpio(g);
      if (!bp) continue;
      used.add(g);
      ed.addWire({ p: p.id, pin }, { p: b.id, pin: bp }, { silent: true, noUndo: true, auto: true });
    }
  }

  ed.autoPower = function () {
    const b = ed.board(); if (!b) return 0;
    snapshot();
    const nets = ed.nets();
    let n = 0;
    ed.project.parts.forEach((p) => {
      if (p === b) return;
      const d = P[p.type], info = ed.els[p.id] ? ed.els[p.id].el.pinInfo : [];
      const ps = powerState(p, nets);
      const add = (pin, kind) => { const bp = powerPinOfBoard(kind, p.type); if (bp) { ed.addWire({ p: p.id, pin }, { p: b.id, pin: bp }, { silent: true, noUndo: true }); n++; } };
      if (ps.needV && !ps.v) add(ps.vPins.find((x) => x === '3V3' && !FIVE_V.includes(p.type)) || ps.vPins.find((x) => /VIN|5V/.test(x) && FIVE_V.includes(p.type)) || ps.vPins[0], 'VCC');
      if (ps.needG && !ps.g) add(ps.gPins[0], 'GND');
      if (d.kind === 'button') {
        const s1 = nets.netOf(p.id, '1.l'), s2 = nets.netOf(p.id, '2.l');
        if (nets.gpiosOn(s1).length && !nets.hasGnd(s2) && !nets.hasVcc(s2) && !nets.gpiosOn(s2).length) add('2.l', 'GND');
        else if (nets.gpiosOn(s2).length && !nets.hasGnd(s1) && !nets.hasVcc(s1) && !nets.gpiosOn(s1).length) add('1.l', 'GND');
      }
      Object.entries(d.tie || {}).forEach(([pin, kind]) => {
        if (/\.r$/.test(pin) || d.kind === 'button') return;
        const net = nets.netOf(p.id, pin);
        if (kind === 'GND' ? nets.hasGnd(net) : nets.hasVcc(net)) return;
        if (nets.gpiosOn(net).length) return;
        add(pin, kind);
      });
    });
    renderWires(); changed();
    return n;
  };

  /* ---------- nets ---------- */
  ed.nets = function () {
    const parent = {};
    const f = (k) => { if (!(k in parent)) parent[k] = k; while (parent[k] !== k) { parent[k] = parent[parent[k]]; k = parent[k]; } return k; };
    const u = (a, b) => { const x = f(a), y = f(b); if (x !== y) parent[x] = y; };
    const key = (id, pin) => id + ':' + pin;
    const b = ed.board(), basic = ed.isBasic();
    const GND = '#GND', VCC = '#VCC';
    f(GND); f(VCC);
    const connected = new Set();
    ed.project.wires.forEach((w) => { u(key(w.a.p, w.a.pin), key(w.b.p, w.b.pin)); connected.add(key(w.a.p, w.a.pin)); connected.add(key(w.b.p, w.b.pin)); });
    ed.project.parts.forEach((p) => {
      const d = P[p.type], info = ed.els[p.id] ? ed.els[p.id].el.pinInfo || [] : [];
      // duplicate pin names (GND.1, GND.2, 12.2 …) are the same node
      info.forEach((q) => { if (q.name !== base(q.name)) u(key(p.id, q.name), key(p.id, base(q.name))); });
      if (p === b) {
        info.forEach((q) => { const s = q.signals && q.signals.find((x) => x.type === 'power'); if (s) u(key(p.id, q.name), s.signal === 'GND' ? GND : VCC); });
        return;
      }
      if (d.kind === 'button') { u(key(p.id, '1.l'), key(p.id, '1.r')); u(key(p.id, '2.l'), key(p.id, '2.r')); }
      if (d.kind === 'resistor') u(key(p.id, '1'), key(p.id, '2'));
      if (basic) {
        info.forEach((q) => { const s = q.signals && q.signals.find((x) => x.type === 'power'); if (s && !(p.type === 'neopixel' && q.name === 'DIN')) u(key(p.id, q.name), s.signal === 'GND' ? GND : VCC); });
        Object.entries(d.tie || {}).forEach(([pin, kind]) => u(key(p.id, pin), kind === 'GND' ? GND : VCC));
        if (d.kind === 'loadcell') ['E+', 'E-', 'A-', 'A+'].forEach((x) => connected.add(key(p.id, x)));
      }
    });
    const api = {
      find: f, GND, VCC,
      netOf: (id, pin) => f(key(id, pin)),
      hasGnd: (n) => n === f(GND), hasVcc: (n) => n === f(VCC),
      isConnected: (id, pin) => connected.has(key(id, pin)) || (basic && (P[ed.part(id).type].tie || {})[pin] !== undefined),
      gpioNet: (g) => { const bp = ed.boardPinForGpio(g); return bp && b ? f(key(b.id, bp)) : null; },
      members: (n) => Object.keys(parent).filter((k) => !k.startsWith('#') && f(k) === n).map((k) => { const i = k.indexOf(':'); return { p: k.slice(0, i), pin: k.slice(i + 1) }; }),
      gpiosOn: (n) => {
        if (!b) return [];
        return api.members(n).filter((m) => m.p === b.id).map((m) => ed.gpioOfBoardPin(m.pin)).filter((g) => g !== undefined);
      },
      short: () => f(GND) === f(VCC)
    };
    return api;
  };

  /* which board GPIO a part pin is wired to (or undefined) */
  ed.gpioOf = function (partId, pin, nets) {
    nets = nets || ed.nets();
    const g = nets.gpiosOn(nets.netOf(partId, pin));
    return g.length ? g[0] : undefined;
  };
  // a part is powered when at least one of its VCC pins reaches VCC and one GND pin reaches GND
  function powerState(p, nets) {
    const info = ed.els[p.id] ? ed.els[p.id].el.pinInfo || [] : [];
    const st = { needV: false, needG: false, v: false, g: false, vPins: [], gPins: [] };
    info.forEach((q) => {
      const s = q.signals && q.signals.find((x) => x.type === 'power');
      if (!s || (p.type === 'neopixel' && q.name === 'DIN')) return;
      const n = nets.netOf(p.id, q.name);
      if (s.signal === 'GND') { st.needG = true; st.gPins.push(q.name); if (nets.hasGnd(n)) st.g = true; }
      if (s.signal === 'VCC') { st.needV = true; st.vPins.push(q.name); if (nets.hasVcc(n)) st.v = true; }
    });
    return st;
  }
  ed.isPowered = function (p, nets) {
    if (ed.isBasic()) return true;
    const st = powerState(p, nets || ed.nets());
    return (!st.needV || st.v) && (!st.needG || st.g);
  };

  /* ---------- checks ---------- */
  ed.check = function () {
    const out = [];
    const b = ed.board();
    if (!b) { out.push({ lvl: 'err', msg: 'ยังไม่มีบอร์ด ลากบอร์ด (เช่น ESP32) ลงมาก่อน' }); return out; }
    const nets = ed.nets(), basic = ed.isBasic();
    if (nets.short()) out.push({ lvl: 'err', msg: 'ไฟลัดวงจร: ขา VCC ต่อถึง GND โดยตรง ระวังบอร์ดเสียหาย' });
    ed.project.parts.forEach((p) => {
      if (p === b) return;
      const d = P[p.type], name = d.name, info = ed.els[p.id] ? ed.els[p.id].el.pinInfo || [] : [];
      if (basic && d.level !== 'basic') out.push({ lvl: 'warn', part: p.id, msg: `${name} เป็นอุปกรณ์ของโหมด Advanced` });
      if (!basic) {
        const missing = [];
        const ps = powerState(p, nets);
        if (ps.needV && !ps.v) missing.push(ps.vPins[0].replace(/\.\d+$/, '') + '→VCC');
        if (ps.needG && !ps.g) missing.push(ps.gPins[0].replace(/\.\d+$/, '') + '→GND');
        Object.entries(d.tie || {}).forEach(([pin, kind]) => {
          if (/\.r$/.test(pin)) return;
          const n = nets.netOf(p.id, pin);
          if (d.kind === 'button') return;
          if (kind === 'GND' && !nets.hasGnd(n) && !nets.gpiosOn(n).length) missing.push(pin + '→GND');
        });
        if (missing.length) out.push({ lvl: 'err', part: p.id, msg: `${name}: ยังไม่ได้ต่อไฟเลี้ยง (${missing.join(', ')})` });
        if (d.kind === 'led') {
          const na = nets.netOf(p.id, 'A'), nc = nets.netOf(p.id, 'C');
          const hasR = nets.members(na).concat(nets.members(nc)).some((m) => ed.part(m.p) && P[ed.part(m.p).type].kind === 'resistor');
          if (!hasR && (nets.gpiosOn(na).length || nets.hasVcc(na))) out.push({ lvl: 'warn', part: p.id, msg: 'LED: ควรต่อตัวต้านทาน 220Ω อนุกรม ไม่งั้น LED/ขาบอร์ดอาจเสียหาย' });
        }
        if (d.kind === 'button') {
          const s1 = nets.netOf(p.id, '1.l'), s2 = nets.netOf(p.id, '2.l');
          if (!nets.gpiosOn(s1).length && !nets.gpiosOn(s2).length) out.push({ lvl: 'warn', part: p.id, msg: 'ปุ่มกด: ยังไม่ได้ต่อเข้าขาบอร์ด' });
          else if (!nets.hasGnd(s1) && !nets.hasGnd(s2) && !nets.hasVcc(s1) && !nets.hasVcc(s2)) out.push({ lvl: 'warn', part: p.id, msg: 'ปุ่มกด: อีกขาควรต่อ GND (ใช้ INPUT_PULLUP)' });
        }
      }
      // signal pins
      const sigPins = info.filter((q) => !(q.signals || []).some((x) => x.type === 'power') && !(d.tie || {})[q.name] && !OPTIONAL.has(q.name) && !(d.optional || []).includes(q.name) && q.name === base(q.name));
      const unconnected = sigPins.filter((q) => !nets.isConnected(p.id, q.name) && !(d.kind === 'button'));
      if (d.kind === 'loadcell') {
        const hx = ed.project.parts.find((q) => P[q.type].kind === 'hx711');
        if (!hx) out.push({ lvl: 'warn', part: p.id, msg: 'Load Cell อ่านค่าผ่านโมดูล HX711 ให้เพิ่ม HX711 ด้วย' });
      } else if (['relay', 'biaxial', 'stepper', 'irremote', 'resistor', 'dip', 'bargraph', 'seg7'].includes(d.kind)) {
        if (!info.some((q) => nets.isConnected(p.id, q.name))) out.push({ lvl: 'warn', part: p.id, msg: `${name}: ยังไม่ได้ต่อสาย` });
      } else if (unconnected.length) {
        out.push({ lvl: 'warn', part: p.id, msg: `${name}: ขา ${unconnected.map((q) => q.name).join(', ')} ยังไม่ได้ต่อ` });
      }
      // input-only pin used by an output part
      const bd = ed.boardDef();
      if (bd.inputOnly && ['led', 'rgb', 'buzzer', 'servo', 'relay4', 'pixels'].includes(d.kind)) {
        info.forEach((q) => { const g = nets.gpiosOn(nets.netOf(p.id, q.name)).find((x) => bd.inputOnly.includes(x)); if (g !== undefined) out.push({ lvl: 'err', part: p.id, msg: `${name}: GPIO${g} เป็นขาอินพุตอย่างเดียว ใช้ขับเอาต์พุตไม่ได้` }); });
      }
    });
    if (!out.length) out.push({ lvl: 'ok', msg: 'ไม่พบปัญหา วงจรพร้อมจำลอง' });
    return out;
  };

  /* ---------- rendering ---------- */
  const world = () => $('world'), layer = () => $('partsLayer');
  function mountPart(p) {
    const d = P[p.type];
    const wrap = document.createElement('div');
    wrap.className = 'part'; wrap.dataset.id = p.id;
    const el = document.createElement(d.tag);
    el.classList.add('el');
    applyAttrs(el, p);
    const hit = document.createElement('div'); hit.className = 'hit';
    wrap.appendChild(el); wrap.appendChild(hit);
    layer().appendChild(wrap);
    ed.els[p.id] = { wrap, el, w: 0, h: 0 };
    el.addEventListener('pininfo-change', () => { layoutPart(p); renderWires(); });
    const done = el.updateComplete ? el.updateComplete : Promise.resolve();
    done.then(() => requestAnimationFrame(() => { layoutPart(p); renderWires(); }));
    layoutPart(p);
    hookPart(p, wrap);
  }
  function applyAttrs(el, p) {
    Object.entries(p.attrs || {}).forEach(([k, v]) => { el[k] = v; });
  }
  ed.applyAttrs = (p) => { const n = ed.els[p.id]; if (n) { applyAttrs(n.el, p); requestAnimationFrame(() => { layoutPart(p); renderWires(); }); } };

  function layoutPart(p) {
    const n = ed.els[p.id]; if (!n) return;
    const w = n.el.offsetWidth, h = n.el.offsetHeight;
    if (w && h) { n.w = w; n.h = h; }
    n.wrap.style.width = n.w + 'px'; n.wrap.style.height = n.h + 'px';
    const r = ((p.rot || 0) % 360 + 360) % 360;
    const tr = r === 90 ? `translate(${n.h}px,0) rotate(90deg)` : r === 180 ? `translate(${n.w}px,${n.h}px) rotate(180deg)` : r === 270 ? `translate(0,${n.w}px) rotate(270deg)` : '';
    n.wrap.style.transform = `translate(${p.x}px,${p.y}px) ${tr}`;
    // pins
    n.wrap.querySelectorAll('.pin').forEach((x) => x.remove());
    (n.el.pinInfo || []).forEach((q) => {
      const d = document.createElement('div');
      d.className = 'pin'; d.style.left = q.x + 'px'; d.style.top = q.y + 'px';
      d.title = q.name; d.dataset.pin = q.name;
      n.wrap.appendChild(d);
    });
    markUsedPins();
  }
  function markUsedPins() {
    const used = new Set(); ed.project.wires.forEach((w) => { used.add(w.a.p + ':' + w.a.pin); used.add(w.b.p + ':' + w.b.pin); });
    Object.entries(ed.els).forEach(([id, n]) => n.wrap.querySelectorAll('.pin').forEach((d) => d.classList.toggle('used', used.has(id + ':' + d.dataset.pin))));
  }
  ed.pinPos = function (id, pin) {
    const p = ed.part(id), n = ed.els[id]; if (!p || !n) return null;
    const q = (n.el.pinInfo || []).find((x) => x.name === pin); if (!q) return null;
    const r = ((p.rot || 0) % 360 + 360) % 360, w = n.w, h = n.h;
    let x = q.x, y = q.y;
    if (r === 90) [x, y] = [h - q.y, q.x]; else if (r === 180) [x, y] = [w - q.x, h - q.y]; else if (r === 270) [x, y] = [q.y, w - q.x];
    return { x: p.x + x, y: p.y + y };
  };
  function routePath(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < 2 || Math.abs(dy) < 2) return `M${a.x} ${a.y}L${b.x} ${b.y}`;
    if (Math.abs(dx) > Math.abs(dy)) { const mx = a.x + dx / 2; return `M${a.x} ${a.y}H${mx}V${b.y}H${b.x}`; }
    const my = a.y + dy / 2; return `M${a.x} ${a.y}V${my}H${b.x}V${b.y}`;
  }
  // path through the wire's own bend points, in the project's wire style
  function wirePath(w, a, b) {
    const style = ed.project.wireStyle || 'ortho';
    const pts = [a].concat(w.points || []).concat([b]);
    if (style === 'straight' || (style === 'ortho' && pts.length === 2 && false)) return 'M' + pts.map((q) => `${q.x} ${q.y}`).join('L');
    if (style === 'curve') {
      if (pts.length === 2) { const dx = Math.max(30, Math.abs(b.x - a.x) / 2); const s1 = b.x >= a.x ? 1 : -1; return `M${a.x} ${a.y}C${a.x + s1 * dx} ${a.y} ${b.x - s1 * dx} ${b.y} ${b.x} ${b.y}`; }
      let d = `M${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += `C${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
      }
      return d;
    }
    if (pts.length === 2) return routePath(a, b);
    // orthogonal: leave each point horizontally, then vertically
    let d = `M${a.x} ${a.y}`;
    for (let i = 1; i < pts.length; i++) {
      const q = pts[i], prev = pts[i - 1];
      if (q.x === prev.x || q.y === prev.y) d += `L${q.x} ${q.y}`;
      else if (i === pts.length - 1) d += `V${q.y}H${q.x}`;
      else d += `H${q.x}V${q.y}`;
    }
    return d;
  }
  ed.wirePath = wirePath;
  function renderWires() {
    const svg = $('wires'); if (!svg) return;
    let h = '', handles = '';
    ed.project.wires.forEach((w) => {
      const a = ed.pinPos(w.a.p, w.a.pin), b = ed.pinPos(w.b.p, w.b.pin);
      if (!a || !b) return;
      const d = wirePath(w, a, b);
      h += `<path class="wire ${w.auto && !(w.points || []).length ? 'auto' : ''} ${ed.selWire === w.id ? 'sel' : ''}" data-wl="${w.id}" d="${d}" stroke="${w.color}"/><path class="wirehit" data-w="${w.id}" d="${d}"><title>${w.a.pin} ↔ ${w.b.pin} · ลากเพื่อดัดสาย</title></path>`;
      if (ed.selWire === w.id && !ed.running) {
        const pts = [a].concat(w.points || []).concat([b]);
        for (let i = 0; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
          handles += `<rect class="wmid" data-w="${w.id}" data-i="${i}" x="${mx - 3}" y="${my - 3}" width="6" height="6"><title>ลากเพื่อเพิ่มจุดหักมุม</title></rect>`;
        }
        (w.points || []).forEach((q, i) => { handles += `<circle class="wpt" data-w="${w.id}" data-i="${i}" cx="${q.x}" cy="${q.y}" r="4"><title>ลากเพื่อย้าย · ดับเบิลคลิกเพื่อลบจุด</title></circle>`; });
      }
    });
    svg.innerHTML = h + handles;
    markUsedPins();
  }
  ed.renderWires = renderWires;
  function rebuild() {
    layer().innerHTML = ''; ed.els = {};
    ed.project.parts.forEach(mountPart);
    renderWires(); renderProps();
  }
  ed.rebuild = rebuild;

  /* ---------- view ---------- */
  function applyView() {
    world().style.transform = `translate(${ed.panX}px,${ed.panY}px) scale(${ed.zoom})`;
    $('zoomLbl').textContent = Math.round(ed.zoom * 100) + '%';
  }
  function fitView() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ps = ed.project.parts; if (!ps.length) { ed.zoom = 1.5; ed.panX = 40; ed.panY = 30; applyView(); return; }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      ps.forEach((p) => { const n = ed.els[p.id]; const r = (p.rot || 0) % 180 ? [n.h, n.w] : [n.w, n.h]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + (r[0] || 50)); y1 = Math.max(y1, p.y + (r[1] || 50)); });
      const st = $('stage').getBoundingClientRect();
      const z = Math.max(0.4, Math.min(2.4, Math.min((st.width - 80) / (x1 - x0 || 1), (st.height - 80) / (y1 - y0 || 1))));
      ed.zoom = z; ed.panX = (st.width - (x1 - x0) * z) / 2 - x0 * z; ed.panY = (st.height - (y1 - y0) * z) / 2 - y0 * z;
      applyView();
    }));
  }
  ed.fitView = fitView;
  ed.toWorld = function (cx, cy) { const r = $('stage').getBoundingClientRect(); return { x: (cx - r.left - ed.panX) / ed.zoom, y: (cy - r.top - ed.panY) / ed.zoom }; };
  function zoomAt(f, cx, cy) {
    const r = $('stage').getBoundingClientRect(); const px = cx - r.left, py = cy - r.top;
    const nz = Math.max(0.3, Math.min(4, ed.zoom * f));
    ed.panX = px - (px - ed.panX) * nz / ed.zoom; ed.panY = py - (py - ed.panY) * nz / ed.zoom; ed.zoom = nz; applyView();
  }

  /* ---------- interaction ---------- */
  function hookPart(p, wrap) {
    wrap.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const pinEl = e.target.closest('.pin');
      if (pinEl && !ed.running) { e.stopPropagation(); clickPin(p.id, pinEl.dataset.pin); return; }
      if (ed.running) { select(p.id, true); return; }
      if (!e.target.classList.contains('hit')) return;
      e.stopPropagation();
      if (ed.armed) { cancelArm(); }
      select(p.id);
      const start = ed.toWorld(e.clientX, e.clientY), ox = p.x, oy = p.y;
      let moved = false;
      const mv = (ev) => {
        const c = ed.toWorld(ev.clientX, ev.clientY);
        const nx = Math.round((ox + c.x - start.x) / 2) * 2, ny = Math.round((oy + c.y - start.y) / 2) * 2;
        if (!moved && Math.abs(nx - ox) + Math.abs(ny - oy) > 2) { moved = true; snapshot(); }
        if (moved) { p.x = nx; p.y = ny; layoutPart(p); renderWires(); }
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) changed('move'); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }, true);
  }
  function clickPin(id, pin) {
    if (!ed.armed) { ed.armed = { p: id, pin }; highlightArmed(); return; }
    if (ed.armed.p === id && ed.armed.pin === pin) { cancelArm(); return; }
    const a = ed.armed; cancelArm();
    const w = ed.addWire(a, { p: id, pin });
    if (w) { ed.selWire = null; renderWires(); }
  }
  function highlightArmed() {
    document.querySelectorAll('.pin.armed').forEach((x) => x.classList.remove('armed'));
    if (!ed.armed) return;
    const n = ed.els[ed.armed.p]; const d = n && [...n.wrap.querySelectorAll('.pin')].find((x) => x.dataset.pin === ed.armed.pin);
    if (d) d.classList.add('armed');
    hint(`กำลังต่อสายจาก ${ed.armed.pin} — คลิกขาปลายทาง (Esc ยกเลิก)`);
  }
  function cancelArm() { ed.armed = null; $('wireOverlay').innerHTML = ''; highlightArmed(); hint(); }
  ed.cancelArm = cancelArm;

  function hint(msg) {
    $('stageHint').textContent = msg || (ed.running ? 'กำลังจำลอง: กดปุ่ม/หมุนลูกบิดบนชิ้นส่วนได้ คลิกชิ้นส่วนเพื่อปรับค่าเซ็นเซอร์' :
      ed.isBasic() ? 'Basic: ลากอุปกรณ์จากด้านซ้าย ระบบต่อสายสัญญาณให้อัตโนมัติ ไฟเลี้ยง/กราวด์ต่อให้ในตัว · คลิกขาเพื่อต่อสายเอง' :
        'Advanced: คลิกขาหนึ่งแล้วคลิกอีกขาเพื่อต่อสาย ต้องต่อไฟเลี้ยงและกราวด์เอง · R หมุน · Delete ลบ · Ctrl+Z ย้อน');
  }
  ed.hint = hint;

  function select(id, keepWire) {
    ed.sel = id; if (!keepWire) ed.selWire = null;
    document.querySelectorAll('.part.sel').forEach((x) => x.classList.remove('sel'));
    if (id && ed.els[id]) ed.els[id].wrap.classList.add('sel');
    renderWires(); renderProps();
  }
  ed.select = select;

  ed.initStage = function () {
    const st = $('stage');
    st.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#props') || e.target.closest('#stageTools')) return;
      const hd = e.target.closest('.wpt, .wmid');
      if (hd && !ed.running) { e.stopPropagation(); dragBend(e, hd.dataset.w, +hd.dataset.i, hd.classList.contains('wmid')); return; }
      const wh = e.target.closest('.wirehit');
      if (wh && !ed.running) {
        if (ed.selWire === wh.dataset.w) { const seg = nearestSegment(wh.dataset.w, ed.toWorld(e.clientX, e.clientY)); if (seg >= 0) { dragBend(e, wh.dataset.w, seg, true); return; } }
        ed.selWire = wh.dataset.w; select(null, true); ed.selWire = wh.dataset.w; renderWires(); renderProps(); return;
      }
      if (e.target.closest('.part')) return;
      if (ed.armed) { cancelArm(); return; }
      if (!ed.running) select(null);
      const sx = e.clientX, sy = e.clientY, px = ed.panX, py = ed.panY;
      st.classList.add('panning');
      const mv = (ev) => { ed.panX = px + ev.clientX - sx; ed.panY = py + ev.clientY - sy; applyView(); };
      const up = () => { st.classList.remove('panning'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    st.addEventListener('pointermove', (e) => {
      if (!ed.armed) return;
      const a = ed.pinPos(ed.armed.p, ed.armed.pin); if (!a) return;
      const c = ed.toWorld(e.clientX, e.clientY);
      $('wireOverlay').innerHTML = `<path d="${routePath(a, c)}" stroke="#ff9a3c" stroke-width="2" fill="none" stroke-dasharray="4 3"/>`;
    });
    $('wires').addEventListener('pointerover', (e) => { const wh = e.target.closest('.wirehit'); if (wh) highlightNet(wh.dataset.w); });
    $('wires').addEventListener('pointerout', (e) => { if (e.target.closest('.wirehit')) highlightNet(null); });
    st.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY); }, { passive: false });
    $('zoomIn').onclick = () => { const r = st.getBoundingClientRect(); zoomAt(1.2, r.left + r.width / 2, r.top + r.height / 2); };
    $('zoomOut').onclick = () => { const r = st.getBoundingClientRect(); zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2); };
    $('zoomFit').onclick = fitView;
    window.addEventListener('resize', applyView);
    applyView(); hint();
  };

  function snapPt(q, w, i) {
    let x = Math.round(q.x / 4) * 4, y = Math.round(q.y / 4) * 4;
    const a = ed.pinPos(w.a.p, w.a.pin), b = ed.pinPos(w.b.p, w.b.pin);
    const pts = [a].concat(w.points).concat([b]);
    [pts[i], pts[i + 2]].forEach((n) => { if (!n) return; if (Math.abs(n.x - x) < 6) x = n.x; if (Math.abs(n.y - y) < 6) y = n.y; });
    return { x, y };
  }
  let lastPt = null;
  function dragBend(e, wid, i, insert) {
    const w = ed.project.wires.find((x) => x.id === wid); if (!w) return;
    w.points = w.points || [];
    ed.selWire = wid;
    const now = performance.now();
    if (!insert && lastPt && lastPt.w === wid && lastPt.i === i && now - lastPt.t < 400) { // double-click a point: remove it
      lastPt = null; snapshot(); w.points.splice(i, 1); renderWires(); renderProps(); changed('move'); return;
    }
    lastPt = insert ? null : { w: wid, i, t: now };
    const c0 = ed.toWorld(e.clientX, e.clientY);
    let started = false;
    const mv = (ev) => {
      const c = ed.toWorld(ev.clientX, ev.clientY);
      if (!started) {
        if (Math.abs(c.x - c0.x) + Math.abs(c.y - c0.y) < 3) return;
        started = true; lastPt = null; snapshot();
        if (insert) w.points.splice(i, 0, { x: c.x, y: c.y });
      }
      w.points[i] = snapPt(c, w, i); renderWires();
    };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (!w.points.length) delete w.points; renderProps(); if (started) changed('move'); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    renderWires();
  }
  function nearestSegment(wid, c) {
    const w = ed.project.wires.find((x) => x.id === wid); if (!w) return -1;
    const pts = [ed.pinPos(w.a.p, w.a.pin)].concat(w.points || []).concat([ed.pinPos(w.b.p, w.b.pin)]);
    let best = -1, bd = 1e9;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], vx = q.x - p.x, vy = q.y - p.y, L = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((c.x - p.x) * vx + (c.y - p.y) * vy) / L));
      const dx = p.x + t * vx - c.x, dy = p.y + t * vy - c.y, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }
  function highlightNet(wid) {
    const svg = $('wires');
    svg.querySelectorAll('.wire.hl').forEach((x) => x.classList.remove('hl'));
    svg.classList.toggle('dim', !!wid);
    if (!wid) return;
    const w = ed.project.wires.find((x) => x.id === wid); if (!w) return;
    const nets = ed.nets(), n = nets.netOf(w.a.p, w.a.pin);
    ed.project.wires.forEach((x) => { if (nets.netOf(x.a.p, x.a.pin) === n) { const el = svg.querySelector(`.wire[data-wl="${x.id}"]`); if (el) el.classList.add('hl'); } });
  }

  /* ---------- automatic wire routing (A* on a grid, avoids parts, spreads parallel wires) ---------- */
  function partRect(p) {
    const n = ed.els[p.id]; if (!n) return null;
    const [w, h] = (p.rot || 0) % 180 ? [n.h, n.w] : [n.w, n.h];
    return { x0: p.x, y0: p.y, x1: p.x + w, y1: p.y + h };
  }
  function routeAll(onlyId) {
    const G = 8, parts = ed.project.parts, rects = {};
    let X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
    parts.forEach((p) => { const r = partRect(p); if (!r) return; rects[p.id] = r; X0 = Math.min(X0, r.x0); Y0 = Math.min(Y0, r.y0); X1 = Math.max(X1, r.x1); Y1 = Math.max(Y1, r.y1); });
    X0 -= 80; Y0 -= 80; X1 += 80; Y1 += 80;
    const W = Math.ceil((X1 - X0) / G), H = Math.ceil((Y1 - Y0) / G);
    const owner = new Int32Array(W * H).fill(-1), used = new Float32Array(W * H);
    const ids = parts.map((p) => p.id);
    parts.forEach((p, k) => {
      const r = rects[p.id]; if (!r) return;
      for (let gy = Math.max(0, Math.floor((r.y0 - 3 - Y0) / G)); gy <= Math.min(H - 1, Math.floor((r.y1 + 3 - Y0) / G)); gy++)
        for (let gx = Math.max(0, Math.floor((r.x0 - 3 - X0) / G)); gx <= Math.min(W - 1, Math.floor((r.x1 + 3 - X0) / G)); gx++) owner[gy * W + gx] = k;
    });
    const cell = (q) => [Math.max(0, Math.min(W - 1, Math.round((q.x - X0) / G))), Math.max(0, Math.min(H - 1, Math.round((q.y - Y0) / G)))];
    const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    const list = ed.project.wires.filter((w) => !onlyId || w.id === onlyId).map((w) => ({ w, a: ed.pinPos(w.a.p, w.a.pin), b: ed.pinPos(w.b.p, w.b.pin) }))
      .filter((x) => x.a && x.b).sort((u, v) => (Math.abs(u.a.x - u.b.x) + Math.abs(u.a.y - u.b.y)) - (Math.abs(v.a.x - v.b.x) + Math.abs(v.a.y - v.b.y)));
    ed.project.wires.forEach((w) => { if (onlyId && w.id !== onlyId && w.points) markUsed(w); });
    function markUsed(w) {
      const a = ed.pinPos(w.a.p, w.a.pin), b = ed.pinPos(w.b.p, w.b.pin); if (!a || !b) return;
      const pts = [a].concat(w.points || []).concat([b]);
      for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = cell(pts[i]), [x1, y1] = cell(pts[i + 1]); for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) used[y0 * W + x] += 1; for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) used[y * W + x1] += 1; }
    }
    list.forEach(({ w, a, b }) => {
      const ka = ids.indexOf(w.a.p), kb = ids.indexOf(w.b.p);
      const [sx, sy] = cell(a), [tx, ty] = cell(b);
      const N = W * H * 4, gScore = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
      const heap = [];
      const push = (f, s2) => { heap.push([f, s2]); let i = heap.length - 1; while (i > 0) { const pI = (i - 1) >> 1; if (heap[pI][0] <= heap[i][0]) break; [heap[pI], heap[i]] = [heap[i], heap[pI]]; i = pI; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      const hcost = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
      for (let d = 0; d < 4; d++) { const s0 = (sy * W + sx) * 4 + d; gScore[s0] = 0; push(hcost(sx, sy), s0); }
      let goal = -1, guard = 0;
      while (heap.length && guard++ < 400000) {
        const [, cur] = pop(); const c = cur >> 2, dir = cur & 3, cx = c % W, cy = (c / W) | 0;
        if (cx === tx && cy === ty) { goal = cur; break; }
        const g0 = gScore[cur];
        for (let d = 0; d < 4; d++) {
          const nx = cx + DX[d], ny = cy + DY[d]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nc = ny * W + nx, o = owner[nc];
          let cost = 1 + used[nc] * 3 + (d !== dir ? 4 : 0);
          if (o >= 0) cost += (o === ka || o === kb) ? 3 : 60;
          const ns = nc * 4 + d, ng = g0 + cost;
          if (ng < gScore[ns]) { gScore[ns] = ng; from[ns] = cur; push(ng + hcost(nx, ny), ns); }
        }
      }
      if (goal < 0) return;
      const cells = []; for (let s2 = goal; s2 >= 0; s2 = from[s2]) cells.push(s2 >> 2);
      cells.reverse();
      const pts = [];
      for (let i = 1; i < cells.length - 1; i++) {
        const p0 = cells[i - 1], p1 = cells[i], p2 = cells[i + 1];
        const d1 = p1 - p0, d2 = p2 - p1;
        if (d1 !== d2) pts.push({ x: X0 + (p1 % W) * G, y: Y0 + ((p1 / W) | 0) * G });
      }
      // line the first and last bends up with the pins so the ends leave straight
      if (pts.length) {
        const f = pts[0], l = pts[pts.length - 1];
        if (Math.abs(f.y - a.y) <= G) f.y = a.y; else if (Math.abs(f.x - a.x) <= G) f.x = a.x;
        if (Math.abs(l.y - b.y) <= G) l.y = b.y; else if (Math.abs(l.x - b.x) <= G) l.x = b.x;
      }
      w.points = pts;
      markUsed(w);
    });
  }
  ed.autoRoute = function (onlyId) {
    if (ed.running || !ed.project.wires.length) return;
    snapshot(); routeAll(onlyId); renderWires(); renderProps(); changed('move');
  };
  ed.clearBends = function (onlyId) {
    if (ed.running) return;
    snapshot(); ed.project.wires.forEach((w) => { if (!onlyId || w.id === onlyId) delete w.points; }); renderWires(); renderProps(); changed('move');
  };
  ed.setWireStyle = function (st) { ed.project.wireStyle = st; renderWires(); changed('style'); };

  ed.rotateSel = function () {
    const p = ed.part(ed.sel); if (!p || ed.running) return;
    snapshot(); p.rot = ((p.rot || 0) + 90) % 360; layoutPart(p); renderWires(); changed('move');
  };
  ed.deleteSel = function () {
    if (ed.running) return;
    if (ed.selWire) ed.removeWire(ed.selWire);
    else if (ed.sel) ed.removePart(ed.sel);
  };

  /* ---------- properties panel ---------- */
  function renderProps() {
    const box = $('props');
    if (ed.selWire) {
      const w = ed.project.wires.find((x) => x.id === ed.selWire);
      if (!w) { box.hidden = true; return; }
      const pa = ed.part(w.a.p), pb = ed.part(w.b.p);
      box.hidden = false;
      box.innerHTML = `<h3>สายไฟ</h3><div class="muted small">${P[pa.type].name} ${w.a.pin} ↔ ${P[pb.type].name} ${w.b.pin}</div>
        <div class="row"><label>สี</label>${['#6b6b6b', '#e5484d', ...SIG_COLORS].map((c) => `<span data-c="${c}" style="width:16px;height:16px;border-radius:50%;background:${c};display:inline-block;cursor:pointer;outline:${c === w.color ? '2px solid #fff' : 'none'}"></span>`).join('')}</div>
        <div class="muted small" style="margin-top:6px">ลากสายเพื่อดัดเป็นมุม · ลากจุดกลมเพื่อย้าย · ดับเบิลคลิกจุดเพื่อลบ</div>
        <div class="btnrow"><button class="btn" data-act="routeone">จัดเส้นนี้อัตโนมัติ</button><button class="btn" data-act="clearone" ${(w.points || []).length ? '' : 'disabled'}>ล้างจุดหักมุม</button><button class="btn" data-act="delwire">ลบสาย</button></div>`;
      box.querySelectorAll('[data-c]').forEach((s) => s.onclick = () => { w.color = s.dataset.c; renderWires(); renderProps(); changed('style'); });
      box.querySelector('[data-act=delwire]').onclick = () => ed.removeWire(w.id);
      box.querySelector('[data-act=routeone]').onclick = () => ed.autoRoute(w.id);
      box.querySelector('[data-act=clearone]').onclick = () => ed.clearBends(w.id);
      return;
    }
    const p = ed.part(ed.sel);
    if (!p) { box.hidden = true; return; }
    const d = P[p.type];
    box.hidden = false;
    let h = `<h3>${d.name}</h3><div class="muted small">${d.cat}${d.level === 'basic' ? '' : ' · Advanced'}</div>`;
    Object.entries(d.sim).forEach(([k, [, min, max, step, unit]]) => {
      if (max === 1 && step === 1 && min === 0) h += `<div class="row"><label>${simLabel(k)}</label><input type="checkbox" data-sim="${k}" ${p.sim[k] ? 'checked' : ''}></div>`;
      else h += `<div class="row"><label>${simLabel(k)}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${p.sim[k]}" data-sim="${k}"><output>${fmt(p.sim[k], step)} ${unit}</output></div>`;
    });
    if (d.opts) Object.entries(d.opts).forEach(([k, list]) => {
      h += `<div class="row"><label>${k === 'color' ? 'สี' : k === 'value' ? 'ค่า (Ω)' : k}</label><select data-attr="${k}">${list.map((v) => `<option ${p.attrs[k] == v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
    });
    if (d.kind === 'rfid') h += `<div class="row"><label>UID บัตร</label><input data-rfid value="${p.sim.uid || 'DE AD BE EF'}"></div><div class="btnrow"><button class="btn pri" data-act="tap">แตะบัตร</button></div>`;
    if (d.kind === 'sd') h += `<div class="muted small" style="margin-top:6px">ดูไฟล์ที่เขียนได้ในแท็บ "ไฟล์ใน SD card" ด้านล่าง</div>`;
    // pin connections
    const nets = ed.nets(), info = ed.els[p.id] ? ed.els[p.id].el.pinInfo || [] : [];
    if (d.kind !== 'board') {
      const rows = info.filter((q) => q.name === base(q.name) || !info.some((o) => o.name === base(q.name))).map((q) => {
        const n = nets.netOf(p.id, q.name), g = nets.gpiosOn(n);
        let to = g.length ? g.map((x) => ed.boardPinForGpio(x)).join(', ') : nets.hasGnd(n) ? 'GND' : nets.hasVcc(n) ? 'VCC' : '—';
        if (ed.isBasic() && ((d.tie || {})[q.name] || (q.signals || []).some((s) => s.type === 'power'))) to += ' (อัตโนมัติ)';
        return `<b>${q.name}</b> → ${to}`;
      });
      if (rows.length) h += `<div class="pinlist">${rows.join('<br>')}</div>`;
    }
    h += `<div class="btnrow">${ed.running ? '' : '<button class="btn" data-act="rot">หมุน (R)</button><button class="btn" data-act="del">ลบ</button>'}</div>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-sim]').forEach((inp) => inp.oninput = () => {
      const k = inp.dataset.sim;
      p.sim[k] = inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : +inp.value;
      const o = inp.nextElementSibling; if (o && o.tagName === 'OUTPUT') o.textContent = fmt(p.sim[k], d.sim[k][3]) + ' ' + d.sim[k][4];
      changed('sim');
    });
    box.querySelectorAll('[data-attr]').forEach((s) => s.onchange = () => { p.attrs[s.dataset.attr] = s.value; ed.applyAttrs(p); changed('style'); });
    const r = box.querySelector('[data-rfid]'); if (r) r.oninput = () => { p.sim.uid = r.value; };
    const tap = box.querySelector('[data-act=tap]'); if (tap) tap.onclick = () => { p.sim.tap = Date.now(); if (IOTF.sim) IOTF.sim.event('rfid', p); };
    const rot = box.querySelector('[data-act=rot]'); if (rot) rot.onclick = ed.rotateSel;
    const del = box.querySelector('[data-act=del]'); if (del) del.onclick = () => ed.removePart(p.id);
  }
  ed.renderProps = renderProps;
  const fmt = (v, step) => (+v).toFixed(step < 1 ? (String(step).split('.')[1] || '').length : 0);
  function simLabel(k) {
    return { temp: 'อุณหภูมิ', hum: 'ความชื้น', distance: 'ระยะทาง', motion: 'มีการเคลื่อนไหว', level: 'ระดับ', bpm: 'ชีพจร', tilted: 'เอียง', ph: 'ค่า pH', ppm: 'TDS', weight: 'น้ำหนัก', lat: 'ละติจูด', lng: 'ลองจิจูด', sats: 'ดาวเทียม', ax: 'Accel X', ay: 'Accel Y', az: 'Accel Z', gx: 'Gyro X', gy: 'Gyro Y', gz: 'Gyro Z' }[k] || k;
  }

  /* ---------- palette ---------- */
  const CAT_ICON = { 'บอร์ด': '#4772b3', 'เซ็นเซอร์': '#3cb371', 'จอแสดงผล': '#22a6c9', 'ไฟและเสียง': '#e87d0d', 'อินพุต': '#c084fc', 'มอเตอร์': '#e5484d', 'โมดูล': '#b8b8b8' };
  ed.renderPalette = function () {
    const q = $('partSearch').value.trim().toLowerCase(), basic = ed.isBasic();
    const list = Object.values(P).filter((d) => (!basic || d.level === 'basic') && (!q || d.name.toLowerCase().includes(q) || d.key.includes(q)));
    $('paletteHint').textContent = basic ? `Basic: ${list.length} ชิ้น (ต่อง่าย) · Advanced มีทั้งหมด ${Object.keys(P).length} ชิ้น` : `Advanced: ${list.length} ชิ้น`;
    let h = '';
    IOTF.CATS.forEach((c) => {
      const items = list.filter((d) => d.cat === c);
      if (!items.length) return;
      h += `<div class="cat"><h5>${c}</h5>` + items.map((d) => `<div class="pitem" data-type="${d.key}" title="ลากลงพื้นที่ทำงาน หรือดับเบิลคลิก"><span class="ico" style="--c:${CAT_ICON[c]}"></span><span class="nm">${d.name}</span>${!basic && d.level !== 'basic' ? '<span class="lvl">ADV</span>' : ''}</div>`).join('') + '</div>';
    });
    $('partList').innerHTML = h || '<p class="muted small">ไม่พบอุปกรณ์</p>';
  };
  ed.initPalette = function () {
    $('partSearch').oninput = ed.renderPalette;
    $('partList').addEventListener('pointerdown', (e) => {
      const it = e.target.closest('.pitem'); if (!it || ed.running) return;
      e.preventDefault();
      const type = it.dataset.type;
      const ghost = document.createElement('div');
      ghost.textContent = P[type].name;
      ghost.style.cssText = 'position:fixed;pointer-events:none;background:#e87d0d;color:#fff;padding:3px 9px;border-radius:5px;z-index:99;font-size:12px';
      let dragging = false;
      const mv = (ev) => {
        if (!dragging && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 4) { dragging = true; document.body.appendChild(ghost); }
        ghost.style.left = ev.clientX + 8 + 'px'; ghost.style.top = ev.clientY + 8 + 'px';
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ghost.remove();
        const r = $('stage').getBoundingClientRect();
        if (dragging && ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) {
          const w = ed.toWorld(ev.clientX, ev.clientY); ed.addPart(type, w.x - 20, w.y - 15);
        }
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    $('partList').addEventListener('dblclick', (e) => {
      const it = e.target.closest('.pitem'); if (!it || ed.running) return;
      const r = $('stage').getBoundingClientRect(); const w = ed.toWorld(r.left + r.width / 2, r.top + r.height / 2);
      const n = ed.project.parts.length; ed.addPart(it.dataset.type, w.x - 40 + (n % 4) * 20, w.y - 30 + (n % 3) * 20);
    });
  };

  ed.setRunning = function (on) {
    ed.running = on; document.body.classList.toggle('running', on);
    if (!ed.project) return;
    if (on) cancelArm();
    hint(); renderProps();
  };
})();
