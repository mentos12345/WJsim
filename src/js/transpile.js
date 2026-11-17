/* WJSIM — Arduino C++ (subset) → JavaScript.
 * Keeps line numbers so errors point at the user's code.
 * Supported: globals/locals of primitive & library types, arrays (incl. 2-D initialisers),
 * functions, #define, enum, casts, String methods, loops, switch, F(), sprintf/dtostrf.
 * Also: plain structs (struct / typedef struct) become small JS classes, simple lambdas, ESP-NOW/UDP/HTTP helpers.
 * Not supported: class/template/namespace definitions, pointers arithmetic, references as out-params.
 */
(function () {
  'use strict';
  const PRIMS = ['long\\s+long', 'long\\s+int', 'long', 'int', 'short', 'char', 'float', 'double', 'bool', 'boolean', 'byte', 'word', 'String', 'size_t', 'u?int(?:8|16|32|64)_t', 'esp_err_t', 'esp_now_send_status_t', 'wl_status_t', 'auto'];
  const INTS = /^(?:unsigned|signed)?\s*(long\s+long|long\s+int|long|int|short|byte|word|size_t|u?int(?:8|16|32|64)_t|unsigned)$/;
  const CLASSES = ['DHT', 'Servo', 'ESP32Servo', 'LiquidCrystal_I2C', 'LiquidCrystal', 'Adafruit_SSD1306', 'Adafruit_ILI9341', 'Adafruit_NeoPixel', 'WiFiClient', 'WiFiClientSecure',
    'PubSubClient', 'Adafruit_MPU6050', 'sensors_event_t', 'HX711', 'MFRC522', 'TinyGPSPlus', 'SoftwareSerial', 'HardwareSerial', 'RTC_DS1307', 'RTC_DS3231', 'DateTime', 'File',
    'Keypad', 'Stepper', 'IRrecv', 'TimeSpan', 'IPAddress', 'WebServer', 'ESP8266WebServer', 'HTTPClient', 'WiFiUDP', 'esp_now_peer_info_t',
    'OneWire', 'DallasTemperature', 'Adafruit_BME280', 'Adafruit_BMP280', 'BH1750', 'PMS', 'PMS_DATA', 'PZEM004Tv30', 'PulseOximeter', 'MAX30105'];

  class TranspileError extends Error { constructor(msg, line) { super(msg); this.line = line; } }

  function stripComments(s) {
    let out = '', i = 0, q = null;
    while (i < s.length) {
      const c = s[i], n = s[i + 1];
      if (q) { out += c; if (c === '\\') { out += n || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
      if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) { if (s[i] === '\n') out += '\n'; i++; } i += 2; continue; }
      out += c; i++;
    }
    return out;
  }

  // replace string/char literals with placeholders
  function protect(s) {
    const lits = [];
    const out = s.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => {
      let v = m;
      if (m[0] === "'") v = '"' + m.slice(1, -1).replace(/"/g, '\\"') + '"';
      lits.push(v); return '\u0001' + (lits.length - 1) + '\u0002';
    });
    return { out, restore: (x) => x.replace(/\u0001(\d+)\u0002/g, (_, i) => lits[+i]) };
  }


  // C++ needs ';' after statements; JS would silently accept the missing ones, so report them like a compiler would
  function lintSemicolons(s) {
    const lines = s.split('\n');
    let depth = 0, lastCh = '';
    const stack = [];
    const sig = [];
    lines.forEach((ln, i) => { const t = ln.trim(); if (t) sig.push(i); });
    for (let k = 0; k < sig.length; k++) {
      const i = sig[k], t = lines[i].trim();
      const before = depth, inInit = stack.includes('init');
      for (const c of t) {
        if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
        else if (c === '{') stack.push(lastCh === '=' || lastCh === ',' || (lastCh === '{' && stack[stack.length - 1] === 'init') ? 'init' : 'block');
        else if (c === '}') stack.pop();
        if (!/\s/.test(c)) lastCh = c;
      }
      if (depth > 0 || before > 0 || inInit || stack.includes('init')) continue;
      if (/^#/.test(t) || /[;{},(\[:\\&|+\-*/=<>!?^%]$/.test(t)) continue;
      if (/^(else|do|try)$/.test(t) || /^(case\b.*|default\s*):$/.test(t)) continue;
      if (/^(\}\s*)?(if|for|while|switch|else\s+if|catch)\b.*\)$/.test(t)) continue;
      if (/^\}\s*else$/.test(t)) continue;
      const nx = k + 1 < sig.length ? lines[sig[k + 1]].trim() : '';
      if (/^[{.?:+\-*/%&|=<>)\]^]/.test(nx) || /^(else)\b/.test(nx) && /\)$/.test(t)) continue;
      if (/\)$/.test(t) && /^\{/.test(nx)) continue;
      throw new TranspileError("ลืมใส่ ; ท้ายคำสั่งหรือเปล่า? (C++ ต้องปิดท้ายคำสั่งด้วย ;)", i + 1);
    }
  }

  // `static` locals keep their value between calls: move them to a renamed global on the function's first line
  function hoistStatics(s) {
    const re = /\bstatic\s+/g; let m, guard = 0;
    while ((m = re.exec(s)) && guard++ < 200) {
      let depth = 0, fnStart = -1;
      for (let k = 0; k < m.index; k++) { if (s[k] === '{') { if (depth === 0) fnStart = k; depth++; } else if (s[k] === '}') depth--; }
      if (depth <= 0) continue;
      const end = s.indexOf(';', m.index); if (end < 0) break;
      const decl = s.slice(m.index + m[0].length, end);
      const dm = /^([\w\s*&]+?)\s*\b(\w+)\s*(=.*)?$/s.exec(decl.trim());
      if (!dm || /,/.test(decl)) continue;
      const name = dm[2], g = '__s' + guard + '_' + name;
      let close = fnStart, d = 0; for (; close < s.length; close++) { if (s[close] === '{') d++; else if (s[close] === '}') { d--; if (d === 0) break; } }
      let lineStart = s.lastIndexOf('\n', fnStart) + 1;
      const body = s.slice(end + 1, close).replace(new RegExp('\\b' + name + '\\b', 'g'), g);
      const pre = s.slice(lineStart, m.index);
      const globalDecl = `${dm[1].trim()} ${g}${dm[3] ? ' ' + dm[3] : ''}; `;
      s = s.slice(0, lineStart) + globalDecl + pre + s.slice(end + 1, end + 1) + body + s.slice(close);
      re.lastIndex = lineStart + globalDecl.length;
    }
    return s;
  }

  function lineAt(s, idx) { return s.slice(0, idx).split('\n').length; }

  function matchClose(s, i, open, close) { // i at open char
    let d = 0;
    for (let k = i; k < s.length; k++) { if (s[k] === open) d++; else if (s[k] === close) { d--; if (d === 0) return k; } }
    return -1;
  }
  function splitTop(s, sep) {
    const parts = []; let d = 0, cur = '';
    for (const c of s) {
      if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--;
      if (c === sep && d === 0) { parts.push(cur); cur = ''; } else cur += c;
    }
    parts.push(cur); return parts;
  }
  const bracesToArrays = (s) => s.replace(/\{/g, '[').replace(/\}/g, ']');

  function transpile(src) {
    let s = stripComments(src.replace(/\r\n?/g, '\n'));
    const userTypes = [], typeAlias = {};
    // --- preprocessor (line by line, keeps line count)
    s = s.split('\n').map((ln) => {
      const t = ln.trim();
      if (!t.startsWith('#')) return ln;
      let m;
      if ((m = /^#\s*define\s+(\w+)\(([^)]*)\)\s+(.+)$/.exec(t))) return `const ${m[1]} = (${m[2]}) => (${m[3]});`;
      if ((m = /^#\s*define\s+(\w+)\s+(.+)$/.exec(t))) return `const ${m[1]} = ${m[2]};`;
      if ((m = /^#\s*define\s+(\w+)\s*$/.exec(t))) return `const ${m[1]} = 1;`;
      return '';
    }).join('\n');

    const P = protect(s); s = P.out;

    lintSemicolons(s);
    s = hoistStatics(s);

    // structs → classes with default-initialised fields (one line, newlines kept)
    const structFields = {};
    s = s.replace(/\b(typedef\s+)?struct\s+(\w*)\s*\{([^{}]*)\}\s*(\w*)\s*;/g, (m, td, tag, body, alias) => {
      const name = td ? alias || tag : tag;
      if (!name) return m;
      const fields = [];
      body.split(';').map((x) => x.trim()).filter(Boolean).forEach((f) => {
        const fm = /^(?:const\s+)?((?:unsigned\s+|signed\s+)?[\w]+(?:\s+(?:long|int))?)\s*([*&]*)\s*(.+)$/s.exec(f.replace(/\s+/g, ' '));
        if (!fm) return;
        splitTop(fm[3], ',').forEach((d) => {
          const dm = /^\s*[*&]*\s*(\w+)\s*((?:\[[^\]]*\]\s*)*)(?:=\s*(.*))?$/.exec(d);
          if (!dm) return;
          const type = fm[1].trim(), dims = (dm[2].match(/\[([^\]]*)\]/g) || []).map((x) => x.slice(1, -1).trim());
          const isStr = type === 'String' || ((type === 'char') && (dims.length === 1 || fm[2]));
          let v;
          if (dm[3] !== undefined) v = dm[3].trim().startsWith('{') ? bracesToArrays(dm[3].trim()) : dm[3].trim();
          else if (isStr) v = '""';
          else if (dims.length) v = `__arr([${dims.join(',')}], 0)`;
          else if (/^(bool|boolean)$/.test(type)) v = 'false';
          else if (/^(int|long|short|byte|word|float|double|char|unsigned|size_t|u?int\d+_t|unsigned long|unsigned int|long long)$/.test(type)) v = '0';
          else v = `(typeof ${type} === "function" ? new ${type}() : 0)`;
          fields.push([dm[1], v]);
        });
      });
      structFields[name] = fields.map((f) => f[0]);
      if (tag && tag !== name) { userTypes.push(tag); structFields[tag] = structFields[name]; }
      userTypes.push(name);
      const nl = '\n'.repeat((m.match(/\n/g) || []).length);
      return `class ${name} { constructor() { ${fields.map(([k, v]) => `this.${k} = ${v};`).join(' ')} } }` + (tag && tag !== name ? ` const ${tag} = ${name};` : '') + nl;
    });
    // `struct Foo x;` → `Foo x;`
    s = s.replace(/\bstruct\s+(?=\w+\s*[*&]*\s*\w)/g, '');
    // typedef of a simple type: drop it and treat the alias as that type later
    s = s.replace(/\btypedef\s+((?:unsigned\s+)?\w+)\s+(\w+)\s*;/g, (m, t, a) => { typeAlias[a] = t; return ''; });
    Object.keys(typeAlias).forEach((a) => { s = s.replace(new RegExp('\\b' + a + '\\b', 'g'), typeAlias[a]); });
    // simple lambdas  [](...) { … }  /  [&](...) { … }
    s = s.replace(/\[\s*[&=]?\s*\]\s*\(([^()]*)\)\s*(?:->\s*\w+\s*)?\{/g, (m, params) => {
      const ps = params.trim() === '' || params.trim() === 'void' ? [] : params.split(',').map((x) => { const id = /(\w+)\s*(?:\[[^\]]*\]\s*)*$/.exec(x.split('=')[0].trim()); return id ? id[1] : '_'; });
      return `async (${ps.join(', ')}) => {`;
    });

    // unsupported constructs (class keyword produced above for structs is allowed)
    const badRe = /\b(struct|class|template|namespace|typedef|union|operator)\b/g;
    let bad;
    while ((bad = badRe.exec(s)) && bad[1] === 'class' && /^class \w+ \{ constructor\(\)/.test(s.slice(bad.index))) { /* generated */ }
    if (bad) throw new TranspileError(`ยังไม่รองรับ '${bad[1]}' ในตัวจำลอง (ใช้ตัวแปร/ฟังก์ชันธรรมดาแทน)`, lineAt(s, bad.index));
    s = s.replace(/\bstd::/g, '');
    s = s.replace(/\bPMS::DATA\b/g, 'PMS_DATA').replace(/\bBH1750::(\w+)/g, 'BH1750.$1');
    const colon = /\w::\w/.exec(s);
    if (colon) throw new TranspileError("ยังไม่รองรับเครื่องหมาย '::'", lineAt(s, colon.index));

    // enums → consts
    s = s.replace(/\benum\s+(?:class\s+)?(\w*)\s*\{([^}]*)\}\s*;/g, (m, name, body) => {
      if (name) userTypes.push(name);
      let v = -1;
      const items = body.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [k, e] = x.split('=').map((y) => y.trim()); v = e !== undefined ? Number(e) : v + 1; return `${k} = ${v}`; });
      return items.length ? `const ${items.join(', ')};` + '\n'.repeat((m.match(/\n/g) || []).length) : '\n'.repeat((m.match(/\n/g) || []).length);
    });

    s = s.replace(/\b(PROGMEM|IRAM_ATTR|ICACHE_RAM_ATTR|volatile|inline|extern|register|constexpr)\b\s*/g, '');
    s = s.replace(/\bstatic\s+(?=[A-Za-z_])/g, '');
    s = s.replace(/\b(F|PSTR)\s*\(/g, '(');

    const CL = CLASSES.concat(userTypes);
    const TYPE = `(?:const\\s+)?(?:(?:unsigned|signed)\\s+)?(?:${PRIMS.join('|')}|unsigned|${CL.join('|')})(?:\\s*[*&]+\\s*|\\s+)(?:const\\s+)?`;
    const TYPE_ONLY = new RegExp(`^\\s*${TYPE}`);

    // sizeof
    s = s.replace(/\bsizeof\s*\(\s*(\w+)\s*\)\s*\/\s*sizeof\s*\(\s*\1\s*\[\s*0\s*\]\s*\)/g, '$1.length');
    s = s.replace(/\bsizeof\s*\(\s*(\w+)\s*\)/g, '__sizeof($1)');

    // pointer casts like (char*)payload are dropped; byte arrays stringify themselves
    s = s.replace(/\(\s*(?:const\s+)?(?:char|byte|uint8_t|unsigned\s+char|void)\s*\*\s*\)\s*/g, '');
    s = s.replace(/\b(?:strcpy|strncpy|strlcpy)\s*\(\s*([\w.\[\]]+)\s*,([^;]*?)(?:,\s*[^,;()]+)?\)\s*;/g, (m, dst, src) => (/^strcpy/.test(m) ? `${dst} = String(${src});` : `${dst} = String(${src}).slice(0, ${m.match(/,\s*([^,;()]+)\)\s*;$/)[1]} - 1);`))
      .replace(/\bstrcat\s*\(\s*([\w.\[\]]+)\s*,/g, '$1 += String(');
    // memcpy into a variable returns the new value (strings are immutable in JS)
    s = s.replace(/(^|[;{}\n]\s*)memcpy\s*\(\s*&?\s*([\w.\[\]]+)\s*,/g, '$1$2 = memcpy($2,');
    // X.read(buf, n) / readBytes(buf, n) fill a buffer
    s = s.replace(/(?<![\w.])([\w.]+)\.(read|readBytes)\s*\(\s*([\w.\[\]]+)\s*,/g, '__readInto($1, (__v) => { $3 = __v; },');
    // casts:  (type) operand  → __int(...) / __char(...) / (...)
    const castRe = /\(\s*((?:unsigned\s+|signed\s+)?(?:long\s+long|long|int|short|char|float|double|byte|word|bool|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t|String))\s*\)\s*(?=[\w(\u0001-])/g;
    let cm;
    while ((cm = castRe.exec(s))) {
      const type = cm[1], start = cm.index, opStart = cm.index + cm[0].length;
      let end = opStart;
      if (s[end] === '(') end = matchClose(s, end, '(', ')') + 1;
      else {
        if (s[end] === '-') end++;
        const m2 = /^(?:\u0001\d+\u0002|[\w.]+)/.exec(s.slice(end)); end += m2 ? m2[0].length : 0;
        while (s[end] === '[' || s[end] === '(') end = matchClose(s, end, s[end], s[end] === '[' ? ']' : ')') + 1;
      }
      const operand = s.slice(opStart, end);
      const fn = type === 'char' ? '__char' : /float|double/.test(type) ? '' : type === 'bool' ? '!!' : type === 'String' ? 'String' : '__int';
      const rep = fn === '!!' ? `(!!(${operand}))` : `${fn}(${operand})`;
      s = s.slice(0, start) + rep + s.slice(end);
      castRe.lastIndex = start + rep.length;
    }

    // functions:  TYPE name(params) {   → async function name(params) {
    const userFns = [];
    const fnRe = new RegExp(`(^|[;{}\\n])([ \\t]*)(?:${TYPE}|void\\s+)(\\w+)\\s*\\(([^()]*)\\)\\s*(?:const\\s*)?\\{`, 'g');
    s = s.replace(fnRe, (m, pre, ind, name, params) => {
      if (['if', 'while', 'for', 'switch', 'return'].includes(name)) return m;
      userFns.push(name);
      const ps = params.trim() === 'void' ? [] : params.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
        const noDef = x.split('=')[0].trim();
        const id = /(\w+)\s*(?:\[[^\]]*\]\s*)*$/.exec(noDef); return id ? id[1] : '_';
      });
      return `${pre}${ind}async function ${name}(${ps.join(', ')}) {`;
    });
    // prototypes
    const protoRe = new RegExp(`(^|[;{}\\n])[ \\t]*(?:${TYPE}|void\\s+)(\\w+)\\s*\\(([^()]*)\\)\\s*;`, 'g');
    s = s.replace(protoRe, (m, pre, name, params) => {
      if (params.trim() === '' || params.trim() === 'void' || /\b(int|float|char|String|byte|bool|boolean|long|double|void|unsigned|uint\d+_t|int\d+_t|size_t)\b/.test(params)) return pre;
      return m;
    });

    // declarations
    const declStart = new RegExp(`(^|[;{}(\\n])([ \\t]*)(${TYPE})(?=[*&]*[A-Za-z_])`, 'g');
    let dm;
    while ((dm = declStart.exec(s))) {
      const typeTxt = dm[3].replace(/\b(const)\b/g, '').replace(/[*&]/g, '').trim().replace(/\s+/g, ' ');
      const isPtr = /\*/.test(dm[3]);
      const isClass = CL.includes(typeTxt);
      const from = dm.index + dm[1].length + dm[2].length;
      let i = from + dm[3].length, depth = 0, end = i;
      for (; end < s.length; end++) {
        const c = s[end];
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) { if (depth === 0) break; depth--; }
        else if (c === ';' && depth === 0) break;
      }
      const body = s.slice(i, end);
      if (/^\s*\w+\s*\(/.test(body) && !isClass) { declStart.lastIndex = from + dm[3].length; continue; }
      const decls = splitTop(body, ',').map((d) => {
        let m = /^\s*[*&]*\s*(\w+)\s*((?:\[[^\]]*\]\s*)*)(.*)$/s.exec(d);
        if (!m) return d;
        const name = m[1], dims = (m[2].match(/\[([^\]]*)\]/g) || []).map((x) => x.slice(1, -1).trim());
        let rest = m[3].trim(), init = null, ctor = null;
        if (rest.startsWith('=')) init = rest.slice(1).trim();
        else if (rest.startsWith('(')) ctor = rest.slice(1, rest.lastIndexOf(')'));
        else if (rest.startsWith('{') && isClass) ctor = rest.slice(1, rest.lastIndexOf('}'));
        let val;
        const isCharStr = typeTxt === 'char' && (dims.length === 1 || isPtr);
        if (init !== null && init === '') throw new TranspileError('ค่าหลังเครื่องหมาย = หายไป', lineAt(s, from));
        if (init !== null) {
          if (init.startsWith('{') && isClass && !dims.length) {
            const inner = init.slice(1, init.lastIndexOf('}')).trim(), names = structFields[typeTxt] || [];
            const vals = inner ? splitTop(inner, ',').map((x) => x.trim()) : [];
            val = vals.length && names.length ? `Object.assign(new ${typeTxt}(), {${vals.map((v, k) => `${names[k] || '_' + k}: ${v.startsWith('{') ? bracesToArrays(v) : v}`).join(', ')}})` : `new ${typeTxt}()`;
          } else if (init.startsWith('{')) val = bracesToArrays(init);
          else if (INTS.test(typeTxt) && !dims.length && !isPtr) val = `__int(${init})`;
          else val = init;
        } else if (ctor !== null) {
          val = isClass ? `new ${typeTxt}(${ctor})` : ctor;
        } else if (dims.length && !isCharStr) {
          const dv = typeTxt === 'String' ? '""' : typeTxt === 'char' ? '""' : isClass ? 'null' : '0';
          val = `__arr([${dims.join(',')}], ${dv}${isClass ? `, () => new ${typeTxt}()` : ''})`;
        } else if (isClass) val = `new ${typeTxt}()`;
        else val = typeTxt === 'String' || typeTxt === 'char' || isPtr ? '""' : /bool/.test(typeTxt) ? 'false' : '0';
        return `${name} = ${val}`;
      });
      const rep = 'let ' + decls.join(', ');
      s = s.slice(0, from) + rep + s.slice(end);
      declStart.lastIndex = from + rep.length;
    }

    // address-of in argument lists, arrows
    s = s.replace(/([(,]\s*)&(?=[A-Za-z_])/g, '$1');
    s = s.replace(/->/g, '.');
    // String helpers
    s = s.replace(/\.length\s*\(\s*\)/g, '.length').replace(/\.c_str\s*\(\s*\)/g, '');
    s = s.replace(/(^|[;{}\n]\s*)(\w+)\.(toUpperCase|toLowerCase|trim)\s*\(\s*\)\s*;/g, '$1$2 = $2.$3();');
    s = s.replace(/(^|[;{}\n]\s*)(\w+)\.replace\s*\(/g, '$1$2 = __strReplace($2, ');
    s = s.replace(/\bsnprintf\s*\(\s*(\w+)\s*,[^,]+,/g, '$1 = __sprintf(').replace(/\bsprintf\s*\(\s*(\w+)\s*,/g, '$1 = __sprintf(');
    s = s.replace(/\bdtostrf\s*\(([^;]*?),\s*(\w+)\s*\)\s*;/g, '$2 = __dtostrf($1);');
    // `new` for library constructors used as expressions
    s = s.replace(new RegExp(`(?<![\\w.])(?<!new\\s)(${CL.join('|')})\\s*\\(`, 'g'), 'new $1(');
    // awaits
    s = s.replace(/(?<![\w.])(delay|delayMicroseconds)\s*\(/g, 'await $1(');
    s = s.replace(/(?<![\w.])yield\s*\(\s*\)/g, 'await __y()');
    s = s.replace(/(?<![\w.])(\w+)\.(step|waitForKey|GET|POST|PUT|PATCH|sendRequest|readUntil)\s*\(/g, 'await $1.$2(');
    if (userFns.length) {
      const fr = new RegExp(`(?<![\\w.])(${userFns.join('|')})\\s*\\(`, 'g');
      s = s.replace(fr, (m, name, off, all) => (/function\s+$/.test(all.slice(Math.max(0, off - 12), off)) ? m : `await ${name}(`));
    }
    // `await f().x` would read .x of the promise: make it `(await f()).x`
    s = wrapAwaitMembers(s);
    // loop yields
    s = addLoopYields(s);
    return { code: P.restore(s), userFns };
  }

  function wrapAwaitMembers(s) {
    const re = /await [\w.]+\(/g, at = [];
    let m; while ((m = re.exec(s))) at.push([m.index, m[0].length]);
    // innermost (rightmost) first, so earlier positions stay valid
    for (let k = at.length - 1; k >= 0; k--) {
      const [start, len] = at[k];
      let i = start + len, depth = 1;
      while (i < s.length && depth) { if (s[i] === '(') depth++; else if (s[i] === ')') depth--; i++; }
      if (depth) continue;
      if (/^\s*[.[]/.test(s.slice(i, i + 40))) s = s.slice(0, start) + '(' + s.slice(start, i) + ')' + s.slice(i);
    }
    return s;
  }
  function addLoopYields(s) {
    const re = /\b(while|for)\s*\(/g; let m;
    while ((m = re.exec(s))) {
      const open = s.indexOf('(', m.index), close = matchClose(s, open, '(', ')');
      if (close < 0) break;
      let k = close + 1; while (/\s/.test(s[k])) k++;
      // `} while (x);` of a do-while: skip
      const before = s.slice(0, m.index).trimEnd();
      if (m[1] === 'while' && before.endsWith('}') && s[k] === ';' && isDoWhile(s, before.length - 1)) { re.lastIndex = close; continue; }
      let ins;
      if (s[k] === '{') ins = { at: k + 1, text: ' await __y();' };
      else if (s[k] === ';') { s = s.slice(0, k) + '{ await __y(); }' + s.slice(k + 1); re.lastIndex = k; continue; }
      else {
        let d = 0, e = k;
        for (; e < s.length; e++) { const c = s[e]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) break; }
        s = s.slice(0, k) + '{ await __y(); ' + s.slice(k, e + 1) + ' }' + s.slice(e + 1);
        re.lastIndex = k; continue;
      }
      s = s.slice(0, ins.at) + ins.text + s.slice(ins.at);
      re.lastIndex = ins.at;
    }
    s = s.replace(/\bdo\s*\{/g, 'do { await __y();');
    return s;
  }
  function isDoWhile(s, closeIdx) {
    let d = 0;
    for (let k = closeIdx; k >= 0; k--) { if (s[k] === '}') d++; else if (s[k] === '{') { d--; if (d === 0) return /\bdo\s*$/.test(s.slice(0, k)); } }
    return false;
  }

  IOTF.transpile = transpile;
  IOTF.TranspileError = TranspileError;
})();
