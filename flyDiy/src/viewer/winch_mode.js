// winch_mode.js - THE WINCH LAUNCH IN THE PAGE (WINCH, 2026-11-13). The sandbox's start chooser's 'winch' (app.js
// window.FLYDIY_START) lines the glider up on Jolene AFB 13/31 with its motor off, and this lays out the rest: THE WINCH
// (tools/_winch_gen.js, the club look - tools/_winch_weather.js, the van's wheels when the gear kit is on the page) at
// the far end of up to 1000 m of cable along the runway, facing the glider; the cable drawn from its fairlead to the
// glider's CG hook. The physics is src/vehicle/winch.js (GATE WINCH): the line through the solver's own substep hook,
// the drum and its driver, the glider's back-release at the top, the weak link, the guillotine.
//
// THE SAME HOOKS AS THE CAR TOW (drive_mode.js DM.tow*), so app.js's tow plumbing drives it unchanged: towOn() returns
// this module while `tow.active`; towPre() / towPost(dt) round every 1/60 s step of the aeroplane; towDraw() a frame;
// towWords() the notice plate; towRelease() the R key; towStop() the restart and the shed; `tow` carries kind / go / t /
// line / hands / start() for the roll's start and the autopilot's handover (app.js launchHandOver).
// Lazy (MANIFEST.lazy): fetched with winch.js, tow.js and the winch's two tools only when a winch launch is asked for.
(function () {
  'use strict';
  const WM = window.WINCH_MODE = {};
  const TW = WM.tow = { active: false, kind: 'winch', go: false, t: 0, line: null, hands: null, winch: null, model: null, rope: null, sim: null, L: 0, why: null };
  let THREE_ = null, scene_ = null, world_ = null;
  const ROPE_N = 48;

  // the runway under the glider and its far end ahead of the nose: the cable along the centreline to the winch
  function runwayAhead(world, sim) {
    const cg = sim.cgPos(), xA = sim.axes()[0], fl = Math.hypot(xA[0], xA[2]) || 1, fx = -xA[0] / fl, fz = -xA[2] / fl;
    let best = null;
    for (const a of world.aerodromes || []) {
      if (!a.len || a.kind === 'water' || a.kind === 'meadow') continue;
      const ux = Math.cos(a.hdg), uz = Math.sin(a.hdg), rx = cg[0] - a.x, rz = cg[2] - a.z;
      const along = rx * ux + rz * uz, side = Math.abs(-rx * uz + rz * ux);
      if (Math.abs(along) > a.len / 2 + 40 || side > (a.wid || 30) / 2 + 20) continue;
      const s = fx * ux + fz * uz >= 0 ? 1 : -1;                  // the end the nose points at
      const ahead = a.len / 2 - s * along;                          // metres of runway ahead of the glider
      if (!best || ahead > best.ahead) best = { a, ahead, dx: s * ux, dz: s * uz };
    }
    return best;
  }

  WM.winchStart = async function (ctx) {
    THREE_ = ctx.THREE; scene_ = ctx.scene; world_ = ctx.world;
    const sim = ctx.sim, def = ctx.def;
    if (typeof makeWinchLine !== 'function' || !window.WINCH_GEN) throw new Error('the winch\'s modules did not load');
    const R = runwayAhead(world_, sim);
    if (!R) throw new Error('not lined up on a runway');
    const hook = winchHookNodes(sim); let hx = 0, hz = 0; hook.nodes.forEach((i, k) => { hx += sim.p[i * 3] * hook.w[k]; hz += sim.p[i * 3 + 2] * hook.w[k]; });
    // THE WINCH: A PERMANENT ONE when the runway has it (the AFB's own, placed by the scenery - any group WINCH_GEN built
    // (userData.winchProp) standing within 30 m of the centreline ahead, its fairlead 300 m or more away): the cable runs
    // to it and it stays when the launch ends. Else one is built for this launch at the end of up to 1000 m of cable (the
    // fairlead on the centreline, the drawbar away from the glider), weathered, and taken away by towStop
    // AFB-0220 (the AFB's two permanent winches, one per direction, 25.5 m off 13/31's centreline - 3 m off the paved edge
    // with the van's width): the search reaches 30 m off the centreline (was 25: the van stood on the pavement's edge),
    // takes only a winch that FACES the glider (its -z toward it - the other direction's winch, further down the same
    // runway, is turned away) and the NEAREST of those
    let model = null, own = false, fl = null, best = Infinity;
    scene_.traverse(o => {
      if (!o.userData || !o.userData.winchProp || !o.parent) return;
      o.updateMatrixWorld(true);
      const e = o.matrixWorld.elements, fzx = -e[8], fzz = -e[10], fn = Math.hypot(fzx, fzz) || 1;   // its -z in the world
      if ((fzx * R.dx + fzz * R.dz) / fn > -0.7) return;                                        // not facing the glider
      const f = window.WINCH_GEN.fairlead(o, 0), rx = f.x - hx, rz = f.z - hz, along = rx * R.dx + rz * R.dz, side = Math.abs(-rx * R.dz + rz * R.dx);
      if (along >= 300 && along <= R.ahead + 40 && side < 30 && along < best) { best = along; model = o; fl = f; }
    });
    const L = model ? Math.hypot(fl.x - hx, fl.z - hz) : Math.min(ctx.L || 1000, R.ahead - 60);
    if (!model) {
      if (L < 300) throw new Error('only ' + Math.round(R.ahead) + ' m of runway ahead: a winch launch wants 360 m at least');
      const F = WINCH_FAIRLEAD, wx = hx + R.dx * (L + F.back), wz = hz + R.dz * (L + F.back), gy = world_.terrainH(wx, wz);
      model = window.WINCH_GEN.build({ wx: 1, cableLen: 0, chute: 0 }); own = true;
      model.position.set(wx, gy, wz); model.rotation.y = Math.atan2(R.dx, R.dz);
      model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      model.updateMatrixWorld(true);
      if (window.WINCH_WX) window.WINCH_WX.apply(model, { macro: window.WINCH_WX.PRESETS.club, base: (typeof FLYDIY_ASSET_BASE !== 'undefined' ? FLYDIY_ASSET_BASE : '') });
      scene_.add(model);
      fl = window.WINCH_GEN.fairlead(model, 0);   // the left drum's (a twin-drum winch launches on one cable at a time)
    }
    const sheet = typeof machineSheet === 'function' ? machineSheet(def) : null, Vs = (sheet && sheet.Vs) || 15;
    const vT = Math.max(1.6 * Vs, ((def.params && def.params.ap && def.params.ap.VClimb) || 20) * 1.15);
    const winch = makeWinch({ anchor: [fl.x, fl.y, fl.z], hold: true });
    const line = makeWinchLine(sim, winch, { hook, vTarget: vT, groundAt: (x, z) => world_.terrainH(x, z) });
    // the cable: a line of ROPE_N points, the fairlead to the hook; laid on the grass once released, reeled in
    const gm = new THREE_.BufferGeometry(); gm.setAttribute('position', new THREE_.BufferAttribute(new Float32Array((ROPE_N + 1) * 3), 3));
    const rope = new THREE_.Line(gm, window.MATLIB.shared(THREE_, 'line', { color: new THREE_.Color(0x2b2b2b) }, 'winch')); rope.frustumCulled = false; scene_.add(rope);
    Object.assign(TW, { active: true, go: false, t: 0, line, winch, model, own, rope, sim, L, why: null, vT, rel: null,
      hands: ctx.hands || /[?&]towhands=1/.test(location.search || '') ? makeWinchHands(sim, { ground: world_.terrainH(hx, hz), vMin: 1.25 * Vs }) : null });
    WM.towDraw();
    return Math.round(L) + ' m of cable to ' + (own ? 'a winch set up at ' : 'the winch standing at ') + (R.a.name || R.a.id) + '\'s far end';
  };
  // the launch called: the driver takes up the slack (app.js starts it 3 s after the roll-out, as the car tow's)
  TW.start = () => { if (TW.active && !TW.go) { TW.go = true; TW.winch.hold = false; } };

  WM.towPre = () => { if (!TW.active) return; const L = TW.line; if (L.on) L.before(); if (TW.hands && TW.go) TW.hands(L, 1 / 60); };
  WM.towPost = (dt) => {
    if (!TW.active) return;
    TW.line.after(dt); TW.t += dt;
    if (!TW.line.on && TW.rel === null) TW.rel = { at: TW.line.relAt ? TW.line.relAt.slice(0, 3) : TW.sim.cgPos(), left: TW.line.Lrest };
    if (TW.rel && TW.rel.left > 0) TW.rel.left = Math.max(0, TW.rel.left - 10 * dt);   // after the release the driver winds the rest in
  };
  WM.towRelease = () => { if (TW.line && TW.line.on) TW.line.release(); };
  WM.towDraw = () => {
    if (!TW.active) return;
    const A = TW.rope.geometry.attributes.position, L = TW.line, P = L.carP;
    if (L.on) {
      const H = L.hookPos();
      // the cable's own weight: a long slack belly on the ground run, a few metres taut in the climb
      const span = Math.hypot(H[0] - P[0], H[1] - P[1], H[2] - P[2]), sag = Math.max(0.2, span * 0.02 * (1 - Math.min(1, L.T / 1500)));
      for (let k = 0; k <= ROPE_N; k++) { const u = k / ROPE_N; let y = H[1] + (P[1] - H[1]) * u - sag * 4 * u * (1 - u); const x = H[0] + (P[0] - H[0]) * u, z = H[2] + (P[2] - H[2]) * u;
        y = Math.max(y, world_.terrainH(x, z) + 0.03); A.setXYZ(k, x, y, z); }
      TW.rope.visible = true;
    } else if (TW.rel && TW.rel.left > 1) {
      // released: the cable down on the grass toward where it let go, its free end coming in as the drum winds
      const R = TW.rel.at, dx = R[0] - P[0], dz = R[2] - P[2], d = Math.hypot(dx, dz) || 1, len = Math.min(d, TW.rel.left);
      for (let k = 0; k <= ROPE_N; k++) { const u = k / ROPE_N, x = P[0] + dx / d * len * u, z = P[2] + dz / d * len * u;
        const y = u < 0.03 ? P[1] + (world_.terrainH(x, z) + 0.03 - P[1]) * (u / 0.03) : world_.terrainH(x, z) + 0.03; A.setXYZ(k, x, y, z); }
      TW.rope.visible = true;
    } else TW.rope.visible = false;
    A.needsUpdate = true;
  };
  WM.towWords = () => {
    if (!TW.active) return null;
    const L = TW.line, W = TW.winch, kmh = v => Math.round(v * 3.6) + ' km/h';
    if (!L.on) return 'off the cable: ' + L.released;
    if (!TW.go) return 'on the winch cable, ' + Math.round(TW.L) + ' m - the winch takes up the slack as you fly' + (TW.hands ? ' (the autopilot flies the launch)' : '');
    if (W.phase === 'takeup') return 'the winch takes up the slack...';
    return 'on the winch: ' + (L.Tmean / 1000).toFixed(1) + ' kN, the cable ' + Math.max(0, L.angle).toFixed(0) + '° up, reeling ' + kmh(W.vd) + ' (the driver holds ' + kmh(TW.vT) + ') - R to release';
  };
  WM.towStop = () => {
    if (TW.line) TW.line.detach();
    if (TW.model && TW.own && TW.model.parent) TW.model.parent.remove(TW.model);   // (a permanent winch stays)
    if (TW.rope && TW.rope.parent) TW.rope.parent.remove(TW.rope);
    Object.assign(TW, { active: false, go: false, line: null, winch: null, model: null, own: false, rope: null, hands: null, rel: null });
  };
})();
