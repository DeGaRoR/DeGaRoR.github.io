// GATE FOG's real instrument: the SAME eye, the world FROZEN, three cuts.
// Without the freeze the cloud deck drifts between shots and the pixel diff measures the
// weather - 4.6 % of pixels move in 4 s with nothing else changed (FOG-MIST §1f).
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const FD = path.resolve(__dirname, '..', '..');   // flyDiy/, from flyDiy/tools/perf/
const PORT = process.env.FLYDIY_PORT || '8479';   // node tools/_serve.js <port> <root> --fallback <main checkout>
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene&day=2026-09-21T07:30';
const OUTD = path.join(FD, 'bench', 'fog'); fs.mkdirSync(OUTD, { recursive: true });
const CLEAN = "[...document.querySelectorAll('button,a,div')].filter(b=>/continue anyway/i.test(b.textContent||'')&&!b.children.length).forEach(x=>x.click());" +
              "['boot','ui','devPanel'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});";
// rh 0.90, NOT 0.98: at 0.98 the deck's base is 125 x (T - Td) ~ 37 m and every eye above the
// valley floor is INSIDE the cloud (the 600 m and 300 m eyes of the first sheet were white-outs).
// At 0.90: rho0 = 0.00111/m -> T < 1 % at 4.1 km, and the base stands at ~210 m.
const FREEZE = "DAY_CLOCK.set({rh:0.90,rate:0});CLOUDS.S.driftK=0;ATMO.MIST.k=1;";
const CAM = "FLIGHT_PROBE.camSet(0,0.06,90);";
const FAR = m => `WORLD.camera.far=${m};WORLD.camera.updateProjectionMatrix();`;
const QUADS = m => `WORLD.scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.index&&o.geometry.index.count>3e5){o.geometry.computeBoundingSphere();const s=o.geometry.boundingSphere;const c=s.center.clone().applyMatrix4(o.matrixWorld);o.visible=c.distanceTo(WORLD.camera.position)-s.radius<${m};}});`;
// E first (the reference), then D (the contract), then E again (proves the freeze holds), then C
const steps = [
  CLEAN + FREEZE + CAM + FAR(100000) + QUADS(1e9) + "'E full distance'",
  CLEAN + FREEZE + CAM + FAR(5400) + QUADS(5400) + "'D the contract at 1.3 x visM = 5400'",
  CLEAN + FREEZE + CAM + FAR(100000) + QUADS(1e9) + "'E2 full again - E vs E2 is the FLOOR'",
  CLEAN + FREEZE + CAM + FAR(2000) + QUADS(2000) + "'C 2000 m, half of visM - too short on purpose'",
];
const args = ['tools/island_shot.js', '--url', URL, '--at', '-100,150,100', '--out', path.join(OUTD, 'frozen.png'),
              '--wait', '20000', '--boot', '28000'];
for (const st of steps) args.push('--step', st);
const r = spawnSync(process.execPath, args, { cwd: FD, encoding: 'utf8' });
fs.writeFileSync(path.join(__dirname, 'fog_frozen.log'), r.stdout + r.stderr + '\ndone\n');
