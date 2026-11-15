/* Wongjorn — parts registry
 * 50 parts come from wokwi-elements (MIT, (c) 2020 Uri Shaked).
 * 7 parts (pH, TDS, load cell, RC522, NEO-6M, SX1278, 4-ch relay) are original drawings (MIT, Wongjorn contributors).
 */
window.IOTF = window.IOTF || {};
(function () {
  'use strict';
  const G = '#d4b44a';

  /* ---------- original drawings ---------- */
  const t = (x, y, s, txt, fill = '#fff', anchor = 'middle', w = 'normal') =>
    `<text x="${x}" y="${y}" font-size="${s}" fill="${fill}" text-anchor="${anchor}" font-weight="${w}">${txt}</text>`;
  const pad = (x, y, r = 4) => `<circle cx="${x}" cy="${y}" r="${r + 1.5}" fill="${G}"/><circle cx="${x}" cy="${y}" r="${r - 1.5}" fill="#1a1a1a"/>`;

  const CUSTOM = {
    'iotf-rc522': {
      w: 240, h: 160, scale: 0.95,
      pins: ['SDA', 'SCK', 'MOSI', 'MISO', 'IRQ', 'GND', 'RST', '3.3V'].map((n, i) => ({ name: n, x: 22 + i * 28, y: 146, power: n === 'GND' ? 'GND' : n === '3.3V' ? 'VCC' : null })),
      svg() {
        let b = '<rect width="240" height="160" rx="8" fill="#1c4a9c"/>';
        for (let i = 0; i < 3; i++) b += `<rect x="${70 + i * 7}" y="${18 + i * 7}" width="${160 - 14 * i}" height="${100 - 14 * i}" rx="4" fill="none" stroke="#d9c27a" stroke-width="2.5"/>`;
        b += '<rect x="16" y="34" width="36" height="36" fill="#1d1d1d"/><circle cx="23" cy="41" r="2" fill="#555"/><rect x="20" y="86" width="26" height="9" rx="2" fill="#c9ced4"/><rect x="20" y="104" width="10" height="6" fill="#8b6b3e"/><rect x="36" y="104" width="10" height="6" fill="#8b6b3e"/>';
        b += '<rect class="card" x="88" y="30" width="124" height="76" rx="6" fill="#f5f5f5" stroke="#999" opacity="0"/>';
        this.pins.forEach((p, i) => { b += pad(p.x, p.y) + t(p.x, 133, 7, p.name); });
        b += t(16, 24, 12, 'RC522', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-neo6m': {
      w: 230, h: 160, scale: 0.6,
      pins: ['VCC', 'RX', 'TX', 'GND'].map((n, i) => ({ name: n, x: 214, y: 46 + i * 22, power: n === 'GND' ? 'GND' : n === 'VCC' ? 'VCC' : null })),
      svg() {
        let b = '<rect width="230" height="160" rx="8" fill="#174a8a"/><rect x="16" y="16" width="108" height="108" rx="3" fill="#2b2b2b"/><rect x="24" y="24" width="92" height="92" fill="#d8d2bd"/><circle cx="82" cy="58" r="4" fill="#777"/>';
        b += '<rect x="140" y="22" width="34" height="34" fill="#1d1d1d"/><circle cx="147" cy="29" r="2" fill="#555"/><circle cx="152" cy="100" r="19" fill="#9aa1aa"/><circle cx="152" cy="100" r="12" fill="#dfe3e8"/><circle class="fix" cx="198" cy="28" r="4" fill="#5a1a17"/>';
        this.pins.forEach((p) => { b += pad(p.x, p.y) + t(204, p.y + 3, 8, p.name, '#fff', 'end'); });
        b += t(24, 144, 11, 'GPS NEO-6M', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-sx1278': {
      w: 190, h: 240, scale: 0.55,
      pins: ['3.3V', 'GND', 'NSS', 'MOSI', 'MISO', 'SCK', 'RST', 'DIO0'].map((n, i) => ({ name: n, x: 25.5, y: 114.5 + i * 15, power: n === 'GND' ? 'GND' : n === '3.3V' ? 'VCC' : null })),
      svg() {
        let b = '<rect x="88" y="2" width="14" height="80" rx="7" fill="#222"/><rect x="83" y="80" width="24" height="14" fill="#d4b44a"/><rect x="15" y="94" width="160" height="140" rx="6" fill="#1f7a3d"/><rect x="58" y="110" width="96" height="84" rx="2" fill="#c9ced4" stroke="#8a9099"/>';
        b += t(106, 152, 12, 'SX1278', '#333', 'middle', 'bold') + t(106, 168, 8, 'LoRa 433 MHz', '#333');
        for (let i = 0; i < 8; i++) b += `<rect x="160" y="${110 + i * 15}" width="9" height="9" fill="${G}"/>`;
        this.pins.forEach((p) => { b += `<rect x="${p.x - 4.5}" y="${p.y - 4.5}" width="9" height="9" fill="${G}"/>` + t(34, p.y + 2.5, 6.5, p.name, '#fff', 'start'); });
        b += '<circle class="tx" cx="160" cy="214" r="4" fill="#3b1111"/>';
        return b;
      }
    },
    'iotf-relay4': {
      w: 330, h: 210, scale: 0.86,
      pins: ['GND', 'IN1', 'IN2', 'IN3', 'IN4', 'VCC'].map((n, i) => ({ name: n, x: 16, y: 32 + i * 22, power: n === 'GND' ? 'GND' : n === 'VCC' ? 'VCC' : null })),
      svg() {
        let b = '<rect width="330" height="210" rx="8" fill="#1b56a6"/>';
        this.pins.forEach((p) => { b += pad(p.x, p.y) + t(26, p.y + 3, 7, p.name, '#fff', 'start'); });
        for (let i = 0; i < 4; i++) {
          const x = 56 + i * 66;
          b += `<rect x="${x}" y="16" width="56" height="70" rx="3" fill="#2f6fd6" stroke="#1d3f7a" stroke-width="2"/>` + t(x + 28, 48, 7, '10A 250VAC') + t(x + 28, 60, 7, 'SRD-05VDC');
          b += `<rect x="${x + 6}" y="98" width="18" height="9" fill="#1d1d1d"/><circle class="ch${i + 1}" cx="${x + 42}" cy="102" r="4.5" fill="#4a1414"/><rect x="${x}" y="122" width="56" height="44" rx="3" fill="#2f9a4a"/>`;
          for (let j = 0; j < 3; j++) b += `<circle cx="${x + 10 + j * 18}" cy="142" r="7" fill="#c9ced4" stroke="#8a9099"/><line x1="${x + 6 + j * 18}" y1="142" x2="${x + 14 + j * 18}" y2="142" stroke="#555" stroke-width="2"/>`;
          b += t(x + 10, 180, 7, 'NC') + t(x + 28, 180, 7, 'COM') + t(x + 46, 180, 7, 'NO') + t(x + 28, 12, 7, 'K' + (i + 1));
        }
        b += t(56, 200, 9, '4-CH RELAY MODULE', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-loadcell': {
      w: 300, h: 110, scale: 0.8,
      pins: [['E+', 28], ['E-', 48], ['A-', 68], ['A+', 88]].map(([n, y]) => ({ name: n, x: 295, y })),
      svg() {
        let b = '<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe3e8"/><stop offset="1" stop-color="#9ea6b0"/></linearGradient></defs>';
        b += '<rect x="10" y="30" width="220" height="50" rx="4" fill="url(#lg)" stroke="#8a9099"/><circle cx="36" cy="55" r="7" fill="#5f666f"/><circle cx="204" cy="55" r="7" fill="#5f666f"/><circle cx="96" cy="55" r="14" fill="#6b727b"/><circle cx="144" cy="55" r="14" fill="#6b727b"/><rect x="96" y="41" width="48" height="28" fill="#c0c6cd"/><rect x="104" y="22" width="32" height="10" rx="2" fill="#d4b44a"/>';
        const cols = { 'E+': '#d32f2f', 'E-': '#1d1d1d', 'A-': '#f5f5f5', 'A+': '#2e9e4f' };
        this.pins.forEach((p) => { b += `<path d="M230 55C262 55 262 ${p.y} 291 ${p.y}" fill="none" stroke="${p.name === 'A-' ? '#999' : cols[p.name]}" stroke-width="5"/><path d="M230 55C262 55 262 ${p.y} 291 ${p.y}" fill="none" stroke="${cols[p.name]}" stroke-width="3.4"/>` + t(282, p.y - 4, 7, p.name, '#ddd'); });
        b += '<text class="kg" x="120" y="100" font-size="11" fill="#666" text-anchor="middle"></text>';
        return b;
      }
    },
    'iotf-ph': {
      w: 340, h: 145, scale: 0.8,
      pins: [['Po', 50], ['GND', 70], ['VCC', 90]].map(([n, y]) => ({ name: n, x: 134, y, power: n === 'GND' ? 'GND' : n === 'VCC' ? 'VCC' : null, analog: n === 'Po' })),
      svg() {
        let b = '<rect y="20" width="150" height="110" rx="6" fill="#1b56a6"/><circle cx="36" cy="75" r="22" fill="#9aa1aa"/><circle cx="36" cy="75" r="15" fill="#e8ebef"/><circle cx="36" cy="75" r="5" fill="#d4b44a"/>';
        b += '<rect x="62" y="40" width="40" height="24" fill="#1d1d1d"/><rect x="62" y="84" width="40" height="18" fill="#1d1d1d"/>';
        this.pins.forEach((p) => { b += pad(p.x, p.y) + t(124, p.y + 3, 7, p.name, '#fff', 'end'); });
        b += t(82, 120, 10, 'pH', '#fff', 'middle', 'bold');
        b += '<path d="M36 97C36 150 200 152 215 82C225 25 300 35 305 12" fill="none" stroke="#222" stroke-width="4"/><rect x="290" y="10" width="30" height="66" rx="4" fill="#333"/><rect x="286" y="74" width="38" height="9" fill="#8a9099"/><rect x="296" y="83" width="18" height="40" rx="8" fill="#9fd4ea"/><circle cx="305" cy="126" r="10" fill="#7fc4e0"/>';
        return b;
      }
    },
    'iotf-tds': {
      w: 350, h: 125, scale: 0.8,
      pins: [['A', 56], ['VCC', 70], ['GND', 84]].map(([n, y]) => ({ name: n, x: 112, y, power: n === 'GND' ? 'GND' : n === 'VCC' ? 'VCC' : null, analog: n === 'A' })),
      svg() {
        let b = '<rect y="20" width="140" height="100" rx="6" fill="#1f7a3d"/><rect x="14" y="36" width="44" height="26" fill="#1d1d1d"/><rect x="14" y="76" width="30" height="16" fill="#1d1d1d"/><rect x="96" y="46" width="32" height="48" rx="3" fill="#eeeeee"/>';
        this.pins.forEach((p) => { b += pad(p.x, p.y, 3) + t(92, p.y + 3, 7, p.name, '#fff', 'end'); });
        b += t(70, 110, 10, 'TDS', '#fff', 'middle', 'bold') + '<path d="M128 70C190 70 210 78 262 78" fill="none" stroke="#222" stroke-width="4"/><rect x="262" y="48" width="42" height="60" rx="6" fill="#222"/><rect x="304" y="58" width="44" height="6" fill="#c9ced4"/><rect x="304" y="90" width="44" height="6" fill="#c9ced4"/>';
        return b;
      }
    }
  };

  class IotfPart extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      const d = CUSTOM[this.localName];
      const root = this.attachShadow({ mode: 'open' });
      const W = d.w * d.scale, H = d.h * d.scale;
      root.innerHTML = `<style>:host{display:inline-block;width:${W}px;height:${H}px}svg{display:block}</style>` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${d.w} ${d.h}" font-family="Arial,sans-serif">${d.svg()}</svg>`;
      this.svg = root.querySelector('svg');
    }
    get pinInfo() {
      const d = CUSTOM[this.localName];
      return d.pins.map((p) => ({
        name: p.name, x: p.x * d.scale, y: p.y * d.scale,
        signals: p.power ? [{ type: 'power', signal: p.power }] : p.analog ? [{ type: 'analog' }] : []
      }));
    }
    q(sel) { return this.svg && this.svg.querySelector(sel); }
  }
  Object.keys(CUSTOM).forEach((tag) => { if (!customElements.get(tag)) customElements.define(tag, class extends IotfPart {}); });

  /* ---------- boards ---------- */
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const BOARDS = {
    esp32: {
      name: 'ESP32 DevKit V1', tag: 'esp32-devkit-v1', vref: 3.3, adcMax: 4095, wifi: true, led: { pin: 2, prop: 'led1' },
      gpio(n) { const m = /^D(\d+)$/.exec(n); if (m) return +m[1]; return { TX0: 1, RX0: 3, TX2: 17, RX2: 16, VP: 36, VN: 39 }[n]; },
      consts: { A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A11: 0, A12: 2, A13: 15, A14: 13, A15: 12, A16: 14, A17: 27, A18: 25, A19: 26, LED_BUILTIN: 2, SDA: 21, SCL: 22, SS: 5, MOSI: 23, MISO: 19, SCK: 18, TX: 1, RX: 3 },
      digital: [2, 4, 5, 18, 19, 23, 25, 26, 27, 13, 12, 14, 15, 16, 17, 32, 33],
      analog: [34, 35, 32, 33, 36, 39],
      inputOnly: [34, 35, 36, 39],
      pwmPreferred: [], i2c: { sda: 21, scl: 22 }, spi: { ss: 5, sck: 18, miso: 19, mosi: 23 }, uart: { rx: 16, tx: 17 },
      blockPins: [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39].map(String),
      blockAnalog: ['34', '35', '32', '33', '36', '39'],
      level: 'basic'
    },
    uno: {
      name: 'Arduino Uno', tag: 'arduino-uno', vref: 5, adcMax: 1023, wifi: false, led: { pin: 13, prop: 'led13' },
      gpio(n) { if (/^\d+$/.test(n)) return +n; const m = /^A(\d)$/.exec(n); if (m) return 14 + +m[1]; },
      consts: { A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, LED_BUILTIN: 13, SDA: 18, SCL: 19, SS: 10, MOSI: 11, MISO: 12, SCK: 13 },
      digital: [2, 4, 7, 8, 12, 13, 3, 5, 6, 9, 10, 11], analog: [14, 15, 16, 17], pwmPreferred: [3, 5, 6, 9, 10, 11], inputOnly: [],
      i2c: { sda: 18, scl: 19 }, spi: { ss: 10, sck: 13, miso: 12, mosi: 11 }, uart: { rx: 0, tx: 1 },
      blockPins: range(2, 13).map(String), blockAnalog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
      level: 'basic'
    },
    nano: {
      name: 'Arduino Nano', tag: 'arduino-nano', vref: 5, adcMax: 1023, wifi: false, led: { pin: 13, prop: 'led13' },
      gpio(n) { if (/^\d+$/.test(n)) return +n; const m = /^A(\d)$/.exec(n); if (m) return 14 + +m[1]; },
      consts: { A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21, LED_BUILTIN: 13, SDA: 18, SCL: 19, SS: 10, MOSI: 11, MISO: 12, SCK: 13 },
      digital: [2, 4, 7, 8, 12, 13, 3, 5, 6, 9, 10, 11], analog: [14, 15, 16, 17, 20, 21], pwmPreferred: [3, 5, 6, 9, 10, 11], inputOnly: [20, 21],
      i2c: { sda: 18, scl: 19 }, spi: { ss: 10, sck: 13, miso: 12, mosi: 11 }, uart: { rx: 0, tx: 1 },
      blockPins: range(2, 13).map(String), blockAnalog: ['A0', 'A1', 'A2', 'A3', 'A6', 'A7'],
      level: 'advanced'
    },
    mega: {
      name: 'Arduino Mega', tag: 'arduino-mega', vref: 5, adcMax: 1023, wifi: false, led: { pin: 13, prop: 'led13' },
      gpio(n) { if (/^\d+$/.test(n)) return +n; const m = /^A(\d+)$/.exec(n); if (m) return 54 + +m[1]; return { SDA: 20, SCL: 21 }[n]; },
      consts: Object.assign({ LED_BUILTIN: 13, SDA: 20, SCL: 21, SS: 53, MOSI: 51, MISO: 50, SCK: 52 }, Object.fromEntries(range(0, 15).map((i) => ['A' + i, 54 + i]))),
      digital: range(22, 49).concat([2, 4, 7, 8, 12, 13]), analog: range(54, 69), pwmPreferred: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46], inputOnly: [],
      i2c: { sda: 20, scl: 21 }, spi: { ss: 53, sck: 52, miso: 50, mosi: 51 }, uart: { rx: 19, tx: 18 },
      blockPins: range(2, 53).map(String), blockAnalog: range(0, 15).map((i) => 'A' + i),
      level: 'advanced'
    },
    rp2040: {
      name: 'Nano RP2040 Connect', tag: 'nano-rp2040-connect', vref: 3.3, adcMax: 1023, wifi: true, led: { pin: 13, prop: 'ledBuiltIn' },
      gpio(n) { const m = /^D(\d+)$/.exec(n); if (m) return +m[1]; const a = /^A(\d)$/.exec(n); if (a) return 14 + +a[1]; return { TX: 1, RX: 0 }[n]; },
      consts: { A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, A6: 20, A7: 21, LED_BUILTIN: 13, SDA: 18, SCL: 19, SS: 10, MOSI: 11, MISO: 12, SCK: 13 },
      digital: range(2, 12), analog: [14, 15, 16, 17, 20, 21], pwmPreferred: [], inputOnly: [20, 21],
      i2c: { sda: 18, scl: 19 }, spi: { ss: 10, sck: 13, miso: 12, mosi: 11 }, uart: { rx: 0, tx: 1 },
      blockPins: range(2, 13).map(String), blockAnalog: ['A0', 'A1', 'A2', 'A3', 'A6', 'A7'],
      level: 'advanced'
    },
    franzininho: {
      name: 'Franzininho (ATtiny85)', tag: 'franzininho', vref: 5, adcMax: 1023, wifi: false, led: { pin: 1, prop: 'led1' },
      gpio(n) { const m = /^PB(\d)$/.exec(n); if (m) return +m[1]; },
      consts: { A0: 5, A1: 2, A2: 4, A3: 3, LED_BUILTIN: 1, SDA: 0, SCL: 2 },
      digital: [0, 1, 2, 3, 4], analog: [2, 4, 3], pwmPreferred: [0, 1, 4], inputOnly: [],
      i2c: { sda: 0, scl: 2 }, spi: { ss: 3, sck: 2, miso: 1, mosi: 0 }, uart: { rx: 3, tx: 4 },
      blockPins: ['0', '1', '2', '3', '4'], blockAnalog: ['A1', 'A2', 'A3'],
      level: 'advanced'
    }
  };

  /* ---------- parts ----------
   * kind: behaviour id used by runtime/editor
   * level: 'basic' parts are shown in Basic mode (all parts are shown in Advanced)
   * sig: signal pins and what they need when auto-wired in Basic mode
   * tie: pins that Basic mode treats as already tied to GND/VCC
   * sim: user-adjustable simulated values (shown in the properties panel)
   */
  const P = {};
  const def = (key, o) => { P[key] = Object.assign({ key, tag: o.tag || 'wokwi-' + key, level: 'advanced', sig: [], tie: {}, sim: {}, attrs: {} }, o); };

  // boards
  Object.entries(BOARDS).forEach(([id, b]) => def(b.tag, { name: b.name, cat: 'บอร์ด', kind: 'board', board: id, level: b.level }));

  // lights & sound
  def('led', { name: 'LED', cat: 'ไฟและเสียง', kind: 'led', level: 'basic', sig: [['A', 'pwm']], tie: { C: 'GND' }, attrs: { color: 'red' }, opts: { color: ['red', 'green', 'blue', 'yellow', 'orange', 'white', 'purple'] } });
  def('rgb-led', { name: 'RGB LED', cat: 'ไฟและเสียง', kind: 'rgb', level: 'basic', sig: [['R', 'pwm'], ['G', 'pwm'], ['B', 'pwm']], tie: { COM: 'GND' } });
  def('led-bar-graph', { name: 'LED Bar Graph', cat: 'ไฟและเสียง', kind: 'bargraph', sig: [] });
  def('led-ring', { name: 'NeoPixel Ring (16)', cat: 'ไฟและเสียง', kind: 'pixels', level: 'basic', sig: [['DIN', 'digital']], attrs: { pixels: 16 } });
  def('neopixel', { name: 'NeoPixel (1 ดวง)', cat: 'ไฟและเสียง', kind: 'pixels', level: 'basic', sig: [['DIN', 'digital']] });
  def('neopixel-matrix', { name: 'NeoPixel Matrix 8×8', cat: 'ไฟและเสียง', kind: 'pixels', sig: [['DIN', 'digital']], attrs: { rows: 8, cols: 8 } });
  def('buzzer', { name: 'Buzzer', cat: 'ไฟและเสียง', kind: 'buzzer', level: 'basic', sig: [['2', 'pwm']], tie: { 1: 'GND' } });

  // displays
  def('lcd1602', { name: 'LCD 16×2 (I2C)', cat: 'จอแสดงผล', kind: 'lcd', level: 'basic', sig: [['SDA', 'sda'], ['SCL', 'scl']], attrs: { pins: 'i2c' } });
  def('lcd2004', { name: 'LCD 20×4 (I2C)', cat: 'จอแสดงผล', kind: 'lcd', level: 'basic', sig: [['SDA', 'sda'], ['SCL', 'scl']], attrs: { pins: 'i2c' } });
  def('ssd1306', { name: 'OLED SSD1306 128×64', cat: 'จอแสดงผล', kind: 'oled', level: 'basic', sig: [['DATA', 'sda'], ['CLK', 'scl']], optional: ['DC', 'RST', 'CS'] });
  def('ili9341', { name: 'TFT ILI9341 240×320', cat: 'จอแสดงผล', kind: 'tft', optional: ['RST', 'MISO', 'LED'] });
  def('7segment', { name: '7-Segment', cat: 'จอแสดงผล', kind: 'seg7' });

  // sensors
  def('dht22', { name: 'DHT22 อุณหภูมิ/ความชื้น', cat: 'เซ็นเซอร์', kind: 'dht', level: 'basic', sig: [['SDA', 'digital']], sim: { temp: [25, -40, 80, 0.1, '°C'], hum: [60, 0, 100, 0.5, '%'] } });
  def('hc-sr04', { name: 'HC-SR04 วัดระยะ', cat: 'เซ็นเซอร์', kind: 'ultrasonic', level: 'basic', sig: [['TRIG', 'digital'], ['ECHO', 'digital']], sim: { distance: [100, 2, 400, 1, 'cm'] } });
  def('pir-motion-sensor', { name: 'PIR ตรวจจับคน', cat: 'เซ็นเซอร์', kind: 'pir', level: 'basic', sig: [['OUT', 'digital']], sim: { motion: [0, 0, 1, 1, ''] } });
  def('photoresistor-sensor', { name: 'เซ็นเซอร์แสง (LDR)', cat: 'เซ็นเซอร์', kind: 'analogmod', level: 'basic', sig: [['AO', 'analog']], sim: { level: [50, 0, 100, 1, '%'] }, analogPin: 'AO', digitalPin: 'DO', invert: true });
  def('gas-sensor', { name: 'เซ็นเซอร์แก๊ส MQ-2', cat: 'เซ็นเซอร์', kind: 'analogmod', level: 'basic', sig: [['AOUT', 'analog']], sim: { level: [10, 0, 100, 1, '%'] }, analogPin: 'AOUT', digitalPin: 'DOUT' });
  def('flame-sensor', { name: 'เซ็นเซอร์เปลวไฟ', cat: 'เซ็นเซอร์', kind: 'analogmod', level: 'basic', sig: [['AOUT', 'analog']], sim: { level: [0, 0, 100, 1, '%'] }, analogPin: 'AOUT', digitalPin: 'DOUT', invert: true });
  def('small-sound-sensor', { name: 'เซ็นเซอร์เสียง (เล็ก)', cat: 'เซ็นเซอร์', kind: 'analogmod', level: 'basic', sig: [['AOUT', 'analog']], sim: { level: [20, 0, 100, 1, '%'] }, analogPin: 'AOUT', digitalPin: 'DOUT' });
  def('big-sound-sensor', { name: 'เซ็นเซอร์เสียง (ใหญ่)', cat: 'เซ็นเซอร์', kind: 'analogmod', sig: [['AOUT', 'analog']], sim: { level: [20, 0, 100, 1, '%'] }, analogPin: 'AOUT', digitalPin: 'DOUT' });
  def('ntc-temperature-sensor', { name: 'NTC วัดอุณหภูมิ', cat: 'เซ็นเซอร์', kind: 'ntc', level: 'basic', sig: [['OUT', 'analog']], sim: { temp: [25, -24, 80, 0.5, '°C'] } });
  def('heart-beat-sensor', { name: 'เซ็นเซอร์ชีพจร', cat: 'เซ็นเซอร์', kind: 'heartbeat', level: 'basic', sig: [['OUT', 'analog']], sim: { bpm: [72, 40, 180, 1, 'bpm'] } });
  def('tilt-switch', { name: 'Tilt Switch', cat: 'เซ็นเซอร์', kind: 'tilt', level: 'basic', sig: [['OUT', 'digital']], sim: { tilted: [0, 0, 1, 1, ''] } });
  def('mpu6050', { name: 'MPU6050 Gyro/Accel', cat: 'เซ็นเซอร์', kind: 'mpu', sig: [['SDA', 'sda'], ['SCL', 'scl']], sim: { ax: [0, -20, 20, 0.1, 'm/s²'], ay: [0, -20, 20, 0.1, 'm/s²'], az: [9.8, -20, 20, 0.1, 'm/s²'], gx: [0, -250, 250, 1, '°/s'], gy: [0, -250, 250, 1, '°/s'], gz: [0, -250, 250, 1, '°/s'], temp: [26, -40, 85, 0.5, '°C'] } });
  def('iotf-ph', { tag: 'iotf-ph', name: 'pH Sensor', cat: 'เซ็นเซอร์', kind: 'ph', level: 'basic', sig: [['Po', 'analog']], sim: { ph: [7, 0, 14, 0.1, 'pH'] } });
  def('iotf-tds', { tag: 'iotf-tds', name: 'TDS Sensor', cat: 'เซ็นเซอร์', kind: 'tds', level: 'basic', sig: [['A', 'analog']], sim: { ppm: [300, 0, 1000, 5, 'ppm'] } });
  def('iotf-loadcell', { tag: 'iotf-loadcell', name: 'Load Cell', cat: 'เซ็นเซอร์', kind: 'loadcell', sim: { weight: [0, 0, 5000, 10, 'g'] } });

  // input
  def('pushbutton', { name: 'ปุ่มกด', cat: 'อินพุต', kind: 'button', level: 'basic', sig: [['1.l', 'digital']], tie: { '2.l': 'GND', '2.r': 'GND' }, attrs: { color: 'red' }, opts: { color: ['red', 'green', 'blue', 'yellow', 'white', 'black'] } });
  def('pushbutton-6mm', { name: 'ปุ่มกด 6mm', cat: 'อินพุต', kind: 'button', level: 'basic', sig: [['1.l', 'digital']], tie: { '2.l': 'GND', '2.r': 'GND' }, attrs: { color: 'green' } });
  def('slide-switch', { name: 'สวิตช์เลื่อน', cat: 'อินพุต', kind: 'slideswitch', level: 'basic', sig: [['2', 'digital']], tie: { 1: 'GND', 3: 'VCC' } });
  def('potentiometer', { name: 'Potentiometer', cat: 'อินพุต', kind: 'pot', level: 'basic', sig: [['SIG', 'analog']] });
  def('slide-potentiometer', { name: 'Slide Potentiometer', cat: 'อินพุต', kind: 'pot', level: 'basic', sig: [['SIG', 'analog']], attrs: { travelLength: 30 } });
  def('analog-joystick', { name: 'Joystick', cat: 'อินพุต', kind: 'joystick', level: 'basic', sig: [['VERT', 'analog'], ['HORZ', 'analog'], ['SEL', 'digital']] });
  def('membrane-keypad', { name: 'Keypad 4×4', cat: 'อินพุต', kind: 'keypad', optional: ['C4'] });
  def('ky-040', { name: 'Rotary Encoder KY-040', cat: 'อินพุต', kind: 'encoder', optional: ['SW'] });
  def('dip-switch-8', { name: 'DIP Switch 8 ช่อง', cat: 'อินพุต', kind: 'dip' });
  def('ir-remote', { name: 'รีโมท IR', cat: 'อินพุต', kind: 'irremote' });
  def('rotary-dialer', { name: 'Rotary Dialer', cat: 'อินพุต', kind: 'dialer' });

  // motors
  def('servo', { name: 'Servo Motor', cat: 'มอเตอร์', kind: 'servo', level: 'basic', sig: [['PWM', 'pwm']] });
  def('stepper-motor', { name: 'Stepper Motor', cat: 'มอเตอร์', kind: 'stepper', attrs: { size: 17 } });
  def('biaxial-stepper', { name: 'Biaxial Stepper', cat: 'มอเตอร์', kind: 'biaxial' });

  // modules & basics
  def('iotf-relay4', { tag: 'iotf-relay4', name: 'Relay Module 4 ช่อง', cat: 'โมดูล', kind: 'relay4', level: 'basic', sig: [['IN1', 'digital'], ['IN2', 'digital'], ['IN3', 'digital'], ['IN4', 'digital']] });
  def('ks2e-m-dc5', { name: 'Relay KS2E', cat: 'โมดูล', kind: 'relay' });
  def('resistor', { name: 'ตัวต้านทาน', cat: 'โมดูล', kind: 'resistor', attrs: { value: '220' }, opts: { value: ['220', '330', '1000', '4700', '10000'] } });
  def('hx711', { name: 'HX711 Load Cell Amp', cat: 'โมดูล', kind: 'hx711', sim: { weight: [0, 0, 5000, 10, 'g'] } });
  def('iotf-rc522', { tag: 'iotf-rc522', name: 'RFID RC522', cat: 'โมดูล', kind: 'rfid' });
  def('iotf-neo6m', { tag: 'iotf-neo6m', name: 'GPS NEO-6M', cat: 'โมดูล', kind: 'gps', optional: ['RX'], sim: { lat: [13.7563, -90, 90, 0.0001, '°'], lng: [100.5018, -180, 180, 0.0001, '°'], sats: [8, 0, 16, 1, ''] } });
  def('iotf-sx1278', { tag: 'iotf-sx1278', name: 'LoRa SX1278', cat: 'โมดูล', kind: 'lora', optional: ['RST', 'DIO0'] });
  def('ds1307', { name: 'RTC DS1307', cat: 'โมดูล', kind: 'rtc' });
  def('microsd-card', { name: 'microSD Card', cat: 'โมดูล', kind: 'sd' });
  def('ir-receiver', { name: 'IR Receiver', cat: 'โมดูล', kind: 'irrecv' });

  const CATS = ['บอร์ด', 'เซ็นเซอร์', 'จอแสดงผล', 'ไฟและเสียง', 'อินพุต', 'มอเตอร์', 'โมดูล'];

  // the parts list shown in Basic is a subset; check it never contains something that needs advanced wiring
  IOTF.CUSTOM = CUSTOM;
  IOTF.BOARDS = BOARDS;
  IOTF.PARTS = P;
  IOTF.CATS = CATS;
  IOTF.boardByTag = (tag) => Object.keys(BOARDS).find((k) => 'wokwi-' + BOARDS[k].tag === tag || BOARDS[k].tag === tag);
})();
