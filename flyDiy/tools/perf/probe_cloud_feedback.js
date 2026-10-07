// tools/perf/probe_cloud_feedback.js (G1532): the clouds at zero samples, through FRAMECOST's census -
//   PROBE_EXIT=1 FRAMECOST_PROBE=tools/perf/probe_cloud_feedback.js FRAMECOST_GFX='{"preset":"current"}' node tools/_framecost_check.js --census cub
// the composite's draws, the target's samples, whether the composite reads the target's own depth, and the recorder's feedback draws
// (a draw sampling a texture attached to its own framebuffer - GL_INVALID_OPERATION on a GPU). Before G1532 at 'current': the
// composite read the attachment, every composite draw a feedback; after: a copy, none. Node only - a heavy census: the box's CPU rules.
module.exports = async (W, P, FP) => {
  const out = m => process.stderr.write('PROBE ' + m + '\n');
  const C = W.CLOUDS, AA = W.FLYDIY_AA, M = C && C.compositeMesh();
  let comp = 0; const ob = M && M.onBeforeRender; if (M) M.onBeforeRender = function () { comp++; if (ob) return ob.apply(this, arguments); };
  // the layer bakes a slice a frame (129 on the box) before its first march: wait for the composite's first draw (at most 400 frames)
  let waited = 0; while (!comp && waited < 400) { await P.frames(20); waited += 20; }
  const f0 = P.rec.feedbacks; comp = 0;
  await P.frames(6);
  const T = AA && AA.target(), U = M && M.material.uniforms;
  out(JSON.stringify({ preset: W.GFX.get().preset, aa: W.GFX.get().aa, clouds: W.GFX.get().clouds, active: C && C.active, ready: C && C.ready, baked: C && C.baked, waited, samples: T ? T.samples : null,
    compositeDraws: comp, readsOwnDepth: !!(T && U && U.uDepth.value === T.depthTexture), feedbacks: P.rec.feedbacks - f0, feedbackAll: P.rec.feedbacks,
    first: P.rec.feedback.slice(0, 4) }));
  if (M) M.onBeforeRender = ob;
  if (process.env.PROBE_EXIT) process.exit(0);
};
