// node seq.js k:s:on|off ...   - the crashes run in sequence in ONE process (the JIT's history carries over)
const L=require((process.env.FD || '/home/user/DeGaRoR.github.io/flyDiy') + '/tools/_treecrash_lib.js');
const crypto=require('crypto');
const SC={ taxi:{ D: 4, V: 3, thr: 0, secs: 8 }, noseover:{ D: 12, V: 12, thr: 0, secs: 6, trunk: { r: 0.25, h: 0.35, sink: 0 } },
  trunk0:{ D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 0 }, t5:{ D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 0 }, trunk25:{ D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 2.5 } };
for (const a of process.argv.slice(2)) {
  const [k, s, on] = a.split(':'), t0 = Date.now();
  const r = L.atTrunk(k, Object.assign(on === 'off' ? { elastic: true, cert: false } : { cert: true }, SC[s]));
  const h = crypto.createHash('sha1').update(Buffer.from(r.sim.p.buffer)).update(Buffer.from(r.sim.v.buffer)).digest('hex').slice(0, 16);
  console.log(JSON.stringify({ k, s, on, hash: h, broken: r.dmg.broken.length, work: +r.dmg.work.toFixed(1), ms: Date.now() - t0 }));
}
