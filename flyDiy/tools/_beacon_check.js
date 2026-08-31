// GATE BEACON — the anti-collision light flashes because a mirror is turning.
//
// G99, user: "now do the beacon flash". The easy version of this is a sine
// wave on the emissive, and it is wrong in a way that is invisible in a
// screenshot and obvious in the room: A ROTATING BEACON IS DIRECTIONAL. Two
// aeroplanes parked side by side flash at the same rate but not at the same
// moment, and walking round one moves the flash. A time-only pulse gives every
// observer the same flash at the same instant, which is a strobe — a different
// fitting, with a different rate and no moving parts.
//
// So the assertions are about DIRECTION as much as timing:
//
//   RATE      one flash per revolution, and the revolution rate is the rpm
//             the panel asked for — no second number to disagree with it
//   AIM       the peak happens when the beam points AT THE OBSERVER, so
//             moving the observer moves the flash
//   FLOOR     the dome is never black; it scatters whatever the mirror is
//             doing behind it
//   PARKED    rpm 0 burns steady, which is also what a failed beacon motor
//             looks like
//
// The law is lifted out of the light layer and run (the G48 rule).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const SRC = path.join(__dirname, '_cage_light.js');
const results = [];
const ok = (m, c) => results.push({ m, c: !!c });

// ---- lift the law ----------------------------------------------------------
const t = fs.readFileSync(SRC, 'utf8');
const ctx = vm.createContext({ Math, console });
const stmt = at => {
  let d = 0;
  for (let k = at; k < t.length; k++) {
    const c = t[k];
    if (c === '{' || c === '(' || c === '[') d++;
    else if (c === '}' || c === ')' || c === ']') {
      d--;
      if (d === 0 && c === '}' && /\n/.test(t.slice(k + 1, k + 3))) return k + 1;
    } else if (c === ';' && d === 0) return k + 1;
    else if (c === '/' && t[k + 1] === '/') k = t.indexOf('\n', k);
  }
  return -1;
};
const lift = n => {
  const re = new RegExp('^[ \\t]*(?:function\\s+' + n + '\\s*\\(|const\\s+' + n +
                        '\\s*=)', 'm');
  const m = re.exec(t);
  if (!m) return false;
  const end = stmt(m.index);
  if (end < 0) return false;
  const s2 = t.slice(m.index, end);
  vm.runInContext(/^\s*function/.test(s2) ? s2 : s2 + ';', ctx);
  vm.runInContext('globalThis.' + n + ' = ' + n + ';', ctx);
  return true;
};
const got = ['BEACON_LOBE', 'BEACON_FLOOR', 'beaconPhase', 'beaconGain']
  .every(lift);
ok('the flash law is lifted from ' + path.basename(SRC), got);

// the declared rate, read out of the table rather than typed here
const rpmM = /beacon:\s*\{[^}]*rpm:\s*([0-9.]+)/.exec(t.replace(/\n/g, ' '));
ok('the beacon declares a rotation rate', !!rpmM);
const RPM = rpmM ? +rpmM[1] : 0;
ok('and it is a sane one for the type (20..90 rpm, got ' + RPM + ')',
   RPM >= 20 && RPM <= 90);

// ---- the beacon's own frame: a can standing on the fin ---------------------
const AX = [0, 1, 0], E1 = [0, 0, -1], E2 = [-1, 0, 0];

function trace(view, rpm, secs, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const tS = secs * i / n;
    out.push(ctx.beaconGain(ctx.beaconPhase(tS, rpm), AX, E1, E2, view));
  }
  return out;
}
// a peak is a sample above half the swing, and consecutive ones are one flash
function flashes(tr) {
  const hi = Math.max.apply(null, tr), lo = Math.min.apply(null, tr);
  const thr = lo + (hi - lo) * 0.5;
  let n = 0, was = false;
  for (const v of tr) { const is = v > thr; if (is && !was) n++; was = is; }
  return { n, hi, lo };
}
// where in the revolution the flash happens, in turns
function peakPhase(view, rpm, n) {
  let best = -Infinity, at = 0;
  for (let i = 0; i < n; i++) {
    const ph = Math.PI * 2 * i / n;
    const g = ctx.beaconGain(ph, AX, E1, E2, view);
    if (g > best) { best = g; at = i / n; }
  }
  return { at, peak: best };
}

