// Gate: the baked Cessna 172SP payload decodes, lands on the sim's wheels, and
// its control surfaces deflect with aero-consistent signs.
//
// Same contract as MODEL + SKIN + CTRL do for the PA-18, but this airframe adds
// three things those gates do not cover:
//   * hinge axes that are NOT cardinal (wing dihedral tilts the flap/aileron
//     hinges, the ailerons taper, the rudder hinge rakes 24 deg);
//   * a steering NOSE wheel, whose parts span four payload groups because they
//     carry four different materials — so several groups are rigged, not just
//     `skin` (SKIN_CFG.c172.rig in src/viewer/app.js);
//   * tricycle mount calibration, which has to hold at BOTH ends.
const { decodeModel, makeHingeBinding, applyHinges, makeSkinBinding,
        buildC172, makeSim, makeWorld } = require('./flight_core.js');
const { MODEL_C172 } = require('../src/models/c172_model.js');

let ok = true, why = [];
const chk = (c, m) => { if (!c) { ok = false; why.push(m); } };

const dec = decodeModel(MODEL_C172);
const S = MODEL_C172.surfaces;

// ---- structure ------------------------------------------------------------
const RIG = ['skin', 'metal', 'tyre', 'hub', 'gear'];      // must match SKIN_CFG
const HINGED = ['skin', 'tyre', 'hub', 'gear'];            // of those, the sid carriers
const NEEDED = RIG.concat(['glass', 'prop', 'propcap', 'proptip', 'cabin', 'cabin2']);
for (const g of NEEDED) chk(!!dec[g], `group ${g} missing`);
for (const name in dec) {
  const d = dec[name];
  chk(d.pos.length === d.nv * 3 && d.idx.length === d.nt * 3, `${name}: count mismatch`);
  let mx = 0, bad = false;
  for (let i = 0; i < d.idx.length; i++) mx = Math.max(mx, d.idx[i]);
  for (let i = 0; i < d.pos.length; i++) if (!isFinite(d.pos[i])) bad = true;
  chk(mx < d.nv, `${name}: index out of range (${mx} >= ${d.nv})`);
  chk(!bad, `${name}: NaN in positions`);
}
chk(S.length === 11, `expected 11 surfaces, got ${S.length}`);
for (const g of HINGED) chk(!!dec[g].sid, `${g}: hinge group has no sid tags`);
chk(!dec.metal.sid, 'metal carries sid tags it does not need');
// every hinge axis must be a unit vector — the payload feeds them to Rodrigues
for (const [n, s] of S.map((x, i) => [x.name, x]))
  chk(Math.abs(Math.hypot(s.ax[0], s.ax[1], s.ax[2]) - 1) < 1e-3, `${n}: axis not unit`);

// dimensions: span 11.00 m, length 8.23 m (see tools/models/c172_src.py)
let bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
for (const name in dec) {
  const d = dec[name];
  for (let i = 0; i < d.nv; i++) for (let a = 0; a < 3; a++) {
    bb[a] = Math.min(bb[a], d.pos[i*3+a]); bb[3+a] = Math.max(bb[3+a], d.pos[i*3+a]);
  }
}
const span = bb[5] - bb[2], len = bb[3] - bb[0];
let tris = 0, verts = 0;
for (const n in dec) { tris += dec[n].nt; verts += dec[n].nv; }
console.log(`c172 ${Object.keys(dec).length} groups ${verts} verts ${tris} tris | ` +
            `span ${span.toFixed(2)} len ${len.toFixed(2)}`);
chk(Math.abs(span - 11.00) < 0.05, `span ${span.toFixed(2)} != 11.00`);
chk(Math.abs(len - 8.23) < 0.06, `length ${len.toFixed(2)} != 8.23`);
// the mesh is imported as-is: the payload must still carry the source's own
// triangle count (185 624 minus the 6 staging props, plus the mirrored strut)
chk(tris === 185624, `tris ${tris} != 185624 — has something decimated the mesh?`);

