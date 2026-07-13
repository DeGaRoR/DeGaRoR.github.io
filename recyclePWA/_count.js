const proj=require("./tools/_load.js").load(".");
const store={};const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=""+v},removeItem:k=>{delete store[k]}};
const noop=()=>{};const document=new Proxy({},{get:()=>noop});const window=new Proxy({localStorage},{get(t,p){return p in t?t[p]:noop}});
const ctx=new Function("localStorage","document","window",proj.engine+"\n"+proj.tests+"\n;return {QC_SUITES};")(localStorage,document,window);
let tot=0,fails=0;
for(const name in ctx.QC_SUITES){let n=0,f=0;
  const t={ok:(c,m)=>{n++;if(!c)f++;},report:()=>{},eq:(a,b,m)=>{n++;if(a!==b)f++;}};
  try{ctx.QC_SUITES[name](t);}catch(e){console.log("  THREW",name,"after",n,"asserts:",e.message);f++;}
  tot+=n;fails+=f;
  if(["site-budget","site-vfilm","site-bonus-economy","site-splitter-layouts","site-port-model","site-playability","site-connect-flow","site-multiconnect-mixer-splitter"].includes(name))
    console.log("  "+name.padEnd(34),n,"asserts",f?("FAIL "+f):"");
}
console.log("TOTAL asserts:",tot,"fails:",fails,"suites:",Object.keys(ctx.QC_SUITES).length);