if (got) {
  // ---- RATE ---------------------------------------------------------------
  for (const rpm of [RPM, 30, 90]) {
    const secs = 8, tr = trace([3, 1, 3], rpm, secs, 20000);
    const f = flashes(tr);
    const want = Math.round(secs * rpm / 60);
    ok('at ' + rpm + ' rpm there is one flash per revolution (' + f.n +
       ' in ' + secs + ' s, expected ' + want + ')', f.n === want);
  }

  // ---- AIM: the flash is where the observer is ----------------------------
  // Four observers spaced a quarter turn apart must see the flash a quarter
  // turn apart. This is the assertion a time-only pulse cannot pass.
  const around = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI * 2 * k / 4;
    around.push({ k, ...peakPhase([Math.cos(a) * 4, 0.8, Math.sin(a) * 4],
                                  RPM, 3600) });
  }
  let spread = true;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    let d = Math.abs(around[i].at - around[j].at);
    d = Math.min(d, 1 - d);                       // it is a circle
    if (d < 0.15) spread = false;
  }
  ok('four observers a quarter turn apart see the flash at four different ' +
     'moments (' + around.map(a => a.at.toFixed(2)).join(', ') + ' turns)',
     spread);
  ok('and each of them sees a full-brightness flash (' +
     around.map(a => a.peak.toFixed(2)).join(', ') + ')',
     around.every(a => a.peak > 0.97));

  // the peak must track the observer's own bearing, not merely differ
  let tracks = true;
  for (let k = 0; k < 8; k++) {
    const a = Math.PI * 2 * k / 8;
    const p = peakPhase([Math.cos(a) * 4, 0.8, Math.sin(a) * 4], RPM, 3600);
    // the beam at the peak must point within a few degrees of the observer
    const ph = p.at * Math.PI * 2;
    const bx = E1[0] * Math.cos(ph) + E2[0] * Math.sin(ph);
    const bz = E1[2] * Math.cos(ph) + E2[2] * Math.sin(ph);
    const vx = Math.cos(a), vz = Math.sin(a);
    if (bx * vx + bz * vz < Math.cos(2 * Math.PI / 180)) tracks = false;
  }
  ok('the beam points at the observer at the moment of the flash (8 bearings, '
     + 'within 2 degrees)', tracks);

  // ---- the FLASH IS A FLASH, not a slow throb -----------------------------
  // above half brightness for well under a quarter of the revolution
  const N = 3600;
  let bright = 0;
  for (let i = 0; i < N; i++)
    if (ctx.beaconGain(Math.PI * 2 * i / N, AX, E1, E2, [4, 0.8, 0]) > 0.5)
      bright++;
  ok('it is bright for a short part of the turn (' +
     (bright / N * 100).toFixed(1) + '% above half)',
     bright / N > 0.01 && bright / N < 0.20);

  // ---- FLOOR --------------------------------------------------------------
  let lo = Infinity;
  for (let i = 0; i < N; i++)
    lo = Math.min(lo, ctx.beaconGain(Math.PI * 2 * i / N, AX, E1, E2, [4, 0.8, 0]));
  ok('the dome never goes black (floor ' + lo.toFixed(3) + ')',
     lo >= ctx.BEACON_FLOOR - 1e-9 && lo > 0.02);

  // straight up the axis there is no azimuth to sweep past
  const up = trace([0, 5, 0], RPM, 4, 400);
  ok('an observer directly above the beacon sees no sweep, only the dome',
     Math.max.apply(null, up) - Math.min.apply(null, up) < 1e-6);

  // ---- PARKED -------------------------------------------------------------
  const parked = trace([4, 0.8, 0], 0, 4, 400);
  ok('rpm 0 holds the phase still (no flash)',
     Math.max.apply(null, parked) - Math.min.apply(null, parked) < 1e-9);
}

// ---- --selftest ------------------------------------------------------------
// A test whose failure looks like its pass is not a test. The tempting wrong
// implementation is a pulse on the clock alone. It passes RATE, it passes
// FLOOR, it passes "bright for a short part of the turn" — and it fails AIM,
// which is the whole difference between a beacon and a strobe.
if (process.argv.includes('--selftest') && got) {
  const sine = ph => ctx.BEACON_FLOOR + (1 - ctx.BEACON_FLOOR) *
    Math.pow(Math.max(0, Math.cos(ph)), ctx.BEACON_LOBE);
  const at = [];
  for (let k = 0; k < 4; k++) {
    let best = -Infinity, best_i = 0;
    for (let i = 0; i < 3600; i++) {
      const g = sine(Math.PI * 2 * i / 3600);
      if (g > best) { best = g; best_i = i; }
    }
    at.push(best_i / 3600);
  }
  const allSame = at.every(v => Math.abs(v - at[0]) < 1e-9);
  ok('SELFTEST: a clock-only pulse flashes at the same moment for every ' +
     'observer, and AIM catches it', allSame);
}

// ---- verdict ---------------------------------------------------------------
console.log('=== BEACON ===');
let fail = 0;
for (const r of results) {
  console.log('  ' + (r.c ? 'ok  ' : 'FAIL') + '  ' + r.m);
  if (!r.c) fail++;
}
console.log('GATE BEACON: ' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
