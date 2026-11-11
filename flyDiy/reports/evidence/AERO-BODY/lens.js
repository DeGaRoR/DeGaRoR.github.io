const C=require("/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js");
const fs=require('fs');
for (const k of process.argv.slice(2)) { const o=require("./probe_"+k+".json"), cw=require("./cowl_"+k+".json"); const zF=o.datum.zFw;
 const sp=require("./spec_"+k+".json").spec; const def=C.buildGen(JSON.parse(JSON.stringify(sp))); const S=def.spec, ST=def.parts.ST;
 const cz=cw.bins.map(b=>zF-b[0]); const cx0=cz.length?Math.min(...cz):null, cx1=cz.length?Math.max(...cz):null;
 const nose=Math.min(zF-o.z1, cx0==null?1e9:cx0), tail=Math.max(zF-o.z0, cx1==null?-1e9:cx1);
 const fl0=-S.cowl.len, fl1=ST[ST.length-1].x;
 console.log(k.padEnd(9),"drawn nose",nose.toFixed(2),"tail",tail.toFixed(2),"(AF",(zF-o.z1).toFixed(2),(zF-o.z0).toFixed(2),"cowl",cx0&&cx0.toFixed(2),cx1&&cx1.toFixed(2),") | flown",fl0.toFixed(2),fl1.toFixed(2),"| L",(tail-nose).toFixed(2),"vs",(fl1-fl0).toFixed(2),((fl1-fl0)/(tail-nose)*100-100).toFixed(1)+"%");
}