// ---- the propeller turns; the cowling does not -----------------------------
// Every prop* group spins about `hub`, so anything fixed that lands in one
// spins with it. The cowl's FRONT PANEL is the ring around the spinner and is
// exactly the part that looks wrong when it rotates: it is fixed structure and
// belongs in `skin`. The whole prop assembly sits forward of it.
// x alone cannot separate them — the spinner backplate sits at the same
// station as the cowl lip. What separates them is RADIUS: aft of the blade
// disc the only thing that turns is the spinner, and a spinner is slender.
// The cowl face reaches 0.41 m from the axis and would trip this immediately.
const [hx, hy, hz] = MODEL_C172.hub;
const DISC_X = -3.635, SPINNER_R = 0.25;
let propAft = 0;
for (const g in dec) {
  if (g.lastIndexOf('prop', 0) !== 0) continue;
  for (let i = 0; i < dec[g].nv; i++) {
    const r = Math.hypot(dec[g].pos[i*3+1] - hy, dec[g].pos[i*3+2] - hz);
    if (dec[g].pos[i*3] > DISC_X && r > SPINNER_R) propAft++;
  }
}
chk(propAft === 0, `${propAft} wide spinning verts aft of the blade disc — ` +
                   'fixed cowling structure has landed in a prop* group');
let cowlInSkin = 0;
for (let i = 0; i < dec.skin.nv; i++)
  if (dec.skin.pos[i*3] < -3.40 && Math.abs(dec.skin.pos[i*3+2]) > 0.30) cowlInSkin++;
console.log(`prop: ${propAft} verts aft of the cowl face | cowl face in skin: ${cowlInSkin} verts`);
chk(cowlInSkin > 100, 'cowl front panel is not in the static skin group');

// ---- mount calibration: BOTH gear ends on the sim's contact plane ----------
const OFF = [1.694, -1.420, 0];                 // must match SKIN_CFG.c172.off
const def = buildC172();
const sim = makeSim(def, makeWorld());
sim.reset(0);
for (let k = 0; k < 12 * 60; k++) sim.step(1 / 60);
const cg = sim.cgPos(), [xA, yU] = sim.axes();
const bodyOf = (i, ax) => {
  const d = [sim.p[i*3]-cg[0], sim.p[i*3+1]-cg[1], sim.p[i*3+2]-cg[2]];
  return d[0]*ax[0] + d[1]*ax[1] + d[2]*ax[2];
};
const iMain = def.nodes.findIndex(n => n.tag === 'AXLEL');
const iNose = def.nodes.findIndex(n => n.tag === 'TW');
const simMain = bodyOf(iMain, yU) - def.nodes[iMain].r;
const simNose = bodyOf(iNose, yU) - def.nodes[iNose].r;
// model wheel bottoms, split main/nose by |z|
const tyre = dec.tyre;
let mBot = 1e9, nBot = 1e9, mX = [1e9, -1e9], nX = [1e9, -1e9], mZ = 0;
for (let i = 0; i < tyre.nv; i++) {
  const x = tyre.pos[i*3], y = tyre.pos[i*3+1], z = tyre.pos[i*3+2];
  if (Math.abs(z) > 0.5) {
    mBot = Math.min(mBot, y); mX[0] = Math.min(mX[0], x); mX[1] = Math.max(mX[1], x);
    mZ = Math.max(mZ, Math.abs(z));
  } else {
    nBot = Math.min(nBot, y); nX[0] = Math.min(nX[0], x); nX[1] = Math.max(nX[1], x);
  }
}
const dMain = (mBot + OFF[1]) - simMain, dNose = (nBot + OFF[1]) - simNose;
const wbModel = (mX[0]+mX[1])/2 - (nX[0]+nX[1])/2;
const wbSim = bodyOf(iMain, xA) - bodyOf(iNose, xA);
console.log(`gear: main ${(dMain*100).toFixed(1)} cm, nose ${(dNose*100).toFixed(1)} cm off the ` +
            `sim contact plane | wheelbase model ${wbModel.toFixed(3)} sim ${wbSim.toFixed(3)} | ` +
            `track model ${(2*mZ).toFixed(3)} sim ${(2*Math.abs(bodyOf(iMain, [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]]))).toFixed(3)}`);
