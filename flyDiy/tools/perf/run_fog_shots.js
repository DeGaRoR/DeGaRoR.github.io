// THE A/B SHEET for the fog study - three eyes, six states each, one boot per eye.
//
// TWO DEFECTS FIXED after the first attempt (2026-09-22): island_shot.js does NOT wait for the
// roll-out screen the way frame_perf.js does, so every shot came out dimmed under "compiling the
// world" with a CONTINUE ANYWAY button in it; and a 60 m eye in a forest shows trees, not a
// horizon, which is what a visibility study has to look at. So every step now begins with CLEAN
// (dismiss the boot overlay, hide the flight UI) and the eyes are high enough to see distance.
const { spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const FD = path.resolve(__dirname, '..', '..');   // flyDiy/, from flyDiy/tools/perf/
const PORT = process.env.FLYDIY_PORT || '8479';   // node tools/_serve.js <port> <root> --fallback <main checkout>
const URL = process.argv[2] || 'http://localhost:' + PORT + '/flyDiy/dev.html?world=jolene&day=2026-09-21T07:30';
const OUTD = path.join(FD, 'bench', 'fog'); fs.mkdirSync(OUTD, { recursive: true });

// the overlay goes, the UI goes, the camera is put where the picture wants it
const CLEAN = "[...document.querySelectorAll('button,a,div')].filter(b=>/continue anyway/i.test(b.textContent||'')&&!b.children.length).forEach(x=>x.click());" +
              "['boot','ui','devPanel'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});";
// camSet takes RADIANS (garage_shot.js:123 `camSet(0.9, 0.18, 14)`) - degrees put the eye
// under the aeroplane looking at empty sky, which cost this sheet one run (2026-09-22)
const CAM = (az, el, d) => `FLIGHT_PROBE.camSet(${az},${el},${d});`;
const RH = "DAY_CLOCK.set({rh:0.98});";
const FAR = m => `WORLD.camera.far=${m};WORLD.camera.updateProjectionMatrix();`;
const QUADS = m => `(()=>{let n=0;WORLD.scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.index&&o.geometry.index.count>3e5){o.geometry.computeBoundingSphere();const s=o.geometry.boundingSphere;const c=s.center.clone().applyMatrix4(o.matrixWorld);const v=c.distanceTo(WORLD.camera.position)-s.radius<${m};if(o.visible!==v){o.visible=v;if(!v)n++;}}});return n;})();`;
const MIST = k => `ATMO.MIST.k=${k};`;

// az, el, dist: the chase camera pulled back and aimed along the ground, so the frame is HORIZON
const spots = [
  { name: 'valley', at: '-100,150,100',  cam: [0, 0.06, 90] },   // a low, near-level eye down the valley
  { name: 'high',   at: '-100,600,100',  cam: [0, 0.12, 160] },  // the island from above: ridges into distance
  { name: 'sea',    at: '3000,300,0',    cam: [0, 0.07, 130] },  // over the water, the shore and the hills
];
const steps = s => [
  CLEAN + CAM(...s.cam) + RH + "'A rh 0.98, the day as it comes'",
  CLEAN + CAM(...s.cam) + RH + MIST(0) + "'B the mist off - what the cut would show'",
  CLEAN + CAM(...s.cam) + RH + MIST(1) + FAR(1500) + "'C far 1500 under a 2.1 km mist - TOO SHORT on purpose'",
  CLEAN + CAM(...s.cam) + RH + MIST(1) + FAR(2750) + QUADS(2750) + "'D the CONTRACT: far + quads at 1.3 x visM'",
  CLEAN + CAM(...s.cam) + RH + MIST(1) + FAR(100000) + QUADS(1e9) + "'E back to full distance - D must look like this'",
  CLEAN + CAM(...s.cam) + RH + MIST(3) + "'F mist x3 - the thick morning'",
];
const log = [];
for (const s of spots) {
  const args = ['tools/island_shot.js', '--url', URL, '--at', s.at, '--out', path.join(OUTD, s.name + '.png'),
                '--wait', '18000', '--boot', '28000', '--eval', "(window.BOOT?BOOT.state:'none')+' | cover '+FLIGHT_PROBE.world().day.cloudCover"];
  for (const st of steps(s)) args.push('--step', st);
  const r = spawnSync(process.execPath, args, { cwd: FD, encoding: 'utf8' });
  log.push('## ' + s.name + ' ' + s.at + '\n' + r.stdout + r.stderr);
  fs.writeFileSync(path.join(__dirname, 'fog_shots.log'), log.join('\n'));
}
fs.appendFileSync(path.join(__dirname, 'fog_shots.log'), '\ndone\n');
