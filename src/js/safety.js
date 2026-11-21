/* WJSIM — checks for projects that come from outside (files, links, the cloud, old autosaves).
 * Everything a project file holds ends up in the page: as SVG, as HTML in panels, as properties
 * set on part elements. A crafted file must not be able to run script that way, so every project
 * is cleaned here before it is opened: unknown part types and keys are dropped, ids, pin names,
 * colours and numbers are checked, text is length-limited. */
(function () {
  'use strict';
  const IOTF = window.IOTF;
  const ID = /^[A-Za-z0-9_-]{1,48}$/;
  const PIN = /^[A-Za-z0-9_.+~#-]{1,24}$/;
  const COLOR = /^(#[0-9a-fA-F]{3,8}|[a-z]{3,20})$/;
  const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1e6, Math.min(1e6, v)) : d);
  const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').slice(0, max) : '');
  const LIMITS = { parts: 600, wires: 3000, points: 60, code: 300000, widgets: 100, sdFiles: 200, sdBytes: 2000000 };

  // a value for a part attribute: plain short text, a number or true/false
  function attrValue(v) {
    if (typeof v === 'number') return num(v);
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string' && /^[\w .#%+-]{0,40}$/.test(v)) return v;
    return undefined;
  }

  function cleanProject(src) {
    if (!src || typeof src !== 'object' || !Array.isArray(src.parts)) throw new Error('ไม่ใช่ไฟล์โปรเจกต์ WJSIM');
    if (src.parts.length > LIMITS.parts) throw new Error(`มีอุปกรณ์มากเกินไป (${src.parts.length} ชิ้น)`);
    if (Array.isArray(src.wires) && src.wires.length > LIMITS.wires) throw new Error('มีสายไฟมากเกินไป');
    const P = IOTF.PARTS, out = {};
    out.name = text(src.name, 80) || 'ไม่มีชื่อ';
    out.mode = src.mode === 'advanced' ? 'advanced' : 'basic';
    if (['ortho', 'straight', 'curve'].includes(src.wireStyle)) out.wireStyle = src.wireStyle;
    if (typeof src.dashId === 'string' && ID.test(src.dashId)) out.dashId = src.dashId;
    if (src.untrusted) out.untrusted = true;

    const ids = new Set(), dropped = [];
    out.parts = [];
    src.parts.forEach((q) => {
      if (!q || typeof q !== 'object' || !P[q.type] || typeof q.id !== 'string' || !ID.test(q.id) || ids.has(q.id)) { dropped.push(q && q.type); return; }
      const d = P[q.type], p = { id: q.id, type: q.type, x: num(q.x), y: num(q.y), rot: [0, 90, 180, 270].includes(q.rot) ? q.rot : 0, attrs: {}, sim: {} };
      const okAttrs = new Set(Object.keys(d.attrs || {}).concat(Object.keys(d.opts || {})));
      Object.entries(q.attrs && typeof q.attrs === 'object' ? q.attrs : {}).forEach(([k, v]) => { const val = attrValue(v); if (okAttrs.has(k) && val !== undefined) p.attrs[k] = val; });
      Object.entries(q.sim && typeof q.sim === 'object' ? q.sim : {}).forEach(([k, v]) => {
        if (typeof v === 'number' || typeof v === 'boolean') p.sim[k] = typeof v === 'number' ? num(v) : v;
        else if (typeof v === 'string' && /^[\w .:-]{0,60}$/.test(v)) p.sim[k] = v; // e.g. an RFID card UID
      });
      if (q.name !== undefined) p.name = text(q.name, 40);
      ids.add(p.id); out.parts.push(p);
    });

    out.wires = [];
    (Array.isArray(src.wires) ? src.wires : []).forEach((w) => {
      if (!w || typeof w !== 'object' || !w.a || !w.b) return;
      const end = (e) => (e && ids.has(e.p) && typeof e.pin === 'string' && PIN.test(e.pin) ? { p: e.p, pin: e.pin } : null);
      const a = end(w.a), b = end(w.b);
      if (!a || !b || typeof w.id !== 'string' || !ID.test(w.id)) return;
      const c = { id: w.id, a, b, color: typeof w.color === 'string' && COLOR.test(w.color) ? w.color : '#3cb371' };
      if (w.auto) c.auto = true;
      if (Array.isArray(w.points)) c.points = w.points.slice(0, LIMITS.points).filter((q) => q && typeof q === 'object').map((q) => ({ x: num(q.x), y: num(q.y) }));
      out.wires.push(c);
    });

    const prog = (g) => {
      const r = { blocks: null, code: '', codeManual: false };
      if (g && typeof g === 'object') {
        if (g.blocks && typeof g.blocks === 'object') r.blocks = g.blocks; // Blockly loads it as data; field text is never HTML
        if (typeof g.code === 'string') r.code = g.code.slice(0, LIMITS.code);
        r.codeManual = !!g.codeManual;
      }
      return r;
    };
    const top = prog(src); out.blocks = top.blocks; out.code = top.code; out.codeManual = top.codeManual;
    out.programs = {};
    if (src.programs && typeof src.programs === 'object') Object.entries(src.programs).forEach(([k, g]) => { if (ids.has(k)) out.programs[k] = prog(g); });
    if (typeof src.activeBoard === 'string' && ids.has(src.activeBoard)) out.activeBoard = src.activeBoard;

    out.widgets = (Array.isArray(src.widgets) ? src.widgets : []).slice(0, LIMITS.widgets).filter((w) => w && typeof w === 'object').map((w) => {
      const c = {};
      Object.entries(w).forEach(([k, v]) => { if (typeof v === 'string') c[k] = text(v, 120); else if (typeof v === 'number') c[k] = num(v); else if (typeof v === 'boolean') c[k] = v; });
      return c;
    });
    // IoT Cloud: variables (names become C++ identifiers in the generated header, so they are checked strictly)
    const cl = src.cloud && typeof src.cloud === 'object' ? src.cloud : {};
    const VAR = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/, names = new Set();
    out.cloud = { vars: [], widgets: [] };
    (Array.isArray(cl.vars) ? cl.vars : []).slice(0, LIMITS.widgets).forEach((v) => {
      if (!v || typeof v !== 'object' || typeof v.name !== 'string' || !VAR.test(v.name) || names.has(v.name) || (IOTF.iotcloud && !IOTF.iotcloud.validName(v.name))) return;
      names.add(v.name);
      out.cloud.vars.push({ name: v.name, type: ['bool', 'int', 'float', 'String'].includes(v.type) ? v.type : 'float', perm: v.perm === 'READ' ? 'READ' : 'READWRITE',
        board: typeof v.board === 'string' && ids.has(v.board) ? v.board : '*', every: [1, 2, 5, 10, 30, 60].includes(v.every) ? v.every : 0 });
    });
    (Array.isArray(cl.widgets) ? cl.widgets : []).slice(0, LIMITS.widgets).forEach((w) => {
      if (!w || typeof w !== 'object' || !names.has(w.var) || !['switch', 'push', 'slider', 'value', 'gauge', 'status', 'chart', 'messenger'].includes(w.type)) return;
      out.cloud.widgets.push({ id: typeof w.id === 'string' && ID.test(w.id) ? w.id : 'c' + out.cloud.widgets.length, type: w.type, var: w.var, title: text(w.title, 60), unit: text(w.unit, 12), min: num(w.min), max: num(w.max, 100) });
    });
    out.sdFiles = {};
    let bytes = 0;
    if (src.sdFiles && typeof src.sdFiles === 'object') Object.entries(src.sdFiles).slice(0, LIMITS.sdFiles).forEach(([k, v]) => {
      if (typeof v !== 'string' || !/^[\w ./-]{1,64}$/.test(k) || (bytes += v.length) > LIMITS.sdBytes) return;
      out.sdFiles[k] = v;
    });
    out.droppedParts = dropped.length;
    return out;
  }

  // a project carries hand-written C++ that someone else may have written
  const hasOwnCode = (p) => !!(p.codeManual && p.code) || Object.values(p.programs || {}).some((g) => g && g.codeManual && g.code);

  IOTF.safety = { cleanProject, hasOwnCode, esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
})();
