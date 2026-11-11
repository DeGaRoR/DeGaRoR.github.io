// AERO-BODY prototype: the built core with hooks (node only, no game file touched). globalThis.__AB = { on, rec, ... }
// rec (what the join would measure off the drawing): { rows: [{x,w,yb,yt}] nose -> closure end (frame x, keel y, half w),
//   closeX, base: {w,h} | null, rod: {x0,x1,d} | null, tailOnBody }
const fs = require('fs');
const F = '/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js';
let src = fs.readFileSync(F, 'utf8');
function rep(a, b) { const n = src.split(a).length - 1; if (n !== 1) throw new Error('hook not found once (' + n + '): ' + a.slice(0, 80)); src = src.replace(a, () => b); }
const ON = 'globalThis.__AB && globalThis.__AB.on';
// P1 the tail-arm floor: not on boom layouts
rep('S.fuse.tailArm = Math.max(S.fuse.tailArm, S.fuse.boxRear + 0.9 * w.chord);',
    'S.fuse.tailArm = (' + ON + ') ? globalThis.__AB.tailArm(S, w) : Math.max(S.fuse.tailArm, S.fuse.boxRear + 0.9 * w.chord);');
// P2 the body: the drawn rows, the base, the rod; the side areas
rep('  const wet = genFusSwet(S, ST);\n',
    '  if (' + ON + ') { const sd = globalThis.__AB.side(S, ST); sFwd = sd.fwd; sAft = sd.aft; }\n' +
    '  const wet = (' + ON + ') ? globalThis.__AB.wet(S, ST, genFusSwet) : genFusSwet(S, ST);\n');
rep('  const f = Math.max(2, wet.L / Math.max(0.1, dEq));\n  const FF = 1 + 60 / (f * f * f) + f / 400;\n', '  const f = Math.max(2, wet.L / Math.max(0.1, dEq));\n  const FF = (wet.FF != null) ? wet.FF : 1 + 60 / (f * f * f) + f / 400;\n');
rep('  const body = wet.swet * (M.cdWet || D.cdWetDefault) * FF * boxK;\n',
    '  const body = wet.swet * (M.cdWet || D.cdWetDefault) * FF * boxK + (wet.extra || 0);\n');
rep('            body, cool, heads, screen, junct, exh },',
    '            body, cool, heads, screen, junct, exh, base: wet.base || 0, rod: wet.rodA || 0, closeL: wet.L },');
rep('    out.fusCdAAft[1] += 0.31 * 2 * (2 * rb * Lb);\n    out.fusCdAAft[2] += 0.31 * 2 * (2 * rb * Lb);',
    '    if (' + ON + ') { const v = 0.31 * 2 * (2 * rb * Lb); out.boomCdAAft = [0, v, v]; } else {\n' +
    '    out.fusCdAAft[1] += 0.31 * 2 * (2 * rb * Lb);\n    out.fusCdAAft[2] += 0.31 * 2 * (2 * rb * Lb); }');
// P3 the params carry the booms' own row
rep('    fusCdA: cda.fusCdA, fusCdAAft: cda.fusCdAAft,',
    '    fusCdA: cda.fusCdA, fusCdAAft: cda.fusCdAAft, ...(cda.boomCdAAft ? { boomCdAAft: cda.boomCdAAft } : {}),');
// P4 the solver flies the booms' side force on the booms
rep('    blob(def.refs.fusDragAft, P_.fusCdAAft);\n',
    '    blob(def.refs.fusDragAft, P_.fusCdAAft);\n    if (def.refs.boomDrag && P_.boomCdAAft) blob(def.refs.boomDrag, P_.boomCdAAft);\n');
// P5 the aft blob at the drawn aft side area's centroid; the booms' blob at theirs
rep('    fusDragAft: [F[F.length-2].BL, F[F.length-2].BR, F[F.length-2].TL, F[F.length-2].TR],',
    '    fusDragAft: (' + ON + ') ? globalThis.__AB.aftRing(S, ST, F) : [F[F.length-2].BL, F[F.length-2].BR, F[F.length-2].TL, F[F.length-2].TR],\n' +
    '    ...((' + ON + ') && globalThis.__AB.boomRing(S, nodes) ? { boomDrag: globalThis.__AB.boomRing(S, nodes) } : {}),');
const m = { exports: {} };
new Function('module', 'require', '__filename', '__dirname', src + '\n;module.exports.__priv={genProbeAt,genAlphaForLift,genStallAngle,genFusSwet,GEN_MATERIALS,GEN_DRAG,GEN_RULES};')(m, require, F, '/workspace/DeGaRoR.github.io/flyDiy/tools');
const C = m.exports;

