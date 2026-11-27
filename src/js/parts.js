/* WJSIM — parts registry
 * 50 parts come from wokwi-elements (MIT, (c) 2020 Uri Shaked).
 * 37 parts (pH, TDS, load cell, RC522, NEO-6M, SX1278, 4-ch relay, 20 sensors, 7 motors/drivers, 3 breadboards) are original drawings (MIT, WJSIM contributors).
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

  /* ---------- sensors drawn for WJSIM ---------- */
  // pins down the right edge of a module, labelled on the board
  const pwr = (n) => (/^(VCC|VIN|5V|3\.3V|\+)$/.test(n) ? 'VCC' : /^(GND|-)$/.test(n) ? 'GND' : null);
  const rightPins = (names, x, y0, dy, analog = []) => names.map((n, i) => ({ name: n, x, y: y0 + i * dy, power: pwr(n), analog: analog.includes(n) }));
  const hdr = (pins, lx, size = 8) => pins.map((p) => `<rect x="${p.x - 2}" y="${p.y - 3}" width="22" height="6" fill="#c9ced4"/>` + pad(p.x, p.y, 3.5) + t(lx, p.y + 3, size, p.name, '#fff', 'end')).join('');
  const chip = (x, y, w = 30, h = 18) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#1d1d1d"/>` + Array.from({ length: Math.floor(w / 7) }, (_, i) => `<rect x="${x + 3 + i * 7}" y="${y - 3}" width="3" height="3" fill="#bbb"/><rect x="${x + 3 + i * 7}" y="${y + h}" width="3" height="3" fill="#bbb"/>`).join('');
  const trim = (x, y) => `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="2" fill="#2f6fd6"/><circle cx="${x}" cy="${y}" r="7" fill="#e8ebef"/><path d="M${x - 4} ${y}h8M${x} ${y - 4}v8" stroke="#888" stroke-width="2"/>`;
  const smd = (x, y, c = '#1d1d1d') => `<rect x="${x}" y="${y}" width="10" height="5" fill="${c}"/><rect x="${x}" y="${y}" width="2" height="5" fill="#ccc"/><rect x="${x + 8}" y="${y}" width="2" height="5" fill="#ccc"/>`;
  const leds = (x, y) => `<circle class="pled" cx="${x}" cy="${y}" r="3.5" fill="#4a1414"/><circle class="dled" cx="${x}" cy="${y + 12}" r="3.5" fill="#14361f"/>`;
  const wireEnd = (x, y, col) => `<path d="M${x - 40} ${y}h34" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`;

  Object.assign(CUSTOM, {
    'iotf-soil': {
      w: 330, h: 110, scale: 0.68,
      pins: rightPins(['VCC', 'GND', 'DO', 'AO'], 318, 25, 20, ['AO']),
      svg() {
        let b = '<path d="M8 30h112v16H24v18h96v16H8z" fill="#c9a227" stroke="#8a6d12" stroke-width="1.5"/><rect x="104" y="22" width="40" height="66" rx="4" fill="#1b56a6"/><circle cx="124" cy="36" r="4" fill="#d4b44a"/><circle cx="124" cy="74" r="4" fill="#d4b44a"/>';
        b += '<path d="M144 40C170 40 170 40 190 40M144 70C170 70 170 70 190 70" stroke="#8a9099" stroke-width="3" fill="none"/>';
        b += '<rect x="190" y="8" width="140" height="94" rx="6" fill="#1b56a6"/>' + trim(218, 36) + chip(214, 64, 30, 16) + leds(262, 30) + smd(276, 30) + smd(276, 46);
        b += hdr(this.pins, 306) + t(200, 96, 9, 'SOIL', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-rain': {
      w: 330, h: 130, scale: 0.68,
      pins: rightPins(['VCC', 'GND', 'DO', 'AO'], 318, 35, 20, ['AO']),
      svg() {
        let b = '<rect x="4" y="4" width="160" height="122" rx="4" fill="#d8dde3"/><rect x="10" y="10" width="148" height="110" fill="#1d1d1d"/>';
        for (let i = 0; i < 9; i++) b += `<rect x="${18}" y="${16 + i * 11.5}" width="${i % 2 ? 132 : 120}" height="5" x2="0" fill="#c9a227" transform="translate(${i % 2 ? 0 : 12} 0)"/>`;
        b += '<rect class="wet" x="10" y="10" width="148" height="110" fill="#6fb6ff" opacity="0"/>';
        b += '<path d="M164 50C180 50 180 50 190 50M164 80C180 80 180 80 190 80" stroke="#8a9099" stroke-width="3" fill="none"/>';
        b += '<rect x="190" y="18" width="140" height="94" rx="6" fill="#1b56a6"/>' + trim(218, 46) + chip(214, 74, 30, 16) + leds(262, 40) + smd(276, 40) + smd(276, 56);
        b += hdr(this.pins, 306) + t(200, 106, 9, 'RAIN', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-waterlevel': {
      w: 300, h: 76, scale: 0.7,
      pins: rightPins(['S', '+', '-'], 288, 20, 18, ['S']),
      svg() {
        let b = '<rect x="2" y="6" width="292" height="64" rx="6" fill="#c62828"/>';
        for (let i = 0; i < 10; i++) b += `<rect x="${12 + i * 20}" y="${i % 2 ? 14 : 22}" width="7" height="40" fill="#d4b44a"/>`;
        b += '<rect class="water" x="2" y="70" width="210" height="0" fill="#4aa3ff" opacity=".55"/>';
        b += '<circle cx="230" cy="20" r="3.5" fill="#ff4d4d"/>' + smd(222, 44) + hdr(this.pins, 274, 9) + t(236, 64, 7, 'WATER', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-turbidity': {
      w: 330, h: 120, scale: 0.68,
      pins: rightPins(['VCC', 'GND', 'OUT'], 318, 40, 22, ['OUT']),
      svg() {
        let b = '<rect x="6" y="18" width="64" height="88" rx="10" fill="#3a3a3a" stroke="#777" stroke-width="1.5"/><rect x="14" y="10" width="48" height="16" rx="3" fill="#4a4a4a" stroke="#777"/><rect x="18" y="40" width="40" height="40" rx="5" fill="#9fd4ea"/>';
        b += '<rect class="murk" x="18" y="40" width="40" height="40" rx="5" fill="#8a6d3b" opacity="0"/><circle cx="26" cy="60" r="4" fill="#ff6b6b"/><circle cx="50" cy="60" r="4" fill="#ddd"/>';
        b += '<path d="M70 62C130 62 140 62 190 62" stroke="#222" stroke-width="4" fill="none"/><rect x="190" y="16" width="140" height="92" rx="6" fill="#1b56a6"/>' + trim(220, 44) + chip(212, 70, 30, 16) + '<circle class="pled" cx="262" cy="30" r="3.5" fill="#4a1414"/>';
        b += hdr(this.pins, 306) + t(200, 102, 8, 'TURBIDITY', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-float': {
      w: 200, h: 150, scale: 0.6,
      pins: rightPins(['S', '-'], 188, 40, 24),
      svg() {
        let b = '<rect x="10" y="8" width="90" height="16" rx="3" fill="#e8e8e8" stroke="#aaa"/><rect x="48" y="24" width="14" height="110" rx="3" fill="#f2f2f2" stroke="#bbb"/>';
        b += '<g class="floatpos" transform="translate(0 0)"><rect x="32" y="96" width="46" height="34" rx="10" fill="#f7f7f7" stroke="#999"/><path d="M36 113h38" stroke="#ccc"/></g>';
        b += '<path d="M100 16C140 16 140 40 176 40M100 20C136 20 136 64 176 64" stroke="#222" stroke-width="3" fill="none"/>';
        b += this.pins.map((p) => pad(p.x, p.y, 3.5) + t(p.x - 8, p.y + 3, 8, p.name, '#bbb', 'end')).join('') + t(55, 146, 8, 'FLOAT SWITCH', '#888', 'middle', 'bold');
        return b;
      }
    },
    'iotf-mq135': {
      w: 230, h: 130, scale: 0.68,
      pins: rightPins(['VCC', 'GND', 'DO', 'AO'], 218, 32, 22, ['AO']),
      svg() {
        let b = '<rect x="2" y="2" width="226" height="126" rx="8" fill="#1b56a6"/><circle cx="66" cy="65" r="50" fill="#c9ced4" stroke="#8a9099" stroke-width="3"/><circle cx="66" cy="65" r="40" fill="#9aa1aa"/>';
        for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (i * i + j * j <= 10) b += `<circle cx="${66 + i * 10}" cy="${65 + j * 10}" r="2.3" fill="#5f666f"/>`;
        b += trim(140, 40) + chip(126, 72, 30, 16) + leds(170, 32) + hdr(this.pins, 206) + t(66, 124, 9, 'MQ-135', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-ir-obstacle': {
      w: 230, h: 86, scale: 0.68,
      pins: rightPins(['OUT', 'GND', 'VCC'], 218, 22, 21),
      svg() {
        let b = '<rect x="38" y="4" width="190" height="78" rx="6" fill="#1b56a6"/>';
        b += '<rect x="2" y="16" width="44" height="18" rx="9" fill="#e8ebef"/><rect x="2" y="52" width="44" height="18" rx="9" fill="#1d1d1d"/><path d="M44 25h12M44 61h12" stroke="#bbb" stroke-width="3"/>';
        b += trim(84, 43) + chip(110, 34, 30, 16) + leds(160, 30) + smd(172, 30) + hdr(this.pins, 206) + t(64, 78, 8, 'IR SENSOR', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-line': {
      w: 220, h: 86, scale: 0.68,
      pins: rightPins(['VCC', 'GND', 'DO', 'AO'], 208, 16, 18, ['AO']),
      svg() {
        let b = '<rect x="2" y="4" width="216" height="78" rx="6" fill="#1b56a6"/><rect x="12" y="20" width="44" height="46" rx="4" fill="#1d1d1d"/><circle cx="34" cy="32" r="8" fill="#3a6ad9"/><circle cx="34" cy="54" r="8" fill="#0f0f0f" stroke="#444"/>';
        b += trim(84, 43) + chip(106, 34, 30, 16) + leds(152, 28) + hdr(this.pins, 196) + t(64, 78, 8, 'TCRT5000', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-touch': {
      w: 140, h: 110, scale: 0.68,
      pins: rightPins(['SIG', 'VCC', 'GND'], 128, 34, 22),
      svg() {
        let b = '<rect x="2" y="2" width="136" height="106" rx="8" fill="#c62828"/><circle cx="52" cy="55" r="38" fill="#e8ebef" stroke="#d4b44a" stroke-width="4"/><circle class="pad" cx="52" cy="55" r="30" fill="#f6d36b" opacity=".0"/>';
        b += t(52, 60, 10, 'TOUCH', '#888', 'middle', 'bold') + '<circle class="dled" cx="100" cy="14" r="3.5" fill="#4a1414"/>' + hdr(this.pins, 116, 7);
        return b;
      }
    },
    'iotf-reed': {
      w: 190, h: 80, scale: 0.7,
      pins: rightPins(['S', '+', '-'], 178, 20, 20),
      svg() {
        let b = '<rect x="2" y="4" width="186" height="72" rx="6" fill="#2b3a4a" stroke="#4d6278" stroke-width="2"/><rect x="14" y="30" width="110" height="20" rx="10" fill="#cfe8f5" opacity=".75" stroke="#9fc4d8"/><path d="M4 40h22M26 40l40 -2M120 40h20M72 38l40 2" stroke="#9aa1aa" stroke-width="3"/>';
        b += '<rect class="mag" x="40" y="54" width="60" height="14" rx="2" fill="#d32f2f" opacity="0"/>' + smd(132, 20) + '<circle class="dled" cx="140" cy="58" r="3.5" fill="#14361f"/>' + hdr(this.pins, 166) + t(18, 20, 8, 'REED KY-021', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-sw420': {
      w: 220, h: 86, scale: 0.68,
      pins: rightPins(['VCC', 'GND', 'DO'], 208, 22, 21),
      svg() {
        let b = '<rect x="2" y="4" width="216" height="78" rx="6" fill="#1b56a6"/><rect x="12" y="26" width="52" height="34" rx="16" fill="#c9ced4" stroke="#8a9099" stroke-width="2"/><rect class="shake" x="20" y="34" width="36" height="18" rx="9" fill="#9aa1aa"/>';
        b += trim(90, 43) + chip(114, 34, 30, 16) + leds(160, 30) + hdr(this.pins, 196) + t(14, 78, 8, 'SW-420', '#fff', 'start', 'bold');
        return b;
      }
    },
    'iotf-dht11': {
      w: 150, h: 150, scale: 0.62,
      pins: rightPins(['VCC', 'DATA', 'GND'], 138, 102, 18),
      svg() {
        let b = '<rect x="2" y="84" width="146" height="64" rx="6" fill="#1b56a6"/><rect x="18" y="4" width="84" height="104" rx="6" fill="#2d7fd6"/>';
        for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) b += `<rect x="${28 + c * 18}" y="${14 + r * 14}" width="10" height="8" rx="1.5" fill="#174a8a"/>`;
        b += smd(30, 124) + '<circle class="pled" cx="80" cy="128" r="3.5" fill="#4a1414"/>' + hdr(this.pins, 126, 7) + t(60, 146, 8, 'DHT11', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-ds18b20': {
      w: 320, h: 80, scale: 0.7,
      pins: [['VCC', 20, '#d32f2f'], ['DATA', 40, '#f5c518'], ['GND', 60, '#222']].map(([n, y]) => ({ name: n, x: 312, y, power: pwr(n), col: '' })),
      svg() {
        let b = '<defs><linearGradient id="ss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1f4"/><stop offset=".5" stop-color="#a9b0b8"/><stop offset="1" stop-color="#e2e6ea"/></linearGradient></defs>';
        b += '<rect x="4" y="28" width="96" height="24" rx="12" fill="url(#ss)"/><rect x="96" y="31" width="20" height="18" fill="#2b2b2b"/><path d="M116 40C170 40 200 40 230 40" stroke="#6b7078" stroke-width="11" fill="none"/><path d="M116 40C170 40 200 40 230 40" stroke="#3d4046" stroke-width="8" fill="none"/>';
        [['#d32f2f', 20], ['#f5c518', 40], ['#222', 60]].forEach(([c, y]) => { b += `<path d="M230 40C260 40 270 ${y} 304 ${y}" stroke="${c === '#222' ? '#555' : c}" stroke-width="5" fill="none"/><path d="M230 40C260 40 270 ${y} 304 ${y}" stroke="${c}" stroke-width="3.5" fill="none"/>`; });
        this.pins.forEach((p) => { b += `<rect x="${p.x - 8}" y="${p.y - 3}" width="12" height="6" fill="#d4b44a"/>` + t(p.x - 14, p.y - 5, 7, p.name, '#ddd', 'end'); });
        b += t(52, 70, 9, 'DS18B20', '#aaa', 'middle', 'bold');
        return b;
      }
    },
    'iotf-bme280': {
      w: 150, h: 120, scale: 0.62,
      pins: rightPins(['VCC', 'GND', 'SCL', 'SDA'], 138, 24, 22),
      svg() {
        let b = '<rect x="2" y="2" width="146" height="116" rx="8" fill="#6a2c91"/><circle cx="18" cy="18" r="7" fill="#1a1a1a" stroke="#d4b44a" stroke-width="2"/><circle cx="18" cy="102" r="7" fill="#1a1a1a" stroke="#d4b44a" stroke-width="2"/>';
        b += '<rect x="44" y="44" width="28" height="28" rx="2" fill="#c9ced4" stroke="#8a9099"/><circle cx="50" cy="50" r="2" fill="#555"/>' + smd(36, 86) + smd(56, 86) + hdr(this.pins, 116, 7) + t(58, 112, 9, 'BME280', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-bmp280': {
      w: 150, h: 120, scale: 0.62,
      pins: rightPins(['VCC', 'GND', 'SCL', 'SDA'], 138, 24, 22),
      svg() {
        let b = '<rect x="2" y="2" width="146" height="116" rx="8" fill="#1b56a6"/><circle cx="18" cy="18" r="7" fill="#1a1a1a" stroke="#d4b44a" stroke-width="2"/><circle cx="18" cy="102" r="7" fill="#1a1a1a" stroke="#d4b44a" stroke-width="2"/>';
        b += '<rect x="46" y="46" width="24" height="24" rx="2" fill="#c9ced4" stroke="#8a9099"/><circle cx="64" cy="64" r="2.5" fill="#555"/>' + smd(36, 86) + smd(56, 86) + hdr(this.pins, 116, 7) + t(58, 112, 9, 'BMP280', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-bh1750': {
      w: 160, h: 130, scale: 0.62,
      pins: rightPins(['VCC', 'GND', 'SCL', 'SDA', 'ADDR'], 148, 20, 22),
      svg() {
        let b = '<rect x="2" y="2" width="156" height="126" rx="8" fill="#1b56a6"/><circle cx="20" cy="20" r="7" fill="#1a1a1a" stroke="#d4b44a" stroke-width="2"/><circle cx="20" cy="110" r="7" fill="#1a1a1a" stroke="#d4b44a" stroke-width="2"/>';
        b += '<rect x="44" y="48" width="34" height="22" rx="2" fill="#1d1d1d"/><rect x="54" y="54" width="14" height="10" fill="#6b5a2a"/>' + smd(44, 86) + smd(62, 86) + hdr(this.pins, 126, 7) + t(62, 120, 9, 'BH1750', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-pms5003': {
      w: 270, h: 200, scale: 0.6,
      pins: rightPins(['VCC', 'GND', 'TX', 'RX', 'SET', 'RESET'], 258, 40, 22),
      svg() {
        let b = '<rect x="4" y="4" width="200" height="192" rx="8" fill="#c9ced4" stroke="#8a9099" stroke-width="2"/><rect x="14" y="14" width="180" height="172" rx="4" fill="#dfe3e8"/>';
        b += '<circle cx="104" cy="96" r="52" fill="#9aa1aa"/><circle cx="104" cy="96" r="42" fill="#3a3d42"/>';
        for (let i = 0; i < 7; i++) b += `<path d="M104 96L${104 + 40 * Math.cos(i * 0.9)} ${96 + 40 * Math.sin(i * 0.9)}" stroke="#8a9099" stroke-width="7" stroke-linecap="round"/>`;
        b += '<circle cx="104" cy="96" r="10" fill="#c9ced4"/><rect x="204" y="28" width="22" height="144" rx="2" fill="#2b2b2b"/>' + t(104, 176, 12, 'PMS5003', '#555', 'middle', 'bold');
        this.pins.forEach((p) => { b += `<path d="M226 ${p.y}h28" stroke="#888" stroke-width="3"/>` + pad(p.x, p.y, 3.5) + t(p.x - 8, p.y - 5, 7, p.name, '#ddd', 'end'); });
        return b;
      }
    },
    'iotf-acs712': {
      w: 210, h: 100, scale: 0.68,
      pins: rightPins(['VCC', 'OUT', 'GND'], 198, 28, 22, ['OUT']),
      svg() {
        let b = '<rect x="2" y="4" width="206" height="92" rx="6" fill="#c62828"/><rect x="8" y="16" width="44" height="68" rx="3" fill="#2f6fd6"/><circle cx="30" cy="34" r="9" fill="#c9ced4"/><circle cx="30" cy="66" r="9" fill="#c9ced4"/><path d="M24 34h12M24 66h12" stroke="#666" stroke-width="2"/>';
        b += chip(76, 40, 28, 18) + '<circle class="pled" cx="140" cy="20" r="3.5" fill="#4a1414"/>' + smd(130, 70) + hdr(this.pins, 176, 7) + t(90, 90, 9, 'ACS712 5A', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-pzem004t': {
      w: 290, h: 180, scale: 0.6,
      pins: rightPins(['5V', 'RX', 'TX', 'GND'], 278, 56, 24),
      svg() {
        let b = '<rect x="2" y="2" width="286" height="176" rx="8" fill="#e9ecef" stroke="#adb5bd" stroke-width="2"/><rect x="12" y="12" width="64" height="156" rx="4" fill="#1f7a3d"/>';
        for (let i = 0; i < 4; i++) b += `<rect x="20" y="${22 + i * 37}" width="48" height="28" rx="2" fill="#2f9a4a"/><circle cx="44" cy="${36 + i * 37}" r="8" fill="#c9ced4"/>`;
        b += '<rect x="96" y="30" width="110" height="70" rx="3" fill="#1d1d1d"/><circle cx="150" cy="134" r="22" fill="#2b2b2b"/><circle cx="150" cy="134" r="12" fill="#c9a227"/>' + t(151, 70, 11, 'PZEM-004T', '#fff', 'middle', 'bold') + t(151, 86, 8, 'AC 80-260V 100A', '#aaa');
        b += '<rect x="224" y="40" width="62" height="106" rx="3" fill="#1d1d1d"/>' + this.pins.map((p) => pad(p.x, p.y, 3.5) + t(p.x - 10, p.y + 3, 8, p.name, '#fff', 'end')).join('');
        return b;
      }
    },
    'iotf-yfs201': {
      w: 290, h: 150, scale: 0.6,
      pins: [['VCC', 36], ['OUT', 56], ['GND', 76]].map(([n, y]) => ({ name: n, x: 282, y, power: pwr(n) })),
      svg() {
        let b = '<rect x="4" y="56" width="40" height="44" rx="4" fill="#44474e" stroke="#6b7078"/><rect x="164" y="56" width="40" height="44" rx="4" fill="#44474e" stroke="#6b7078"/>';
        for (let i = 0; i < 5; i++) b += `<path d="M${8 + i * 7} 56v44M${168 + i * 7} 56v44" stroke="#444" stroke-width="2"/>`;
        b += '<rect x="40" y="46" width="128" height="64" rx="8" fill="#33363c" stroke="#5b6068" stroke-width="2"/><circle cx="104" cy="78" r="40" fill="#2a2c31" stroke="#6b7078" stroke-width="3"/><g class="rotor" transform="rotate(0 104 78)">';
        for (let i = 0; i < 6; i++) b += `<path d="M104 78L${104 + 30 * Math.cos(i * Math.PI / 3)} ${78 + 30 * Math.sin(i * Math.PI / 3)}" stroke="#d4b44a" stroke-width="6" stroke-linecap="round"/>`;
        b += '</g><circle cx="104" cy="78" r="7" fill="#999"/><path d="M60 118h88" stroke="#666" stroke-width="2"/><path d="M140 112l10 6-10 6" fill="#666"/>' + t(104, 140, 9, 'YF-S201', '#aaa', 'middle', 'bold');
        b += '<path d="M150 46C150 20 200 30 230 40" stroke="#6b7078" stroke-width="11" fill="none"/><path d="M150 46C150 20 200 30 230 40" stroke="#3d4046" stroke-width="8" fill="none"/>';
        [['#d32f2f', 36], ['#f5c518', 56], ['#222', 76]].forEach(([c, y]) => { b += `<path d="M228 40C250 40 255 ${y} 276 ${y}" stroke="${c === '#222' ? '#555' : c}" stroke-width="5" fill="none"/><path d="M228 40C250 40 255 ${y} 276 ${y}" stroke="${c}" stroke-width="3.5" fill="none"/>`; });
        this.pins.forEach((p) => { b += `<rect x="${p.x - 8}" y="${p.y - 3}" width="12" height="6" fill="#d4b44a"/>` + t(p.x - 12, p.y - 5, 7, p.name, '#ddd', 'end'); });
        return b;
      }
    },
    'iotf-salinity': {
      w: 330, h: 120, scale: 0.68,
      pins: rightPins(['VCC', 'GND', 'AO'], 318, 38, 22, ['AO']),
      svg() {
        let b = '<rect x="4" y="34" width="96" height="70" rx="8" fill="#cfe8f5" opacity=".35" stroke="#9fc4d8"/><rect class="salt" x="5" y="56" width="94" height="47" rx="6" fill="#4aa3ff" opacity=".45"/>';
        b += '<rect x="38" y="4" width="28" height="66" rx="5" fill="#2b2b2b" stroke="#555"/><rect x="42" y="70" width="6" height="26" fill="#c9ced4"/><rect x="56" y="70" width="6" height="26" fill="#c9ced4"/>';
        b += '<path d="M52 4C52 -6 130 -6 150 30C160 48 176 56 196 56" stroke="#3d4046" stroke-width="6" fill="none"/><path d="M52 4C52 -6 130 -6 150 30C160 48 176 56 196 56" stroke="#6b7078" stroke-width="2" fill="none" opacity=".6"/>';
        b += '<rect x="190" y="8" width="140" height="104" rx="6" fill="#1b56a6"/><circle cx="212" cy="56" r="14" fill="#c9ced4" stroke="#8a9099" stroke-width="2"/><circle cx="212" cy="56" r="6" fill="#555"/>';
        b += chip(240, 44, 30, 16) + '<circle class="pled" cx="284" cy="24" r="3.5" fill="#4a1414"/>' + hdr(this.pins, 306) + t(254, 102, 9, 'SALINITY', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-max30102': {
      w: 150, h: 130, scale: 0.62,
      pins: rightPins(['VIN', 'SCL', 'SDA', 'INT', 'GND'], 138, 20, 22),
      svg() {
        let b = '<rect x="2" y="2" width="146" height="126" rx="8" fill="#6a2c91"/><circle cx="18" cy="18" r="7" fill="#1a1a1a" stroke="#d4b44a" stroke-width="2"/><circle cx="18" cy="112" r="7" fill="#1a1a1a" stroke="#d4b44a" stroke-width="2"/>';
        b += '<rect x="42" y="46" width="34" height="22" rx="3" fill="#1d1d1d"/><rect x="47" y="51" width="10" height="12" fill="#3a0d0d"/><rect class="beat" x="61" y="51" width="10" height="12" fill="#3a0d0d"/>' + smd(40, 84) + smd(60, 84) + hdr(this.pins, 116, 7) + t(58, 122, 8, 'MAX30102', '#fff', 'middle', 'bold');
        return b;
      }
    }
  });

  /* ---------- motors and drivers drawn for WJSIM ---------- */
  const sig = (names, x, y0, dy, power = {}) => names.map((n, i) => ({ name: n, x, y: y0 + i * dy, power: power[n] || null }));
  const term = (x, y) => `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="2" fill="#2f6fd6"/><circle cx="${x}" cy="${y}" r="5" fill="#c9ced4"/><path d="M${x - 3} ${y}h6" stroke="#666" stroke-width="1.5"/>`;
  const leadPins = (pins, cols) => pins.map((p, i) => `<path d="M${p.x - 34} ${p.y}h30" stroke="${cols[i]}" stroke-width="4" stroke-linecap="round"/>` + `<rect x="${p.x - 8}" y="${p.y - 3}" width="12" height="6" fill="#d4b44a"/>` + t(p.x - 14, p.y - 6, 7, p.name, '#ddd', 'end')).join('');
  Object.assign(CUSTOM, {
    'iotf-dcmotor': {
      w: 250, h: 150, scale: 0.62,
      pins: sig(['M+', 'M-'], 242, 62, 26),
      svg() {
        let b = '<circle cx="62" cy="75" r="58" fill="#2b2b2b" stroke="#555" stroke-width="3"/><circle cx="62" cy="75" r="46" fill="#3a3a3a"/>';
        b += '<g class="rotor" transform="rotate(0 62 75)">';
        for (let i = 0; i < 6; i++) b += `<path d="M62 75L${62 + 40 * Math.cos(i * Math.PI / 3)} ${75 + 40 * Math.sin(i * Math.PI / 3)}" stroke="#f0c419" stroke-width="7" stroke-linecap="round"/>`;
        b += '<circle cx="102" cy="75" r="5" fill="#e87d0d"/></g><circle cx="62" cy="75" r="11" fill="#f0c419" stroke="#b38f0f" stroke-width="2"/>';
        b += '<rect x="112" y="40" width="90" height="70" rx="10" fill="#f0c419" stroke="#b38f0f" stroke-width="2"/><rect x="196" y="54" width="20" height="42" rx="4" fill="#c9ced4"/>';
        b += t(157, 80, 10, 'TT MOTOR', '#6b5208', 'middle', 'bold') + '<text class="rpm" x="157" y="128" font-size="11" fill="#9aa0a6" text-anchor="middle">0 RPM</text>';
        b += this.pins.map((p) => `<path d="M216 ${p.y}h${p.x - 220}" stroke="${p.name === 'M+' ? '#d32f2f' : '#222'}" stroke-width="4"/>` + pad(p.x, p.y, 3.5) + t(p.x - 4, p.y - 7, 8, p.name, '#ddd', 'end')).join('');
        return b;
      }
    },
    'iotf-pump': {
      w: 230, h: 140, scale: 0.62,
      pins: sig(['M+', 'M-'], 222, 54, 26),
      svg() {
        let b = '<rect x="20" y="30" width="110" height="80" rx="14" fill="#2b2b2b" stroke="#555" stroke-width="2"/><rect x="34" y="46" width="22" height="48" rx="3" fill="#444"/><rect x="60" y="46" width="22" height="48" rx="3" fill="#444"/><rect x="86" y="46" width="22" height="48" rx="3" fill="#444"/>';
        b += '<rect x="58" y="4" width="18" height="30" rx="3" fill="#3a3a3a"/><path class="water" d="M67 2c-6 8-6 14 0 14s6-6 0-14z" fill="#4aa3ff" opacity="0"/>';
        b += t(75, 128, 10, 'WATER PUMP 5V', '#9aa0a6', 'middle', 'bold');
        b += this.pins.map((p) => `<path d="M130 ${p.y}h${p.x - 134}" stroke="${p.name === 'M+' ? '#d32f2f' : '#222'}" stroke-width="4"/>` + pad(p.x, p.y, 3.5) + t(p.x - 4, p.y - 7, 8, p.name, '#ddd', 'end')).join('');
        return b;
      }
    },
    'iotf-vibmotor': {
      w: 170, h: 100, scale: 0.62,
      pins: sig(['M+', 'M-'], 162, 38, 26),
      svg() {
        let b = '<g class="shake"><circle cx="50" cy="50" r="40" fill="#c9ced4" stroke="#8a9099" stroke-width="3"/><circle cx="50" cy="50" r="30" fill="#dfe3e8"/>' + t(50, 54, 9, 'VIB', '#777', 'middle', 'bold') + '</g>';
        b += this.pins.map((p) => `<path d="M88 ${p.y}h${p.x - 92}" stroke="${p.name === 'M+' ? '#d32f2f' : '#3d3d3d'}" stroke-width="3"/>` + pad(p.x, p.y, 3.5) + t(p.x - 4, p.y - 7, 8, p.name, '#ddd', 'end')).join('');
        return b;
      }
    },
    'iotf-l298n': {
      w: 270, h: 250, scale: 0.6,
      pins: [
        { name: 'OUT1', x: 12, y: 70 }, { name: 'OUT2', x: 12, y: 100 }, { name: 'OUT3', x: 258, y: 70 }, { name: 'OUT4', x: 258, y: 100 },
        { name: '12V', x: 60, y: 214, power: 'VCC' }, { name: 'GND', x: 88, y: 214, power: 'GND' }, { name: '5V', x: 116, y: 214 },
        { name: 'ENA', x: 150, y: 238 }, { name: 'IN1', x: 170, y: 238 }, { name: 'IN2', x: 190, y: 238 }, { name: 'IN3', x: 210, y: 238 }, { name: 'IN4', x: 230, y: 238 }, { name: 'ENB', x: 250, y: 238 }
      ],
      svg() {
        let b = '<rect x="2" y="2" width="266" height="246" rx="8" fill="#c62828"/>';
        b += '<rect x="80" y="10" width="110" height="90" rx="3" fill="#1d1d1d"/>';
        for (let i = 0; i < 12; i++) b += `<rect x="${86 + i * 8.6}" y="14" width="5" height="82" fill="#2a2a2a"/>`;
        b += '<rect x="96" y="104" width="78" height="34" rx="2" fill="#1d1d1d"/>' + t(135, 126, 11, 'L298N', '#ddd', 'middle', 'bold');
        b += term(22, 70) + term(22, 100) + term(248, 70) + term(248, 100) + term(60, 214) + term(88, 214) + term(116, 214);
        b += t(22, 50, 8, 'MOTOR A', '#fff', 'middle', 'bold') + t(248, 50, 8, 'MOTOR B', '#fff', 'middle', 'bold');
        b += '<circle class="pled" cx="40" cy="170" r="4" fill="#4a1414"/><circle cx="214" cy="160" r="15" fill="#2a64c9"/><circle cx="214" cy="160" r="9" fill="#e9ecef"/><rect x="60" y="150" width="34" height="34" rx="16" fill="#1d1d1d"/><rect x="104" y="154" width="26" height="26" rx="12" fill="#1d1d1d"/>';
        b += '<rect x="140" y="226" width="120" height="18" fill="#1d1d1d"/>';
        this.pins.forEach((p) => { if (p.y > 200) { b += (p.x > 140 ? pad(p.x, p.y, 3.5) : '') + t(p.x, p.x > 140 ? 222 : 198, 7.5, p.name, '#fff', 'middle', 'bold'); } else b += pad(p.x, p.y, 3) + t(p.x < 100 ? 40 : 230, p.y + 3, 7.5, p.name, '#fff', p.x < 100 ? 'start' : 'end'); });
        b += '<rect x="141" y="228" width="18" height="14" fill="#1a1a1a" stroke="#e8c84a" stroke-width="1.5"/><rect x="241" y="228" width="18" height="14" fill="#1a1a1a" stroke="#e8c84a" stroke-width="1.5"/>';
        return b;
      }
    },
    'iotf-l9110s': {
      w: 230, h: 150, scale: 0.62,
      pins: [
        { name: 'A1', x: 12, y: 40 }, { name: 'A2', x: 12, y: 64 }, { name: 'B1', x: 12, y: 92 }, { name: 'B2', x: 12, y: 116 },
        ...sig(['B-IA', 'B-IB', 'GND', 'VCC', 'A-IA', 'A-IB'], 218, 22, 21, { GND: 'GND', VCC: 'VCC' })
      ],
      svg() {
        let b = '<rect x="2" y="4" width="226" height="142" rx="6" fill="#1f7a3d"/>';
        b += term(26, 40) + term(26, 64) + term(26, 92) + term(26, 116) + t(48, 54, 8, 'MOTOR A', '#fff', 'start', 'bold') + t(48, 106, 8, 'MOTOR B', '#fff', 'start', 'bold');
        b += chip(100, 34, 28, 22) + chip(100, 86, 28, 22) + '<circle class="pled" cx="150" cy="18" r="3.5" fill="#4a1414"/>';
        b += this.pins.filter((p) => p.x > 100).map((p) => pad(p.x, p.y, 3.5) + t(p.x - 9, p.y + 3, 7.5, p.name, '#fff', 'end')).join('') + this.pins.filter((p) => p.x < 100).map((p) => pad(p.x, p.y, 3)).join('');
        b += t(118, 138, 9, 'L9110S', '#fff', 'middle', 'bold');
        return b;
      }
    },
    'iotf-28byj48': {
      w: 230, h: 260, scale: 0.6,
      pins: sig(['IN1', 'IN2', 'IN3', 'IN4'], 12, 160, 18).concat([{ name: 'GND', x: 12, y: 232, power: 'GND' }, { name: '5V', x: 12, y: 250, power: 'VCC' }]),
      svg() {
        let b = '<circle cx="140" cy="62" r="56" fill="#c9ced4" stroke="#8a9099" stroke-width="3"/><circle cx="140" cy="62" r="44" fill="#b3bac2"/><rect x="80" y="84" width="40" height="34" rx="4" fill="#2f6fd6"/>';
        b += '<g class="rotor" transform="rotate(0 140 50)"><circle cx="140" cy="50" r="12" fill="#dfe3e8" stroke="#8a9099" stroke-width="2"/><rect x="137" y="38" width="6" height="24" rx="1" fill="#6b7078"/><circle cx="140" cy="28" r="4" fill="#e87d0d"/></g>';
        b += '<path d="M100 118C100 140 120 150 160 150" stroke="#e8c84a" stroke-width="3" fill="none"/><path d="M104 118C104 144 122 154 160 154" stroke="#d32f2f" stroke-width="3" fill="none"/>';
        b += '<rect x="40" y="148" width="180" height="110" rx="6" fill="#1f7a3d"/>' + chip(80, 172, 40, 30);
        for (let i = 0; i < 4; i++) b += `<circle class="ph${i}" cx="${150 + i * 16}" cy="184" r="5" fill="#4a1414"/>` + t(150 + i * 16, 202, 7, String.fromCharCode(65 + i), '#fff');
        b += t(130, 244, 9, 'ULN2003 · 28BYJ-48', '#fff', 'middle', 'bold');
        b += this.pins.map((p) => `<path d="M${p.x} ${p.y}h${38 - p.x}" stroke="#c9ced4" stroke-width="3"/>` + pad(p.x, p.y, 3.5) + t(30, p.y - 4, 7, p.name, '#fff', 'start')).join('');
        return b;
      }
    },
    'iotf-a4988': {
      w: 170, h: 200, scale: 0.6,
      pins: sig(['EN', 'MS1', 'MS2', 'MS3', 'RST', 'SLP', 'STEP', 'DIR'], 12, 22, 22).concat(sig(['VMOT', 'GND', '2B', '2A', '1A', '1B', 'VDD', 'GND.2'], 158, 22, 22, { VMOT: 'VCC', GND: 'GND', VDD: 'VCC', 'GND.2': 'GND' })),
      svg() {
        let b = '<rect x="20" y="6" width="130" height="188" rx="4" fill="#1f7a3d"/><rect x="58" y="64" width="54" height="54" rx="2" fill="#1d1d1d"/><rect x="66" y="72" width="38" height="38" fill="#2a2a2a"/>';
        b += '<circle cx="85" cy="150" r="12" fill="#c9ced4" stroke="#8a9099"/><path d="M79 150h12" stroke="#666" stroke-width="2"/>' + t(85, 46, 11, 'A4988', '#fff', 'middle', 'bold');
        b += this.pins.map((p) => pad(p.x, p.y, 3.5) + t(p.x < 50 ? p.x + 12 : p.x - 12, p.y + 3, 7.5, p.name.replace('.2', ''), '#fff', p.x < 50 ? 'start' : 'end')).join('');
        return b;
      }
    }
  });

  /* ---------- breadboards (holes on a 0.1 inch = 9.6 px pitch, the same as the parts' pins) ---------- */
  const PITCH = 9.6;
  // geometry shared by the drawing and by the editor (which holes are joined, which hole is under a pin)
  function breadboard(cols, railGroups) {
    const X0 = 16, rails = railGroups > 0;
    const top = rails ? 46 : 18;                                   // row a
    const rowsY = {}; 'abcde'.split('').forEach((r, i) => { rowsY[r] = top + i * PITCH; });
    'fghij'.split('').forEach((r, i) => { rowsY[r] = top + 7 * PITCH + i * PITCH; });   // the channel is 3 pitches wide
    const railY = rails ? { TP: 12, TN: 12 + PITCH, BP: rowsY.j + 2.4 * PITCH + PITCH, BN: rowsY.j + 2.4 * PITCH } : {};
    const W = X0 * 2 + (cols - 1) * PITCH, H = rails ? railY.BP + 12 : rowsY.j + 18;
    const railX = (k) => { const g = Math.floor(k / 5), h = k % 5; const span = (railGroups * 6 - 2) * PITCH; return X0 + ((cols - 1) * PITCH - span) / 2 + (g * 6 + h) * PITCH; };
    const pins = [];
    for (let c = 1; c <= cols; c++) Object.keys(rowsY).forEach((r) => pins.push({ name: r + c, x: X0 + (c - 1) * PITCH, y: rowsY[r] }));
    if (rails) ['TP', 'TN', 'BN', 'BP'].forEach((k) => { for (let i = 0; i < railGroups * 5; i++) pins.push({ name: k + (i + 1), x: railX(i), y: railY[k] }); });
    const g = {
      cols, W, H, pins, rowsY, railY, railX, railGroups, X0,
      // the connected strip a hole belongs to: one column of a–e, one of f–j, or a whole rail
      strip(name) { const m = /^([a-j])(\d+)$/.exec(name); if (m) return ('abcde'.includes(m[1]) ? 'U' : 'D') + m[2]; const r = /^(TP|TN|BP|BN)\d+$/.exec(name); return r ? r[1] : null; },
      // the hole at a point in the board's own coordinates (within tol px), or null
      holeAt(x, y, tol = 3.6) {
        for (const [r, ry] of Object.entries(rowsY)) if (Math.abs(y - ry) <= tol) { const c = Math.round((x - X0) / PITCH) + 1; if (c >= 1 && c <= cols && Math.abs(X0 + (c - 1) * PITCH - x) <= tol) return r + c; }
        for (const [k, ry] of Object.entries(railY)) if (Math.abs(y - ry) <= tol) { for (let i = 0; i < railGroups * 5; i++) if (Math.abs(railX(i) - x) <= tol) return k + (i + 1); }
        return null;
      }
    };
    return g;
  }
  const BB = { 'iotf-breadboard': breadboard(30, 5), 'iotf-breadboard-full': breadboard(63, 10), 'iotf-breadboard-mini': breadboard(17, 0) };
  const bbSvg = (g) => {
    let b = `<rect x="0" y="0" width="${g.W}" height="${g.H}" rx="6" fill="#f2f1ec" stroke="#cfcdc4"/>`;
    const ch = (g.rowsY.e + g.rowsY.f) / 2;
    b += `<rect x="4" y="${ch - 5}" width="${g.W - 8}" height="10" rx="2" fill="#dddbd2"/>`;
    if (g.railGroups) {
      const line = (y, c) => `<path d="M8 ${y}H${g.W - 8}" stroke="${c}" stroke-width="1.6"/>`;
      b += `<rect x="4" y="3" width="${g.W - 8}" height="${g.railY.TN - 3 + 9}" rx="3" fill="#ebe9e1"/><rect x="4" y="${g.railY.BN - 9}" width="${g.W - 8}" height="${g.railY.BP - g.railY.BN + 18}" rx="3" fill="#ebe9e1"/>`;
      b += line(g.railY.TP - 7, '#d93838') + line(g.railY.TN + 7, '#2f6fd6') + line(g.railY.BN - 7, '#2f6fd6') + line(g.railY.BP + 7, '#d93838');
      [['TP', '+', '#d93838'], ['TN', '−', '#2f6fd6'], ['BN', '−', '#2f6fd6'], ['BP', '+', '#d93838']].forEach(([k, s2, c]) => { b += t(8, g.railY[k] + 3, 8, s2, c, 'middle', 'bold') + t(g.W - 8, g.railY[k] + 3, 8, s2, c, 'middle', 'bold'); });
    }
    b += g.pins.map((q) => `<rect class="h" x="${(q.x - 1.8).toFixed(1)}" y="${(q.y - 1.8).toFixed(1)}" width="3.6" height="3.6" rx=".6" fill="#3d3b36"/>`).join('');
    Object.entries(g.rowsY).forEach(([r, y]) => { b += t(6.5, y + 2.6, 6.5, r, '#9a978c', 'middle') + t(g.W - 6.5, y + 2.6, 6.5, r, '#9a978c', 'middle'); });
    for (let c = 1; c <= g.cols; c++) if (c === 1 || c % 5 === 0) { const x = g.X0 + (c - 1) * PITCH; b += t(x, g.rowsY.a - 6, 6, String(c), '#9a978c') + t(x, g.rowsY.j + 9.5, 6, String(c), '#9a978c'); }
    return b;
  };
  Object.entries(BB).forEach(([tag, g]) => { CUSTOM[tag] = { w: g.W, h: g.H, scale: 1, pins: g.pins, svg() { return bbSvg(g); } }; });

  /* ---------- Arduino UNO R4 (drawn for WJSIM; header positions match the UNO so circuits carry over) ---------- */
  const R4_TOP = [['A5.2', 87, 'SCL'], ['A4.2', 97, 'SDA'], ['AREF', 106], ['GND.1', 115.5, 'GND'], ['13', 125], ['12', 134.5], ['11', 144, '~11'], ['10', 153.5, '~10'], ['9', 163, '~9'], ['8', 173],
    ['7', 189], ['6', 198.5, '~6'], ['5', 208, '~5'], ['4', 217.5], ['3', 227, '~3'], ['2', 236.5], ['1', 246, 'TX→1'], ['0', 255.5, 'RX←0']];
  const R4_BOT = [['IOREF', 131], ['RESET', 140.5], ['3.3V', 150], ['5V', 160], ['GND.2', 169.5, 'GND'], ['GND.3', 179, 'GND'], ['VIN', 188.5], ['A0', 208], ['A1', 217.5], ['A2', 227], ['A3', 236.5], ['A4', 246], ['A5', 255.5]];
  const r4Pins = () => R4_TOP.map(([n, x]) => ({ name: n, x, y: 9 })).concat(R4_BOT.map(([n, x]) => ({ name: n, x, y: 191.5 })))
    .map((q) => Object.assign(q, { power: /^GND/.test(q.name) ? 'GND' : /^(5V|3\.3V|VIN)$/.test(q.name) ? 'VCC' : null, analog: /^A\d$/.test(q.name) }));
  function r4Svg(wifi) {
    const col = wifi ? '#0d7c88' : '#1a8a9c';
    let b = `<path d="M6 0H262l6 6V200a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6z" fill="${col}"/>`;
    [[18, 14], [262, 30], [262, 176], [66, 194]].forEach(([x, y]) => { b += `<circle cx="${x}" cy="${y}" r="5.5" fill="#e9e4d4"/><circle cx="${x}" cy="${y}" r="3.4" fill="#2a2a2a"/>`; });
    // USB-C, barrel jack, reset button
    b += '<rect x="-7" y="30" width="30" height="24" rx="5" fill="#c9ced4" stroke="#8a9099"/><rect x="-3" y="37" width="20" height="10" rx="4" fill="#3a3f45"/>';
    b += '<rect x="-10" y="132" width="52" height="40" rx="3" fill="#1f1f1f"/><circle cx="8" cy="152" r="9" fill="#3a3a3a"/><circle cx="8" cy="152" r="3" fill="#bbb"/>';
    b += '<rect x="44" y="6" width="16" height="16" rx="2" fill="#c9ced4"/><circle cx="52" cy="14" r="5" fill="#d32f2f"/>';
    // headers and pins
    const strip = (x0, x1, y) => `<rect x="${x0 - 5.5}" y="${y - 5.5}" width="${x1 - x0 + 11}" height="11" rx="1" fill="#1b1b1b"/>`;
    b += strip(87, 173, 9) + strip(189, 255.5, 9) + strip(131, 188.5, 191.5) + strip(208, 255.5, 191.5);
    this.pins.forEach((q) => { b += `<rect x="${q.x - 3}" y="${q.y - 3}" width="6" height="6" fill="#0c0c0c"/><circle cx="${q.x}" cy="${q.y}" r="1.4" fill="#5c5a52"/>`; });
    R4_TOP.forEach(([n, x, l]) => { b += `<text transform="translate(${x + 1.8} 18) rotate(90)" font-size="5.2" fill="#fff">${l || n}</text>`; });
    R4_BOT.forEach(([n, x, l]) => { b += `<text transform="translate(${x + 1.8} 183) rotate(-90)" font-size="5.2" fill="#fff">${l || n}</text>`; });
    b += t(171, 47, 7, 'DIGITAL (PWM ~)', '#fff', 'middle', 'bold') + t(160, 160, 6.5, 'POWER', '#fff', 'middle', 'bold') + t(232, 160, 6.5, 'ANALOG IN', '#fff', 'middle', 'bold');
    // on-board LEDs: L (pin 13), TX, RX, ON
    b += '<rect class="l13" x="118" y="52" width="7" height="4" rx="1" fill="#5a4a1a"/>' + t(130, 56, 5.5, 'L', '#fff', 'start');
    b += '<rect x="96" y="52" width="7" height="4" rx="1" fill="#5a4a1a"/>' + t(99.5, 63, 5, 'TX', '#fff') + '<rect x="106" y="52" width="7" height="4" rx="1" fill="#5a4a1a"/>' + t(109.5, 63, 5, 'RX', '#fff');
    b += '<rect class="lon" x="244" y="60" width="7" height="4" rx="1" fill="#1b4d2a"/>' + t(247.5, 72, 5.5, 'ON', '#fff');
    // RA4M1 microcontroller
    b += '<rect x="102" y="102" width="40" height="40" rx="2" fill="#1d1d1d"/>';
    for (let i = 0; i < 8; i++) b += `<rect x="${105 + i * 4.6}" y="98.5" width="2" height="3.5" fill="#bbb"/><rect x="${105 + i * 4.6}" y="142" width="2" height="3.5" fill="#bbb"/><rect x="98.5" y="${105 + i * 4.6}" width="3.5" height="2" fill="#bbb"/><rect x="142" y="${105 + i * 4.6}" width="3.5" height="2" fill="#bbb"/>`;
    b += t(122, 120, 5.5, 'RENESAS', '#aaa') + t(122, 128, 5, 'RA4M1', '#aaa');
    if (wifi) {
      // ESP32-S3 radio module and the 12×8 LED matrix
      b += '<rect x="34" y="64" width="52" height="34" rx="2" fill="#c9ced4" stroke="#8a9099"/>' + t(60, 83, 6.5, 'ESP32-S3', '#444', 'middle', 'bold') + '<path d="M38 68h10v6h-6v6h10" stroke="#8a9099" fill="none"/>';
      b += '<rect x="160" y="92" width="92" height="64" rx="3" fill="#0a5560"/>';
      for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) b += `<rect class="mx" x="${165 + c * 7.2}" y="${96 + r * 7.2}" width="4.6" height="4.6" rx=".8" fill="#2c3b3d"/>`;
    } else b += '<rect x="170" y="100" width="22" height="22" rx="2" fill="#1d1d1d"/><rect x="204" y="104" width="30" height="14" rx="1" fill="#e8e8e8"/>';
    b += t(16, 112, 15, 'UNO', '#fff', 'start', 'bold') + t(16, 126, 9, wifi ? 'R4 WiFi' : 'R4 Minima', '#fff', 'start', 'bold');
    return b;
  }
  CUSTOM['iotf-uno-r4-wifi'] = { w: 274, h: 206, scale: 1, pins: r4Pins(), svg() { return r4Svg.call(this, true); } };
  CUSTOM['iotf-uno-r4-minima'] = { w: 274, h: 206, scale: 1, pins: r4Pins(), svg() { return r4Svg.call(this, false); } };

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
    unor4wifi: {
      name: 'Arduino UNO R4 WiFi', tag: 'iotf-uno-r4-wifi', vref: 5, adcMax: 1023, wifi: true, wifiLib: 'WiFiS3.h', matrix: true, led: { pin: 13, prop: 'led13' },
      gpio(n) { if (/^\d+$/.test(n)) return +n; const m = /^A(\d)$/.exec(n); if (m) return 14 + +m[1]; },
      consts: { A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, DAC: 14, LED_BUILTIN: 13, SDA: 18, SCL: 19, SS: 10, MOSI: 11, MISO: 12, SCK: 13 },
      digital: [2, 4, 7, 8, 12, 13, 3, 5, 6, 9, 10, 11], analog: [14, 15, 16, 17], pwmPreferred: [3, 5, 6, 9, 10, 11], inputOnly: [],
      i2c: { sda: 18, scl: 19 }, spi: { ss: 10, sck: 13, miso: 12, mosi: 11 }, uart: { rx: 0, tx: 1 },
      blockPins: range(2, 13).map(String), blockAnalog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
      level: 'basic'
    },
    unor4minima: {
      name: 'Arduino UNO R4 Minima', tag: 'iotf-uno-r4-minima', vref: 5, adcMax: 1023, wifi: false, led: { pin: 13, prop: 'led13' },
      gpio(n) { if (/^\d+$/.test(n)) return +n; const m = /^A(\d)$/.exec(n); if (m) return 14 + +m[1]; },
      consts: { A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, DAC: 14, LED_BUILTIN: 13, SDA: 18, SCL: 19, SS: 10, MOSI: 11, MISO: 12, SCK: 13 },
      digital: [2, 4, 7, 8, 12, 13, 3, 5, 6, 9, 10, 11], analog: [14, 15, 16, 17], pwmPreferred: [3, 5, 6, 9, 10, 11], inputOnly: [],
      i2c: { sda: 18, scl: 19 }, spi: { ss: 10, sck: 13, miso: 12, mosi: 11 }, uart: { rx: 0, tx: 1 },
      blockPins: range(2, 13).map(String), blockAnalog: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
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
   * sig: the main signal pins and what kind of board pin they need
   * tie: pins that Basic mode treats as already tied to GND/VCC
   * sim: user-adjustable simulated values (shown in the properties panel)
   */
  const P = {};
  const def = (key, o) => { P[key] = Object.assign({ key, tag: o.tag || 'wokwi-' + key, level: 'advanced', sig: [], tie: {}, sim: {}, attrs: {} }, o); };

  // boards
  Object.entries(BOARDS).forEach(([id, b]) => def(b.tag, { name: b.name, cat: 'บอร์ด', kind: 'board', board: id, level: b.level, tag: b.tag.startsWith('iotf-') ? b.tag : 'wokwi-' + b.tag }));

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
  def('mpu6050', { name: 'MPU6050 Gyro/Accel', cat: 'เซ็นเซอร์', kind: 'mpu', level: 'basic', optional: ['XDA', 'XCL', 'AD0', 'INT'], sig: [['SDA', 'sda'], ['SCL', 'scl']], sim: { ax: [0, -20, 20, 0.1, 'm/s²'], ay: [0, -20, 20, 0.1, 'm/s²'], az: [9.8, -20, 20, 0.1, 'm/s²'], gx: [0, -250, 250, 1, '°/s'], gy: [0, -250, 250, 1, '°/s'], gz: [0, -250, 250, 1, '°/s'], temp: [26, -40, 85, 0.5, '°C'] } });
  def('iotf-ph', { tag: 'iotf-ph', name: 'pH Sensor', cat: 'เซ็นเซอร์', kind: 'ph', level: 'basic', sig: [['Po', 'analog']], sim: { ph: [7, 0, 14, 0.1, 'pH'] } });
  def('iotf-tds', { tag: 'iotf-tds', name: 'TDS Sensor', cat: 'เซ็นเซอร์', kind: 'tds', level: 'basic', sig: [['A', 'analog']], sim: { ppm: [300, 0, 1000, 5, 'ppm'] } });
  const sen = (key, o) => def(key, Object.assign({ tag: key, cat: 'เซ็นเซอร์', level: 'basic' }, o));
  sen('iotf-dht11', { name: 'DHT11 อุณหภูมิ/ความชื้น', kind: 'dht', alias: { SDA: 'DATA' }, dhtType: 11, sim: { temp: [28, 0, 50, 1, '°C'], hum: [65, 20, 90, 1, '%'] } });
  sen('iotf-ds18b20', { name: 'DS18B20 อุณหภูมิกันน้ำ', kind: 'ds18b20', sim: { temp: [25, -55, 125, 0.5, '°C'] } });
  sen('iotf-soil', { name: 'เซ็นเซอร์ความชื้นในดิน', kind: 'analogmod', analogPin: 'AO', digitalPin: 'DO', invert: true, optional: ['DO'], sim: { level: [40, 0, 100, 1, '% ชื้น'] } });
  sen('iotf-rain', { name: 'เซ็นเซอร์น้ำฝน', kind: 'analogmod', analogPin: 'AO', digitalPin: 'DO', invert: true, optional: ['DO'], sim: { level: [0, 0, 100, 1, '% เปียก'] } });
  sen('iotf-waterlevel', { name: 'เซ็นเซอร์ระดับน้ำ', kind: 'analogmod', analogPin: 'S', sim: { level: [30, 0, 100, 1, '% ระดับน้ำ'] } });
  sen('iotf-float', { name: 'ลูกลอยวัดระดับน้ำ (Float Switch)', kind: 'dsensor', outPin: 'S', activeLow: true, sim: { detect: [0, 0, 1, 1, 'น้ำถึงลูกลอย'] } });
  sen('iotf-turbidity', { name: 'เซ็นเซอร์ความขุ่นของน้ำ (Turbidity)', kind: 'turbidity', sim: { ntu: [100, 0, 3000, 10, 'NTU'] } });
  sen('iotf-mq135', { name: 'MQ-135 คุณภาพอากาศ', kind: 'analogmod', analogPin: 'AO', digitalPin: 'DO', optional: ['DO'], sim: { level: [15, 0, 100, 1, '% มลพิษ'] } });
  sen('iotf-ir-obstacle', { name: 'IR หลบสิ่งกีดขวาง', kind: 'dsensor', outPin: 'OUT', activeLow: true, sim: { detect: [0, 0, 1, 1, 'เจอวัตถุ'] } });
  sen('iotf-line', { name: 'TCRT5000 เดินตามเส้น', kind: 'line', optional: ['AO'], sim: { black: [0, 0, 1, 1, 'อยู่บนเส้นดำ'] } });
  sen('iotf-touch', { name: 'Touch TTP223', kind: 'dsensor', outPin: 'SIG', touch: true, sim: { detect: [0, 0, 1, 1, 'ถูกแตะ'] } });
  sen('iotf-reed', { name: 'Reed Switch แม่เหล็ก', kind: 'dsensor', outPin: 'S', activeLow: true, sim: { detect: [0, 0, 1, 1, 'มีแม่เหล็ก'] } });
  sen('iotf-sw420', { name: 'SW-420 ตรวจจับการสั่น', kind: 'dsensor', outPin: 'DO', sim: { detect: [0, 0, 1, 1, 'สั่น'] } });
  sen('iotf-bme280', { name: 'BME280 อุณหภูมิ/ความชื้น/ความกด', kind: 'bme', sim: { temp: [28, -40, 85, 0.1, '°C'], hum: [60, 0, 100, 0.5, '%'], pressure: [1013.25, 300, 1100, 0.25, 'hPa'] } });
  sen('iotf-bmp280', { name: 'BMP280 ความกดอากาศ', kind: 'bme', noHum: true, sim: { temp: [28, -40, 85, 0.1, '°C'], pressure: [1013.25, 300, 1100, 0.25, 'hPa'] } });
  sen('iotf-bh1750', { name: 'BH1750 ความสว่าง (lux)', kind: 'bh1750', optional: ['ADDR'], sim: { lux: [300, 0, 65535, 10, 'lux'] } });
  sen('iotf-pms5003', { name: 'PMS5003 ฝุ่น PM2.5', kind: 'pms', optional: ['RX', 'SET', 'RESET'], sim: { pm1: [10, 0, 500, 1, 'µg/m³ PM1.0'], pm25: [25, 0, 500, 1, 'µg/m³ PM2.5'], pm10: [40, 0, 500, 1, 'µg/m³ PM10'] } });
  sen('iotf-acs712', { name: 'ACS712 วัดกระแส', kind: 'acs712', sim: { current: [1.5, -5, 5, 0.05, 'A'] } });
  sen('iotf-pzem004t', { name: 'PZEM-004T วัดไฟฟ้า', kind: 'pzem', level: 'advanced', sim: { voltage: [220, 80, 260, 0.5, 'V'], current: [1.2, 0, 100, 0.1, 'A'], pf: [0.95, 0, 1, 0.01, 'PF'], freq: [50, 45, 65, 0.1, 'Hz'] } });
  sen('iotf-yfs201', { name: 'YF-S201 วัดการไหลของน้ำ', kind: 'flow', sim: { flow: [5, 0, 30, 0.5, 'L/min'] } });
  sen('iotf-salinity', { name: 'เซ็นเซอร์ความเค็ม (Salinity)', kind: 'salinity', sim: { ppt: [5, 0, 50, 0.1, 'ppt'] } });
  sen('iotf-max30102', { name: 'MAX30102 ชีพจร/ออกซิเจน', kind: 'oximeter', optional: ['INT'], sim: { bpm: [75, 40, 180, 1, 'bpm'], spo2: [97, 80, 100, 1, '% SpO2'], finger: [1, 0, 1, 1, 'วางนิ้ว'] } });
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
  // breadboards: holes joined in strips; parts whose pins sit on holes are connected through them
  [['iotf-breadboard', 'Breadboard ครึ่งแผ่น (400 รู)'], ['iotf-breadboard-full', 'Breadboard เต็มแผ่น (830 รู)'], ['iotf-breadboard-mini', 'Breadboard มินิ (170 รู)']]
    .forEach(([k, name]) => def(k, { tag: k, name, cat: 'เบรดบอร์ด', kind: 'breadboard', level: 'basic', geom: BB[k] }));
  def('servo', { name: 'Servo Motor', cat: 'มอเตอร์', kind: 'servo', level: 'basic', sig: [['PWM', 'pwm']] });
  const mot = (key, o) => def(key, Object.assign({ tag: key, cat: 'มอเตอร์', level: 'basic' }, o));
  mot('iotf-dcmotor', { name: 'มอเตอร์ DC (TT มีเกียร์)', kind: 'dcmotor', rpm: 200 });
  mot('iotf-pump', { name: 'ปั๊มน้ำ DC 5V', kind: 'dcmotor', rpm: 0 });
  mot('iotf-vibmotor', { name: 'มอเตอร์สั่น', kind: 'dcmotor', rpm: 0 });
  mot('iotf-l298n', { name: 'ไดรเวอร์มอเตอร์ L298N', kind: 'hbridge', optional: ['OUT1', 'OUT2', 'OUT3', 'OUT4', '5V', 'ENA', 'ENB', 'IN1', 'IN2', 'IN3', 'IN4'] });
  mot('iotf-l9110s', { name: 'ไดรเวอร์มอเตอร์ L9110S', kind: 'hbridge', optional: ['A1', 'A2', 'B1', 'B2', 'A-IA', 'A-IB', 'B-IA', 'B-IB'] });
  mot('iotf-28byj48', { name: 'สเต็ปเปอร์ 28BYJ-48 + ULN2003', kind: 'stepper', stepsPerRev: 2048, optional: [] });
  mot('iotf-a4988', { name: 'ไดรเวอร์สเต็ปเปอร์ A4988', kind: 'a4988', level: 'advanced', optional: ['EN', 'MS1', 'MS2', 'MS3', 'RST', 'SLP', '1A', '1B', '2A', '2B'] });
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

  // English names and extra search words (Thai and English), so a part is found whichever language is typed
  const EN = {
    'esp32-devkit-v1': ['ESP32 DevKit V1', 'wifi board esp'], 'arduino-uno': ['Arduino Uno', 'board atmega328 อาดุยโน่'], 'arduino-nano': ['Arduino Nano', 'board'], 'arduino-mega': ['Arduino Mega 2560', 'board'],
    'nano-rp2040-connect': ['Arduino Nano RP2040 Connect', 'board raspberry pi pico'], franzininho: ['Franzininho ATtiny85', 'board digispark'],
    led: ['LED', 'light lamp ไฟ หลอด'], 'rgb-led': ['RGB LED', 'color light ไฟสี'], 'led-bar-graph': ['LED Bar Graph', 'level light'], 'led-ring': ['NeoPixel Ring WS2812', 'rgb strip ไฟวงแหวน'],
    neopixel: ['NeoPixel WS2812B', 'rgb addressable'], 'neopixel-matrix': ['NeoPixel Matrix 8x8', 'rgb led matrix'], buzzer: ['Buzzer', 'speaker sound beep ลำโพง เสียง'],
    lcd1602: ['LCD 16x2 I2C display', 'จอ screen'], lcd2004: ['LCD 20x4 I2C display', 'จอ screen'], ssd1306: ['OLED display SSD1306', 'จอ screen'], ili9341: ['TFT display ILI9341', 'จอสี screen'], '7segment': ['7-Segment display', 'จอตัวเลข'],
    dht22: ['DHT22 temperature humidity sensor', 'am2302 temp อุณหภูมิ ความชื้น'], 'hc-sr04': ['HC-SR04 ultrasonic distance sensor', 'sonar ระยะทาง'], 'pir-motion-sensor': ['PIR motion sensor', 'human detect เคลื่อนไหว'],
    'photoresistor-sensor': ['LDR light sensor photoresistor', 'brightness แสง'], 'gas-sensor': ['MQ-2 gas smoke sensor', 'lpg ควัน'], 'flame-sensor': ['Flame fire sensor', 'ไฟไหม้'],
    'small-sound-sensor': ['Sound microphone sensor (small)', 'mic noise'], 'big-sound-sensor': ['Sound microphone sensor (big)', 'mic noise'], 'ntc-temperature-sensor': ['NTC thermistor temperature sensor', 'temp'],
    'heart-beat-sensor': ['Heart beat pulse sensor', 'bpm'], 'tilt-switch': ['Tilt switch sensor', 'เอียง'], mpu6050: ['MPU6050 gyroscope accelerometer', 'gyro imu motion tilt ไจโร เอียง ความเร่ง'],
    'iotf-ph': ['pH sensor water acidity', 'กรด ด่าง น้ำ water quality คุณภาพน้ำ'], 'iotf-tds': ['TDS water quality sensor', 'ppm น้ำ คุณภาพน้ำ'], 'iotf-dht11': ['DHT11 temperature humidity sensor', 'temp'],
    'iotf-ds18b20': ['DS18B20 waterproof temperature sensor', 'onewire temp probe water quality'], 'iotf-soil': ['Soil moisture sensor', 'hygrometer plant ดิน ต้นไม้'], 'iotf-rain': ['Rain sensor', 'raindrop water ฝน'],
    'iotf-waterlevel': ['Water level sensor', 'tank น้ำ ระดับ'], 'iotf-float': ['Float switch water level sensor', 'tank น้ำ ระดับ ลูกลอย'], 'iotf-turbidity': ['Turbidity water quality sensor', 'ntu ขุ่น น้ำ คุณภาพน้ำ'], 'iotf-mq135': ['MQ-135 air quality gas sensor', 'co2 pollution มลพิษ'], 'iotf-ir-obstacle': ['IR obstacle avoidance sensor', 'infrared proximity'],
    'iotf-line': ['TCRT5000 line tracking sensor', 'line follower robot infrared'], 'iotf-touch': ['TTP223 touch sensor', 'capacitive button สัมผัส'], 'iotf-reed': ['Reed switch magnetic sensor', 'door magnet ky-021 ประตู'],
    'iotf-sw420': ['SW-420 vibration sensor', 'shake สั่น'], 'iotf-bme280': ['BME280 temperature humidity pressure sensor', 'barometer altitude'], 'iotf-bmp280': ['BMP280 pressure sensor', 'barometer altitude temperature'],
    'iotf-bh1750': ['BH1750 light intensity lux sensor', 'brightness แสง'], 'iotf-pms5003': ['PMS5003 PM2.5 dust sensor', 'air quality particulate pm10'], 'iotf-acs712': ['ACS712 current sensor', 'amp ampere กระแสไฟ'],
    'iotf-pzem004t': ['PZEM-004T energy power meter', 'voltage current watt kwh ไฟฟ้า มิเตอร์'], 'iotf-yfs201': ['YF-S201 water flow sensor', 'flow meter'], 'iotf-max30102': ['MAX30102 heart rate SpO2 oximeter', 'pulse oxygen'],
    'iotf-salinity': ['Salinity sensor water salt', 'water quality คุณภาพน้ำ conductivity ec seawater เกลือ เค็ม น้ำทะเล'], 'iotf-loadcell': ['Load cell weight sensor', 'scale ชั่งน้ำหนัก'],
    pushbutton: ['Push button', 'switch กด'], 'pushbutton-6mm': ['Push button 6mm', 'tactile switch'], 'slide-switch': ['Slide switch', 'toggle'], potentiometer: ['Potentiometer knob', 'variable resistor ตัวต้านทานปรับค่า ลูกบิด'],
    'slide-potentiometer': ['Slide potentiometer fader', 'variable resistor'], 'analog-joystick': ['Analog joystick', 'จอยสติ๊ก'], 'membrane-keypad': ['Keypad 4x4 membrane', 'keyboard ปุ่มตัวเลข'],
    'ky-040': ['Rotary encoder KY-040', 'knob'], 'dip-switch-8': ['DIP switch 8', 'สวิตช์'], 'ir-remote': ['IR remote control', 'infrared รีโมต'], 'rotary-dialer': ['Rotary phone dialer', 'โทรศัพท์'],
    'iotf-breadboard': ['Breadboard half 400', 'protoboard โปรโตบอร์ด'], 'iotf-breadboard-full': ['Breadboard full 830', 'protoboard โปรโตบอร์ด'], 'iotf-breadboard-mini': ['Breadboard mini 170', 'protoboard โปรโตบอร์ด'],
    servo: ['Servo motor SG90', 'เซอร์โว'], 'iotf-dcmotor': ['DC motor TT gear motor', 'wheel robot car ล้อ'], 'iotf-pump': ['Water pump DC', 'watering ปั๊ม รดน้ำ'], 'iotf-vibmotor': ['Vibration motor', 'buzz haptic'],
    'iotf-l298n': ['L298N motor driver H-bridge', 'dual dc motor'], 'iotf-l9110s': ['L9110S motor driver H-bridge', 'dc motor'], 'iotf-28byj48': ['28BYJ-48 stepper motor ULN2003', 'step motor'],
    'iotf-a4988': ['A4988 stepper driver', 'step dir nema'], 'stepper-motor': ['Stepper motor NEMA 17', 'step motor สเต็ปเปอร์'], 'biaxial-stepper': ['Biaxial stepper motor', 'step'],
    'iotf-relay4': ['Relay module 4 channel', 'switch รีเลย์'], 'ks2e-m-dc5': ['Relay KS2E', 'switch รีเลย์'], resistor: ['Resistor', 'ohm โอห์ม'], hx711: ['HX711 load cell amplifier', 'weight scale'],
    'iotf-rc522': ['RFID RC522 card reader', 'nfc บัตร'], 'iotf-neo6m': ['GPS NEO-6M', 'location พิกัด'], 'iotf-sx1278': ['LoRa SX1278 Ra-02', 'radio wireless ไร้สาย'], ds1307: ['RTC DS1307 real time clock', 'นาฬิกา เวลา'],
    'iotf-uno-r4-wifi': ['Arduino UNO R4 WiFi board', 'renesas ra4m1 esp32-s3 led matrix wifis3'], 'iotf-uno-r4-minima': ['Arduino UNO R4 Minima board', 'renesas ra4m1'],
    'microsd-card': ['microSD card module', 'storage file เก็บไฟล์'], 'ir-receiver': ['IR receiver', 'infrared remote รีโมต']
  };
  Object.entries(EN).forEach(([k, [en, kw]]) => { if (P[k]) { P[k].en = en; P[k].kw = kw; } });
  // one lowercase string to search in: Thai name, English name, extra words, id and category
  Object.values(P).forEach((d) => { d.search = [d.name, d.en, d.kw, d.key, d.cat, d.cat === 'เซ็นเซอร์' ? 'sensor' : ''].filter(Boolean).join(' ').toLowerCase(); });

  const CATS = ['บอร์ด', 'เบรดบอร์ด', 'เซ็นเซอร์', 'จอแสดงผล', 'ไฟและเสียง', 'อินพุต', 'มอเตอร์', 'โมดูล'];

  // the parts list shown in Basic is a subset; check it never contains something that needs advanced wiring
  IOTF.CUSTOM = CUSTOM;
  IOTF.BOARDS = BOARDS;
  IOTF.PARTS = P;
  IOTF.CATS = CATS;
  IOTF.boardByTag = (tag) => Object.keys(BOARDS).find((k) => 'wokwi-' + BOARDS[k].tag === tag || BOARDS[k].tag === tag);
})();
