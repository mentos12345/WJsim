// Quick check that every example's C++ passes the transpiler: `npm test`
'use strict';
global.window = global; global.IOTF = {};
require('../src/js/transpile.js');
require('../src/js/templates.js');
let bad = 0;
for (const t of IOTF.TEMPLATES) {
  if (!t.code) continue;
  try { IOTF.transpile(t.code); console.log('ok  ', t.id); } catch (e) { bad++; console.log('FAIL', t.id, 'line', e.line, e.message); }
}
// regressions
const cases = [
  ['await before member access', 'String f(String a){ return a; }\nvoid setup(){}\nvoid loop(){ float x = f(f("1").substring(0)).toFloat(); }', '(await f((await f("1")).substring(0))).toFloat()'],
  ['struct init', 'typedef struct { int a; float b; } M;\nM m = {1, 2.5};\nvoid setup(){}\nvoid loop(){}', 'Object.assign(new M(), {a: 1, b: 2.5})'],
  ['number suffixes', 'void setup(){ long a = 2048L; unsigned long b = 1000UL; int c = 0xFFul; float d = 1.5f; float e = .5f; byte f = 0xEF; }\nvoid loop(){}', 'let a = __int(2048); let b = __int(1000); let c = __int(0xFF); let d = 1.5; let e = .5; let f = __int(0xEF);'],
  ['AccelStepper::DRIVER', '#include <AccelStepper.h>\nAccelStepper s(AccelStepper::DRIVER, 2, 3);\nvoid setup(){}\nvoid loop(){ s.runToPosition(); }', 'await s.runToPosition()'],
  ['PMS::DATA', '#include <PMS.h>\nPMS pms(Serial2);\nPMS::DATA d;\nvoid setup(){}\nvoid loop(){ pms.read(d); }', 'new PMS_DATA()'],
  ['Arduino Cloud types', 'CloudSwitch lamp;\nCloudTemperatureSensor t;\nvoid setup(){ ArduinoCloud.addProperty(lamp, READWRITE, ON_CHANGE, onLampChange); ArduinoCloud.addCallback(ArduinoIoTCloudEvent::CONNECT, ok); }\nvoid ok(){}\nvoid onLampChange(){}\nvoid loop(){ ArduinoCloud.update(); }', 'ArduinoCloud.addProperty(() => lamp, (__v) => { lamp = __v; }, "lamp", READWRITE'],
  ['Arduino Cloud event', 'void ok(){}\nvoid setup(){ ArduinoCloud.addCallback(ArduinoIoTCloudEvent::CONNECT, ok); }\nvoid loop(){}', 'ArduinoIoTCloudEvent.CONNECT'],
  ['function template', 'template <typename T>\nT biggest(T a, T b) {\n  return a > b ? a : b;\n}\ntemplate<class A, class B> void show(A a, B b) { Serial.println(String(a) + b); }\nvoid setup(){ int x = biggest<int>(3, 7); float y = biggest(1.5, 0.5); show(x, y); }\nvoid loop(){}', 'biggest(3, 7)'],
  ['raw string + joined literals', 'const char PAGE[] PROGMEM = R"HTML(\n<style>.g{grid-template-columns:1fr}</style>\n<p class="x">hi</p>\n)HTML";\nconst char* J = "{\\"a\\":%d,"\n  "\\"b\\":%d}";\nvoid setup(){ Serial.println(PAGE); }\nvoid loop(){}', 'grid-template-columns'],
];
for (const [name, src, want] of cases) {
  try { const js = IOTF.transpile(src).code; if (js.includes(want)) console.log('ok  ', name); else { bad++; console.log('FAIL', name, '\n', js); } } catch (e) { bad++; console.log('FAIL', name, e.message); }
}
process.exit(bad ? 1 : 0);
