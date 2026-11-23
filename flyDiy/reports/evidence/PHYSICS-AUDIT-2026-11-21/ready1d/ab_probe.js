// usage: node ab_probe.js <flyDiy dir> cd1,cd2,...   the LS4-alike's glide, brakes in and out, at several speeds
const path = require('path'); const T = path.join(path.resolve(process.argv[2]), 'tools');
const SH = require(path.join(T, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js', '_cage_crew.js', '_cage_char.js', '_panel_gen.js', '_cage_panel.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(T, '_bake_joined.js')); const { D, C } = BJ.loadPanel();
const sL = BJ.bakeCard('ls4').spec;
for (const cd of (process.argv[3] || '1.2').split(',').map(Number)) {
  C.GEN_RULES.airbrake.cdPlate = cd;
  const dL = C.buildGen(JSON.parse(JSON.stringify(sL))), s = C.makeSim(dL, null); s.reset(0);
  const W = s.totalM * 9.81, out = [];
  for (const V of [25, 28, 33]) { const LD = e => { s.ctl.airbrake = e; let lo = -0.1, hi = 0.3;
      for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, r = s.probe([-V * Math.cos(m), -V * Math.sin(m), 0], false, null); if (r.Fy < W) lo = m; else hi = m; }
      const a = (lo + hi) / 2, r = s.probe([-V * Math.cos(a), -V * Math.sin(a), 0], false, null), ca = Math.cos(a), sa = Math.sin(a);
      return { ld: (r.Fy * ca - r.Fx * sa) / (r.Fx * ca + r.Fy * sa), d: r.Fx * ca + r.Fy * sa }; };
    const e0 = LD(0), e1 = LD(1); out.push(V + ' m/s: ' + e0.d.toFixed(0) + ' -> ' + e1.d.toFixed(0) + ' N, L/D ' + e0.ld.toFixed(1) + ' -> ' + e1.ld.toFixed(1) + ', sink ' + (V / e1.ld).toFixed(1)); }
  console.log('cdPlate ' + cd + ' mass ' + s.totalM.toFixed(0) + ' kg | ' + out.join(' | '));
}
