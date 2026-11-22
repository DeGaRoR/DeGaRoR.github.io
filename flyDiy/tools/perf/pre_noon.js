// pre_noon.js - boot_perf --pre-rollout-file: the sandbox clock set to NOON in the garage, before Go. After a load made
// at night (?day=night) the departure then meets the other count of point lights: every lit program of the world is
// keyed again (the 164 programs of Codex's noon trace) - unless the lamp pool keeps its count (?lampsfixed=1).
(() => { try { DAY_CLOCK.preset('noon'); return JSON.stringify({ day: 'noon', lamps: (window.WORLD && WORLD.lampsWant) ? WORLD.lampsWant() : null }); } catch (e) { return 'pre_noon failed: ' + e.message; } })()
