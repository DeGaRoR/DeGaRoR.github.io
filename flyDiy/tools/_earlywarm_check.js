'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, '../src/viewer/app.js'), 'utf8');
function take(name) {
  const match = source.match(new RegExp('  function ' + name + '\\(\\) \\{[\\s\\S]*?\\n  \\}'));
  assert(match, name);
  return match[0];
}
const compile = take('compileCraft'), start = take('craftStart');
function defer() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function bind(ctx) {
  return new Function('ctx', 'with(ctx){' + compile + '\n' + start + ';return {compileCraft,craftStart};}')(ctx);
}
(async () => {
  let cases = 0;
  for (const held of [false, true]) for (const first of ['links', 'early']) for (const fail of [false, true]) {
    const links = defer(), early = defer(), warm = defer();
    const ctx = {
      WF: {}, renderer: { compileAsync() {} }, holdRender: held, craftEarly: early.promise,
      compileCraftLinks: () => links.promise,
      hybridWarm: () => { ctx.warms++; return warm.promise; }, warms: 0,
    };
    const api = bind(ctx), result = api.compileCraft().then(() => null, e => e.message);
    assert.strictEqual(ctx.holdRender, true);
    (first === 'links' ? links : early).resolve();
    await flush();
    assert.strictEqual(ctx.warms, 0, 'both compile chains must settle before the final warm');
    assert.strictEqual(ctx.holdRender, true);
    (first === 'links' ? early : links).resolve();
    await flush();
    assert.strictEqual(ctx.warms, 1);
    assert.strictEqual(ctx.holdRender, true, 'render remains held through the final warm');
    if (fail) warm.reject(Error('warm failed')); else warm.resolve();
    assert.strictEqual(await result, fail ? 'warm failed' : null);
    assert.strictEqual(ctx.holdRender, held, 'success and failure both restore the previous hold');
    cases++;
  }
  const links = defer(), warm = defer();
  const ctx = {
    WF: {}, renderer: { compileAsync() {} }, craftEarly: null, craftLightsKeep() {},
    compileCraftLinks: () => links.promise,
    hybridWarm: () => { ctx.warms++; return warm.promise; }, warms: 0, inGarage: false, console,
  };
  const api = bind(ctx);
  api.craftStart();
  const once = ctx.craftEarly;
  api.craftStart();
  assert.strictEqual(ctx.craftEarly, once, 'the early chain starts only once');
  assert.strictEqual(ctx.warms, 0);
  links.resolve();
  await flush();
  assert.strictEqual(ctx.warms, 1, 'early warm starts after compilation');
  let done = false;
  once.then(() => { done = true; });
  await flush();
  assert.strictEqual(done, false, 'the early promise includes the warm');
  warm.resolve();
  await once;
  assert.strictEqual(done, true);
  cases++;
  console.log(cases + ' ordering, render-hold, failure and single-start cases');
  console.log('GATE EARLYWARM: PASS');
})().catch(e => { console.error(e); process.exitCode = 1; });
