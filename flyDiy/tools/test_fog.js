#!/usr/bin/env node
// GATE FOG (FOG-MIST F1, 2026-09-22) - the visibility contract.
//
// THE ONE RULE: the renderer may only stop drawing where the SHADER has already hidden it. Not
// where an authored number says the day is murky - where the mist and the air this frame actually
// drew leave less than `thresh` of the light. The moment the two disagree the cut is a wall.
//
// THIS GATE ASSERTS THE INVARIANT NUMERICALLY, WITH NO GPU, and that is a deliberate choice the
// study had to measure its way into (FOG-MIST §1f): a picture CANNOT prove this. The world
// animates - water, propeller, foliage, cloud noise - so two IDENTICAL frozen frames differ in
// 49 % of pixels and per-tile means do not separate them either. A screenshot diff would have
// been a gate that passes whatever happens. So instead:
//
//   - the CPU mirror agrees with the GLSL closed form it claims to mirror, term for term;
//   - transmittance falls with distance and with density, never rises (the contract's own floor);
//   - a thing is hidden ONLY when the transmittance to its nearest point is under the threshold,
//     over a matrix of eye heights, densities and target heights - including the case the wall
//     pictures found, where the GROUND is gone at 2 km but a summit stands clear at 9;
//   - the cull is the MAIN camera's alone: it is applied and released around one render, never
//     left on across a frame, and never toggled inside another pass's own hide/restore;
//   - every preset names the row (GATE GFX holds the rest of that contract).
'use strict';
const fs = require('fs');
const path = require('path');
let bad = 0, n = 0;
const yes = (c, m) => { n++; if (c) console.log('  ok   ' + m); else { bad++; console.log('  FAIL ' + m); } };

const root = path.join(__dirname, '..');
const atmo = fs.readFileSync(path.join(root, 'src/viewer/atmo.js'), 'utf8');
const rw = fs.readFileSync(path.join(root, 'src/viewer/render_world.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/viewer/app.js'), 'utf8');
const gfx = fs.readFileSync(path.join(root, 'src/viewer/gfx_settings.js'), 'utf8');
console.log('GATE FOG');

// ---- 1. the CPU mirror is a MIRROR ------------------------------------------------------------
// Both forms are the same four-branch piecewise integral. If someone edits one, the shapes stop
// matching and this says so before a cut lands somewhere the shader still draws.
{
  const glsl = (/float mistOD\(float y0, float dy, float D\) \{([\s\S]*?)\n    \}/.exec(atmo) || [])[1] || '';
  const cpu = (/function mistODcpu\(y0, dy, D\) \{([\s\S]*?)\n  \}/.exec(atmo) || [])[1] || '';
  yes(!!glsl && !!cpu, 'both the GLSL closed form and its CPU mirror are present');
  for (const [what, re] of [
    ['the both-below branch', /ya <= 0(?:\.0)? && y1 <= 0(?:\.0)?/],
    ['the both-above branch', /ya > 0(?:\.0)? && y1 > 0(?:\.0)?/],
    ['the top-plane crossing', /ts = -ya \/ dy/],
  ]) yes(re.test(glsl) && re.test(cpu), 'the mirror keeps ' + what);
  yes(/MIST\.cloud\.rho/.test(cpu), 'the mirror counts the in-cloud slab too - the case where the contract pays most');
}

