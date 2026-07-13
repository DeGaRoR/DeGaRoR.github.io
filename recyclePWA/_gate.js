const fs=require("fs");const html=fs.readFileSync("js/engine.js","utf8");
const s=html.indexOf("@ENGINE-START@"),cs=html.indexOf("*/",s)+2,e=html.indexOf("/*@ENGINE-END@");
const engine=html.slice(cs,e);
const store={};const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=""+v},removeItem:k=>{delete store[k]}};
const noop=()=>{};const document=new Proxy({},{get:()=>noop});const window=new Proxy({localStorage},{get(t,p){return p in t?t[p]:noop}});
const api=new Function("localStorage","document","window",engine+"\n;return {newGame,getG:()=>G,CAREERref:()=>CAREER,recomputeTechMod,sitePlaceUnit,unitUnlocked,BASE_UNITS,researchTech,ALL_UNITS};")(localStorage,document,window);
const {newGame,sitePlaceUnit,unitUnlocked,BASE_UNITS,researchTech,ALL_UNITS}=api;
newGame("career","site_atelier",0xA7E11E7);
const G=api.getG();
console.log("=== Atelier start: which units are placeable? ===");
for(const u of ALL_UNITS){const base=BASE_UNITS.indexOf(u)>=0,unl=unitUnlocked(u);console.log("  "+u.padEnd(9),base?"BASE":(unl?"unlocked":"LOCKED"));}
// try to place a locked unit (nir) before unlocking → should be rejected with reason "locked"
// (place at a valid process cell in the corridor; if zone/cash fails first we still learn from the reason)
let r=sitePlaceUnit("process","nir",9,14,0,{free:true});
console.log("\nplace nir BEFORE unlock:",JSON.stringify(r.ok?{ok:true}:{reason:r.reason}));
// unlock the chain (free): eddy→air→nir, and vfilm
for(const id of ["r_eddyU","r_airU","r_nirU","r_vfilm"])researchTech(id);
console.log("after unlocking chain: nir unlocked?",unitUnlocked("nir"),"| vfilm?",unitUnlocked("vfilm"));
let r2=sitePlaceUnit("process","nir",9,14,0,{free:true});
console.log("place nir AFTER unlock:",JSON.stringify(r2.ok?{ok:true}:{reason:r2.reason}));
// base unit always ok
let r3=sitePlaceUnit("process","magnet",9,16,0,{free:true});
console.log("place magnet (base) anytime:",JSON.stringify(r3.ok?{ok:true}:{reason:r3.reason}));
