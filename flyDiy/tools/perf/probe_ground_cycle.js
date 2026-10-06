// tools/perf/probe_ground_cycle.js (G1531): the repro of the textured -> plain -> textured ground bug, through FRAMECOST's census -
//   PROBE_EXIT=1 FRAMECOST_PROBE=tools/perf/probe_ground_cycle.js FRAMECOST_GFX='{"preset":"retro"}' node tools/_framecost_check.js --census cub
// every ground program must read uSplat / uSplatN / uSplatOn "yes" at A, B and C (MISSING at C was the bug: three's cached program, the
// last compile's uniforms). Node only - a heavy census: the box's CPU rules apply.
// G1531 repro: a page that drew the textured ground goes plain, then back - the reused program's uniforms (three's cache path)
module.exports = async (W, P, FP) => {
  const out = m => process.stderr.write('PROBE ' + m + '\n');
  const R = FP.renderer(), sc = W.WORLD.scene, sp = W.WORLD.ground.splat();
  const mats = new Set(); sc.traverse(o => { const m = o.material; if (o.isMesh && m && m.customProgramCacheKey && /island-(ring|outer|fine)/.test(String(m.customProgramCacheKey()))) mats.add(m); });
  const dump = tag => { for (const m of mats) { const pr = R.properties.get(m), U = pr.uniforms || {}, cp = pr.currentProgram;
    out(tag + ' ' + m.customProgramCacheKey().slice(0, 18) + ' prog#' + (cp && cp.id) + ' progs=' + (pr.programs ? pr.programs.size : 0) + ' uSplat=' + (U.uSplat ? 'yes' : 'MISSING') + ' uSplatN=' + (U.uSplatN ? 'yes' : 'MISSING') + ' uSplatOn=' + (U.uSplatOn ? U.uSplatOn.value : 'MISSING')); } };
  await P.frames(4); dump('A boot(' + (sp.plain() ? 'plain' : 'textured') + ')');
  sp.plain(true); await P.frames(6); dump('B plain');
  sp.plain(false); await P.frames(6); dump('C back');
  if (process.env.PROBE_EXIT) process.exit(0);
};
