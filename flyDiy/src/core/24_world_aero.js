// ============================================================
// WORLD AERODROMES — WORLD-GEN-PROC stage 4 (the point of the exercise).
// A main field per sizeable settlement (candidate ring x 8 headings,
// scored on centreline flatness + cross-clearance + road proximity;
// length/width/surface by town size, >=900 m is paved) and backcountry
// strips on high benches (flat probe, fly-in flagged). Each strip emits
// an oriented grading SDF (the home runway carve, parameterized), a
// surface patch, a tree-exclusion box and a registry record with
// heading + touchdown zone for the future AP integration.
// Deterministic: fixed iteration orders, hash jitter only.
// ============================================================
function bakeAerodromes(D) {
  // D: { terrain(x,z), water(x,z), carved(x,z), settlements, meadows, roadNear, SURFACE, salt, buildings (G1928) }
  const t0 = Date.now();
  const { terrain, water, carved, settlements, meadows, roadNear, SURFACE, salt } = D;
  const houses = D.buildings || [];
  const smf01 = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  const hash2 = (ix, iz) => {
    let h = (ix * 786433 + iz * 393241 + 65213 + salt) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const strips = [];

  // centreline + shoulder probe: flatness, slope, wetness around a candidate
  function probe(cx, cz, hdg, len, wid) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg);
    const K = 11, hs = [];
    let sum = 0;
    for (let i = 0; i < K; i++) {
      const t = (i / (K - 1) - 0.5) * len;
      const h = terrain(cx + dx * t, cz + dz * t);
      hs.push(h); sum += h;
    }
    const elev = sum / K;
    let flat = 0, slopeMax = 0, wet = false;
    for (let i = 0; i < K; i++) {
      flat = Math.max(flat, Math.abs(hs[i] - elev));
      if (i) slopeMax = Math.max(slopeMax, Math.abs(hs[i] - hs[i - 1]) / (len / (K - 1)));
      const t = (i / (K - 1) - 0.5) * len;
      const px = cx + dx * t, pz = cz + dz * t;
      if (hs[i] < 1.2 || water(px, pz) > hs[i]) wet = true;
      for (const s of [-1, 1]) {
        const qx = px - dz * s * wid, qz = pz + dx * s * wid;
        const qh = terrain(qx, qz);
        if (qh < 1.2 || water(qx, qz) > qh) wet = true;
      }
    }
    return { flat, slopeMax, elev, wet };
  }
  // THE STRIP STANDS ON ITS OWN GROUND (G1560, REVIEW 2026-10-04 A5). probe() above scores a candidate on eleven
  // centreline points - 65 m apart on a 650 m field, and a river fits between two of them: seed 0's A2 "Pelham Field"
  // was sited across one (5.43 m of trench and water under a record that said elev 24.4), and the grading below cannot
  // fill it - baseH (20_world.js) fades the grade out by the carve depth, by design, so a bed stays a bed. So a
  // candidate that WINS on the score is walked before it is taken: every STEP metres down the centreline and down both
  // edges of the graded flat (wid/2 + 6, the grade's own shoulder), no carve under it (a river's bank, a lake's bed:
  // `carved` is tV2's carve depth) and no water over it. A candidate that fails it gives way to the next best - the
  // score's own order, so a strip that was clean stands where it stood, on the elev it had. Only winners are walked
  // (a few per town, a few backcountry benches): the bake's cost does not move.
  const STEP = 4;
  const NUDGE = [];
  for (const dv of [0, -60, 60, -120, 120, -180, 180, -240, 240]) for (const du of [0, -80, 80, -160, 160]) if (du || dv) NUDGE.push([du, dv]);
  function clean(cx, cz, hdg, len, wid) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg), hw = wid / 2 + 6;
    const n = Math.ceil(len / STEP);
    for (let i = 0; i <= n; i++) {
      const t = (i / n - 0.5) * len;
      for (const v of [-hw, 0, hw]) {
        const x = cx + dx * t - dz * v, z = cz + dz * t + dx * v;
        if (carved(x, z) > 1e-3) return false;
        const h = terrain(x, z);
        if (h < 1.2 || water(x, z) > h) return false;
      }
    }
    // A STRIP STANDS CLEAR OF THE TOWN'S HOUSES (MILL-TAXI, G1928): the settlements' houses are placed first (23_world_settle)
    // and a main field's candidate ring (r0 = s.r + 160) let a 650 m strip reach back over the town - seeds 1, 6, 12 and 42
    // each had a house ON a runway (tools/taxi_census.js: the roll, a way out, a U-turn through its box). A house's circle
    // (half its diagonal) keeps HOUSE_CLEAR off the runway's rectangle, which holds every route the pattern draws (the
    // lanes, the U-turns, the spawn): the widest validated span's half (5.5 m) + the census's 3 m, and a metre. The
    // score's order is kept, so a strip that was clear stands where it stood (seed 0's nearest house is 297 m off).
    for (const b of houses) {
      const px = b.x - cx, pz = b.z - cz, al = Math.abs(px * dx + pz * dz) - len / 2, ac = Math.abs(-px * dz + pz * dx) - wid / 2;
      if (Math.hypot(Math.max(al, 0), Math.max(ac, 0)) - Math.hypot(b.w, b.l) / 2 < HOUSE_CLEAR) return false;
    }
    return true;
  }
  const HOUSE_CLEAR = 9.5;
  const nearMeadow = (x, z, f) => meadows.some(m => Math.hypot(x - m.x, z - m.z) < m.r * f);
  const inHomeZone = (x, z) =>
    (x > -3400 && x < 400 && Math.abs(z) < 500) ||     // circuit band
    (x > -1900 && x < 900 && Math.abs(z) < 900);       // pad + generous margin
  const farFromStrips = (x, z, d) => strips.every(st => Math.hypot(x - st.x, z - st.z) >= d);

  function push(cx, cz, hdg, len, wid, surf, elev, name, kind, flyIn) {
    const dx = Math.cos(hdg), dz = Math.sin(hdg);
    const feather = 90 + len * 0.1;
    // the box holds the WHOLE feather (G1560, REVIEW C-world): grade() flattens wid/2 + 6 across and feathers past
    // that, and the box stopped at wid/2 + feather - the grade was cut off 6 m short of its end on the long sides,
    // a C0 step in the ground along the box's edge
    const ex = Math.abs(dx) * len / 2 + Math.abs(dz) * (wid / 2 + 6) + feather;
    const ez = Math.abs(dz) * len / 2 + Math.abs(dx) * (wid / 2 + 6) + feather;
    // tdz on the APPROACH side: threshold + 20% (G381; was 25%) (landing dir = -takeoffDir,
    // so the threshold is the +takeoffDir end). The W9 formula had it on
    // the rollout end — frame math was self-consistent so landings "worked",
    // but rollouts ran ~len/2 past the DRAWN strip (XCTY2 measured it).
    // spawn: the takeoff-run start, 35 m in from the rollout end.
    // (the threshold is at cx + dx * len/2, so 20 % in from it is 0.30 len from the centre)
    const tdzx = cx + dx * len * 0.30, tdzz = cz + dz * len * 0.30;
    strips.push({
      id: 'A' + strips.length, name, kind, x: cx, z: cz, hdg, len, wid,
      surface: surf, elev, tdz: [tdzx, tdzz],
      spawn: [cx - dx * (len / 2 - 35), cz - dz * (len / 2 - 35)],
      flyIn: !!flyIn,
      dx, dz, feather, bx0: cx - ex, bx1: cx + ex, bz0: cz - ez, bz1: cz + ez,
    });
  }

  // ---- main field per settlement above the pop threshold ----
  for (let si = 0; si < settlements.length; si++) {
    const s = settlements[si];
    if (s.kind === 'home' || s.pop < 250) continue;
    const len = s.pop >= 800 ? 900 : s.pop >= 450 ? 650 : 480;
    const wid = len >= 900 ? 30 : 22;
    const surf = len >= 900 ? SURFACE.PAVED : SURFACE.GRASS;
    // every candidate the score admits, in the search's order; the cheapest CLEAN one is taken (ties: the earliest,
    // as the old strict `<` kept them) - the old pick whenever it was clean
    const cands = [];
    const r0 = Math.max(320, s.r + 160);
    for (let ri = 0; ri < 3; ri++) for (let ai = 0; ai < 12; ai++) {
      const ang = (ai / 12) * 2 * Math.PI + hash2(si * 37 + ri, ai) * 0.2;
      const cx = s.x + Math.cos(ang) * (r0 + ri * 280);
      const cz = s.z + Math.sin(ang) * (r0 + ri * 280);
      if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8) || !farFromStrips(cx, cz, 1500)) continue;
      if (roadNear(cx, cz) > 1100) continue;   // town fields must be road-reachable
      for (let hi = 0; hi < 8; hi++) {
        const hdg = hi * Math.PI / 8;
        const p = probe(cx, cz, hdg, len, wid);
        if (p.wet || p.flat > 6 || p.slopeMax > 0.06) continue;
        const cost = p.flat + p.slopeMax * 60 + Math.min(2, roadNear(cx, cz) / 600);
        cands.push({ cx, cz, hdg, cost, elev: p.elev, i: cands.length });
      }
    }
    cands.sort((a, b) => (a.cost - b.cost) || (a.i - b.i));
    let best = null;
    for (const c of cands) if (clean(c.cx, c.cz, c.hdg, len, wid)) { best = c; break; }
    // NONE CLEAN: THE FIELD MOVES, it is not dropped (a river town - seed 0's Pelham, its every candidate across a
    // 45 m river's bank). Each admitted candidate is slid along and across its own axis (NUDGE, metres) and the
    // slid sites are scored and walked the same way; the town keeps its field and every later strip its id
    // (PILOTMATRIX flies A3 and A5 by id). Only a town with no clean candidate pays for this.
    if (!best && cands.length) {
      const more = [];
      for (const c of cands) {
        const ux = Math.cos(c.hdg), uz = Math.sin(c.hdg);
        for (const [du, dv] of NUDGE) {
          const cx = c.cx + ux * du - uz * dv, cz = c.cz + uz * du + ux * dv;
          if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8) || !farFromStrips(cx, cz, 1500)) continue;
          if (roadNear(cx, cz) > 1100) continue;
          const p = probe(cx, cz, c.hdg, len, wid);
          if (p.wet || p.flat > 6 || p.slopeMax > 0.06) continue;
          const cost = p.flat + p.slopeMax * 60 + Math.min(2, roadNear(cx, cz) / 600);
          more.push({ cx, cz, hdg: c.hdg, cost, elev: p.elev, i: more.length });
        }
      }
      more.sort((a, b) => (a.cost - b.cost) || (a.i - b.i));
      for (const c of more) if (clean(c.cx, c.cz, c.hdg, len, wid)) { best = c; break; }
    }
    if (best)
      push(best.cx, best.cz, best.hdg, len, wid, surf, best.elev,
           s.name + (len >= 900 ? ' Airfield' : ' Field'), 'main', false);
  }

  // ---- backcountry strips: high benches, fly-in only ----
  {
    const cand = [];
    for (let gx = -11; gx <= 11; gx++) for (let gz = -11; gz <= 11; gz++) {
      for (let j = 0; j < 3; j++) {
        const cx = gx * 1000 + (hash2(gx + 900 + j * 131, gz) - 0.5) * 800;
        const cz = gz * 1000 + (hash2(gx, gz + 900 + j * 131) - 0.5) * 800;
        const h = terrain(cx, cz);
        if (h < 90 || h > 420) continue;
        if (inHomeZone(cx, cz) || nearMeadow(cx, cz, 1.8)) continue;
        if (settlements.some(s => Math.hypot(cx - s.x, cz - s.z) < 1800)) continue;
        // the headings the score admits, flattest first (ties: the earliest heading, as the old strict `<` kept them);
        // the site stands in the list at its flattest, and is walked (clean) only when the list reaches it
        const hs = [];
        for (let hi = 0; hi < 8; hi++) {
          const hdg = hi * Math.PI / 8;
          const p = probe(cx, cz, hdg, 340, 18);
          if (p.wet || p.flat > 5 || p.slopeMax > 0.05) continue;
          hs.push({ hdg, flat: p.flat, elev: p.elev, hi });
        }
        hs.sort((a, b) => (a.flat - b.flat) || (a.hi - b.hi));
        if (hs.length) cand.push({ cx, cz, hdg: hs[0].hdg, flat: hs[0].flat, elev: hs[0].elev, hs, k: 0 });
      }
    }
    const cOrd = (a, b) => (a.flat - b.flat) || (a.cx - b.cx) || (a.cz - b.cz);
    cand.sort(cOrd);
    const SYL = ['Kar', 'Tyl', 'Ulv', 'Brekk', 'Stein', 'Vass'];
    while (cand.length) {
      const c = cand.shift();
      if (strips.filter(st => st.kind === 'strip').length >= 3) break;
      if (!farFromStrips(c.cx, c.cz, 3000)) continue;
      if (!clean(c.cx, c.cz, c.hdg, 340, 18)) {
        // its flattest heading crosses a bed or water: the site goes back in the list at its next heading's flatness
        if (++c.k < c.hs.length) {
          const h = c.hs[c.k]; c.hdg = h.hdg; c.flat = h.flat; c.elev = h.elev;
          let at = 0; while (at < cand.length && cOrd(cand[at], c) <= 0) at++;
          cand.splice(at, 0, c);
        }
        continue;
      }
      let nm = '';
      for (let v = 0; v < SYL.length; v++) {   // rotate on collision
        nm = SYL[(((hash2(Math.round(c.cx), Math.round(c.cz)) * SYL.length) | 0) + v) % SYL.length] + ' Strip';
        if (!strips.some(st => st.name === nm)) break;
      }
      push(c.cx, c.cz, c.hdg, 340, 18, SURFACE.GRAVEL, c.elev, nm, 'strip', true);
    }
  }

  // ---- queries: oriented grading SDF, surface patch, exclusion box ----
  function grade(x, z, h) {
    for (const st of strips) {
      if (x < st.bx0 || x > st.bx1 || z < st.bz0 || z > st.bz1) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      const du = Math.max(0, Math.abs(lu) - st.len / 2);
      const dv = Math.max(0, Math.abs(lv) - st.wid / 2 - 6);
      const d = Math.hypot(du, dv);
      if (d < st.feather) h += (st.elev - h) * (1 - smf01(d / st.feather));
    }
    return h;
  }
  function surfaceAt(x, z) {
    for (const st of strips) {
      if (x < st.bx0 || x > st.bx1 || z < st.bz0 || z > st.bz1) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      if (Math.abs(lu) < st.len / 2 && Math.abs(lv) < st.wid / 2) return st.surface;
    }
    return -1;
  }
  // The strip's box widened by `m`, AND (P1.A, PILOT-ROADMAP §3.2) the
  // APPROACH FAN off each end: a strip is only a runway if what stands past
  // its ends lets an aeroplane in — here a 1:10 surface over a 20 m canopy
  // wants 350 m clear, so the fan runs `fan` (350 m) out from each end,
  // widening at 1:7 from a 50 m shoulder (the runway model's corridor).
  // The tree placement asks this (20_world.js); the premises' strips carry
  // their own clear zones (27_premises.js), drawn by hand.
  function inBox(x, z, m, fan) {
    fan = fan ?? 350;
    for (const st of strips) {
      const r = m + fan;
      if (x < st.bx0 - r || x > st.bx1 + r || z < st.bz0 - r || z > st.bz1 + r) continue;
      const rx = x - st.x, rz = z - st.z;
      const lu = rx * st.dx + rz * st.dz;
      const lv = -rx * st.dz + rz * st.dx;
      if (Math.abs(lu) < st.len / 2 + m && Math.abs(lv) < st.wid / 2 + m) return true;
      const out = Math.abs(lu) - st.len / 2;
      if (out >= 0 && out < fan && Math.abs(lv) < st.wid / 2 + 50 + out / 7) return true;
    }
    return false;
  }

  return { strips, grade, surfaceAt, inBox, stats: { bakeMs: Date.now() - t0 } };
}