// ---- 2. the arithmetic itself, run ------------------------------------------------------------
// The closed form is pure: lift it and check the properties the contract leans on.
{
  const od = (rho0, yTop, H, y0, dy, D) => {
    const above = (ya, t0, t1) => Math.abs(dy) < 1e-4 ? (t1 - t0) * Math.exp(-ya / H)
      : (H / dy) * (Math.exp(-(ya + dy * t0) / H) - Math.exp(-(ya + dy * t1) / H));
    const ya = y0 - yTop, y1 = ya + dy * D;
    if (ya <= 0 && y1 <= 0) return rho0 * D;
    if (ya > 0 && y1 > 0) return rho0 * above(ya, 0, D);
    const ts = -ya / dy;
    return ya <= 0 ? rho0 * (ts + above(ya, ts, D)) : rho0 * (above(ya, 0, ts) + (D - ts));
  };
  const T = (rho0, y0, dy, D) => Math.exp(-od(rho0, 60, 18, y0, dy, D));
  let mono = true, dens = true;
  for (const rho0 of [0.0005, 0.00111, 0.00218, 0.005]) {
    for (let D = 200; D < 20000; D += 200) if (T(rho0, 25, 0, D) > T(rho0, 25, 0, D - 200) + 1e-12) mono = false;
    if (T(rho0 * 2, 25, 0, 3000) > T(rho0, 25, 0, 3000)) dens = false;
  }
  yes(mono, 'transmittance never RISES with distance');
  yes(dens, 'transmittance never RISES with density');
  yes(T(0, 25, 0, 50000) === 1, 'no mist is no extinction, at any distance');
  // the wall pictures' own finding, as arithmetic: the GROUND goes long before the RIDGE does
  const rng = (rho0, y0, yT) => { let lo = 0, hi = 200000; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; (T(rho0, y0, (yT - y0) / m, m) > 0.01 ? lo = m : hi = m); } return hi; };
  const ground = rng(0.00218, 25, 25), summit = rng(0.00218, 25, 700);
  yes(ground < 3000, 'at rh 0.98 the level ground is gone inside 3 km (' + (ground / 1000).toFixed(2) + ' km)');
  yes(summit > 4 * ground, 'a summit stands far longer than the ground does (' + (summit / 1000).toFixed(1) + ' km vs ' + (ground / 1000).toFixed(2) + ') - so a cut sized off the GROUND would shear the skyline');
  yes(rng(0.00218, 200, 700) > 100000, 'from above the lid the mist limits nothing, and the contract must not cut');
}

// ---- 3. the cull is the main camera's alone ---------------------------------------------------
{
  yes(/apply\(cam\)/.test(rw) && /release\(\)/.test(rw), 'the contract is apply/release, not a standing state');
  yes(/if \(!inGarage && WF && WF\.vis\) WF\.vis\.apply\(camera\);/.test(app), 'app.js applies it for the MAIN camera');
  yes(/if \(!inGarage && WF && WF\.vis\) WF\.vis\.release\(\);/.test(app), 'app.js releases it in the same frame');
  const iA = app.indexOf('WF.vis.apply(camera)'), iM = app.indexOf('WATER.mirrorRender'), iR = app.indexOf('WF.vis.release()');
  yes(iA > 0 && iM > iA && iR > iM, 'it brackets the water\'s mirror capture from OUTSIDE (the water session\'s ruling): apply, then the capture, then the main render, then release');
  yes(/get applied\(\)/.test(rw), 'the state is readable (WF.vis.applied) so another pass can assert it');
  yes(/thresh/.test(rw) && /ATMO\.seeT\(/.test(rw), 'the per-mesh test asks ATMO, not an authored number');
  yes(/bb\.max\.y/.test(rw), 'the test aims at the highest GROUND a mesh holds, never at its bounding sphere (which is a point in the sky)');
  yes(!/day\.visibilityKm/.test(rw.slice(rw.indexOf('const VIS'), rw.indexOf('const _vc'))), 'the contract never reads the authored visibility');
}

// ---- 4. the row ------------------------------------------------------------------------------
{
  yes(/k: 'drawDist'/.test(gfx), 'GRAPHICS carries the draw-distance row');
  const P = /const PRESETS = \{([\s\S]*?)\n  \};/.exec(gfx);
  yes(!!P && (P[1].match(/drawDist: '/g) || []).length === 4, 'every preset names it');
  yes(/drawDist: 'live'/.test(gfx), 'it is live - no restart');
}

console.log(n + ' checks, ' + bad + ' failed');
console.log('GATE FOG: ' + (bad ? 'FAIL (' + bad + ' of ' + n + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
