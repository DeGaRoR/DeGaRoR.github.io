# Wave 2 focused diagnostic: 2–3 November 2026

Status: **NOT READY. Runtime comparison invalid; no performance gain claimed.**
Measured sources: master 0fcf54ef9d1c556f4bb7f6f39c02fc41776d4d62 (PH1A),
candidate 8e5b4b9fef15439a4aa79600074b3d67360ed8ad. Later working commits
that publish this report change documentation only.

## The booked window and cleanup

The user moved the single focused measure to 2 Nov 23:50–3 Nov 00:20 Brussels.
Both guards cleared, and the GPU lock was acquired at 23:51. Only this focused
master/candidate scenario ran, not the light train or delivery battery. No new
measurement launched after 00:10. The candidate finished and the lock was
released by 00:09. At 00:14, no test-profile Chrome or 8775/8776 listener remained,
and no codex GPU lock remained. The one-time automation was deleted.

All runs used exact plain Git exports, fresh profiles, identical saved Rufus/
graphics settings and profiling OFF. Master parked cook check was (same), build
b1d38d3d392d. Candidate was built as b0f6f6b54871 and re-cooked on 8775; its check
then said (same). Afterward, the exported original manifest and all four packed
files were byte-verified restored. Shared checkout/index/packs were untouched.

## Retained observations, not a qualified comparison

| Item | Master | Candidate | Interpretation |
|---|---:|---:|---|
| Navigation to ready | 141.8 s | 155.1 s | One observation each; candidate +13.3 s is a possible cost to investigate, not a proven regression or gain |
| CPU mean, including boot | 24.15% | 24.09% | Both <=25%; phase means also <=25% |
| Raw frame export | `__timeout`, 9 bytes | `__timeout`, 9 bytes | Invalid: no frame metrics may be derived |
| Diagnostic/GL-wait export | timed out | timed out | No usable program-wait attribution |
| Dusk end pool | armed, ready=true | armed, ready=null | Candidate isolated-preparation path was not confirmed |
| Candidate preparation marker | n/a | absent | Reject the scenario as proof of the fix |
| Camera end-state capture | timed out | timed out | Three-second CDP deadline exceeded; not a measured worst-frame duration |
| Dusk end AGL | 0 m | 0 m | Airborne fixture did not remain controlled; `over=false` alone was insufficient |

**Worst frame, total recorded shader waits, frames >100 ms, all-green window
share, FPS and garage p99.9: unavailable.** Neither row is a valid performance
sample. The original scripts wrote complete=true after accepting a timeout
sentinel; that flag is explicitly overruled by focused-analysis.json and
INVALID-CAPTURE.txt. Original raw artifacts are preserved, not silently fixed.
No side is credited with zero freezes or smoothness improvements.

The new post-boot joins remain a source hypothesis. The garage's specific 3–4 s
frame was not attributed. The camera probes becoming unresponsive on both sides
are a lead, but do not distinguish shader compilation from other blocking work.
Fresh-profile/driver-cache and required candidate re-cook differences further
limit any reading of the single loading-time pair. W4 is not diagnosed.

## Harness fault and correction

I used a three-second CDP capture timeout during exactly the long stalls being
investigated, then failed to reject its `__timeout` return. This lost the frame
and wait exports. The corrected local harness removes those short capture races,
uses the independent hard-stop timer, validates phase objects and frame columns,
saves garage and dusk snapshots BEFORE risky camera changes, and fails if the
candidate's dusk marker is absent. It records prep attachment, pose, sim clock
and boot state. The next controlled shader fixture is deliberately paused at a
known airborne pose, preventing the autopilot from resetting it; it is explicitly
not live-flight proof. Capture-validity positive/negative tests and syntax pass.
**The corrected harness has not had a browser smoke test yet.**

Browser cleanup was also adapted to current master_bench's return API: the
current helper no longer exposes ch/ws. Cleanup targets only the uniquely named
test profiles, with process-tree termination, and the final process check was
empty. No other session's processes or locks were touched.

## Production candidate and remaining blockers

W3 source change owns isolated material twins/light state and retains ready
programs. It does not restore the fixed eight lights by day or add a boot warm.
Real Three fake-GL DUSKISOLATED confirms day/night/depth keys, untouched live
currentProgram pointers, deferred dispatch and error propagation. A 4 ms dispatch
budget is not a hard bound on indivisible shader source generation; runtime
maxSliceMs and first-use waits remain unproven. Runtime must confirm the exact
prep callback is attached and exercised before drawing conclusions.

W2 source change joins the early shed and craft-shed prelinks under firstFrame.
GARAGEPRELINK executes the boot callback and proves both chains are awaited;
it does not prove these chains caused the observed garage hitch. Its possible
boot cost must be controlled before retaining/landing it.

Named blockers:
- CAPTURE-INVALID: frame and GL-wait exports rejected on both sides.
- DUSK-PATH-UNCONFIRMED: candidate marker absent.
- FIXTURE-UNCONTROLLED: aircraft returned to ground during the night interval.
- REPEATS-MISSING: required 3+ interleaved same-day controls not run.
- DELIVERY-MISSING: full exact-export delivery gates and visual parity not run.

No new production gate verdict is asserted. Source gates DUSKISOLATED and
GARAGEPRELINK and app syntax passed on the rebased committed export. The affected
PROGRAMS/LIGHT/CLOUD/FRAMECOST/HOUSEWORKER/ROUNDTRIP and other source consumers
still need their owning sessions' delivery review; their gate implementations
and owned feature work were not edited. No baseline, budget or red was waived.

Next authorized slot: smoke-test the hardened capture first; require valid
garage+dusk raw files and a confirmed candidate callback before camera probes.
Then collect the requested repeated same-day controls and loading/gate proof.
No ready ref or READY report is published; A0 must not land this working branch
on the basis of this diagnostic. No further timed work is scheduled.

Artifacts:
C:/Users/denis/.codex/visualizations/2026/10/28/01a1834a-4c11-7490-8807-decc2d02abeb/wave2-followup-20261102/focused-results/
The focused-analysis.json validator, raw side files and INVALID-CAPTURE.txt
belong together. The local hardened runtime is source/syntax checked only.
