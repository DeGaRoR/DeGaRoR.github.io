// the new core without the record against master's core: the same aeroplane, to the bit?
const fs=require('fs'); const k=process.argv[2];
const NEW=require('/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js');
const m={exports:{}}; new Function('module','require','__filename','__dirname', fs.readFileSync(__dirname+'/flight_core_master.js','utf8'))(m, require, __dirname+'/flight_core_master.js', '/workspace/DeGaRoR.github.io/flyDiy/tools'); const OLD=m.exports;
const sp=JSON.parse(fs.readFileSync(__dirname+'/spec_'+k+'.json')).spec; delete sp.fuselage.aeroBody;
const a=OLD.buildGen(JSON.parse(JSON.stringify(sp))), b=NEW.buildGen(JSON.parse(JSON.stringify(sp)));
const J=d=>JSON.stringify({n:d.nodes.map(n=>[n.p,n.m]),b:d.beams.map(x=>[x.k,x.c,x.A]),p:d.params,r:d.refs});
console.log(k,'def identical:',J(a)===J(b));