// ---------------------------------------------------------------------------------------------------------------------
const CD_BASE = 0.14;        // Raymer, Aircraft Design 12.37: D/q = (0.139 + 0.419 (M - 0.161)^2) A_base, M 0.1-0.2
const CF_ROD = 0.004;        // the twin booms' own skin coefficient (62_gen_aero TWIN BOOMS: 0.004 x 2 pi r L)
const XF_SIDE = 0.31;
const MODEL = process.env.AB_MODEL || 'B';
const THETA_SEP = (+process.env.AB_THETA || 20) * Math.PI / 180;   // a closure steeper than this sheds its flow (Hoerner ch. 3 boattails: 15-20 deg)
const GEN_MATERIALS_REF = () => C.__priv.GEN_MATERIALS, GEN_DRAG_REF = () => C.__priv.GEN_DRAG;        // the aft cross-flow row (62_gen_aero genFusCdA), as the twin booms already wear it
const ell = (w, h) => Math.PI / 4 * w * h;      // full width, full height
const integ = (rows, a, b) => {                 // side area and its first moment over [a, b]
  let A = 0, Mx = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    const p = rows[i], q = rows[i + 1];
    const x0 = Math.max(a, p.x), x1 = Math.min(b, q.x); if (!(x1 > x0)) continue;
    const hAt = x => { const u = (x - p.x) / Math.max(1e-9, q.x - p.x); return (p.yt - p.yb) + ((q.yt - q.yb) - (p.yt - p.yb)) * u; };
    const s = 0.5 * (hAt(x0) + hAt(x1)) * (x1 - x0); A += s; Mx += s * 0.5 * (x0 + x1);
  }
  return { A, Mx };
};
function makeAB(rec) {
  const AB = { on: true, rec };
  AB.tailArm = (S, w) => {
    const tb = S.tail && S.tail.type === 'twinBoom';
    if (tb) return Math.max(S.fuse.tailArm, rec.closeX);          // the pod's lattice ends where the drawn pod does
    if (S.fuse.boom === 'rod') return S.fuse.tailArm;              // the rod is the tail arm, no floor
    return Math.max(S.fuse.tailArm, S.fuse.boxRear + 0.9 * w.chord);
  };
  AB.cabRear = S => S.cab.noseGap + S.cab.len;
  AB.old = (S, ST) => {          // genFusCdA's own split, unchanged
    const cabLen = S.cab && S.cab.len, R = C.__priv.GEN_RULES;
    const iCR = (R.cabBayMax > 0 && cabLen > R.cabBayMax + 1e-6) ? Math.max(2, ST.findIndex(s => Math.abs(s.x - (S.cab.noseGap + cabLen)) < 1e-6)) : 2;
    let fwd = 0, aft = 0;
    for (let i = 0; i < ST.length - 1; i++) { const a = ST[i], b = ST[i + 1]; const A = 0.5 * ((a.yt - a.yb) + (b.yt - b.yb)) * (b.x - a.x); if (i < iCR) fwd += A; else aft += A; }
    return { fwd, aft };
  };
  AB.side = (S, ST) => {
    if (rec.tailOnBody) return { fwd: AB.old(S, ST).fwd, aft: AB.old(S, ST).aft };
    const cr = Math.min(AB.cabRear(S), rec.closeX);
    const f = integ(rec.rows, 0, cr), a = integ(rec.rows, cr, rec.closeX);
    let aft = a.A, mx = a.Mx;
    if (rec.rod) { const L = rec.rod.x1 - rec.rod.x0, kR = (+process.env.AB_RODCD || XF_SIDE) / XF_SIDE; aft += kR * rec.rod.d * L; mx += kR * rec.rod.d * L * 0.5 * (rec.rod.x0 + rec.rod.x1); }
    AB.aftX = aft > 1e-6 ? mx / aft : rec.closeX;
    return { fwd: f.A, aft };
  };
  AB.wet = (S, ST, genFusSwet) => {
    const T = rec.rows.map(r => ({ x: r.x, w: r.w, yb: r.yb, yt: r.yt }));
    const cl = S.cowl && S.cowl.len; if (S.cowl) S.cowl.len = 0;      // the nose is in the rows (the drawn cowl)
    const full = genFusSwet(S, T);
    const rodA = rec.rod ? CF_ROD * Math.PI * rec.rod.d * (rec.rod.x1 - rec.rod.x0) : 0;
    const Arod = rec.rod ? ell(rec.rod.d, rec.rod.d) : 0;
    let out;
    if (MODEL === 'A' || rec.tailOnBody) {
      // A: Raymer's FF on the drawn length, plus Raymer's base term on the drawn end (12.37)
      let Ab = rec.base ? ell(rec.base.w, rec.base.h) : 0;
      if (rec.base && rec.rod) Ab = Math.max(0, Ab - Arod);
      out = Object.assign(full, { extra: CD_BASE * Ab + rodA, base: CD_BASE * Ab, rodA, Ab });
    } else {
      // B: a body that ends in a base or a steep closure is a FOREBODY and a BASE (Hoerner, Fluid-Dynamic Drag ch. 3 and
      // 6): the flow leaves the skin where the closure is steeper than THETA_SEP (its equivalent radius), the forebody to
      // there pays friction x (1 + 1.5 / f^1.5) (Hoerner's streamline-body law without its afterbody term), the base the
      // section there at Cd_b = 0.029 / sqrt(Cd_forebody on the base) (Hoerner's base-drag law)
      const A = T.map(r => ell(2 * r.w, r.yt - r.yb)), req = A.map(a => Math.sqrt(a / Math.PI));
      let iM = 0; for (let i = 1; i < A.length; i++) if (A[i] > A[iM]) iM = i;
      let iS = T.length - 1;
      for (let i = iM + 1; i < T.length; i++) {
        const sl = -(req[i] - req[i - 1]) / Math.max(1e-6, T[i].x - T[i - 1].x);
        if (sl > Math.tan(THETA_SEP)) { iS = i - 1; break; }
      }
      const Tf = T.slice(0, iS + 1);
      const fore = genFusSwet(S, Tf);
      const dEq = Math.sqrt(4 * Math.max(1e-6, full.frontal) / Math.PI);
      const fF = Math.max(1, fore.L / dEq), FF = 1 + 1.5 / Math.pow(fF, 1.5);
      const M = GEN_MATERIALS_REF()[S.material] || GEN_MATERIALS_REF().tubeFabric;
      const crown = 0.5 * (((S.fuse || {}).crownTop == null ? 0.72 : S.fuse.crownTop) + Math.min(1, ((S.fuse || {}).crownSide == null ? 0.07 : S.fuse.crownSide) / 0.6));
      const boxK = 1 + GEN_DRAG_REF().boxK * (1 - crown);
      const cdFore = fore.swet * (M.cdWet || GEN_DRAG_REF().cdWetDefault) * FF * boxK;
      let Ab = (iS < T.length - 1 || rec.base) ? Math.max(0, A[iS] - (rec.rod ? Arod : 0)) : 0;
      const cdB = Ab > 1e-4 ? (process.env.AB_CDB === 'hoerner' ? 0.029 / Math.sqrt(Math.max(1e-4, cdFore / Ab)) : CD_BASE) : 0;
      out = { swet: fore.swet, L: fore.L, frontal: full.frontal, vol: full.vol, FF, extra: cdB * Ab + rodA, base: cdB * Ab, rodA, Ab, cdB, xSep: T[iS].x };
    }
    if (S.cowl) S.cowl.len = cl;
    AB.wetOut = out;
    return out;
  };
  AB.aftRing = (S, ST, F) => {
    if (rec.tailOnBody) { AB.aftRingX = ST[F.length - 2].x; return [F[F.length-2].BL, F[F.length-2].BR, F[F.length-2].TL, F[F.length-2].TR]; }
    if (AB.aftX == null) AB.side(S, ST);
    const cr = AB.cabRear(S); let best = F.length - 2, bd = 1e9;
    for (let i = 1; i < ST.length; i++) { if (ST[i].x <= cr + 1e-6) continue; const d = Math.abs(ST[i].x - AB.aftX); if (d < bd) { bd = d; best = i; } }
    AB.aftRingX = ST[best].x;
    return [F[best].BL, F[best].BR, F[best].TL, F[best].TR];
  };
  AB.boomRing = (S, nodes) => {
    const t = S.tail; if (!(t && t.type === 'twinBoom' && t.boomLen > 0)) return null;
    const xc = (t.boomX || 0) + 0.5 * t.boomLen, pick = [];
    for (const sd of ['L', 'R']) for (const k of ['T', 'I']) {
      let bi = -1, bd = 1e9; nodes.forEach((n, i) => { if (n.tag === 'BM' + sd + k) { const d = Math.abs(n.p[0] - xc); if (d < bd) { bd = d; bi = i; } } });
      if (bi >= 0) pick.push(bi);
    }
    if (pick.length !== 4) return null;
    AB.boomX = pick.reduce((a, i) => a + nodes[i].p[0], 0) / 4;
    return pick;
  };
  return AB;
}

