#!/usr/bin/env node
// _ref_sit.js — DERIVE THE GROUND ATTITUDE of a baked reference payload.
//
//   node tools/_ref_sit.js [key ...]        (default: every payload GATE REF knows)
//
// A payload is drawn in whatever attitude the modeller drew it in. Nothing in
// the file says which one, so refplane.js's REF_PRESETS DECLARES it and GATE
// REF holds the declaration to the payload. This is the instrument that
// produces the number you declare — it is not the gate, and it deliberately
// does not write anything: a measured row is measured HERE and pasted THERE,
// so the gate is checking a declaration rather than agreeing with itself.
//
// THE INSTRUMENT. An aeroplane parked on the ground rests on two contact
// patches — mains and tailwheel, or mains and nosewheel — a long way apart and
// at the same height. Rotate the lower convex hull through every plausible
// pitch and an attitude that stands on BOTH is a local maximum of the stance:
// tip away from it either way and one contact lifts. That is exactly the check
// GATE REF runs at ±1 and ±3 degrees, run here over a fine sweep instead.
//
// EVERY LOCAL MAXIMUM IS LISTED, and this tool refuses to pick for you.
// The C172 payload is why: its widest stance of all is 12.2 deg nose-up, where
// it balances on its main wheels and the bottom of its TAILCONE over 5.1 m —
// wider than the 1.74 m nose-to-mains stance it actually parks on. A global
// maximum is not the attitude an aeroplane parks in; it is only the attitude
// with the most floor under it. Reading the list against what the aeroplane
// IS (taildragger: mains + tailwheel, several degrees nose-up; tricycle:
// nose + mains, near level as drawn) is a judgement, so it is made by a
// person, written into REF_PRESETS as a declaration, and held there by the
// gate.
//
// It reports the SPAN and LENGTH too, because the same decode already has
// them and a payload whose scale is wrong makes every other number here a
// well-measured fiction.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const R = require(path.join(SRC, 'viewer', 'refplane.js'));

function loadCore() {
  const txt = fs.readFileSync(path.join(SRC, 'core', '50_model_codec.js'), 'utf8');
  const box = {};
  new Function('exports', txt + '\n;exports.decodeModel = decodeModel;')(box);
  return box.decodeModel;
}
const decodeModel = loadCore();

function loadPayload(key) {
  const file = path.join(SRC, 'models', key + '_model.js');
  const txt = fs.readFileSync(file, 'utf8');
  const box = {};
  new Function('exports', txt + '\n;exports.M = MODEL_' + key.toUpperCase() + ';')(box);
  return box.M;
}

const CONTACT_TOL = 0.012;      // 12 mm — a tyre's own flat, not a drawing
const STEP = 0.01;              // deg. 0.01 deg over a 5 m base is 0.9 mm.
const RANGE = 25;               // deg either way: no aeroplane parks steeper

// the stance the aeroplane stands on at a given pitch, in metres between the
// outermost two contacts. Same arithmetic as GATE REF's checkAttitude.
function stance(hull, pitchDeg) {
  const t = pitchDeg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const lo = R.refLowestY(hull, pitchDeg);
  let xmin = Infinity, xmax = -Infinity, n = 0;
  for (const q of hull) {
    if (q[1] * c - q[0] * s > lo + CONTACT_TOL) continue;
    const x = q[0] * c + q[1] * s;
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    n++;
  }
  return { base: n ? xmax - xmin : 0, n: n, lo: lo,
           fwd: n ? xmin : 0, aft: n ? xmax : 0 };
}

// every pitch that is a local maximum of the stance, as [lo, hi] bands.
//
// A BAND rather than a point, and a WINDOW rather than a three-sample test.
// The stance is not smooth: contacts snap in and out of the 12 mm band, so it
// is a staircase with a slow drift along each tread. Asking "is this sample
// higher than its two neighbours" finds nothing on such a curve — the first
// version of this function did exactly that and missed the PA-18's own
// declared 12.09 deg, which is the surest sign an instrument is wrong. So a
// peak here is a sample no lower than everything within WIN degrees of it,
// and adjacent peaks are merged into the band they belong to.
const WIN = 0.6;                // deg: wider than a tread, narrower than a peak

function maxima(hull) {
  const N = Math.round(2 * RANGE / STEP) + 1;
  const w = Math.round(WIN / STEP);
  const b = new Array(N);
  for (let i = 0; i < N; i++) b[i] = stance(hull, -RANGE + i * STEP).base;
  const peak = new Array(N).fill(false);
  for (let i = w; i < N - w; i++) {            // endpoints are not attitudes
    if (b[i] <= 0.05) continue;
    let top = true;
    for (let k = i - w; k <= i + w && top; k++) if (b[k] > b[i] + 1e-9) top = false;
    peak[i] = top;
  }
  const out = [];
  for (let i = 0; i < N; i++) {
    if (!peak[i]) continue;
    let jj = i;
    while (jj + 1 < N && peak[jj + 1]) jj++;
    let best = b[i];
    for (let k = i; k <= jj; k++) if (b[k] > best) best = b[k];
    out.push({ lo: -RANGE + i * STEP, hi: -RANGE + jj * STEP, base: best });
    i = jj;
  }
  return out.sort((a, c) => c.base - a.base);
}

const keys = process.argv.slice(2).filter(a => !a.startsWith('--'));
const want = keys.length ? keys
  : R.REF_PRESETS.filter(p => p.model).map(p => p.model);

for (const key of want) {
  let dec;
  // geometry bytes external since G149: the payload names its bin, fs reads it
  try {
    const p = loadPayload(key);
    const bin = p.bin ? new Uint8Array(fs.readFileSync(
      path.join(__dirname, '..', ...p.bin.split('/')))) : undefined;
    dec = decodeModel(p, bin);
  }
  catch (e) { console.log(`${key}: cannot load — ${e.message}`); continue; }
  const box = R.refDecodedBox(dec);
  const hull = R.refLowerHull(dec);

  const pre = R.REF_PRESETS.filter(p => p.model === key)[0];
  const declared = pre ? R.refSitPitch(pre) : null;
  console.log(
    `${key.padEnd(8)} span ${box.span.toFixed(3)}  length ${box.len.toFixed(3)}  ` +
    `height ${box.hgt.toFixed(3)}  minY ${box.min[1].toFixed(4)}` +
    (pre ? `  ·  declared sit ${declared.toFixed(2)} deg` : '  ·  NOT IN REF_PRESETS'));

  // `fwd`/`aft` are the contacts' own x in the ROTATED frame — nose negative,
  // tail positive — so a taildragger's pair reads as (mains, tailwheel) and a
  // tricycle's as (nosewheel, mains). That is what tells the two apart, and it
  // is why the contact positions are printed rather than just the width.
  for (const m of maxima(hull)) {
    const p = (m.lo + m.hi) / 2, at = stance(hull, p);
    const mark = (declared != null && declared >= m.lo - 0.005 &&
                  declared <= m.hi + 0.005) ? ' <== declared' : '';
    console.log(
      `    ${p >= 0 ? ' ' : ''}${p.toFixed(2)} deg  stance ${m.base.toFixed(3)} m ` +
      `(x ${at.fwd.toFixed(2)} .. ${at.aft.toFixed(2)}, ${at.n} hull pts, ` +
      `plateau ${m.lo.toFixed(2)}..${m.hi.toFixed(2)})${mark}`);
  }
}
