/* WJSIM — Blockly blocks (Thai) and an Arduino C++ generator */
(function () {
  'use strict';
  const ed = IOTF.editor;
  const BL = window.Blockly;
  const COL = { base: 30, io: 210, time: 120, serial: 160, sensor: 290, out: 330, iot: 15, logic: 210 };

  const board = () => ed.boardDef() || IOTF.BOARDS.esp32;
  function pinField(analog) {
    return new BL.FieldDropdown(function () {
      const b = board(); const list = (analog ? b.blockAnalog : b.blockPins).map((p) => [/^\d+$/.test(p) && b === IOTF.BOARDS.esp32 ? 'GPIO' + p : p, p]);
      const v = this && this.getValue && this.getValue();
      if (v && !list.some((o) => o[1] === v)) list.push([v, v]);
      return list;
    });
  }
  const COLOURS = [['แดง', '255,0,0'], ['เขียว', '0,255,0'], ['น้ำเงิน', '0,0,255'], ['เหลือง', '255,180,0'], ['ม่วง', '160,0,255'], ['ฟ้า', '0,200,255'], ['ชมพู', '255,60,150'], ['ขาว', '255,255,255'], ['ปิด', '0,0,0']];

  function def(type, fn) { BL.Blocks[type] = { init: fn }; }
  def('iotf_main', function () {
    this.appendDummyInput().appendField('▶ เมื่อเริ่มทำงาน (setup)');
    this.appendStatementInput('SETUP');
    this.appendDummyInput().appendField('🔁 ทำซ้ำตลอด (loop)');
    this.appendStatementInput('LOOP');
    this.setColour(COL.base); this.setTooltip('setup ทำครั้งเดียวตอนเปิดเครื่อง ส่วน loop ทำซ้ำไปเรื่อย ๆ'); this.setDeletable(false);
  });
  const stmt = (b, c, tip) => { b.setPreviousStatement(true); b.setNextStatement(true); b.setColour(c); if (tip) b.setTooltip(tip); };
  const val = (b, c, type, tip) => { b.setOutput(true, type || null); b.setColour(c); if (tip) b.setTooltip(tip); };

  def('iotf_digital_write', function () {
    this.appendDummyInput().appendField('ตั้งขา').appendField(pinField(), 'PIN').appendField('เป็น').appendField(new BL.FieldDropdown([['HIGH (เปิด)', 'HIGH'], ['LOW (ปิด)', 'LOW']]), 'STATE');
    stmt(this, COL.io, 'เปิด/ปิดไฟหรืออุปกรณ์ที่ต่อกับขานี้');
  });
  def('iotf_digital_read', function () { this.appendDummyInput().appendField('อ่านค่าดิจิทัลขา').appendField(pinField(), 'PIN'); val(this, COL.io, 'Number'); });
  def('iotf_button', function () { this.appendDummyInput().appendField('ปุ่มที่ขา').appendField(pinField(), 'PIN').appendField('ถูกกด'); val(this, COL.io, 'Boolean', 'ใช้ INPUT_PULLUP: กดแล้วได้ LOW'); });
  def('iotf_analog_read', function () { this.appendDummyInput().appendField('อ่านค่าอนาล็อกขา').appendField(pinField(true), 'PIN'); val(this, COL.io, 'Number'); });
  def('iotf_analog_write', function () {
    this.appendValueInput('VALUE').setCheck('Number').appendField('ตั้งค่า PWM ขา').appendField(pinField(), 'PIN').appendField('=');
    this.appendDummyInput().appendField('(0-255)'); this.setInputsInline(true); stmt(this, COL.io, 'ใช้หรี่ไฟ LED หรือคุมความเร็วมอเตอร์');
  });
  def('iotf_delay', function () { this.appendValueInput('MS').setCheck('Number').appendField('รอ'); this.appendDummyInput().appendField('มิลลิวินาที'); this.setInputsInline(true); stmt(this, COL.time); });
  def('iotf_millis', function () { this.appendDummyInput().appendField('เวลาตั้งแต่เริ่ม (ms)'); val(this, COL.time, 'Number'); });
  def('iotf_serial_print', function () { this.appendValueInput('VALUE').appendField('แสดงใน Serial'); this.appendDummyInput().appendField(new BL.FieldCheckbox('TRUE'), 'NL').appendField('ขึ้นบรรทัดใหม่'); this.setInputsInline(true); stmt(this, COL.serial); });
  def('iotf_map', function () {
    this.appendValueInput('V').setCheck('Number').appendField('แปลงค่า');
    this.appendDummyInput().appendField('จาก').appendField(new BL.FieldNumber(0), 'A').appendField('-').appendField(new BL.FieldNumber(1023), 'B').appendField('เป็น').appendField(new BL.FieldNumber(0), 'C').appendField('-').appendField(new BL.FieldNumber(100), 'D');
    this.setInputsInline(true); val(this, COL.time, 'Number');
  });
  // sensors
  def('iotf_dht', function () { this.appendDummyInput().appendField('อ่าน').appendField(new BL.FieldDropdown([['อุณหภูมิ (°C)', 'T'], ['ความชื้น (%)', 'H']]), 'WHAT').appendField('จาก DHT22 ขา').appendField(pinField(), 'PIN'); val(this, COL.sensor, 'Number'); });
  def('iotf_ultrasonic', function () { this.appendDummyInput().appendField('ระยะทาง (cm) HC-SR04 TRIG').appendField(pinField(), 'T').appendField('ECHO').appendField(pinField(), 'E'); val(this, COL.sensor, 'Number'); });
  def('iotf_pir', function () { this.appendDummyInput().appendField('PIR ขา').appendField(pinField(), 'PIN').appendField('ตรวจพบการเคลื่อนไหว'); val(this, COL.sensor, 'Boolean'); });
  def('iotf_light', function () { this.appendDummyInput().appendField('ระดับแสง (%) ขา').appendField(pinField(true), 'PIN'); val(this, COL.sensor, 'Number'); });
  def('iotf_pot', function () { this.appendDummyInput().appendField('ค่า Potentiometer (0-100) ขา').appendField(pinField(true), 'PIN'); val(this, COL.sensor, 'Number'); });
  def('iotf_gas', function () { this.appendDummyInput().appendField('ระดับแก๊ส/เปลวไฟ/เสียง (%) ขา').appendField(pinField(true), 'PIN'); val(this, COL.sensor, 'Number'); });
  def('iotf_ntc', function () { this.appendDummyInput().appendField('อุณหภูมิ NTC (°C) ขา').appendField(pinField(true), 'PIN'); val(this, COL.sensor, 'Number'); });
  def('iotf_ph', function () { this.appendDummyInput().appendField('ค่า pH ขา').appendField(pinField(true), 'PIN'); val(this, COL.sensor, 'Number'); });
  def('iotf_tds', function () { this.appendDummyInput().appendField('ค่า TDS (ppm) ขา').appendField(pinField(true), 'PIN'); val(this, COL.sensor, 'Number'); });
  // outputs
  def('iotf_servo', function () { this.appendValueInput('ANGLE').setCheck('Number').appendField('หมุน Servo ขา').appendField(pinField(), 'PIN').appendField('ไปที่'); this.appendDummyInput().appendField('องศา'); this.setInputsInline(true); stmt(this, COL.out); });
  def('iotf_tone', function () {
    this.appendValueInput('FREQ').setCheck('Number').appendField('เล่นเสียง Buzzer ขา').appendField(pinField(), 'PIN').appendField('ความถี่');
    this.appendValueInput('MS').setCheck('Number').appendField('Hz นาน'); this.appendDummyInput().appendField('ms'); this.setInputsInline(true); stmt(this, COL.out);
  });
  def('iotf_notone', function () { this.appendDummyInput().appendField('หยุดเสียง Buzzer ขา').appendField(pinField(), 'PIN'); stmt(this, COL.out); });
  def('iotf_rgb', function () { this.appendDummyInput().appendField('RGB LED ขา R').appendField(pinField(), 'R').appendField('G').appendField(pinField(), 'G').appendField('B').appendField(pinField(), 'B').appendField('สี').appendField(new BL.FieldDropdown(COLOURS), 'C'); stmt(this, COL.out); });
  def('iotf_relay', function () { this.appendDummyInput().appendField('สั่ง Relay ขา').appendField(pinField(), 'PIN').appendField(new BL.FieldDropdown([['เปิด', 'ON'], ['ปิด', 'OFF']]), 'STATE'); stmt(this, COL.out, 'โมดูล relay ส่วนใหญ่ทำงานเมื่อได้ LOW'); });
  def('iotf_lcd_print', function () { this.appendValueInput('TEXT').appendField('LCD แสดง'); this.appendDummyInput().appendField('แถว').appendField(new BL.FieldNumber(0, 0, 3, 1), 'ROW').appendField('คอลัมน์').appendField(new BL.FieldNumber(0, 0, 19, 1), 'COL'); this.setInputsInline(true); stmt(this, COL.out); });
  def('iotf_lcd_clear', function () { this.appendDummyInput().appendField('ล้างจอ LCD'); stmt(this, COL.out); });
  def('iotf_oled_print', function () { this.appendValueInput('TEXT').appendField('OLED แสดง'); this.appendDummyInput().appendField('x').appendField(new BL.FieldNumber(0, 0, 127, 1), 'X').appendField('y').appendField(new BL.FieldNumber(0, 0, 63, 1), 'Y').appendField('ขนาด').appendField(new BL.FieldNumber(1, 1, 4, 1), 'S'); this.setInputsInline(true); stmt(this, COL.out); });
  def('iotf_oled_clear', function () { this.appendDummyInput().appendField('ล้างจอ OLED'); stmt(this, COL.out); });
  def('iotf_neopixel', function () {
    this.appendValueInput('I').setCheck('Number').appendField('NeoPixel ขา').appendField(pinField(), 'PIN').appendField('(').appendField(new BL.FieldNumber(16, 1, 64, 1), 'N').appendField('ดวง) ตั้งดวงที่');
    this.appendDummyInput().appendField('เป็นสี').appendField(new BL.FieldDropdown(COLOURS), 'C'); this.setInputsInline(true); stmt(this, COL.out, 'ดวงแรกคือ 0');
  });
  def('iotf_neopixel_fill', function () { this.appendDummyInput().appendField('NeoPixel ขา').appendField(pinField(), 'PIN').appendField('(').appendField(new BL.FieldNumber(16, 1, 64, 1), 'N').appendField('ดวง) ทุกดวงเป็นสี').appendField(new BL.FieldDropdown(COLOURS), 'C'); stmt(this, COL.out); });
  // IoT
  def('iotf_wifi', function () { this.appendDummyInput().appendField('เชื่อมต่อ WiFi ชื่อ').appendField(new BL.FieldTextInput('WJSIM-WiFi'), 'SSID').appendField('รหัส').appendField(new BL.FieldTextInput(''), 'PASS'); stmt(this, COL.iot, 'ใส่ไว้ในส่วน setup'); });
  def('iotf_mqtt_publish', function () { this.appendValueInput('VALUE').appendField('ส่งค่า'); this.appendDummyInput().appendField('ไปที่ Dashboard หัวข้อ').appendField(new BL.FieldTextInput('wjsim/temp'), 'TOPIC'); this.setInputsInline(true); stmt(this, COL.iot, 'ส่งผ่าน MQTT ต้องเชื่อม WiFi ก่อน'); });
  def('iotf_mqtt_value', function () { this.appendDummyInput().appendField('ข้อความล่าสุดจากหัวข้อ').appendField(new BL.FieldTextInput('wjsim/led'), 'TOPIC'); val(this, COL.iot, 'String'); });
  def('iotf_mqtt_number', function () { this.appendDummyInput().appendField('ตัวเลขล่าสุดจากหัวข้อ').appendField(new BL.FieldTextInput('wjsim/level'), 'TOPIC'); val(this, COL.iot, 'Number'); });

  /* ---------- generator ---------- */
  const G = new BL.CodeGenerator('CPP');
  const O = { ATOMIC: 0, POSTFIX: 1, UNARY: 2, MUL: 3, ADD: 4, REL: 6, EQ: 7, AND: 11, OR: 12, COND: 13, ASSIGN: 14, NONE: 99 };
  G.INDENT = '  ';
  const RESERVED = new Set('int float char long double bool boolean void String byte word if else for while do switch case break continue return true false HIGH LOW INPUT OUTPUT setup loop delay map min max abs new delete class struct const static unsigned signed auto this'.split(' '));
  G.init = function (ws) {
    this.inc = new Set(); this.glob = new Map(); this.setups = new Map(); this.helpers = new Map(); this.subs = new Set(); this.mqtt = false;
    this.vars = new Map();
    const map = ws.getVariableMap ? ws.getVariableMap() : null;
    const all = map ? (map.getAllVariables ? map.getAllVariables() : []) : ws.getAllVariables();
    let n = 0;
    all.forEach((v) => {
      const name = v.getName ? v.getName() : v.name, id = v.getId ? v.getId() : v.getId;
      let id2 = /^[A-Za-z_]\w*$/.test(name) && !RESERVED.has(name) ? name : 'var' + (++n);
      this.vars.set(id, { c: id2, label: name, str: false });
    });
    ws.getAllBlocks(false).forEach((b) => {
      if (b.type !== 'variables_set') return;
      const t = b.getInputTargetBlock('VALUE');
      const v = this.vars.get(b.getFieldValue('VAR'));
      if (v && t && (t.outputConnection.getCheck() || []).includes('String')) v.str = true;
      if (v && t && ['text', 'text_join', 'iotf_mqtt_value'].includes(t.type)) v.str = true;
    });
    this.setupCode = ''; this.loopCode = '';
  };
  G.varName = function (block) { const v = this.vars.get(block.getFieldValue('VAR')); return v ? v.c : 'x'; };
  G.scrub_ = function (block, code, thisOnly) {
    const next = block.nextConnection && block.nextConnection.targetBlock();
    return code + (next && !thisOnly ? this.blockToCode(next) : '');
  };
  G.scrubNakedValue = () => '';
  G.finish = function () {
    const out = ['// สร้างจาก Block ด้วย WJSIM — แก้เองได้ในแท็บนี้'];
    if (this.inc.size) { out.push(...[...this.inc].map((i) => `#include <${i}>`)); out.push(''); }
    if (this.vars.size) { this.vars.forEach((v) => out.push(v.str ? `String ${v.c} = "";${v.label !== v.c ? ' // ' + v.label : ''}` : `float ${v.c} = 0;${v.label !== v.c ? ' // ' + v.label : ''}`)); out.push(''); }
    if (this.glob.size) { out.push(...this.glob.values()); out.push(''); }
    if (this.mqtt) {
      const subs = [...this.subs];
      out.push('WiFiClient iotfNet;', 'PubSubClient mqtt(iotfNet);');
      if (subs.length) {
        out.push(`String iotfTopics[${subs.length}] = {${subs.map((s) => JSON.stringify(s)).join(', ')}};`, `String iotfValues[${subs.length}];`, '',
          'void iotfOnMessage(char* topic, byte* payload, unsigned int length) {', '  String msg = "";', '  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];',
          `  for (int i = 0; i < ${subs.length}; i++) if (iotfTopics[i] == String(topic)) iotfValues[i] = msg;`, '}', '',
          'String iotfGet(String topic) {', `  for (int i = 0; i < ${subs.length}; i++) if (iotfTopics[i] == topic) return iotfValues[i];`, '  return "";', '}', '');
      }
      out.push('void iotfMqtt() {', '  if (WiFi.status() != WL_CONNECTED) return;', '  if (!mqtt.connected()) {', '    if (mqtt.connect("wjsim-device")) {', '      Serial.println("MQTT connected");');
      subs.forEach((s) => out.push(`      mqtt.subscribe(${JSON.stringify(s)});`));
      out.push('    }', '  }', '  mqtt.loop();', '}', '');
    }
    this.helpers.forEach((h) => { out.push(h, ''); });
    out.push('void setup() {');
    const su = [...this.setups.values()];
    if (this.mqtt) { su.push('mqtt.setServer("broker.wjsim.local", 1883);'); if (this.subs.size) su.push('mqtt.setCallback(iotfOnMessage);'); }
    su.forEach((l) => out.push('  ' + l));
    out.push(this.setupCode.replace(/\s+$/, '') ? this.setupCode.replace(/\s+$/, '') : '', '}', '', 'void loop() {');
    if (this.mqtt) out.push('  iotfMqtt();');
    out.push(this.loopCode.replace(/\s+$/, ''), '}');
    return out.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').replace(/\n\n}/g, '\n}') + '\n';
  };
  const F = G.forBlock;
  const v = (b, n, o = O.NONE, d = '0') => G.valueToCode(b, n, o) || d;
  const serial = () => G.setups.set('serial', 'Serial.begin(115200);');
  const pm = (pin, mode) => { if (!G.setups.has('pm' + pin)) G.setups.set('pm' + pin, `pinMode(${pin}, ${mode});`); };
  const adcMax = () => board().adcMax, vref = () => board().vref;
  const isEsp = () => board() === IOTF.BOARDS.esp32;

  F.iotf_main = (b) => { G.setupCode = G.statementToCode(b, 'SETUP'); G.loopCode = G.statementToCode(b, 'LOOP'); return ''; };
  F.iotf_digital_write = (b) => { const p = b.getFieldValue('PIN'); pm(p, 'OUTPUT'); return `digitalWrite(${p}, ${b.getFieldValue('STATE')});\n`; };
  F.iotf_digital_read = (b) => { const p = b.getFieldValue('PIN'); pm(p, 'INPUT'); return [`digitalRead(${p})`, O.ATOMIC]; };
  F.iotf_button = (b) => { const p = b.getFieldValue('PIN'); pm(p, 'INPUT_PULLUP'); return [`(digitalRead(${p}) == LOW)`, O.ATOMIC]; };
  F.iotf_analog_read = (b) => [`analogRead(${b.getFieldValue('PIN')})`, O.ATOMIC];
  F.iotf_analog_write = (b) => { const p = b.getFieldValue('PIN'); pm(p, 'OUTPUT'); return `analogWrite(${p}, ${v(b, 'VALUE', O.NONE)});\n`; };
  F.iotf_delay = (b) => `delay(${v(b, 'MS', O.NONE, '1000')});\n`;
  F.iotf_millis = () => ['millis()', O.ATOMIC];
  F.iotf_serial_print = (b) => { serial(); return `Serial.${b.getFieldValue('NL') === 'TRUE' ? 'println' : 'print'}(${v(b, 'VALUE', O.NONE, '""')});\n`; };
  F.iotf_map = (b) => [`map(${v(b, 'V')}, ${b.getFieldValue('A')}, ${b.getFieldValue('B')}, ${b.getFieldValue('C')}, ${b.getFieldValue('D')})`, O.ATOMIC];
  F.iotf_dht = (b) => {
    const p = b.getFieldValue('PIN'); G.inc.add('DHT.h'); G.glob.set('dht' + p, `DHT dht${p}(${p}, DHT22);`); G.setups.set('dht' + p, `dht${p}.begin();`);
    return [`dht${p}.${b.getFieldValue('WHAT') === 'T' ? 'readTemperature' : 'readHumidity'}()`, O.ATOMIC];
  };
  F.iotf_ultrasonic = (b) => {
    const t = b.getFieldValue('T'), e = b.getFieldValue('E'); pm(t, 'OUTPUT'); pm(e, 'INPUT');
    G.helpers.set('dist', 'float iotfDistanceCM(int trig, int echo) {\n  digitalWrite(trig, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trig, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trig, LOW);\n  long duration = pulseIn(echo, HIGH, 30000);\n  return duration / 58.2;\n}');
    return [`iotfDistanceCM(${t}, ${e})`, O.ATOMIC];
  };
  F.iotf_pir = (b) => { const p = b.getFieldValue('PIN'); pm(p, 'INPUT'); return [`(digitalRead(${p}) == HIGH)`, O.ATOMIC]; };
  F.iotf_light = (b) => [`map(analogRead(${b.getFieldValue('PIN')}), 0, ${adcMax()}, 100, 0)`, O.ATOMIC];
  F.iotf_pot = (b) => [`map(analogRead(${b.getFieldValue('PIN')}), 0, ${adcMax()}, 0, 100)`, O.ATOMIC];
  F.iotf_gas = (b) => [`map(analogRead(${b.getFieldValue('PIN')}), 0, ${adcMax()}, 0, 100)`, O.ATOMIC];
  F.iotf_ntc = (b) => {
    G.helpers.set('ntc', `float iotfNtc(int pin) {\n  const float BETA = 3950;\n  int a = analogRead(pin);\n  return 1 / (log(1 / (${adcMax()}.0 / a - 1)) / BETA + 1.0 / 298.15) - 273.15;\n}`);
    return [`iotfNtc(${b.getFieldValue('PIN')})`, O.ATOMIC];
  };
  F.iotf_ph = (b) => [`(analogRead(${b.getFieldValue('PIN')}) * ${vref().toFixed(1)} / ${adcMax()}.0 * 3.5)`, O.ATOMIC];
  F.iotf_tds = (b) => {
    G.helpers.set('tds', `float iotfTds(int pin) {\n  float v = analogRead(pin) * ${vref().toFixed(1)} / ${adcMax()}.0;\n  return (133.42 * v * v * v - 255.86 * v * v + 857.39 * v) * 0.5;\n}`);
    return [`iotfTds(${b.getFieldValue('PIN')})`, O.ATOMIC];
  };
  F.iotf_servo = (b) => {
    const p = b.getFieldValue('PIN'); G.inc.add(isEsp() ? 'ESP32Servo.h' : 'Servo.h'); G.glob.set('servo' + p, `Servo servo${p};`); G.setups.set('servo' + p, `servo${p}.attach(${p});`);
    return `servo${p}.write(${v(b, 'ANGLE', O.NONE, '90')});\n`;
  };
  F.iotf_tone = (b) => `tone(${b.getFieldValue('PIN')}, ${v(b, 'FREQ', O.NONE, '1000')}, ${v(b, 'MS', O.NONE, '200')});\n`;
  F.iotf_notone = (b) => `noTone(${b.getFieldValue('PIN')});\n`;
  F.iotf_rgb = (b) => {
    const [r, g, bl] = b.getFieldValue('C').split(','); const pins = ['R', 'G', 'B'].map((k) => b.getFieldValue(k));
    pins.forEach((p) => pm(p, 'OUTPUT'));
    return `analogWrite(${pins[0]}, ${r});\nanalogWrite(${pins[1]}, ${g});\nanalogWrite(${pins[2]}, ${bl});\n`;
  };
  F.iotf_relay = (b) => { const p = b.getFieldValue('PIN'); pm(p, 'OUTPUT'); G.setups.set('rl' + p, `digitalWrite(${p}, HIGH); // relay ปิดไว้ก่อน (ทำงานเมื่อ LOW)`); return `digitalWrite(${p}, ${b.getFieldValue('STATE') === 'ON' ? 'LOW' : 'HIGH'});\n`; };
  const lcd = () => { G.inc.add('Wire.h'); G.inc.add('LiquidCrystal_I2C.h'); G.glob.set('lcd', 'LiquidCrystal_I2C lcd(0x27, 16, 2);'); G.setups.set('lcd', 'lcd.init();\n  lcd.backlight();'); };
  F.iotf_lcd_print = (b) => { lcd(); return `lcd.setCursor(${b.getFieldValue('COL')}, ${b.getFieldValue('ROW')});\nlcd.print(${v(b, 'TEXT', O.NONE, '""')});\n`; };
  F.iotf_lcd_clear = () => { lcd(); return 'lcd.clear();\n'; };
  const oled = () => { G.inc.add('Wire.h'); G.inc.add('Adafruit_GFX.h'); G.inc.add('Adafruit_SSD1306.h'); G.glob.set('oled', 'Adafruit_SSD1306 display(128, 64, &Wire, -1);'); G.setups.set('oled', 'display.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n  display.clearDisplay();\n  display.setTextColor(SSD1306_WHITE);\n  display.display();'); };
  F.iotf_oled_print = (b) => { oled(); return `display.setTextSize(${b.getFieldValue('S')});\ndisplay.setCursor(${b.getFieldValue('X')}, ${b.getFieldValue('Y')});\ndisplay.print(${v(b, 'TEXT', O.NONE, '""')});\ndisplay.display();\n`; };
  F.iotf_oled_clear = () => { oled(); return 'display.clearDisplay();\ndisplay.display();\n'; };
  const strip = (b) => { const p = b.getFieldValue('PIN'), n = b.getFieldValue('N'); G.inc.add('Adafruit_NeoPixel.h'); G.glob.set('np' + p, `Adafruit_NeoPixel strip${p}(${n}, ${p}, NEO_GRB + NEO_KHZ800);`); G.setups.set('np' + p, `strip${p}.begin();\n  strip${p}.show();`); return 'strip' + p; };
  F.iotf_neopixel = (b) => { const s = strip(b); return `${s}.setPixelColor(${v(b, 'I', O.NONE, '0')}, ${s}.Color(${b.getFieldValue('C')}));\n${s}.show();\n`; };
  F.iotf_neopixel_fill = (b) => { const s = strip(b); return `${s}.fill(${s}.Color(${b.getFieldValue('C')}));\n${s}.show();\n`; };
  F.iotf_wifi = (b) => {
    serial(); G.inc.add(isEsp() ? 'WiFi.h' : 'WiFiNINA.h');
    return `WiFi.begin(${JSON.stringify(b.getFieldValue('SSID'))}, ${JSON.stringify(b.getFieldValue('PASS'))});\nSerial.print("Connecting WiFi");\nwhile (WiFi.status() != WL_CONNECTED) {\n  delay(500);\n  Serial.print(".");\n}\nSerial.println(" connected!");\n`;
  };
  const useMqtt = () => { serial(); G.inc.add(isEsp() ? 'WiFi.h' : 'WiFiNINA.h'); G.inc.add('PubSubClient.h'); G.mqtt = true; };
  F.iotf_mqtt_publish = (b) => { useMqtt(); return `mqtt.publish(${JSON.stringify(b.getFieldValue('TOPIC'))}, String(${v(b, 'VALUE', O.NONE, '0')}).c_str());\n`; };
  F.iotf_mqtt_value = (b) => { useMqtt(); const t = b.getFieldValue('TOPIC'); G.subs.add(t); return [`iotfGet(${JSON.stringify(t)})`, O.ATOMIC]; };
  F.iotf_mqtt_number = (b) => { useMqtt(); const t = b.getFieldValue('TOPIC'); G.subs.add(t); return [`iotfGet(${JSON.stringify(t)}).toFloat()`, O.ATOMIC]; };

  // built-in blocks
  F.controls_if = (b) => {
    let n = 0, code = '';
    do { const c = v(b, 'IF' + n, O.NONE, 'false'); code += (n ? ' else ' : '') + `if (${c}) {\n${G.statementToCode(b, 'DO' + n)}}`; n++; } while (b.getInput('IF' + n));
    if (b.getInput('ELSE')) code += ` else {\n${G.statementToCode(b, 'ELSE')}}`;
    return code + '\n';
  };
  F.logic_compare = (b) => { const op = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[b.getFieldValue('OP')]; const o = /[<>]/.test(op) ? O.REL : O.EQ; return [`${v(b, 'A', o)} ${op} ${v(b, 'B', o)}`, o]; };
  F.logic_operation = (b) => { const and = b.getFieldValue('OP') === 'AND', o = and ? O.AND : O.OR; return [`${v(b, 'A', o, 'false')} ${and ? '&&' : '||'} ${v(b, 'B', o, 'false')}`, o]; };
  F.logic_negate = (b) => [`!${v(b, 'BOOL', O.UNARY, 'true')}`, O.UNARY];
  F.logic_boolean = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC];
  F.logic_ternary = (b) => [`${v(b, 'IF', O.COND, 'false')} ? ${v(b, 'THEN', O.COND)} : ${v(b, 'ELSE', O.COND)}`, O.COND];
  let loopN = 0;
  F.controls_repeat_ext = (b) => { const i = 'i' + (++loopN); return `for (int ${i} = 0; ${i} < ${v(b, 'TIMES', O.REL, '10')}; ${i}++) {\n${G.statementToCode(b, 'DO')}}\n`; };
  F.controls_whileUntil = (b) => { const c = v(b, 'BOOL', O.NONE, 'false'); return `while (${b.getFieldValue('MODE') === 'UNTIL' ? '!(' + c + ')' : c}) {\n${G.statementToCode(b, 'DO')}}\n`; };
  F.controls_for = (b) => { const x = G.varName(b); return `for (${x} = ${v(b, 'FROM', O.ASSIGN)}; ${x} <= ${v(b, 'TO', O.REL, '10')}; ${x} += ${v(b, 'BY', O.ASSIGN, '1')}) {\n${G.statementToCode(b, 'DO')}}\n`; };
  F.controls_flow_statements = (b) => (b.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n');
  F.math_number = (b) => { const n = +b.getFieldValue('NUM'); return [String(n), n < 0 ? O.UNARY : O.ATOMIC]; };
  F.math_arithmetic = (b) => {
    const [op, o] = { ADD: ['+', O.ADD], MINUS: ['-', O.ADD], MULTIPLY: ['*', O.MUL], DIVIDE: ['/', O.MUL], POWER: [null, O.ATOMIC] }[b.getFieldValue('OP')];
    if (!op) return [`pow(${v(b, 'A')}, ${v(b, 'B')})`, O.ATOMIC];
    return [`${v(b, 'A', o)} ${op} ${v(b, 'B', o + 0.1)}`, o];
  };
  F.math_modulo = (b) => [`(int)${v(b, 'DIVIDEND', O.UNARY)} % (int)${v(b, 'DIVISOR', O.UNARY, '1')}`, O.MUL];
  F.math_random_int = (b) => [`random(${v(b, 'FROM')}, ${v(b, 'TO', O.ADD, '100')} + 1)`, O.ATOMIC];
  F.math_round = (b) => [`${{ ROUND: 'round', ROUNDUP: 'ceil', ROUNDDOWN: 'floor' }[b.getFieldValue('OP')]}(${v(b, 'NUM')})`, O.ATOMIC];
  F.math_single = (b) => { const op = b.getFieldValue('OP'), x = v(b, 'NUM'); const m = { ROOT: `sqrt(${x})`, ABS: `abs(${x})`, NEG: `-(${x})`, LN: `log(${x})`, LOG10: `log10(${x})`, EXP: `exp(${x})`, POW10: `pow(10, ${x})` }; return [m[op] || x, O.ATOMIC]; };
  F.math_constrain = (b) => [`constrain(${v(b, 'VALUE')}, ${v(b, 'LOW')}, ${v(b, 'HIGH', O.NONE, '100')})`, O.ATOMIC];
  F.text = (b) => [JSON.stringify(b.getFieldValue('TEXT')), O.ATOMIC];
  F.text_join = (b) => {
    const parts = []; for (let i = 0; i < b.itemCount_; i++) parts.push(`String(${v(b, 'ADD' + i, O.NONE, '""')})`);
    return [parts.length ? parts.join(' + ') : '""', O.ADD];
  };
  F.variables_get = (b) => [G.varName(b), O.ATOMIC];
  F.variables_set = (b) => `${G.varName(b)} = ${v(b, 'VALUE', O.ASSIGN)};\n`;
  F.math_change = (b) => `${G.varName(b)} += ${v(b, 'DELTA', O.ADD, '1')};\n`;

  /* ---------- toolbox & workspace ---------- */
  const B = (type, extra) => Object.assign({ kind: 'block', type }, extra || {});
  const num = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const txt = (t) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
  function toolbox(basic) {
    const sensors = [B('iotf_dht'), B('iotf_ultrasonic'), B('iotf_pir'), B('iotf_light'), B('iotf_pot'), B('iotf_gas'), B('iotf_ntc'), B('iotf_ph'), B('iotf_tds'), B('iotf_button')];
    return {
      kind: 'categoryToolbox',
      contents: [
        { kind: 'category', name: 'ขาบอร์ด', colour: COL.io, contents: [B('iotf_digital_write'), B('iotf_button'), B('iotf_digital_read'), B('iotf_analog_read'), B('iotf_analog_write', { inputs: { VALUE: num(128) } })] },
        { kind: 'category', name: 'เวลา', colour: COL.time, contents: [B('iotf_delay', { inputs: { MS: num(1000) } }), B('iotf_millis'), B('iotf_map', { inputs: { V: { shadow: { type: 'iotf_analog_read' } } } })] },
        { kind: 'category', name: 'Serial', colour: COL.serial, contents: [B('iotf_serial_print', { inputs: { VALUE: txt('สวัสดี') } })] },
        { kind: 'category', name: 'เซ็นเซอร์', colour: COL.sensor, contents: sensors },
        { kind: 'category', name: 'เอาต์พุต', colour: COL.out, contents: [B('iotf_servo', { inputs: { ANGLE: num(90) } }), B('iotf_tone', { inputs: { FREQ: num(1000), MS: num(200) } }), B('iotf_notone'), B('iotf_rgb'), B('iotf_relay'), B('iotf_lcd_print', { inputs: { TEXT: txt('Hello') } }), B('iotf_lcd_clear'), B('iotf_oled_print', { inputs: { TEXT: txt('Hello') } }), B('iotf_oled_clear'), B('iotf_neopixel', { inputs: { I: num(0) } }), B('iotf_neopixel_fill')] },
        { kind: 'category', name: 'IoT', colour: COL.iot, contents: [B('iotf_wifi'), B('iotf_mqtt_publish', { inputs: { VALUE: num(25) } }), B('iotf_mqtt_value'), B('iotf_mqtt_number')] },
        { kind: 'sep' },
        { kind: 'category', name: 'เงื่อนไข', colour: '#5b80a5', contents: [B('controls_if'), B('controls_if', { extraState: { hasElse: true } }), B('logic_compare'), B('logic_operation'), B('logic_negate'), B('logic_boolean'), B('logic_ternary')] },
        { kind: 'category', name: 'วนซ้ำ', colour: '#5ba55b', contents: [B('controls_repeat_ext', { inputs: { TIMES: num(10) } }), B('controls_whileUntil'), B('controls_for', { inputs: { FROM: num(1), TO: num(10), BY: num(1) } }), B('controls_flow_statements')] },
        { kind: 'category', name: 'คณิต', colour: '#5b67a5', contents: [B('math_number'), B('math_arithmetic', { inputs: { A: num(1), B: num(1) } }), B('math_modulo', { inputs: { DIVIDEND: num(10), DIVISOR: num(3) } }), B('math_random_int', { inputs: { FROM: num(1), TO: num(100) } }), B('math_round', { inputs: { NUM: num(3.1) } }), B('math_single', { inputs: { NUM: num(9) } }), B('math_constrain', { inputs: { VALUE: num(50), LOW: num(0), HIGH: num(100) } })] },
        { kind: 'category', name: 'ข้อความ', colour: '#5ba58c', contents: [B('text'), B('text_join')] },
        { kind: 'category', name: 'ตัวแปร', colour: '#a55b80', custom: 'VARIABLE' }
      ]
    };
  }

  const blocks = { ws: null, listeners: [] };
  IOTF.blocks = blocks;
  blocks.init = function () {
    const theme = BL.Theme.defineTheme('iotfDark', {
      base: BL.Themes.Classic,
      componentStyles: { workspaceBackgroundColour: '#1e1e1e', toolboxBackgroundColour: '#262626', toolboxForegroundColour: '#dddddd', flyoutBackgroundColour: '#2b2b2b', flyoutForegroundColour: '#cccccc', flyoutOpacity: 0.97, scrollbarColour: '#555555', scrollbarOpacity: 0.6, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.3, cursorColour: '#d0d0d0' },
      fontStyle: { family: 'system-ui, "Noto Sans Thai", Tahoma, sans-serif', size: 11 }
    });
    blocks.ws = BL.inject('blocklyDiv', {
      toolbox: toolbox(true), theme, trashcan: true, sounds: false, media: 'vendor/blockly-media/',
      zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.4 },
      grid: { spacing: 22, length: 2, colour: '#2c2c2c', snap: true }, move: { scrollbars: true, drag: true, wheel: false }
    });
    blocks.ws.addChangeListener((e) => {
      if (e.isUiEvent || blocks.loading) return;
      blocks.listeners.forEach((f) => f());
    });
  };
  blocks.onChange = (f) => blocks.listeners.push(f);
  blocks.code = function () { loopN = 0; return G.workspaceToCode(blocks.ws); };
  blocks.save = () => BL.serialization.workspaces.save(blocks.ws);
  blocks.load = function (state) {
    blocks.loading = true;
    BL.Events.disable();
    try {
      blocks.ws.clear();
      if (state && state.blocks) BL.serialization.workspaces.load(state, blocks.ws);
      if (!blocks.ws.getTopBlocks(false).some((b) => b.type === 'iotf_main')) {
        const b = blocks.ws.newBlock('iotf_main'); b.initSvg(); b.render(); b.moveBy(30, 30);
      }
    } finally { BL.Events.enable(); blocks.loading = false; blocks.ws.clearUndo(); }
  };
  blocks.resize = () => blocks.ws && BL.svgResize(blocks.ws);
  blocks.refreshPins = function () { // board changed: re-render dropdown labels
    if (!blocks.ws) return;
    blocks.ws.getAllBlocks(false).forEach((b) => b.inputList.forEach((i) => i.fieldRow.forEach((f) => { if (f instanceof BL.FieldDropdown && f.forceRerender) f.forceRerender(); })));
  };
  blocks.isEmpty = () => !blocks.ws.getAllBlocks(false).some((b) => b.type !== 'iotf_main');
})();
