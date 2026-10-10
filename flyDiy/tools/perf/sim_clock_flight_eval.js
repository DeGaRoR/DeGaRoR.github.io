(() => { const S = window.__SCF || {}, R = FLIGHT_PROBE.renderer(), d = FLIGHT_PROBE.world().day, LE = window.LIGHT_EASE, pb = (window.WORLD && WORLD.probeState && WORLD.probeState()) ? WORLD.probeState().bakes : null;
  return { rate: d.rate, asked: S.rate, set: !!S.set, setAtS: S.at != null ? +(S.at / 1000).toFixed(1) : null, programs: R.info.programs ? R.info.programs.length - S.p0 : null, lut: S.lut - (S.lut0 || 0),
    probe: pb != null && S.pb0 != null ? pb - S.pb0 : null, applies: LE && S.le0 ? LE.applies - S.le0[0] : null, writes: LE && S.le0 ? LE.writes - S.le0[1] : null,
    versionBumps: d.version - (S.v1 != null ? S.v1 : d.version), rateBump: S.v1 != null && S.v0 != null ? S.v1 - S.v0 : null,
    sunEl0: S.el0 != null ? +S.el0.toFixed(2) : null, sunEl1: +d.sunEl.toFixed(2), h0: S.h0 != null ? +S.h0.toFixed(3) : null, h1: +(d.localSeconds / 3600).toFixed(3), err: S.err || null }; })()
