#!/usr/bin/env node
// GATE COOKWAIT: exercise the shipped cook evaluator with virtual timers/CDP.
// No browser, sleeping or machine-dependent wall-time assertion.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, 'parked_cook.js'), 'utf8').replace(/\r\n/g, '\n');
const at = source.indexOf('    const ev = async (expr, ms) => {'), end = source.indexOf("    await cmd('Page.enable');", at);
assert(at >= 0 && end > at, 'cook evaluator exists');
const body = source.slice(at, end);
function fixture(cmd) {
  let id = 0; const timers = new Map();
  const schedule = (fn, ms) => { const key = ++id; timers.set(key, { fn, ms }); return key; };
  const ctx = vm.createContext({ cmd, setTimeout: schedule, clearTimeout: key => timers.delete(key), sleep: ms => new Promise(resolve => schedule(resolve, ms)) });
  vm.runInContext(body + '\n;this.evaluate = ev;', ctx);
  return { ev: ctx.evaluate, timers };
}
(async () => {
  const good = fixture(() => Promise.resolve({ result: { result: { value: 7 } } }));
  assert.strictEqual(await good.ev('answer', 300000), 7);
  assert.strictEqual(good.timers.size, 0, 'successful request leaves no five-minute timer');
  console.log('  ok   successful CDP response cancels deadline and keeps value');
  for (const [label, cmd, match] of [
    ['CDP rejection', () => Promise.reject(new Error('transport failed')), /transport failed/],
    ['page exception', () => Promise.resolve({ result: { exceptionDetails: { text: 'page failed' } } }), /page failed/],
    ['malformed response', () => Promise.resolve({}), /page:/],
    ['synchronous transport throw', () => { throw new Error('sync transport'); }, /sync transport/]
  ]) {
    const f = fixture(cmd); await assert.rejects(f.ev('throw', 120000), match);
    assert.strictEqual(f.timers.size, 0, label + ' cancels deadline');
    console.log('  ok   ' + label + ' preserves failure without pending deadline');
  }
  for (const ms of [undefined, 300000]) {
    const f = fixture(() => new Promise(() => {})), pending = f.ev('stuck', ms);
    assert.strictEqual(f.timers.size, 1, 'pending request has one deadline');
    const timer = [...f.timers.values()][0]; assert.strictEqual(timer.ms, ms || 120000);
    timer.fn(); await assert.rejects(pending, /page: timed out on stuck/);
    assert.strictEqual(f.timers.size, 0, 'expired deadline cleared');
  }
  console.log('  ok   pending requests retain default/custom timeouts and fail as before');
  console.log('GATE COOKWAIT: PASS');
})().catch(e => { console.error(e.stack || e); console.log('GATE COOKWAIT: FAIL'); process.exitCode = 1; });
