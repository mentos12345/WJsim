/* WJSIM — circuit editor: parts, wires, nets, checks, properties */
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
  // several boards may sit on one canvas; the "active" one is the board whose code is being edited
  ed.isBoard = (p) => !!(p && P[p.type] && P[p.type].kind === 'board');
  ed.boards = () => ed.project.parts.filter(ed.isBoard);
  ed.board = () => { const bs = ed.boards(); return bs.find((b) => b.id === ed.project.activeBoard) || bs[0]; };
  ed.boardDef = (b) => { b = b || ed.board(); return b ? B[P[b.type].board] : null; };
  ed.boardName = (b) => b ? (b.name || B[P[b.type].board].name) : '';
  ed.setActiveBoard = function (id) {
    const b = ed.part(id); if (!ed.isBoard(b) || ed.project.activeBoard === id) return;
    ed.project.activeBoard = id; markActive(); changed('active');
  };
  function markActive() {
    const a = ed.board();
    ed.boards().forEach((b) => { const n = ed.els[b.id]; if (n) n.wrap.classList.toggle('active-board', b === a && ed.boards().length > 1); });
  }
  function nextBoardName(type) {
    const short = { esp32: 'ESP32', uno: 'Uno', nano: 'Nano', mega: 'Mega', rp2040: 'RP2040', franzininho: 'ATtiny85' }[P[type].board] || 'Board';
    const used = new Set(ed.boards().map((b) => b.name));
    for (let i = 1; ; i++) if (!used.has(`${short} #${i}`)) return `${short} #${i}`;
  }
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
    const p = { id: opts.id || uid(), type, x: Math.round(x), y: Math.round(y), rot: opts.rot || 0, attrs: Object.assign({}, d.attrs, opts.attrs || {}), sim: {} };
    if (d.kind === 'board') {
      p.name = opts.name || nextBoardName(type);
      ed.boards().forEach((b) => { if (!b.name) b.name = nextBoardName(b.type); });
    }
    Object.entries(d.sim).forEach(([k, v]) => { p.sim[k] = opts.sim && k in opts.sim ? opts.sim[k] : v[0]; });
    ed.project.parts.push(p);
    mountPart(p);
    if (d.kind === 'board') { ed.project.activeBoard = p.id; markActive(); refreshBoardLabels(); if (!opts.silent) changed('board-added'); }
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
    if (ed.isBoard(p)) { if (ed.project.programs) delete ed.project.programs[id]; if (ed.project.activeBoard === id) ed.project.activeBoard = ed.board() && ed.board().id; markActive(); refreshBoardLabels(); changed('active'); }
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
  ed.boardPins = function (b) {
    b = b || ed.board(); if (!b) return [];
    return ed.els[b.id] ? ed.els[b.id].el.pinInfo : [];
  };
  ed.boardPinForGpio = function (gpio, b) {
    b = b || ed.board(); const bd = ed.boardDef(b); if (!bd) return null;
    const pin = ed.boardPins(b).find((q) => bd.gpio(base(q.name)) === gpio);
    return pin ? pin.name : null;
  };
  ed.gpioOfBoardPin = function (name, b) { const bd = ed.boardDef(b); return bd ? bd.gpio(base(name)) : undefined; };
  function powerPinOfBoard(kind, forType, b) {
    const pins = ed.boardPins(b);
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
    const nb = { id: oldId || uid(), type: tag, x, y, rot: 0, attrs: {}, sim: {}, name: old && old.name ? old.name.replace(/^\S+/, nextBoardName(tag).split(' ')[0]) : nextBoardName(tag) };
    ed.project.parts.unshift(nb); mountPart(nb); ed.project.activeBoard = nb.id; markActive(); refreshBoardLabels();
    // remap wires by gpio number / power type
    ed.project.wires = ed.project.wires.filter((w) => {
      for (const e of [w.a, w.b]) {
        if (e.p !== nb.id) continue;
        const m = map[e.pin]; let np = null;
        if (m && m.power) np = powerPinOfBoard(m.power, null, nb);
        else if (m && m.gpio !== undefined) np = ed.boardPinForGpio(m.gpio, nb);
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
    if (!ed.board()) return 0;
    snapshot();
    const nets = ed.nets();
    let n = 0;
    ed.project.parts.forEach((p) => {
      if (ed.isBoard(p)) return;
      const d = P[p.type], info = ed.els[p.id] ? ed.els[p.id].el.pinInfo : [];
      const b = boardOfPart(p, nets) || ed.board();
      const ps = powerState(p, nets);
      const add = (pin, kind) => { const bp = powerPinOfBoard(kind, p.type, b); if (bp) { ed.addWire({ p: p.id, pin }, { p: b.id, pin: bp }, { silent: true, noUndo: true }); n++; } };
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
    const basic = ed.isBasic();
    const GND = '#GND', VCC = '#VCC';
    f(GND); f(VCC);
    const connected = new Set();
    ed.project.wires.forEach((w) => { u(key(w.a.p, w.a.pin), key(w.b.p, w.b.pin)); connected.add(key(w.a.p, w.a.pin)); connected.add(key(w.b.p, w.b.pin)); });
    ed.project.parts.forEach((p) => {
      const d = P[p.type], info = ed.els[p.id] ? ed.els[p.id].el.pinInfo || [] : [];
      // duplicate pin names (GND.1, GND.2, 12.2 …) are the same node
      info.forEach((q) => { if (q.name !== base(q.name)) u(key(p.id, q.name), key(p.id, base(q.name))); });
      if (ed.isBoard(p)) {
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
    // breadboards: holes in a strip are one node; a part pin sitting on a hole joins that strip
    const plugged = {}, inBB = new Set();
    const bbs = ed.project.parts.filter((p) => P[p.type].kind === 'breadboard' && ed.els[p.id]);
    bbs.forEach((bb) => {
      const g = P[bb.type].geom, sk = (h) => key(bb.id, '~' + g.strip(h));
      ed.project.wires.forEach((w) => [w.a, w.b].forEach((e) => { if (e.p === bb.id && g.strip(e.pin)) u(key(bb.id, e.pin), sk(e.pin)); }));
      const toLocal = bbLocal(bb);
      ed.project.parts.forEach((p) => {
        if (p === bb || P[p.type].kind === 'breadboard' || !ed.els[p.id]) return;
        (ed.els[p.id].el.pinInfo || []).forEach((q) => {
          const w = pinWorld(p, q), l = toLocal(w.x, w.y), h = g.holeAt(l.x, l.y);
          if (!h) return;
          u(key(p.id, q.name), sk(h)); connected.add(key(p.id, q.name)); inBB.add(key(p.id, q.name));
          (plugged[bb.id] = plugged[bb.id] || new Set()).add(h);
        });
      });
    });
    ed.plugged = plugged;
    // a pin placed right on another part's pin (a resistor leg on an LED leg, on a board pin…) is joined without a wire
    const touching = new Set(), spots = [];
    ed.project.parts.forEach((p) => {
      if (P[p.type].kind === 'breadboard' || !ed.els[p.id]) return;
      (ed.els[p.id].el.pinInfo || []).forEach((q) => { const w = pinWorld(p, q); spots.push({ id: p.id, pin: q.name, x: w.x, y: w.y }); });
    });
    const grid = {};
    spots.forEach((sp) => { const gk = Math.round(sp.x / 4) + ',' + Math.round(sp.y / 4); (grid[gk] = grid[gk] || []).push(sp); });
    spots.forEach((a) => {
      const gx = Math.round(a.x / 4), gy = Math.round(a.y / 4);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) (grid[(gx + i) + ',' + (gy + j)] || []).forEach((b) => {
        if (b.id === a.id || Math.hypot(a.x - b.x, a.y - b.y) > 2.5) return;
        u(key(a.id, a.pin), key(b.id, b.pin)); connected.add(key(a.id, a.pin)); touching.add(key(a.id, a.pin));
      });
    });
    ed.touching = touching; ed.inBB = inBB;
    const memoPins = {};
    const api = {
      find: f, GND, VCC,
      netOf: (id, pin) => f(key(id, pin)),
      hasGnd: (n) => n === f(GND), hasVcc: (n) => n === f(VCC),
      isConnected: (id, pin) => connected.has(key(id, pin)) || (basic && (P[ed.part(id).type].tie || {})[pin] !== undefined),
      gpioNet: (g, boardId) => { const b = boardId ? ed.part(boardId) : ed.board(); const bp = b && ed.boardPinForGpio(g, b); return bp ? f(key(b.id, bp)) : null; },
      members: (n) => Object.keys(parent).filter((k) => !k.startsWith('#') && f(k) === n).map((k) => { const i = k.indexOf(':'); return { p: k.slice(0, i), pin: k.slice(i + 1) }; }),
      // gpios on net n: of one board when boardId is given, otherwise of any board
      gpiosOn: (n, boardId) => api.boardPinsOn(n).filter((x) => !boardId || x.board === boardId).map((x) => x.gpio),
      boardPinsOn: (n) => {
        if (!memoPins[n]) memoPins[n] = api.members(n).map((m) => ({ m, b: ed.part(m.p) })).filter((x) => ed.isBoard(x.b))
          .map((x) => ({ board: x.b.id, pin: x.m.pin, gpio: ed.gpioOfBoardPin(x.m.pin, x.b) })).filter((x) => x.gpio !== undefined);
        return memoPins[n];
      },
      short: () => f(GND) === f(VCC)
    };
    return api;
  };

  // the board a part's signal pins are wired to
  function boardOfPart(p, nets) {
    const info = ed.els[p.id] ? ed.els[p.id].el.pinInfo || [] : [];
    for (const q of info) { const hit = nets.boardPinsOn(nets.netOf(p.id, q.name))[0]; if (hit) return ed.part(hit.board); }
    return null;
  }
  ed.boardOfPart = (p) => boardOfPart(p, ed.nets());
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
    // motors straight on a board pin: the pin cannot supply that much current
    ed.project.parts.filter((p) => P[p.type].kind === 'dcmotor').forEach((p) => {
      const direct = ['M+', 'M-'].some((x) => { const n = nets.netOf(p.id, x); return n != null && nets.boardPinsOn(n).length && !ed.project.parts.some((q) => P[q.type].kind === 'hbridge' && (ed.els[q.id] ? ed.els[q.id].el.pinInfo || [] : []).some((pi) => nets.netOf(q.id, pi.name) === n)); });
      if (direct) out.push({ lvl: 'warn', msg: `${P[p.type].name}: ต่อตรงกับขาบอร์ด ของจริงขาบอร์ดจ่ายไฟให้มอเตอร์ไม่พอ ควรต่อผ่านไดรเวอร์ L298N / L9110S หรือรีเลย์` });
    });
    ed.project.parts.forEach((p) => {
      if (p === b || ed.isBoard(p) || P[p.type].kind === 'breadboard') return;
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
    if (d.kind === 'board') { const lb = document.createElement('div'); lb.className = 'blabel'; wrap.appendChild(lb); }
    if (d.kind === 'breadboard') { wrap.classList.add('bboard'); $('bbLayer').appendChild(wrap); hookStrips(p, wrap); } else layer().appendChild(wrap);
    ed.els[p.id] = { wrap, el, w: 0, h: 0 };
    el.addEventListener('pininfo-change', () => { layoutPart(p); renderWires(); });
    const done = el.updateComplete ? el.updateComplete : Promise.resolve();
    done.then(() => requestAnimationFrame(() => { layoutPart(p); renderWires(); }));
    layoutPart(p);
    hookPart(p, wrap);
  }
  // hovering a hole lights up every hole joined to it
  function hookStrips(p, wrap) {
    const g = P[p.type].geom;
    wrap.addEventListener('pointerover', (e) => {
      const pin = e.target.closest('.pin'); if (!pin) return;
      const sname = g.strip(pin.dataset.pin);
      wrap.querySelectorAll('.pin.strip').forEach((x) => x.classList.remove('strip'));
      wrap.querySelectorAll('.pin').forEach((x) => { if (g.strip(x.dataset.pin) === sname) x.classList.add('strip'); });
    });
    wrap.addEventListener('pointerleave', () => wrap.querySelectorAll('.pin.strip').forEach((x) => x.classList.remove('strip')));
  }
  function applyAttrs(el, p) {
    const d = P[p.type], ok = new Set(Object.keys(d.attrs || {}).concat(Object.keys(d.opts || {})));
    Object.entries(p.attrs || {}).forEach(([k, v]) => { if (ok.has(k) && (typeof v !== 'object' || v === null)) el[k] = v; });
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
    // pins (rebuilt only when the part's pins change, not on every move)
    const info = n.el.pinInfo || [], sig = info.map((q) => q.name + '@' + q.x.toFixed(1) + ',' + q.y.toFixed(1)).join('|');
    if (n.pinSig !== sig) {
      n.pinSig = sig;
      n.wrap.querySelectorAll('.pin').forEach((x) => x.remove());
      const frag = document.createDocumentFragment();
      info.forEach((q) => {
        const d = document.createElement('div');
        d.className = 'pin'; d.style.left = q.x + 'px'; d.style.top = q.y + 'px';
        d.title = q.name; d.dataset.pin = q.name;
        frag.appendChild(d);
      });
      n.wrap.appendChild(frag);
    }
    markUsedPins();
  }
  function markUsedPins() {
    const used = new Set(); ed.project.wires.forEach((w) => { used.add(w.a.p + ':' + w.a.pin); used.add(w.b.p + ':' + w.b.pin); });
    ed.nets();
    Object.entries(ed.plugged || {}).forEach(([id, set]) => set.forEach((h) => used.add(id + ':' + h)));
    (ed.touching || new Set()).forEach((k) => used.add(k));
    const inBB = ed.inBB || new Set();
    Object.entries(ed.els).forEach(([id, n]) => n.wrap.querySelectorAll('.pin').forEach((d) => {
      const k = id + ':' + d.dataset.pin;
      d.classList.toggle('used', used.has(k));
      d.classList.toggle('inbb', inBB.has(k)); // a leg pushed into a breadboard hole: the hole shows it, the leg's own marker is hidden
    }));
    // a resistor with both legs in the breadboard sits flat on it: only the body shows, not the wire legs
    ed.project.parts.forEach((p) => {
      if (p.type !== 'resistor' || !ed.els[p.id]) return;
      const sr = ed.els[p.id].el.shadowRoot, lead = sr && sr.querySelector('rect[fill="#aaa"]');
      if (lead) lead.style.display = inBB.has(p.id + ':1') && inBB.has(p.id + ':2') ? 'none' : '';
    });
  }
  function pinWorld(p, q) {
    const n = ed.els[p.id], r = ((p.rot || 0) % 360 + 360) % 360, w = n.w, h = n.h;
    let x = q.x, y = q.y;
    if (r === 90) [x, y] = [h - q.y, q.x]; else if (r === 180) [x, y] = [w - q.x, h - q.y]; else if (r === 270) [x, y] = [q.y, w - q.x];
    return { x: p.x + x, y: p.y + y };
  }
  function bbLocal(bb) {
    const n = ed.els[bb.id], r = ((bb.rot || 0) % 360 + 360) % 360, w = n.w, h = n.h;
    return (X, Y) => {
      const x = X - bb.x, y = Y - bb.y;
      if (r === 90) return { x: y, y: h - x };
      if (r === 180) return { x: w - x, y: h - y };
      if (r === 270) return { x: w - y, y: x };
      return { x, y };
    };
  }
  // after a part is dropped: if a pin is close to a hole, line the part up with the holes
  ed.snapToBreadboard = function (p) {
    if (P[p.type].kind === 'breadboard' || !ed.els[p.id]) return false;
    let best = null;
    ed.project.parts.filter((b) => P[b.type].kind === 'breadboard' && ed.els[b.id]).forEach((bb) => {
      const g = P[bb.type].geom, toLocal = bbLocal(bb);
      (ed.els[p.id].el.pinInfo || []).forEach((q) => {
        const w = pinWorld(p, q), l = toLocal(w.x, w.y), hn = g.holeAt(l.x, l.y, 6); if (!hn) return;
        const hw = ed.pinPos(bb.id, hn), d = Math.hypot(hw.x - w.x, hw.y - w.y);
        if (!best || d < best.d) best = { d, dx: hw.x - w.x, dy: hw.y - w.y };
      });
    });
    // …or a leg that lands on another part's leg plugs straight into it
    (ed.els[p.id].el.pinInfo || []).forEach((q) => {
      const w = pinWorld(p, q);
      ed.project.parts.forEach((o) => {
        if (o === p || P[o.type].kind === 'breadboard' || !ed.els[o.id]) return;
        (ed.els[o.id].el.pinInfo || []).forEach((r) => {
          const ow = pinWorld(o, r), d = Math.hypot(ow.x - w.x, ow.y - w.y);
          if (d < 6 && (!best || d < best.d)) best = { d, dx: ow.x - w.x, dy: ow.y - w.y };
        });
      });
    });
    if (!best || best.d < 0.05) return !!best;
    p.x = Math.round((p.x + best.dx) * 100) / 100; p.y = Math.round((p.y + best.dy) * 100) / 100; layoutPart(p); renderWires();
    return true;
  };
  // parts with at least one pin plugged into this breadboard (they move with it)
  function riders(bb) {
    const g = P[bb.type].geom, toLocal = bbLocal(bb);
    return ed.project.parts.filter((p) => p !== bb && P[p.type].kind !== 'breadboard' && ed.els[p.id] && (ed.els[p.id].el.pinInfo || []).some((q) => { const w = pinWorld(p, q), l = toLocal(w.x, w.y); return g.holeAt(l.x, l.y); }));
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
  // round the corners of a path made of straight segments (M/L/H/V), like a bent wire
  function roundCorners(d, r = 7) {
    const pts = []; let x = 0, y = 0;
    d.replace(/([MLHV])\s*([-\d.e]+)(?:[ ,]+([-\d.e]+))?/g, (m, c, a, b) => {
      if (c === 'M' || c === 'L') { x = +a; y = +b; } else if (c === 'H') x = +a; else y = +a;
      const last = pts[pts.length - 1]; if (!last || Math.hypot(last.x - x, last.y - y) > 1.5) pts.push({ x, y });
      return m;
    });
    // drop points in the middle of a straight run
    for (let i = pts.length - 2; i > 0; i--) { const a = pts[i - 1], b = pts[i], c = pts[i + 1]; if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 1) pts.splice(i, 1); }
    if (pts.length < 3) return `M${pts[0].x} ${pts[0].y}` + pts.slice(1).map((q) => `L${q.x} ${q.y}`).join('');
    let out = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
      const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y), l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y), k = Math.min(r, l1 / 2, l2 / 2);
      if (k < 0.5) { out += `L${p1.x} ${p1.y}`; continue; }
      const ax = p1.x + (p0.x - p1.x) * k / l1, ay = p1.y + (p0.y - p1.y) * k / l1, bx = p1.x + (p2.x - p1.x) * k / l2, by = p1.y + (p2.y - p1.y) * k / l2;
      out += `L${ax.toFixed(1)} ${ay.toFixed(1)}Q${p1.x} ${p1.y} ${bx.toFixed(1)} ${by.toFixed(1)}`;
    }
    const e = pts[pts.length - 1];
    return out + `L${e.x} ${e.y}`;
  }
  ed.wirePath = wirePath;
  function renderWires() {
    const svg = $('wires'); if (!svg) return;
    let h = '', handles = '';
    ed.project.wires.forEach((w) => {
      const a = ed.pinPos(w.a.p, w.a.pin), b = ed.pinPos(w.b.p, w.b.pin);
      if (!a || !b) return;
      const raw = wirePath(w, a, b), d = /[CQ]/.test(raw) ? raw : roundCorners(raw);
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
    showSelectionNets();
  }
  ed.renderWires = renderWires;
  function rebuild() {
    layer().innerHTML = ''; $('bbLayer').innerHTML = ''; ed.els = {};
    ed.boards().forEach((b) => { if (!b.name) b.name = nextBoardName(b.type); });
    ed.project.parts.forEach(mountPart);
    markActive(); refreshBoardLabels();
    renderWires(); renderProps();
  }
  // network identity of each simulated board: fixed per position so sketches can hard-code them
  ed.netInfo = function (b) {
    const i = Math.max(0, ed.boards().indexOf(b));
    return { mac: '24:0A:C4:00:00:' + (i + 1).toString(16).toUpperCase().padStart(2, '0'), macBytes: [0x24, 0x0A, 0xC4, 0, 0, i + 1], ip: '192.168.1.' + (101 + i) };
  };
  function refreshBoardLabels() {
    const many = ed.boards().length > 1;
    ed.boards().forEach((b) => {
      const n = ed.els[b.id]; if (!n) return;
      const lb = n.wrap.querySelector('.blabel'); if (!lb) return;
      const bd = ed.boardDef(b);
      lb.textContent = ed.boardName(b) + (bd.wifi ? '  ·  ' + ed.netInfo(b).ip : '');
      lb.hidden = !many;
    });
  }
  ed.refreshBoardLabels = refreshBoardLabels;
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
      if (pinEl && !ed.running) { e.stopPropagation(); clickPin(p.id, pinEl.dataset.pin, e); return; }
      if (ed.running) { select(p.id, true); return; }
      if (!e.target.classList.contains('hit')) return;
      e.stopPropagation();
      if (ed.armed) { const t = nearestPin(e.clientX, e.clientY, 16); if (t && !(t.p === ed.armed.p && t.pin === ed.armed.pin)) { finishWire(t.p, t.pin); return; } cancelArm(); }
      select(p.id);
      if (ed.isBoard(p)) ed.setActiveBoard(p.id);
      const start = ed.toWorld(e.clientX, e.clientY), ox = p.x, oy = p.y;
      const carry = P[p.type].kind === 'breadboard' ? riders(p).map((q) => ({ q, x: q.x, y: q.y })) : [];
      let moved = false;
      const mv = (ev) => {
        const c = ed.toWorld(ev.clientX, ev.clientY);
        const nx = Math.round((ox + c.x - start.x) / 2) * 2, ny = Math.round((oy + c.y - start.y) / 2) * 2;
        if (!moved && Math.abs(nx - ox) + Math.abs(ny - oy) > 2) { moved = true; snapshot(); }
        if (moved) { p.x = nx; p.y = ny; layoutPart(p); carry.forEach((r) => { r.q.x = r.x + nx - ox; r.q.y = r.y + ny - oy; layoutPart(r.q); }); renderWires(); }
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) { ed.snapToBreadboard(p); changed('move'); } };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }, true);
  }
  // like Tinkercad: click a pin, click the canvas to add bends, click the other pin (or drag pin to pin)
  function clickPin(id, pin, ev) {
    if (!ed.armed) {
      ed.armed = { p: id, pin, bends: [] }; highlightArmed();
      if (ev) { // pressing and dragging to another pin also makes the wire
        const sx = ev.clientX, sy = ev.clientY;
        const up = (u) => {
          window.removeEventListener('pointerup', up, true);
          if (!ed.armed || Math.hypot(u.clientX - sx, u.clientY - sy) < 8) return;
          const t = pinAt(u.clientX, u.clientY);
          if (t && !(t.p === ed.armed.p && t.pin === ed.armed.pin)) { u.stopPropagation(); finishWire(t.p, t.pin); }
        };
        window.addEventListener('pointerup', up, true);
      }
      return;
    }
    if (ed.armed.p === id && ed.armed.pin === pin) { cancelArm(); return; }
    finishWire(id, pin);
  }
  function finishWire(id, pin) {
    const a = { p: ed.armed.p, pin: ed.armed.pin }, bends = ed.armed.bends || [];
    cancelArm();
    const w = ed.addWire(a, { p: id, pin });
    if (w) { if (bends.length) { w.points = bends.map((q) => ({ x: q.x, y: q.y })); } ed.selWire = null; renderWires(); }
  }
  // the pin under a screen point, even when a wire is drawn over it
  function pinAt(x, y, near = 10) {
    const el = document.elementsFromPoint(x, y).find((e) => e.classList && e.classList.contains('pin'));
    if (el) { const part = el.closest('.part'); if (part) return { p: part.dataset.id, pin: el.dataset.pin }; }
    return near ? nearestPin(x, y, near) : null;
  }
  // the closest pin (or breadboard hole) within `near` screen pixels, so a wire dropped on a leg or a body still lands
  function nearestPin(x, y, near) {
    const w = ed.toWorld(x, y), lim = near / ed.zoom;
    let best = null;
    ed.project.parts.forEach((p) => {
      const n = ed.els[p.id]; if (!n) return;
      (n.el.pinInfo || []).forEach((q) => {
        const pw = pinWorld(p, q), d = Math.hypot(pw.x - w.x, pw.y - w.y);
        // a part's own leg beats the hole it sits in
        const score = d + (P[p.type].kind === 'breadboard' ? 0.5 : 0);
        if (d <= lim && (!best || score < best.score)) best = { p: p.id, pin: q.name, score };
      });
    });
    return best && { p: best.p, pin: best.pin };
  }
  ed.pinAt = pinAt;
  function highlightArmed() {
    document.querySelectorAll('.pin.armed').forEach((x) => x.classList.remove('armed'));
    if (!ed.armed) return;
    const n = ed.els[ed.armed.p]; const d = n && [...n.wrap.querySelectorAll('.pin')].find((x) => x.dataset.pin === ed.armed.pin);
    if (d) d.classList.add('armed');
    hint(`กำลังต่อสายจาก ${ed.armed.pin} — คลิกขาปลายทาง · คลิกพื้นที่ว่างเพื่อหักมุมสาย · Esc หรือคลิกขวาเพื่อยกเลิก`);
  }
  function cancelArm() { ed.armed = null; $('wireOverlay').innerHTML = ''; highlightArmed(); hint(); }
  ed.cancelArm = cancelArm;

  function hint(msg) {
    $('stageHint').textContent = msg || (ed.running ? 'กำลังจำลอง: กดปุ่ม/หมุนลูกบิดบนชิ้นส่วนได้ คลิกชิ้นส่วนเพื่อปรับค่าเซ็นเซอร์' :
      ed.isBasic() ? 'Basic: ลากอุปกรณ์จากด้านซ้าย แล้วคลิกขาอุปกรณ์ต่อกับขาบอร์ดเอง (ไฟเลี้ยง/กราวด์ต่อให้ในตัว) · คลิกอุปกรณ์เพื่อดูว่าต่อกับขาไหน' :
        'Advanced: คลิกขาหนึ่งแล้วคลิกอีกขาเพื่อต่อสาย ต้องต่อไฟเลี้ยงและกราวด์เอง · R หมุน · D ทำซ้ำ · Delete ลบ · Ctrl+Z ย้อน');
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
      if (!ed.running) { // wires are drawn over the parts: a pin under a wire still takes the click
        const t = e.target.closest('.wirehit, .wire') ? pinAt(e.clientX, e.clientY) : null;
        if (t) { e.stopPropagation(); clickPin(t.p, t.pin, e); return; }
      }
      if (e.button === 2 && ed.armed) { cancelArm(); return; }
      const hd = e.target.closest('.wpt, .wmid');
      if (hd && !ed.running) { e.stopPropagation(); dragBend(e, hd.dataset.w, +hd.dataset.i, hd.classList.contains('wmid')); return; }
      const wh = e.target.closest('.wirehit');
      if (wh && !ed.running) {
        if (ed.selWire === wh.dataset.w) { const seg = nearestSegment(wh.dataset.w, ed.toWorld(e.clientX, e.clientY)); if (seg >= 0) { dragBend(e, wh.dataset.w, seg, true); return; } }
        ed.selWire = wh.dataset.w; select(null, true); ed.selWire = wh.dataset.w; renderWires(); renderProps(); return;
      }
      if (e.target.closest('.part')) return;
      if (ed.armed) { // a click on the canvas while drawing adds a bend
        const c = ed.toWorld(e.clientX, e.clientY), prev = ed.armed.bends.length ? ed.armed.bends[ed.armed.bends.length - 1] : ed.pinPos(ed.armed.p, ed.armed.pin);
        let x = Math.round(c.x / 4) * 4, y = Math.round(c.y / 4) * 4;
        if (prev) { if (Math.abs(prev.x - x) < 8) x = prev.x; if (Math.abs(prev.y - y) < 8) y = prev.y; }
        ed.armed.bends.push({ x, y }); return;
      }
      if (!ed.running) select(null);
      const sx = e.clientX, sy = e.clientY, px = ed.panX, py = ed.panY;
      st.classList.add('panning');
      const mv = (ev) => { if (touches.size > 1) return; ed.panX = px + ev.clientX - sx; ed.panY = py + ev.clientY - sy; applyView(); };
      const up = () => { st.classList.remove('panning'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    // pinch to zoom (two fingers), handled before the one-finger pan above
    const touches = new Map(); let pinch = null;
    const two = () => { const [a, b] = [...touches.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    st.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) pinch = two(); } }, true);
    st.addEventListener('pointermove', (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || !pinch) return;
      const now = two();
      ed.panX += now.x - pinch.x; ed.panY += now.y - pinch.y;
      zoomAt(now.d / pinch.d, now.x, now.y);
      pinch = now;
    }, true);
    const lift = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
    window.addEventListener('pointerup', lift); window.addEventListener('pointercancel', lift);
    st.addEventListener('pointermove', (e) => {
      if (!ed.armed) return;
      const a = ed.pinPos(ed.armed.p, ed.armed.pin); if (!a) return;
      let c = ed.toWorld(e.clientX, e.clientY);
      const t = pinAt(e.clientX, e.clientY); if (t) c = ed.pinPos(t.p, t.pin) || c; // snap the preview to a pin under the cursor
      const pts = [a].concat(ed.armed.bends);
      let d = `M${a.x} ${a.y}` + ed.armed.bends.map((q) => `L${q.x} ${q.y}`).join('');
      const last = pts[pts.length - 1];
      d += routePath(last, c).replace(/^M[^HVLC]*/, '');
      $('wireOverlay').innerHTML = `<path d="${roundCorners(d)}" stroke="#ff9a3c" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="5 4"/>` +
        ed.armed.bends.map((q) => `<circle cx="${q.x}" cy="${q.y}" r="3" fill="#ff9a3c"/>`).join('') + (t ? `<circle cx="${c.x}" cy="${c.y}" r="6" fill="none" stroke="#ff9a3c" stroke-width="2"/>` : '');
    });
    st.addEventListener('contextmenu', (e) => { if (ed.armed) { e.preventDefault(); cancelArm(); } });
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
  // clicking a part lights up every wire it is connected to and labels the pins at the other end
  // highlighted wires are copied into a layer above the parts, so wires running under a board still show
  function liftWires(svg, ids, extra) {
    const top = $('selLayer'); if (!top) return;
    let h = '';
    // wires are drawn over the parts now, so only the labels go in this layer
    top.innerHTML = h + (extra || '');
  }
  function showSelectionNets() {
    const svg = $('wires'); if (!svg) return;
    svg.querySelectorAll('.wire.hl').forEach((x) => x.classList.remove('hl'));
    const old = svg.querySelector('.selpins'); if (old) old.remove();
    liftWires(svg, []);
    const p = ed.sel && ed.part(ed.sel);
    if (!p || !ed.els[p.id]) { svg.classList.remove('dim'); return; }
    const nets = ed.nets(), info = ed.els[p.id].el.pinInfo || [];
    // follow signal nets end to end; for VCC/GND only the wires that touch this part (they reach everything)
    const mine = new Set(info.map((q) => nets.netOf(p.id, q.name)).filter((n) => !nets.hasVcc(n) && !nets.hasGnd(n)));
    const wires = ed.project.wires.filter((w) => w.a.p === p.id || w.b.p === p.id || mine.has(nets.netOf(w.a.p, w.a.pin)));
    svg.classList.toggle('dim', wires.length > 0);
    if (!wires.length) return;
    wires.forEach((w) => { const el = svg.querySelector(`.wire[data-wl="${w.id}"]`); if (el) el.classList.add('hl'); });
    const isB = ed.isBoard(p), seen = new Set(), tags = [];
    let g = '';
    wires.forEach((w) => [w.a, w.b].forEach((e) => {
      const k = e.p + '|' + e.pin; if (seen.has(k)) return; seen.add(k);
      const q = ed.pinPos(e.p, e.pin); if (!q) return;
      const own = e.p === p.id;
      g += `<circle class="selring ${own ? 'own' : ''}" cx="${q.x}" cy="${q.y}" r="5"/>`;
      const other = ed.part(e.p);
      if (!isB && ed.isBoard(other)) { // name the board pin each wire lands on
        const label = e.pin.replace(/\.\d+$/, '');
        const wdt = label.length * 5.6 + 10, n = ed.els[other.id];
        // put the tag outside the board, on the side nearest to the pin
        const bw = n ? ((other.rot || 0) % 180 ? n.h : n.w) : 0, bh = n ? ((other.rot || 0) % 180 ? n.w : n.h) : 0;
        const dist = { l: q.x - other.x, r: other.x + bw - q.x, t: q.y - other.y, b: other.y + bh - q.y };
        const side = Object.keys(dist).reduce((a, k) => (dist[k] < dist[a] ? k : a), 'l');
        let x = side === 'l' ? q.x - 9 - wdt : side === 'r' ? q.x + 9 : q.x - wdt / 2, y = side === 't' ? q.y - 24 : side === 'b' ? q.y + 10 : q.y - 7;
        const hit = (xx, yy) => tags.some((r) => xx < r.x + r.w + 2 && r.x < xx + wdt + 2 && Math.abs(r.y - yy) < 15);
        const steps = [0, -1, 1, -2, 2, -3, 3, -4, 4];
        const spot = side === 't' || side === 'b' ? steps.map((k) => [x + k * (wdt + 3), y]).concat(steps.map((k) => [x, y + (side === 't' ? -15 : 15) * Math.abs(k)])) : steps.map((k) => [x, y + k * 15]);
        [x, y] = spot.find(([xx, yy]) => !hit(xx, yy)) || [x, y];
        tags.push({ x, y, w: wdt });
        if (side === 't' || side === 'b') g += `<path class="taglead" d="M${q.x} ${q.y}L${x + wdt / 2} ${side === 't' ? y + 14 : y}"/>`;
        g += `<g class="seltag" transform="translate(${x} ${y})"><rect width="${wdt}" height="14" rx="4"/><text x="5" y="10.5">${label.replace(/[&<>]/g, '')}</text></g>`;
      }
    }));
    liftWires(svg, wires.map((w) => w.id), `<g class="selpins">${g}</g>`);
  }
  function highlightNet(wid) {
    const svg = $('wires');
    if (!wid) { showSelectionNets(); return; }
    svg.querySelectorAll('.wire.hl').forEach((x) => x.classList.remove('hl'));
    svg.classList.toggle('dim', !!wid);
    const w = ed.project.wires.find((x) => x.id === wid); if (!w) return;
    const nets = ed.nets(), n = nets.netOf(w.a.p, w.a.pin);
    const ids = ed.project.wires.filter((x) => nets.netOf(x.a.p, x.a.pin) === n).map((x) => x.id);
    ids.forEach((id) => { const el = svg.querySelector(`.wire[data-wl="${id}"]`); if (el) el.classList.add('hl'); });
    liftWires(svg, ids);
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
    parts.forEach((p) => { if (P[p.type].kind === 'breadboard') return; const r = partRect(p); if (!r) return; rects[p.id] = r; X0 = Math.min(X0, r.x0); Y0 = Math.min(Y0, r.y0); X1 = Math.max(X1, r.x1); Y1 = Math.max(Y1, r.y1); });
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

  // turn 90° around the middle of the part (not its corner), so it stays where it was
  ed.rotateSel = function () {
    const p = ed.part(ed.sel), n = p && ed.els[p.id]; if (!p || ed.running) return;
    snapshot();
    const [w0, h0] = (p.rot || 0) % 180 ? [n.h, n.w] : [n.w, n.h], cx = p.x + w0 / 2, cy = p.y + h0 / 2;
    p.rot = ((p.rot || 0) + 90) % 360;
    const [w1, h1] = p.rot % 180 ? [n.h, n.w] : [n.w, n.h];
    p.x = Math.round((cx - w1 / 2) * 100) / 100; p.y = Math.round((cy - h1 / 2) * 100) / 100;
    layoutPart(p); ed.snapToBreadboard(p); renderWires(); changed('move');
  };
  // a copy of the selected part (same settings), a little down-right of it
  ed.duplicateSel = function () {
    const p = ed.part(ed.sel); if (!p || ed.running) return null;
    const np = ed.addPart(p.type, p.x + 24, p.y + 24, { rot: p.rot || 0, attrs: JSON.parse(JSON.stringify(p.attrs || {})), sim: JSON.parse(JSON.stringify(p.sim || {})) });
    if (np && ed.project.programs && ed.project.programs[p.id] && ed.isBoard(np)) ed.project.programs[np.id] = JSON.parse(JSON.stringify(ed.project.programs[p.id]));
    return np;
  };
  ed.deleteSel = function () {
    if (ed.running) return;
    if (ed.selWire) ed.removeWire(ed.selWire);
    else if (ed.sel) ed.removePart(ed.sel);
  };

  /* resistor value: "220", "4.7k", "4k7", "1M", "10 kΩ" -> ohms (0.1 Ω .. 100 MΩ) */
  function parseOhm(t) {
    t = String(t).trim().replace(/\s+/g, '').replace(/[Ωω]|ohms?$/gi, '').replace(',', '.');
    const m = t.match(/^(\d*\.?\d*)([rkKmM]?)(\d*)$/);
    if (!m || !(m[1] + m[3]) || m[1] === '.') return null;
    const mul = { '': 1, r: 1, R: 1, k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[m[2]];
    const n = m[3] ? parseFloat((m[1] || '0') + '.' + m[3]) : parseFloat(m[1]); // 4k7 = 4.7k
    const v = Math.round(n * mul * 100) / 100;
    return isFinite(v) && v >= 0.1 && v <= 1e8 ? v : null;
  }
  function fmtOhm(v) {
    v = Number(v);
    const f = (x) => String(Math.round(x * 100) / 100);
    return v >= 1e6 ? f(v / 1e6) + 'M' : v >= 1e3 ? f(v / 1e3) + 'k' : f(v);
  }
  ed.parseOhm = parseOhm;

  /* ---------- properties panel ---------- */
  function renderProps() {
    const box = $('props');
    if (ed.selWire) {
      const w = ed.project.wires.find((x) => x.id === ed.selWire);
      if (!w) { box.hidden = true; return; }
      const pa = ed.part(w.a.p), pb = ed.part(w.b.p);
      box.hidden = false;
      box.innerHTML = `<h3>สายไฟ</h3><div class="muted small">${P[pa.type].name} ${IOTF.safety.esc(w.a.pin)} ↔ ${P[pb.type].name} ${IOTF.safety.esc(w.b.pin)}</div>
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
      if (max === 1 && step === 1 && min === 0) h += `<div class="row"><label>${unit || simLabel(k)}</label><input type="checkbox" data-sim="${k}" ${p.sim[k] ? 'checked' : ''}></div>`;
      else h += `<div class="row"><label>${simLabel(k)}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${p.sim[k]}" data-sim="${k}"><output>${fmt(p.sim[k], step)} ${unit}</output></div>`;
    });
    if (d.opts) Object.entries(d.opts).forEach(([k, list]) => {
      if (d.kind === 'resistor' && k === 'value') { // type any value: 220, 4.7k, 4k7, 1M
        h += `<div class="row"><label>ค่า (Ω)</label><input data-ohm list="ohmList" inputmode="decimal" placeholder="เช่น 220, 4.7k, 1M" value="${fmtOhm(p.attrs.value)}"><datalist id="ohmList">${list.map((v) => `<option value="${fmtOhm(v)}">`).join('')}</datalist></div>`;
        return;
      }
      h += `<div class="row"><label>${k === 'color' ? 'สี' : k === 'value' ? 'ค่า (Ω)' : k}</label><select data-attr="${k}">${list.map((v) => `<option ${p.attrs[k] == v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
    });
    if (d.kind === 'rfid') h += `<div class="row"><label>UID บัตร</label><input data-rfid value="${IOTF.safety.esc(p.sim.uid || 'DE AD BE EF')}"></div><div class="btnrow"><button class="btn pri" data-act="tap">แตะบัตร</button></div>`;
    if (d.kind === 'sd') h += `<div class="muted small" style="margin-top:6px">ดูไฟล์ที่เขียนได้ในแท็บ "ไฟล์ใน SD card" ด้านล่าง</div>`;
    if (d.kind === 'board') {
      const ni = ed.netInfo(p), bd = ed.boardDef(p), active = ed.board() === p;
      h += `<div class="row"><label>ชื่อบอร์ด</label><input id="boardNameInput" value="${IOTF.safety.esc(p.name || '')}"></div>`;
      if (bd.wifi) h += `<div class="pinlist"><b>MAC</b> ${ni.mac}<br><span class="mono">{${ni.macBytes.map((x) => '0x' + x.toString(16).toUpperCase().padStart(2, '0')).join(', ')}}</span><br><b>IP</b> ${ni.ip} (เมื่อต่อ WiFi)</div>`;
      else h += `<div class="pinlist">บอร์ดนี้ไม่มี WiFi/ESP-NOW ส่งข้อมูลหาบอร์ดอื่นได้ด้วย Serial หรือ LoRa</div>`;
      if (ed.boards().length > 1) h += `<div class="btnrow">${active ? '<span class="muted small">กำลังแก้โค้ดของบอร์ดนี้</span>' : '<button class="btn pri" data-act="editcode">แก้โค้ดของบอร์ดนี้</button>'}</div>`;
    }
    // pin connections
    const nets = ed.nets(), info = ed.els[p.id] ? ed.els[p.id].el.pinInfo || [] : [];
    if (d.kind === 'breadboard') h += `<div class="pinlist">รู a–e ในคอลัมน์เดียวกันต่อถึงกัน, f–j ก็เช่นกัน · แถว + และ − ต่อถึงกันทั้งแถว<br>วางขาอุปกรณ์ลงบนรูได้เลย (ระบบจัดให้ตรงรู) หรือลากสายจากรูไปที่ขาบอร์ด · ชี้ที่รูเพื่อดูว่ารูไหนต่อถึงกัน</div>`;
    else if (d.kind !== 'board') {
      const rows = info.filter((q) => q.name === base(q.name) || !info.some((o) => o.name === base(q.name))).map((q) => {
        const n = nets.netOf(p.id, q.name), g = nets.boardPinsOn(n), many = ed.boards().length > 1;
        let to = g.length ? g.map((x) => (many ? ed.boardName(ed.part(x.board)) + ' ' : '') + x.pin.replace(/\.\d+$/, '')).join(', ') : nets.hasGnd(n) ? 'GND' : nets.hasVcc(n) ? 'VCC' : '—';
        if (ed.isBasic() && ((d.tie || {})[q.name] || (q.signals || []).some((s) => s.type === 'power'))) to += ' (อัตโนมัติ)';
        return `<b>${q.name}</b> → ${to}`;
      });
      if (rows.length) h += `<div class="pinlist">${rows.join('<br>')}</div>`;
    }
    h += `<div class="btnrow">${ed.running ? '' : '<button class="btn" data-act="rot">หมุน (R)</button><button class="btn" data-act="dup">ทำซ้ำ (D)</button><button class="btn" data-act="del">ลบ</button>'}</div>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-sim]').forEach((inp) => inp.oninput = () => {
      const k = inp.dataset.sim;
      p.sim[k] = inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : +inp.value;
      const o = inp.nextElementSibling; if (o && o.tagName === 'OUTPUT') o.textContent = fmt(p.sim[k], d.sim[k][3]) + ' ' + d.sim[k][4];
      changed('sim');
    });
    const ohm = box.querySelector('[data-ohm]');
    if (ohm) {
      const apply = () => {
        const v = parseOhm(ohm.value);
        if (v == null) { ohm.classList.add('bad'); ohm.title = 'ใส่ตัวเลข เช่น 220, 4.7k, 1M'; return; }
        ohm.classList.remove('bad'); ohm.title = '';
        if (String(v) !== String(p.attrs.value)) { snapshot(); p.attrs.value = String(v); ed.applyAttrs(p); changed('style'); }
        ohm.value = fmtOhm(v);
      };
      ohm.onchange = apply;
      ohm.onkeydown = (e) => { if (e.key === 'Enter') { apply(); ohm.blur(); } };
    }
    box.querySelectorAll('[data-attr]').forEach((s) => s.onchange = () => { p.attrs[s.dataset.attr] = s.value; ed.applyAttrs(p); changed('style'); });
    const r = box.querySelector('[data-rfid]'); if (r) r.oninput = () => { p.sim.uid = r.value; };
    const tap = box.querySelector('[data-act=tap]'); if (tap) tap.onclick = () => { p.sim.tap = Date.now(); if (IOTF.sim) IOTF.sim.event('rfid', p); };
    const rot = box.querySelector('[data-act=rot]'); if (rot) rot.onclick = ed.rotateSel;
    const dup = box.querySelector('[data-act=dup]'); if (dup) dup.onclick = ed.duplicateSel;
    const del = box.querySelector('[data-act=del]'); if (del) del.onclick = () => ed.removePart(p.id);
    const bn = box.querySelector('#boardNameInput'); if (bn) bn.onchange = () => { p.name = bn.value.trim() || nextBoardName(p.type); refreshBoardLabels(); changed('active'); };
    const ec = box.querySelector('[data-act=editcode]'); if (ec) ec.onclick = () => { ed.setActiveBoard(p.id); renderProps(); };
  }
  ed.renderProps = renderProps;
  const fmt = (v, step) => (+v).toFixed(step < 1 ? (String(step).split('.')[1] || '').length : 0);
  function simLabel(k) {
    return { temp: 'อุณหภูมิ', hum: 'ความชื้น', distance: 'ระยะทาง', motion: 'มีการเคลื่อนไหว', level: 'ระดับ', bpm: 'ชีพจร', tilted: 'เอียง', ph: 'ค่า pH', ppm: 'TDS', weight: 'น้ำหนัก', lat: 'ละติจูด', lng: 'ลองจิจูด', sats: 'ดาวเทียม', ax: 'Accel X', ay: 'Accel Y', az: 'Accel Z', gx: 'Gyro X', gy: 'Gyro Y', gz: 'Gyro Z', pressure: 'ความกดอากาศ', lux: 'ความสว่าง', pm1: 'PM1.0', pm25: 'PM2.5', pm10: 'PM10', current: 'กระแส', voltage: 'แรงดัน', pf: 'Power Factor', freq: 'ความถี่', flow: 'อัตราการไหล', spo2: 'SpO2', finger: 'วางนิ้ว', ppt: 'ความเค็ม', black: 'เส้นดำ', detect: 'ตรวจพบ' }[k] || k;
  }

  /* ---------- palette ---------- */
  const CAT_ICON = { 'บอร์ด': '#4772b3', 'เบรดบอร์ด': '#d9d4c3', 'เซ็นเซอร์': '#3cb371', 'จอแสดงผล': '#22a6c9', 'ไฟและเสียง': '#e87d0d', 'อินพุต': '#c084fc', 'มอเตอร์': '#e5484d', 'โมดูล': '#b8b8b8' };
  ed.renderPalette = function () {
    const q = $('partSearch').value.trim().toLowerCase(), basic = ed.isBasic();
    // every word typed must appear (Thai or English name, extra words, id), so "soil", "temp sensor" or "มอเตอร์" all work
    const words = q.split(/\s+/).filter(Boolean).map((w) => w.replace(/[-_]/g, ''));
    const hay = (d) => (d.search || (d.name + ' ' + d.key).toLowerCase()).replace(/[-_]/g, '');
    const list = Object.values(P).filter((d) => (!basic || d.level === 'basic') && words.every((w) => hay(d).includes(w)));
    $('paletteHint').textContent = basic ? `Basic: ${list.length} ชิ้น (ต่อง่าย) · Advanced มีทั้งหมด ${Object.keys(P).length} ชิ้น` : `Advanced: ${list.length} ชิ้น`;
    let h = '';
    IOTF.CATS.forEach((c) => {
      const items = list.filter((d) => d.cat === c);
      if (!items.length) return;
      h += `<div class="cat"><h5>${c}</h5>` + items.map((d) => `<div class="pitem" data-type="${d.key}" title="คลิกเพื่อเพิ่ม หรือลากไปวางตรงที่ต้องการ"><span class="thumb" data-t="${d.key}" style="--c:${CAT_ICON[c]}"></span><span class="nm">${d.name}${q && d.en && !/^[\x00-\x7f]*$/.test(d.name) ? `<small>${d.en}</small>` : ''}</span>${!basic && d.level !== 'basic' ? '<span class="lvl">ADV</span>' : ''}</div>`).join('') + '</div>';
    });
    const advOnly = basic && q ? Object.values(P).filter((d) => d.level !== 'basic' && words.every((w) => hay(d).includes(w))).length : 0;
    $('partList').innerHTML = h || `<p class="muted small">ไม่พบอุปกรณ์${advOnly ? ` ในโหมด Basic (มีในโหมด Advanced ${advOnly} ชิ้น)` : ''}</p>`;    $('partList').querySelectorAll('.thumb').forEach((t) => t.appendChild(thumbFor(t.dataset.t)));
    requestAnimationFrame(() => fitThumbs());
  };
  /* ---------- part pictures: thumbnails in the list and the shadow while dragging ---------- */
  // a real part element (same drawing as on the stage), made once per type and moved between list renders
  const thumbs = {};
  function partPicture(type) {
    const d = P[type], el = document.createElement(d.tag);
    Object.entries(d.attrs || {}).forEach(([k, v]) => { try { el[k] = v; } catch (e) { /* read-only */ } });
    el.style.cssText = 'position:absolute;left:0;top:0;display:inline-block;transform-origin:0 0;pointer-events:none';
    return el;
  }
  function thumbFor(type) {
    if (!thumbs[type]) { const box = document.createElement('span'); box.className = 'tbox'; const el = partPicture(type); box.appendChild(el); thumbs[type] = { box, el, ok: false }; }
    return thumbs[type].box;
  }
  function fitThumbs(tries = 0) {
    let left = false;
    Object.values(thumbs).forEach((t) => {
      if (t.ok || !t.box.isConnected) return;
      t.el.style.transform = 'none';
      const w = t.el.offsetWidth, h = t.el.offsetHeight;
      if (!w || !h) { left = true; return; }
      const W = 46, H = 34, k = Math.min(W / w, H / h, 1);
      t.el.style.transform = `translate(${(W - w * k) / 2}px,${(H - h * k) / 2}px) scale(${k})`;
      t.ok = true;
    });
    if (left && tries < 20) setTimeout(() => fitThumbs(tries + 1), 150); // drawings that are still rendering
  }
  ed.fitThumbs = () => requestAnimationFrame(() => fitThumbs());

  // add a part in the middle of the visible stage (double-click, or a tap on a phone/tablet)
  ed.addAtCenter = function (type) {
    if (ed.running) return;
    if (IOTF.app && IOTF.app.showView) IOTF.app.showView('stage'); // phone layout: jump to the circuit
    const r = $('stage').getBoundingClientRect(); const w = ed.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    const n = ed.project.parts.length; ed.addPart(type, w.x - 40 + (n % 4) * 20, w.y - 30 + (n % 3) * 20);
  };
  ed.initPalette = function () {
    $('partSearch').oninput = ed.renderPalette;
    $('partList').addEventListener('pointerenter', () => ed.fitThumbs()); // e.g. the list was hidden on a phone when it was drawn
    $('partList').addEventListener('pointerdown', (e) => {
      const it = e.target.closest('.pitem'); if (!it || ed.running) return;
      const type = it.dataset.type;
      if (e.pointerType !== 'mouse') { // touch/pen: a tap adds the part, a swipe scrolls the list
        const sx = e.clientX, sy = e.clientY;
        const tup = (ev) => {
          window.removeEventListener('pointerup', tup); window.removeEventListener('pointercancel', tcancel);
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 10) ed.addAtCenter(type);
        };
        const tcancel = () => { window.removeEventListener('pointerup', tup); window.removeEventListener('pointercancel', tcancel); };
        window.addEventListener('pointerup', tup); window.addEventListener('pointercancel', tcancel);
        return;
      }
      e.preventDefault();
      // the shadow: the part itself, at the stage's zoom, following the pointer
      const ghost = document.createElement('div'), pic = partPicture(type);
      ghost.className = 'dragghost'; ghost.appendChild(pic);
      let dragging = false;
      const mv = (ev) => {
        if (!dragging && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 4) { dragging = true; document.body.appendChild(ghost); document.body.classList.add('dragpart'); }
        if (!dragging) return;
        const r = $('stage').getBoundingClientRect(), inStage = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
        const z = inStage ? ed.zoom : Math.min(ed.zoom, 0.6);
        // the part's corner sits where it will land (the drop puts it 20,15 up-left of the pointer)
        ghost.style.transform = `translate(${ev.clientX - 20 * z}px,${ev.clientY - 15 * z}px) scale(${z})`;
        ghost.classList.toggle('out', !inStage);
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ghost.remove(); document.body.classList.remove('dragpart');
        if (!dragging) { ed.addAtCenter(type); return; } // a plain click adds it in the middle of the view
        const r = $('stage').getBoundingClientRect();
        if (ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) {
          const w = ed.toWorld(ev.clientX, ev.clientY), np = ed.addPart(type, w.x - 20, w.y - 15);
          if (np) setTimeout(() => { if (ed.snapToBreadboard(np)) changed('move'); }, 80);
        }
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
  };


  ed.setRunning = function (on) {
    ed.running = on; document.body.classList.toggle('running', on);
    if (!ed.project) return;
    if (on) cancelArm();
    hint(); renderProps();
  };
})();
