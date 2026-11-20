// Rebuilds src/vendor from node_modules (run after `npm install` when upgrading a library).
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), nm = path.join(root, 'node_modules'), out = path.join(root, 'src', 'vendor');
const cp = (from, to) => { fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true }); fs.copyFileSync(path.join(nm, from), path.join(out, to)); };

require('esbuild').buildSync({ stdin: { contents: "import '@wokwi/elements';", resolveDir: root }, bundle: true, minify: true, format: 'iife', outfile: path.join(out, 'wokwi-elements.js') });
cp('blockly/blockly.min.js', 'blockly.min.js');
cp('blockly/msg/th.js', 'blockly-msg-th.js');
fs.cpSync(path.join(nm, 'blockly/media'), path.join(out, 'blockly-media'), { recursive: true });
['lib/codemirror.js', 'lib/codemirror.css', 'mode/clike/clike.js', 'addon/edit/closebrackets.js', 'addon/edit/matchbrackets.js', 'addon/hint/show-hint.js', 'addon/hint/show-hint.css', 'theme/material-darker.css']
  .forEach((f) => cp('codemirror/' + f, 'codemirror/' + path.basename(f)));
cp('@wokwi/elements/LICENSE', 'LICENSE-wokwi-elements.txt');
cp('blockly/LICENSE', 'LICENSE-blockly.txt');
cp('codemirror/LICENSE', 'LICENSE-codemirror.txt');
['app', 'auth', 'firestore'].forEach((m) => {
  const f = `firebase/firebase-${m}-compat.js`;
  cp(f, f); const o = path.join(out, f); fs.writeFileSync(o, fs.readFileSync(o, 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, ''));
});
console.log('vendor files updated in', out);
