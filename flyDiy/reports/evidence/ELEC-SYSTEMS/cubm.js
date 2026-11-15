const path=require('path');const R=path.resolve(process.argv[2]);const C=require(R+'/tools/flight_core.js');const LB=require(R+'/tools/_load_build.js');
const f=process.argv[3];const s=LB.loadBuild(f).spec;const d=C.buildGen(s);const sh=C.genShakedown(d);const Y=C.genSystemsResolve(s);
const pct=x=>((x-sh.xLEmac)/sh.cBar*100).toFixed(2);
console.log(JSON.stringify({empty:+sh.empty.toFixed(2),mass:+sh.mass.toFixed(2),cgEmptyMAC:pct(sh.cgEmptyX),cgMAC:pct(sh.cgX),staticMargin:+(sh.staticMargin*100).toFixed(2),certKey:C.genCertKey(d),sysKg:+Y.kg.toFixed(2),elec:Y.elec,dropped:Y.dropped,warnings:Y.warnings.map(w=>w.key)}));