chk(Math.abs(dMain) < 0.05, `main wheels ${(dMain*100).toFixed(1)} cm off the contact plane`);
chk(Math.abs(dNose) < 0.05, `nose wheel ${(dNose*100).toFixed(1)} cm off the contact plane`);
chk(Math.abs(wbModel - wbSim) < 0.10, `wheelbase model ${wbModel.toFixed(3)} vs sim ${wbSim.toFixed(3)}`);

// ---- hinges ---------------------------------------------------------------
const hbs = HINGED.map(g => ({ g, d: dec[g], hb: makeHingeBinding(dec[g], S) }));
const skin = dec.skin, hbSkin = hbs[0].hb;
// every surface must have caught vertices somewhere
S.forEach((s, si) => {
  const n = hbs.reduce((a, h) => a + h.hb.per[si].idx.length, 0);
  chk(n > 3, `${s.name}: only ${n} verts tagged`);
});

const flex = (ctl) => hbs.map(h => {
  const base = h.d.pos, pos = base.slice();
  applyHinges(h.hb, S, base, pos, ctl);
  return { g: h.g, d: h.d, base, pos };
});
const mean = (r, sid, comp, pred) => {
  let s = 0, n = 0;
  for (let i = 0; i < r.d.nv; i++) {
    if (r.d.sid[i] !== sid) continue;
    if (pred && !pred(r.base[i*3], r.base[i*3+1], r.base[i*3+2])) continue;
    s += r.pos[i*3+comp] - r.base[i*3+comp]; n++;
  }
  return n ? s / n : NaN;
};
const bySkin = rs => rs[0];

// elevator (sid 3): +de -> TE up
let R = flex({ de: 0.30, da: 0.20, dr: 0.25 });
const eDy = mean(bySkin(R), 3, 1, x => x > 3.6);
const eArm = 3.70 - S[2].p[0];
console.log(`elevator TE dy ${(eDy*100).toFixed(1)} cm (expect ~+${(eArm*Math.sin(0.30)*100).toFixed(1)})`);
chk(eDy > 0.5 * eArm * Math.sin(0.30) && eDy < 1.3 * eArm * Math.sin(0.30), 'elevator TE wrong');

// ailerons (sid 1 = G/+z, 2 = D): +da -> G down, D up, antisymmetric
const gDy = mean(bySkin(R), 1, 1, x => x > -0.40);
const dDy = mean(bySkin(R), 2, 1, x => x > -0.40);
console.log(`aileron TE dy: G ${(gDy*100).toFixed(1)} cm  D ${(dDy*100).toFixed(1)} cm`);
chk(gDy < -0.01 && dDy > 0.01, 'aileron signs wrong (+da: G down, D up)');
chk(Math.abs(gDy + dDy) < 0.005, 'ailerons not antisymmetric');

// rudder (sid 4): +dr -> TE toward +z. Hinge rakes 24 deg, so dz still dominates.
const rDz = mean(bySkin(R), 4, 2, x => x > 3.8);
console.log(`rudder TE dz ${(rDz*100).toFixed(1)} cm`);
chk(rDz > 0.05, 'rudder TE should move to +z for +dr');

// nose gear (sid 7..11): +dr steers the wheel LEFT (+z). The axle sits FORWARD
// of the steering post, so its verts swing to +z while the pant's tail swings -z.
const nose = {};
for (const r of R) for (let sid = 7; sid <= 11; sid++) {
  const m = mean(r, sid, 2);
  if (isFinite(m)) nose[S[sid-1].name] = m;
}
console.log('nose gear dz (cm): ' + Object.entries(nose)
  .map(([k, v]) => `${k} ${(v*100).toFixed(1)}`).join('  '));
