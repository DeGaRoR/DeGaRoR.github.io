const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
for (const raw of ['0','1']) { process.env.FLYDIY_RAW_BUILDS=raw; delete require.cache; }
const d=L.defOf('twinFloats'); const R=d.clusters.find(c=>c.tag==='ROD'); console.log('ROD dmg', JSON.stringify({kind:R.dmg.kind,mat:R.dmg.mat,r:R.dmg.r,EI:R.dmg.EI,E:R.dmg.E,station:R.dmg.station,eta:R.dmg.eta}));
console.log('spec.fuse.rod',JSON.stringify(d.spec.fuse.rod),'boom',d.spec.fuse.boom,'material',d.spec.material,'rodWall',C.GEN_RULES.rodWall, 'mat phys', JSON.stringify(C.GEN_CRASH[R.dmg.mat]));
