const fs=require('fs');const {JSDOM}=require('jsdom');
let data=fs.readFileSync('data.js','utf8');
let app=fs.readFileSync('app.js','utf8');
// Neutraliser avPanzoom (jsdom ne gère pas viewBox.baseVal) — on teste la LOGIQUE, pas le SVG
app=app.replace(/function avPanzoom\(svg,opt\)\{[\s\S]*?\n\}/,"function avPanzoom(svg,opt){return{refit:function(){}};}");
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
  w.requestAnimationFrame=cb=>setTimeout(cb,0);w.cancelAnimationFrame=()=>{};
  w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  const errs=[];w.__errs=errs;w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
}});
const w=dom.window;
// injecter data.js puis app.js
function run(src,name){const s=w.document.createElement('script');s.textContent=src;w.document.body.appendChild(s);}
try{run(data,'data');}catch(e){console.log('data throw',e.message);}
try{run(app,'app');}catch(e){console.log('app throw',e.message);}
console.log('erreurs au chargement:',w.__errs.length?w.__errs.slice(0,3):'aucune');
// Forcer nouvelle partie et ouvrir l'aventure
try{w.eval("etat=normaliserEtat(etatVide());etat.aventure.introVu=false;etat.tutoVu=true;");}catch(e){console.log('etat err',e.message);}
try{w.eval("ouvrirAventure();");
  console.log('av-intro display après ouvrir:',w.document.getElementById('av-intro').style.display,'| txt:',w.document.getElementById('av-intro-txt').textContent.slice(0,22));
}catch(e){console.log('❌ ouvrirAventure THROW:',e.message);}
// Le handler #av-next avance-t-il l'intro ?
try{
  const before=w.document.getElementById('av-intro-txt').textContent.slice(0,22);
  w.document.getElementById('av-next').click();
  const after=w.document.getElementById('av-intro-txt').textContent.slice(0,22);
  console.log('clic #av-next → txt avant:',JSON.stringify(before),'| après:',JSON.stringify(after),'| CHANGÉ:',before!==after);
}catch(e){console.log('❌ clic THROW:',e.message);}
if(w.__errs.length)console.log('erreurs runtime:',w.__errs.slice(0,3));
