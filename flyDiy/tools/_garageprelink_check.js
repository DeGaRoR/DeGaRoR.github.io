'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const s = fs.readFileSync(path.join(__dirname, '../src/viewer/app.js'), 'utf8').replace(/\r\n/g, '\n');
const a = s.indexOf("  bootStep('firstFrame',"), b = s.indexOf("  if (!GARAGE_ONLY) bootTripStep('frames')", a);
assert(a > 0 && b > a);
assert(s.includes('return (shedEarly = new Promise'), 'shed early chain retained');
assert(s.includes('craftShedEarly = (typeof PROG_WARM'), 'craft shed chain retained');
async function check() {
  let releaseShed, releaseCraft, firstFrame, xray = 0;
  const context = { bootStep(id, label, weight, fn) { assert.strictEqual(id, 'firstFrame'); firstFrame = fn; },
    hud() {}, startLoop() {}, renderer: { compileAsync() {} }, hangar: {},
    shedEarly: new Promise(r => { releaseShed = r; }),
    craftShedEarly: new Promise(r => { releaseCraft = r; }),
    compileXrayVariants() { xray++; }, setTimeout, Promise };
  vm.runInNewContext(s.slice(a, b), context);
  let done = false; const pending = firstFrame().then(() => { done = true; });
  await new Promise(r => setTimeout(r, 5)); assert(!done); assert.strictEqual(xray, 0);
  releaseShed(); await new Promise(r => setTimeout(r, 5)); assert(!done); assert.strictEqual(xray, 0);
  releaseCraft(); await pending; assert(done); assert.strictEqual(xray, 1);
  console.log('GATE GARAGEPRELINK: PASS (loader joins both outstanding chains)');
}
check().catch(e => { console.error(e); process.exitCode = 1; });