chk(isFinite(nose.tyreN) && nose.tyreN > 0.005, 'nose wheel should steer +z for +dr');
chk(isFinite(nose.hubN) && nose.hubN > 0.005, 'nose hub must steer with the wheel');
// the axle bolt straddles the steering post, so it turns almost in place:
// assert it MOVES rather than that it translates in a particular direction
let axleMax = 0;
for (const r of R) for (let i = 0; i < r.d.nv; i++)
  if (r.d.sid[i] === 11)
    axleMax = Math.max(axleMax, Math.hypot(r.pos[i*3]-r.base[i*3],
                                           r.pos[i*3+2]-r.base[i*3+2]));
console.log(`nose axle max swing ${(axleMax*1000).toFixed(1)} mm`);
chk(axleMax > 0.001, 'nose axle must turn with the wheel');
chk(Math.abs(nose.tyreN - nose.hubN) < 0.01, 'nose wheel and hub steer apart');
chk(nose.tyreN < rDz, 'nose wheel throw should be smaller than the rudder (k=0.35)');
// the pant straddles the post: forward of it moves +z, aft of it -z
const pantAft = mean(bySkin(R), 7, 2, x => x > -2.5);
chk(pantAft < -0.002, 'nose fairing tail should swing -z when the wheel points +z');

// flaps (sid 5 = G, 6 = D): +flap -> both TE down, symmetric
const F = flex({ flap: 1 });
const fG = mean(bySkin(F), 5, 1, x => x > -0.40);
const fD = mean(bySkin(F), 6, 1, x => x > -0.40);
const fArm = -0.35 - S[4].p[0];
const fExp = -fArm * Math.sin(S[4].k);
console.log(`flap TE dy: G ${(fG*100).toFixed(1)} cm  D ${(fD*100).toFixed(1)} cm ` +
            `(expect ~${(fExp*100).toFixed(1)}, k=${S[4].k})`);
chk(fG < 0.4 * fExp && fG > 1.4 * fExp, 'flapG magnitude/sign off (+flap: TE down)');
chk(Math.abs(fG - fD) < 0.005, 'flaps not symmetric (contrast: ailerons are antisymmetric)');
chk(Math.abs(mean(bySkin(F), 3, 1, x => x > 3.6)) < 1e-6, 'flap leaked onto the elevator');

// no leak: untagged verts must not move, anywhere, in any rigged group
let leak = 0, nan = false;
for (const r of R) for (let i = 0; i < r.d.nv; i++) {
  const d = Math.abs(r.pos[i*3]-r.base[i*3]) + Math.abs(r.pos[i*3+1]-r.base[i*3+1]) +
            Math.abs(r.pos[i*3+2]-r.base[i*3+2]);
  if (!isFinite(d)) nan = true;
  if (!r.d.sid[i] && d > 0) leak++;
}
chk(!nan, 'NaN after hinge pass');
chk(leak === 0, `${leak} untagged verts moved`);

// ---- flex binding ---------------------------------------------------------
const CFG = { tags: ['WF', 'WR'], zRoot: 2.00, xMax: 1.5 };
const bind = makeSkinBinding(skin.pos, skin.nv, def, CFG);
let nP = 0, nN = 0, outOfBand = 0;
for (let j = 0; j < bind.bound.length; j++) {
  const i = bind.bound[j], x = skin.pos[i*3], z = skin.pos[i*3+2];
  if (Math.abs(z) < CFG.zRoot || x > CFG.xMax) outOfBand++;
  (z > 0 ? nP++ : nN++);
}
console.log(`flex band: ${bind.bound.length}/${skin.nv} skin verts bound ` +
            `(L ${nP} / R ${nN}), stations ${Array.from(bind.zs).join(',')}`);
