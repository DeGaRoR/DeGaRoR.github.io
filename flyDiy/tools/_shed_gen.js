// SHED GENERATOR — the plank-by-plank one (G232, the user: "Maybe the shed
// generator can be its own generator, and would take a plank-by-plank
// approach, making shaky complex structures out of individual beams and
// planks?").
//
// WHY IT IS A SECOND GENERATOR AND NOT A MODE OF THE FIRST. The house is a
// SURFACE model: walls are panels with holes in them, the roof is a set of
// planes, and the boards are a texture. That is right for a building somebody
// squared up, and it is wrong for a woodshed — because a shed IS its members.
// Nothing about it is flush: the studs are whatever was in the pile, the
// boards do not all reach, the sheets overlap by however much was left, and
// the whole thing leans a little. You cannot get that from a panel with a
// texture on it; you get it by putting every stick in place and letting each
// one be slightly wrong.
//
// SO EVERYTHING HERE IS A MEMBER. Sills, blocks, posts, studs, plates,
// rafters, purlins, every cladding board, every roof sheet, the door and its
// braces: each is one `beam` from the shared kit, each with its own jitter off
// the nominal, all of it deterministic in `seed` so a shed can be found again.
// `shake` is the one dial that says how badly it was built.
//
// IT SHARES THE HOUSE'S MATERIALS on purpose (HOUSE_GEN.MAT / BAGS /
// applyFinish): the same scanned library, the same texel density, the same
// dirt gradient and paint punch. A shed beside a house must be made of the
// same wood or the pair reads as two games.
'use strict';
(() => {
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, off, lerp3,
        Bag, face, uvFrame, boxAB, beam, plate, cyl, wall } = K;
const D2R = Math.PI / 180;
const BAGS = HG.BAGS;

// ---- the parameter model --------------------------------------------------
const DEF = {
  seed: 3, shake: 0.55,
  L: 3.60, w: 2.60, wallH: 2.10, pitch: 16, gable: 0,
  slopeZ: 4, slopeX: 0, floorY: 0.34, stance: 0,      // 0 skids, 1 blocks
  studSpc: 0.62, memW: 0.075, memH: 0.115,
  clad: 0, boardW: 0.22, boardGap: 0.012, missing: 0.05, batten: 1,
  roofKind: 0, sheetW: 0.82, sheetLap: 0.07,
  openFront: 0, door: 1, doorW: 0.85, doorAjar: 0,
  window: 1, winW: 0.55, winH: 0.45,
  firewood: 0, pipe: 0, floorBoards: 1,
  // THE FINISH, and the whole point of building a shed plank by plank: every
  // board here is ONE board, so all of it — cladding included — takes a
  // VENEER. A plank scan on a 200 mm board draws joints across a board that
  // has none, which is the flat, repeated look the first cut had.
  wallSet: HG.SET_IDX('deck', 'stain'), wallCol: 0,
  trimSet: HG.SET_IDX('trim', 'veneerdark'), trimCol: 0,
  roofSet: HG.SET_IDX('roof', 'corrrust'), roofCol: 0,
  deckSet: HG.SET_IDX('deck', 'darkwood'), floorSet: HG.SET_IDX('floor', 'deckwood'),
  postSet: HG.SET_IDX('post', 'veneerdark'),
  postCol: 0, deckCol: 0, metalSet: 0, metalCol: 0,
  dirt: 0.55, dirtH: 0.85, paintPunch: 0.35,
  // a shed is ALL crevice - every board has two edges and every member sits
  // proud of the next - so it is baked harder and shorter than the house
  ao: 0.92, aoRange: 0.42, aoDirect: 0.38,
};

const CLADS = ['board and batten', 'lapped', 'shakes', 'gappy slats'];
const ROOFS = ['corrugated sheet', 'boards', 'shakes'];
const ROWS = [
  ['the shed', [
    ['seed', 'seed', 1, 999, 1],
    ['shake', 'how badly built', 0, 1.4, 0.02],
    ['L', 'length', 1.6, 9.0, 0.05],
    ['w', 'depth', 1.2, 5.0, 0.05],
    ['wallH', 'wall height', 1.5, 3.2, 0.05],
    ['gable', 'roof', 0, 1, 1, ['shed (mono)', 'gable']],
    ['pitch', 'pitch', 6, 40, 0.5],
    ['floorY', 'floor above datum', 0.10, 1.60, 0.01],
    ['stance', 'stands on', 0, 1, 1, ['skids', 'blocks + posts']],
    ['slopeZ', 'ground slope', -20, 20, 0.5],
  ]],
  ['the frame', [
    ['studSpc', 'stud spacing', 0.35, 1.20, 0.01],
    ['memW', 'member width', 0.04, 0.14, 0.005],
    ['memH', 'member depth', 0.06, 0.20, 0.005],
    ['floorBoards', 'floor boards', 0, 1, 1],
  ]],
  ['the cladding', [
    ['clad', 'walls', 0, 3, 1, CLADS],
    ['boardW', 'board width', 0.10, 0.40, 0.005],
    ['boardGap', 'gap', 0, 0.06, 0.002],
    ['missing', 'boards missing', 0, 0.35, 0.01],
    ['batten', 'battens', 0, 1, 1, null, P => Math.round(P.clad) === 0],
    ['roofKind', 'roof', 0, 2, 1, ROOFS],
    ['sheetW', 'sheet width', 0.4, 1.4, 0.02],
    ['sheetLap', 'lap', 0.02, 0.20, 0.005],
  ]],
  ['what is in it', [
    ['openFront', 'open front', 0, 1, 1],
    ['door', 'door', 0, 1, 1, null, P => !P.openFront],
    ['doorW', 'door width', 0.6, 1.6, 0.02, null, P => !P.openFront && !!P.door],
    ['doorAjar', 'door ajar', 0, 80, 1, null, P => !P.openFront && !!P.door],
    ['window', 'window', 0, 1, 1, null, P => !P.openFront],
    ['winW', 'window width', 0.3, 1.2, 0.02, null, P => !!P.window],
    ['winH', 'window height', 0.25, 1.0, 0.02, null, P => !!P.window],
    ['firewood', 'stacked cordwood', 0, 1, 1],
    ['pipe', 'stove pipe', 0, 1, 1],
  ]],
  ['finish', [
    ['wallSet', 'boards', 0, HG.ROLE_SETS.deck.length - 1, 1,
     HG.setNames('deck')],
    ['wallCol', 'board paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['trimSet', 'frame', 0, HG.ROLE_SETS.trim.length - 1, 1,
     HG.setNames('trim')],
    ['trimCol', 'frame paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['roofSet', 'roof', 0, HG.ROLE_SETS.roof.length - 1, 1,
     HG.setNames('roof')],
    ['roofCol', 'roof paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['postSet', 'posts', 0, HG.ROLE_SETS.post.length - 1, 1,
     HG.setNames('post')],
    ['deckSet', 'floor', 0, HG.ROLE_SETS.deck.length - 1, 1,
     HG.setNames('deck')],
    ['paintPunch', 'paint punch', 0, 1, 0.02],
    ['dirt', 'ground dirt', 0, 1, 0.02],
    ['dirtH', 'how far it climbs', 0.2, 2.5, 0.05, null, P => P.dirt > 0.01],
    ['ao', 'baked occlusion', 0, 1, 0.02],
    ['aoRange', 'how far it reaches', 0.15, 1.20, 0.05, null, P => P.ao > 0.01],
    ['aoDirect', 'on direct light', 0, 0.8, 0.02, null, P => P.ao > 0.01],
  ]],
];

const PRESETS = {
  'wood shed': { openFront: 1, firewood: 1, clad: 3, missing: 0.12,
                 shake: 0.7, L: 3.8, w: 2.6, roofKind: 0, gable: 0,
                 pitch: 14, door: 0, window: 0 },
  'tool shed': { openFront: 0, door: 1, window: 1, clad: 0, gable: 1,
                 pitch: 26, L: 2.6, w: 2.0, wallH: 1.95, shake: 0.35,
                 roofKind: 2, missing: 0.02 },
  'trapper cabin': { L: 4.2, w: 3.2, wallH: 2.05, gable: 1, pitch: 32,
                     clad: 2, roofKind: 2, shake: 0.85, missing: 0.03,
                     pipe: 1, window: 1, stance: 1, floorY: 0.55,
                     wallSet: HG.SET_IDX('deck', 'stain'),
                     roofSet: HG.SET_IDX('roof', 'shingle') },
  'net store': { L: 6.0, w: 3.0, wallH: 2.35, gable: 0, pitch: 12,
                 clad: 1, roofKind: 0, shake: 0.5, missing: 0.08,
                 stance: 1, floorY: 0.75, doorW: 1.3,
                 wallSet: HG.SET_IDX('deck', 'greywood'),
                 roofSet: HG.SET_IDX('roof', 'corrworn') },
  'lean-to': { L: 3.2, w: 1.9, wallH: 1.85, gable: 0, pitch: 22, clad: 3,
               openFront: 1, missing: 0.18, shake: 1.0, roofKind: 1,
               firewood: 1 },
};

// ---------------------------------------------------------------------------
// THE SHAKE
// ---------------------------------------------------------------------------
// One seeded stream, and every member draws from it. `j(k)` is a jitter in
// metres, `a(k)` one in radians: both scale with `shake`, so the same shed at
// shake 0 is square joinery and at shake 1 was thrown up in an afternoon.
function rng(seed) {
  let st = ((seed | 0) || 1) >>> 0;
  return () => (st = (st * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function build(P0, lod) {
  const P = Object.assign({}, DEF, P0 || {});
  const Q = { lod: lod | 0 };
  const bags = {};
  for (const k of BAGS) bags[k] = Bag(k);
  const rnd = rng(P.seed);
  const sh = clamp(P.shake, 0, 1.4);
  const j = k => (rnd() * 2 - 1) * k * sh;
  const g = HG.groundFn(P);
  const L = P.L, w = P.w, mw = P.memW, mh = P.memH;
  const x0 = -L / 2, x1 = L / 2, z0 = -w / 2, z1 = w / 2;
  const yF = P.floorY;                     // top of the floor
  const gable = Math.round(P.gable) === 1;
  const k = Math.tan(clamp(P.pitch, 4, 45) * D2R);
  // the plate line: a mono-pitch shed is high at the FRONT (+z)
  const plateAt = (x, z) => gable
    ? yF + P.wallH + (w / 2 - Math.abs(z)) * k
    : yF + P.wallH + (z + w / 2) * k;
  const wallTop = (x, z) => gable ? yF + P.wallH : plateAt(x, z);
  const marks = { members: 0, boards: 0, missing: 0 };

  // ---- what it stands on ---------------------------------------------------
  const sillY = yF - mh / 2;
  if (Math.round(P.stance) === 0) {
    for (const z of [z0 + mw, z1 - mw]) {
      const y = Math.max(g(x0, z), g(x1, z)) + mh / 2 + 0.02;
      beam(bags.deck, [x0 - 0.12, y + j(0.01), z + j(0.01)],
           [x1 + 0.12, y + j(0.01), z + j(0.01)], mh * 0.75, mh * 0.75,
           [0, 1, 0], 0, { swap: true, uv: [z * 3, 0] });
      marks.members++;
      const n = Math.max(2, Math.round(L / 1.5));
      for (let i = 0; i <= n; i++) {
        const x = x0 + L * i / n + j(0.06);
        const gy = g(x, z);
        if (y - mh - gy < 0.02) continue;
        boxAB(bags.stone, [x - 0.13, gy - 0.06, z - 0.13],
              [x + 0.13, y - mh * 0.7, z + 0.13], null, [x, z]);
        marks.members++;
      }
    }
  } else {
    for (const zz of [z0 + mw, z1 - mw]) for (const sxi of [0, 1, 2]) {
      const x = x0 + (x1 - x0) * sxi / 2 + j(0.05);
      const gy = g(x, zz);
      boxAB(bags.stone, [x - 0.14, gy - 0.08, zz - 0.14],
            [x + 0.14, gy + 0.12, zz + 0.14], null, [x, zz]);
      beam(bags.post, [x + j(0.02), gy + 0.12, zz + j(0.02)],
           [x, sillY, zz], mw * 0.9, mw * 0.9, [0, 0, 1],
           0, { swap: true, uv: [x + zz, 0] });
      marks.members += 2;
    }
    for (const zz of [z0 + mw, z1 - mw])
      beam(bags.deck, [x0 - 0.10, sillY, zz], [x1 + 0.10, sillY, zz],
           mh * 0.7, mh * 0.7, [0, 1, 0], 0, { swap: true, uv: [zz * 3, 0] });
  }
  // the floor itself, board by board
  if (P.floorBoards) {
    if (Q.lod === 0) {
      const bw = 0.19;
      const n = Math.max(1, Math.floor((w - 0.02) / (bw + 0.008)));
      for (let i = 0; i < n; i++) {
        const z = z0 + 0.01 + i * (bw + 0.008);
        boxAB(bags.deck, [x0 + j(0.02), yF - 0.032, z + j(0.004)],
              [x1 + j(0.02), yF, z + bw + j(0.004)], null,
              [(i * 37 % 23) * 0.31, (i * 91 % 17) * 0.23]);
        marks.boards++;
      }
    } else boxAB(bags.deck, [x0, yF - 0.032, z0], [x1, yF, z1]);
  }

  // ---- the frame -----------------------------------------------------------
  const posts = [];
  const corner = (x, z) => {
    const top = wallTop(x, z);
    beam(bags.trim, [x + j(0.012), yF - 0.04, z + j(0.012)],
         [x + j(0.02), top, z + j(0.02)], mw, mw, [0, 0, 1], 0,
         { swap: true, uv: [x * 2 + z, 0] });
    posts.push([x, z]);
    marks.members++;
  };
  const inset = mw;
  const cx0 = x0 + inset, cx1 = x1 - inset, cz0 = z0 + inset, cz1 = z1 - inset;
  for (const x of [cx0, cx1]) for (const z of [cz0, cz1]) corner(x, z);

  if (Q.lod === 0) {
    // studs: down each side, skipping where the door is
    const nS = Math.max(1, Math.round(L / P.studSpc));
    const doorS = P.door && !P.openFront
      ? [L * 0.5 - P.doorW / 2 - 0.05, L * 0.5 + P.doorW / 2 + 0.05] : null;
    for (const z of [cz0, cz1]) {
      const front = z > 0;
      if (front && P.openFront) continue;
      for (let i = 1; i < nS; i++) {
        const s = L * i / nS;
        if (front && doorS && s > doorS[0] && s < doorS[1]) continue;
        const x = x0 + s + j(0.03);
        beam(bags.trim, [x, yF - 0.02, z + j(0.01)],
             [x + j(0.05), wallTop(x, z), z + j(0.02)], mw * 0.7, mw * 0.7,
             [0, 0, 1], 0, { swap: true, uv: [x, 0] });
        marks.members++;
      }
    }
    for (const x of [cx0, cx1]) {
      const nD = Math.max(1, Math.round(w / P.studSpc));
      for (let i = 1; i < nD; i++) {
        const z = z0 + w * i / nD + j(0.03);
        beam(bags.trim, [x + j(0.01), yF - 0.02, z],
             [x + j(0.02), wallTop(x, z), z + j(0.04)], mw * 0.7, mw * 0.7,
             [0, 0, 1], 0, { swap: true, uv: [z, 0] });
        marks.members++;
      }
    }
  }
  // top plates
  for (const z of [cz0, cz1]) {
    if (z > 0 && P.openFront && Q.lod !== 0) continue;
    beam(bags.trim, [cx0 - mw, wallTop(0, z) + j(0.01), z],
         [cx1 + mw, wallTop(0, z) + j(0.01), z], mw, mw * 0.8, [0, 1, 0],
         0, { swap: true, uv: [z * 5, 0] });
    marks.members++;
  }
  if (P.openFront) {                    // the header over the open side
    beam(bags.trim, [cx0 - mw, wallTop(0, cz1) - mw * 1.2, cz1],
         [cx1 + mw, wallTop(0, cz1) - mw * 1.2, cz1], mw * 1.1, mh * 0.8,
         [0, 1, 0]);
    const nP = Math.max(1, Math.round(L / 1.9));
    for (let i = 1; i < nP; i++) {
      const x = x0 + L * i / nP + j(0.04);
      beam(bags.post, [x, yF - 0.02, cz1 + j(0.01)],
           [x + j(0.03), wallTop(x, cz1) - mw, cz1 + j(0.02)],
           mw * 0.9, mw * 0.9, [0, 0, 1], 0, { swap: true, uv: [x, 0] });
      marks.members++;
    }
  }

  // ---- the roof: rafters, purlins, and sheets one at a time ----------------
  const eaveOv = 0.13 + Math.abs(j(0.03));
  const ridgeY = gable ? yF + P.wallH + (w / 2) * k : plateAt(0, z1);
  const roofPt = (x, z) => [x, gable
    ? yF + P.wallH + (w / 2 - Math.abs(z)) * k : plateAt(x, z), z];
  if (Q.lod === 0) {
    const nR = Math.max(2, Math.round(L / 0.72));
    for (let i = 0; i <= nR; i++) {
      const x = x0 + L * i / nR + j(0.04);
      if (gable) {
        for (const s of [-1, 1]) {
          const a = roofPt(x, s * (w / 2 + eaveOv));
          const b = [x + j(0.03), ridgeY + j(0.01), 0];
          beam(bags.trim, a, b, mw * 0.62, mh * 0.55, [0, 1, 0]);
          marks.members++;
        }
      } else {
        const a = roofPt(x, z0 - eaveOv), b = roofPt(x + j(0.03), z1 + eaveOv);
        beam(bags.trim, a, b, mw * 0.62, mh * 0.55, [0, 1, 0]);
        marks.members++;
      }
    }
    if (gable)
      beam(bags.trim, [x0 - eaveOv, ridgeY + mh * 0.4, 0],
           [x1 + eaveOv, ridgeY + mh * 0.4, 0], mw * 0.6, mh * 0.5, [0, 1, 0]);
    // purlins across them
    const runs = gable ? [-1, 1] : [0];
    for (const s of runs) {
      const zA = gable ? s * (w / 2 + eaveOv) : z0 - eaveOv;
      const zB = gable ? 0 : z1 + eaveOv;
      const nP2 = 3;
      for (let i = 1; i < nP2; i++) {
        const t = i / nP2;
        const za = zA + (zB - zA) * t;
        const a = roofPt(x0 - eaveOv, za), b = roofPt(x1 + eaveOv, za + j(0.02));
        beam(bags.trim, off(a, [0, 1, 0], mh * 0.45),
             off(b, [0, 1, 0], mh * 0.45), mw * 0.5, mw * 0.5, [0, 1, 0]);
        marks.members++;
      }
    }
  }
  // the covering
  const sheetRuns = gable ? [-1, 1] : [1];
  for (const s of sheetRuns) {
    const zEave = gable ? s * (w / 2 + eaveOv) : z0 - eaveOv;
    const zTop = gable ? 0 : z1 + eaveOv;
    const A = roofPt(x0 - eaveOv, zEave), B = roofPt(x0 - eaveOv, zTop);
    const up = nrm(sub(B, A));
    const runLen = len(sub(B, A));
    const kind = Math.round(P.roofKind);
    if (Q.lod !== 0 || kind === 0) {
      // sheets, across the slope, each lapped over the last
      const wSheet = Q.lod === 0 ? P.sheetW : Math.max(P.sheetW, L / 2);
      const n = Math.max(1, Math.ceil((L + 2 * eaveOv) / (wSheet - P.sheetLap)));
      for (let i = 0; i < n; i++) {
        const xa = x0 - eaveOv + i * (wSheet - P.sheetLap);
        const xb = Math.min(xa + wSheet, x1 + eaveOv);
        if (xb - xa < 0.05) continue;
        const a2 = roofPt((xa + xb) / 2, zEave), b2 = roofPt((xa + xb) / 2, zTop);
        const tilt = Q.lod === 0 ? j(0.012) : 0;
        beam(bags.roof, off(a2, [0, 1, 0], 0.012 + tilt),
             off(b2, [0, 1, 0], 0.012 - tilt), (xb - xa) / 2, 0.012,
             nrm(crs(up, [1, 0, 0])), 0, { uv: [i * 0.37, 0] });
        marks.boards++;
      }
    } else {
      // boards or shakes: courses UP the slope, each overlapping the one below
      const cw = kind === 1 ? 0.24 : 0.16;
      const lap = kind === 1 ? 0.04 : 0.055;
      const n = Math.max(1, Math.ceil(runLen / (cw - lap)));
      for (let i = 0; i < n; i++) {
        const t0 = i * (cw - lap) / runLen;
        const c0 = lerp3(A, B, Math.min(1, t0));
        const c1 = lerp3(A, B, Math.min(1, t0 + cw / runLen));
        const mid = lerp3(c0, c1, 0.5);
        // THE COURSE RUNS UP THE SLOPE and the board lies ACROSS it: a
        // beam's hw is measured on X x U, so the roof normal has to be the
        // `up` or the thickness and the course length change places — which
        // is how the first cut produced a roof of 6 mm slivers you could see
        // the rafters through.
        const rn = (() => { const n2 = nrm(crs([1, 0, 0], up));
                            return n2[1] < 0 ? mul(n2, -1) : n2; })();
        const cLen = len(sub(c1, c0));
        if (kind === 1) {
          const ca = off(lerp3(c0, c1, 0.5), rn, 0.012);
          beam(bags.roof, [x0 - eaveOv, ca[1], ca[2]],
               [x1 + eaveOv, ca[1] + j(0.008), ca[2] + j(0.008)],
               cLen / 2, 0.011, rn, 0, { uv: [i * 0.53, 0] });
          marks.boards++;
        } else {
          const nS2 = Math.max(2, Math.round(L / 0.22));
          for (let q = 0; q < nS2; q++) {
            const xa = x0 - eaveOv + (L + 2 * eaveOv) * q / nS2;
            const xb = xa + (L + 2 * eaveOv) / nS2 * (0.94 + 0.10 * rnd());
            const xc = (xa + xb) / 2;
            const a3 = off([xc, c0[1], c0[2]], rn, 0.010 + j(0.003));
            const b3 = off([xc + j(0.01), c1[1], c1[2]], rn, 0.010);
            beam(bags.roof, a3, b3, (xb - xa) / 2, 0.009, rn, 0,
                 { uv: [q * 0.19, i * 0.23] });
            marks.boards++;
          }
        }
      }
    }
  }

  // ---- the cladding, board by board ---------------------------------------
  const clad = Math.round(P.clad);
  const walls = [
    { A: [x0, z1], B: [x1, z1], open: !!P.openFront, front: true },
    { A: [x1, z1], B: [x1, z0] },
    { A: [x1, z0], B: [x0, z0] },
    { A: [x0, z0], B: [x0, z1] },
  ];
  const doorHole = P.door && !P.openFront
    ? { s0: L / 2 - P.doorW / 2, s1: L / 2 + P.doorW / 2, y0: yF - 0.02,
        y1: yF + Math.min(P.wallH - 0.12, 1.95) }
    : null;
  const winHole = P.window
    ? { s0: 0.35, s1: 0.35 + P.winW, y0: yF + P.wallH * 0.52,
        y1: yF + P.wallH * 0.52 + P.winH }
    : null;
  for (let wi = 0; wi < walls.length; wi++) {
    const W = walls[wi];
    if (W.open) continue;
    const A = W.A, B = W.B;
    const Lw = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const dir = [(B[0] - A[0]) / Lw, 0, (B[1] - A[1]) / Lw];
    const N = [-dir[2], 0, dir[0]];
    const at = (s, y, o) => [A[0] + dir[0] * s + N[0] * o, y,
                             A[1] + dir[2] * s + N[2] * o];
    const holes = [];
    if (W.front && doorHole) holes.push(doorHole);
    if (wi === 1 && winHole) holes.push(winHole);
    const topOf = s => wallTop(A[0] + dir[0] * s, A[1] + dir[2] * s);
    if (Q.lod !== 0) {
      // the far shed is a panel, like the house: same boards, no members
      wall(bags.siding, { A: A, B: B, y0: yF - 0.05, t: 0.045,
                          topAt: s => topOf(s), holes: [], inner: false,
                          capTop: false, capBot: false,
                          endCap: [false, false] });
      continue;
    }
    const bw = P.boardW, gp = P.boardGap;
    const n = Math.max(1, Math.round(Lw / (bw + gp)));
    for (let i = 0; i < n; i++) {
      const s0 = i * (bw + gp) + j(0.006);
      const s1 = s0 + bw;
      const sc = (s0 + s1) / 2;
      if (rnd() < P.missing) { marks.missing++; continue; }
      const top = Math.min(topOf(s0), topOf(s1)) - 0.01;
      // a board stops at a hole and starts again above it
      const spans = [[yF - 0.06, top]];
      for (const h of holes) {
        if (sc < h.s0 - 0.01 || sc > h.s1 + 0.01) continue;
        spans.length = 0;
        if (h.y0 > yF - 0.03) spans.push([yF - 0.06, h.y0]);
        if (h.y1 < top - 0.05) spans.push([h.y1, top]);
      }
      for (const sp of spans) {
        if (sp[1] - sp[0] < 0.06) continue;
        const o = 0.022 + (clad === 1 ? 0 : 0);
        const tilt = j(0.012);
        const a = at(sc + tilt, sp[0], o), b = at(sc, sp[1], o);
        const th = clad === 3 ? 0.014 : 0.019;
        beam(bags.siding, a, b, bw / 2 * (clad === 1 ? 1.06 : 1.0), th,
             N, 0, { uv: [(i * 53 % 31) * 0.29, (i * 17 % 13) * 0.37] });
        marks.boards++;
      }
    }
    // battens over the joints, or the lap's own shadow line
    if (clad === 0 && P.batten) {
      for (let i = 0; i <= n; i++) {
        const s = i * (bw + gp) - gp / 2 + j(0.006);
        if (s < -0.02 || s > Lw + 0.02) continue;
        const top = topOf(clamp(s, 0, Lw)) - 0.02;
        let skip = false;
        for (const h of holes)
          if (s > h.s0 - 0.02 && s < h.s1 + 0.02 && h.y1 > yF + 0.4) skip = true;
        if (skip) continue;
        beam(bags.trim, at(s + j(0.01), yF - 0.05, 0.042),
             at(s, top, 0.042), 0.028, 0.014, N, 0, { uv: [i * 0.7, 0] });
        marks.members++;
      }
    }
    // the frame round the openings — four boards, none of them square
    for (const h of holes) {
      const o = 0.046;
      const yTop = h.y1;
      beam(bags.trim, at(h.s0 - 0.03, h.y0, o), at(h.s0 - 0.03 + j(0.01), yTop, o),
           0.035, 0.016, N);
      beam(bags.trim, at(h.s1 + 0.03, h.y0, o), at(h.s1 + 0.03 + j(0.01), yTop, o),
           0.035, 0.016, N);
      beam(bags.trim, at(h.s0 - 0.06, yTop + 0.03, o),
           at(h.s1 + 0.06, yTop + 0.03 + j(0.008), o), 0.035, 0.018, [0, 1, 0]);
      marks.members += 3;
      if (h === winHole) {
        const p0 = at(h.s0, h.y0 + 0.01, 0.005), p1 = at(h.s1, h.y0 + 0.01, 0.005);
        const p2 = at(h.s1, yTop - 0.01, 0.005), p3 = at(h.s0, yTop - 0.01, 0.005);
        face(bags.pane, [p0, p1, p2, p3], N, uvFrame(p0, dir, [0, 1, 0]));
      }
    }
    // THE DOOR: boards and a Z-brace, hung on two straps and slightly off
    if (W.front && doorHole && P.door) {
      const h = doorHole;
      const ang = clamp(P.doorAjar, 0, 80) * D2R;
      const Xd = nrm([dir[0] * Math.cos(ang) + N[0] * Math.sin(ang), 0,
                      dir[2] * Math.cos(ang) + N[2] * Math.sin(ang)]);
      const Nd = nrm(crs(Xd, [0, 1, 0]));
      const hinge = at(h.s0 + 0.02, h.y0, 0.030);
      const dw = (h.s1 - h.s0) - 0.04, dh = (h.y1 - h.y0) - 0.03;
      const nb = Math.max(2, Math.round(dw / 0.18));
      for (let i = 0; i < nb; i++) {
        const u = (i + 0.5) * dw / nb;
        const a = off(hinge, Xd, u + j(0.004));
        beam(bags.siding, [a[0], h.y0 + 0.015, a[2]],
             [a[0] + j(0.006), h.y0 + dh, a[2] + j(0.006)],
             dw / nb / 2 * 0.94, 0.016, Nd, 0, { uv: [i * 0.41, 0] });
        marks.boards++;
      }
      const lo = off(hinge, Xd, 0.02), hi2 = off(hinge, Xd, dw - 0.02);
      const yLo = h.y0 + 0.18, yHi = h.y0 + dh - 0.18;
      beam(bags.trim, [lo[0], yLo, lo[2]], [hi2[0], yLo, hi2[2]],
           0.055, 0.014, Nd);
      beam(bags.trim, [lo[0], yHi, lo[2]], [hi2[0], yHi, hi2[2]],
           0.055, 0.014, Nd);
      beam(bags.trim, [lo[0], yLo, lo[2]], [hi2[0], yHi, hi2[2]],
           0.050, 0.013, Nd);
      for (const f of [0.18, 0.82]) {
        const y = h.y0 + dh * f;
        const q = off(hinge, Xd, 0.01);
        beam(bags.metal, [q[0], y, q[2]], off([q[0], y, q[2]], Xd, dw * 0.55),
             0.030, 0.006, Nd);
      }
      marks.members += 5;
    }
  }

  // ---- what is inside ------------------------------------------------------
  if (P.firewood) {
    const rr = 0.075;
    const zB = z0 + 0.10;
    const top = Math.min(yF + 1.35, wallTop(0, zB) - 0.25);
    const rows = Math.max(1, Math.floor((top - yF) / (rr * 2 + 0.012)));
    if (Q.lod === 0) {
      for (let r2 = 0; r2 < rows; r2++) {
        const y = yF + rr + r2 * (rr * 2 + 0.012);
        const cols = Math.floor((L - 0.2) / (rr * 2 + 0.014));
        const use = r2 === rows - 1 ? Math.max(1, Math.round(cols * (0.4 + 0.5 * rnd()))) : cols;
        for (let i = 0; i < use; i++) {
          const x = x0 + 0.1 + rr + i * (rr * 2 + 0.014) + j(0.008);
          cyl(bags.deck, [x, y, zB], [0, 0, 1], rr * (0.8 + 0.35 * rnd()),
              Math.min(w - 0.25, 0.95), 7, true);
          marks.boards++;
        }
      }
    } else boxAB(bags.deck, [x0 + 0.1, yF, zB], [x1 - 0.1, top, zB + 0.9]);
  }
  if (P.pipe) {
    const px = x0 + L * 0.28, pz = z0 + w * 0.3;
    const top = (gable ? ridgeY : plateAt(px, pz)) + 0.75;
    cyl(bags.metal, [px, yF + 0.3, pz], [0, 1, 0], 0.062, top - yF - 0.3,
        Q.lod === 0 ? 10 : 5, true);
    if (Q.lod === 0)
      cyl(bags.metal, [px, top + 0.06, pz], [0, 1, 0], 0.10, 0.045, 10, true);
  }

  // ---- the light that never gets between the boards -------------------------
  const aoInfo = K.bakeAO(BAGS.map(kk => bags[kk]),
    { strength: P.ao === undefined ? 0.92 : P.ao,
      range: P.aoRange || 0.42, ground: g });

  // ---- the numbers ---------------------------------------------------------
  let tris = 0, verts = 0;
  const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity,
               x1: -Infinity, y1: -Infinity, z1: -Infinity };
  let nan = 0, degen = 0;
  for (const kk of BAGS) {
    const d = bags[kk].data();
    per[kk] = bags[kk].tris;
    tris += bags[kk].tris; verts += bags[kk].verts;
    for (let i = 0; i < d.pos.length; i += 3) {
      const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2];
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) { nan++; continue; }
      if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x;
      if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y;
      if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z;
    }
    for (let i = 0; i < d.idx.length; i += 3) {
      const a = d.idx[i] * 3, b = d.idx[i + 1] * 3, c = d.idx[i + 2] * 3;
      const u = [d.pos[b] - d.pos[a], d.pos[b + 1] - d.pos[a + 1],
                 d.pos[b + 2] - d.pos[a + 2]];
      const v = [d.pos[c] - d.pos[a], d.pos[c + 1] - d.pos[a + 1],
                 d.pos[c + 2] - d.pos[a + 2]];
      if (len(crs(u, v)) < 1e-9) degen++;
    }
  }
  return { bags: bags, V: { L: L, w: w, wallT: 0.05, floorY: yF,
                            plateY: yF + P.wallH, roofT: 0.03 },
           P: P,
           stats: { lod: Q.lod, tris: tris, verts: verts, per: per, bbox: bb,
                    nan: nan, degen: degen, members: marks.members,
                    boards: marks.boards, missing: marks.missing, ao: aoInfo,
                    ridgeY: ridgeY, footprint: L * w, ground: g,
                    floorY: yF, plateY: yF + P.wallH } };
}

// a shed nobody designed either
function randomShed(seed) {
  const rnd = rng(seed * 7919 + 13);
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = arr => arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))];
  const P = Object.assign({}, DEF);
  P.seed = seed;
  P.shake = rr(0.2, 1.1);
  P.L = rr(2.0, 6.5); P.w = rr(1.6, 3.6); P.wallH = rr(1.8, 2.6);
  P.gable = rnd() < 0.45 ? 1 : 0;
  P.pitch = P.gable ? rr(22, 38) : rr(8, 22);
  P.slopeZ = rr(-8, 12); P.floorY = rr(0.2, 0.8);
  P.stance = rnd() < 0.5 ? 0 : 1;
  P.clad = pick([0, 0, 1, 2, 3]); P.roofKind = pick([0, 0, 1, 2]);
  P.boardW = rr(0.14, 0.32); P.missing = rr(0, 0.18);
  P.openFront = rnd() < 0.3 ? 1 : 0;
  P.door = P.openFront ? 0 : 1; P.window = rnd() < 0.6 ? 1 : 0;
  P.firewood = P.openFront && rnd() < 0.7 ? 1 : 0;
  P.pipe = rnd() < 0.25 ? 1 : 0;
  P.doorAjar = rnd() < 0.2 ? rr(10, 60) : 0;
  P.wallSet = HG.SET_IDX('deck', pick(['greywood', 'wornwood', 'roughwood',
                                       'stain', 'darkwood']));
  P.roofSet = HG.SET_IDX('roof', pick(['corrworn', 'corrrust', 'shingle',
                                       'shakes', 'rust']));
  P.dirt = rr(0.3, 0.8);
  return P;
}

// the shed's "walls" are its cladding boards, so the siding slot is dressed
// from the BOARD role rather than the wall role
function applyFinish(P) {
  HG.applyFinish(P);
  HG.dressSlot('siding', 'deck', P.wallSet, P.wallCol, 0x9c8a6f);
}

window.SHED_GEN = {
  DEF: DEF, ROWS: ROWS, PRESETS: PRESETS, BAGS: BAGS, MAT: HG.MAT,
  build: build, randomShed: randomShed, applyFinish: applyFinish,
  libSets: HG.libSets, isShed: true,
};
})();
