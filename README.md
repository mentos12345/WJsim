# ⚡ Wongjorn

โปรแกรมจำลองวงจร IoT แบบ Tinkercad/Wokwi ที่ทำงาน **ออฟไลน์ 100%** บน Windows, macOS และ Linux
มี 2 โหมด:

| | **Basic** | **Advanced** |
|---|---|---|
| อุปกรณ์ | 30 ชิ้นที่ต่อง่าย | ทั้งหมด 57 ชิ้น + บอร์ด 6 รุ่น |
| การต่อสาย | ลากลงมาแล้วต่อสายสัญญาณให้อัตโนมัติ ไฟเลี้ยง/กราวด์ต่อให้ในตัว | ต่อเองทุกเส้น ต้องต่อไฟเลี้ยง กราวด์ ตัวต้านทาน |
| เขียนโปรแกรม | Block ภาษาไทย (สร้างโค้ด C++ ให้ดูข้าง ๆ) | C++ แบบ Arduino |
| ตรวจวงจร | เตือนเฉพาะขาที่ยังไม่ได้ต่อ | เตือนไฟลัดวงจร ไม่ได้ต่อไฟเลี้ยง LED ไม่มีตัวต้านทาน ใช้ขาอินพุตอย่างเดียวผิด ฯลฯ |

## ฟีเจอร์

- **อุปกรณ์ 57 ชิ้น**: บอร์ด (ESP32, Uno, Nano, Mega, Nano RP2040 Connect, ATtiny85), เซ็นเซอร์ (DHT22, HC-SR04, PIR, LDR, MQ-2, เปลวไฟ, เสียง, NTC, ชีพจร, Tilt, MPU6050, pH, TDS, Load Cell), จอ (LCD 16×2/20×4, OLED, TFT, 7-segment), ไฟ/เสียง (LED, RGB, NeoPixel วงแหวน/เมทริกซ์, Bar graph, Buzzer), อินพุต (ปุ่ม, สวิตช์, Potentiometer, Joystick, Keypad, Encoder, DIP, รีโมท IR, Dialer), มอเตอร์ (Servo, Stepper), โมดูล (Relay 1/4 ช่อง, HX711, RFID RC522, GPS NEO-6M, LoRa SX1278, RTC, microSD, IR Receiver)
- **IoT ครบในแอป**: WiFi จำลอง, MQTT broker ในตัว, Dashboard (เกจ กราฟ สวิตช์ ปุ่ม แถบเลื่อน ไฟสถานะ ช่องส่งข้อความ), LoRa และ **หลายหน้าต่างคุยกันได้** (ไฟล์ → หน้าต่างใหม่) เพื่อจำลองหลายบอร์ด
- **ไลบรารีที่รองรับในโค้ด C++**: WiFi, PubSubClient, DHT, Servo/ESP32Servo, LiquidCrystal_I2C, Adafruit SSD1306 / ILI9341 / NeoPixel / MPU6050, HX711, MFRC522, TinyGPSPlus, LoRa, RTClib, SD, Keypad, Stepper, IRremote, attachInterrupt, tone, ledc (ESP32), Serial รับ-ส่ง
- Serial Monitor (พิมพ์ส่งเข้าได้), แท็บ LoRa, ไฟล์ใน SD card, ตัวอย่าง 13 โปรเจกต์, Undo/Redo, บันทึกเป็นไฟล์ `.iotf`, ส่งออกโค้ด `.ino` ไปใช้กับ Arduino IDE, บันทึกอัตโนมัติ

## เริ่มใช้งานจากซอร์สโค้ด