chk(bind.bound.length > 500, `only ${bind.bound.length} verts flex-bound`);
chk(nP === nN, `flex band not L/R symmetric (${nP} vs ${nN})`);
chk(outOfBand === 0, `${outOfBand} bound verts outside the band`);
chk(bind.zs.length === 3 && Math.abs(bind.zs[2] - 5.50) < 0.01, 'spar stations wrong');
// the stabiliser reaches |z| 1.72 and must be excluded by xMax, not by luck
let stabBound = 0;
for (let j = 0; j < bind.bound.length; j++)
  if (skin.pos[bind.bound[j]*3] > 2.4) stabBound++;
chk(stabBound === 0, `${stabBound} tail verts caught by the wing flex band`);
// the strut fitting rides the wing (|z| 2.62); the fuel cap (|z| 1.86) does not
const mBind = makeSkinBinding(dec.metal.pos, dec.metal.nv, def, CFG);
console.log(`metal group: ${mBind.bound.length}/${dec.metal.nv} bound (strut fittings)`);
chk(mBind.bound.length > 0, 'strut fittings should follow the wing');
for (let j = 0; j < mBind.bound.length; j++)
  chk(Math.abs(dec.metal.pos[mBind.bound[j]*3+2]) > 2.0, 'fuel caps must stay rigid');

// ---- W18b: the PBR import (payload v4) -------------------------------------
// The whole point of importing is that these numbers are the AUTHOR'S, not the
// viewer's guesses, so the gate checks they arrived and are in range rather
// than checking specific values — a re-export of the source model may legally
// move them. What it does pin is the physical sense the import depends on:
// every map named must exist in texs, and a metalRough map must be shared
// between the roughness and metalness slots (it is one glTF texture).
const M = MODEL_C172.mats, T = MODEL_C172.texs;
chk(MODEL_C172.v >= 4, `payload is v${MODEL_C172.v} — the PBR import did not run`);
let withPbr = 0, maps = 0;
for (const name in M) {
  const m = M[name];
  if (m.rough === undefined && m.metal === undefined) continue;
  withPbr++;
  chk(m.rough >= 0 && m.rough <= 1, `${name}: roughness ${m.rough} out of range`);
  chk(m.metal >= 0 && m.metal <= 1, `${name}: metalness ${m.metal} out of range`);
  for (const k of ['mr', 'nrm']) if (m[k]) {
    maps++;
    chk(!!T[m[k]], `${name}: ${k} map "${m[k]}" is not in texs`);
    chk(/^data:image\//.test(T[m[k]] || ''), `${name}: ${k} map is not a data URI`);
  }
  if (m.emis) {
    chk(!!m.tex && !!T[m.tex],
        `${name}: emissive without a base map to reuse — that would cost a second texture`);
    chk(m.emis.length === 3, `${name}: emissive factor is not a colour`);
  }
}
console.log(`pbr: ${withPbr} materials carry factors, ${maps} data maps | ` +
            `skin r=${M.skin.rough} m=${M.skin.metal} nrm=${!!M.skin.nrm} | ` +
            `metal r=${M.metal.rough} m=${M.metal.metal}`);
chk(withPbr >= 15, `only ${withPbr} materials carry PBR — the usemtl join lost most of them`);
chk(maps >= 3, `only ${maps} data maps survived`);
// the two the import exists to get right: painted skin is a DIELECTRIC however
// glossy, bare metal is not. Get these backwards and the livery turns to sky.
chk(M.skin.metal < 0.1, `skin metalness ${M.skin.metal} — paint is not a metal`);
chk(M.metal.metal > 0.5, `metal metalness ${M.metal.metal} — bare metal should be metallic`);
chk(M.skin.rough < 0.6, `skin roughness ${M.skin.rough} — a polished airframe is not chalk`);

console.log(why.join('\n'));
console.log(ok ? 'GATE C172M: PASS' : 'GATE C172M: FAIL');
process.exit(ok ? 0 : 1);
