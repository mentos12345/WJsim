/* WJSIM — simulation runtime: Arduino API + library shims driving the parts on the canvas */
(function () {
  'use strict';
  const ed = IOTF.editor, P = IOTF.PARTS;
  const STOP = { stop: true };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // one simulated device per board on the canvas; each runs its own program
  const sim = { running: false, gen: 0, listeners: [], timers: [], sd: {}, warnOnce: new Set(), partState: {}, devices: [], devByBoard: {} };
  IOTF.sim = sim;

  /* ---------- serial monitor ---------- */
  let serBuf = '', serTimer = null;
  // Arduino String methods that JS strings lack
  [['toInt', function () { return parseInt(this, 10) || 0; }], ['toFloat', function () { return parseFloat(this) || 0; }], ['toDouble', function () { return parseFloat(this) || 0; }],
    ['equals', function (o) { return String(this) === String(o); }], ['equalsIgnoreCase', function (o) { return String(this).toLowerCase() === String(o).toLowerCase(); }],
    ['compareTo', function (o) { return String(this) < String(o) ? -1 : String(this) > String(o) ? 1 : 0; }], ['isEmpty', function () { return this.length === 0; }]
  ].forEach(([k, f]) => { if (!String.prototype[k]) Object.defineProperty(String.prototype, k, { value: f, configurable: true, writable: true }); });
  function serialWrite(text, cls) {
    if (cls) { flushSerial(); const el = document.getElementById('serialOut'); const s = document.createElement('span'); s.className = cls; s.textContent = text; el.appendChild(s); trimSerial(el); el.scrollTop = el.scrollHeight; return; }
    serBuf += text;
    if (!serTimer) serTimer = requestAnimationFrame(flushSerial);
  }
  function flushSerial() {
    serTimer = null; if (!serBuf) return;
    const el = document.getElementById('serialOut');
    el.appendChild(document.createTextNode(serBuf)); serBuf = '';
    trimSerial(el); el.scrollTop = el.scrollHeight;
  }
  function trimSerial(el) { while (el.childNodes.length > 400) el.removeChild(el.firstChild); }
  sim.log = (t, cls) => serialWrite(t + '\n', cls || 'sinfo');
  // with several boards running, every line gets the board's name in front
  function serialWriteDev(dev, text, cls) {
    if (dev && sim.devices.length > 1) {
      let out = '';
      for (const ch of String(text)) { if (dev.atLineStart) { out += '[' + dev.name + '] '; dev.atLineStart = false; } out += ch; if (ch === '\n') dev.atLineStart = true; }
      text = out;
    }
    serialWrite(text, cls);
  }
  function warnDev(dev, key, msg) { const k = (dev ? dev.id : '') + key; if (sim.warnOnce.has(k)) return; sim.warnOnce.add(k); if (dev) dev.atLineStart = true; serialWriteDev(dev, '⚠ ' + msg + '\n', 'swarn'); }

  /* ---------- circuit queries ---------- */
  function powered(p) { return ed.isPowered(p, sim.nets); }
  function members(net) {
    if (!sim.memo[net]) sim.memo[net] = sim.nets.members(net).map((m) => ({ part: ed.part(m.p), pin: m.pin })).filter((m) => m.part);
    return sim.memo[net];
  }
  const netOf = (p, pin) => sim.nets.netOf(p.id, pin);
  const gpioNetOf = (dev, g) => sim.nets.gpioNet(g, dev.id);
  function partsOfKind(kinds) { return ed.project.parts.filter((p) => kinds.includes(P[p.type].kind)); }
  function findPartDev(kinds, pin, gpio, dev) {
    const list = partsOfKind(kinds);
    if (gpio !== undefined && gpio !== null) {
      const n = gpioNetOf(dev, gpio);
      const hit = list.find((p) => n && netOf(p, (P[p.type].alias || {})[pin] || pin) === n);
      if (hit) return hit;
      if (!ed.isBasic()) return null;
    }
    return list[0] || null;
  }
  function busOk(p, sigs) { // I2C / SPI devices: in Advanced the bus pins must reach the board
    if (ed.isBasic()) return true;
    if (!powered(p)) return false;
    return sigs.every((pin) => sim.nets.gpiosOn(netOf(p, pin)).length > 0);
  }
  function el(p) { return ed.els[p.id] && ed.els[p.id].el; }
  function st(p) { return sim.partState[p.id] || (sim.partState[p.id] = {}); }

  // level a part drives onto one of its pins (undefined = not driving)
  function partDrive(p, pin, depth) {
    const d = P[p.type], s = p.sim, e = el(p);
    if (!powered(p) && !['button', 'slideswitch', 'dip'].includes(d.kind)) return undefined;
    switch (d.kind) {
      case 'button': {
        if (!(e && e.pressed) && !st(p).pressed) return undefined;
        const other = pin.startsWith('1') ? '2.l' : '1.l';
        return netLevel(netOf(p, other), depth + 1, p);
      }
      case 'slideswitch': {
        const v = e ? e.value : 0, con = v ? '3' : '1';
        if (pin === '2') return netLevel(netOf(p, con), depth + 1, p);
        if (pin === con) return netLevel(netOf(p, '2'), depth + 1, p);
        return undefined;
      }
      case 'dip': {
        const m = /^(\d)([ab])$/.exec(pin); if (!m || !e || !e.values[+m[1] - 1]) return undefined;
        return netLevel(netOf(p, m[1] + (m[2] === 'a' ? 'b' : 'a')), depth + 1, p);
      }
      case 'pir': return pin === 'OUT' ? (s.motion ? 1 : 0) : undefined;
      case 'tilt': return pin === 'OUT' ? (s.tilted ? 1 : 0) : undefined;
      case 'analogmod': return pin === d.digitalPin ? (s.level > 50 ? 0 : 1) : undefined;
      case 'joystick': return pin === 'SEL' ? (e && e.pressed ? 0 : 1) : undefined;
      case 'encoder': { const q = st(p); if (pin === 'CLK') return q.clk ?? 1; if (pin === 'DT') return q.dt ?? 1; if (pin === 'SW') return e && e.pressed ? 0 : 1; return undefined; }
      case 'dialer': { const q = st(p); if (pin === 'DIAL') return q.dial ?? 1; if (pin === 'PULSE') return q.pulse ?? 1; return undefined; }
      case 'ultrasonic': return pin === 'ECHO' ? 0 : undefined;
      case 'irrecv': return pin === 'DAT' ? 1 : undefined;
      case 'heartbeat': return pin === 'OUT' ? (heartWave(s.bpm) > 0.5 ? 1 : 0) : undefined;
      case 'dsensor': { if (pin !== d.outPin) return undefined; const on = s.detect || st(p).pressed ? 1 : 0; return d.activeLow ? 1 - on : on; }
      case 'line': return pin === 'DO' ? (s.black ? 1 : 0) : undefined;
      case 'flow': { if (pin !== 'OUT') return undefined; const f = 7.5 * s.flow; return f > 0 ? Math.floor(performance.now() / 1000 * f * 2) % 2 : 1; }
    }
    return undefined;
  }
  // logic level of a net (0/1/undefined); `except` = gpio being read
  function netLevel(net, depth = 0, skipPart = null, except = null) {
    if (net == null || depth > 4) return undefined;
    if (sim.nets.hasGnd(net)) return 0;
    if (sim.nets.hasVcc(net)) return 1;
    const pins = sim.nets.boardPinsOn(net);
    for (const x of pins) {
      const dv = sim.devByBoard[x.board]; if (!dv) continue;
      if (except && except.dev === dv && except.g === x.gpio) continue;
      const o = dv.out[x.gpio];
      if (o && o.mode === 1) return o.v > 0 ? 1 : 0;
    }
    for (const m of members(net)) {
      if (m.part === skipPart || P[m.part.type].kind === 'board') continue;
      const v = partDrive(m.part, m.pin, depth);
      if (v !== undefined) return v;
    }
    for (const x of pins) { const dv = sim.devByBoard[x.board], o = dv && dv.out[x.gpio]; if (o && (o.mode === 2 || o.pull)) return 1; if (o && o.mode === 3) return 0; }
    return undefined;
  }
  function pwmOf(net) {
    for (const x of sim.nets.boardPinsOn(net)) { const dv = sim.devByBoard[x.board], o = dv && dv.out[x.gpio]; if (o && o.mode === 1) return o.v; }
    if (sim.nets.hasVcc(net)) return 1;
    return 0;
  }
  function heartWave(bpm) { const t = (performance.now() / 1000) * bpm / 60 % 1; return Math.exp(-Math.pow((t - 0.15) / 0.03, 2)) + 0.25 * Math.exp(-Math.pow((t - 0.4) / 0.08, 2)); }
  function tdsVoltage(ppm) { // inverse of the common DFRobot formula (25°C)
    const f = (v) => (133.42 * v * v * v - 255.86 * v * v + 857.39 * v) * 0.5;
    let lo = 0, hi = 3.3; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) < ppm) lo = m; else hi = m; } return (lo + hi) / 2;
  }
  /* ---------- motors: how hard a motor terminal is driven (0..1 of full supply, undefined = floating) ---------- */
  function hbridgeOut(p, pin) {
    if (!powered(p)) return undefined;
    let inPin, enPin = null;
    if (p.type === 'iotf-l298n') { const m = { OUT1: ['IN1', 'ENA'], OUT2: ['IN2', 'ENA'], OUT3: ['IN3', 'ENB'], OUT4: ['IN4', 'ENB'] }[pin]; if (!m) return undefined; [inPin, enPin] = m; }
    else { inPin = { A1: 'A-IA', A2: 'A-IB', B1: 'B-IA', B2: 'B-IB' }[pin]; if (!inPin) return undefined; }
    let duty = 1;
    if (enPin) { const en = netOf(p, enPin), lv = netLevel(en); duty = lv === undefined ? 1 : lv ? pwmOf(en) : 0; } // ENA/ENB jumper on when not wired
    if (!duty) return undefined;                                   // outputs off: the motor coasts
    const n = netOf(p, inPin), lv = netLevel(n);
    if (lv === undefined) return undefined;
    return lv ? duty * (enPin ? 1 : pwmOf(n)) : 0;
  }
  function driveOf(net, depth = 0) {
    if (net == null || depth > 3) return undefined;
    if (sim.nets.hasGnd(net)) return 0;
    if (sim.nets.hasVcc(net)) return 1;
    for (const m of members(net)) {
      const d = P[m.part.type];
      if (d.kind === 'hbridge') { const v = hbridgeOut(m.part, m.pin); if (v !== undefined) return v; }
      if (d.kind === 'relay') { // follow a closed relay contact to its common terminal
        const k = /^(NO|NC)(\d)$/.exec(m.pin); if (!k) continue;
        const on = netLevel(netOf(m.part, 'COIL1')) === 1 && netLevel(netOf(m.part, 'COIL2')) !== 1;
        if ((k[1] === 'NO') === on) { const v = driveOf(netOf(m.part, 'COM' + k[2]), depth + 1); if (v !== undefined) return v; }
      }
    }
    const lv = netLevel(net);
    if (lv === undefined) return undefined;
    return lv ? pwmOf(net) : 0;
  }
  sim.motorSpeed = function (p) {
    const a = driveOf(netOf(p, 'M+')), b = driveOf(netOf(p, 'M-'));
    if (a === undefined || b === undefined) return 0;
    return clamp(a - b, -1, 1);
  };

  /* ---------- steppers ---------- */
  const HALF = ['1000', '1100', '0100', '0110', '0010', '0011', '0001', '1001'];
  function turnStepper(p, deg) {
    const q = st(p); q.angle = (q.angle || 0) + deg;
    const e = el(p); if (e && p.type === 'stepper-motor') e.angle = ((q.angle % 360) + 360) % 360;
  }
  // a pin changed: coil patterns on a ULN2003, or a STEP pulse into an A4988
  sim.pinWritten = function (dev, g, old, v) {
    const n = gpioNetOf(dev, g); if (n == null) return;
    members(n).forEach((m) => {
      const d = P[m.part.type];
      if (m.part.type === 'iotf-28byj48' && /^IN\d$/.test(m.pin) && powered(m.part)) {
        const pat = ['IN1', 'IN2', 'IN3', 'IN4'].map((x) => (netLevel(netOf(m.part, x)) === 1 ? '1' : '0')).join(''), i = HALF.indexOf(pat), q = st(m.part);
        if (i >= 0) { if (q.ph !== undefined) { const dd = (i - q.ph + 8) % 8; if (dd && dd <= 2) turnStepper(m.part, dd * 360 / 4096); else if (dd >= 6) turnStepper(m.part, -(8 - dd) * 360 / 4096); } q.ph = i; }
      }
      if (d.kind === 'a4988' && m.pin === 'STEP' && !old && v && powered(m.part)) a4988Step(m.part);
    });
  };
  function a4988Step(a) {
    if (netLevel(netOf(a, 'EN')) === 1) return; // EN is active LOW
    const ms = ['MS1', 'MS2', 'MS3'].map((x) => (netLevel(netOf(a, x)) === 1 ? 1 : 0)).join('');
    const div = { '000': 1, '100': 2, '010': 4, '110': 8, '111': 16 }[ms] || 1;
    const dir = netLevel(netOf(a, 'DIR')) === 1 ? 1 : -1;
    const motor = stepperOfDriver(a);
    if (motor) turnStepper(motor, dir * 1.8 / div);
  }
  function stepperOfDriver(a) {
    const outs = ['1A', '1B', '2A', '2B'].map((x) => netOf(a, x)).filter((x) => x != null);
    const list = partsOfKind(['stepper']).filter((p) => p.type === 'stepper-motor');
    return list.find((p) => ['A-', 'A+', 'B+', 'B-'].some((x) => outs.includes(netOf(p, x)))) || list[0] || null;
  }
  sim.a4988Step = a4988Step; sim.turnStepper = turnStepper; sim.stepperOfDriver = stepperOfDriver;

  // voltage on a net, in volts
  function netVoltageDev(net, dev) {
    const B = (dev || sim.devices[0]).bd, V = B.vref;
    for (const m of members(net)) {
      const p = m.part, d = P[p.type], s = p.sim, e = el(p);
      if (d.kind === 'board') continue;
      if (!powered(p)) continue;
      const pin = m.pin;
      switch (d.kind) {
        case 'pot': if (pin === 'SIG' && e) return V * (e.value - (e.min || 0)) / ((e.max || 1023) - (e.min || 0)); break;
        case 'joystick': if (pin === 'VERT' && e) return V * (1 - (e.yValue + 1) / 2); if (pin === 'HORZ' && e) return V * (1 - (e.xValue + 1) / 2); break;
        case 'analogmod': if (pin === d.analogPin) return V * (d.invert ? 1 - s.level / 100 : s.level / 100); break;
        case 'ntc': if (pin === 'OUT') { const k = Math.exp(3950 * (1 / (s.temp + 273.15) - 1 / 298.15)); return V / (1 + 1 / k); } break;
        case 'heartbeat': if (pin === 'OUT') return V * (0.3 + 0.5 * heartWave(s.bpm)); break;
        case 'ph': if (pin === 'Po') return Math.min(V, s.ph / 3.5); break;
        case 'tds': if (pin === 'A') return Math.min(V, tdsVoltage(s.ppm)); break;
        case 'salinity': if (pin === 'AO') return Math.min(V, s.ppt / 50 * 3.0); break; // 0–3.0 V = 0–50 ppt
        case 'line': if (pin === 'AO') return V * (s.black ? 0.85 : 0.08); break;
        case 'acs712': if (pin === 'OUT') return clamp(V / 2 + 0.185 * s.current, 0, V); break;
      }
    }
    const lv = netLevel(net);
    if (lv !== undefined) return lv ? (sim.nets.hasVcc(net) ? V : pwmOf(net) * V) : 0;
    return 0;
  }

  /* ---------- pin numbers ---------- */
  function toGpio(pin) {
    if (typeof pin === 'string' && /^\d+$/.test(pin)) pin = +pin;
    return pin;
  }
  function analogGpioDev(dev, pin) {
    pin = toGpio(pin);
    const B = dev.bd;
    if (B !== IOTF.BOARDS.esp32 && typeof pin === 'number') {
      const first = B.consts.A0;
      if (first !== undefined && pin < first && pin < (B === IOTF.BOARDS.mega ? 16 : 8)) return first + pin;
    }
    return pin;
  }

  // power/trigger LEDs and small effects on the drawn sensors
  function customLook(p, d, e, on) {
    const set = (sel, attr, v) => { const x = e.q(sel); if (x && x.getAttribute(attr) !== String(v)) x.setAttribute(attr, v); };
    const s = p.sim;
    set('.pled', 'fill', on ? '#ff3b30' : '#4a1414');
    let trig = false;
    if (d.kind === 'analogmod') trig = s.level > 50;
    else if (d.kind === 'dsensor') trig = !!(s.detect || st(p).pressed);
    else if (d.kind === 'line') trig = !s.black;
    set('.dled', 'fill', on && trig ? '#3cff6e' : '#14361f');
    set('.pad', 'opacity', on && trig ? 0.85 : 0);
    set('.mag', 'opacity', s.detect ? 1 : 0);
    if (p.type === 'iotf-salinity') set('.salt', 'fill', `hsl(${Math.round(200 - s.ppt * 0.4)} 75% ${Math.round(72 - s.ppt * 0.6)}%)`); // fresh: light blue, sea: deep blue
    set('.wet', 'opacity', p.type === 'iotf-rain' ? (s.level / 100 * 0.6).toFixed(2) : 0);
    if (p.type === 'iotf-waterlevel') { const h = (s.level / 100 * 62).toFixed(1); set('.water', 'y', (70 - h).toFixed(1)); set('.water', 'height', h); }
    if (p.type === 'iotf-sw420') set('.shake', 'x', on && s.detect ? 20 + Math.round(Math.sin(performance.now() / 25) * 3) : 20);
  }

  /* ---------- outputs → parts ---------- */
  function refresh() {
    if (!sim.running) return;
    ed.project.parts.forEach((p) => {
      const d = P[p.type], e = el(p); if (!e) return;
      if (d.kind === 'breadboard') return;
      const on = powered(p);
      if (e.q && d.tag.startsWith('iotf-')) customLook(p, d, e, on);
      switch (d.kind) {
        case 'board': {
          const dv = sim.devByBoard[p.id]; if (!dv) break;
          const B = dv.bd, o = dv.out[B.led.pin]; e[B.led.prop] = !!(o && o.mode === 1 && o.v > 0);
          if ('ledPower' in e) e.ledPower = true;
          break;
        }
        case 'led': {
          const a = netLevel(netOf(p, 'A')), c = netLevel(netOf(p, 'C'));
          const lit = a === 1 && (c === 0 || (c === undefined && ed.isBasic()));
          e.value = lit; e.brightness = lit ? Math.max(0.15, pwmOf(netOf(p, 'A'))) : 0;
          break;
        }
        case 'rgb': {
          const com = netLevel(netOf(p, 'COM')), anode = com === 1;
          ['R', 'G', 'B'].forEach((ch, i) => {
            const n = netOf(p, ch), lv = netLevel(n); let v = lv === undefined ? 0 : pwmOf(n);
            if (anode) v = lv === undefined ? 0 : 1 - v;
            e[['ledRed', 'ledGreen', 'ledBlue'][i]] = clamp(v, 0, 1);
          });
          break;
        }
        case 'bargraph': e.values = Array.from({ length: 10 }, (_, i) => (netLevel(netOf(p, 'A' + (i + 1))) === 1 && netLevel(netOf(p, 'C' + (i + 1))) !== 1) ? 1 : 0); break;
        case 'seg7': {
          const com = netLevel(netOf(p, 'COM.1')), anode = com === 1;
          const v = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'].map((s) => { const l = netLevel(netOf(p, s)); return l === undefined ? 0 : (anode ? (l === 0 ? 1 : 0) : l); });
          if (v.join() !== (e.values || []).join()) e.values = v;
          break;
        }
        case 'buzzer': {
          const n = netOf(p, '2'), tn = sim.nets.boardPinsOn(n).map((x) => sim.devByBoard[x.board] && sim.devByBoard[x.board].tones[x.gpio]).find(Boolean);
          const level = netLevel(n) === 1;
          e.hasSignal = !!(on && (tn || level));
          sound(p.id, on && tn ? tn.freq : 0);
          break;
        }
        case 'relay': ed.els[p.id].wrap.classList.toggle('energized', netLevel(netOf(p, 'COIL1')) === 1 && netLevel(netOf(p, 'COIL2')) !== 1); break;
        case 'relay4': for (let i = 1; i <= 4; i++) { const c = e.q && e.q('.ch' + i); if (c) c.setAttribute('fill', on && netLevel(netOf(p, 'IN' + i)) === 0 ? '#ff2a2a' : '#4a1414'); } break;
        case 'gps': { const c = e.q && e.q('.fix'); if (c) c.setAttribute('fill', on && p.sim.sats >= 3 && (performance.now() % 1000) < 120 ? '#ff3b30' : '#5a1a17'); break; }
        case 'loadcell': { const t = e.q && e.q('.kg'); if (t) t.textContent = p.sim.weight + ' g'; break; }
        case 'hx711': { const lc = partsOfKind(['loadcell'])[0]; if (lc) p.sim.weight = lc.sim.weight; break; }
        case 'dcmotor': {
          const sp = on ? sim.motorSpeed(p) : 0, q = st(p), t = performance.now(), dt = Math.min(100, t - (q.t || t)); q.t = t; q.speed = sp;
          if (p.type === 'iotf-dcmotor') {
            q.rot = ((q.rot || 0) + sp * dt * 0.72) % 360; // shown slower than 200 RPM so it can be followed
            const r = e.q && e.q('.rotor'); if (r) r.setAttribute('transform', `rotate(${q.rot.toFixed(1)} 62 75)`);
            const tx = e.q && e.q('.rpm'), rpm = Math.round(Math.abs(sp) * (d.rpm || 200));
            if (tx) { const s2 = rpm ? `${sp < 0 ? '◀ ' : ''}${rpm} RPM${sp > 0 ? ' ▶' : ''}` : '0 RPM'; if (tx.textContent !== s2) tx.textContent = s2; }
          } else if (p.type === 'iotf-pump') {
            const w = e.q && e.q('.water'); if (w) w.setAttribute('opacity', Math.abs(sp) > 0.15 ? (0.5 + 0.5 * Math.abs(Math.sin(t / 120))).toFixed(2) : 0);
          } else if (p.type === 'iotf-vibmotor') {
            const g2 = e.q && e.q('.shake'); if (g2) g2.setAttribute('transform', Math.abs(sp) > 0.15 ? `translate(${(Math.sin(t / 18) * 3 * Math.abs(sp)).toFixed(1)} ${(Math.cos(t / 23) * 2 * Math.abs(sp)).toFixed(1)})` : '');
          }
          break;
        }
        case 'stepper': if (p.type === 'iotf-28byj48' && e.q) {
          const r = e.q('.rotor'); if (r) r.setAttribute('transform', `rotate(${(((st(p).angle || 0) % 360) + 360) % 360} 140 50)`);
          ['IN1', 'IN2', 'IN3', 'IN4'].forEach((x, i) => { const c = e.q('.ph' + i); if (c) c.setAttribute('fill', on && netLevel(netOf(p, x)) === 1 ? '#ff3b30' : '#4a1414'); });
        } break;
        case 'flow': { const r = e.q && e.q('.rotor'); if (r) { const a = ((st(p).rot || 0) + (on ? p.sim.flow * 1.2 : 0)) % 360; st(p).rot = a; r.setAttribute('transform', `rotate(${a} 104 78)`); } break; }
        case 'oximeter': { const r = e.q && e.q('.beat'); if (r) r.setAttribute('fill', on && p.sim.finger && heartWave(p.sim.bpm) > 0.5 ? '#ff3b30' : '#3a0d0d'); break; }
      }
    });
  }
  function safeCallDev(fn, dev) { try { const r = fn(); if (r && r.catch) r.catch((e) => onError(e, dev)); } catch (e) { onError(e, dev); } }

  /* ---------- audio ---------- */
  let actx = null; const osc = {};
  function sound(id, freq) {
    const cur = osc[id];
    if (!freq) { if (cur) { cur.o.stop(); delete osc[id]; } return; }
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (cur) { if (cur.f !== freq) { cur.o.frequency.value = freq; cur.f = freq; } return; }
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.value = freq; g.gain.value = 0.03; o.connect(g).connect(actx.destination); o.start();
      osc[id] = { o, f: freq };
    } catch (e) { /* audio not available */ }
  }

  function readPinDev(dev, g) {
    const o = dev.out[g];
    if (o && o.mode === 1) return o.v > 0 ? 1 : 0;
    const n = gpioNetOf(dev, g);
    const lv = netLevel(n, 0, null, { dev, g });
    if (lv !== undefined) return lv;
    if (o && (o.mode === 2 || o.pull)) return 1;
    return 0;
  }

  /* ---------- printing helpers ---------- */
  function fmtNum(v, f) {
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (typeof v !== 'number') return String(v);
    if (f === 16) return (v >>> 0).toString(16).toUpperCase();
    if (f === 2) return (v >>> 0).toString(2);
    if (f === 8) return (v >>> 0).toString(8);
    if (f === 10) return String(Math.trunc(v));
    if (Number.isNaN(v)) return 'nan';
    if (!Number.isFinite(v)) return 'inf';
    if (f !== undefined) return v.toFixed(f);
    return Number.isInteger(v) && !sim.floatHint ? String(v) : v.toFixed(2);
  }
  function sprintf(fmt, ...args) {
    let i = 0;
    return String(fmt).replace(/%([-+0 #]*)(\d+)?(?:\.(\d+))?(l{0,2}|h)?([diufFeEgGxXcsop%])/g, (m, flags, w, prec, len, t) => {
      if (t === '%') return '%';
      let a = args[i++], s;
      switch (t) {
        case 'd': case 'i': case 'u': s = String(Math.trunc(Number(a) || 0)); break;
        case 'f': case 'F': s = (Number(a) || 0).toFixed(prec === undefined ? 6 : +prec); break;
        case 'e': case 'E': s = (Number(a) || 0).toExponential(prec === undefined ? 6 : +prec); break;
        case 'g': case 'G': s = String(+(Number(a) || 0).toPrecision(prec === undefined ? 6 : +prec || 1)); break;
        case 'x': s = (Number(a) >>> 0).toString(16); break;
        case 'X': s = (Number(a) >>> 0).toString(16).toUpperCase(); break;
        case 'o': s = (Number(a) >>> 0).toString(8); break;
        case 'c': s = typeof a === 'number' ? String.fromCharCode(a) : String(a)[0] || ''; break;
        default: s = String(a);
      }
      if (w) s = flags.includes('-') ? s.padEnd(+w) : s.padStart(+w, flags.includes('0') && t !== 's' ? '0' : ' ');
      if (flags.includes('0') && w && s.startsWith('0-')) s = '-' + s.slice(2).padStart(+w - 1, '0');
      return s;
    });
  }

  /* ---------- the environment the user program runs in ---------- */
  function makeEnv(dev) {
    const B = dev.bd, board = dev.part;
    const env = {};
    // device-bound versions of the shared helpers
    const gpioNet = (g) => gpioNetOf(dev, g);
    const readPin = (g) => readPinDev(dev, g);
    const findPart = (k, pin, g) => findPartDev(k, pin, g, dev);
    const warn = (k, m) => warnDev(dev, k, m);
    const serialWrite = (t, c) => serialWriteDev(dev, t, c);
    const netVoltage = (n) => netVoltageDev(n, dev);
    const analogGpio = (pin) => analogGpioDev(dev, pin);
    const safeCall = (fn) => safeCallDev(fn, dev);
    // parts that belong to this board: with several boards, only those wired to it (or wired to no board at all)
    const touches = (p, boardId) => { const info = ed.els[p.id] ? ed.els[p.id].el.pinInfo || [] : []; return info.some((q) => sim.nets.boardPinsOn(netOf(p, q.name)).some((x) => !boardId || x.board === boardId)); };
    const mine = (kinds) => {
      const list = partsOfKind(kinds);
      if (sim.devices.length < 2) return list;
      const own = list.filter((p) => touches(p, dev.id));
      return own.length ? own : list.filter((p) => !touches(p));
    };
    const C = Object.assign({
      HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, INPUT_PULLDOWN: 3, CHANGE: 1, FALLING: 2, RISING: 3,
      DEC: 10, HEX: 16, OCT: 8, BIN: 2, DHT11: 11, DHT21: 21, DHT22: 22, AM2301: 21,
      WL_IDLE_STATUS: 0, WL_NO_SSID_AVAIL: 1, WL_CONNECTED: 3, WL_CONNECT_FAILED: 4, WL_CONNECTION_LOST: 5, WL_DISCONNECTED: 6,
      WIFI_STA: 1, WIFI_AP: 2, WIFI_AP_STA: 3, WIFI_OFF: 0,
      SSD1306_WHITE: 1, SSD1306_BLACK: 0, SSD1306_INVERSE: 2, WHITE: 1, BLACK: 0, INVERSE: 2, SSD1306_SWITCHCAPVCC: 2, SSD1306_EXTERNALVCC: 1,
      ILI9341_BLACK: 0x0000, ILI9341_NAVY: 0x000F, ILI9341_DARKGREEN: 0x03E0, ILI9341_DARKCYAN: 0x03EF, ILI9341_MAROON: 0x7800, ILI9341_PURPLE: 0x780F, ILI9341_OLIVE: 0x7BE0,
      ILI9341_LIGHTGREY: 0xC618, ILI9341_DARKGREY: 0x7BEF, ILI9341_BLUE: 0x001F, ILI9341_GREEN: 0x07E0, ILI9341_CYAN: 0x07FF, ILI9341_RED: 0xF800, ILI9341_MAGENTA: 0xF81F,
      ILI9341_YELLOW: 0xFFE0, ILI9341_WHITE: 0xFFFF, ILI9341_ORANGE: 0xFD20, ILI9341_GREENYELLOW: 0xAFE5, ILI9341_PINK: 0xFC18,
      NEO_GRB: 82, NEO_RGB: 6, NEO_GRBW: 210, NEO_KHZ800: 0, NEO_KHZ400: 256,
      FILE_READ: 0, FILE_WRITE: 1, FILE_APPEND: 2, O_READ: 0, O_WRITE: 1, NO_KEY: '', SERIAL_8N1: 0x800001c,
      ENABLE_LED_FEEDBACK: 1, DISABLE_LED_FEEDBACK: 0, NEC: 8, PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI, EULER: Math.E,
      MPU6050_RANGE_2_G: 0, MPU6050_RANGE_4_G: 1, MPU6050_RANGE_8_G: 2, MPU6050_RANGE_16_G: 3, MPU6050_RANGE_250_DEG: 0, MPU6050_RANGE_500_DEG: 1, MPU6050_RANGE_1000_DEG: 2, MPU6050_RANGE_2000_DEG: 3,
      MPU6050_BAND_260_HZ: 0, MPU6050_BAND_184_HZ: 1, MPU6050_BAND_94_HZ: 2, MPU6050_BAND_44_HZ: 3, MPU6050_BAND_21_HZ: 4, MPU6050_BAND_10_HZ: 5, MPU6050_BAND_5_HZ: 6,
      LSBFIRST: 0, MSBFIRST: 1, NULL: 0, nullptr: null, MFRC522_SPICLOCK: 4000000,
      __DATE__: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(',', ''),
      __TIME__: new Date().toTimeString().slice(0, 8), PRESSED: 1, RELEASED: 2, HOLD: 3, IDLE: 0
    }, B.consts);
    Object.assign(env, C);

    // --- core
    env.pinMode = (pin, mode) => {
      const g = toGpio(pin), o = dev.out[g] || (dev.out[g] = { mode: 0, v: 0 });
      o.mode = mode; if (mode !== 1) o.v = 0;
      if (mode === 1 && (B.inputOnly || []).includes(g)) warn('io' + g, `GPIO${g} เป็นขาอินพุตอย่างเดียว ใช้เป็น OUTPUT ไม่ได้`);
    };
    env.digitalWrite = (pin, val) => {
      const g = toGpio(pin), o = dev.out[g] || (dev.out[g] = { mode: 0, v: 0 });
      const v = val ? 1 : 0;
      if (o.mode !== 1) { o.pull = !!v; if (!dev.pinModeHint.has(g)) { dev.pinModeHint.add(g); warn('pm' + g, `digitalWrite(${pin}) ก่อนเรียก pinMode(${pin}, OUTPUT) ขาจะยังไม่เป็นเอาต์พุต`); } return; }
      const old = o.v; o.v = v;
      const n = gpioNet(g);
      if (n && v && sim.nets.hasGnd(n)) warn('sh' + g, `ขา ${pin} สั่ง HIGH แต่ต่อลง GND ตรง ๆ (ลัดวงจร)`);
      if (old !== v) sim.pinWritten(dev, g, old, v);
    };
    env.digitalRead = (pin) => readPin(toGpio(pin));
    env.analogRead = (pin) => {
      const g = analogGpio(pin), n = gpioNet(g);
      if (n == null) return 0;
      return Math.round(clamp(netVoltage(n) / B.vref, 0, 1) * B.adcMax);
    };
    env.analogReadMilliVolts = (pin) => Math.round(env.analogRead(pin) / B.adcMax * B.vref * 1000);
    env.analogReadResolution = () => { };
    env.analogWrite = (pin, val) => {
      const g = toGpio(pin), o = dev.out[g] || (dev.out[g] = { mode: 1, v: 0 });
      o.mode = 1; o.v = clamp(val / 255, 0, 1);
    };
    const ledc = {};
    env.ledcSetup = (ch, freq, res) => { ledc['c' + ch] = Object.assign(ledc['c' + ch] || {}, { res: res || 8, freq }); return freq; };
    env.ledcAttachPin = (pin, ch) => { ledc['c' + ch] = Object.assign(ledc['c' + ch] || { res: 8 }, { pin }); env.pinMode(pin, 1); };
    env.ledcAttach = (pin, freq, res) => { ledc['p' + pin] = { pin, res: res || 8, freq }; env.pinMode(pin, 1); return true; };
    env.ledcAttachChannel = (pin, freq, res) => env.ledcAttach(pin, freq, res);
    const ledcTarget = (x) => ledc['c' + x] || ledc['p' + x] || { pin: x, res: 8 };
    env.ledcWrite = (x, duty) => { const c = ledcTarget(x); const o = dev.out[c.pin] || (dev.out[c.pin] = { mode: 1, v: 0 }); o.mode = 1; o.v = clamp(duty / (Math.pow(2, c.res) - 1), 0, 1); };
    env.ledcWriteTone = (x, freq) => { const c = ledcTarget(x); if (freq > 0) dev.tones[c.pin] = { freq }; else delete dev.tones[c.pin]; env.ledcWrite(x, freq > 0 ? Math.pow(2, c.res - 1) : 0); return freq; };
    env.ledcDetachPin = env.ledcDetach = () => { };
    env.tone = (pin, freq, dur) => {
      const g = toGpio(pin); dev.tones[g] = { freq: Math.max(31, freq) };
      if (dur) { const t = setTimeout(() => { if (dev.tones[g] && dev.tones[g].freq === Math.max(31, freq)) delete dev.tones[g]; }, dur); sim.timers.push(t); }
    };
    env.noTone = (pin) => { delete dev.tones[toGpio(pin)]; };
    env.pulseIn = (pin, level, timeout) => {
      const g = toGpio(pin), n = gpioNet(g);
      const hc = mine(['ultrasonic']).find((p) => netOf(p, 'ECHO') === n && powered(p));
      if (!hc) return 0;
      const tr = sim.nets.gpiosOn(netOf(hc, 'TRIG'))[0];
      if (!ed.isBasic() && tr === undefined) return 0;
      const us = Math.round(clamp(hc.sim.distance, 2, 400) * 58.2);
      return timeout && us > timeout ? 0 : us;
    };
    env.pulseInLong = env.pulseIn;
    env.shiftOut = () => { }; env.shiftIn = () => 0;
    env.millis = () => Math.floor(performance.now() - sim.t0);
    env.micros = () => Math.floor((performance.now() - sim.t0) * 1000);
    env.delay = async (ms) => { check(); if (ms > 0) await sleep(ms); else await sleep(0); check(); };
    env.delayMicroseconds = async (us) => { check(); if (us >= 1000) await sleep(us / 1000); else await env.__y(); };
    let ycount = 0, ylast = performance.now();
    env.__y = async () => {
      check();
      if (++ycount % 500 === 0 || performance.now() - ylast > 12) { ylast = performance.now(); await sleep(0); check(); }
    };
    function check() { if (!sim.running || sim.curGen !== sim.gen) throw STOP; }
    env.attachInterrupt = (n, fn, mode) => {
      let g = n;
      if (B !== IOTF.BOARDS.esp32 && B !== IOTF.BOARDS.rp2040 && (n === 0 || n === 1) && dev.intPinHint !== n) g = n === 0 ? 2 : 3;
      env.detachInterrupt(g);
      dev.ints.push({ gpio: g, fn, mode, last: undefined });
    };
    env.digitalPinToInterrupt = (pin) => { dev.intPinHint = pin; return toGpio(pin); };
    env.detachInterrupt = (n) => { dev.ints = dev.ints.filter((i) => i.gpio !== n); };
    env.interrupts = env.noInterrupts = () => { };
    // math
    env.map = (x, a, b, c, d) => Math.trunc((x - a) * (d - c) / (b - a) + c);
    env.constrain = (x, a, b) => clamp(x, a, b);
    Object.assign(env, { min: Math.min, max: Math.max, abs: Math.abs, pow: Math.pow, sqrt: Math.sqrt, sq: (x) => x * x, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2, exp: Math.exp, log: Math.log, log10: Math.log10, floor: Math.floor, ceil: Math.ceil, round: Math.round, fabs: Math.abs, fmod: (a, b) => a % b, isnan: Number.isNaN, isinf: (x) => !Number.isFinite(x) && !Number.isNaN(x), radians: (d) => d * Math.PI / 180, degrees: (r) => r * 180 / Math.PI });
    env.random = (a, b) => (b === undefined ? Math.floor(Math.random() * a) : Math.floor(a + Math.random() * (b - a)));
    env.randomSeed = () => { }; env.esp_random = () => Math.floor(Math.random() * 4294967295);
    Object.assign(env, { bitRead: (x, n) => (x >> n) & 1, bitSet: (x, n) => x | (1 << n), bitClear: (x, n) => x & ~(1 << n), bitWrite: (x, n, b) => (b ? x | (1 << n) : x & ~(1 << n)), bit: (n) => 1 << n, lowByte: (x) => x & 0xff, highByte: (x) => (x >> 8) & 0xff, word: (h, l) => (h << 8) | l });
    Object.assign(env, { isDigit: (c) => /^[0-9]$/.test(c), isAlpha: (c) => /^[A-Za-z]$/.test(c), isAlphaNumeric: (c) => /^[A-Za-z0-9]$/.test(c), isSpace: (c) => /^\s$/.test(c), isUpperCase: (c) => /^[A-Z]$/.test(c), isLowerCase: (c) => /^[a-z]$/.test(c), isPunct: (c) => /^[!-\/:-@[-`{-~]$/.test(c) });
    env.atoi = (s) => parseInt(s, 10) || 0; env.atol = env.atoi; env.atof = (s) => parseFloat(s) || 0;
    env.strlen = (s) => String(s).length; env.strcmp = (a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
    env.strncmp = (a, b, n) => env.strcmp(String(a).slice(0, n), String(b).slice(0, n));
    env.strstr = (a, b) => (String(a).includes(b) ? String(a).slice(String(a).indexOf(b)) : null);
    env.makeKeymap = (k) => k;
    env.__int = (x) => (typeof x === 'string' ? (x.length === 1 && Number.isNaN(+x) ? x.charCodeAt(0) : x.length === 1 ? x.charCodeAt(0) : Math.trunc(+x) || 0) : typeof x === 'boolean' ? +x : Math.trunc(+x) || 0);
    env.__char = (x) => (typeof x === 'number' ? String.fromCharCode(x) : String(x).charAt(0));
    env.__arr = function arr(dims, dv, f) { const [n, ...rest] = dims; return Array.from({ length: n }, () => (rest.length ? arr(rest, dv, f) : f ? f() : dv)); };
    env.__sizeof = (x) => (Array.isArray(x) ? x.length : typeof x === 'string' ? x.length + 1 : 4);
    env.__sprintf = sprintf; env.__dtostrf = (v, w, p) => Number(v).toFixed(p).padStart(w);
    env.__strReplace = (s, a, b) => String(s).split(String(a)).join(String(b));
    env.String = Object.assign(function (v, f) {
      if (v === undefined) return '';
      if (typeof v === 'number' && f !== undefined) return fmtNum(v, f);
      if (typeof v === 'number' && !Number.isInteger(v)) return v.toFixed(2);
      if (Array.isArray(v)) return v.join('');
      return String(v);
    }, { fromCharCode: String.fromCharCode });
    env.yield = () => sleep(0);

    // --- Serial ports
    class HardwareSerial {
      constructor(n) { this.n = n; this.gps = null; this.gpsBuf = ''; }
      begin(baud) { this.baud = baud; if (this.n !== 0) this.gps = mine(['gps'])[0] || null; return true; }
      end() { }
      _out(t) { if (this.n === 0) serialWrite(t); }
      print(v, f) { const s = fmtNum(v, f); this._out(s); return s.length; }
      println(v, f) { const s = v === undefined ? '' : fmtNum(v, f); this._out(s + '\n'); return s.length + 1; }
      printf(fmt, ...a) { const s = sprintf(fmt, ...a); this._out(s); return s.length; }
      write(v) { this._out(typeof v === 'number' ? String.fromCharCode(v) : String(v)); return 1; }
      flush() { }
      _feed() {
        if (this.n === 0 || !this.gps || !powered(this.gps)) return;
        const now = performance.now();
        if (!this.gpsBuf && (!this.lastNmea || now - this.lastNmea >= 1000)) { this.lastNmea = now; this.gpsBuf = nmea(this.gps.sim); }
      }
      available() { if (this.n === 0) return dev.serialIn.length; this._feed(); return this.gpsBuf.length; }
      read() {
        if (this.n === 0) { if (!dev.serialIn) return -1; const c = dev.serialIn[0]; dev.serialIn = dev.serialIn.slice(1); return c; }
        this._feed(); if (!this.gpsBuf) return -1; const c = this.gpsBuf[0]; this.gpsBuf = this.gpsBuf.slice(1); return c;
      }
      peek() { return this.n === 0 ? (dev.serialIn[0] ?? -1) : (this.gpsBuf[0] ?? -1); }
      readString() { if (this.n === 0) { const s = dev.serialIn; dev.serialIn = ''; return s; } const s = this.gpsBuf; this.gpsBuf = ''; return s; }
      readStringUntil(ch) { const src = this.n === 0 ? dev.serialIn : this.gpsBuf; const i = src.indexOf(ch); const s = i < 0 ? src : src.slice(0, i); if (this.n === 0) dev.serialIn = i < 0 ? '' : src.slice(i + 1); else this.gpsBuf = i < 0 ? '' : src.slice(i + 1); return s; }
      parseInt() { const m = /-?\d+/.exec(dev.serialIn); if (!m) { dev.serialIn = ''; return 0; } dev.serialIn = dev.serialIn.slice(m.index + m[0].length); return +m[0]; }
      parseFloat() { const m = /-?\d+(\.\d+)?/.exec(dev.serialIn); if (!m) { dev.serialIn = ''; return 0; } dev.serialIn = dev.serialIn.slice(m.index + m[0].length); return +m[0]; }
      setTimeout() { }
      valueOf() { return 1; }
    }
    env.HardwareSerial = HardwareSerial;
    env.Serial = new HardwareSerial(0); env.Serial1 = new HardwareSerial(1); env.Serial2 = new HardwareSerial(2); env.Serial3 = new HardwareSerial(3);
    env.SoftwareSerial = class extends HardwareSerial { constructor() { super(9); } listen() { return true; } };
    env.Wire = { begin() { }, setClock() { }, beginTransmission(a) { this.a = a; }, endTransmission() { return [0x27, 0x3f, 0x3c, 0x3d, 0x68, 0x69, 0x68].includes(this.a) ? 0 : 2; }, write() { return 1; }, requestFrom() { return 0; }, available() { return 0; }, read() { return 0; } };
    env.SPI = { begin() { }, end() { }, beginTransaction() { }, endTransaction() { }, transfer: () => 0, setFrequency() { } };
    env.ESP = { restart() { sim.log('ESP.restart() — เริ่มโปรแกรมใหม่'); setTimeout(() => IOTF.app.restart(), 50); throw STOP; }, getFreeHeap: () => 250000, getChipId: () => 0x1d2c3b, getEfuseMac: () => 0x24a1607b1d2cn, getChipModel: () => 'ESP32-D0WDQ6' };

    // --- WiFi
    const ni = ed.netInfo(board);
    const wifi = dev.wifi = { status: 0, ssid: '', ip: '0.0.0.0' };
    env.WiFi = {
      mode() { return true; }, setHostname() { return true; }, persistent() { }, setAutoReconnect() { },
      begin(ssid, pass) {
        if (!B.wifi) { warn('wifi', `${B.name} ไม่มี WiFi ในตัว เลือกบอร์ด ESP32 หรือ Nano RP2040 Connect`); wifi.status = 1; return 1; }
        Object.assign(wifi, { status: 6, ssid: String(ssid || ''), ip: '0.0.0.0' });
        IOTF.iot.setWifi('กำลังเชื่อมต่อ ' + wifi.ssid + '…', false, dev.name);
        sim.timers.push(setTimeout(() => { if (!sim.running) return; wifi.status = 3; wifi.ip = ni.ip; IOTF.iot.setWifi(`${wifi.ssid} · IP ${wifi.ip}`, true, dev.name); }, 1200));
        return wifi.status;
      },
      status: () => wifi.status, isConnected: () => wifi.status === 3, disconnect() { wifi.status = 6; IOTF.iot.setWifi('ตัดการเชื่อมต่อ', false, dev.name); return true; },
      reconnect() { return true; }, localIP: () => new IPAddress(wifi.ip), gatewayIP: () => new IPAddress('192.168.1.1'), subnetMask: () => new IPAddress('255.255.255.0'),
      macAddress: () => ni.mac, RSSI: () => (wifi.status === 3 ? -52 - Math.floor(Math.random() * 6) : 0), SSID: () => wifi.ssid,
      softAP() { return true; }, softAPIP: () => new IPAddress('192.168.4.1'), scanNetworks: () => 1, waitForConnectResult: async () => { while (wifi.status !== 3) await env.delay(100); return 3; }
    };
    class IPAddress { constructor(s) { this.s = typeof s === 'string' ? s : [...arguments].join('.'); } toString() { return this.s; } }
    env.IPAddress = IPAddress;
    env.WiFiClient = class { connect() { return wifi.status === 3; } connected() { return wifi.status === 3; } stop() { } print() { } println() { } available() { return 0; } read() { return -1; } setInsecure() { } setCACert() { } };
    env.WiFiClientSecure = env.WiFiClient;

    // --- MQTT (PubSubClient) through the in-app broker
    let clientSeq = 0;
    env.PubSubClient = class {
      constructor() { this.cb = null; this.q = []; this.ok = false; this.id = 'dev' + (++clientSeq) + '-' + Math.random().toString(36).slice(2, 6); this.host = ''; }
      setClient() { return this; } setServer(h, p) { this.host = String(h); this.port = p; return this; } setCallback(fn) { this.cb = fn; return this; }
      setBufferSize() { return true; } setKeepAlive() { return this; } setSocketTimeout() { return this; }
      connect(id) {
        if (wifi.status !== 3) { this.ok = false; return false; }
        sim.clientDev[this.id] = dev;
        this.ok = true; this.cid = String(id || this.id);
        IOTF.iot.log(`อุปกรณ์ "${this.cid}" เชื่อมต่อ broker ${this.host || ''}`, 'd');
        return true;
      }
      connected() { return this.ok && wifi.status === 3; }
      state() { return this.connected() ? 0 : -1; }
      disconnect() { this.ok = false; IOTF.iot.unsubscribeAll(this.id); }
      publish(topic, payload, retained) { if (!this.connected()) return false; IOTF.iot.publish(String(topic), Array.isArray(payload) ? payload.join('') : String(payload), !!retained, this.id); return true; }
      subscribe(topic) { if (!this.connected()) return false; IOTF.iot.subscribe(this.id, String(topic), (t, m, from) => { const src = sim.clientDev[from]; if (src && src !== dev) anim(src, dev, 'MQTT', '#4aa3ff'); this.q.push([t, m]); }); return true; }
      unsubscribe(topic) { IOTF.iot.unsubscribe(this.id, String(topic)); return true; }
      loop() {
        if (!this.connected()) return false;
        while (this.q.length) {
          const [t, m] = this.q.shift();
          if (this.cb) { const bytes = Object.assign(m.split(''), { toString() { return this.join(''); } }); safeCall(() => this.cb(t, bytes, bytes.length)); }
        }
        return true;
      }
    };

    // --- DHT
    env.DHT = class {
      constructor(pin, type) { this.pin = toGpio(pin); this.type = type; }
      begin() { }
      _p() { const p = findPart(['dht'], 'SDA', this.pin); return p && powered(p) ? p : null; }
      read() { return !!this._p(); }
      readTemperature(f) { const p = this._p(); if (!p) return NaN; const r = P[p.type].dhtType === 11 ? 1 : 10; const t = Math.round(p.sim.temp * r) / r; return f ? t * 9 / 5 + 32 : t; }
      readHumidity() { const p = this._p(); if (!p) return NaN; const r = P[p.type].dhtType === 11 ? 1 : 10; return Math.round(p.sim.hum * r) / r; }
      convertCtoF(c) { return c * 9 / 5 + 32; } convertFtoC(f) { return (f - 32) * 5 / 9; }
      computeHeatIndex(t, h, isF = true) {
        let T = isF ? t : t * 9 / 5 + 32;
        let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + h * 0.094);
        if (hi > 79) hi = -42.379 + 2.04901523 * T + 10.14333127 * h - 0.22475541 * T * h - 0.00683783 * T * T - 0.05481717 * h * h + 0.00122874 * T * T * h + 0.00085282 * T * h * h - 0.00000199 * T * T * h * h;
        return isF ? hi : (hi - 32) * 5 / 9;
      }
    };

    // --- DS18B20 (OneWire + DallasTemperature)
    env.OneWire = class { constructor(pin) { this.pin = toGpio(pin); } reset() { return 1; } };
    env.DallasTemperature = class {
      constructor(ow) { this.ow = ow; }
      _p() { const p = findPart(['ds18b20'], 'DATA', this.ow && this.ow.pin); return p && powered(p) ? p : null; }
      begin() { } setResolution() { } setWaitForConversion() { } requestTemperatures() { return true; } requestTemperaturesByIndex() { return true; }
      getDeviceCount() { return this._p() ? 1 : 0; } getDS18Count() { return this.getDeviceCount(); }
      getTempCByIndex(i = 0) { const p = this._p(); return p && i === 0 ? Math.round(p.sim.temp * 16) / 16 : -127; }
      getTempFByIndex(i = 0) { const c = this.getTempCByIndex(i); return c === -127 ? -196.6 : c * 9 / 5 + 32; }
      getTempC() { return this.getTempCByIndex(0); } getTempF() { return this.getTempFByIndex(0); }
      getAddress(a) { return !!this._p(); }
    };
    env.DEVICE_DISCONNECTED_C = -127;

    // --- BME280 / BMP280 (I2C)
    class BMEx {
      constructor(humid) { this.humid = humid; this.p = null; }
      begin() { this.p = mine(['bme']).find((q) => this.humid ? !P[q.type].noHum : true) || mine(['bme'])[0] || null; return !!(this.p && busOk(this.p, ['SDA', 'SCL'])); }
      _ok() { return this.p && powered(this.p); }
      readTemperature() { return this._ok() ? Math.round(this.p.sim.temp * 100) / 100 : NaN; }
      readPressure() { return this._ok() ? this.p.sim.pressure * 100 : NaN; }
      readHumidity() { return this._ok() && !P[this.p.type].noHum ? Math.round(this.p.sim.hum * 100) / 100 : NaN; }
      readAltitude(sea = 1013.25) { if (!this._ok()) return NaN; return 44330 * (1 - Math.pow(this.p.sim.pressure / sea, 0.1903)); }
      setSampling() { } takeForcedMeasurement() { return true; } sensorID() { return this.humid ? 0x60 : 0x58; }
    }
    env.Adafruit_BME280 = class extends BMEx { constructor() { super(true); } };
    env.Adafruit_BMP280 = class extends BMEx { constructor() { super(false); } };

    // --- BH1750 light meter (I2C)
    env.BH1750 = class {
      begin() { this.p = mine(['bh1750'])[0] || null; return !!(this.p && busOk(this.p, ['SDA', 'SCL'])); }
      configure() { return true; } setMTreg() { return true; } measurementReady() { return true; }
      readLightLevel() { const p = this.p || mine(['bh1750'])[0]; return p && powered(p) ? Math.round(p.sim.lux * 10) / 10 : -2; }
    };
    env.BH1750.CONTINUOUS_HIGH_RES_MODE = 0x10; env.BH1750.ONE_TIME_HIGH_RES_MODE = 0x20;

    // --- PMS5003 dust sensor (UART)
    env.PMS_DATA = class { constructor() { this.PM_SP_UG_1_0 = 0; this.PM_SP_UG_2_5 = 0; this.PM_SP_UG_10_0 = 0; this.PM_AE_UG_1_0 = 0; this.PM_AE_UG_2_5 = 0; this.PM_AE_UG_10_0 = 0; } };
    env.PMS = class {
      constructor(serial) { this.serial = serial; this.last = 0; }
      _p() { const p = mine(['pms'])[0]; return p && powered(p) && busOk(p, ['TX']) ? p : null; }
      _fill(d) { const p = this._p(); if (!p || !d) return false; const j = (v) => Math.max(0, Math.round(v + (Math.random() - 0.5) * 2)); d.PM_AE_UG_1_0 = d.PM_SP_UG_1_0 = j(p.sim.pm1); d.PM_AE_UG_2_5 = d.PM_SP_UG_2_5 = j(p.sim.pm25); d.PM_AE_UG_10_0 = d.PM_SP_UG_10_0 = j(p.sim.pm10); return true; }
      read(d) { const t = performance.now(); if (t - this.last < 1000) return false; if (!this._fill(d)) return false; this.last = t; return true; }
      async readUntil(d, timeout = 1000) { const w = Math.max(0, 1000 - (performance.now() - this.last)); if (w > timeout) { await sleep(timeout); return false; } await sleep(w); return this.read(d); }
      activeMode() { } passiveMode() { } wakeUp() { } sleep() { } requestRead() { }
    };

    // --- PZEM-004T v3 energy meter (UART)
    env.PZEM004Tv30 = class {
      constructor() { this.kwh = 0; this.t = performance.now(); }
      _p() { const p = mine(['pzem'])[0]; return p && powered(p) && busOk(p, ['TX', 'RX']) ? p : null; }
      _acc(p) { const t = performance.now(); this.kwh += p.sim.voltage * p.sim.current * p.sim.pf * (t - this.t) / 3.6e9; this.t = t; }
      voltage() { const p = this._p(); return p ? Math.round(p.sim.voltage * 10) / 10 : NaN; }
      current() { const p = this._p(); return p ? Math.round(p.sim.current * 1000) / 1000 : NaN; }
      power() { const p = this._p(); return p ? Math.round(p.sim.voltage * p.sim.current * p.sim.pf * 10) / 10 : NaN; }
      energy() { const p = this._p(); if (!p) return NaN; this._acc(p); return Math.round(this.kwh * 1000) / 1000; }
      frequency() { const p = this._p(); return p ? Math.round(p.sim.freq * 10) / 10 : NaN; }
      pf() { const p = this._p(); return p ? Math.round(p.sim.pf * 100) / 100 : NaN; }
      resetEnergy() { this.kwh = 0; return true; } setAddress() { return true; } readAddress() { return 0xf8; }
    };

    // --- MAX30100/MAX30102 pulse oximeter
    env.PulseOximeter = class {
      constructor() { this.cb = null; this.next = 0; }
      _p() { const p = mine(['oximeter'])[0]; return p && powered(p) && busOk(p, ['SDA', 'SCL']) ? p : null; }
      begin() { return !!this._p(); }
      update() { const p = this._p(); if (!p || !p.sim.finger || !this.cb) return; const t = performance.now(); if (t >= this.next) { this.next = t + 60000 / p.sim.bpm; safeCall(this.cb); } }
      getHeartRate() { const p = this._p(); return p && p.sim.finger ? p.sim.bpm + (Math.random() - 0.5) * 2 : 0; }
      getSpO2() { const p = this._p(); return p && p.sim.finger ? Math.round(p.sim.spo2) : 0; }
      setOnBeatDetectedCallback(cb) { this.cb = cb; } setIRLedCurrent() { } shutdown() { } resume() { }
    };
    env.MAX30105 = class {
      _p() { const p = mine(['oximeter'])[0]; return p && powered(p) ? p : null; }
      begin() { return !!(this._p() && busOk(this._p(), ['SDA', 'SCL'])); } setup() { } setPulseAmplitudeRed() { } setPulseAmplitudeGreen() { } check() { return 1; } available() { return 1; } nextSample() { }
      getIR() { const p = this._p(); return p && p.sim.finger ? Math.round(80000 + 3000 * heartWave(p.sim.bpm)) : 2000; }
      getRed() { const p = this._p(); return p && p.sim.finger ? Math.round(60000 + 2000 * heartWave(p.sim.bpm)) : 1500; }
      getFIFOIR() { return this.getIR(); } getFIFORed() { return this.getRed(); } readTemperature() { return 31.5; }
    };
    let beatLast = 0;
    env.checkForBeat = () => { const p = mine(['oximeter'])[0]; if (!p || !p.sim.finger) return false; const t = performance.now(); if (t - beatLast >= 60000 / p.sim.bpm) { beatLast = t; return true; } return false; };
    env.I2C_SPEED_FAST = 400000; env.I2C_SPEED_STANDARD = 100000;

    // --- Servo
    env.Servo = class {
      constructor() { this.a = 90; this.part = null; }
      attach(pin) { this.pin = toGpio(pin); this.part = findPart(['servo'], 'PWM', this.pin); if (!this.part) warn('servo' + pin, `ไม่พบ Servo ที่ต่อกับขา ${pin}`); return 1; }
      attached() { return !!this.part; } detach() { this.part = null; }
      write(a) { this.a = clamp(Math.round(a), 0, 180); if (this.part && powered(this.part)) el(this.part).angle = this.a; }
      writeMicroseconds(us) { this.write((us - 544) / (2400 - 544) * 180); }
      read() { return this.a; } setPeriodHertz() { }
    };
    env.ESP32Servo = env.Servo;

    // --- LCD (I2C and parallel)
    class LCD {
      constructor(a, cols, rows) { this.cols = cols || 16; this.rows = rows || 2; this.cx = 0; this.cy = 0; }
      _find() {
        const want = this.cols >= 20 ? 'lcd2004' : 'lcd1602';
        const list = mine(['lcd']); const p = list.find((q) => q.type === want) || list[0];
        if (!p) { warn('lcd', 'ไม่พบจอ LCD ในวงจร'); return null; }
        if (!busOk(p, ['SDA', 'SCL'])) { warn('lcdbus', 'จอ LCD ยังไม่ได้ต่อไฟหรือสาย SDA/SCL'); return null; }
        return p;
      }
      begin(c, r) { if (c) { this.cols = c; this.rows = r || this.rows; } this.p = this._find(); if (this.p) { const e = el(this.p); this.cols = this.p.type === 'lcd2004' ? 20 : 16; this.rows = this.p.type === 'lcd2004' ? 4 : 2; this.buf = new Uint8Array(this.cols * this.rows).fill(32); e.backlight = true; this._push(); } }
      init() { this.begin(); } _push() { if (this.p) el(this.p).characters = new Uint8Array(this.buf); }
      clear() { if (!this.buf) return; this.buf.fill(32); this.cx = this.cy = 0; this._push(); }
      home() { this.cx = this.cy = 0; }
      setCursor(c, r) { this.cx = c; this.cy = r; }
      print(v, f) {
        if (!this.buf) return 0;
        const s = fmtNum(v, f);
        for (const ch of s) { if (this.cx < this.cols && this.cy < this.rows) { const code = ch.charCodeAt(0); this.buf[this.cy * this.cols + this.cx] = code < 256 ? code : 63; } this.cx++; }
        this._push(); return s.length;
      }
      println(v, f) { return this.print(v, f); }
      write(c) { return this.print(typeof c === 'number' ? (c < 8 ? 'ÿ' : String.fromCharCode(c)) : c); }
      backlight() { if (this.p) el(this.p).backlight = true; } noBacklight() { if (this.p) el(this.p).backlight = false; }
      setBacklight(v) { if (this.p) el(this.p).backlight = !!v; }
      cursor() { if (this.p) { const e = el(this.p); e.cursor = true; e.cursorX = this.cx; e.cursorY = this.cy; } } noCursor() { if (this.p) el(this.p).cursor = false; }
      blink() { if (this.p) { const e = el(this.p); e.blink = true; e.cursorX = this.cx; e.cursorY = this.cy; } } noBlink() { if (this.p) el(this.p).blink = false; }
      display() { if (this.p) el(this.p).backlight = true; } noDisplay() { if (this.p) { this.saved = this.buf.slice(); el(this.p).characters = new Uint8Array(this.buf.length).fill(32); } }
      createChar() { } scrollDisplayLeft() { } scrollDisplayRight() { } leftToRight() { } rightToLeft() { } autoscroll() { } noAutoscroll() { }
    }
    env.LiquidCrystal_I2C = LCD;
    env.LiquidCrystal = class extends LCD { constructor() { super(0, 16, 2); } };

    // --- Adafruit GFX family (SSD1306 / ILI9341)
    class GFX {
      constructor(w, h) { this.W = w; this.H = h; this.cx = 0; this.cy = 0; this.size = 1; this.fg = 1; this.bg = null; this.wrap = true; this.rot = 0; }
      _col(c) { return '#fff'; }
      width() { return this.rot % 2 ? this.H : this.W; } height() { return this.rot % 2 ? this.W : this.H; }
      setCursor(x, y) { this.cx = x; this.cy = y; } getCursorX() { return this.cx; } getCursorY() { return this.cy; }
      setTextSize(s) { this.size = Math.max(1, Math.round(s)); } setTextColor(c, bg) { this.fg = c; this.bg = bg === undefined ? null : bg; } setTextWrap(w) { this.wrap = !!w; }
      setFont() { } cp437() { } setRotation(r) { this.rot = r & 3; this._applyRot && this._applyRot(); } getRotation() { return this.rot; }
      fillScreen(c) { const x = this.ctx; x.fillStyle = this._col(c); x.fillRect(0, 0, this.width(), this.height()); this._dirty(); }
      drawPixel(a, b, c) { const x = this.ctx; x.fillStyle = this._col(c); x.fillRect(Math.round(a), Math.round(b), 1, 1); this._dirty(); }
      fillRect(a, b, w, h, c) { const x = this.ctx; x.fillStyle = this._col(c); x.fillRect(a, b, w, h); this._dirty(); }
      drawRect(a, b, w, h, c) { this.fillRect(a, b, w, 1, c); this.fillRect(a, b + h - 1, w, 1, c); this.fillRect(a, b, 1, h, c); this.fillRect(a + w - 1, b, 1, h, c); }
      drawFastHLine(a, b, w, c) { this.fillRect(a, b, w, 1, c); } drawFastVLine(a, b, h, c) { this.fillRect(a, b, 1, h, c); }
      drawLine(x0, y0, x1, y1, c) {
        let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, er = dx + dy, n = 0;
        this.ctx.fillStyle = this._col(c);
        for (; ;) { this.ctx.fillRect(x0, y0, 1, 1); if ((x0 === x1 && y0 === y1) || ++n > 5000) break; const e2 = 2 * er; if (e2 >= dy) { er += dy; x0 += sx; } if (e2 <= dx) { er += dx; y0 += sy; } }
        this._dirty();
      }
      _circle(x, y, r, c, fill) { const k = this.ctx; k.beginPath(); k.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); if (fill) { k.fillStyle = this._col(c); k.fill(); } else { k.strokeStyle = this._col(c); k.lineWidth = 1; k.stroke(); } this._dirty(); }
      drawCircle(x, y, r, c) { this._circle(x, y, r, c, false); } fillCircle(x, y, r, c) { this._circle(x, y, r, c, true); }
      _rr(x, y, w, h, r, c, fill) { const k = this.ctx; k.beginPath(); k.roundRect ? k.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r) : k.rect(x, y, w, h); if (fill) { k.fillStyle = this._col(c); k.fill(); } else { k.strokeStyle = this._col(c); k.stroke(); } this._dirty(); }
      drawRoundRect(x, y, w, h, r, c) { this._rr(x, y, w, h, r, c, false); } fillRoundRect(x, y, w, h, r, c) { this._rr(x, y, w, h, r, c, true); }
      _tri(a, b, c2, d, e2, f, c, fill) { const k = this.ctx; k.beginPath(); k.moveTo(a, b); k.lineTo(c2, d); k.lineTo(e2, f); k.closePath(); if (fill) { k.fillStyle = this._col(c); k.fill(); } else { k.strokeStyle = this._col(c); k.stroke(); } this._dirty(); }
      drawTriangle(a, b, c2, d, e2, f, c) { this._tri(a, b, c2, d, e2, f, c, false); } fillTriangle(a, b, c2, d, e2, f, c) { this._tri(a, b, c2, d, e2, f, c, true); }
      drawBitmap(x, y, bmp, w, h, c) { const bw = Math.ceil(w / 8); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bmp[j * bw + (i >> 3)] & (128 >> (i & 7))) this.ctx.fillStyle = this._col(c), this.ctx.fillRect(x + i, y + j, 1, 1); this._dirty(); }
      print(v, f) {
        const s = fmtNum(v, f), k = this.ctx, cw = 6 * this.size, ch = 8 * this.size;
        k.font = `${7 * this.size}px "Courier New",monospace`; k.textBaseline = 'top';
        for (const c of s) {
          if (c === '\n') { this.cx = 0; this.cy += ch; continue; }
          if (c === '\r') continue;
          if (this.wrap && this.cx + cw > this.width()) { this.cx = 0; this.cy += ch; }
          if (this.bg !== null) { k.fillStyle = this._col(this.bg); k.fillRect(this.cx, this.cy, cw, ch); }
          k.fillStyle = this._col(this.fg); k.fillText(c, this.cx, this.cy + this.size * 0.5, cw);
          this.cx += cw;
        }
        this._dirty(); return s.length;
      }
      println(v, f) { const n = this.print(v === undefined ? '' : v, f); this.cx = 0; this.cy += 8 * this.size; return n; }
      write(c) { return this.print(typeof c === 'number' ? String.fromCharCode(c) : c); }
      printf(fmt, ...a) { return this.print(sprintf(fmt, ...a)); }
      getTextBounds(str, x, y) { return { w: String(str).length * 6 * this.size, h: 8 * this.size }; }
      color565(r, g, b) { return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3); }
      _dirty() { }
    }
    env.Adafruit_SSD1306 = class extends GFX {
      constructor(w = 128, h = 64) { super(typeof w === 'number' ? w : 128, typeof h === 'number' ? h : 64); this.cv = document.createElement('canvas'); this.cv.width = 128; this.cv.height = 64; this.ctx = this.cv.getContext('2d'); this.inv = false; }
      begin() {
        this.p = mine(['oled'])[0];
        if (!this.p) { warn('oled', 'ไม่พบจอ OLED ในวงจร'); return false; }
        if (!busOk(this.p, ['DATA', 'CLK'])) { warn('oledbus', 'จอ OLED ยังไม่ได้ต่อไฟหรือสาย SDA/SCL'); return false; }
        this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, 128, 64); return true;
      }
      _col(c) { return c === 2 ? '#808080' : c ? '#fff' : '#000'; }
      clearDisplay() { this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, 128, 64); }
      invertDisplay(i) { this.inv = !!i; this.display(); }
      dim() { } ssd1306_command() { } startscrollright() { } stopscroll() { }
      display() {
        if (!this.p) return; const e = el(this.p); if (!e || !e.imageData) return;
        const src = this.ctx.getImageData(0, 0, 128, 64).data, dst = e.imageData.data;
        for (let i = 0; i < 128 * 64; i++) { let on = src[i * 4] > 100; if (this.inv) on = !on; const v = on ? 255 : 0; dst[i * 4] = dst[i * 4 + 1] = dst[i * 4 + 2] = v; dst[i * 4 + 3] = 255; }
        e.redraw && e.redraw();
      }
    };
    env.Adafruit_ILI9341 = class extends GFX {
      constructor() { super(240, 320); }
      begin() {
        this.p = mine(['tft'])[0];
        if (!this.p) { warn('tft', 'ไม่พบจอ ILI9341 ในวงจร'); return; }
        if (!busOk(this.p, ['CS', 'D/C', 'MOSI', 'SCK'])) { warn('tftbus', 'จอ ILI9341 ยังไม่ได้ต่อไฟหรือสาย SPI ครบ (CS, D/C, MOSI, SCK)'); this.p = null; return; }
        const cv = el(this.p).canvas; this.ctx = cv ? cv.getContext('2d') : document.createElement('canvas').getContext('2d');
        this._applyRot(); this.fillScreen(0);
      }
      _applyRot() { if (!this.ctx) return; const k = this.ctx; k.setTransform(1, 0, 0, 1, 0, 0); if (this.rot === 1) k.setTransform(0, 1, -1, 0, 240, 0); else if (this.rot === 2) k.setTransform(-1, 0, 0, -1, 240, 320); else if (this.rot === 3) k.setTransform(0, -1, 1, 0, 0, 320); }
      _col(c) { c = c | 0; const r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31; return `rgb(${r * 255 / 31 | 0},${g * 255 / 63 | 0},${b * 255 / 31 | 0})`; }
      fillScreen(c) { if (!this.ctx) return; const k = this.ctx; k.save(); k.setTransform(1, 0, 0, 1, 0, 0); k.fillStyle = this._col(c); k.fillRect(0, 0, 240, 320); k.restore(); }
      print(v, f) { if (!this.ctx) return 0; return super.print(v, f); }
      fillRect(...a) { if (this.ctx) super.fillRect(...a); } drawPixel(...a) { if (this.ctx) super.drawPixel(...a); }
      readID() { return 0x9341; } invertDisplay() { } setAddrWindow() { } startWrite() { } endWrite() { }
    };
    env.Adafruit_ILI9341.prototype.ctx = null;

    // --- NeoPixel
    env.Adafruit_NeoPixel = class {
      constructor(n, pin, type) { this.n = n || 1; this.pin = toGpio(pin); this.buf = Array.from({ length: this.n }, () => [0, 0, 0]); this.bright = 255; }
      begin() { this.p = findPart(['pixels'], 'DIN', this.pin); if (!this.p) warn('np' + this.pin, `ไม่พบ NeoPixel ที่ต่อกับขา ${this.pin}`); }
      static Color(r, g, b) { return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); }
      Color(r, g, b) { return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); }
      static ColorHSV(h, s = 255, v = 255) { h = (h % 65536) / 65536 * 6; const i = Math.floor(h), f = h - i, p = v * (1 - s / 255), q = v * (1 - s / 255 * f), t = v * (1 - s / 255 * (1 - f)); const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255); }
      ColorHSV(h, s, v) { return env.Adafruit_NeoPixel.ColorHSV(h, s, v); }
      static gamma32(c) { return c; } gamma32(c) { return c; }
      setPixelColor(i, r, g, b) { if (i < 0 || i >= this.n) return; if (g === undefined) { const c = r >>> 0; this.buf[i] = [(c >> 16) & 255, (c >> 8) & 255, c & 255]; } else this.buf[i] = [r, g, b]; }
      getPixelColor(i) { const [r, g, b] = this.buf[i] || [0, 0, 0]; return (r << 16) | (g << 8) | b; }
      fill(c = 0, first = 0, count) { const end = count ? first + count : this.n; for (let i = first; i < end; i++) this.setPixelColor(i, c); }
      clear() { this.buf.forEach((x) => { x[0] = x[1] = x[2] = 0; }); }
      setBrightness(b) { this.bright = clamp(b, 0, 255); } getBrightness() { return this.bright; }
      numPixels() { return this.n; } canShow() { return true; } updateLength(n) { this.n = n; }
      show() {
        const p = this.p; if (!p || !powered(p)) return; const e = el(p), k = this.bright / 255;
        const rgb = (i) => { const [r, g, b] = this.buf[i] || [0, 0, 0]; return { r: r / 255 * k, g: g / 255 * k, b: b / 255 * k }; };
        if (p.type === 'neopixel') { const c = rgb(0); e.r = c.r; e.g = c.g; e.b = c.b; }
        else if (p.type === 'led-ring') { for (let i = 0; i < Math.min(this.n, e.pixels); i++) e.setPixel(i, rgb(i)); }
        else { const cols = e.cols || 8; for (let i = 0; i < Math.min(this.n, cols * (e.rows || 8)); i++) e.setPixel(Math.floor(i / cols), i % cols, rgb(i)); }
      }
    };

    // --- MPU6050
    env.sensors_event_t = class { constructor() { this.acceleration = { x: 0, y: 0, z: 0 }; this.gyro = { x: 0, y: 0, z: 0 }; this.temperature = 0; } };
    env.Adafruit_MPU6050 = class {
      begin() { this.p = mine(['mpu'])[0]; return !!(this.p && busOk(this.p, ['SDA', 'SCL'])); }
      setAccelerometerRange() { } setGyroRange() { } setFilterBandwidth() { } getAccelerometerRange() { return 2; } getGyroRange() { return 1; } getFilterBandwidth() { return 5; }
      setMotionDetectionThreshold() { } setMotionDetectionDuration() { } setInterruptPinLatch() { } setInterruptPinPolarity() { } setMotionInterrupt() { }
      getMotionInterruptStatus() { const s = this.p && this.p.sim; return !!(s && (Math.abs(s.ax) + Math.abs(s.ay) > 2)); }
      getEvent(a, g, t) {
        const s = this.p ? this.p.sim : { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0, temp: 0 }, r = Math.PI / 180;
        if (a) a.acceleration = { x: s.ax, y: s.ay, z: s.az };
        if (g) g.gyro = { x: s.gx * r, y: s.gy * r, z: s.gz * r };
        if (t) t.temperature = s.temp;
        return true;
      }
    };

    // --- HX711
    env.HX711 = class {
      constructor() { this.scale = 1; this.offset = 0; }
      begin(dt, sck) { this.dt = toGpio(dt); this.p = findPart(['hx711'], 'DT', this.dt); if (!this.p) warn('hx', 'ไม่พบโมดูล HX711 ที่ต่อกับขา DT'); }
      _raw() { if (!this.p || !powered(this.p)) return 0; return Math.round(this.p.sim.weight * 420 + 84000); }
      is_ready() { return !!this.p; } wait_ready() { } power_up() { } power_down() { } set_gain() { }
      read() { return this._raw(); } read_average() { return this._raw(); }
      get_value() { return this._raw() - this.offset; } get_units() { return (this._raw() - this.offset) / this.scale; }
      tare() { this.offset = this._raw(); } set_scale(s = 1) { this.scale = s || 1; } get_scale() { return this.scale; } set_offset(o) { this.offset = o; } get_offset() { return this.offset; }
    };

    // --- RFID MFRC522
    env.MFRC522 = class {
      constructor(ss, rst) { this.ss = toGpio(ss); this.uid = { uidByte: [], size: 0, sak: 8 }; this.seen = 0; }
      PCD_Init() { this.p = findPart(['rfid'], 'SDA', this.ss); if (!this.p) warn('rfid', 'ไม่พบโมดูล RFID RC522 (ขา SDA/SS ต้องตรงกับในโค้ด)'); else if (!busOk(this.p, ['SDA', 'SCK', 'MOSI', 'MISO'])) { warn('rfidbus', 'RC522 ยังไม่ได้ต่อไฟหรือสาย SPI ครบ'); this.p = null; } else this.seen = this.p.sim.tap || 0; }
      PCD_DumpVersionToSerial() { serialWrite('Firmware Version: 0x92 = v2.0\n'); } PCD_SetAntennaGain() { } PCD_PerformSelfTest() { return true; }
      PICC_IsNewCardPresent() { return !!(this.p && (this.p.sim.tap || 0) > this.seen); }
      PICC_ReadCardSerial() {
        if (!this.p || !((this.p.sim.tap || 0) > this.seen)) return false;
        this.seen = this.p.sim.tap;
        const bytes = String(this.p.sim.uid || 'DE AD BE EF').trim().split(/[\s:]+/).map((h) => parseInt(h, 16) & 255).filter((n) => !Number.isNaN(n));
        this.uid = { uidByte: bytes, size: bytes.length, sak: 8 };
        return true;
      }
      PICC_HaltA() { } PCD_StopCrypto1() { } PICC_GetType() { return 4; } PICC_GetTypeName() { return 'MIFARE 1KB'; }
      PICC_DumpToSerial() { serialWrite('Card UID: ' + this.uid.uidByte.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') + '\n'); }
    };

    // --- GPS
    env.TinyGPSPlus = class {
      constructor() {
        const g = () => mine(['gps'])[0]; const ok = () => { const p = g(); return !!(p && powered(p) && p.sim.sats >= 3); };
        this._chars = 0; this._upd = false; const self = this;
        this.location = { isValid: ok, isUpdated() { const u = self._upd; self._upd = false; return u && ok(); }, lat: () => (g() ? g().sim.lat : 0), lng: () => (g() ? g().sim.lng : 0), age: () => 100 };
        this.satellites = { value: () => (g() ? g().sim.sats : 0), isValid: () => !!g(), isUpdated: () => true };
        this.altitude = { meters: () => 12.5, kilometers: () => 0.0125, feet: () => 41, isValid: ok };
        this.speed = { kmph: () => 0, mps: () => 0, knots: () => 0, mph: () => 0, isValid: ok };
        this.course = { deg: () => 0, isValid: ok };
        this.hdop = { hdop: () => 0.9, value: () => 90, isValid: ok };
        const now = () => new Date();
        this.date = { isValid: ok, isUpdated: () => true, year: () => now().getUTCFullYear(), month: () => now().getUTCMonth() + 1, day: () => now().getUTCDate(), value: () => 0 };
        this.time = { isValid: ok, isUpdated: () => true, hour: () => now().getUTCHours(), minute: () => now().getUTCMinutes(), second: () => now().getUTCSeconds(), centisecond: () => 0, value: () => 0 };
      }
      encode(c) { this._chars++; if (c === '\n') { this._upd = true; return true; } return false; }
      charsProcessed() { return this._chars; } sentencesWithFix() { return Math.floor(this._chars / 70); } failedChecksum() { return 0; }
      static distanceBetween(la1, lo1, la2, lo2) { const R = 6372795, r = Math.PI / 180, dl = (lo2 - lo1) * r, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); }
      static courseTo(la1, lo1, la2, lo2) { const r = Math.PI / 180, dl = (lo2 - lo1) * r, y = Math.sin(dl) * Math.cos(la2 * r), x = Math.cos(la1 * r) * Math.sin(la2 * r) - Math.sin(la1 * r) * Math.cos(la2 * r) * Math.cos(dl); return (Math.atan2(y, x) / r + 360) % 360; }
    };

    // --- LoRa (sandeepmistry/arduino-LoRa API)
    env.LoRa = {
      freq: 433e6, pkt: '', rx: null, cb: null,
      setPins() { }, setSPI() { }, setSPIFrequency() { }, setSyncWord() { }, setSpreadingFactor() { }, setSignalBandwidth() { }, setCodingRate4() { }, setTxPower() { }, enableCrc() { }, disableCrc() { }, setPreambleLength() { }, idle() { }, sleep() { }, receive() { }, explicitHeaderMode() { }, implicitHeaderMode() { },
      begin(f) {
        this.freq = f; const p = mine(['lora'])[0]; this.p = p; dev.lora = this;
        if (!p) { warn('lora', 'ไม่พบโมดูล LoRa SX1278 ในวงจร'); return 0; }
        if (!busOk(p, ['NSS', 'SCK', 'MOSI', 'MISO'])) { warn('lorabus', 'LoRa ยังไม่ได้ต่อไฟหรือสาย SPI ครบ (NSS, SCK, MOSI, MISO)'); return 0; }
        return 1;
      },
      end() { }, beginPacket() { this.pkt = ''; return 1; },
      print(v, f) { this.pkt += fmtNum(v, f); return 1; }, println(v, f) { this.pkt += (v === undefined ? '' : fmtNum(v, f)) + '\n'; return 1; },
      write(v) { this.pkt += typeof v === 'number' ? String.fromCharCode(v) : String(v); return 1; },
      endPacket() { if (!this.p) return 0; IOTF.iot.loraSend(this.pkt, this.freq); sim.loraLocal(dev, this.pkt, this.freq); const led = el(this.p).q('.tx'); if (led) { led.setAttribute('fill', '#ff3b30'); setTimeout(() => led.setAttribute('fill', '#3b1111'), 150); } return 1; },
      parsePacket() { if (!this.p || !dev.loraRx.length) return 0; this.rx = dev.loraRx.shift(); this.rxi = 0; return this.rx.text.length; },
      available() { return this.rx ? this.rx.text.length - this.rxi : 0; },
      read() { if (!this.rx || this.rxi >= this.rx.text.length) return -1; return this.rx.text[this.rxi++]; },
      peek() { return this.rx ? this.rx.text[this.rxi] : -1; },
      readString() { if (!this.rx) return ''; const s = this.rx.text.slice(this.rxi); this.rxi = this.rx.text.length; return s; },
      packetRssi() { return this.rx ? this.rx.rssi : 0; }, packetSnr() { return 9.5; }, packetFrequencyError() { return 0; },
      onReceive(fn) { this.cb = fn; }, onTxDone() { }
    };
    dev.loraHook = () => { const L = env.LoRa; if (L.cb && dev.loraRx.length && L.p) { const n = L.parsePacket(); if (n) safeCall(() => L.cb(n)); } };

    // --- RTC
    class DateTime {
      constructor(a, mo, d, h = 0, mi = 0, s = 0) {
        if (a === undefined) this.t = Date.now() / 1000;
        else if (typeof a === 'string') { const dt = new Date(a + ' ' + (mo || '00:00:00')); this.t = (dt.getTime() - dt.getTimezoneOffset() * 60000) / 1000; }
        else if (a instanceof DateTime) this.t = a.t;
        else if (mo === undefined) this.t = a;
        else this.t = Date.UTC(a, mo - 1, d, h, mi, s) / 1000;
      }
      _d() { return new Date(this.t * 1000); }
      year() { return this._d().getUTCFullYear(); } month() { return this._d().getUTCMonth() + 1; } day() { return this._d().getUTCDate(); }
      hour() { return this._d().getUTCHours(); } minute() { return this._d().getUTCMinutes(); } second() { return this._d().getUTCSeconds(); }
      dayOfTheWeek() { return this._d().getUTCDay(); } unixtime() { return Math.floor(this.t); } secondstime() { return Math.floor(this.t) - 946684800; }
      timestamp() { return this._d().toISOString().slice(0, 19); } isValid() { return true; }
      toString(f) { return String(f || 'YYYY-MM-DD hh:mm:ss').replace('YYYY', this.year()).replace('MM', String(this.month()).padStart(2, '0')).replace('DD', String(this.day()).padStart(2, '0')).replace('hh', String(this.hour()).padStart(2, '0')).replace('mm', String(this.minute()).padStart(2, '0')).replace('ss', String(this.second()).padStart(2, '0')); }
    }
    env.DateTime = DateTime;
    env.TimeSpan = class { constructor(d = 0, h = 0, m = 0, s = 0) { this.s = d * 86400 + h * 3600 + m * 60 + s; } totalseconds() { return this.s; } };
    const localOffset = -new Date().getTimezoneOffset() * 60;
    class RTC { begin() { this.p = mine(['rtc'])[0]; this.off = sim.rtcOffset ?? localOffset; return !!(this.p && busOk(this.p, ['SDA', 'SCL'])); } isrunning() { return true; } lostPower() { return false; } adjust(dt) { this.off = dt.t - Date.now() / 1000; sim.rtcOffset = this.off; } now() { return new DateTime(Date.now() / 1000 + this.off); } }
    env.RTC_DS1307 = RTC; env.RTC_DS3231 = class extends RTC { getTemperature() { return 26.5; } };

    // --- SD card
    class File {
      constructor(name, mode) { this.nm = name; this.mode = mode; this.pos = 0; if (mode === 1 || mode === 2) { if (!(name in sim.sd)) sim.sd[name] = ''; } }
      print(v, f) { const s = fmtNum(v, f); sim.sd[this.nm] += s; showSd(); return s.length; }
      println(v, f) { return this.print((v === undefined ? '' : fmtNum(v, f)) + '\n'); }
      write(v) { return this.print(typeof v === 'number' ? String.fromCharCode(v) : v); }
      available() { return (sim.sd[this.nm] || '').length - this.pos; }
      read() { const s = sim.sd[this.nm] || ''; return this.pos < s.length ? s[this.pos++] : -1; }
      peek() { const s = sim.sd[this.nm] || ''; return this.pos < s.length ? s[this.pos] : -1; }
      readStringUntil(c) { const s = (sim.sd[this.nm] || '').slice(this.pos); const i = s.indexOf(c); const r = i < 0 ? s : s.slice(0, i); this.pos += r.length + (i < 0 ? 0 : 1); return r; }
      readString() { const s = (sim.sd[this.nm] || '').slice(this.pos); this.pos += s.length; return s; }
      size() { return (sim.sd[this.nm] || '').length; } name() { return this.nm; } close() { } flush() { } seek(p) { this.pos = p; return true; } position() { return this.pos; }
      isDirectory() { return false; }
    }
    env.File = File;
    env.SD = {
      ok: false,
      begin() { const p = mine(['sd'])[0]; this.ok = !!(p && busOk(p, ['CS', 'SCK', 'DI', 'DO'])); if (!p) warn('sd', 'ไม่พบโมดูล microSD ในวงจร'); return this.ok; },
      open(name, mode = 0) { if (!this.ok) return null; name = String(name).replace(/^\//, ''); if (mode === 0 && !(name in sim.sd)) return null; return new File(name, mode); },
      exists(name) { return String(name).replace(/^\//, '') in sim.sd; }, remove(name) { delete sim.sd[String(name).replace(/^\//, '')]; showSd(); return true; },
      mkdir() { return true; }, rmdir() { return true; }, cardType() { return 2; }, cardSize() { return 8 * 1024 ** 3; }
    };

    // --- Keypad
    env.Keypad = class {
      constructor(map, rows, cols) { this.p = mine(['keypad'])[0]; if (!this.p) warn('kp', 'ไม่พบ Keypad ในวงจร'); else if (!ed.isBasic() && !sim.nets.gpiosOn(netOf(this.p, 'R1')).length) { warn('kpw', 'Keypad ยังไม่ได้ต่อสายแถว/คอลัมน์เข้าบอร์ด'); this.p = null; } }
      getKey() { if (!this.p) return ''; const q = st(this.p); const k = q.key || ''; q.key = ''; return k; }
      async waitForKey() { for (; ;) { const k = this.getKey(); if (k) return k; await env.delay(10); } }
      getState() { return 0; } isPressed(k) { return false; } keyStateChanged() { return false; } setDebounceTime() { } setHoldTime() { } addEventListener() { }
    };

    // --- Stepper
    // the stepper (or ULN2003 board) whose input pins are on these gpios
    const stepperOn = (pins) => {
      const nets = pins.filter((x) => x !== undefined).map((x) => gpioNet(toGpio(x))).filter((x) => x != null);
      const list = mine(['stepper']);
      return list.find((p) => (P[p.type].tag === 'iotf-28byj48' ? ['IN1', 'IN2', 'IN3', 'IN4'] : ['A-', 'A+', 'B+', 'B-']).some((x) => nets.includes(netOf(p, x)))) || list[0] || null;
    };
    env.Stepper = class {
      constructor(steps, ...pins) { this.steps = steps || 200; this.rpm = 10; this.p = stepperOn(pins); if (!this.p) warn('stepper', 'ไม่พบสเต็ปเปอร์มอเตอร์ในวงจร'); }
      setSpeed(r) { this.rpm = r || 1; }
      async step(n) {
        n = Math.trunc(n); if (!n) return;
        const ms = Math.abs(n) * 60000 / (this.steps * this.rpm), dir = Math.sign(n), each = 360 / this.steps;
        const t0 = performance.now(); let done = 0;
        while (true) {
          const k = Math.min(1, (performance.now() - t0) / Math.max(1, ms)), want = Math.floor(Math.abs(n) * k);
          if (this.p && powered(this.p) && want > done) turnStepper(this.p, dir * (want - done) * each);
          done = want;
          if (k >= 1) break; await env.delay(16);
        }
      }
    };
    // AccelStepper: DRIVER (STEP/DIR into an A4988) or 4-wire coils
    env.AccelStepper = class {
      constructor(mode = 4, p1 = 2, p2 = 3, p3 = 4, p4 = 5) {
        this.mode = mode; this.pins = [p1, p2, p3, p4]; this.pos = 0; this.target = 0; this.max = 1; this.spd = 0; this.last = performance.now();
        if (mode === 1) { this.drv = findPart(['a4988'], 'STEP', toGpio(p1)); if (!this.drv) warn('accel', 'AccelStepper (DRIVER) ไม่พบ A4988 ที่ขา STEP ต่อกับขา ' + p1); }
        else this.p = stepperOn(mode === 2 || mode === 3 ? [p1, p2] : this.pins);
      }
      _step(dir) {
        this.pos += dir;
        if (this.drv) { if (!powered(this.drv) || netLevel(netOf(this.drv, 'EN')) === 1) return; const m = stepperOfDriver(this.drv); if (m) turnStepper(m, dir * 1.8); return; }
        if (!this.p || !powered(this.p)) return;
        const per = P[this.p.type].tag === 'iotf-28byj48' ? (this.mode === 8 ? 4096 : 2048) : (this.mode === 8 ? 400 : 200);
        turnStepper(this.p, dir * 360 / per);
      }
      _go(rate, toward) {
        const now = performance.now(); if (!rate) { this.last = now; return false; }
        const interval = 1000 / Math.abs(rate); let k = Math.floor((now - this.last) / interval);
        if (k <= 0) return true;
        if (toward !== undefined) k = Math.min(k, Math.abs(toward));
        const dir = toward !== undefined ? Math.sign(toward) : Math.sign(rate);
        for (let i = 0; i < k; i++) this._step(dir);
        this.last = now - (now - this.last) % interval;
        if (now - this.last > 200) this.last = now;
        return true;
      }
      setMaxSpeed(s) { this.max = Math.abs(s) || 1; } maxSpeed() { return this.max; } setAcceleration() { } setSpeed(s) { this.spd = s; } speed() { return this.spd; }
      moveTo(t) { if (this.target !== t) this.last = performance.now(); this.target = Math.trunc(t); } move(r) { this.moveTo(this.pos + r); }
      currentPosition() { return this.pos; } targetPosition() { return this.target; } distanceToGo() { return this.target - this.pos; }
      setCurrentPosition(p) { this.pos = this.target = Math.trunc(p); } stop() { this.target = this.pos; } isRunning() { return this.target !== this.pos; }
      run() { const d = this.target - this.pos; if (!d) return false; this._go(this.max, d); return this.target !== this.pos; }
      runSpeed() { return this._go(this.spd); }
      runSpeedToPosition() { const d = this.target - this.pos; if (!d) return false; return this._go(this.spd || this.max, d); }
      async runToPosition() { while (this.run()) await env.delay(2); }
      async runToNewPosition(p) { this.moveTo(p); await this.runToPosition(); }
      enableOutputs() { } disableOutputs() { } setEnablePin() { } setPinsInverted() { } setMinPulseWidth() { }
    };
    Object.assign(env.AccelStepper, { FUNCTION: 0, DRIVER: 1, FULL2WIRE: 2, FULL3WIRE: 3, FULL4WIRE: 4, HALF3WIRE: 6, HALF4WIRE: 8 });

    // --- IR remote (IRremote v3+ and v2 API)
    const ir = { q: [] };
    sim.irPush = (code) => ir.q.push(code);
    env.IrReceiver = {
      decodedIRData: { command: 0, address: 0, protocol: 8, decodedRawData: 0, flags: 0 },
      begin(pin) { this.p = mine(['irrecv'])[0]; if (!this.p) warn('ir', 'ไม่พบ IR Receiver ในวงจร'); },
      start() { }, enableIRIn() { },
      decode() { if (!this.p || !powered(this.p) || !ir.q.length) return false; const c = ir.q.shift(); this.decodedIRData = { command: c, address: 0, protocol: 8, decodedRawData: (((~c) & 255) << 24) | (c << 16) | 0xff00, flags: 0 }; return true; },
      resume() { }, printIRResultShort() { serialWrite(`Protocol=NEC Address=0x0 Command=0x${this.decodedIRData.command.toString(16).toUpperCase()}\n`); }
    };
    env.decode_results = class { constructor() { this.value = 0; this.decode_type = 3; this.bits = 32; } };
    env.IRrecv = class { constructor() { } enableIRIn() { env.IrReceiver.begin(); } decode(r) { if (!env.IrReceiver.decode()) return false; const c = env.IrReceiver.decodedIRData.command; if (r) r.value = (0x00ff << 16) | (c << 8) | ((~c) & 255); return true; } resume() { } };


    /* ---------- talking to other boards ---------- */
    Object.assign(env, { ESP_OK: 0, ESP_FAIL: -1, ESP_NOW_SEND_SUCCESS: 0, ESP_NOW_SEND_FAIL: 1, ESP_NOW_ETH_ALEN: 6, ESP_NOW_MAX_DATA_LEN: 250, WIFI_IF_STA: 0, WIFI_IF_AP: 1,
      HTTP_GET: 1, HTTP_POST: 3, HTTP_ANY: 0, HTTP_CODE_OK: 200, HTTPC_ERROR_CONNECTION_REFUSED: -1, HTTPC_ERROR_READ_TIMEOUT: -11 });
    env.memcpy = (dst, src, n) => {
      const len = n ?? (src && src.length) ?? 0;
      if (src && typeof src === 'object' && !Array.isArray(src)) { if (dst && typeof dst === 'object' && !Array.isArray(dst)) { Object.assign(dst, clonePayload(src)); return dst; } return clonePayload(src); }
      const items = typeof src === 'string' ? src.split('') : Array.isArray(src) ? src : [];
      if (typeof dst === 'string') { let t = ''; for (let i = 0; i < Math.min(len, items.length); i++) { const c = items[i]; if (c === 0 || c === '\0') break; t += typeof c === 'number' ? String.fromCharCode(c) : c; } return t; }
      if (Array.isArray(dst)) { for (let i = 0; i < Math.min(len, items.length); i++) dst[i] = typeof dst[0] === 'number' && typeof items[i] === 'string' ? items[i].charCodeAt(0) : items[i]; return dst; }
      return dst;
    };
    env.__readInto = (o, set, n) => {
      if (o && o.readInto) return o.readInto(set, n);
      let t = '', c; while (t.length < (n || 0) && (c = o.read()) !== -1 && c !== undefined) t += typeof c === 'number' ? String.fromCharCode(c) : c;
      set(t); return t.length;
    };
    env.memset = (dst, v, n) => { if (Array.isArray(dst)) dst.fill(v, 0, n ?? dst.length); return dst; };
    env.memcmp = (a, b, n) => { for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
    // ESP-NOW
    const now = dev.espnow = { on: false, recv: null, sent: null };
    env.esp_now_init = () => { if (B !== IOTF.BOARDS.esp32) { warn('nowb', `ESP-NOW ใช้ได้กับ ESP32 เท่านั้น (${B.name})`); return -1; } now.on = true; return 0; };
    env.esp_now_deinit = () => { now.on = false; return 0; };
    env.esp_now_register_recv_cb = (fn) => { now.recv = fn; return 0; };
    env.esp_now_register_send_cb = (fn) => { now.sent = fn; return 0; };
    env.esp_now_unregister_recv_cb = () => { now.recv = null; return 0; };
    env.esp_now_recv_cb_t = (f) => f; env.esp_now_send_cb_t = (f) => f;
    env.esp_now_add_peer = () => 0; env.esp_now_del_peer = () => 0; env.esp_now_is_peer_exist = () => true; env.esp_now_mod_peer = () => 0;
    env.esp_now_peer_info_t = class { constructor() { this.peer_addr = [0, 0, 0, 0, 0, 0]; this.channel = 0; this.encrypt = false; this.ifidx = 0; } };
    env.esp_now_send = (mac, data, len) => {
      if (!now.on) { warn('nowi', 'เรียก esp_now_send ก่อน esp_now_init()'); return 0x3069; }
      const to = mac && Array.isArray(mac) && mac.some((x) => x !== 0xff) ? mac.slice(0, 6) : null;
      sim.espnowSend(dev, to, payloadOf(data, len));
      return 0;
    };
    env.esp_wifi_set_channel = () => 0; env.esp_wifi_get_mac = (i, arr) => { if (Array.isArray(arr)) ni.macBytes.forEach((x, k) => { arr[k] = x; }); return 0; };
    // WiFi UDP
    env.WiFiUDP = class {
      constructor() { this.q = []; this.cur = null; this.ri = 0; this.out = null; this.port = 0; }
      begin(port) { this.port = port; dev.udp.push(this); return 1; }
      stop() { dev.udp = dev.udp.filter((u) => u !== this); }
      beginPacket(ip, port) { this.out = { ip: String(ip), port, data: '' }; return 1; }
      write(v, len) { if (!this.out) return 0; const s = typeof v === 'number' ? String.fromCharCode(v) : Array.isArray(v) ? v.slice(0, len ?? v.length).map((c) => (typeof c === 'number' ? String.fromCharCode(c) : c)).join('') : String(v).slice(0, len ?? undefined); this.out.data += s; return s.length; }
      print(v, f) { return this.write(fmtNum(v, f)); } println(v, f) { return this.write((v === undefined ? '' : fmtNum(v, f)) + '\n'); }
      printf(fmt, ...a) { return this.write(sprintf(fmt, ...a)); }
      endPacket() { if (!this.out) return 0; const ok = sim.udpSend(dev, this.out, this.port); this.out = null; return ok ? 1 : 0; }
      parsePacket() { if (!this.q.length) return 0; this.cur = this.q.shift(); this.ri = 0; return this.cur.data.length; }
      available() { return this.cur ? this.cur.data.length - this.ri : 0; }
      read() { if (!this.cur || this.ri >= this.cur.data.length) return -1; return this.cur.data[this.ri++]; }
      readInto(set, len) { const s = this.cur ? this.cur.data.slice(this.ri, this.ri + (len || 9999)) : ''; this.ri += s.length; set(s); return s.length; }
      readString() { const s = this.cur ? this.cur.data.slice(this.ri) : ''; this.ri += s.length; return s; }
      remoteIP() { return new IPAddress(this.cur ? this.cur.from : '0.0.0.0'); } remotePort() { return this.cur ? this.cur.fromPort : 0; }
      flush() { }
    };
    // HTTP server
    env.WebServer = class {
      constructor(port) { this.port = port || 80; this.routes = []; this.notFound = null; this.q = []; this.cur = null; this.busy = false; }
      on(path, a, b) { this.routes.push({ path: String(path), fn: typeof a === 'function' ? a : b }); }
      onNotFound(fn) { this.notFound = fn; }
      begin() { if (!dev.servers.includes(this)) dev.servers.push(this); }
      close() { dev.servers = dev.servers.filter((x) => x !== this); }
      handleClient() {
        if (this.busy || !this.q.length) return;
        const req = this.q.shift(); this.cur = req; this.busy = true;
        const r = this.routes.find((x) => x.path === req.path), fn = r ? r.fn : this.notFound;
        if (!fn) { this.send(404, 'text/plain', 'Not found: ' + req.path); return; }
        safeCall(async () => { await fn(); if (!req.done) this.send(200, 'text/plain', ''); });
      }
      send(code, type, body) { const req = this.cur; if (!req || req.done) return; req.done = true; this.busy = false; this.cur = null; req.resolve({ code, type: type || 'text/plain', body: body === undefined ? '' : String(body) }); }
      sendHeader() { } setContentLength() { } enableCORS() { }
      arg(name) { if (!this.cur) return ''; if (typeof name === 'number') return Object.values(this.cur.args)[name] ?? ''; return this.cur.args[name] ?? ''; }
      argName(i) { return this.cur ? Object.keys(this.cur.args)[i] ?? '' : ''; }
      hasArg(name) { return !!(this.cur && name in this.cur.args); } args() { return this.cur ? Object.keys(this.cur.args).length : 0; }
      uri() { return this.cur ? this.cur.path : ''; } method() { return this.cur && this.cur.method === 'POST' ? 3 : 1; }
      client() { const ip = this.cur ? this.cur.from : '0.0.0.0'; return { remoteIP: () => new IPAddress(ip) }; }
    };
    env.ESP8266WebServer = env.WebServer;
    // HTTP client
    env.HTTPClient = class {
      begin(a, b) { this.url = String(b === undefined ? a : b); return true; }
      addHeader() { } setTimeout(ms) { this.to = ms; } setConnectTimeout() { } setReuse() { }
      async GET() { return this._req('GET', ''); }
      async POST(body) { return this._req('POST', body === undefined ? '' : String(body)); }
      async PUT(body) { return this._req('PUT', body === undefined ? '' : String(body)); }
      async sendRequest(m, body) { return this._req(String(m), body === undefined ? '' : String(body)); }
      async _req(method, body) { this.resp = await sim.httpRequest(dev, method, this.url, body, this.to || 5000); return this.resp.code; }
      getString() { return this.resp ? this.resp.body : ''; } getSize() { return this.resp ? this.resp.body.length : 0; }
      end() { } errorToString(c) { return c === -1 ? 'connection refused' : c === -11 ? 'read timeout' : 'error ' + c; }
    };

    // The sketch only sees this environment and a few plain JS built-ins, never the page
    // (window, document, fetch, storage, the desktop bridge...). Unknown ALL_CAPS constants
    // resolve to 0 with a warning so library flags don't crash the sketch.
    return new Proxy(env, {
      has(t, k) { return typeof k === 'string' && !JS_BUILTINS.has(k); },
      get(t, k) {
        if (k === Symbol.unscopables) return undefined;
        if (k in t) return t[k];
        if (typeof k === 'string' && /^[A-Z][A-Z0-9_]{2,}$/.test(k)) { warn('k' + k, `ไม่รู้จักค่าคงที่ ${k} ใช้ค่า 0 แทน`); t[k] = 0; return 0; }
        throw new ReferenceError(String(k) + ' is not defined');
      },
      set(t, k, v) { t[k] = v; return true; } // a name assigned without a declaration stays inside the sketch
    });
  }
  // plain JavaScript the transpiled sketch may use; everything else is looked up in the sketch's environment
  const JS_BUILTINS = new Set(['Math', 'JSON', 'Number', 'String', 'Boolean', 'Array', 'Object', 'Promise', 'Date', 'Symbol', 'Map', 'Set',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Infinity', 'NaN', 'undefined', 'Error', 'TypeError', 'RangeError', 'ReferenceError',
    'Uint8Array', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'encodeURIComponent', 'decodeURIComponent']);
  const SKETCH_THIS = Object.freeze(Object.create(null)); // `this` for sketch code, instead of window

  function nmea(s) {
    const pad = (n, w) => String(n).padStart(w, '0');
    const dm = (v, lat) => { const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60; return (lat ? pad(d, 2) : pad(d, 3)) + m.toFixed(4).padStart(7, '0') + ',' + (lat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W')); };
    const now = new Date(), t = pad(now.getUTCHours(), 2) + pad(now.getUTCMinutes(), 2) + pad(now.getUTCSeconds(), 2) + '.00';
    const fix = s.sats >= 3;
    const cs = (b) => { let x = 0; for (const c of b) x ^= c.charCodeAt(0); return '$' + b + '*' + x.toString(16).toUpperCase().padStart(2, '0') + '\r\n'; };
    const gga = `GPGGA,${t},${dm(s.lat, 1)},${dm(s.lng, 0)},${fix ? 1 : 0},${pad(s.sats, 2)},0.9,12.5,M,-28.0,M,,`;
    const date = pad(now.getUTCDate(), 2) + pad(now.getUTCMonth() + 1, 2) + String(now.getUTCFullYear()).slice(2);
    const rmc = `GPRMC,${t},${fix ? 'A' : 'V'},${dm(s.lat, 1)},${dm(s.lng, 0)},0.00,0.00,${date},,,A`;
    return cs(gga) + cs(rmc);
  }

  function showSd() {
    const o = document.getElementById('sdOut');
    const names = Object.keys(sim.sd);
    o.textContent = names.length ? names.map((n) => `${n}  (${sim.sd[n].length} ไบต์)\n${sim.sd[n].slice(-2000)}`).join('\n\n') : 'ยังไม่มีไฟล์';
    ed.project.sdFiles = sim.sd;
  }

  /* ---------- part events (buttons on the canvas etc.) ---------- */
  function hookEvents() {
    ed.project.parts.forEach((p) => {
      const d = P[p.type], e = el(p); if (!e) return;
      const on = (ev, fn) => { e.addEventListener(ev, fn); sim.listeners.push(() => e.removeEventListener(ev, fn)); };
      if (d.kind === 'button') { on('button-press', () => { st(p).pressed = true; }); on('button-release', () => { st(p).pressed = false; }); }
      if (d.touch) on('pointerdown', () => { st(p).pressed = true; const up = () => { st(p).pressed = false; window.removeEventListener('pointerup', up); }; window.addEventListener('pointerup', up); });
      if (d.kind === 'keypad') on('button-press', (ev) => { st(p).key = ev.detail && ev.detail.key; });
      if (d.kind === 'irremote') on('button-press', (ev) => { if (ev.detail && ev.detail.irCode !== undefined) sim.irPush(ev.detail.irCode); });
      if (d.kind === 'encoder') {
        const pulse = (cw) => { const q = st(p); if (cw) { q.clk = 0; q.dt = 1; } else { q.dt = 0; setTimeout(() => { q.clk = 0; }, 8); } setTimeout(() => { q.clk = 1; q.dt = 1; }, 40); };
        on('rotate-cw', () => pulse(true)); on('rotate-ccw', () => pulse(false));
      }
      if (d.kind === 'dialer') on('dial', async (ev) => {
        const q = st(p), n = (ev.detail && ev.detail.digit) || 10;
        q.dial = 0; for (let i = 0; i < (n === 0 ? 10 : n); i++) { q.pulse = 0; await sleep(40); q.pulse = 1; await sleep(60); } q.dial = 1;
      });
    });
  }
  sim.event = function (kind, p) {
    if (kind === 'rfid') { const c = el(p).q('.card'); if (c) { c.setAttribute('opacity', '0.85'); setTimeout(() => c.setAttribute('opacity', '0'), 900); } }
  };

  /* ---------- program loading ---------- */
  function loadProgram(code) {
    return new Promise((resolve, reject) => {
      const src = 'window.__iotfProgram = async function (__env) { with (__env) {\n' + code + '\nreturn { setup: typeof setup === "function" ? setup : null, loop: typeof loop === "function" ? loop : null }; } };';
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const s = document.createElement('script');
      let synErr = null;
      const onErr = (ev) => { if (ev.filename === url) { synErr = { msg: ev.message, line: ev.lineno - 1 }; ev.preventDefault(); } };
      window.addEventListener('error', onErr);
      window.__iotfProgram = null;
      s.src = url;
      s.onload = () => { window.removeEventListener('error', onErr); URL.revokeObjectURL(url); s.remove(); if (synErr || !window.__iotfProgram) reject(Object.assign(new Error(synErr ? synErr.msg : 'โหลดโปรแกรมไม่สำเร็จ'), { line: synErr && synErr.line, syntax: true })); else resolve(window.__iotfProgram); };
      s.onerror = () => { window.removeEventListener('error', onErr); reject(new Error('โหลดโปรแกรมไม่สำเร็จ')); };
      sim.blobUrl = url;
      document.head.appendChild(s);
    });
  }
  function errLine(e) {
    if (e.line) return e.line;
    const m = /blob:[^\s)]*?:(\d+):\d+/.exec(e.stack || '');
    return m ? +m[1] - 1 : null;
  }
  function explain(e) {
    const msg = String(e.message || e);
    let m;
    if ((m = /^(\w+) is not defined/.exec(msg))) return `ไม่รู้จัก "${m[1]}" (พิมพ์ผิด ยังไม่ได้ประกาศตัวแปร หรือคำสั่งนี้ยังไม่รองรับในตัวจำลอง)`;
    if ((m = /(\S+) is not a function/.exec(msg))) return `"${m[1]}" เรียกใช้เป็นฟังก์ชันไม่ได้ (ไลบรารีอาจยังไม่รองรับคำสั่งนี้)`;
    if (/Cannot read properties of (null|undefined)/.test(msg)) return 'อ่านค่าจากออบเจกต์ที่ยังไม่ได้สร้าง/ไม่พบอุปกรณ์ (' + msg + ')';
    if (/Unexpected token|Unexpected identifier|missing \)|Invalid or unexpected/.test(msg)) return 'รูปแบบโค้ดผิด (syntax) — ตรวจวงเล็บ ; และชนิดตัวแปร (' + msg + ')';
    if (/Assignment to constant/.test(msg)) return 'แก้ค่าของค่าคงที่ (#define / const) ไม่ได้';
    return msg;
  }
  function onError(e, dev) {
    if (e === STOP) return;
    const line = errLine(e), who = dev && sim.devices.length > 1 ? '[' + dev.name + '] ' : '';
    serialWrite(`\n✖ ${who}${line ? 'บรรทัด ' + line + ': ' : ''}${explain(e)}\n`, 'serr');
    if (line && IOTF.app) IOTF.app.markError(line, dev && dev.id);
    sim.stop(true);
  }

  /* ---------- names the code editor can suggest ---------- */
  // an environment built only to read its names; nothing in it runs
  let hintCache = null;
  sim.hintEnv = function () {
    const b = ed.board(); if (!b) return {};
    const key = b.type;
    if (hintCache && hintCache.key === key) return hintCache.env;
    let env = {};
    const keepNets = sim.nets;
    try {
      if (!sim.nets) sim.nets = ed.nets();
      env = makeEnv({ id: 'hint', part: b, bd: ed.boardDef(b), name: '', out: {}, tones: {}, ints: [], serialIn: '', loraRx: [], pinModeHint: new Set(),
        atLineStart: true, mac: '', macBytes: [0, 0, 0, 0, 0, 0], udp: [], servers: [], wifi: { status: 0 } });
    } catch (e) { env = {}; }
    if (!keepNets) sim.nets = keepNets;
    hintCache = { key, env };
    return env;
  };

  /* ---------- the air between boards ---------- */
  function later(ms, fn) { const gen = sim.gen; sim.timers.push(setTimeout(() => { if (sim.running && gen === sim.gen) fn(); }, ms)); }
  function clonePayload(x) {
    if (x == null || typeof x !== 'object') return x;
    if (Array.isArray(x)) { const a = x.map(clonePayload); if (x.toString !== Array.prototype.toString) a.toString = x.toString; return a; }
    const o = {}; Object.keys(x).forEach((k) => { o[k] = clonePayload(x[k]); }); return o;
  }
  const bytesOf = (str) => { const a = String(str).split(''); a.toString = function () { return this.join(''); }; return a; };
  function payloadOf(data, len) {
    if (typeof data === 'string') return { kind: 'text', text: len !== undefined && len !== null ? data.slice(0, len) : data };
    if (Array.isArray(data)) return { kind: 'bytes', bytes: data.slice(0, len ?? data.length) };
    if (data && typeof data === 'object') return { kind: 'struct', obj: clonePayload(data) };
    return { kind: 'text', text: String(data) };
  }
  function payloadArg(pl) {
    if (pl.kind === 'text') return [bytesOf(pl.text), pl.text.length];
    if (pl.kind === 'bytes') return [pl.bytes.slice(), pl.bytes.length];
    return [clonePayload(pl.obj), 4];
  }
  const macArg = (bytes) => { const a = (bytes || [255, 255, 255, 255, 255, 255]).slice(); a.src_addr = a; a.des_addr = a; return a; };
  const sameMac = (a, b) => a && b && a.length >= 6 && b.length >= 6 && a.slice(0, 6).every((x, i) => (x & 255) === (b[i] & 255));
  // a packet travelling between two boards on the canvas
  const lastAnim = {};
  function anim(from, to, label, color) {
    if (!from || !to || !from.part || !to.part || from === to) return;
    const key = from.id + to.id + label, t = performance.now();
    if (lastAnim[key] && t - lastAnim[key] < 220) return; lastAnim[key] = t;
    const c = (d) => { const n = ed.els[d.part.id]; return { x: d.part.x + (n ? n.w : 100) / 2, y: d.part.y + (n ? n.h : 100) / 2 }; };
    const a = c(from), b = c(to), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.max(30, Math.abs(b.x - a.x) * 0.15);
    const layer = document.getElementById('radioLayer'); if (!layer) return;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const col = color || '#e87d0d', d = `M${a.x} ${a.y}Q${mx} ${my} ${b.x} ${b.y}`;
    g.innerHTML = `<path class="radio-line" d="${d}" stroke="${col}"/><circle r="5" fill="${col}"><animateMotion dur="0.45s" fill="freeze" path="${d}"/></circle>` +
      `<text class="radio-tag" x="${mx}" y="${my + 4}" fill="${col}" text-anchor="middle">${label}</text>`;
    g.classList.add('radio-dot'); layer.appendChild(g);
    setTimeout(() => g.remove(), 900);
  }
  sim.anim = anim;
  sim.espnowSend = function (from, toMac, pl, remote) {
    const targets = sim.devices.filter((d) => d !== from && d.espnow && d.espnow.on && (!toMac || sameMac(d.macBytes, toMac)));
    targets.forEach((d) => {
      if (!remote) anim(from, d, 'ESP-NOW', '#e87d0d');
      later(6 + Math.random() * 8, () => { if (d.espnow.recv) { const [data, len] = payloadArg(pl); safeCallDev(() => d.espnow.recv(macArg(from.macBytes), data, len), d); } });
    });
    if (!remote) {
      IOTF.iot.busSend && IOTF.iot.busSend({ type: 'espnow', from: from.macBytes, to: toMac, pl });
      if (from.espnow.sent) later(10, () => safeCallDev(() => from.espnow.sent(macArg(toMac), toMac && !targets.length ? 1 : 0), from));
    }
    return targets.length;
  };
  sim.espnowFromRemote = (msg) => { if (sim.running) sim.espnowSend({ macBytes: msg.from, id: 'remote' }, msg.to, msg.pl, true); };
  sim.udpSend = function (from, out, localPort) {
    if (!from.wifi || from.wifi.status !== 3) { warnDev(from, 'udpw', 'ส่ง UDP ไม่ได้: ยังไม่ได้เชื่อมต่อ WiFi'); return false; }
    const bc = /\.255$/.test(out.ip);
    sim.devices.forEach((d) => {
      if (d === from || !d.wifi || d.wifi.status !== 3 || !(bc || d.wifi.ip === out.ip)) return;
      d.udp.filter((u) => u.port === out.port).forEach((u) => { anim(from, d, 'UDP', '#22d3ee'); later(5, () => u.q.push({ data: out.data, from: from.wifi.ip, fromPort: localPort || out.port })); });
    });
    return true;
  };
  sim.httpRequest = function (from, method, url, body, timeout) {
    const m = /^https?:\/\/([^/:?#]+)(?::(\d+))?(\/[^?#]*)?(?:\?([^#]*))?/.exec(String(url).trim());
    if (!m) return Promise.resolve({ code: -1, body: '' });
    if (from && (!from.wifi || from.wifi.status !== 3)) { warnDev(from, 'httpw', 'ส่ง HTTP ไม่ได้: ยังไม่ได้เชื่อมต่อ WiFi'); return Promise.resolve({ code: -1, body: '' }); }
    const host = m[1], port = +m[2] || 80, path = decodeURIComponent(m[3] || '/');
    const target = sim.devices.find((d) => d.wifi && d.wifi.status === 3 && d.wifi.ip === host);
    const server = target && target.servers.find((x) => x.port === port);
    if (!server) return new Promise((r) => setTimeout(() => r({ code: -1, body: '' }), 150));
    const args = {};
    new URLSearchParams(m[4] || '').forEach((v, k) => { args[k] = v; });
    if (body) { if (/^[^{[]*=/.test(body)) new URLSearchParams(body).forEach((v, k) => { args[k] = v; }); args.plain = body; }
    if (from) anim(from, target, 'HTTP', '#3cb371');
    return new Promise((resolve) => {
      const req = { method, path, args, from: from ? from.wifi.ip : '192.168.1.50', done: false };
      const t = setTimeout(() => { if (!req.done) { req.done = true; resolve({ code: -11, body: '' }); } }, timeout || 5000);
      req.resolve = (r) => { clearTimeout(t); if (from) anim(target, from, String(r.code), '#3cb371'); resolve(r); };
      server.q.push(req);
    });
  };
  sim.loraLocal = function (from, text, freq) {
    sim.devices.forEach((d) => {
      if (d === from || !d.lora || !d.lora.p || Math.abs((d.lora.freq || 0) - freq) > 1e5) return;
      anim(from, d, 'LoRa', '#c084fc');
      later(20, () => d.loraRx.push({ text, rssi: -55 - Math.floor(Math.random() * 40) }));
    });
  };

  /* ---------- start / stop ---------- */
  function reportCompile(dev, e, explainIt) {
    const who = sim.devices.length > 1 ? '[' + dev.name + '] ' : '';
    serialWrite(`✖ ${who}${e.line ? 'บรรทัด ' + e.line + ': ' : ''}${explainIt ? explain(e) : e.message}\n`, 'serr');
    if (e.line && IOTF.app) IOTF.app.markError(e.line, dev.id);
  }
  // programs: [{ board, code }] — one per board on the canvas (a plain string runs on the active board)
  sim.start = async function (programs) {
    sim.stop(true);
    const gen = ++sim.gen; sim.curGen = gen;
    sim.partState = {}; sim.memo = {}; sim.warnOnce = new Set(); sim.clientDev = {};
    sim.sd = Object.assign({}, ed.project.sdFiles || {}); showSd();
    sim.nets = ed.nets(); sim.t0 = performance.now();
    if (!ed.board()) { serialWrite('✖ ยังไม่มีบอร์ดในวงจร\n', 'serr'); return false; }
    if (typeof programs === 'string') programs = [{ board: ed.board(), code: programs }];
    sim.devices = []; sim.devByBoard = {};
    programs.forEach((pg) => {
      const b = pg.board, ni = ed.netInfo(b);
      const dev = { id: b.id, part: b, bd: ed.boardDef(b), name: ed.boardName(b), code: pg.code, out: {}, tones: {}, ints: [], serialIn: '', loraRx: [], pinModeHint: new Set(),
        atLineStart: true, mac: ni.mac, macBytes: ni.macBytes, udp: [], servers: [], wifi: { status: 0 } };
      sim.devices.push(dev); sim.devByBoard[b.id] = dev;
    });
    for (const dev of sim.devices) {
      let t;
      try { t = IOTF.transpile(dev.code || ''); } catch (e) { reportCompile(dev, e, false); return false; }
      try { dev.fn = await loadProgram(t.code); } catch (e) { reportCompile(dev, e, true); return false; }
      if (gen !== sim.gen) return false;
    }
    sim.running = true; ed.setRunning(true);
    IOTF.iot.onRun(true);
    hookEvents();
    const tick = () => { if (!sim.running || gen !== sim.gen) return; refresh(); sim.devices.forEach((d) => d.loraHook && d.loraHook()); sim.raf = requestAnimationFrame(tick); };
    sim.raf = requestAnimationFrame(tick);
    sim.intTimer = setInterval(() => { if (sim.running) refreshInts(); }, 3);
    serialWrite(`— เริ่มจำลอง ${sim.devices.map((d) => sim.devices.length > 1 ? d.name : d.bd.name).join(', ')} —\n`, 'sinfo');
    sim.devices.forEach((dev) => runDevice(dev, gen));
    return true;
  };
  async function runDevice(dev, gen) {
    try {
      const env = makeEnv(dev);
      const prog = await dev.fn.call(SKETCH_THIS, env);
      if (!prog.setup || !prog.loop) throw Object.assign(new Error('โปรแกรมต้องมีฟังก์ชัน setup() และ loop()'), { line: 1 });
      await prog.setup();
      let last = performance.now();
      while (sim.running && gen === sim.gen) { await prog.loop(); if (performance.now() - last > 8) { await sleep(0); last = performance.now(); } }
    } catch (e) { if (e !== STOP && gen === sim.gen) onError(e, dev); }
  }
  function flowOn(dev, gpio) {
    const n = gpioNetOf(dev, gpio); if (n == null) return null;
    const m = members(n).find((x) => P[x.part.type].kind === 'flow' && x.pin === 'OUT');
    return m && powered(m.part) ? m.part : null;
  }
  function refreshInts() {
    const now = performance.now() / 1000;
    sim.devices.forEach((dev) => dev.ints.forEach((it) => {
      const fp = flowOn(dev, it.gpio);
      if (fp) { // count whole pulses since the last poll (they can be faster than the poll)
        const f = 7.5 * fp.sim.flow, c = Math.floor(now * f);
        if (it.flowC !== undefined && c > it.flowC) { const k = Math.min(c - it.flowC, 500) * (it.mode === 1 ? 2 : 1); for (let i = 0; i < k; i++) safeCallDev(it.fn, dev); }
        it.flowC = c; it.last = undefined; return;
      }
      const lv = readPinDev(dev, it.gpio);
      if (it.last !== undefined && lv !== it.last) { const rising = lv === 1; if (it.mode === 1 || (it.mode === 3 && rising) || (it.mode === 2 && !rising)) safeCallDev(it.fn, dev); }
      it.last = lv;
    }));
  }

  sim.stop = function (quiet) {
    const was = sim.running;
    sim.running = false; sim.gen++;
    cancelAnimationFrame(sim.raf); clearInterval(sim.intTimer);
    sim.timers.forEach(clearTimeout); sim.timers = [];
    sim.listeners.forEach((f) => f()); sim.listeners = [];
    Object.keys(osc).forEach((k) => sound(k, 0));
    const rl = document.getElementById('radioLayer'); if (rl) rl.innerHTML = '';
    if (was) {
      ed.project.parts.forEach((p) => {
        const d = P[p.type], e = el(p); if (!e) return;
        try {
          if (d.kind === 'led') { e.value = false; e.brightness = 0; }
          if (d.kind === 'rgb') { e.ledRed = e.ledGreen = e.ledBlue = 0; }
          if (d.kind === 'bargraph') e.values = [];
          if (d.kind === 'seg7') e.values = [0, 0, 0, 0, 0, 0, 0, 0];
          if (d.kind === 'buzzer') e.hasSignal = false;
          if (d.kind === 'board') { const B = IOTF.BOARDS[d.board]; e[B.led.prop] = false; if ('ledPower' in e) e.ledPower = false; }
          if (d.kind === 'pixels') { if (p.type === 'neopixel') { e.r = e.g = e.b = 0; } else e.reset && e.reset(); }
          if (d.kind === 'lcd') { e.characters = new Uint8Array(p.type === 'lcd2004' ? 80 : 32).fill(32); e.backlight = false; e.cursor = e.blink = false; }
          if (d.kind === 'oled' && e.imageData) { e.imageData.data.fill(0); e.redraw && e.redraw(); }
          if (d.kind === 'relay') ed.els[p.id].wrap.classList.remove('energized');
          if (d.kind === 'dcmotor') { st(p).speed = 0; const tx = e.q && e.q('.rpm'); if (tx) tx.textContent = '0 RPM'; const w = e.q && e.q('.water'); if (w) w.setAttribute('opacity', 0); const g = e.q && e.q('.shake'); if (g) g.setAttribute('transform', ''); }
          if (d.kind === 'relay4') for (let i = 1; i <= 4; i++) { const c = e.q('.ch' + i); if (c) c.setAttribute('fill', '#4a1414'); }
        } catch (err) { /* ignore */ }
      });
      flushSerial();
      if (!quiet) serialWrite('— หยุดจำลอง —\n', 'sinfo');
    }
    if (IOTF.iot && ed.project) IOTF.iot.onRun(false);
    ed.setRunning(false);
  };
  // Serial Monitor input goes to the board whose code is open
  sim.serialSend = (text) => { const d = (ed.board() && sim.devByBoard[ed.board().id]) || sim.devices[0]; if (d) d.serialIn += text; };
  sim.loraReceive = (text, rssi) => { sim.devices.forEach((d) => { if (d.lora && d.lora.p) d.loraRx.push({ text, rssi: rssi || -60 - Math.floor(Math.random() * 30) }); }); };
})();
