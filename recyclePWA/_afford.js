const fs=require("fs");const html=fs.readFileSync("js/engine.js","utf8");
const s=html.indexOf("@ENGINE-START@"),cs=html.indexOf("*/",s)+2,e=html.indexOf("/*@ENGINE-END@");
const engine=html.slice(cs,e);
const store={};const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=""+v},removeItem:k=>{delete store[k]}};
const noop=()=>{};const document=new Proxy({},{get:()=>noop});const window=new Proxy({localStorage},{get(t,p){return p in t?t[p]:noop}});
const api=new Function("localStorage","document","window",engine+"\n;return {SITE_REF_SNAPSHOT,SITE_STARTER_SNAPSHOT,ECON,siteUnitCost,pathLen,SITE_BELT_COST,newGame,getG:()=>G};")(localStorage,document,window);
const {SITE_REF_SNAPSHOT:REF,SITE_STARTER_SNAPSHOT:START,ECON,pathLen}=api;
const SC=ECON.siteCost;
function unitCost(n){ // site cost for a snapshot node
  if(n.site==="process")return SC.process[n.type]||150000;
  if(n.site==="mixer")return 60000;
  return SC[n.site]||50000;
}
// starter gives some units free
const starterKinds={};for(const n of START.nodes){const k=n.site;starterKinds[k]=(starterKinds[k]||0)+1;}
let unitsTotal=0, byKind={};
for(const n of REF.nodes){const c=unitCost(n);unitsTotal+=c;byKind[n.site+(n.type&&n.site==="process"?":"+n.type:"")]=(byKind[n.site+(n.type&&n.site==="process"?":"+n.type:"")]||0)+c;}
// belts
let beltTotal=0;const BELT=api.SITE_BELT_COST||800;
for(const ed of REF.edges){if(ed.kind==="conveyor"&&ed.route){beltTotal+=Math.ceil(pathLen(ed.route)/30)*BELT;}} // route is in world px; /CELL=30 → cells
console.log("=== FULL reference plant capex (built from scratch) ===");
for(const k in byKind)console.log("  "+k+": "+(byKind[k]/1000).toFixed(0)+"k");
console.log("units subtotal:",(unitsTotal/1000).toFixed(0)+"k");
console.log("conveyors:",(beltTotal/1000).toFixed(0)+"k");
console.log("TOTAL from scratch:",((unitsTotal+beltTotal)/1000).toFixed(0)+"k  (budget 2500k)");
// credit the free starter units
let starterCredit=0;for(const n of START.nodes)starterCredit+=unitCost(n);
console.log("\nstarter pre-placed (free):",(starterCredit/1000).toFixed(0)+"k");
console.log("NET to finish from Atelier starter:",((unitsTotal+beltTotal-starterCredit)/1000).toFixed(0)+"k  (budget 2500k)");
