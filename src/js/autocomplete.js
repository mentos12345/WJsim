/* WJSIM — C++ autocomplete for the code editor.
 * Suggestions pop up while typing (like a Python IDE); Tab or Enter inserts, arrows choose, Esc closes, Ctrl+Space opens.
 * Names come from what the simulator really supports (its Arduino environment), plus keywords, snippets,
 * #include headers, members after "obj." (by the variable's declared type) and words already in the code. */
(function () {
  'use strict';
  const IOTF = window.IOTF;

  // signatures shown beside the name (inserted text is only the name and parentheses)
  const SIG = {
    pinMode: 'pin, mode', digitalWrite: 'pin, value', digitalRead: 'pin', analogRead: 'pin', analogWrite: 'pin, value',
    delay: 'ms', delayMicroseconds: 'us', millis: '', micros: '', map: 'value, fromLow, fromHigh, toLow, toHigh',
    constrain: 'x, a, b', min: 'a, b', max: 'a, b', abs: 'x', pow: 'base, exp', sqrt: 'x', random: 'min, max', randomSeed: 'seed',
    tone: 'pin, freq, duration', noTone: 'pin', attachInterrupt: 'interrupt, isr, mode', detachInterrupt: 'interrupt',
    digitalPinToInterrupt: 'pin', pulseIn: 'pin, value', shiftOut: 'dataPin, clockPin, order, value', ledcSetup: 'ch, freq, bits',
    ledcAttachPin: 'pin, ch', ledcWrite: 'ch, duty', ledcAttach: 'pin, freq, bits', analogReadResolution: 'bits',
    touchRead: 'pin', strcpy: 'dst, src', strcmp: 'a, b', strlen: 's', memcpy: 'dst, src, n', memset: 'dst, v, n', sprintf: 'buf, fmt, ...',
    esp_now_init: '', esp_now_send: 'mac, data, len', esp_now_add_peer: '&peer', esp_now_register_recv_cb: 'callback', esp_now_register_send_cb: 'callback',
    begin: '...', print: 'value', println: 'value', printf: 'fmt, ...', write: 'value', read: '', available: '', setCursor: 'col, row',
    connect: '...', publish: 'topic, payload', subscribe: 'topic', setCallback: 'callback', setServer: 'host, port', loop: '',
    readTemperature: '', readHumidity: '', attach: 'pin', on: 'path, handler', send: 'code, type, body', arg: 'name', GET: '', POST: 'body',
    setPixelColor: 'i, r, g, b', show: '', clear: '', display: '', clearDisplay: '', setTextSize: 'n', setTextColor: 'color', drawPixel: 'x, y, color',
    addProperty: 'variable, READWRITE, ON_CHANGE, onChange', update: '', connected: '', addCallback: 'event, callback', printDebugInfo: '', initProperties: '', setDebugMessageLevel: 'level',
    beginPacket: '...', endPacket: '', parsePacket: '', localIP: '', macAddress: '', status: '', mode: 'mode', backlight: '', init: '',
  };

  const KEYWORDS = ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'true', 'false', 'const', 'static',
    'volatile', 'unsigned', 'void', 'int', 'long', 'short', 'float', 'double', 'bool', 'boolean', 'char', 'byte', 'word', 'String', 'size_t',
    'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'struct', 'typedef', 'enum', 'sizeof', 'nullptr', 'NULL', 'auto'];

  const HEADERS = ['Arduino.h', 'WiFi.h', 'esp_now.h', 'WebServer.h', 'HTTPClient.h', 'WiFiUdp.h', 'PubSubClient.h', 'DHT.h', 'Wire.h', 'SPI.h',
    'LiquidCrystal_I2C.h', 'LiquidCrystal.h', 'Adafruit_GFX.h', 'Adafruit_SSD1306.h', 'Adafruit_ILI9341.h', 'Adafruit_NeoPixel.h', 'ESP32Servo.h',
    'Servo.h', 'Adafruit_MPU6050.h', 'Adafruit_Sensor.h', 'HX711.h', 'MFRC522.h', 'TinyGPSPlus.h', 'TinyGPS++.h', 'SoftwareSerial.h', 'RTClib.h',
    'SD.h', 'Keypad.h', 'Stepper.h', 'IRremote.h', 'IRremote.hpp', 'LoRa.h', 'EEPROM.h', 'ESP8266WiFi.h', 'ESP8266WebServer.h', 'thingProperties.h', 'ArduinoIoTCloud.h', 'Arduino_ConnectionHandler.h'];

  // $0 marks where the cursor lands
  const SNIPPETS = [
    ['for', 'for (int i = 0; i < 10; i++) {\n  $0\n}', 'วนซ้ำ'],
    ['if', 'if ($0) {\n  \n}', 'ถ้า'],
    ['ifelse', 'if ($0) {\n  \n} else {\n  \n}', 'ถ้า … นอกนั้น'],
    ['else', 'else {\n  $0\n}', ''],
    ['while', 'while ($0) {\n  \n}', 'วนขณะที่'],
    ['switch', 'switch ($0) {\n  case 1:\n    break;\n  default:\n    break;\n}', ''],
    ['setup', 'void setup() {\n  Serial.begin(115200);\n  $0\n}', 'ฟังก์ชันเริ่มต้น'],
    ['loop', 'void loop() {\n  $0\n}', 'ฟังก์ชันวนซ้ำ'],
    ['void', 'void $0() {\n  \n}', 'ฟังก์ชันใหม่'],
    ['struct', 'typedef struct {\n  int $0;\n} Message;', ''],
    ['millisTimer', 'static unsigned long last = 0;\nif (millis() - last >= 1000) {\n  last = millis();\n  $0\n}', 'ทำทุก 1 วินาที ไม่บล็อก'],
    ['wifiConnect', 'WiFi.begin("WJSIM-WiFi", "");\nwhile (WiFi.status() != WL_CONNECTED) {\n  delay(200);\n  Serial.print(".");\n}\nSerial.println(WiFi.localIP());$0', 'ต่อ WiFi'],
    ['cloudSetup', 'initProperties();\nArduinoCloud.begin(ArduinoIoTPreferredConnection);\nsetDebugMessageLevel(2);\nArduinoCloud.printDebugInfo();$0', 'เริ่ม IoT Cloud'],
    ['espnowInit', 'WiFi.mode(WIFI_STA);\nif (esp_now_init() != ESP_OK) {\n  Serial.println("ESP-NOW init failed");\n  return;\n}$0', 'เริ่ม ESP-NOW'],
  ];

  const HIDDEN = /^(__|_|await$|async$)|^[a-z]+_t$|^\$/;
  const isCtor = (f) => typeof f === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(f));

  // member names of an object or of a class's instances (methods + fields)
  // fields only for plain data types (…_t); elsewhere they are the simulator's internals
  function membersOf(target, withFields) {
    const out = new Map();
    const add = (k, v) => { if (typeof v !== 'function' && !withFields) return; if (k === 'constructor' || /^_|^q$|^p$|^id$|^cb$/.test(k) || out.has(k)) return; out.set(k, typeof v === 'function' ? (v.length ? 'fn' : 'fn0') : 'field'); };
    let o = isCtor(target) ? target.prototype : target;
    if (isCtor(target)) { try { const inst = new target(); Object.keys(inst).forEach((k) => add(k, inst[k])); } catch (e) { /* needs args */ } }
    while (o && o !== Object.prototype && o !== Function.prototype) {
      Object.getOwnPropertyNames(o).forEach((k) => { const d = Object.getOwnPropertyDescriptor(o, k); add(k, d && 'value' in d ? d.value : 0); });
      o = Object.getPrototypeOf(o);
    }
    return out;
  }

  // variables declared in the code → their type (class or struct name)
  function declaredTypes(text, env) {
    const types = {};
    const structs = {};
    text.replace(/typedef\s+struct\s*\w*\s*\{([^{}]*)\}\s*(\w+)\s*;|struct\s+(\w+)\s*\{([^{}]*)\}\s*;/g, (m, b1, n1, n2, b2) => {
      const fields = []; (b1 || b2).replace(/(\w+)\s*(?:\[[^\]]*\])?\s*(?:=[^;]*)?;/g, (x, f) => { fields.push(f); return x; });
      structs[n1 || n2] = fields; return m;
    });
    const typeNames = Object.keys(env).filter((k) => isCtor(env[k])).concat(Object.keys(structs), ['String']);
    if (!typeNames.length) return { types, structs };
    const re = new RegExp('\\b(' + typeNames.join('|') + ')\\s*[*&]?\\s+(\\w+)', 'g');
    let m; while ((m = re.exec(text))) types[m[2]] = m[1];
    return { types, structs };
  }

  function item(text, label, kind, detail, extra) {
    return Object.assign({ text, displayText: label || text, kind, detail: detail || '', render: renderItem, hint: insert }, extra || {});
  }
  function renderItem(el, self, c) {
    el.innerHTML = '';
    const k = document.createElement('span'); k.className = 'ac-kind ac-' + c.kind; k.textContent = { fn: 'f', fn0: 'f', field: '•', kw: 'k', type: 'T', const: 'c', snip: '⇥', word: 'w', inc: '#' }[c.kind] || '';
    const n = document.createElement('span'); n.className = 'ac-name'; n.textContent = c.displayText;
    el.append(k, n);
    if (c.detail) { const d = document.createElement('span'); d.className = 'ac-detail'; d.textContent = c.detail; el.append(d); }
  }
  // insert, then put the cursor in the right place
  function insert(cm, data, c) {
    let text = c.text, at = -1;
    if (c.kind === 'snip') {
      const indent = cm.getLine(data.from.line).match(/^\s*/)[0];
      text = text.replace(/\n/g, '\n' + indent);
    } else if (c.kind === 'fn' || c.kind === 'fn0') {
      const after = cm.getRange(data.to, { line: data.to.line, ch: data.to.ch + 1 });
      if (after !== '(') text += c.kind === 'fn0' ? '()' : '()';
      if (c.kind === 'fn' && after !== '(') at = text.length - 1;
    }
    if (at < 0 && text.includes('$0')) { at = text.indexOf('$0'); text = text.replace('$0', ''); }
    cm.replaceRange(text, data.from, data.to, 'complete');
    if (at >= 0) cm.setCursor(cm.posFromIndex(cm.indexFromPos(data.from) + at));
  }

  function rank(list, word) {
    const w = word.toLowerCase(), seen = new Set();
    return list.filter((c) => {
      const t = c.displayText.toLowerCase();
      if (!word ? false : !t.startsWith(w) && !(w.length >= 3 && t.includes(w))) return false;
      if (c.displayText === word && /word|kw|const|type/.test(c.kind)) return false;
      const key = c.displayText + '|' + c.kind;
      if (seen.has(key)) return false; seen.add(key); return true;
    }).sort((a, b) => {
      const sa = a.displayText.startsWith(word) ? 0 : a.displayText.toLowerCase().startsWith(w) ? 1 : 2;
      const sb = b.displayText.startsWith(word) ? 0 : b.displayText.toLowerCase().startsWith(w) ? 1 : 2;
      const pa = a.kind === 'word' ? 1 : 0, pb = b.kind === 'word' ? 1 : 0;
      return sa - sb || pa - pb || a.displayText.length - b.displayText.length || a.displayText.localeCompare(b.displayText);
    }).slice(0, 60);
  }

  function hints(cm) {
    const cur = cm.getCursor(), line = cm.getLine(cur.line), before = line.slice(0, cur.ch);
    const env = (IOTF.sim && IOTF.sim.hintEnv) ? IOTF.sim.hintEnv() : {};

    // #include <...>
    const inc = /#include\s*[<"]([\w.+]*)$/.exec(before);
    if (inc) {
      const from = { line: cur.line, ch: cur.ch - inc[1].length };
      const close = line[cur.ch] === '>' || line[cur.ch] === '"';
      const list = rank(HEADERS.map((h) => item(h + (close ? '' : before.includes('"') ? '"' : '>'), h, 'inc')), inc[1]);
      return list.length ? { list, from, to: cur } : null;
    }

    const wm = /[A-Za-z_]\w*$/.exec(before), word = wm ? wm[0] : '';
    const from = { line: cur.line, ch: cur.ch - word.length };
    const dot = /([A-Za-z_]\w*)(\[[^\]]*\])?\s*(\.|->)\s*$/.exec(before.slice(0, before.length - word.length));
    const text = cm.getValue();

    // members after "obj."
    if (dot) {
      const name = dot[1], { types, structs } = declaredTypes(text, env);
      let members = null;
      if (types[name] && structs[types[name]]) members = new Map(structs[types[name]].map((f) => [f, 'field']));
      else if (types[name] && env[types[name]]) members = membersOf(env[types[name]], /_t$/.test(types[name]));
      else if (env[name] && typeof env[name] === 'object') members = membersOf(env[name]);
      // a String, or something we cannot tell: offer String methods
      if (!members) members = new Map(['length', 'toInt', 'toFloat', 'indexOf', 'substring', 'equals', 'startsWith', 'endsWith', 'trim', 'toUpperCase', 'toLowerCase', 'c_str', 'charAt', 'replace'].map((k) => [k, k === 'length' ? 'fn0' : 'fn']));
      const items = [...members].map(([k, kind]) => item(k, k, kind, kind === 'field' ? '' : '(' + (SIG[k] ?? '') + ')'));
      const list = word ? rank(items, word) : items.sort((a, b) => a.displayText.localeCompare(b.displayText));
      return list.length ? { list, from, to: cur } : null;
    }
    if (!word) return null;

    const all = [];
    SNIPPETS.forEach(([k, body, d]) => all.push(item(body, k, 'snip', d || 'แทรกโค้ด')));
    KEYWORDS.forEach((k) => all.push(item(k, k, 'kw')));
    Object.keys(env).forEach((k) => {
      if (HIDDEN.test(k)) return;
      const v = env[k];
      if (isCtor(v)) all.push(item(k, k, 'type', 'ไลบรารี'));
      else if (typeof v === 'function') all.push(item(k, k, v.length || (SIG[k] && SIG[k] !== '') ? 'fn' : 'fn0', '(' + (SIG[k] ?? '') + ')'));
      else if (v && typeof v === 'object') all.push(item(k, k, 'const', 'อ็อบเจ็กต์'));
      else all.push(item(k, k, 'const', typeof v === 'number' ? String(v) : ''));
    });
    // cloud variables declared for this board in thingProperties.h
    if (IOTF.iotcloud && /thingProperties\.h/.test(text)) IOTF.iotcloud.vars().forEach((v) => all.push(item(v.name, v.name, 'const', 'ตัวแปรคลาวด์ ' + v.type)));
    // words already in this file (variables, own functions)
    const seenWords = new Set();
    const stripped = text.replace(/\/\/.*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"/g, ' ');
    const fnNames = new Set(); stripped.replace(/\b(\w+)\s*\([^;{]*\)\s*\{/g, (m, n) => { fnNames.add(n); return m; });
    stripped.replace(/[A-Za-z_]\w{2,}/g, (w) => { if (!seenWords.has(w) && !(w in env) && !KEYWORDS.includes(w)) { seenWords.add(w); all.push(item(w, w, fnNames.has(w) ? 'fn' : 'word', fnNames.has(w) ? '()' : '')); } return w; });
    const list = rank(all, word);
    return list.length ? { list, from, to: cur } : null;
  }

  function attach(cm) {
    if (!cm || !cm.showHint) return;
    // Tab inserts (Enter stays a normal new line so it never surprises you)
    const keys = { Up: (c, h) => h.moveFocus(-1), Down: (c, h) => h.moveFocus(1), PageUp: (c, h) => h.moveFocus(-h.menuSize() + 1, true), PageDown: (c, h) => h.moveFocus(h.menuSize() - 1, true), Tab: (c, h) => h.pick(), Esc: (c, h) => h.close() };
    const show = () => cm.showHint({ hint: hints, completeSingle: false, closeCharacters: /[\s()\[\]{};:>,=+\-*\/!&|]/, customKeys: keys, container: document.body });
    cm.addKeyMap({ 'Ctrl-Space': show, 'Cmd-Space': show });
    cm.on('inputRead', (c, ch) => {
      if (ch.origin !== '+input' || c.state.completionActive && c.state.completionActive.widget) return;
      const typed = ch.text.join('');
      const tok = c.getTokenAt(c.getCursor());
      if (tok.type && /comment|string/.test(tok.type) && !/#include/.test(c.getLine(c.getCursor().line))) return;
      if (/^[A-Za-z_]$/.test(typed) || typed === '.' || typed === '>' && /-\>$/.test(c.getLine(c.getCursor().line).slice(0, c.getCursor().ch)) || /#include\s*[<"]$/.test(c.getLine(c.getCursor().line).slice(0, c.getCursor().ch))) show();
    });
  }

  IOTF.autocomplete = { attach, hints };
})();
