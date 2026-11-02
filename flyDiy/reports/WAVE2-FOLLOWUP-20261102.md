# Wave 2 follow-up, 2 Nov 2026

Working candidate only. No runtime performance verdict or landing approval.
Base at investigation start: origin/master d1a754b942b398333f485e6208514bf3f8724c33 (L29f).
Timed work planned for 21:00 Brussels or overnight, after rebase onto L29h and both box guards clear.

## W3: isolated dusk preparation

The previous prep temporarily armed the live pool and compiled live materials.
Putting lights back did not put each material's Three currentProgram back. The
new helper prepares exact zero/eight-pool variants on material twins and a light
snapshot, retaining their programs until replacement. Neither lights nor live
material pointers change during preparation. Visible daytime count stays zero.
Shadow kinds, fogless depth targets, instancing and hidden LOD material variants
are included. No extra boot precompile is introduced.

Preparation dispatch begins after a rendered frame and uses a 4 ms work budget,
at most one compileAsync call per frame. KHR polling owns driver completion;
pool readiness is published only when every promise resolves. A rejected prep
leaves the previous count intact, rather than marking a failed job ready.

**Limit to prove, not waive:** a single Three shader-source generation is
indivisible and can exceed 4 ms. `__lampWarm.maxSliceMs` records this explicitly.
There is no claim of a strict 4 ms execution bound, zero first-use driver work,
or improved all-green share until runtime measurement. No-KHR backends require
separate assessment. A failed prep keeps its count pending rather than retrying
an expensive broken compile every frame.

## W2: garage loader lifetime candidate

Source evidence: shedPrelink and craftStart's shed compile launch asynchronous
chains which the boot never joins. They may still compile x-ray/room variants
after the interactive garage starts. Retain both promises and join them under
firstFrame before the final x-ray pass. This moves no rendering feature and adds
no new compile work. Runtime attribution is still required: do not present this
as a proven explanation of the observed 3–4 s frame.

## Validation

- DUSKISOLATED: real Three on fake GL proves cached day/night/depth keys, live
  pointers untouched, deferred one-job dispatch, and error propagation.
- GARAGEPRELINK: executable boot callback with deferred promises proves the
  loader waits for both early chains. Syntax checked. No browser/GPU yet.
- Required runtime: 3+ same-day interleaved master/candidate controls, profiling
  off, cold night sequence, CPU <=25%, normal daytime light train. Report dusk,
  cockpit and near worst frame, waits, >100 ms, all-green windows; rollout sum
  from six taskWorst rows, boot time/compile and garage idle outliers.
- Record driver/cache metadata and raw ranges. W4 diagnosis only after W3/W2.
- Run delivery gates against the exact committed export, comparing every red
  identity with the same-day master. No changed baselines or tolerated new reds.
- Shared app/premises/shader helper are read by PROGRAMS, LIGHT, CLOUD,
  FRAMECOST, HOUSEWORKER, ROUNDTRIP and many other gates. None of those owners'
  gate files or feature implementations was edited. The delivery battery must
  expose any overlap rather than silently clearing a known red.

No packs, generated build outputs, master, or ready branch are to be committed
or pushed. A0 owns landing.

Latest user correction: timed comparison no earlier than 21:00 Brussels, after FINISH-4 completes; both box guards remain mandatory.
