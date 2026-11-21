# Credits

WJSIM itself is released under the MIT License (see `LICENSE`).
It bundles the third-party components below; their full license texts are in `src/vendor/`.

## Device artwork

### wokwi-elements 1.9.2 (50 parts)
Most device drawings and their pin layouts come from [wokwi-elements](https://github.com/wokwi/wokwi-elements),
Copyright (c) 2020 Uri Shaked, MIT License. Full text: `src/vendor/LICENSE-wokwi-elements.txt`

```
The MIT License (MIT)

Copyright (c) 2020 Uri Shaked

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Original drawings (36 parts)
pH Sensor, TDS Sensor, Load Cell, RFID RC522, GPS NEO-6M, LoRa SX1278, 4-channel Relay Module,
DHT11, DS18B20, soil moisture, rain, water level, MQ-135, IR obstacle, TCRT5000, TTP223 touch, reed switch,
SW-420, BME280, BMP280, BH1750, PMS5003, ACS712, PZEM-004T, YF-S201, MAX30102,
TT gear motor, water pump, vibration motor, L298N, L9110S, 28BYJ-48 with ULN2003, A4988
and breadboards (half, full, mini)
were drawn from scratch for WJSIM (`src/js/parts.js`). Copyright (c) 2026 WJSIM Contributors, MIT License.
No artwork from Fritzing (CC BY-SA 3.0) or from product photos was used.

## Software

| Component | Version | License | Copyright |
|---|---|---|---|
| [Blockly](https://github.com/google/blockly) (incl. Thai messages and media) | 13.4.0 | Apache License 2.0 — `src/vendor/LICENSE-blockly.txt` | Google LLC |
| [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk) (web version only, for Sign in with Google) | 11.10.0 | Apache License 2.0 — `src/vendor/LICENSE-firebase.txt` | Google LLC |
| [CodeMirror](https://codemirror.net/5/) | 5.65 | MIT — `src/vendor/LICENSE-codemirror.txt` | Marijn Haverbeke and others |
| [Electron](https://www.electronjs.org/) (desktop app only) | 45 | MIT | OpenJS Foundation and Electron contributors |

The Electron runtime ships its own license files (`LICENSE.electron.txt`, `LICENSES.chromium.html`) inside every packaged build.

## Trademarks
Product and brand names (Arduino, ESP32, Raspberry Pi, Wokwi, ...) belong to their respective owners.
WJSIM is not affiliated with or endorsed by them. Artwork is used only to show the style of each device.
