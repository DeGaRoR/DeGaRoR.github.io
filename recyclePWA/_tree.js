const fs=require("fs");const html=fs.readFileSync("js/engine.js","utf8");
const s=html.indexOf("@ENGINE-START@"),cs=html.indexOf("*/",s)+2,e=html.indexOf("/*@ENGINE-END@");
const engine=html.slice(cs,e);
const store={};const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=""+v},removeItem:k=>{delete store[k]}};
const noop=()=>{};const document=new Proxy({},{get:()=>noop});const window=new Proxy({localStorage},{get(t,p){return p in t?t[p]:noop}});
const api=new Function("localStorage","document","window",engine+"\n;return {newGame,tick,getG:()=>G,recomputeTechMod,CAREERref:()=>CAREER,TECH,OBJ};")(localStorage,document,window);
const {newGame,tick,TECH,OBJ}=api;
// tree cost summary
let unlocks=0,upg=0,yards=0;
const U=["r_airU","a_split","a_pickU","r_eddyU","r_vfilm","r_nirU"];
for(const id in TECH){const c=TECH[id].cost;if(U.includes(id))unlocks+=c;else if(id.startsWith("a_yard"))yards+=c;else upg+=c;}
console.log("=== tree cost ===");
console.log("unlock licences (all):",unlocks/1000+"k");
console.log("upgrades (all):",upg/1000+"k");
console.log("yards (all):",yards/1000+"k");
console.log("whole tree:",(unlocks+upg+yards)/1000+"k");
// achievements total
let ach=0;for(const id in OBJ)ach+=OBJ[id].reward;
console.log("achievements total:",ach/1000+"k");
// x2 cap: reference plant net with full R&D + bonuses vs pre-bonus base 8469
const DAY=24;
function run(tech){newGame("career","site_ref",0xC0FFEE7);if(tech){api.CAREERref().tech=tech.slice();api.recomputeTechMod();}
  const G=api.getG();G.running=true;for(let i=0;i<DAY/0.004;i++)tick(0.004);
  const L0=Object.assign({},G.ledger),t0=G.t;for(let i=0;i<4*DAY/0.004;i++)tick(0.004);
  const dT=(G.t-t0)/DAY,d=k=>((G.ledger[k]||0)-(L0[k]||0))/dT;
  return d("tipping")+d("sales")+d("subsidies")-d("labour")-d("logistics")-d("power")-d("landfill");}
const base=run(null),full=run(Object.keys(TECH));
console.log("\n=== x2 cap check (pre-bonus base 8469) ===");
console.log("REF + bonuses (no R&D): ",Math.round(base),"  x"+(base/8469).toFixed(2));
console.log("REF + bonuses + FULL R&D:",Math.round(full),"  x"+(full/8469).toFixed(2));