ต้องมี [Node.js](https://nodejs.org) 20 ขึ้นไป

```bash
npm install
npm start          # เปิดแอป
npm test           # ตรวจว่าโค้ดตัวอย่างแปลงได้ครบ
```

ถ้าไม่อยากติดตั้งอะไร เปิดไฟล์ `src/index.html` ด้วย Chrome/Edge ก็ใช้ได้เกือบครบ (ยกเว้นเมนูไฟล์ของระบบ) และอัปโหลดโฟลเดอร์ `src` ขึ้นเว็บโฮสติ้งแบบ static ได้ทันที

## สร้างไฟล์ติดตั้ง

```bash
npm run dist:win     # Windows: Wongjorn-Setup-x.y.z.exe และแบบ Portable
npm run dist:mac     # macOS: .dmg (ต้อง build บนเครื่อง Mac)
npm run dist:linux   # Linux: .AppImage
```

ไฟล์อยู่ในโฟลเดอร์ `dist/`

**สร้างครบทุกระบบอัตโนมัติด้วย GitHub Actions**: อัปโหลดโปรเจกต์ขึ้น GitHub แล้วสร้าง tag เช่น

```bash
git tag v1.0.0
git push origin v1.0.0
```

ระบบจะ build บน Windows, macOS และ Linux แล้วแนบไฟล์ติดตั้งไว้ในหน้า Releases ให้ (ดู `.github/workflows/build.yml`) จากนั้นนำลิงก์ Releases ไปใส่ในหน้าเว็บดาวน์โหลด

### เรื่องคำเตือนตอนเปิดแอปครั้งแรก
แอปยังไม่ได้ลงนามดิจิทัล (code signing) จึงมีคำเตือน:
- **Windows**: SmartScreen ขึ้นเตือน กด "More info" → "Run anyway"
- **macOS**: คลิกขวาที่แอป → Open หรือ System Settings → Privacy & Security → Open Anyway
ถ้าต้องการให้ไม่ขึ้นเตือน ต้องมี Apple Developer Program (macOS) และใบรับรอง code signing (Windows)

## โครงสร้างโปรเจกต์

```
electron/main.js      หน้าต่าง เมนู เปิด/บันทึกไฟล์ และส่งข้อความระหว่างหน้าต่าง
electron/preload.js   สะพานเชื่อมระหว่างหน้าแอปกับระบบ (หน้าแอปเข้าถึง Node ไม่ได้)
src/index.html        หน้าจอหลัก
src/js/parts.js       รายการอุปกรณ์ บอร์ด และภาพที่วาดเอง 7 ชิ้น
src/js/editor.js      พื้นที่ต่อวงจร สายไฟ การตรวจวงจร แผงคุณสมบัติ
src/js/transpile.js   แปลง C++ แบบ Arduino ให้รันในตัวจำลอง
src/js/runtime.js     ตัวจำลอง: คำสั่ง Arduino และไลบรารีทั้งหมด
src/js/iot.js         MQTT broker, Dashboard, LoRa
src/js/blocks.js      Block ภาษาไทยและตัวสร้างโค้ด C++
src/js/templates.js   ตัวอย่างโปรเจกต์
src/vendor/           ไลบรารีภายนอก (สร้างใหม่ได้ด้วย npm run vendor)
```

## เพิ่มอุปกรณ์ใหม่

1. เพิ่มบรรทัด `def('ชื่อ', {...})` ใน `src/js/parts.js` (ถ้าวาดเอง ให้เพิ่มใน `CUSTOM` พร้อมตำแหน่งขา)
2. ใส่ `level: 'basic'` ถ้าต่อได้ง่ายพอสำหรับโหมด Basic และกำหนด `sig` (ขาสัญญาณที่จะต่อให้อัตโนมัติ)
3. เขียนพฤติกรรมใน `runtime.js` (ถ้าเป็นเซ็นเซอร์อนาล็อก/ดิจิทัลทั่วไป ใช้ `kind` ที่มีอยู่แล้วได้เลย)

## ข้อจำกัด

- โค้ด C++ ถูกแปลงไปรันในตัวจำลอง ไม่ได้คอมไพล์จริง รองรับไวยากรณ์ Arduino ทั่วไป แต่ยังไม่รองรับ `struct`/`class`/`template` ที่เขียนเอง, pointer arithmetic และตัวแปร char ในการคำนวณบางแบบ
- ไม่ได้จำลองไฟฟ้าแบบละเอียด (กระแส แรงดันตก) ตรวจได้เฉพาะการต่อสายและระดับลอจิก
- ควรทดสอบกับบอร์ดจริงก่อนนำไปใช้งานจริงเสมอ

## เครดิต

ดู `CREDITS.md` — ภาพอุปกรณ์ 50 ชิ้นจาก wokwi-elements (MIT), 7 ชิ้นวาดขึ้นใหม่ (MIT), Blockly (Apache 2.0), CodeMirror (MIT), Electron (MIT)

## สัญญาอนุญาต

MIT — ดู `LICENSE`
