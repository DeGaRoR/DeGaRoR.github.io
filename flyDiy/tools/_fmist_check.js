// GATE FMIST - the forest mist, headless (FOREST-MIST, 2026-11-09/10; futureDesigns/FOREST-MIST-STUDY-2026-11.md SS7):
// it is inert when off, its map and its weather law say what the study says, and the GRAPHICS row is wired.
//
// 1. OFF IS IDENTICAL: without ?fmist the mist's GLSL carries no pocket code, the lanes' array is the 28 it was, and
//    atmo.js / clouds.js put every pocket string behind a ternary that yields '' (the source rule)
// 2. ON: ?fmist=ac declares 13 lanes, the density and the veil inside MIST_GLSL, 52 floats
// 3. THE MAP (Jolene, 512^2): deterministic, in range, the open sea nearly free of pool, the valley floors full,
//    the ridges empty; its bake time printed (named, not bounded: a prototype)
// 4. THE LAW: zero in dry air; the pool burns off with the lagged sun and dies in wind; the wisps fade with the hours
//    since rain; the cloud-base band needs a low, covered sky
//
//
// Run: node tools/_fmist_check.js   (contract: one final `GATE FMIST: PASS|FAIL`)
'use strict';
const fs = require('fs'), path = require('path');
let fails = 0, checks = 0;
const yes = (c, m) => { checks++; if (c) console.log('  ok   ' + m); else { fails++; console.log('  FAIL ' + m); } };
const fresh = (p) => { delete require.cache[require.resolve(p)]; return require(p); };
const SRC = path.join(__dirname, '..', 'src', 'viewer');

console.log('1. off is identical');
global.LIGHT_RIG = require(path.join(SRC, 'light_rig.js'));
delete global.FMIST; delete global.location;
let ATMO = fresh(path.join(SRC, 'atmo.js'));
const offG = ATMO.GLSL.MIST;
yes(!/fmDens|fmOD|fmMap/.test(offG), 'the mist GLSL off carries no pocket code');
yes(/uniform vec4 uMist\[7\];/.test(offG), 'the mist GLSL off declares the 7 lanes it always did');
yes(ATMO.apUniforms.uMist.value.length === 28, 'the lanes array off is 28 floats (' + ATMO.apUniforms.uMist.value.length + ')');
for (const f of ['atmo.js', 'clouds.js']) {
  const s = fs.readFileSync(path.join(SRC, f), 'utf8');
  const uses = s.split('\n').filter(l => /\bFM_(ON|A)\b/.test(l) && !/^\s*\/\//.test(l) && !/const FM_(ON|A|MARCH)\b/.test(l));
  const bad = uses.filter(l => !/FM_(ON|A)\s*\?[^:]*:\s*('[^']*'|\d+|lastCover|[^)]*\))/.test(l) && !/\(FM_A && fmLive\(\)\)/.test(l) && !/FM_A \? `/.test(l));
  yes(bad.length === 0, f + ': every pocket switch is a ternary whose off arm is what was there (' + uses.length + ' sites)' + (bad.length ? ' - ' + bad.join(' | ') : ''));
}

console.log('2. on');
global.location = { search: '?fmist=ac' };
global.FMIST = fresh(path.join(SRC, 'forest_mist.js'));
ATMO = fresh(path.join(SRC, 'atmo.js'));
const onG = ATMO.GLSL.MIST;
yes(FMIST.ON && FMIST.A && FMIST.C, '?fmist=ac turns both techniques on');
yes(/uniform vec4 uMist\[13\];/.test(onG) && /float fmDens\(vec3 p\)/.test(onG) && /fmOD\(vec3\(uMist\[4\]\.x, y0, uMist\[4\]\.z\), d, D\)/.test(onG), 'the density and the veil live inside MIST_GLSL, 13 lanes');
yes(ATMO.apUniforms.uMist.value.length === 52, 'the lanes array on is 52 floats');
global.location = { search: '?fmist=zz' };
yes(!fresh(path.join(SRC, 'forest_mist.js')).ON, 'an unknown ?fmist value is off');

console.log('3. the map (Jolene)');
const C = require('./flight_core.js'), IN = require('./island_node.js');
const boot = IN.islandBoot('jolene');
if (!boot) { console.log('  no Jolene in this checkout - map skipped'); }
else {
  const W = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot) });
  const m1 = FMIST.bakeMap(W, 256), m2 = FMIST.bakeMap(W, 256);
  let same = true; for (let k = 0; k < m1.px.length; k++) if (m1.px[k] !== m2.px[k]) { same = false; break; }
  yes(same, 'two bakes are bit-identical');
  let inRange = true, sea = 0, nSea = 0, fin = true;
  const N = m1.N;
  for (let k = 0; k < N * N; k++) {
    const p = m1.px[k * 4 + 1], w = m1.px[k * 4 + 2];
    if (!(p >= 0 && p <= 1 && w >= 0 && w <= 1)) inRange = false;
    if (!Number.isFinite(m1.px[k * 4]) || !Number.isFinite(m1.px[k * 4 + 3])) fin = false;
    if (m1.px[k * 4] < 0.5 && m1.px[k * 4 + 3] < 0.5) { sea += p; nSea++; }
  }
  yes(inRange && fin, 'every texel finite, the weights in [0, 1]');
  yes(nSea > 0 && sea / nSea <= 0.13, 'the open sea is nearly free of pool (mean ' + (sea / Math.max(1, nSea)).toFixed(3) + ' - the sea fog is the F2 layer\'s)');
  // valley floors against ridges: the 5 % lowest and highest land over its own floor
  const land = [];
  for (let k = 0; k < N * N; k++) if (m1.px[k * 4] - m1.px[k * 4 + 3] >= 0 && m1.px[k * 4 + 3] > 1) land.push([m1.px[k * 4] - m1.px[k * 4 + 3], m1.px[k * 4 + 1]]);
  land.sort((a, b) => a[0] - b[0]);
  const q = Math.floor(land.length * 0.05), lo = land.slice(0, q), hi = land.slice(-q);
  const mean = a => a.reduce((s, v) => s + v[1], 0) / Math.max(1, a.length);
  yes(mean(lo) > 0.35 && mean(hi) < 0.08, 'the hollows hold the pool, the ridges do not (floor ' + mean(lo).toFixed(3) + ', ridge ' + mean(hi).toFixed(3) + ')');
  const m5 = FMIST.bakeMap(W, 512);
  console.log('  info the 512^2 bake took ' + m5.ms.toFixed(0) + ' ms in node (pool mean ' + m5.poolMean.toFixed(3) + ', wisp mean ' + m5.wispMean.toFixed(3) + ')');
}

