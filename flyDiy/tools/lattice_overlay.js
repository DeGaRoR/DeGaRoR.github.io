#!/usr/bin/env node
// LATTICE OVERLAY (PETREL-LS, 10 Nov 2026; a tool since 12 Nov): the FLOWN aeroplane drawn over the DRAWN one - the
// physics nodes (yellow, sized by mass), beams (coloured by class) and aero strips (magenta: leading edge to trailing
// edge through the quarter-chord dot) on quickshot's pictures of the same build. The fastest way to find a representation
// bug (FIT_AND_VALIDATE.md section 6): in one picture it found the fin's taper read as a ratio, the tail post clamped
// 0.35 m aft and a raised stab tied through the rudder.
//
//   node tools/lattice_overlay.js <build.json> <out-prefix> [--views side,top,front] [--crop z0,z1,y0,y1] [--w 1400]
//     writes <out-prefix>_<view>.png (the drawing dimmed, the lattice over it) and <out-prefix>_lattice.json
//
// What it reads: the def is built on the GAME's load path (LB.loadBuild: the crew layer, the energy write-back - never a
// headless bake, whose seats stand 0.30 m forward), the join's datum from _geoparity_lib's bake (CAGE_DATUM: x = zFw - z,
// y = y_cage - yD), quickshot's frames as it prints them (plus its 4 % pad). The rudder and the elevators are not lattice
// members: they fly as the aft fraction of the fin and stab strips. Beam classes: fus black, wing blue, cabane orange,
// interplane purple, tail green, wire grey, gear red, anything else magenta. Needs python3 with Pillow (the drawing).
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const [FILE, OUT] = pos;
if (!FILE || !OUT) { console.error('usage: node tools/lattice_overlay.js <build.json> <out-prefix> [--views side,top,front] [--crop z0,z1,y0,y1] [--w px]'); process.exit(2); }
const VIEWS = opt('views', 'side,top,front');
// 1. the pictures, and the frames quickshot used
const qa = [path.join(T, 'quickshot.js'), FILE, OUT, '--views', VIEWS, '--w', opt('w', '1400')];
if (opt('crop', null)) qa.push('--crop', opt('crop'));
const qs = cp.execFileSync(process.execPath, qa, { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const frames = {};
for (const m of qs.matchAll(/^frame (\w+): (\[[^\]]*\])$/gm)) frames[m[1]] = JSON.parse(m[2]);
// 2. the lattice, on the game's load path, in the join's datum
const C = require(path.join(T, 'flight_core.js')), LB = require(path.join(T, '_load_build.js')), GP = require(path.join(T, '_geoparity_lib.js'));
const raw = JSON.parse(fs.readFileSync(path.resolve(ROOT, FILE), 'utf8'));
const D = GP.measure(raw.spec || raw).W.CAGE_DATUM;
const def = C.buildGen(LB.loadBuild(FILE).spec);
const L = { D, frames, nodes: def.nodes.map(n => ({ p: n.p, tag: n.tag, m: n.m })), beams: def.beams.map(b => ({ a: b.a, b: b.b, cls: b.cls })),
            strips: (def.strips || []).map(s => { const g = GP.stripGeo(def, s); return { a: g.a, f: g.f, r: g.r, chord: s.chord, kind: s.kind }; }) };
fs.writeFileSync(OUT + '_lattice.json', JSON.stringify(L));
// 3. the drawing
const views = VIEWS.split(',').filter(v => frames[v] && ['side', 'top', 'front'].includes(v));
const py = cp.spawnSync('python3', ['-I', path.join(T, 'lattice_overlay.py'), OUT + '_lattice.json', OUT, views.join(',')], { stdio: 'inherit' });
if (py.status) process.exit(py.status);
const cls = {}; for (const b of def.beams) cls[b.cls] = (cls[b.cls] || 0) + 1;
console.log('lattice: ' + def.nodes.length + ' nodes, ' + def.beams.length + ' beams ' + JSON.stringify(cls) + ', ' + L.strips.length + ' strips; datum ' + JSON.stringify(D));
console.log('wrote ' + views.map(v => OUT + '_' + v + '.png').join(', '));