// the drawn body, measured off the headless editor's own scene (probe_af.js: the drawn skin's sampler; probe_cowl.js:
// the cowl layer's slices) - what the join would hand the core
function recOf(k, dir) {
  const o = JSON.parse(fs.readFileSync(dir + '/probe_' + k + '.json')), cw = JSON.parse(fs.readFileSync(dir + '/cowl_' + k + '.json'));
  const sp = JSON.parse(fs.readFileSync(dir + '/spec_' + k + '.json')).spec, c = sp.cage || {};
  const zF = o.datum.zFw, yD = o.datum.yD;
  const af = o.rows.map(r => ({ x: zF - r[0], w: r[1], yb: r[2] - yD, yt: r[3] - yD })).sort((a, b) => a.x - b.x);
  // the cowl layer's silhouette (probe_cowl2.js: its triangles cut column by column, side and plan)
  const c2p = dir + '/cowl2_' + k + '.json';
  const cowl = fs.existsSync(c2p) ? JSON.parse(fs.readFileSync(c2p)).cols.map(b => ({ x: zF - b[0], w: b[1], yb: b[2] - yD, yt: b[3] - yD }))
    .filter(r => r.w > 0.004 && r.yt - r.yb > 0.004).sort((a, b) => a.x - b.x) : [];
  const aftCowl = !!(cw.cowl && cw.cowl.units && cw.cowl.units[0] && cw.cowl.units[0].aft);
  const ps = +c.planeScale || 1, boomRod = Math.round(+c.boomStyle || 0) === 1 && !+c.boomTwin;
  const d = boomRod ? (+c.rodD || 0.12) * ps : 0;
  const open = sp.fuselage && sp.fuselage.covering === 'open';
  // the drawn skin: where it is bigger than the rod it is the body
  let rows = af.filter(r => r.w > 0.004 && r.yt - r.yb > 0.004);
  let rod = null, closeX = rows[rows.length - 1].x, base = null, tailOnBody = !boomRod && !+c.boomTwin;
  if (boomRod) {
    const isRod = r => 2 * r.w < 1.6 * d && r.yt - r.yb < 1.6 * d;
    const hMax = Math.max(...rows.map(r => r.yt - r.yb));
    let iEnd = rows.findIndex((r, i) => i > 2 && isRod(r));
    // an unpanelled taper is a bare truss (the user: "a tube of its real diameter, nothing more"): the body ends where it starts
    if (+c.taperOn && !+c.taperPanels) {
      const iMax = rows.findIndex(r => r.yt - r.yb >= 0.97 * hMax);
      let iT = rows.findIndex((r, i) => i > iMax && r.yt - r.yb < 0.97 * hMax);
      if (iT > 0 && (iEnd < 0 || iT < iEnd)) iEnd = iT;
    }
    const rodEnd = rows[rows.length - 1].x;
    const body = rows.slice(0, iEnd);
    const last = body[body.length - 1];
    closeX = last.x;
    rod = { x0: closeX, x1: rodEnd, d };
    base = { w: 2 * last.w, h: last.yt - last.yb };   // (an open frame too: the delta it pays is over a faired pod of its size)
    rows = body;
  } else if (+c.boomTwin) {
    tailOnBody = false;
    const last = rows[rows.length - 1];
    base = { w: 2 * last.w, h: last.yt - last.yb };
  }
  // the cowls: the nose's ahead of the drawn skin, a pusher's aft face behind it
  if (cowl.length) {
    if (aftCowl) {
      const tail = cowl.filter(r => r.x > closeX - 0.02);
      const keep = rows.filter(r => r.x < tail[0].x - 1e-6);
      rows = keep.concat(tail); closeX = rows[rows.length - 1].x;
      const ex = rows[rows.length - 1]; base = { w: 2 * ex.w, h: ex.yt - ex.yb };
      if (rod) rod.x0 = Math.max(rod.x0, closeX);
    } else {
      const head = cowl.filter(r => r.x < rows[0].x + 0.02);
      const x0 = head.length ? head[head.length - 1].x : -1e9;
      rows = head.concat(rows.filter(r => r.x > x0 + 1e-6));
    }
  }
  // thin to ~4 cm (the slices are 2 cm), keep the ends
  const T = []; for (const r of rows) if (!T.length || r.x - T[T.length - 1].x >= 0.039 || r === rows[rows.length - 1]) T.push(r);
  return { rows: T, closeX, base, rod, tailOnBody, aftCowl, drawnAll: af, cowl, nose: T[0].x, open };
}

module.exports = { C, makeAB, recOf, CD_BASE };