console.log('4. the law');
const L = (o, soil) => FMIST.strengths(Object.assign({ rh: 0.95, mistBurn: 0, mistCalm: 1, cloudCoverEff: 0.2, cloudBase: 600 }, o), Object.assign({ rainNow: 0, hoursDry: 2 }, soil || {}));
yes(L({ rh: 0.5 }).every(v => v === 0), 'dry air (rh 0.5): no pocket of any kind');
const b = [0, 0.3, 0.6, 1].map(x => L({ mistBurn: x })[0]);
yes(b[0] > b[1] && b[1] > b[2] && b[2] > b[3] && b[3] === 0, 'the pool burns off with the lagged sun (' + b.map(v => v.toFixed(2)).join(' > ') + ')');
yes(L({ mistCalm: 0 })[0] === 0, 'a wind that takes the F2 layer takes the pool');
const w = [0, 3, 8, 24, 96].map(h => L({}, { hoursDry: h })[1]);
yes(w.every((v, i) => i === 0 || v < w[i - 1]) && w[4] < 0.01, 'the wisps fade with the hours since rain (' + w.map(v => v.toFixed(3)).join(' > ') + ')');
yes(L({ mistBurn: 1 }, { hoursDry: 1 })[1] > 0.2, 'the first sun on a wet forest still steams (the burn takes the wisps by half)');
yes(L({ rh: 0.98, cloudCoverEff: 0.9, cloudBase: 400 })[2] > 0.5 && L({ rh: 0.98, cloudCoverEff: 0.9, cloudBase: 1500 })[2] === 0 && L({ rh: 0.98, cloudCoverEff: 0.1, cloudBase: 400 })[2] === 0, 'the cloud on the slopes needs a low base and a covered sky');
yes(L({ cloudCoverEff: 0.9 })[0] < 0.4 * L({ cloudCoverEff: 0 })[0], 'an overcast night keeps the ground warm: little radiation fog under it');
{ const k = L({ rh: 0.6, mistCalm: 0.5 }, { hoursDry: 400 }); yes(k[0] === 0 && k[1] === 0, 'a dry, breezy day long after rain: no pool, no wisps'); }

console.log('5. the GRAPHICS row');
{
  const G = fs.readFileSync(path.join(SRC, 'gfx_settings.js'), 'utf8');
  const row = /\{ k: 'fmist', label: 'forest mist', reload: true, steps: \[/.test(G);
  const presets = (G.match(/fmist: 'off', /g) || []).length;
  yes(row, 'the row exists and is a reload row (the veil is compiled in at the start)');
  yes(presets === 6, 'every preset names it, OFF until the box has timed it (' + presets + ' of 6)');
  yes(/rows: \['clouds', 'mist', 'fmist', 'glare'\]/.test(G), 'it sits in the sky group');
  global.location = { search: '' }; global.localStorage = { getItem: k => (k === 'flydiy.fmist' ? '1' : null) };
  const F2 = fresh(path.join(SRC, 'forest_mist.js'));
  yes(F2.ON && F2.C && !F2.A && !F2.B, 'the stored choice compiles the veil alone (the cards and the march stay behind ?fmist=)');
  global.localStorage = { getItem: () => null };
  yes(!fresh(path.join(SRC, 'forest_mist.js')).ON, 'nothing stored, no flag: off');
  delete global.localStorage;
}
console.log((fails ? 'GATE FMIST: FAIL' : 'GATE FMIST: PASS') + ' (' + (checks - fails) + '/' + checks + ')');
process.exitCode = fails ? 1 : 0;
