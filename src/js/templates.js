/* WJSIM — example projects */
(function () {
  'use strict';
  // tiny helpers to write Blockly JSON state
  const blk = (type, fields, inputs, extra) => Object.assign({ type }, fields ? { fields } : {}, inputs ? { inputs } : {}, extra || {});
  const seq = (list) => { if (!list.length) return undefined; const [h, ...t] = list; const b = Object.assign({}, h); const n = seq(t); if (n) b.next = { block: n }; return b; };
  const n = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const tx = (v) => ({ shadow: { type: 'text', fields: { TEXT: v } } });
  const inp = (b) => ({ block: b });
  const main = (setup, loop, vars) => ({
    blocks: { languageVersion: 0, blocks: [blk('iotf_main', null, Object.assign({}, setup.length ? { SETUP: inp(seq(setup)) } : {}, loop.length ? { LOOP: inp(seq(loop)) } : {}), { x: 30, y: 30, deletable: false })] },
    variables: (vars || []).map((v) => ({ name: v, id: 'v_' + v }))
  });
  const dw = (pin, st) => blk('iotf_digital_write', { PIN: String(pin), STATE: st });
  const wait = (ms) => blk('iotf_delay', null, { MS: n(ms) });
  const setv = (name, value) => blk('variables_set', { VAR: { id: 'v_' + name } }, { VALUE: inp(value) });
  const getv = (name) => blk('variables_get', { VAR: { id: 'v_' + name } });
  const print = (value) => blk('iotf_serial_print', { NL: 'TRUE' }, { VALUE: inp(value) });
  const join = (...items) => blk('text_join', null, Object.fromEntries(items.map((it, i) => ['ADD' + i, typeof it === 'string' ? tx(it) : inp(it)])), { extraState: { itemCount: items.length } });
  const ifElse = (cond, then, els) => blk('controls_if', null, Object.assign({ IF0: inp(cond), DO0: inp(seq(then)) }, els ? { ELSE: inp(seq(els)) } : {}), els ? { extraState: { hasElse: true } } : undefined);
  const cmp = (a, op, b) => blk('logic_compare', { OP: op }, { A: inp(a), B: inp(b) });
  const num = (v) => blk('math_number', { NUM: v });

  const T = [];
  // ---------------- Basic ----------------
  T.push({
    id: 'blink', mode: 'basic', board: 'esp32', title: 'ไฟกระพริบ', desc: 'โปรเจกต์แรก: LED ติด-ดับทุกครึ่งวินาที',
    parts: [{ id: 'led1', type: 'led', x: 220, y: 70 }],
    wires: [['led1', 'A', 'D2']],
    blocks: main([], [dw(2, 'HIGH'), wait(500), dw(2, 'LOW'), wait(500)])
  });
  T.push({
    id: 'button', mode: 'basic', board: 'esp32', title: 'กดปุ่มเปิดไฟ', desc: 'กดปุ่มค้างไว้แล้ว LED ติด ปล่อยแล้วดับ',
    parts: [{ id: 'led1', type: 'led', x: 230, y: 40 }, { id: 'btn1', type: 'pushbutton', x: 220, y: 150 }],
    wires: [['led1', 'A', 'D2'], ['btn1', '1.l', 'D4']],
    blocks: main([], [ifElse(blk('iotf_button', { PIN: '4' }), [dw(2, 'HIGH')], [dw(2, 'LOW')]), wait(20)])
  });
  T.push({
    id: 'dht-dash', mode: 'basic', board: 'esp32', title: 'วัดอุณหภูมิส่งขึ้น Dashboard', desc: 'DHT22 + OLED + WiFi/MQTT แสดงค่าบนจอและบน Dashboard',
    parts: [{ id: 'dht1', type: 'dht22', x: 230, y: 20 }, { id: 'oled1', type: 'ssd1306', x: 220, y: 150 }],
    wires: [['dht1', 'SDA', 'D15'], ['oled1', 'DATA', 'D21'], ['oled1', 'CLK', 'D22']],
    blocks: main([blk('iotf_wifi', { SSID: 'WJSIM-WiFi', PASS: '' })], [
      setv('temp', blk('iotf_dht', { WHAT: 'T', PIN: '15' })),
      setv('hum', blk('iotf_dht', { WHAT: 'H', PIN: '15' })),
      blk('iotf_oled_clear'),
      blk('iotf_oled_print', { X: 0, Y: 0, S: 2 }, { TEXT: inp(join('T ', getv('temp'), ' C')) }),
      blk('iotf_oled_print', { X: 0, Y: 30, S: 2 }, { TEXT: inp(join('H ', getv('hum'), ' %')) }),
      blk('iotf_mqtt_publish', { TOPIC: 'wjsim/temp' }, { VALUE: inp(getv('temp')) }),
      blk('iotf_mqtt_publish', { TOPIC: 'wjsim/humidity' }, { VALUE: inp(getv('hum')) }),
      print(join('อุณหภูมิ ', getv('temp'), ' °C  ความชื้น ', getv('hum'), ' %')),
      wait(2000)
    ], ['temp', 'hum']),
    widgets: [{ type: 'gauge', title: 'อุณหภูมิ', topic: 'wjsim/temp', unit: '°C', min: 0, max: 50 }, { type: 'value', title: 'ความชื้น', topic: 'wjsim/humidity', unit: '%', chart: true }]
  });
  T.push({
    id: 'distance', mode: 'basic', board: 'esp32', title: 'เตือนเมื่อมีของเข้าใกล้', desc: 'HC-SR04 วัดระยะ ถ้าใกล้กว่า 20 cm ให้ buzzer ดังและไฟแดงติด',
    parts: [{ id: 'hc1', type: 'hc-sr04', x: 220, y: 20 }, { id: 'bz1', type: 'buzzer', x: 240, y: 130 }, { id: 'led1', type: 'led', x: 340, y: 140 }],
    wires: [['hc1', 'TRIG', 'D5'], ['hc1', 'ECHO', 'D18'], ['bz1', '2', 'D19'], ['led1', 'A', 'D2']],
    blocks: main([], [
      setv('dist', blk('iotf_ultrasonic', { T: '5', E: '18' })),
      print(join('ระยะ ', getv('dist'), ' cm')),
      ifElse(cmp(getv('dist'), 'LT', num(20)), [blk('iotf_tone', { PIN: '19' }, { FREQ: n(1500), MS: n(150) }), dw(2, 'HIGH')], [blk('iotf_notone', { PIN: '19' }), dw(2, 'LOW')]),
      wait(250)
    ], ['dist'])
  });
  T.push({
    id: 'servo-pot', mode: 'basic', board: 'uno', title: 'หมุนลูกบิดคุม Servo', desc: 'Arduino Uno: หมุน Potentiometer แล้ว Servo หมุนตาม',
    parts: [{ id: 'pot1', type: 'potentiometer', x: 330, y: 30 }, { id: 'sv1', type: 'servo', x: 320, y: 130 }],
    wires: [['pot1', 'SIG', 'A0'], ['sv1', 'PWM', '9']],
    blocks: main([], [blk('iotf_servo', { PIN: '9' }, { ANGLE: inp(blk('iotf_map', { A: 0, B: 1023, C: 0, D: 180 }, { V: inp(blk('iotf_analog_read', { PIN: 'A0' })) })) }), wait(20)])
  });
  T.push({
    id: 'water', mode: 'basic', board: 'esp32', title: 'ตรวจคุณภาพน้ำ (pH + TDS)', desc: 'อ่านค่า pH และ TDS แสดงบน LCD และส่งขึ้น Dashboard',
    parts: [{ id: 'ph1', type: 'iotf-ph', x: 220, y: 0 }, { id: 'tds1', type: 'iotf-tds', x: 220, y: 120 }, { id: 'lcd1', type: 'lcd1602', x: 210, y: 230 }],
    wires: [['ph1', 'Po', 'D34'], ['tds1', 'A', 'D35'], ['lcd1', 'SDA', 'D21'], ['lcd1', 'SCL', 'D22']],
    blocks: main([blk('iotf_wifi', { SSID: 'WJSIM-WiFi', PASS: '' })], [
      setv('ph', blk('iotf_ph', { PIN: '34' })), setv('tds', blk('iotf_tds', { PIN: '35' })),
      blk('iotf_lcd_clear'),
      blk('iotf_lcd_print', { ROW: 0, COL: 0 }, { TEXT: inp(join('pH  ', getv('ph'))) }),
      blk('iotf_lcd_print', { ROW: 1, COL: 0 }, { TEXT: inp(join('TDS ', getv('tds'), ' ppm')) }),
      blk('iotf_mqtt_publish', { TOPIC: 'water/ph' }, { VALUE: inp(getv('ph')) }),
      blk('iotf_mqtt_publish', { TOPIC: 'water/tds' }, { VALUE: inp(getv('tds')) }),
      wait(2000)
    ], ['ph', 'tds']),
    widgets: [{ type: 'gauge', title: 'pH', topic: 'water/ph', min: 0, max: 14 }, { type: 'gauge', title: 'TDS', topic: 'water/tds', unit: 'ppm', min: 0, max: 1000 }]
  });
  T.push({
    id: 'neopixel', mode: 'basic', board: 'esp32', title: 'ไฟวงแหวน NeoPixel', desc: 'ไล่สีไฟทีละดวงรอบวงแหวน 16 ดวง',
    parts: [{ id: 'ring1', type: 'led-ring', x: 230, y: 40 }],
    wires: [['ring1', 'DIN', 'D4']],
    blocks: main([], [
      blk('controls_for', { VAR: { id: 'v_i' } }, { FROM: n(0), TO: n(15), BY: n(1), DO: inp(seq([
        blk('iotf_neopixel_fill', { PIN: '4', N: 16, C: '0,0,0' }),
        blk('iotf_neopixel', { PIN: '4', N: 16, C: '0,200,255' }, { I: inp(getv('i')) }),
        wait(80)
      ])) })
    ], ['i'])
  });

  // ---------------- Advanced ----------------
  T.push({
    id: 'smarthome', mode: 'advanced', board: 'esp32', power: true, title: 'Smart Home ผ่าน MQTT', desc: 'คุม Relay 4 ช่องจาก Dashboard + ส่งอุณหภูมิ/ความชื้น + จอ LCD',
    parts: [{ id: 'dht1', type: 'dht22', x: 230, y: -10 }, { id: 'rl1', type: 'iotf-relay4', x: 230, y: 110 }, { id: 'lcd1', type: 'lcd1602', x: 220, y: 310 }],
    wires: [['dht1', 'SDA', 'D15'], ['rl1', 'IN1', 'D26'], ['rl1', 'IN2', 'D27'], ['rl1', 'IN3', 'D14'], ['rl1', 'IN4', 'D13'], ['lcd1', 'SDA', 'D21'], ['lcd1', 'SCL', 'D22']],
    widgets: [1, 2, 3, 4].map((i) => ({ type: 'switch', title: 'ไฟห้อง ' + i, topic: 'home/relay/' + i, on: '1', off: '0' }))
      .concat([{ type: 'gauge', title: 'อุณหภูมิ', topic: 'home/temp', unit: '°C', min: 0, max: 50 }, { type: 'value', title: 'ความชื้น', topic: 'home/hum', unit: '%', chart: true }]),
    code: `#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <LiquidCrystal_I2C.h>

const char* ssid = "WJSIM-WiFi";
const char* password = "";
const char* broker = "broker.hivemq.com";

const int relayPins[4] = {26, 27, 14, 13};   // relay ทำงานเมื่อได้ LOW
DHT dht(15, DHT22);
LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastSend = 0;

void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  String t = String(topic);
  for (int i = 0; i < 4; i++) {
    if (t == "home/relay/" + String(i + 1)) {
      digitalWrite(relayPins[i], msg == "1" ? LOW : HIGH);
      Serial.printf("Relay %d -> %s\\n", i + 1, msg == "1" ? "ON" : "OFF");
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting MQTT...");
    if (client.connect("smart-home-esp32")) {
      Serial.println("ok");
      client.subscribe("home/relay/+");
    } else {
      delay(1000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 4; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], HIGH);
  }
  dht.begin();
  lcd.init();
  lcd.backlight();
  lcd.print("Connecting WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  client.setServer(broker, 1883);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();
  if (millis() - lastSend > 2000) {
    lastSend = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    client.publish("home/temp", String(t, 1).c_str());
    client.publish("home/hum", String(h, 0).c_str());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Temp: " + String(t, 1) + " C");
    lcd.setCursor(0, 1);
    lcd.print("Hum:  " + String(h, 0) + " %");
  }
}
`
  });
  T.push({
    id: 'rfid', mode: 'advanced', board: 'esp32', power: true, title: 'ประตูล็อกด้วยบัตร RFID', desc: 'RC522 + Servo + Buzzer: แตะบัตรที่ถูกต้องแล้วประตูเปิด 3 วินาที',
    parts: [{ id: 'rf1', type: 'iotf-rc522', x: 230, y: 0 }, { id: 'sv1', type: 'servo', x: 240, y: 190 }, { id: 'bz1', type: 'buzzer', x: 440, y: 190 }],
    wires: [['rf1', 'SDA', 'D5'], ['rf1', 'SCK', 'D18'], ['rf1', 'MOSI', 'D23'], ['rf1', 'MISO', 'D19'], ['rf1', 'RST', 'D4'], ['sv1', 'PWM', 'D13'], ['bz1', '2', 'D12']],
    code: `#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>

#define SS_PIN 5
#define RST_PIN 4
#define SERVO_PIN 13
#define BUZZER_PIN 12

MFRC522 rfid(SS_PIN, RST_PIN);
Servo door;
byte allowed[4] = {0xDE, 0xAD, 0xBE, 0xEF};   // บัตรที่อนุญาต

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  door.attach(SERVO_PIN);
  door.write(0);
  Serial.println("แตะบัตรได้เลย (คลิก RC522 แล้วกด แตะบัตร)");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  Serial.print("UID:");
  bool ok = rfid.uid.size == 4;
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(" ");
    Serial.print(rfid.uid.uidByte[i], HEX);
    if (i < 4 && rfid.uid.uidByte[i] != allowed[i]) ok = false;
  }
  Serial.println();
  if (ok) {
    Serial.println("✔ เปิดประตู");
    tone(BUZZER_PIN, 2000, 150);
    door.write(90);
    delay(3000);
    door.write(0);
  } else {
    Serial.println("✖ บัตรไม่ถูกต้อง");
    tone(BUZZER_PIN, 300, 600);
  }
  rfid.PICC_HaltA();
}
`
  });
  T.push({
    id: 'lora', mode: 'advanced', board: 'esp32', power: true, title: 'ส่งข้อมูลทางไกลด้วย LoRa', desc: 'SX1278 ส่งอุณหภูมิทุก 3 วินาที และรับแพ็กเก็ตที่ส่งเข้ามา (ลองพิมพ์ในแท็บ LoRa)',
    parts: [{ id: 'lr1', type: 'iotf-sx1278', x: 240, y: 0 }, { id: 'dht1', type: 'dht22', x: 380, y: 30 }],
    wires: [['lr1', 'NSS', 'D5'], ['lr1', 'SCK', 'D18'], ['lr1', 'MOSI', 'D23'], ['lr1', 'MISO', 'D19'], ['lr1', 'RST', 'D14'], ['lr1', 'DIO0', 'D2'], ['dht1', 'SDA', 'D15']],
    code: `#include <SPI.h>
#include <LoRa.h>
#include <DHT.h>

DHT dht(15, DHT22);
int counter = 0;
unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  dht.begin();
  LoRa.setPins(5, 14, 2);
  if (!LoRa.begin(433E6)) {
    Serial.println("Starting LoRa failed!");
    while (true) delay(1000);
  }
  Serial.println("LoRa ready");
}

void loop() {
  if (millis() - lastSend > 3000) {
    lastSend = millis();
    String msg = "#" + String(counter++) + " T=" + String(dht.readTemperature(), 1) + " H=" + String(dht.readHumidity(), 0);
    LoRa.beginPacket();
    LoRa.print(msg);
    LoRa.endPacket();
    Serial.println("Sent: " + msg);
  }
  int size = LoRa.parsePacket();
  if (size) {
    String rx = "";
    while (LoRa.available()) rx += (char)LoRa.read();
    Serial.print("Received: ");
    Serial.print(rx);
    Serial.print("  RSSI ");
    Serial.println(LoRa.packetRssi());
  }
}
`
  });
  T.push({
    id: 'gps', mode: 'advanced', board: 'esp32', power: true, title: 'GPS Tracker', desc: 'NEO-6M ผ่าน Serial2 แสดงพิกัดบน OLED และส่งขึ้น MQTT',
    parts: [{ id: 'gps1', type: 'iotf-neo6m', x: 240, y: 10 }, { id: 'oled1', type: 'ssd1306', x: 230, y: 150 }],
    wires: [['gps1', 'TX', 'RX2'], ['gps1', 'RX', 'TX2'], ['oled1', 'DATA', 'D21'], ['oled1', 'CLK', 'D22']],
    widgets: [{ type: 'value', title: 'ตำแหน่ง', topic: 'tracker/location' }, { type: 'value', title: 'ดาวเทียม', topic: 'tracker/sats' }],
    code: `#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_SSD1306.h>

TinyGPSPlus gps;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
WiFiClient net;
PubSubClient mqtt(net);
unsigned long last = 0;

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.setTextColor(SSD1306_WHITE);
  WiFi.begin("WJSIM-WiFi", "");
  while (WiFi.status() != WL_CONNECTED) delay(300);
  mqtt.setServer("broker.hivemq.com", 1883);
}

void loop() {
  while (Serial2.available() > 0) gps.encode(Serial2.read());
  if (!mqtt.connected()) mqtt.connect("gps-tracker");
  mqtt.loop();
  if (millis() - last > 1000) {
    last = millis();
    display.clearDisplay();
    display.setCursor(0, 0);
    display.setTextSize(1);
    if (gps.location.isValid()) {
      display.println("GPS FIX");
      display.print("Lat: "); display.println(gps.location.lat(), 5);
      display.print("Lng: "); display.println(gps.location.lng(), 5);
      String loc = String(gps.location.lat(), 5) + "," + String(gps.location.lng(), 5);
      mqtt.publish("tracker/location", loc.c_str());
      Serial.println(loc);
    } else {
      display.println("Searching...");
    }
    display.print("Sats: "); display.println(gps.satellites.value());
    mqtt.publish("tracker/sats", String(gps.satellites.value()).c_str());
    display.display();
  }
}
`
  });
  T.push({
    id: 'scale', mode: 'advanced', board: 'esp32', power: true, title: 'เครื่องชั่งน้ำหนัก', desc: 'HX711 + Load cell แสดงน้ำหนักบน LCD 16×2 (ปรับน้ำหนักในแผงคุณสมบัติของ HX711)',
    parts: [{ id: 'hx1', type: 'hx711', x: 230, y: 10 }, { id: 'lcd1', type: 'lcd1602', x: 220, y: 200 }],
    wires: [['hx1', 'DT', 'D4'], ['hx1', 'SCK', 'D5'], ['lcd1', 'SDA', 'D21'], ['lcd1', 'SCL', 'D22']],
    code: `#include <HX711.h>
#include <LiquidCrystal_I2C.h>

HX711 scale;
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  lcd.init();
  lcd.backlight();
  scale.begin(4, 5);
  scale.set_scale(420.0);   // ค่าคาลิเบรต
  scale.tare();
  lcd.print("Scale ready");
}

void loop() {
  float grams = scale.get_units(5);
  if (grams < 0) grams = 0;
  lcd.setCursor(0, 0);
  lcd.print("Weight:         ");
  lcd.setCursor(0, 1);
  lcd.print(String(grams, 0) + " g          ");
  Serial.printf("%.1f g\\n", grams);
  delay(500);
}
`
  });
  T.push({
    id: 'tilt', mode: 'advanced', board: 'esp32', power: true, title: 'ตรวจจับการเอียง/ล้ม (MPU6050)', desc: 'อ่านค่า Accel/Gyro เตือนด้วย NeoPixel เมื่อเอียงมาก (ปรับค่าในแผงคุณสมบัติ)',
    parts: [{ id: 'mpu1', type: 'mpu6050', x: 240, y: 20 }, { id: 'ring1', type: 'led-ring', x: 240, y: 140 }],
    wires: [['mpu1', 'SDA', 'D21'], ['mpu1', 'SCL', 'D22'], ['ring1', 'DIN', 'D4']],
    code: `#include <Adafruit_MPU6050.h>
#include <Adafruit_NeoPixel.h>

Adafruit_MPU6050 mpu;
Adafruit_NeoPixel ring(16, 4, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  ring.begin();
  if (!mpu.begin()) {
    Serial.println("ไม่พบ MPU6050");
    while (1) delay(10);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  float tilt = atan2(sqrt(a.acceleration.x * a.acceleration.x + a.acceleration.y * a.acceleration.y), a.acceleration.z) * 180 / PI;
  Serial.printf("tilt %.1f deg\\n", tilt);
  uint32_t color = tilt > 45 ? ring.Color(255, 0, 0) : tilt > 20 ? ring.Color(255, 150, 0) : ring.Color(0, 200, 60);
  ring.fill(color);
  ring.show();
  delay(200);
}
`
  });

  // ---------------- several boards talking to each other ----------------
  const nowSend = (value, to) => blk('iotf_now_send', { TO: to || 'ALL' }, { VALUE: inp(value) });
  T.push({
    id: 'now-button', mode: 'basic', board: 'esp32', title: 'ESP32 สองตัว: กดปุ่มที่ตัวหนึ่ง ไฟติดอีกตัว',
    desc: 'ESP32 #1 ส่งสถานะปุ่มแบบไร้สาย (ESP-NOW) ไปให้ ESP32 #2 เปิด-ปิด LED',
    parts: [{ id: 'btn1', type: 'pushbutton', x: 230, y: 120 }, { id: 'led1', type: 'led', x: 760, y: 70 }],
    boards: [{ id: 'board2', board: 'esp32', name: 'ESP32 #2', x: 560, y: 40,
      blocks: main([], [ifElse(blk('iotf_now_new'), [
        ifElse(cmp(blk('iotf_now_number'), 'EQ', num(1)), [dw(2, 'HIGH')], [dw(2, 'LOW')]),
        print(join('ได้รับ ', blk('iotf_now_text')))
      ]), wait(10)]) }],
    wires: [['btn1', '1.l', 'D4'], ['led1', 'A', 'D2', 'board2']],
    blocks: main([], [ifElse(blk('iotf_button', { PIN: '4' }), [nowSend(num(1))], [nowSend(num(0))]), wait(100)])
  });
  T.push({
    id: 'now-temp', mode: 'basic', board: 'esp32', title: 'ESP32 สองตัว: ส่งอุณหภูมิไปโชว์อีกเครื่อง',
    desc: 'ESP32 #1 อ่าน DHT22 แล้วส่งไร้สายไปให้ ESP32 #2 แสดงบนจอ LCD',
    parts: [{ id: 'dht1', type: 'dht22', x: 230, y: 40 }, { id: 'lcd1', type: 'lcd1602', x: 740, y: 60 }],
    boards: [{ id: 'board2', board: 'esp32', name: 'ESP32 #2', x: 560, y: 40,
      blocks: main([blk('iotf_lcd_print', { ROW: 0, COL: 0 }, { TEXT: inp(blk('text', { TEXT: 'Waiting...' })) })], [ifElse(blk('iotf_now_new'), [
        blk('iotf_lcd_clear'),
        blk('iotf_lcd_print', { ROW: 0, COL: 0 }, { TEXT: inp(blk('text', { TEXT: 'From ESP32 #1' })) }),
        blk('iotf_lcd_print', { ROW: 1, COL: 0 }, { TEXT: inp(join('Temp ', blk('iotf_now_text'), ' C')) })
      ]), wait(50)]) }],
    wires: [['dht1', 'SDA', 'D15'], ['lcd1', 'SDA', 'D21', 'board2'], ['lcd1', 'SCL', 'D22', 'board2']],
    blocks: main([], [setv('temp', blk('iotf_dht', { WHAT: 'T', PIN: '15' })), nowSend(getv('temp')), print(join('ส่ง ', getv('temp'))), wait(2000)], ['temp'])
  });
  T.push({
    id: 'now-struct', mode: 'advanced', board: 'esp32', power: true, title: 'ESP-NOW ส่ง struct ไปหาบอร์ดที่ระบุ',
    desc: 'C++: ESP32 #1 ส่งค่าลูกบิดและปุ่มเป็น struct ไปที่ MAC ของ ESP32 #2 แล้วคุม Servo กับ LED',
    parts: [{ id: 'pot1', type: 'potentiometer', x: 230, y: 20 }, { id: 'btn1', type: 'pushbutton', x: 230, y: 150 }, { id: 'sv1', type: 'servo', x: 750, y: 30 }, { id: 'led1', type: 'led', x: 770, y: 160 }],
    boards: [{ id: 'board2', board: 'esp32', name: 'ESP32 #2', x: 560, y: 40, code: `// ESP32 #2 — ตัวรับ (MAC 24:0A:C4:00:00:02)
#include <WiFi.h>
#include <esp_now.h>
#include <ESP32Servo.h>

typedef struct {
  int knob;
  bool pressed;
  unsigned long count;
} Message;

Message msg;
Servo servo;
bool fresh = false;

void onRecv(const uint8_t *mac, const uint8_t *data, int len) {
  memcpy(&msg, data, sizeof(msg));
  fresh = true;
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  servo.attach(13);
  WiFi.mode(WIFI_STA);
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed");
    return;
  }
  esp_now_register_recv_cb(onRecv);
}

void loop() {
  if (fresh) {
    fresh = false;
    servo.write(map(msg.knob, 0, 4095, 0, 180));
    digitalWrite(2, msg.pressed ? HIGH : LOW);
    Serial.printf("#%lu knob=%d pressed=%d\\n", msg.count, msg.knob, msg.pressed);
  }
  delay(10);
}
` }],
    wires: [['pot1', 'SIG', 'D34'], ['btn1', '1.l', 'D4'], ['sv1', 'PWM', 'D13', 'board2'], ['led1', 'A', 'D2', 'board2']],
    code: `// ESP32 #1 — ตัวส่ง (MAC 24:0A:C4:00:00:01)
#include <WiFi.h>
#include <esp_now.h>

// MAC ของ ESP32 #2 (ดูได้จากแผงคุณสมบัติของบอร์ด)
uint8_t receiver[] = {0x24, 0x0A, 0xC4, 0x00, 0x00, 0x02};

typedef struct {
  int knob;
  bool pressed;
  unsigned long count;
} Message;

Message msg;
esp_now_peer_info_t peer;

void onSent(const uint8_t *mac, esp_now_send_status_t status) {
  if (status != ESP_NOW_SEND_SUCCESS) Serial.println("ส่งไม่สำเร็จ");
}

void setup() {
  Serial.begin(115200);
  pinMode(4, INPUT_PULLUP);
  WiFi.mode(WIFI_STA);
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed");
    return;
  }
  esp_now_register_send_cb(onSent);
  memcpy(peer.peer_addr, receiver, 6);
  peer.channel = 0;
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}

void loop() {
  msg.knob = analogRead(34);
  msg.pressed = digitalRead(4) == LOW;
  msg.count++;
  esp_now_send(receiver, (uint8_t *) &msg, sizeof(msg));
  delay(200);
}
`
  });
  T.push({
    id: 'http-relay', mode: 'advanced', board: 'esp32', power: true, title: 'ESP32 สั่งงานอีกตัวผ่าน WiFi (HTTP)',
    desc: 'ESP32 #2 เป็น Web Server คุม Relay ส่วน ESP32 #1 กดปุ่มแล้วส่ง HTTP GET ไปเปิด-ปิด ลองเปิด http://192.168.1.102/ ในแท็บ Dashboard ได้ด้วย',
    parts: [{ id: 'btn1', type: 'pushbutton', x: 230, y: 120 }, { id: 'rl1', type: 'iotf-relay4', x: 750, y: 40 }, { id: 'led1', type: 'led', x: 770, y: 250 }],
    boards: [{ id: 'board2', board: 'esp32', name: 'ESP32 #2', x: 560, y: 40, code: `// ESP32 #2 — Web Server ที่ 192.168.1.102
#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);
bool relayOn = false;

void apply() {
  digitalWrite(26, relayOn ? HIGH : LOW);
  digitalWrite(2, relayOn ? HIGH : LOW);
}

void handleRoot() {
  server.send(200, "text/plain", String("relay=") + (relayOn ? "on" : "off"));
}

void handleSet() {
  if (server.hasArg("state")) relayOn = server.arg("state") == "on";
  else relayOn = !relayOn;
  apply();
  Serial.println(String("จาก ") + server.client().remoteIP().toString() + " -> " + (relayOn ? "ON" : "OFF"));
  server.send(200, "text/plain", relayOn ? "on" : "off");
}

void setup() {
  Serial.begin(115200);
  pinMode(26, OUTPUT);
  pinMode(2, OUTPUT);
  WiFi.begin("WJSIM-WiFi", "");
  while (WiFi.status() != WL_CONNECTED) delay(200);
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  server.on("/", handleRoot);
  server.on("/toggle", handleSet);
  server.begin();
}

void loop() {
  server.handleClient();
}
` }],
    wires: [['btn1', '1.l', 'D4'], ['rl1', 'IN1', 'D26', 'board2'], ['led1', 'A', 'D2', 'board2']],
    code: `// ESP32 #1 — กดปุ่มแล้วสั่ง ESP32 #2 ผ่าน HTTP
#include <WiFi.h>
#include <HTTPClient.h>

const char* target = "http://192.168.1.102/toggle";
bool last = HIGH;

void setup() {
  Serial.begin(115200);
  pinMode(4, INPUT_PULLUP);
  WiFi.begin("WJSIM-WiFi", "");
  while (WiFi.status() != WL_CONNECTED) delay(200);
  Serial.println("WiFi พร้อม กดปุ่มเพื่อสั่ง relay");
}

void loop() {
  bool now = digitalRead(4);
  if (last == HIGH && now == LOW) {
    HTTPClient http;
    http.begin(target);
    int code = http.GET();
    if (code > 0) Serial.println("relay: " + http.getString());
    else Serial.println("ส่งไม่สำเร็จ " + String(code));
    http.end();
  }
  last = now;
  delay(20);
}
`
  });

  // ---------------- IoT Cloud (Arduino Cloud style) ----------------
  const cset = (name, value) => blk('iotf_cloud_set', { NAME: name }, { VALUE: inp(value) });
  T.push({
    id: 'cloud-basic', mode: 'basic', board: 'esp32', title: 'IoT Cloud: ส่งอุณหภูมิขึ้นคลาวด์ + สั่งไฟจากคลาวด์',
    desc: 'แบบ Arduino Cloud: DHT22 ส่งค่าขึ้นตัวแปรคลาวด์ และกดสวิตช์บน Dashboard คลาวด์เพื่อเปิด-ปิด LED',
    parts: [{ id: 'dht1', type: 'dht22', x: 230, y: 20 }, { id: 'led1', type: 'led', x: 240, y: 170 }],
    wires: [['dht1', 'SDA', 'D15'], ['led1', 'A', 'D2']],
    cloud: {
      vars: [{ name: 'temperature', type: 'float', perm: 'READ' }, { name: 'humidity', type: 'float', perm: 'READ' }, { name: 'led', type: 'bool' }],
      widgets: [{ type: 'gauge', var: 'temperature', title: 'อุณหภูมิ', unit: '°C', min: 0, max: 50 }, { type: 'switch', var: 'led', title: 'ไฟ LED' }, { type: 'status', var: 'led', title: 'สถานะไฟ' }, { type: 'chart', var: 'humidity', title: 'ความชื้น', unit: '%' }]
    },
    blocks: main([], [
      cset('temperature', blk('iotf_dht', { WHAT: 'T', PIN: '15' })),
      cset('humidity', blk('iotf_dht', { WHAT: 'H', PIN: '15' })),
      ifElse(blk('iotf_cloud_get', { NAME: 'led' }), [dw(2, 'HIGH')], [dw(2, 'LOW')]),
      ifElse(blk('iotf_cloud_changed', { NAME: 'led' }), [print(join('คลาวด์สั่งไฟ: ', blk('iotf_cloud_get', { NAME: 'led' })))]),
      wait(200)
    ])
  });
  T.push({
    id: 'cloud-two', mode: 'advanced', board: 'esp32', power: true, title: 'IoT Cloud: ESP32 สองตัวส่งข้อมูลหากันผ่านคลาวด์',
    desc: 'C++ แบบ Arduino Cloud: ESP32 #1 หมุนลูกบิด/กดปุ่ม → ตัวแปรคลาวด์ → ESP32 #2 หมุน Servo และเปิดไฟ (สั่งจาก Dashboard ได้ด้วย)',
    parts: [{ id: 'pot1', type: 'potentiometer', x: 230, y: 20 }, { id: 'btn1', type: 'pushbutton', x: 230, y: 150 }, { id: 'sv1', type: 'servo', x: 750, y: 30 }, { id: 'led1', type: 'led', x: 770, y: 160 }],
    cloud: {
      vars: [{ name: 'angle', type: 'int' }, { name: 'alarm', type: 'bool' }, { name: 'message', type: 'String' }],
      widgets: [{ type: 'slider', var: 'angle', title: 'มุม Servo', unit: '°', min: 0, max: 180 }, { type: 'status', var: 'alarm', title: 'ปุ่มที่ ESP32 #1' }, { type: 'messenger', var: 'message', title: 'ข้อความ' }, { type: 'chart', var: 'angle', title: 'มุมย้อนหลัง' }]
    },
    boards: [{ id: 'board2', board: 'esp32', name: 'ESP32 #2', x: 560, y: 40, code: `/*
  ESP32 #2 — รับค่าจากคลาวด์
  ตัวแปรคลาวด์ (ดูแท็บ คลาวด์): int angle; bool alarm; String message;
*/
#include "thingProperties.h"
#include <ESP32Servo.h>

Servo servo;

void setup() {
  Serial.begin(9600);
  delay(1500);
  servo.attach(13);
  pinMode(2, OUTPUT);

  initProperties();
  ArduinoCloud.begin(ArduinoIoTPreferredConnection);
  setDebugMessageLevel(2);
}

void loop() {
  ArduinoCloud.update();
  delay(20);
}

// เรียกเมื่อ angle ถูกเปลี่ยนจากคลาวด์ (ESP32 #1 หรือ Dashboard)
void onAngleChange() {
  servo.write(angle);
  Serial.println("มุมใหม่จากคลาวด์: " + String(angle));
}

void onAlarmChange() {
  digitalWrite(2, alarm ? HIGH : LOW);
}

void onMessageChange() {
  Serial.println("ข้อความ: " + message);
  message = "ESP32 #2 ได้รับแล้ว";
}
` }],
    wires: [['pot1', 'SIG', 'D34'], ['btn1', '1.l', 'D4'], ['sv1', 'PWM', 'D13', 'board2'], ['led1', 'A', 'D2', 'board2']],
    code: `/*
  ESP32 #1 — ส่งค่าขึ้นคลาวด์ (รูปแบบเดียวกับ Arduino Cloud)
  ตัวแปรคลาวด์ (ดูแท็บ คลาวด์): int angle; bool alarm; String message;
*/
#include "thingProperties.h"

int lastKnob = -1;

void setup() {
  Serial.begin(9600);
  delay(1500);
  pinMode(4, INPUT_PULLUP);

  initProperties();
  ArduinoCloud.begin(ArduinoIoTPreferredConnection);
  setDebugMessageLevel(2);
  ArduinoCloud.printDebugInfo();
}

void loop() {
  ArduinoCloud.update();
  int k = map(analogRead(34), 0, 4095, 0, 180);
  if (abs(k - lastKnob) > 2) { // ส่งเมื่อหมุนลูกบิดจริง ๆ
    lastKnob = k;
    angle = k;
  }
  alarm = digitalRead(4) == LOW;
  delay(50);
}

void onAngleChange() {
  Serial.println("Dashboard ตั้งมุมเป็น " + String(angle));
}

void onMessageChange() {
  Serial.println("ข้อความในคลาวด์: " + message);
}
`
  });

  IOTF.TEMPLATES = T;
})();
