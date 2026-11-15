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
process.exit(bad ? 1 : 0);
