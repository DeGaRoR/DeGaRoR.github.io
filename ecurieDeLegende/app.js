/* ================================================================
   1. CARTES — ajoute une créature = un objet ici.
   image:null → emoji. Sinon 'cartes/x.png', une image data:, OU un
   tableau de 5 images (une par palier d'évolution).
   ================================================================ */
/* Illustrations embarquées (base64) — voir IMG plus bas */

/* 2. RÉGLAGES */

/* ================= COMPTES EN LIGNE (Supabase) =================
   Colle ici l'URL et la clé "anon public" de ton projet Supabase.
   Tant que ces deux champs sont vides, le jeu reste 100% local (comme avant).
   Dès qu'ils sont remplis, l'écran d'accueil bascule en mode comptes en ligne. */
const CLOUD={
  url:'https://broauveyitegsqzdilwo.supabase.co',   // Project URL Supabase (base, sans /rest/v1)
  key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyb2F1dmV5aXRlZ3NxemRpbHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNTg5OTAsImV4cCI6MjA5ODczNDk5MH0.7QsK43BDoGFxr8EspxiytACi3JWcrXY1t0xjD7V-6fM',   // clé anon public (faite pour être publique)
  actif(){return !!(this.url&&this.key);},
  async rpc(fn,args){
    const base=this.url.replace(/\/+$/,'').replace(/\/rest\/v1$/,'');
    const ctrl=(typeof AbortController!=='undefined')?new AbortController():null;const to=ctrl?setTimeout(()=>ctrl.abort(),7000):null;
    try{
      const opts={method:'POST',headers:{'apikey':this.key,'Authorization':'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify(args||{})};
      if(ctrl)opts.signal=ctrl.signal;
      const r=await fetch(base+'/rest/v1/rpc/'+fn,opts);
      if(!r.ok)throw new Error('HTTP '+r.status+' '+await r.text());
      return r.json();
    }finally{if(to)clearTimeout(to);}
  }
};
async function sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(s)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function codeFamille(){try{return (localStorage.getItem('ecurie_fam')||'').trim();}catch(e){return '';}}
function profCode(p){return (p&&p.code)||codeFamille();}
function genCode(){return 'e'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);}
function genPin(){return String(1000+Math.floor(Math.random()*9000));}
function locauxGet(){return lireCache('ecurie_locaux')||[];}
function locauxSet(a){ecrireCache('ecurie_locaux',a);}
function locauxAdd(s){if(!s||!s.id)return;const L=locauxGet();const i=L.findIndex(x=>x.id===s.id);if(i>=0)L[i]=Object.assign(L[i],s);else L.push(s);locauxSet(L);}
function locauxDel(id){locauxSet(locauxGet().filter(x=>x.id!==id));}
function migrerLocaux(){
  if(lireCache('ecurie_locaux'))return;
  const L=[];const seen={};
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf('ecurie_prof_')===0){const pc=lireCache(k);if(pc&&pc.id&&!seen[pc.id]){seen[pc.id]=1;L.push({id:pc.id,prenom:pc.prenom,avatar:pc.avatar,couleur:pc.couleur,age:pc.age,niveau:pc.niveau,code:pc.code||codeFamille(),pin:pc.pin});}}}}catch(e){}
  try{const li=lireCache('ecurie_liste_'+codeFamille())||[];li.forEach(function(a){if(a&&a.id&&!seen[a.id]){seen[a.id]=1;const pc=lireCache('ecurie_prof_'+a.id);L.push({id:a.id,prenom:a.prenom,avatar:a.avatar,couleur:a.couleur,age:a.age,niveau:a.niveau,code:(pc&&pc.code)||codeFamille(),pin:pc&&pc.pin});}});}catch(e){}
  locauxSet(L);
}
async function cloudListe(){return CLOUD.rpc('comptes_liste',{p_code:codeFamille()});}
async function cloudConnexion(prenom,pin,code){const h=await sha256(pin);const r=await CLOUD.rpc('connexion',{p_prenom:prenom,p_pin:h,p_code:code||codeFamille()});return (r&&r[0])?Object.assign(r[0],{_pin:h}):null;}
/* Cache local pour fonctionner hors ligne : liste des écuries, hash du code, dernier état. */
function lireCache(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}}
function ecrireCache(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
const DEV=(function(){try{let d=localStorage.getItem('ecurie_dev');if(!d){d=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);localStorage.setItem('ecurie_dev',d);}return d;}catch(e){return 'dev0';}})();
function cacheProfil(o){if(!o||!o.id)return;ecrireCache('ecurie_prof_'+o.id,{id:o.id,prenom:o.prenom,avatar:o.avatar,couleur:o.couleur,age:o.age,niveau:o.niveau,pin:o.pin,code:o.code||codeFamille()});}
async function connexionOffline(a,pin){
  const h=await sha256(pin);const prof=lireCache('ecurie_prof_'+a.id);
  if(!prof||prof.pin!==h)return null;
  const bk=lireCache('ecurie_bk_'+a.id);
  return {id:a.id,nom:a.prenom||prof.prenom,age:a.age||prof.age,emoji:a.avatar||prof.avatar,couleur:a.couleur||prof.couleur,niveau:a.niveau||prof.niveau,etat:normaliserEtat(bk||etatVide()),cloud:true,pin:h,_offline:true};
}
/* ============ ESPACE PARENT : contrôle du temps + suivi (local, par appareil/famille) ============ */
function famKey(pfx){return pfx+'_'+(codeFamille()||'x');}
function adminGet(){return lireCache(famKey('ecurie_admin'));}
function adminSet(o){ecrireCache(famKey('ecurie_admin'),o);}
function limitesGet(){return lireCache(famKey('ecurie_limites'))||{};}
function limitesSet(o){ecrireCache(famKey('ecurie_limites'),o);}
function limiteEnfant(id){const e=profilEtat(id);if(e&&e.limite&&e.limite.maj)return e.limite;return limitesGet()[id]||{actif:true,minutes:60};}
function enregistrerLimite(id,lim){lim.maj=Date.now();const L=limitesGet();L[id]={actif:lim.actif,semaine:lim.semaine,weekend:lim.weekend};limitesSet(L);if(profilActif&&profilActif.id===id){etat.limite=lim;sauver();return;}syncLimiteCloud(id,lim);}
async function syncLimiteCloud(id,lim){const pc=lireCache('ecurie_prof_'+id);let e=null;if(CLOUD.actif()&&navigator.onLine&&pc&&pc.pin){try{const r=await CLOUD.rpc('connexion',{p_prenom:pc.prenom,p_pin:pc.pin,p_code:(pc.code||codeFamille())});const row=Array.isArray(r)?r[0]:r;if(row&&row.etat)e=normaliserEtat(row.etat);}catch(x){}}const bk=lireCache('ecurie_bk_'+id);if(!e)e=bk?normaliserEtat(bk):etatVide();else if(bk)e=fusionEtat(normaliserEtat(bk),e);e.limite=lim;ecrireCache('ecurie_bk_'+id,e);if(CLOUD.actif()&&navigator.onLine&&pc&&pc.pin){try{await CLOUD.rpc('sauver_etat',{p_id:id,p_pin:pc.pin,p_etat:e,p_avatar:pc.avatar,p_couleur:pc.couleur,p_age:pc.age,p_niveau:pc.niveau});}catch(x){}}}
async function rafraichirFamilleParent(){if(!(CLOUD.actif()&&navigator.onLine))return;for(const a of admListe()){if(profilActif&&profilActif.id===a.id)continue;const pc=lireCache('ecurie_prof_'+a.id);if(!pc||!pc.pin)continue;try{const r=await CLOUD.rpc('connexion',{p_prenom:a.prenom,p_pin:pc.pin,p_code:(pc.code||codeFamille())});const row=Array.isArray(r)?r[0]:r;if(row&&row.etat){let e=normaliserEtat(row.etat);const bk=lireCache('ecurie_bk_'+a.id);if(bk)e=fusionEtat(normaliserEtat(bk),e);ecrireCache('ecurie_bk_'+a.id,e);}}catch(x){}}}
function jourISO(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function estWeekend(d){const j=(d||new Date()).getDay();return j===0||j===6;}
function limiteMinutes(id){const L=limiteEnfant(id);if(!L.actif)return 0;return L.minutes!=null?L.minutes:(L.semaine||60);}
function tempsGet(id){return lireCache('ecurie_temps_'+id)||{jours:{}};}
function tempsSet(id,o){ecrireCache('ecurie_temps_'+id,o);}
function tjSec(e,k){const j=e&&e.temps&&e.temps.jours&&e.temps.jours[k];if(!j||!j.dev)return 0;let s=0;for(const d in j.dev)s+=j.dev[d]||0;return s;}
function tjSess(e,k){const j=e&&e.temps&&e.temps.jours&&e.temps.jours[k];if(!j||!j.ses)return 0;let s=0;for(const d in j.ses)s+=j.ses[d]||0;return s;}
function migrerTempsLegacy(id,e){if(!e)return e;e.temps=e.temps||{jours:{}};e.temps.jours=e.temps.jours||{};if(e.temps._leg)return e;let old=null;try{old=lireCache('ecurie_temps_'+id);}catch(x){}if(old&&old.jours){for(const k in old.jours){const oj=old.jours[k]||{},nj=e.temps.jours[k]||{dev:{},ses:{},snap:{}};nj.dev=nj.dev||{};nj.ses=nj.ses||{};nj.snap=nj.snap||{};if(oj.sec)nj.dev['legacy']=Math.max(nj.dev['legacy']||0,oj.sec||0);if(oj.sessions)nj.ses['legacy']=Math.max(nj.ses['legacy']||0,oj.sessions||0);if(oj.bonnes!=null)nj.snap={bonnes:Math.max(nj.snap.bonnes||0,oj.bonnes||0),cartes:Math.max(nj.snap.cartes||0,oj.cartes||0),etoiles:Math.max(nj.snap.etoiles||0,oj.etoiles||0)};e.temps.jours[k]=nj;}}e.temps._leg=1;return e;}
function profilEtat(id){if(profilActif&&profilActif.id===id)return etat;const bk=lireCache('ecurie_bk_'+id);let e=bk?normaliserEtat(bk):null;if(!e){const li=(lireCache('ecurie_liste_'+codeFamille())||[]).find(a=>a.id===id);if(li&&li.etat)e=normaliserEtat(li.etat);}if(!e)return null;return migrerTempsLegacy(id,e);}
function fusionTemps(a,b){const A=(a&&a.jours)||{},B=(b&&b.jours)||{},jours={};for(const k of new Set([...Object.keys(A),...Object.keys(B)])){const ja=A[k]||{},jb=B[k]||{},dev={},ses={};for(const d of new Set([...Object.keys(ja.dev||{}),...Object.keys(jb.dev||{})]))dev[d]=Math.max((ja.dev||{})[d]||0,(jb.dev||{})[d]||0);for(const d of new Set([...Object.keys(ja.ses||{}),...Object.keys(jb.ses||{})]))ses[d]=Math.max((ja.ses||{})[d]||0,(jb.ses||{})[d]||0);const sa=ja.snap||{},sb=jb.snap||{};jours[k]={dev,ses,snap:{bonnes:Math.max(sa.bonnes||0,sb.bonnes||0),cartes:Math.max(sa.cartes||0,sb.cartes||0),etoiles:Math.max(sa.etoiles||0,sb.etoiles||0)}};}return {jours,_leg:(a&&a._leg)||(b&&b._leg)||0};}
function tempsAujourdhui(id){return tjSec(profilEtat(id),jourISO());}
function metriquesActuelles(){return {bonnes:etat.bonnes||0,cartes:nbUniques(),etoiles:totalEtoiles()};}
function enregistrerTemps(sec){
  if(!(profilActif&&profilActif.id))return;
  sessionSec+=sec;
  etat.temps=etat.temps||{jours:{}};etat.temps.jours=etat.temps.jours||{};
  const k=jourISO();const j=etat.temps.jours[k]||{dev:{},ses:{},snap:{}};
  j.dev=j.dev||{};j.dev[DEV]=(j.dev[DEV]||0)+sec;
  const m=metriquesActuelles();j.snap={bonnes:m.bonnes,cartes:m.cartes,etoiles:m.etoiles};
  etat.temps.jours[k]=j;
  sauver();   // persister le temps immédiatement : sinon un re-login relit un temps périmé (contournement de la limite)
}
let chronoTimer=null,chronoDernier=0,enJeu=false,sessionRef=null,sessionSec=0;
function demarrerChrono(){
  arreterChrono();enJeu=true;chronoDernier=Date.now();
  sessionRef={bonnes:etat.bonnes||0,tirages:etat.tirages||0,cartes:nbUniques(),exos:etat.exos||0};sessionSec=0;
  etat.temps=etat.temps||{jours:{}};etat.temps.jours=etat.temps.jours||{};const k=jourISO();const j=etat.temps.jours[k]||{dev:{},ses:{},snap:{}};j.ses=j.ses||{};j.ses[DEV]=(j.ses[DEV]||0)+1;etat.temps.jours[k]=j;
  chronoTimer=setInterval(chronoTick,10000);
}
function arreterChrono(){enJeu=false;if(chronoTimer){clearInterval(chronoTimer);chronoTimer=null;}}
function chronoFlush(){const now=Date.now(),dt=Math.round((now-chronoDernier)/1000);chronoDernier=now;if(dt>0&&dt<120)enregistrerTemps(dt);}
function chronoTick(){if(document.visibilityState!=='visible'){chronoDernier=Date.now();return;}chronoFlush();verifierLimiteTemps();}
function verifierLimiteTemps(){if(!(profilActif&&profilActif.id))return false;const lim=limiteMinutes(profilActif.id);if(lim>0&&tempsAujourdhui(profilActif.id)>=lim*60){ecranTempsEcoule();return true;}return false;}
function ecranTempsEcoule(){
  arreterChrono();
  const box=document.getElementById('temps-fond');if(!box)return;
  const MSGS=["Bravo, tu as super bien travaillé aujourd'hui ! 🌟","Quelle belle séance ! Tes chevaux sont fiers de toi 🐴","Génial ! On se retrouve demain pour de nouvelles aventures 🌙","Tu as bien mérité ta pause. À très vite ! ✨","Beau travail ! Repose-toi bien 💛"];
  // Écran "heure de la pause" = récap du JOUR (la session courante peut être vide si la limite
  // était déjà atteinte à la connexion). On lit les totaux persistés du jour, toujours parlants.
  const sec=tempsAujourdhui(profilActif.id);
  let p={bonnes:0,cartes:0};try{p=progresPeriode(profilActif.id,1);}catch(e){}
  const dBonnes=p.bonnes||0,dCartes=p.cartes||0,titreRecap="Aujourd'hui";
  const items=[['⏱️',fmtDuree(sec),'de jeu']];
  items.push(['✅',dBonnes,'bonne'+(dBonnes>1?'s':'')+' rép.']);
  if(dCartes>0)items.push(['🐴',dCartes,'nouv. carte'+(dCartes>1?'s':'')]);
  const recapHTML='<div class="temps-recap-t">'+titreRecap+'</div><div class="temps-recap">'+items.map(r=>'<div class="tr-item"><span class="tr-ico">'+r[0]+'</span><b>'+r[1]+'</b><span class="tr-lbl">'+r[2]+'</span></div>').join('')+'</div>';
  const t=box.querySelector('.temps-titre');if(t)t.textContent="C'est l'heure de la pause ! 🌙";
  const m=box.querySelector('.temps-msg');if(m)m.innerHTML=recapHTML+'<div class="temps-mot">'+MSGS[Math.floor(Math.random()*MSGS.length)]+'</div>';
  box.classList.add('on');
}
function retourLogin(){if(enJeu)chronoFlush();arreterChrono();const a=$('#accueil');if(a){a.style.display='';a.classList.remove('parti');}renderAccueil();}
/* Agrégats pour l'espace parent */
function tempsPeriode(id,jours){const e=profilEtat(id),now=new Date();let sec=0,sess=0;for(let i=0;i<jours;i++){const d=new Date(now);d.setDate(now.getDate()-i);const k=jourISO(d);sec+=tjSec(e,k);sess+=tjSess(e,k);}return {sec,sessions:sess};}
function metriqueDernier(tp){const J=(tp&&tp.jours)||{},ks=Object.keys(J).sort();for(let i=ks.length-1;i>=0;i--){const s=J[ks[i]]&&J[ks[i]].snap;if(s&&s.bonnes!=null)return s;}return {bonnes:0,cartes:0,etoiles:0};}
function metriqueAvant(tp,dISO){const J=(tp&&tp.jours)||{},ks=Object.keys(J).sort().filter(k=>k<dISO);for(let i=ks.length-1;i>=0;i--){const s=J[ks[i]]&&J[ks[i]].snap;if(s&&s.bonnes!=null)return s;}return {bonnes:0,cartes:0,etoiles:0};}
function progresPeriode(id,jours){const e=profilEtat(id),tp=e&&e.temps,now=new Date(),base=new Date(now);base.setDate(now.getDate()-(jours-1));const cur=metriqueDernier(tp),b=metriqueAvant(tp,jourISO(base));return {bonnes:Math.max(0,(cur.bonnes||0)-(b.bonnes||0)),cartes:Math.max(0,(cur.cartes||0)-(b.cartes||0)),etoiles:Math.max(0,(cur.etoiles||0)-(b.etoiles||0))};}
function fmtDuree(sec){const m=Math.round(sec/60);if(m<60)return m+' min';return Math.floor(m/60)+' h '+String(m%60).padStart(2,'0');}
function admListe(){migrerLocaux();return locauxGet();}
function formCreerAdmin(onDone){
  const ov=$('#pin-fond');
  ov.innerHTML='<div class="pform"><div class="admin-badge">👨‍👩‍👧 Compte parent (adulte)</div>'
    +'<div class="acc-niv" style="margin:8px 0 12px;line-height:1.45">Un <b>adulte</b> doit créer ce compte pour la famille. Il permet de <b>limiter le temps de jeu</b> de chaque enfant et de <b>suivre leurs progrès</b>. Choisis un code parent à 4 chiffres, différent de ceux des enfants.</div>'
    +'<label>Code parent (4 chiffres)</label><input id="adm-pin" type="tel" maxlength="4" inputmode="numeric" placeholder="••••" style="letter-spacing:6px;text-align:center">'
    +'<label>Confirme le code</label><input id="adm-pin2" type="tel" maxlength="4" inputmode="numeric" placeholder="••••" style="letter-spacing:6px;text-align:center">'
    +'<div class="pf-actions"><button class="pf-creer" id="adm-creer">Créer le compte parent</button></div>'
    +'<button class="pin-annuler" id="adm-annuler">Annuler</button></div>';
  ov.classList.add('on');
  $('#adm-annuler').onclick=()=>{ov.classList.remove('on');ov.innerHTML='';};
  $('#adm-creer').onclick=async()=>{
    const p1=($('#adm-pin').value||'').trim(),p2=($('#adm-pin2').value||'').trim();
    if(!/^\d{4}$/.test(p1))return toast('Un code à 4 chiffres');
    if(p1!==p2)return toast('Les deux codes ne correspondent pas');
    adminSet({pin:await sha256('ADM:'+p1),cree:Date.now()});toast('Compte parent créé ✅');ov.classList.remove('on');ov.innerHTML='';onDone&&onDone();
  };
}
function ouvrirEspaceParent(){
  admPeriode=7;renderAdmin();const acc=$('#accueil');if(acc)acc.style.display='none';$('#admin-fond').classList.add('on');rafraichirFamilleParent().then(function(){if($('#admin-fond').classList.contains('on'))renderAdmin();}).catch(function(){});
}
function protegerReglage(done){const adm=adminGet();if(!adm){pavePin('🔒 Choisis un code parent (protège les réglages)',async function(pin){adminSet({pin:await sha256('ADM:'+pin)});toast('Réglages protégés 🔒');done();});}else{pavePin('🔒 Code parent',async function(pin){if(await sha256('ADM:'+pin)!==adm.pin){toast('Code incorrect');return;}done();});}}
function verifParent(onOk){
  const adm=adminGet();
  if(!adm){onOk();return;}
  pavePin('👨‍👩‍👧 Code parent requis',async(pin)=>{
    if(await sha256('ADM:'+pin)!==adm.pin){toast('Code parent incorrect');return renderAccueil();}
    onOk();
  });
}
let admPeriode=7;
const PER_LABEL={1:"Aujourd'hui",7:'7 jours',30:'30 jours'};
function admReussite(et){
  const MAT={maths:'Maths',francais:'Français',histoire:'Histoire',sciences:'Sciences',geo:'Géo'};
  const rows=Object.entries(et.stats||{}).filter(([k,v])=>v&&v.tot>0).map(([k,v])=>({nom:MAT[k]||k,ok:v.ok,tot:v.tot,pct:Math.round(v.ok/v.tot*100)})).sort((a,b)=>b.tot-a.tot);
  if(!rows.length)return '';
  return '<div class="adm-reussite"><div class="adm-rt">Réussite par matière (total cumulé)</div>'+rows.map(r=>'<div class="adm-rrow"><span class="adm-rn">'+r.nom+'</span><span class="adm-rbar"><i style="width:'+r.pct+'%"></i></span><span class="adm-rpct">'+r.ok+'/'+r.tot+' · '+r.pct+'%</span></div>').join('')+'</div>';
}
function renderAdmin(){
  const box=$('#admin-corps');if(!box)return;const fe=$('#admin-fam');if(fe)fe.textContent=codeFamille();const liste=admListe();
  let html='<div class="adm-periode">'+[1,7,30].map(p=>'<button class="adm-pbtn'+(admPeriode===p?' on':'')+'" data-p="'+p+'">'+PER_LABEL[p]+'</button>').join('')+'</div>';
  if(!liste.length)html+='<div class="acc-niv">Aucune écurie enregistrée sur cet appareil pour cette famille. Les enfants doivent s\'être connectés ici au moins une fois.</div>';
  liste.forEach(a=>{
    const id=a.id,lim=limiteEnfant(id),joue=tempsAujourdhui(id),limMin=limiteMinutes(id);
    const per=tempsPeriode(id,admPeriode),prog=progresPeriode(id,admPeriode);
    const bk=lireCache('ecurie_bk_'+id),et=bk?normaliserEtat(bk):null;
    const pct=limMin>0?Math.min(100,Math.round(joue/(limMin*60)*100)):0;
    html+='<div class="adm-enfant" data-id="'+id+'" style="--pc:'+(a.couleur||'#7ec2ff')+'">'
      +'<div class="adm-tete"><span class="adm-ava">'+(a.avatar||'🦄')+'</span><span class="adm-nom">'+a.prenom+'</span>'
      +'<span class="adm-today">⏱️ '+fmtDuree(joue)+(limMin>0?' / '+limMin+' min':' · illimité')+'</span></div>'
      +(limMin>0?'<div class="adm-bar"><i style="width:'+pct+'%;background:'+(pct>=100?'#df6a6a':'#6fdca0')+'"></i></div>':'')
      +'<div class="adm-lim"><label class="adm-switch"><input type="checkbox" class="adm-actif"'+(lim.actif?' checked':'')+'> Limiter le temps</label>'
      +'<span class="adm-lf"><input type="number" class="adm-min" min="0" max="300" value="'+(lim.minutes!=null?lim.minutes:(lim.semaine||60))+'"> min / jour</span></div>'
      +'<div class="adm-stats">'
      +'<div class="adm-stat"><b>'+fmtDuree(per.sec)+'</b><span>temps</span></div>'
      +'<div class="adm-stat"><b>'+per.sessions+'</b><span>sessions</span></div>'
      +'<div class="adm-stat"><b>+'+prog.bonnes+'</b><span>bonnes rép.</span></div>'
      +'<div class="adm-stat"><b>+'+prog.cartes+'</b><span>cartes</span></div>'
      +'<div class="adm-stat"><b>+'+prog.etoiles+'</b><span>⭐ étoiles</span></div>'
      +(et?'<div class="adm-stat"><b>'+(et.serieJours||0)+'</b><span>🔥 jours</span></div>':'')
      +'</div>'+(et?admReussite(et):'')+'<button class="adm-suppr" data-id="'+id+'" data-nom="'+(a.prenom||'').replace(/"/g,'')+'">🗑 Retirer ce joueur de l\'appareil</button></div>';
  });
  html+='<div class="adm-note">🔒 Temps de jeu et progrès synchronisés sur tous les appareils (somme par jour). Les limites s\'appliquent partout.</div>';
  box.innerHTML=html;
  box.querySelectorAll('.adm-pbtn').forEach(b=>b.onclick=()=>{admPeriode=+b.dataset.p;renderAdmin();});
  box.querySelectorAll('.adm-enfant').forEach(el=>{
    const id=el.dataset.id,save=()=>{protegerReglage(function(){enregistrerLimite(id,{actif:el.querySelector('.adm-actif').checked,minutes:+el.querySelector('.adm-min').value||0});renderAdmin();});};
    el.querySelector('.adm-actif').onchange=save;el.querySelector('.adm-min').onchange=save;
    const sb=el.querySelector('.adm-suppr');if(sb)sb.onclick=()=>retirerJoueurAppareil(sb.dataset.id,sb.dataset.nom,renderAdmin);
  });
}
async function cloudCreer(prenom,pin,avatar,couleur,age,niveau,code){const h=await sha256(pin);const id=await CLOUD.rpc('creer_compte',{p_prenom:prenom,p_pin:h,p_avatar:avatar,p_couleur:couleur,p_age:age,p_niveau:niveau,p_etat:etatVide(),p_code:code||codeFamille()});return {id,_pin:h};}
async function cloudProprietaires(carte){try{return await CLOUD.rpc('proprietaires',{p_carte:carte,p_code:codeFamille()});}catch(e){return [];}}
let cloudTimer=null;
function majSync(s){const d=$('#sync-dot');if(!d)return;if(!(CLOUD.actif()&&profilActif&&profilActif.cloud)){d.style.display='none';return;}d.style.display='';d.textContent=s==='sync'?'🔄':s==='off'?'📴':s==='err'?'⚠️':'☁️';d.title=s==='off'?"Hors ligne — sauvegardé sur l'appareil, synchro dès le retour du réseau":s==='err'?'Erreur de synchro (touche pour réessayer)':s==='sync'?'Synchronisation…':'Synchronisé ☁️';}
async function cloudPush(){
  if(!(profilActif&&profilActif.cloud&&profilActif.pin))return;
  majSync('sync');
  try{await CLOUD.rpc('sauver_etat',{p_id:profilActif.id,p_pin:profilActif.pin,p_etat:etat,p_avatar:profilActif.emoji,p_couleur:profilActif.couleur,p_age:profilActif.age,p_niveau:profilActif.niveau});majSync('ok');}
  catch(e){majSync(navigator.onLine?'err':'off');}
}
function compteVersProfil(row){return {id:row.id,nom:row.prenom,age:row.age,emoji:row.avatar,couleur:row.couleur,niveau:row.niveau,etat:normaliserEtat(row.etat||etatVide()),cloud:true,pin:row._pin,code:row._code||codeFamille()};}
const VERSION_APP='v143';
   // exemplaires cumulés pour ★ à ★★★★★ (évolution plus lente)
const COUT_TIRAGE=120,SOLDE_DEPART=200;const COUT_TIRAGE10=COUT_TIRAGE*9;
const PITY_EPIC=20,PITY_LEGEND=100;   // pity : épique+ garanti tous les 20, légendaire+ tous les 100
const COUT_SUPER_RENOM=35;            // super-tirage payé en renommée, épique ou mieux garanti
function rankRar(r){return {commune:0,rare:1,epique:2,legendaire:3,mythique:4,celeste:5}[r]||0;}
const GAIN_BONNE=6,GAIN_ESSAI=2,BONUS_SERIE=20,PALIER_SERIE=5;   // récompense l'essai même en cas d'erreur
const REC_AV1=5,REC_AV2=1;   // aventure : diamants au 1er coup, un peu au 2e, rien ensuite
const XP_BONNE=10,XP_ESSAI=3,PAS_XP=120;
const SOFTCAP1=600,SOFTCAP2=1400;
function jourDefi(){const d=ymd(new Date());if(!etat.defiJour||etat.defiJour.date!==d)etat.defiJour={date:d,gagne:0};return etat.defiJour;}
function crediterDefi(g){const j=jourDefi();const reel=Math.max(0,Math.round(g));etat.crins+=reel;j.gagne+=reel;etat.exos=(etat.exos||0)+1;if(typeof verifierJalons==='function')verifierJalons(true);if(reel>0&&typeof montrerGainAnim==='function')montrerGainAnim(reel);return reel;}
                          // 120 XP par niveau de matière

/* ---- CONCOURS ---- */
/* Divisions = rareté des chevaux qui concourent. Prix par position (podium). */
/* Faiblesse par famille (−14 sur une capacité, sauf si c'est une affinité de la carte).
   Choisie pour contraster avec l'identité de la famille : donne un profil lisible et permet
   à un épique bien affûté de battre un mythique hors de son domaine. */
function faiblesseDe(c){return FAM_FAIBLESSE[(c.familles||[])[0]]||null;}
/* Gabarit (orthogonal aux familles) : poney = toise < 1,48 m. Liste explicite, à étendre
   à chaque ajout de petit cheval. Sert au badge de fiche et aux concours poneys. */
function gabaritDe(c){return PONEYS.has(c.id)?'poney':'cheval';}
const NB_CONCOURS=12;               // concours par jour
const COUT_RENOUV_BASE=60;          // coût du 1er renouvellement (double à chaque fois)
/* Marchand : 3 cartes/jour payées en renommée. Distribution plus plate que le
   tirage (les raretés apparaissent plus souvent) mais prix exponentiels. */

/* 3. PROFILS + SAUVEGARDE
   Clé 'ecurie_profils_v1' : { actif, profils:[ {id,nom,age,emoji,couleur,
   niveau:1..6 (année scolaire, P1..P6), etat:{...} } ] }. `etat` pointe
   vers le profil actif → tout le code de jeu reste identique. Collection +
   scores par profil. niveau = année scolaire : il sélectionne quels
   exercices apparaissent (voir `niv` des activités) et cale la difficulté. */
const CLE_P='ecurie_profils_v1',CLE_VIEUX='ecurie_legendes_v2';
let memoire=null;
function etatVide(){return {crins:SOLDE_DEPART,cadeauDepart:true,tutoVu:false,collection:{ane_tetu:1,cheval_charbonnier:1,cheval_laboureur:1},paliers:{ane_tetu:1,cheval_charbonnier:1,cheval_laboureur:1},tirages:0,bonnes:0,xp:{maths:0,francais:0,histoire:0,sciences:0},serieJours:0,dernierJour:null,stats:{},jeux:{joues:0,gagnes:0},renommee:0,renommeeTotale:0,concours:{date:null,refresh:0,faits:{}},marchand:{date:null,achetes:[]},aventure:{introVu:false,belgique:{sousEtape:0,faits:{},fini:false}},chouchous:{},packprog:{},defiJour:{date:null,gagne:0},pity:{epic:0,legend:0},jalons:{},statsPack:{},acquis:{},acquisN:0,temps:{jours:{}},limite:{actif:true,minutes:60,maj:0},leconVue:{}};}
function normaliserEtat(e){const d=etatVide();for(const k in d)if(e[k]===undefined)e[k]=d[k];e.temps=e.temps||{jours:{}};e.temps.jours=e.temps.jours||{};e.leconVue=e.leconVue||{};e.xp=Object.assign({maths:0,francais:0,histoire:0,sciences:0},e.xp||{});e.jeux=Object.assign({joues:0,gagnes:0},e.jeux||{});e.stats=e.stats||{};e.collection=e.collection||{};e.paliers=e.paliers||{};e.renommee=e.renommee||0;if(e.renommeeTotale==null)e.renommeeTotale=e.renommee;e.concours=e.concours||{date:null,refresh:0,faits:{}};if(e.concours.refresh==null)e.concours.refresh=0;e.marchand=e.marchand||{date:null,achetes:[]};for(const id in e.collection){if(e.collection[id]>0&&e.paliers[id]==null)e.paliers[id]=palierDe(e.collection[id]);}e.aventure=e.aventure||{introVu:false};e.aventure.belgique=e.aventure.belgique||{sousEtape:0,faits:{},fini:false};e.aventure.prov=e.aventure.prov||{};e.aventure.mascVue=e.aventure.mascVue||{};if(e.aventure.belgique&&!e.aventure.prov.anvers)e.aventure.prov.anvers=e.aventure.belgique;e.chouchous=e.chouchous||{};e.packprog=e.packprog||{};e.defiJour=e.defiJour||{date:null,gagne:0};e.pity=e.pity||{epic:0,legend:0};if(e.pity.epic==null)e.pity.epic=0;if(e.pity.legend==null)e.pity.legend=0;e.jalons=e.jalons||{};e.statsPack=e.statsPack||{};if(!e.acquis){e.acquis={};let n=0;for(const c of CARTES){if((e.collection[c.id]||0)>0)e.acquis[c.id]=++n;}e.acquisN=n;}else{let mx=0;for(const k in e.acquis)if(e.acquis[k]>mx)mx=e.acquis[k];e.acquisN=e.acquisN||mx;}
  // Un joueur qui a déjà de la progression ne doit jamais revoir l'onboarding (save sans tutoVu).
  if(!e.tutoVu&&((e.tirages||0)>0||(e.aventure&&e.aventure.introVu)||Object.keys(e.collection||{}).length>3||(e.bonnes||0)>0))e.tutoVu=true;
  if(!e.cadeauDepart){for(const id of ['ane_tetu','cheval_charbonnier','cheval_laboureur']){if(!(e.collection[id]>0)){e.collection[id]=1;e.paliers[id]=e.paliers[id]||1;}}e.cadeauDepart=true;}return e;}
function niveauScolaire(age){return Math.max(1,Math.min(6,(age||10)-5));}   // 8 ans → P3, 10 ans → P5
function profilVide(id,nom,age,emoji,couleur){return {id,nom,age,emoji,couleur,niveau:niveauScolaire(age),etat:etatVide()};}
function lireLS(k){try{const b=localStorage.getItem(k);if(b)return JSON.parse(b);}catch(e){}return null;}
function fusionStats(a,b){a=a||{};b=b||{};const r={};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const va=a[k]||{ok:0,tot:0},vb=b[k]||{ok:0,tot:0};r[k]=((vb.tot||0)>(va.tot||0))?{ok:vb.ok||0,tot:vb.tot||0}:{ok:va.ok||0,tot:va.tot||0};}return r;}
function fusionPackprog(a,b){a=a||{};b=b||{};const r={};for(const id of new Set([...Object.keys(a),...Object.keys(b)])){const pa=a[id]||{},pb=b[id]||{};const c={},cA=pa.c||{},cB=pb.c||{};for(const nv of new Set([...Object.keys(cA),...Object.keys(cB)])){c[nv]={};const ka=cA[nv]||{},kb=cB[nv]||{};for(const key of new Set([...Object.keys(ka),...Object.keys(kb)]))c[nv][key]=Math.max(ka[key]||0,kb[key]||0);}r[id]={niv:Math.max(pa.niv||1,pb.niv||1),c,done:Object.assign({},pa.done||{},pb.done||{})};}return r;}
function scoreAv(av){if(!av)return 0;let s=0;for(const k in av){if(k==='prov')continue;const v=av[k];if(v&&typeof v==='object')s+=(v.fini?1000:0)+(v.etape||0)*50+(v.sousEtape||0);}return s;}
function fusionEtat(a,b){
  if(!b)return a;if(!a)return b;const r=JSON.parse(JSON.stringify(a));const mx=(x,y)=>Math.max(x||0,y||0);
  ['crins','renommee','renommeeTotale','tirages','bonnes','serieJours','acquisN'].forEach(k=>r[k]=mx(a[k],b[k]));
  r.collection={};for(const id of new Set([...Object.keys(a.collection||{}),...Object.keys(b.collection||{})]))r.collection[id]=mx((a.collection||{})[id],(b.collection||{})[id]);
  r.paliers={};for(const id in r.collection)r.paliers[id]=Math.max(((a.paliers||{})[id]||0),((b.paliers||{})[id]||0),r.collection[id]>0?1:0);
  r.xp={};for(const m of new Set([...Object.keys(a.xp||{}),...Object.keys(b.xp||{})]))r.xp[m]=mx((a.xp||{})[m],(b.xp||{})[m]);
  r.stats=fusionStats(a.stats,b.stats);
  r.statsPack=fusionStats(a.statsPack,b.statsPack);
  r.temps=fusionTemps(a.temps,b.temps);
  r.limite=(((a.limite&&a.limite.maj)||0)>=((b.limite&&b.limite.maj)||0))?(a.limite||{}):(b.limite||{});
  r.leconVue=fusionLeconVue(a.leconVue,b.leconVue);
  r.jalons=Object.assign({},a.jalons||{},b.jalons||{});
  r.chouchous={};for(const id of new Set([...Object.keys(a.chouchous||{}),...Object.keys(b.chouchous||{})]))r.chouchous[id]=mx((a.chouchous||{})[id],(b.chouchous||{})[id]);
  r.acquis={};for(const id of new Set([...Object.keys(a.acquis||{}),...Object.keys(b.acquis||{})])){const va=(a.acquis||{})[id],vb=(b.acquis||{})[id];r.acquis[id]=(va&&vb)?Math.min(va,vb):(va||vb);}
  r.packprog=fusionPackprog(a.packprog,b.packprog);
  r.pity={epic:mx((a.pity||{}).epic,(b.pity||{}).epic),legend:mx((a.pity||{}).legend,(b.pity||{}).legend)};
  r.aventure=scoreAv(b.aventure)>scoreAv(a.aventure)?JSON.parse(JSON.stringify(b.aventure)):JSON.parse(JSON.stringify(a.aventure||{}));
  return r;
}
function sauver(){
  try{
    if(profilActif)try{localStorage.setItem('ecurie_bk_'+profilActif.id,JSON.stringify(etat));}catch(e){}
    if(profilActif&&profilActif.cloud){
      localStorage.setItem('ecurie_cloud_cache',JSON.stringify({id:profilActif.id,nom:profilActif.nom,age:profilActif.age,emoji:profilActif.emoji,couleur:profilActif.couleur,niveau:profilActif.niveau,etat}));
      if(cloudTimer)clearTimeout(cloudTimer);cloudTimer=setTimeout(cloudPush,1500);
    }else{
      localStorage.setItem(CLE_P,JSON.stringify(SAVE));
    }
  }catch(e){memoire=JSON.parse(JSON.stringify(SAVE));}
}
let SAVE=lireLS(CLE_P)||memoire;
if(!SAVE){
  SAVE={actif:'enola',profils:[profilVide('enola','Énola',10,'🦄','#ff9ac0'),profilVide('anae','Anaé',8,'🦄','#7ec2ff')]};
  const vieux=lireLS(CLE_VIEUX);
  if(vieux)SAVE.profils[0].etat=normaliserEtat(Object.assign(etatVide(),vieux));
}
SAVE.profils.forEach(p=>{if(!p.niveau)p.niveau=niveauScolaire(p.age);if(p.id==='anae'&&p.emoji==='🐴')p.emoji='🦄';normaliserEtat(p.etat);});
let profilActif=SAVE.profils.find(p=>p.id===SAVE.actif)||SAVE.profils[0];
SAVE.actif=profilActif.id;
let etat=profilActif.etat;
migrerTempsLegacy(profilActif.id,etat);
sauver();

/* 4. UTILITAIRES */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
function norm(s){return (s||'').trim().toLowerCase();}
function melange(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
const nbUniques=()=>CARTES.reduce((s,c)=>s+((etat.collection[c.id]||0)>0?1:0),0);
const totalEtoiles=()=>CARTES.reduce((s,c)=>s+palierApplique(c),0);
function palierDe(n){let p=0;for(const s of SEUILS)if(n>=s)p++;return p;}
function prochainSeuil(n){for(const s of SEUILS)if(n<s)return s;return null;}
function palierApplique(c){const n=etat.collection[c.id]||0;if(n<=0)return 0;const st=etat.paliers[c.id];return Math.max(1,Math.min(palierDe(n),st==null?1:st));}
function peutEvoluer(c){const n=etat.collection[c.id]||0;const p=palierApplique(c);return n>0&&p<5&&p<palierDe(n);}
function evoluer(c){if(!peutEvoluer(c))return false;etat.paliers[c.id]=palierApplique(c)+1;sauver();return true;}
function niveauDe(xp){return Math.floor((xp||0)/PAS_XP)+1;}
function artHTML(c){const im=Array.isArray(c.image)?c.image[Math.min(palierDe(etat.collection[c.id]||1),c.image.length)-1]:c.image;return im?`<img src="${im}" alt="${c.nom}" loading="lazy" decoding="async" class="tc-img" onload="this.classList.add('img-ok');var a=this.closest('.tc-art');if(a)a.classList.add('art-ok')" onerror="this.classList.add('img-ok')">`:c.emoji;}
/* Illustration nue (sans cadre, nom, rareté ni drapeau) pour les quiz « devine le cheval ». */
function artNu(c){const im=Array.isArray(c.image)?c.image[Math.min(palierDe(etat.collection[c.id]||1),c.image.length)-1]:c.image;return im?`<img src="${im}" alt="cheval à deviner" loading="lazy" decoding="async" class="tc-img" onload="this.classList.add('img-ok');var a=this.closest('.tc-art');if(a)a.classList.add('art-ok')" onerror="this.classList.add('img-ok')">`:`<span class="art-emoji">${c.emoji}</span>`;}

/* ---- CONCOURS : stats calculées (pas stockées) ---- */
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function statCap(c,cap,palier){const base=BASE_RAR[c.rarete]||8;const estAff=(c.aff||[]).includes(cap);const aff=estAff?22:0;const faib=(!estAff&&faiblesseDe(c)===cap)?-14:0;const varn=hashStr(c.id+':'+cap)%13;return Math.max(1,Math.min(99,base+6*palier+aff+faib+varn));}
function statDe(c,cap){return statCap(c,cap,palierApplique(c));}
function rangEcurie(r){let nom=RANGS[0][1];for(const[s,n]of RANGS)if(r>=s)nom=n;return nom;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const CONCOURS_MIN_FAM=15;
function famTotal(f){return CARTES.filter(c=>(c.familles||[]).includes(f)).length;}
function combosViables(){const out=[];for(const f of Object.keys(FAMILLES)){if(famTotal(f)<CONCOURS_MIN_FAM)continue;for(const d of DIVISIONS){const pool=CARTES.filter(c=>(c.familles||[]).includes(f)&&c.rarete===d.rarete);if(pool.length>=3)out.push({fam:f,rarete:d.rarete});}}return out;}
/* Concours poneys : transversaux aux familles, une division par rareté où ≥3 poneys existent. */
function combosPoney(){const out=[];for(const d of DIVISIONS){const pool=CARTES.filter(c=>gabaritDe(c)==='poney'&&c.rarete===d.rarete);if(pool.length>=3)out.push({gab:'poney',rarete:d.rarete});}return out;}
/* Concours NATIONAUX : par royaume × rareté (réutilise l'éco existante). Seuls les vrais pays
   (présents dans ROYAUME_DRAPEAU) participent ; les royaumes fantastiques n'ont pas de drapeau. */
const ROYAUME_DRAPEAU={amerique:'🇺🇸',belgique:'🇧🇪',france:'🇫🇷',angleterre:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',grece:'🇬🇷',arabie:'🇸🇦',irlande:'🇮🇪',autriche:'🇦🇹',norvege:'🇳🇴',chine:'🇨🇳',inde:'🇮🇳',ecosse:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',allemagne:'🇩🇪',espagne:'🇪🇸',perse:'🇮🇷',bresil:'🇧🇷',japon:'🇯🇵',egypte:'🇪🇬',italie:'🇮🇹',russie:'🇷🇺',portugal:'🇵🇹',australie:'🇦🇺',finlande:'🇫🇮',islande:'🇮🇸',ukraine:'🇺🇦',danemark:'🇩🇰',pologne:'🇵🇱',hongrie:'🇭🇺',argentine:'🇦🇷',suisse:'🇨🇭',luxembourg:'🇱🇺',afrique:'🌍'};
function combosRoyaume(){const out=[];const roys=[...new Set(CARTES.map(c=>c.royaume).filter(Boolean))];for(const r of roys){if(!ROYAUME_DRAPEAU[r])continue;for(const d of DIVISIONS){const pool=CARTES.filter(c=>c.royaume===r&&c.rarete===d.rarete);if(pool.length>=3)out.push({royaume:r,rarete:d.rarete});}}return out;}
/* Discipline d'un concours national : l'affinité dominante des chevaux du pays (naturel, déterministe). */
function capDominant(royaume,rarete){const pool=CARTES.filter(c=>c.royaume===royaume&&c.rarete===rarete);const cnt={};pool.forEach(c=>(c.aff||[]).forEach(a=>cnt[a]=(cnt[a]||0)+1));let best='beaute',bn=-1;for(const a in cnt)if(cnt[a]>bn){bn=cnt[a];best=a;}return CAPS.some(c=>c.id===best)?best:'beaute';}
/* Concours par ROBE (défilé) : robe × rareté, jugé sur la Beauté. Même machinerie que les familles. */
const ROBE_LIB={noir:{ico:'⚫',nom:'Robe noire'},blanc:{ico:'⚪',nom:'Robe blanche'},alezan:{ico:'🟤',nom:'Robe alezane'},isabelle:{ico:'🟡',nom:'Robe isabelle'},pie:{ico:'🎨',nom:'Robe pie'},'tachetée':{ico:'⬜',nom:'Robe tachetée'},bai:{ico:'🟫',nom:'Robe baie'}};
function combosRobe(){const out=[];const robes=[...new Set(CARTES.map(c=>ROBES[c.id]).filter(Boolean))];for(const rb of robes){for(const d of DIVISIONS){const pool=CARTES.filter(c=>ROBES[c.id]===rb&&c.rarete===d.rarete);if(pool.length>=3)out.push({robe:rb,rarete:d.rarete});}}return out;}
/* Filtre d'éligibilité d'un concours (cartes candidates) : par royaume, par gabarit, sinon par famille. */
function poolConcours(co){
  if(co.royaume)return CARTES.filter(c=>c.royaume===co.royaume&&c.rarete===co.rarete);
  if(co.robe)return CARTES.filter(c=>ROBES[c.id]===co.robe&&c.rarete===co.rarete);
  return co.gab?CARTES.filter(c=>gabaritDe(c)===co.gab&&c.rarete===co.rarete):CARTES.filter(c=>(c.familles||[]).includes(co.fam)&&c.rarete===co.rarete);
}
/* Libellé (icône + nom) d'un concours pour l'affichage. */
function libFam(co){if(co.royaume)return {ico:ROYAUME_DRAPEAU[co.royaume]||'🌍',nom:(ROYAUMES[co.royaume]&&ROYAUMES[co.royaume].nom)||co.royaume};if(co.robe)return ROBE_LIB[co.robe]||{ico:'🎨',nom:'Robe'};return co.gab==='poney'?{ico:'🐴',nom:'Poney'}:FAMILLES[co.fam];}
function concoursDuJour(){
  const d=ymd(new Date()),refr=(etat.concours&&etat.concours.refresh)||0;
  const rng=mulberry32(hashStr('concours-'+d+'-'+refr));
  let pool=combosViables().concat(combosPoney()).concat(combosRoyaume()).concat(combosRobe());
  // mélange déterministe
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const list=[];const seen={};
  for(const combo of pool){
    if(list.length>=NB_CONCOURS)break;
    // caractéristique : robe = Beauté (défilé) ; nationale = affinité dominante ; sinon thématique famille
    let cap=combo.robe?'beaute':(combo.royaume?capDominant(combo.royaume,combo.rarete):(combo.gab?'endurance':(FAM_CARAC[combo.fam]||'beaute')));
    const key=(combo.gab||combo.fam||combo.royaume||('robe_'+combo.robe))+combo.rarete+cap;if(seen[key])continue;seen[key]=1;
    list.push({fam:combo.fam,gab:combo.gab,royaume:combo.royaume,robe:combo.robe,rarete:combo.rarete,cap});
  }
  const ordreR={commune:0,rare:1,epique:2,legendaire:3,mythique:4};
  list.sort((a,b)=>ordreR[a.rarete]-ordreR[b.rarete]);
  list.forEach((c,k)=>c.i=k);
  return {date:d,list};
}
function ensureConcoursJour(){const d=ymd(new Date());if(etat.concours.date!==d){etat.concours={date:d,refresh:0,faits:{}};sauver();}}
function coutRenouv(){return COUT_RENOUV_BASE*Math.pow(2,(etat.concours.refresh||0));}
/* Compte à rebours jusqu'au prochain renouvellement journalier (minuit local) :
   concours, marchand, défi du jour et compteur de temps se réinitialisent tous à ce moment. */
function msAvantMinuit(){const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate()+1,0,0,0,0)-n;}
function fmtReset(ms){if(ms<60000)return "moins d'une minute";const tot=Math.floor(ms/60000),h=Math.floor(tot/60),m=tot%60;return h>0?(h+'h'+String(m).padStart(2,'0')+'min'):(m+'min');}
var _jourCompteur=ymd(new Date());
function majCompteurReset(){
  var txt='🕐 Nouveaux concours et marchand dans <b>'+fmtReset(msAvantMinuit())+'</b>';
  [$('#reset-compteur'),$('#reset-compteur-m')].forEach(function(e){if(e)e.innerHTML=txt;});
  var d=ymd(new Date());
  if(d!==_jourCompteur){_jourCompteur=d;ensureConcoursJour();ensureMarchandJour();
    if($('#ecran-concours')&&$('#ecran-concours').classList.contains('actif'))renderConcours();
    if($('#marchand-fond')&&$('#marchand-fond').classList.contains('on'))renderMarchand();}
}
let toastTimer;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),2000);}

/* ================================================================
   5. CONTENU DES EXERCICES — programme 5e primaire (FWB, 10-11 ans)
   Ajouter un exercice = ajouter une entrée dans une banque, ou une
   activité { nom, gen } dans une matière. gen(diff) → {q,r,choix,exp}.
   ================================================================ */
function dNum(r){const e=Math.max(2,Math.round(Math.abs(r)*.15)+2);const s=new Set([r]);let g=0;
  while(s.size<4&&g<60){let d=r+rnd(-e,e);if(d<0)d=r+rnd(1,e);s.add(d);g++;}
  let k=1;while(s.size<4){s.add(r+k);k++;}
  return [...s].filter(x=>x!==r).slice(0,3);}
function qNum(q,r,exp){return {q,r:String(r),choix:melange([String(r),...dNum(r).map(String)]),exp};}
function banque(items){return ()=>{const it=items[rnd(0,items.length-1)];return {q:it.q,r:it.r,choix:melange([it.r,...it.autres]),exp:it.exp};};}


/* niv:[min,max] = années scolaires (P1..P6) où l'exercice apparaît.
   Défaut [1,6] si absent. Le niveau du profil filtre le tirage.        */
const MATIERES=[
 {id:'maths',nom:'Maths',ico:'🔢',couleur:'#4aa3df',activites:[
   {nom:'Compter',niv:[3,4],gen:()=>{const n=rnd(11,98);return Math.random()<.5?qNum(`Quel nombre vient juste après ${n} ?`,n+1):qNum(`Quel nombre vient juste avant ${n} ?`,n-1);}},
   {nom:'Doubles',niv:[3,4],gen:()=>{const n=rnd(2,10);return qNum(`Le double de ${n}`,n*2,`le double, c'est ${n} + ${n}.`);}},
   {nom:'Plus grand',niv:[3,4],gen:()=>{const s=new Set();while(s.size<3)s.add(rnd(10,99));const arr=[...s];return {q:'Quel est le plus grand ?',r:String(Math.max(...arr)),choix:melange(arr.map(String))};}},
   {nom:'Tables ×',niv:[3,6],gen:d=>{const m=d>=3?12:d>=2?10:5;const a=rnd(2,m),b=rnd(2,m);return qNum(`${a} × ${b}`,a*b,`Pense à ${a}×${b-1} puis + ${a}.`);}},
   {nom:'Addition',niv:[3,6],gen:d=>{const m=d>=3?999:d>=2?200:20,lo=d>=2?10:1;const a=rnd(lo,m),b=rnd(lo,m);return qNum(`${a} + ${b}`,a+b);}},
   {nom:'Soustraction',niv:[3,6],gen:d=>{const m=d>=3?999:d>=2?200:20;let a=rnd(d>=2?20:5,m),b=rnd(1,a);return qNum(`${a} − ${b}`,a-b);}},
   {nom:'Division',niv:[5,6],gen:d=>{const m=d>=2?11:10;const b=rnd(2,m),q=rnd(2,m);return qNum(`${b*q} ÷ ${b}`,q,`${b} × ? = ${b*q}.`);}},
   {nom:"Fraction d'un nombre",niv:[5,6],gen:d=>{const F=[['La moitié',2],['Le tiers',3],['Le quart',4]];const[f,den]=F[rnd(0,2)];const n=rnd(2,d>=2?12:9)*den;return qNum(`${f} de ${n}`,n/den,`${f.toLowerCase()} = diviser par ${den}.`);}},
   {nom:'Mesures',niv:[5,6],gen:d=>{const[u1,u2,f]=CONV[rnd(0,CONV.length-1)];const k=rnd(1,d>=2?9:5);return qNum(`${k} ${u1} = ? ${u2}`,k*f,`1 ${u1} = ${f} ${u2}.`);}},
   {nom:'Périmètre & aire',niv:[5,6],gen:d=>{if(Math.random()<.5){const c=rnd(2,d>=2?15:9);return qNum(`Périmètre d'un carré de côté ${c} cm`,c*4,`Périmètre du carré = côté × 4.`);}const L=rnd(3,d>=2?12:8),l=rnd(2,L);return qNum(`Aire d'un rectangle ${L} × ${l} cm`,L*l,`Aire = longueur × largeur.`);}},
   {nom:'Petits problèmes',niv:[4,6],gen:()=>{const f=PROB[rnd(0,PROB.length-1)]();return qNum(f.q,f.r);}},
 ]},
 {id:'francais',nom:'Français',ico:'📖',couleur:'#a672e0',activites:[
   {nom:'Le ou La ?',niv:[3,4],gen:banque([
     {q:"___ soleil (le/la)",r:"le",autres:["la"]},{q:"___ lune (le/la)",r:"la",autres:["le"]},
     {q:"___ maison (le/la)",r:"la",autres:["le"]},{q:"___ cheval (le/la)",r:"le",autres:["la"]},
     {q:"___ voiture (le/la)",r:"la",autres:["le"]},{q:"___ ballon (le/la)",r:"le",autres:["la"]},
     {q:"___ fleur (le/la)",r:"la",autres:["le"]},{q:"___ livre (le/la)",r:"le",autres:["la"]},
     {q:"___ table (le/la)",r:"la",autres:["le"]},{q:"___ chien (le/la)",r:"le",autres:["la"]},
   ])},
   {nom:'Un ou Une ?',niv:[3,4],gen:banque([
     {q:"___ chat (un/une)",r:"un",autres:["une"]},{q:"___ pomme (un/une)",r:"une",autres:["un"]},
     {q:"___ vélo (un/une)",r:"un",autres:["une"]},{q:"___ fleur (un/une)",r:"une",autres:["un"]},
     {q:"___ ballon (un/une)",r:"un",autres:["une"]},{q:"___ maison (un/une)",r:"une",autres:["un"]},
     {q:"___ livre (un/une)",r:"un",autres:["une"]},{q:"___ voiture (un/une)",r:"une",autres:["un"]},
   ])},
   {nom:'Singulier → pluriel',niv:[3,4],gen:banque([
     {q:"Le pluriel de « chat »",r:"chats",autres:["chates","chatz","chat"],exp:"on ajoute un -s."},
     {q:"Le pluriel de « chien »",r:"chiens",autres:["chien","chiennes","chienz"],exp:"on ajoute un -s."},
     {q:"Le pluriel de « fleur »",r:"fleurs",autres:["fleures","fleur","fleurz"]},
     {q:"Le pluriel de « vélo »",r:"vélos",autres:["véloes","vélo","véloz"]},
     {q:"Le pluriel de « ami »",r:"amis",autres:["amies","ami","amiz"]},
     {q:"Le pluriel de « poule »",r:"poules",autres:["poule","poulz","pouls"]},
   ])},
   {nom:"L'alphabet",niv:[3,4],gen:()=>{const L='ABCDEFGHIJKLMNOPQRSTUVWXYZ';const i=rnd(0,23),c=L[i],r=L[i+1];const autres=melange(L.replace(c,'').replace(r,'').split('')).slice(0,2);return {q:`Quelle lettre vient après « ${c} » ?`,r,choix:melange([r,...autres])};}},
   {nom:'Les contraires',niv:[3,4],gen:banque([
     {q:"Le contraire de « grand »",r:"petit",autres:["gros","long"]},
     {q:"Le contraire de « chaud »",r:"froid",autres:["tiède","brûlant"]},
     {q:"Le contraire de « jour »",r:"nuit",autres:["soir","matin"]},
     {q:"Le contraire de « haut »",r:"bas",autres:["grand","loin"]},
     {q:"Le contraire de « content »",r:"triste",autres:["fâché","gentil"]},
     {q:"Le contraire de « ouvert »",r:"fermé",autres:["plein","vide"]},
     {q:"Le contraire de « plein »",r:"vide",autres:["lourd","petit"]},
   ])},
   {nom:'Conjugaison',niv:[5,6],gen:banque([
     {q:"Nous (aller) — présent",r:"allons",autres:["allez","vont","allont"],exp:"aller : nous allons."},
     {q:"Ils (être) — présent",r:"sont",autres:["ont","son","êtes"],exp:"être : ils sont."},
     {q:"Tu (avoir) — présent",r:"as",autres:["a","à","es"],exp:"avoir : tu as."},
     {q:"Je (faire) — présent",r:"fais",autres:["fait","faits","fez"],exp:"faire : je fais."},
     {q:"Vous (dire) — présent",r:"dites",autres:["disez","dis","disent"],exp:"dire : vous dites (irrégulier)."},
     {q:"Nous (manger) — imparfait",r:"mangions",autres:["mangeons","mangeais","mangerons"],exp:"imparfait « nous » : radical + -ions."},
     {q:"Il (finir) — imparfait",r:"finissait",autres:["finissais","finira","finissez"],exp:"finir → nous finiss-ons → il finissait."},
     {q:"Tu (être) — futur",r:"seras",autres:["sera","serais","sedas"],exp:"futur : tu seras."},
     {q:"Je (aller) — futur",r:"irai",autres:["irais","allerai","irez"],exp:"aller au futur : j'irai."},
     {q:"Nous (avoir) — futur",r:"aurons",autres:["avons","auront","aurions"],exp:"avoir au futur : nous aurons."},
     {q:"J' (manger) — passé composé",r:"ai mangé",autres:["as mangé","ai mangée","suis mangé"],exp:"avoir + participe : j'ai mangé."},
     {q:"Elle (partir) — passé composé",r:"est partie",autres:["a parti","est parti","a partie"],exp:"partir → être, accord : elle est partie."},
     {q:"Ils (venir) — passé composé",r:"sont venus",autres:["ont venu","sont venu","ont venus"],exp:"venir → être : ils sont venus."},
   ])},
   {nom:'Homophones',niv:[5,6],gen:banque([
     {q:"Il ___ lave les mains. (ce/se)",r:"se",autres:["ce"],exp:"« se » accompagne un verbe."},
     {q:"___ cheval est magnifique. (ce/se)",r:"Ce",autres:["Se"],exp:"« ce » accompagne un nom."},
     {q:"Elle ___ un poney. (a/à)",r:"a",autres:["à"],exp:"« a » = verbe avoir (elle avait)."},
     {q:"Je vais ___ l'écurie. (a/à)",r:"à",autres:["a"],exp:"« à » = préposition de lieu."},
     {q:"Papa ___ maman sont là. (et/est)",r:"et",autres:["est"],exp:"« et » relie (= et puis)."},
     {q:"Le ciel ___ bleu. (et/est)",r:"est",autres:["et"],exp:"« est » = verbe être (était)."},
     {q:"Les enfants ___ faim. (on/ont)",r:"ont",autres:["on"],exp:"« ont » = avoir (ils avaient)."},
     {q:"___ part en balade. (on/ont)",r:"On",autres:["Ont"],exp:"« on » = il/elle (on part)."},
     {q:"Ils ___ contents. (son/sont)",r:"sont",autres:["son"],exp:"« sont » = être (ils étaient)."},
     {q:"___ cheval est rapide. (son/sont)",r:"Son",autres:["Sont"],exp:"« son » = le sien."},
     {q:"Tu veux du thé ___ du café ? (ou/où)",r:"ou",autres:["où"],exp:"« ou » = ou bien."},
     {q:"___ vas-tu ? (ou/où)",r:"Où",autres:["Ou"],exp:"« où » indique le lieu."},
     {q:"J'aime ___ chevaux-là. (ces/ses)",r:"ces",autres:["ses"],exp:"« ces » = ceux-là (on montre)."},
     {q:"Elle brosse ___ cheveux. (ces/ses)",r:"ses",autres:["ces"],exp:"« ses » = les siens (à elle)."},
   ])},
   {nom:'Classes de mots',niv:[5,6],gen:banque([
     {q:"Dans « le grand cheval », « grand » est un…",r:"adjectif",autres:["nom","verbe","adverbe"],exp:"l'adjectif décrit le nom."},
     {q:"Dans « le cheval galope », « galope » est un…",r:"verbe",autres:["nom","adjectif","déterminant"],exp:"le verbe dit l'action."},
     {q:"Dans « le cheval », « le » est un…",r:"déterminant",autres:["pronom","nom","adjectif"],exp:"le déterminant introduit le nom."},
     {q:"« rapidement » est un…",r:"adverbe",autres:["adjectif","verbe","nom"],exp:"l'adverbe précise (souvent en -ment)."},
     {q:"Dans « elle court », « elle » est un…",r:"pronom",autres:["nom","déterminant","adverbe"],exp:"le pronom remplace un nom."},
     {q:"« courage » est un…",r:"nom",autres:["verbe","adjectif","adverbe"],exp:"le nom désigne une chose/idée."},
     {q:"Dans « très joli », « très » est un…",r:"adverbe",autres:["adjectif","nom","verbe"],exp:"« très » précise l'adjectif."},
   ])},
   {nom:'Pluriels',niv:[5,6],gen:banque([
     {q:"Le pluriel de « cheval »",r:"chevaux",autres:["chevals","chevaus","cheveaux"],exp:"-al → -aux."},
     {q:"Le pluriel de « journal »",r:"journaux",autres:["journals","journeaux","journaus"],exp:"-al → -aux."},
     {q:"Le pluriel de « œil »",r:"yeux",autres:["œils","oeils","yeuxs"],exp:"« œil » → « yeux » (irrégulier)."},
     {q:"Le pluriel de « genou »",r:"genoux",autres:["genous","genouxs","geneaux"],exp:"7 mots en -ou prennent un x (genou, bijou…)."},
     {q:"Le pluriel de « bijou »",r:"bijoux",autres:["bijous","bijouxs","bijeaux"],exp:"bijou → bijoux (avec un x)."},
     {q:"Le pluriel de « nez »",r:"nez",autres:["nezs","nés","neze"],exp:"les mots en -z ne changent pas."},
     {q:"Le pluriel de « bateau »",r:"bateaux",autres:["bateaus","batteaux","bateauxs"],exp:"-eau → -eaux."},
   ])},
   {nom:'Vocabulaire',niv:[4,6],gen:banque([
     {q:"Le contraire de « grand »",r:"petit",autres:["gros","haut","long"]},
     {q:"Le contraire de « rapide »",r:"lent",autres:["vite","court","facile"]},
     {q:"Un synonyme de « content »",r:"heureux",autres:["triste","fâché","fatigué"]},
     {q:"Un synonyme de « joli »",r:"beau",autres:["laid","grand","vieux"]},
     {q:"Le contraire de « jour »",r:"nuit",autres:["soir","matin","midi"]},
     {q:"Un synonyme de « débuter »",r:"commencer",autres:["finir","arrêter","continuer"]},
     {q:"Le contraire de « ouvert »",r:"fermé",autres:["cassé","plein","vide"]},
   ])},
 ]},
 {id:'histoire',nom:'Histoire',ico:'🏰',couleur:'#f2b134',activites:[
   {nom:'Les grandes périodes',niv:[5,6],gen:banque([
     {q:"Quelle invention marque la fin de la Préhistoire ?",r:"l'écriture",autres:["le feu","la roue","l'imprimerie"],exp:"La Préhistoire s'achève avec l'apparition de l'écriture."},
     {q:"Quel événement marque le début du Moyen Âge ?",r:"la chute de l'Empire romain",autres:["la découverte de l'Amérique","la Révolution française","l'invention de l'écriture"],exp:"Chute de l'Empire romain d'Occident, en 476."},
     {q:"En quelle année Christophe Colomb atteint-il l'Amérique ?",r:"1492",autres:["1789","476","1830"],exp:"1492 : début des Temps modernes."},
     {q:"Quelle période vient juste après le Moyen Âge ?",r:"les Temps modernes",autres:["l'Antiquité","la Préhistoire","l'époque contemporaine"]},
     {q:"Les hommes préhistoriques peignaient dans les…",r:"grottes",autres:["châteaux","églises","pyramides"],exp:"Ce sont les peintures rupestres."},
     {q:"Quel événement ouvre l'époque contemporaine ?",r:"la Révolution française (1789)",autres:["la chute de Rome","la découverte de l'Amérique","l'écriture"]},
     {q:"Quelle est la première période de l'Histoire ?",r:"la Préhistoire",autres:["l'Antiquité","le Moyen Âge","les Temps modernes"]},
     {q:"À quelle période vivaient les Romains et les Grecs ?",r:"l'Antiquité",autres:["la Préhistoire","le Moyen Âge","les Temps modernes"]},
   ])},
   {nom:'Personnages & Belgique',niv:[5,6],gen:banque([
     {q:"Qui met au point l'imprimerie en Europe ?",r:"Gutenberg",autres:["Jules César","Charlemagne","Christophe Colomb"],exp:"Gutenberg, vers 1450."},
     {q:"Quel empereur du Moyen Âge est célèbre pour ses écoles ?",r:"Charlemagne",autres:["Clovis","Napoléon","Jules César"],exp:"Charlemagne, couronné en l'an 800."},
     {q:"En quelle année la Belgique devient-elle indépendante ?",r:"1830",autres:["1492","1789","1918"]},
     {q:"Quelle est la capitale de la Belgique ?",r:"Bruxelles",autres:["Liège","Anvers","Namur"]},
     {q:"Qui fut le premier roi des Belges ?",r:"Léopold Ier",autres:["Philippe","Albert Ier","Baudouin"],exp:"Léopold Ier, roi en 1831."},
     {q:"Quel général romain a conquis la Gaule ?",r:"Jules César",autres:["Charlemagne","Clovis","Napoléon"]},
     {q:"Les châteaux forts sont surtout construits au…",r:"Moyen Âge",autres:["l'Antiquité","la Préhistoire","les Temps modernes"]},
     {q:"Quelle héroïne a marqué la fin du Moyen Âge en France ?",r:"Jeanne d'Arc",autres:["Cléopâtre","Marie Curie","Néfertiti"]},
   ])},
 ]},
 {id:'sciences',nom:'Sciences',ico:'🔬',couleur:'#4cbf6a',activites:[
   {nom:'Mon corps',niv:[3,4],gen:banque([
     {q:"Avec quoi vois-tu ?",r:"les yeux",autres:["les oreilles","le nez","la bouche"]},
     {q:"Avec quoi entends-tu ?",r:"les oreilles",autres:["les yeux","le nez","les mains"]},
     {q:"Avec quoi sens-tu les odeurs ?",r:"le nez",autres:["les yeux","la langue","les oreilles"]},
     {q:"Avec quoi goûtes-tu ?",r:"la langue",autres:["le nez","les dents","les yeux"]},
     {q:"Combien de doigts à une main ?",r:"5",autres:["4","6","10"]},
     {q:"Combien as-tu de pieds ?",r:"2",autres:["1","3","4"]},
   ])},
   {nom:'Les animaux',niv:[3,4],gen:banque([
     {q:"Le petit de la vache est le…",r:"veau",autres:["poulain","agneau","chiot"]},
     {q:"Le petit du chien est le…",r:"chiot",autres:["chaton","veau","poussin"]},
     {q:"Le petit du chat est le…",r:"chaton",autres:["chiot","poussin","agneau"]},
     {q:"Le petit du cheval est le…",r:"poulain",autres:["veau","chiot","agneau"]},
     {q:"Le petit de la poule est le…",r:"poussin",autres:["chaton","veau","poulain"]},
     {q:"Où vit le poisson ?",r:"dans l'eau",autres:["dans les arbres","sous terre","dans le ciel"]},
     {q:"Quel animal fait « meuh » ?",r:"la vache",autres:["le mouton","le cheval","le chat"]},
   ])},
   {nom:'Les couleurs',niv:[3,4],gen:banque([
     {q:"Bleu + jaune = ?",r:"vert",autres:["orange","violet","brun"]},
     {q:"Rouge + jaune = ?",r:"orange",autres:["vert","violet","gris"]},
     {q:"Rouge + bleu = ?",r:"violet",autres:["vert","orange","brun"]},
     {q:"De quelle couleur est le ciel (beau temps) ?",r:"bleu",autres:["vert","rouge","jaune"]},
     {q:"De quelle couleur est l'herbe ?",r:"vert",autres:["bleu","jaune","rouge"]},
     {q:"De quelle couleur est la neige ?",r:"blanc",autres:["noir","gris","bleu"]},
   ])},
   {nom:'Saisons & temps',niv:[3,4],gen:banque([
     {q:"Combien y a-t-il de saisons ?",r:"4",autres:["2","3","5"]},
     {q:"En quelle saison neige-t-il ?",r:"l'hiver",autres:["l'été","le printemps","l'automne"]},
     {q:"Quel jour vient après lundi ?",r:"mardi",autres:["dimanche","mercredi","jeudi"]},
     {q:"Combien de mois dans une année ?",r:"12",autres:["10","7","365"]},
     {q:"Quel mois vient après janvier ?",r:"février",autres:["mars","décembre","avril"]},
     {q:"Combien de jours dans une semaine ?",r:"7",autres:["5","10","12"]},
     {q:"Après aujourd'hui vient…",r:"demain",autres:["hier","avant-hier","maintenant"]},
   ])},
   {nom:'Le vivant & le corps',niv:[4,6],gen:banque([
     {q:"Quel organe pompe le sang ?",r:"le cœur",autres:["le foie","les poumons","l'estomac"]},
     {q:"Combien de poumons avons-nous ?",r:"2",autres:["1","3","4"]},
     {q:"Un animal qui allaite ses petits est un…",r:"mammifère",autres:["reptile","oiseau","poisson"],exp:"Le cheval est un mammifère."},
     {q:"À quoi servent les poumons ?",r:"respirer",autres:["digérer","voir","pomper le sang"]},
     {q:"Les plantes fabriquent leur nourriture grâce à…",r:"la lumière du soleil",autres:["la lune","le vent","la terre seule"],exp:"C'est la photosynthèse."},
     {q:"Quel organe digère les aliments ?",r:"l'estomac",autres:["le cœur","le cerveau","les poumons"]},
     {q:"Le squelette est fait d'…",r:"os",autres:["muscles","peau","sang"]},
     {q:"Un têtard deviendra une…",r:"grenouille",autres:["tortue","couleuvre","libellule"]},
   ])},
   {nom:'Matière, eau & espace',niv:[5,6],gen:banque([
     {q:"Quand l'eau gèle, elle devient…",r:"solide",autres:["liquide","gazeuse","invisible"],exp:"L'eau solide, c'est la glace."},
     {q:"Quand l'eau bout, elle se transforme en…",r:"vapeur",autres:["glace","neige","pluie"],exp:"C'est l'évaporation (état gazeux)."},
     {q:"Les trois états de l'eau : solide, liquide et…",r:"gazeux",autres:["mou","dur","chaud"]},
     {q:"Sur quelle planète vivons-nous ?",r:"la Terre",autres:["Mars","la Lune","Jupiter"]},
     {q:"Quel astre nous éclaire le jour ?",r:"le Soleil",autres:["la Lune","une comète","Mars"]},
     {q:"La Lune tourne autour de…",r:"la Terre",autres:["le Soleil","Mars","Jupiter"]},
     {q:"Dans le cycle de l'eau, les nuages donnent…",r:"la pluie",autres:["le vent","le soleil","la terre"]},
     {q:"L'eau des océans qui s'évapore forme…",r:"des nuages",autres:["des vagues","du sel","des rivières"]},
   ])},
 ]},
 {id:'geo',nom:'Géographie',ico:'🗺️',couleur:'#d9885f',activites:[
   {nom:'Mon pays',niv:[3,6],gen:banque([
     {q:"Dans quel pays habites-tu ?",r:"la Belgique",autres:["la France","les Pays-Bas","l'Espagne"]},
     {q:"Quelle est la capitale de la Belgique ?",r:"Bruxelles",autres:["Liège","Anvers","Namur"]},
     {q:"Quelle langue parle-t-on à l'école en Wallonie ?",r:"le français",autres:["le néerlandais","l'anglais","l'allemand"]},
     {q:"Les couleurs du drapeau belge sont…",r:"noir, jaune, rouge",autres:["bleu, blanc, rouge","rouge, jaune, vert","noir, rouge, or"]},
     {q:"Quelle est la plus grande ville de Belgique ?",r:"Bruxelles",autres:["Liège","Gand","Charleroi"]},
   ])},
   {nom:'La Belgique',niv:[4,6],gen:banque([
     {q:"Combien y a-t-il de régions en Belgique ?",r:"3",autres:["2","4","10"],exp:"Wallonie, Flandre et Bruxelles-Capitale."},
     {q:"Quelle langue parle-t-on en Flandre ?",r:"le néerlandais",autres:["le français","l'allemand","l'anglais"]},
     {q:"Dans quelle région se trouve Liège ?",r:"la Wallonie",autres:["la Flandre","Bruxelles","les Ardennes"]},
     {q:"Quel fleuve traverse Liège ?",r:"la Meuse",autres:["l'Escaut","la Seine","le Rhin"]},
     {q:"Quel pays se trouve au sud de la Belgique ?",r:"la France",autres:["les Pays-Bas","l'Allemagne","le Luxembourg"]},
     {q:"Quel pays se trouve au nord de la Belgique ?",r:"les Pays-Bas",autres:["la France","l'Allemagne","l'Italie"]},
     {q:"Quelle mer borde la Belgique ?",r:"la mer du Nord",autres:["la Méditerranée","l'océan Atlantique","la mer Baltique"]},
     {q:"Combien de provinces compte la Belgique ?",r:"10",autres:["9","12","5"]},
   ])},
   {nom:'Provinces & chefs-lieux',niv:[5,6],gen:banque([
     {q:"Chef-lieu de la province de Liège ?",r:"Liège",autres:["Namur","Verviers","Huy"]},
     {q:"Chef-lieu de la province du Hainaut ?",r:"Mons",autres:["Charleroi","Tournai","Namur"]},
     {q:"Chef-lieu de la province de Namur ?",r:"Namur",autres:["Dinant","Wavre","Liège"]},
     {q:"Chef-lieu du Brabant wallon ?",r:"Wavre",autres:["Nivelles","Namur","Louvain"]},
     {q:"Chef-lieu de la province de Luxembourg ?",r:"Arlon",autres:["Bastogne","Marche","Namur"]},
     {q:"Chef-lieu de la Flandre-Occidentale ?",r:"Bruges",autres:["Gand","Courtrai","Ostende"]},
     {q:"Chef-lieu de la Flandre-Orientale ?",r:"Gand",autres:["Bruges","Anvers","Alost"]},
     {q:"Chef-lieu du Brabant flamand ?",r:"Louvain",autres:["Bruxelles","Malines","Wavre"]},
     {q:"Chef-lieu de la province d'Anvers ?",r:"Anvers",autres:["Malines","Gand","Turnhout"]},
     {q:"Chef-lieu de la province du Limbourg ?",r:"Hasselt",autres:["Genk","Louvain","Liège"]},
     {q:"Mons est le chef-lieu de quelle province ?",r:"le Hainaut",autres:["le Brabant wallon","Namur","Liège"]},
     {q:"Hasselt est le chef-lieu de quelle province ?",r:"le Limbourg",autres:["Anvers","le Brabant flamand","Liège"]},
     {q:"Arlon est le chef-lieu de quelle province ?",r:"le Luxembourg",autres:["Namur","le Hainaut","Liège"]},
     {q:"Wavre est le chef-lieu de quelle province ?",r:"le Brabant wallon",autres:["le Brabant flamand","Namur","le Hainaut"]},
   ])},
 ]},
];

/* 6. RENDU CARTE */
function etoilesHTML(p){let s='';for(let i=1;i<=5;i++)s+=`<span class="et${i<=p?' on':''}">★</span>`;return s;}
function carteHTML(c,n,{anim=false,palier=null}={}){const p=palier!=null?palier:palierApplique(c);const evo=(palier==null&&peutEvoluer(c))?'<div class="tc-evo">✨</div>':'';return `<div class="tcarte${anim?' tc-anim':''}" data-r="${c.rarete}" data-p="${p}"><div class="tc-art${c.image?' art-load':''}">${artHTML(c)}</div><div class="tc-scrim-top"></div><div class="tc-scrim-bot"></div><div class="tc-shine"></div><div class="tc-motes"><i></i><i></i><i></i></div><div class="tc-corner tl"></div><div class="tc-corner tr"></div><div class="tc-corner bl"></div><div class="tc-corner br"></div><div class="tc-frame"></div>${evo}${n&&n>1?`<div class="tc-nb">×${n}</div>`:''}<div class="tc-top">${p>=2?`<div class="tc-palier">${TITRES[p]}</div>`:'<span></span>'}<div class="tc-stars">${etoilesHTML(p)}</div></div><div class="tc-bottom"><div class="tc-nom">${c.nom}</div><div class="tc-rar">${RARETES[c.rarete].nom}</div><div class="tc-fam">${(c.familles||[]).map(f=>FAMILLES[f]?FAMILLES[f].nom:"").filter(Boolean).join(", ")}</div><div class="tc-meta">${ROYAUMES[c.royaume]?ROYAUMES[c.royaume].ico:""}</div></div></div>`;}
function carteMystereHTML(c){return `<div class="tcarte verrou" data-r="${c.rarete}" data-p="0"><div class="tc-art">?</div><div class="tc-scrim-top"></div><div class="tc-scrim-bot"></div><div class="tc-frame"></div><div class="tc-top"><span></span><div class="tc-stars">${etoilesHTML(0)}</div></div><div class="tc-bottom"><div class="tc-nom">${c.nom}</div><div class="tc-rar">${RARETES[c.rarete].nom}</div><div class="tc-fam">${(c.familles||[]).map(f=>FAMILLES[f]?FAMILLES[f].nom:"").filter(Boolean).join(", ")}</div><div class="tc-meta">${ROYAUMES[c.royaume]?ROYAUMES[c.royaume].ico:""}</div></div></div>`;}

/* 7. ÉCRANS */
function majSolde(anim){$('#solde-nb').textContent=etat.crins;const _ah=$('#av-hud');if(_ah)_ah.innerHTML='<span>💎 '+etat.crins+'</span><span>⭐ '+(etat.renommee||0)+'</span>';if(anim){const s=$('#solde');s.classList.remove('pulse');void s.offsetWidth;s.classList.add('pulse');}$('#btn-tirer').disabled=etat.crins<COUT_TIRAGE;const b10=$('#btn-tirer10');if(b10)b10.disabled=etat.crins<COUT_TIRAGE10;const bs=$('#btn-tirer-super');if(bs)bs.disabled=(etat.renommee||0)<COUT_SUPER_RENOM;const rn=$('#tirage-renom-nb');if(rn)rn.textContent=etat.renommee||0;const cn=$('#tirage-crins-nb');if(cn)cn.textContent=etat.crins;}
/* Feedback visuel du gain : « +N 💎 » qui monte et s'estompe + une pluie de diamants
   dont le nombre grandit avec la somme, pour qu'une grosse récompense se REMARQUE. */
let ancreGain=null;   // bouton de réponse cliqué, pour y centrer l'animation de gain
function montrerGainAnim(n){
  if(!(n>0))return;
  let a=(ancreGain&&ancreGain.isConnected)?ancreGain:null;ancreGain=null;
  if(!a)a=document.querySelector('#ae-choix .ae-rep.bon')||document.querySelector('#q-reponses button.bon');
  const surBouton=!!a;
  if(!a)a=document.getElementById('solde');
  if(!a)return;
  const r=a.getBoundingClientRect(),cx=r.left+r.width/2,cy=surBouton?(r.top+r.height/2):(r.bottom-2);
  const grand=n>=18,moyen=n>=10;
  const lab=document.createElement('div');lab.className='gain-pop'+(grand?' xl':moyen?' l':'');
  lab.textContent='+'+n+' 💎';lab.style.left=cx+'px';lab.style.top=cy+'px';
  document.body.appendChild(lab);setTimeout(()=>lab.remove(),1300);
  const spread=surBouton?Math.min(90,r.width/2):70;
  const k=Math.max(3,Math.min(16,Math.round(n/2)+2));
  for(let i=0;i<k;i++){const p=document.createElement('div');p.className='gain-dia';p.textContent='💎';
    p.style.left=cx+'px';p.style.top=cy+'px';
    p.style.setProperty('--dx',((Math.random()*2-1)*spread).toFixed(0)+'px');
    p.style.setProperty('--dy',(-(38+Math.random()*80)).toFixed(0)+'px');
    p.style.animationDelay=(i*28)+'ms';
    document.body.appendChild(p);setTimeout(()=>p.remove(),1300);}
}
function majProgression(){const t=CARTES.length,u=nbUniques();$('#prog-fill').style.width=(t?u/t*100:0)+'%';$('#prog-txt').textContent=`${u} / ${t} créatures · ${totalEtoiles()} ★`;$('#ecurie-compte').textContent=`${u}/${t}`;}
let filtrePossedes=true,triChamp='rarete',triSens=-1;   // -1 = décroissant (rare/évolué d'abord)
const ORD_RAR=Object.keys(RARETES);
const ORD_FAM=Object.keys(FAMILLES);
function valTri(c){const n=etat.collection[c.id]||0;
  if(triChamp==='niveau')return palierDe(n);
  if(triChamp==='famille'){const i=ORD_FAM.indexOf((c.familles||[])[0]);return i<0?99:i;}
  if(triChamp==='acquis')return (etat.acquis&&etat.acquis[c.id])||0;
  return ORD_RAR.indexOf(c.rarete);}
function rendreGrille(){
  const g=$('#grille');g.innerHTML='';
  let list=CARTES.slice();
  if(filtrePossedes)list=list.filter(c=>(etat.collection[c.id]||0)>0);
  list.sort((a,b)=>{const d=valTri(a)-valTri(b);return d!==0?d*triSens:(ORD_RAR.indexOf(a.rarete)-ORD_RAR.indexOf(b.rarete))||a.nom.localeCompare(b.nom);});
  if(!list.length){g.innerHTML='<p style="grid-column:1/-1;text-align:center;color:var(--txt-doux);padding:34px 0;">Aucune carte possédée pour l\'instant.</p>';return;}
  list.forEach(c=>{const n=etat.collection[c.id]||0;const box=document.createElement('div');box.className='tc-box ratio';box.innerHTML=n?carteHTML(c,n):carteMystereHTML(c);box.onclick=n?()=>ouvrirDetail(c):()=>toast(c.nom+' — à découvrir au tirage !');g.appendChild(box);});
}
function maximiser(c){const im=Array.isArray(c.image)?c.image[Math.min(palierDe(etat.collection[c.id]||1),c.image.length)-1]:c.image;if(!im)return;$('#img-max-src').src=im;$('#img-max').classList.add('on');}
function rendreChances(){const box=$('#chances-liste');box.innerHTML='';const tiers=Object.entries(RARETES).filter(([k,r])=>r.poids>0&&CARTES.some(c=>c.rarete===k));const tot=tiers.reduce((s,[,r])=>s+r.poids,0)||1;const fmt=n=>{const d=n>=10?0:(n>=1?1:2);return String(parseFloat(n.toFixed(d))).replace('.',',');};tiers.forEach(([k,r])=>{const pct=r.poids/tot*100;const l=document.createElement('div');l.className='ligne';l.innerHTML=`<span class="pastille" style="background:${r.couleur}"></span>${r.nom}<span class="pct" style="color:${r.couleur}">${fmt(pct)} %</span>`;box.appendChild(l);});}

/* 8. TIRAGE + ÉVOLUTION */
function tirerRarete(){const d=Object.entries(RARETES).filter(([k])=>CARTES.some(c=>c.rarete===k));const t=d.reduce((s,[,r])=>s+r.poids,0);let x=Math.random()*t;for(const[k,r]of d){if(x<r.poids)return k;x-=r.poids;}return d[0][0];}
function tirerCarte(){const r=tirerRarete();const pool=CARTES.filter(c=>c.rarete===r);return pool[rnd(0,pool.length-1)];}
/* Tirage pondéré avec plancher de rareté (utilisé par le pity et le super-tirage). */
function tirerRareteMin(floor){const d=Object.entries(RARETES).filter(([k])=>rankRar(k)>=(floor||0)&&CARTES.some(c=>c.rarete===k));if(!d.length)return tirerRarete();const t=d.reduce((s,[,r])=>s+r.poids,0);let x=Math.random()*t;for(const[k,r]of d){if(x<r.poids)return k;x-=r.poids;}return d[0][0];}
/* Tirage normal + système de pity : garantit un épique+ tous les PITY_EPIC et un légendaire+ tous les PITY_LEGEND. */
function tirerCartePity(){const p=etat.pity||(etat.pity={epic:0,legend:0});let floor=0;if(p.legend+1>=PITY_LEGEND)floor=3;else if(p.epic+1>=PITY_EPIC)floor=2;const r=floor?tirerRareteMin(floor):tirerRarete();const pool=CARTES.filter(c=>c.rarete===r);const c=pool[rnd(0,pool.length-1)];const rk=rankRar(r);p.epic=rk>=2?0:p.epic+1;p.legend=rk>=3?0:p.legend+1;return c;}
/* Super-tirage : épique ou mieux garanti, payé en renommée. N'affecte pas le pity. */
function tirerCarteSuper(){const r=tirerRareteMin(2);const pool=CARTES.filter(c=>c.rarete===r);return pool[rnd(0,pool.length-1)];}
/* ---- JALONS : cartes CÉLESTES débloquées par accomplissement (jamais au tirage) ---- */
function familleComplete(fam){const l=CARTES.filter(c=>c.rarete!=='celeste'&&(c.familles||[]).includes(fam));return l.length>0&&l.every(c=>(etat.collection[c.id]||0)>0);}
function verifierJalons(silencieux){
  etat.jalons=etat.jalons||{};const gagnes=[];
  for(const j of JALONS){
    if(etat.jalons[j.carte])continue;
    let ok=false;try{ok=!!j.cond();}catch(e){ok=false;}
    if(!ok)continue;
    const c=CARTES.find(x=>x.id===j.carte);etat.jalons[j.carte]=true;if(!c)continue;
    if(!(etat.collection[j.carte]>0)){etat.collection[j.carte]=1;etat.paliers[j.carte]=1;}
    gagnes.push(c);
  }
  if(gagnes.length){sauver();rendreGrille();majProgression();gagnes.forEach(c=>toast('🌟 Céleste débloquée : '+c.nom+' !'));if(!silencieux&&!revealVerrou){const c=gagnes[0];montrerReveal(c,etat.collection[c.id]||1,'🌟 Carte Céleste !',c.nom+' rejoint ton écurie','neuf');}}
  return gagnes;
}
/* ---- FUSION : 3 doublons « sûrs » d'une rareté → 1 tirage de la rareté supérieure.
   « Sûr » = au-dessus du seuil du palier appliqué : ne retire jamais une étoile ni la dernière copie. ---- */
const COUT_FUSION=3;
const FUSION_SUP={commune:'rare',rare:'epique',epique:'legendaire',legendaire:'mythique'};
function dupSafe(c){const n=etat.collection[c.id]||0;if(n<1)return 0;const pd=palierDe(n);const need=pd>=1?SEUILS[pd-1]:1;return Math.max(0,n-need);}
function safeTotalRarete(r){return CARTES.filter(c=>c.rarete===r).reduce((s,c)=>s+dupSafe(c),0);}
function fusionner(r){
  const NR=FUSION_SUP[r];if(!NR){toast('Rareté non fusionnable');return;}
  if(revealVerrou)return;
  if(safeTotalRarete(r)<COUT_FUSION){toast('Pas assez de doublons '+RARETES[r].nom);return;}
  let rest=COUT_FUSION;
  const cards=CARTES.filter(c=>c.rarete===r&&dupSafe(c)>0).sort((a,b)=>dupSafe(b)-dupSafe(a));
  for(const c of cards){if(rest<=0)break;const take=Math.min(rest,dupSafe(c));etat.collection[c.id]-=take;rest-=take;}
  const pool=CARTES.filter(c=>c.rarete===NR);const c=pool[rnd(0,pool.length-1)];const res=ajouterExemplaire(c);
  sauver();montrerReveal(c,etat.collection[c.id],res.etatTxt,res.sousTxt,res.cls);majSolde(true);majProgression();rendreGrille();verifierJalons();
}
function ouvrirAtelier(){renderAtelier();$('#atelier-fond').classList.add('on');}
function renderAtelier(){
  const fb=$('#atelier-fusion');fb.innerHTML='';
  Object.keys(FUSION_SUP).forEach(r=>{const dispo=safeTotalRarete(r),NR=FUSION_SUP[r],ok=dispo>=COUT_FUSION;
    const row=document.createElement('div');row.className='atl-row';
    row.innerHTML=`<span class="atl-past" style="background:${RARETES[r].couleur}"></span><span class="atl-lbl">${RARETES[r].nom} → <b style="color:${RARETES[NR].couleur}">${RARETES[NR].nom}</b><small>${dispo} doublon${dispo>1?'s':''} disponible${dispo>1?'s':''}</small></span><button class="atl-btn" ${ok?'':'disabled'}>${COUT_FUSION} → 1</button>`;
    if(ok)row.querySelector('.atl-btn').onclick=()=>{fusionner(r);renderAtelier();};
    fb.appendChild(row);});
  const jb=$('#atelier-jalons');jb.innerHTML='';
  JALONS.forEach(j=>{const c=CARTES.find(x=>x.id===j.carte);const fait=!!etat.jalons[j.carte];let now=false;try{now=!!j.cond();}catch(e){}
    const row=document.createElement('div');row.className='atl-jrow'+(fait?' fait':'');
    row.innerHTML=`<span class="atl-jico">${fait?'🌟':'🔒'}</span><span class="atl-lbl">${c?c.nom:j.carte}<small>${j.txt}</small></span><span class="atl-jetat">${fait?'✓ obtenu':(now?'prêt !':'à faire')}</span>`;
    jb.appendChild(row);});
}
let revealVerrou=false;
let revealApres=null;   // callback appelé à la fermeture d'une révélation (pour enchaîner)
function ajouterExemplaire(c){
  const avant=etat.collection[c.id]||0,apres=avant+1;etat.collection[c.id]=apres;
  if(avant===0){etat.paliers[c.id]=1;etat.acquis=etat.acquis||{};etat.acquis[c.id]=++etat.acquisN;return{etatTxt:'Nouvelle créature !',sousTxt:`${c.nom} rejoint ton écurie`,cls:'neuf'};}
  const applique=palierApplique(c),maxDeblo=palierDe(apres);
  if(maxDeblo>applique&&applique<5)return{etatTxt:'✨ Prête à évoluer !',sousTxt:`Un doublon de plus — fais évoluer ${c.nom} dans sa fiche`,cls:'evo'};
  if(applique>=5){const o=RARETES[c.rarete].overflow;etat.crins+=o;return{etatTxt:'Déjà au sommet',sousTxt:`Maximum atteint · +${o} Diamants`,cls:''};}
  const s=SEUILS[applique];return{etatTxt:'Doublon',sousTxt:`Plus que ${s-apres} pour débloquer ${'★'.repeat(applique+1)}`,cls:''};
}
function doTirage(){
  if(etat.crins<COUT_TIRAGE){toast('Pas assez de Diamants — va réviser !');return;}
  if(revealVerrou)return;
  etat.crins-=COUT_TIRAGE;etat.tirages++;
  const c=tirerCartePity();const r=ajouterExemplaire(c);
  sauver();montrerReveal(c,etat.collection[c.id],r.etatTxt,r.sousTxt,r.cls);majSolde(true);majProgression();rendreGrille();verifierJalons();
}
function doTirageSuper(){
  if((etat.renommee||0)<COUT_SUPER_RENOM){toast('Pas assez de renommée — gagne des concours !');return;}
  if(revealVerrou)return;
  etat.renommee-=COUT_SUPER_RENOM;etat.tirages++;
  const c=tirerCarteSuper();const r=ajouterExemplaire(c);
  sauver();montrerReveal(c,etat.collection[c.id],r.etatTxt,r.sousTxt,r.cls);majSolde(true);majProgression();rendreGrille();verifierJalons();
}
const RANG_RAR=c=>({commune:0,rare:1,epique:2,legendaire:3,mythique:4,celeste:5}[c.rarete]||0);
function doTirage10(){
  if(etat.crins<COUT_TIRAGE10){toast('Pas assez de Diamants pour un tirage ×10');return;}
  if(revealVerrou)return;
  etat.crins-=COUT_TIRAGE10;etat.tirages+=10;
  const res=[];
  for(let i=0;i<10;i++){const c=tirerCartePity();const r=ajouterExemplaire(c);res.push({c,cls:r.cls,etatTxt:r.etatTxt});}
  sauver();majSolde(true);majProgression();rendreGrille();verifierJalons(true);
  montrerResultat10(res);
}
function montrerResultat10(res){
  const ordre={neuf:0,evo:1};
  const tri=[...res].sort((a,b)=>((ordre[a.cls]!=null?ordre[a.cls]:2)-(ordre[b.cls]!=null?ordre[b.cls]:2))||(RANG_RAR(b.c)-RANG_RAR(a.c)));
  $('#t10-liste').innerHTML=tri.map(r=>{
    const c=r.c;let badge;
    if(r.cls==='neuf')badge='<span class="t10-b neuf">✨ Nouveau</span>';
    else if(r.cls==='evo')badge='<span class="t10-b evo">⬆ Évolution possible</span>';
    else if(r.etatTxt==='Déjà au sommet')badge='<span class="t10-b max">★ Max</span>';
    else badge='<span class="t10-b dup">doublon</span>';
    return '<div class="t10-row"><div class="tc-box ratio t10-vig">'+carteHTML(c,etat.collection[c.id]||1)+'</div><div class="t10-info"><div class="t10-nom">'+c.nom+'</div><div class="t10-rar" style="color:'+RARETES[c.rarete].couleur+'">'+RARETES[c.rarete].nom+'</div></div>'+badge+'</div>';
  }).join('');
  $('#t10-fond').classList.add('on');
}
function montrerReveal(c,n,etatTxt,sousTxt,cls){revealVerrou=true;const ov=$('#reveal'),flip=$('#reveal-flip');ov.style.setProperty('--rc',RARETES[c.rarete].couleur);$('#reveal-rayons').style.setProperty('--rc',RARETES[c.rarete].couleur);$('#reveal-front').innerHTML=carteHTML(c,n,{anim:true});const e=$('#reveal-etat');e.textContent=etatTxt;e.className='r-etat'+(cls?' '+cls:'');$('#reveal-sous').textContent=sousTxt;ov.classList.toggle('evo',cls==='evo');flip.classList.remove('flip');ov.classList.add('on');requestAnimationFrame(()=>setTimeout(()=>flip.classList.add('flip'),260));}
function fermerReveal(){if(!revealVerrou)return;$('#reveal').classList.remove('on');revealVerrou=false;const cb=revealApres;revealApres=null;if(typeof cb==='function')cb();}

/* 9. DÉTAIL CARTE */
function ouvrirDetail(c){
  const n=etat.collection[c.id]||0,p=palierApplique(c);
  $('#detail-hero').innerHTML=carteHTML(c,n,{anim:true});
  $('#d-nom').textContent=c.nom;
  const dr=$('#d-rar');dr.textContent=RARETES[c.rarete].nom;dr.style.color=RARETES[c.rarete].couleur;
  const roy=ROYAUMES[c.royaume],fam=(c.familles||[]).map(f=>FAMILLES[f]).filter(Boolean);
  $('#d-classif').innerHTML=(roy?`<span class="cl-chip cl-roy">${roy.ico} ${roy.nom}</span>`:'')+`<span class="cl-chip">${gabaritDe(c)==='poney'?'🐴 Poney':'🐎 Cheval'}</span>`+fam.map(f=>`<span class="cl-chip">${f.ico} ${f.nom}</span>`).join('');
  $('#d-desc').textContent=c.desc;
  if(peutEvoluer(c))$('#d-progres').textContent=`${n} exemplaires · évolution prête !`;
  else if(p>=5)$('#d-progres').textContent=`Évolution maximale · ${n} exemplaires`;
  else $('#d-progres').textContent=`${n} exemplaire${n>1?'s':''} · plus que ${SEUILS[p]-n} doublon${SEUILS[p]-n>1?'s':''} pour débloquer ${'★'.repeat(p+1)}`;
  const evo=$('#d-evo');evo.innerHTML='';
  if(peutEvoluer(c)){const b=document.createElement('button');b.className='d-evo-btn';b.innerHTML=`✨ Évoluer vers ${'★'.repeat(p+1)} — ${TITRES[p+1]}`;b.onclick=()=>{if(evoluer(c)){toast(`✨ ${c.nom} évolue : ${TITRES[palierApplique(c)]} !`);majProgression();rendreGrille();ouvrirDetail(c);}};evo.appendChild(b);}
  const ech=$('#d-echelle');ech.innerHTML='';
  for(let i=1;i<=5;i++){const atteint=p>=i,pret=(i===p+1&&n>=SEUILS[i-1]),courant=(i===p+1&&!pret);const et='★'.repeat(i)+`<span class="off">${'★'.repeat(5-i)}</span>`;const l=document.createElement('div');l.className='pal-ligne'+(atteint?' atteint':'')+(courant?' courant':'');l.innerHTML=`<span class="pal-etoiles">${et}</span><span class="pal-nom">${TITRES[i]}</span><span class="pal-seuil">${atteint?'atteint ✓':pret?'prêt ✨':SEUILS[i-1]+' ex.'}</span>`;ech.appendChild(l);}
  $('#detail-hero').onclick=()=>maximiser(c);$('#detail-agrandir').onclick=()=>maximiser(c);
  const st=$('#d-stats');st.innerHTML='';const faibC=faiblesseDe(c);CAPS.forEach(cap=>{const v=statDe(c,cap.id);const fort=(c.aff||[]).includes(cap.id);const faible=(!fort&&faibC===cap.id);const marque=fort?'<span class="cap-mark fort" title="Point fort">▲</span>':(faible?'<span class="cap-mark faible" title="Point faible">▼</span>':'<span class="cap-mark"></span>');const l=document.createElement('div');l.className='cap-ligne'+(fort?' est-fort':faible?' est-faible':'');l.innerHTML=`<span class="cap-ico">${cap.ico}</span><span class="cap-nom">${cap.nom}</span><div class="cap-bar"><div style="width:${v}%;background:${cap.couleur}"></div></div>${marque}<span class="cap-val">${v}</span>`;st.appendChild(l);});
  const ff=$('#feuille-fond');ff.classList.add('on');const fe=ff.querySelector('.feuille');if(fe)fe.scrollTop=0;
  const pr=$('#d-proprios');pr.innerHTML='';
  if(CLOUD.actif()&&profilActif.cloud){
    cloudProprietaires(c.id).then(list=>{
      const autres=(list||[]).filter(o=>o.prenom!==profilActif.nom);
      if(!autres.length){pr.innerHTML='<div class="dpr-titre">Personne d\'autre ne l\'a encore 🌟</div>';return;}
      pr.innerHTML='<div class="dpr-titre">Aussi dans l\'écurie de</div><div class="dpr-liste">'+autres.map(o=>`<span class="dpr-chip">${o.prenom} ${'★'.repeat(Math.max(1,o.palier||1))}</span>`).join('')+'</div>';
    }).catch(()=>{});
  }
}

/* ---- CONCOURS : peloton (6), révélation progressive, prix au podium ---- */
let concoursCourant=null;
function posMedaille(p){return p===1?'🥇 1er':p===2?'🥈 2e':p===3?'🥉 3e':p+'e';}
function renderConcours(){
  ensureConcoursJour();
  $('#renom-bandeau').innerHTML=`<div class="rb-g">Écurie ${rangEcurie(etat.renommeeTotale)}<small>renommée disponible</small></div><div class="rb-r">⭐ ${etat.renommee}</div>`;
  const cout=coutRenouv();
  $('#renouv-zone').innerHTML=`<button class="renouv-btn" id="btn-renouv">🔄 Renouveler les concours — ${cout} Diamants${etat.concours.refresh?` · ${etat.concours.refresh}× aujourd'hui`:''}</button>`;
  $('#btn-renouv').onclick=renouvelerConcours;
  const box=$('#concours-liste');box.innerHTML='';
  concoursDuJour().list.forEach(co=>{
    const cap=CAPS.find(c=>c.id===co.cap),div=DIVISIONS.find(d=>d.rarete===co.rarete),fam=libFam(co),rc=RARETES[co.rarete];
    const fait=etat.concours.faits[co.i];
    const el=document.createElement('div');el.className='concours-carte'+(fait?' fait':'');
    el.innerHTML=`<div class="cc-bg" style="background-image:url(${cap.img})"></div><div class="cc-scrim"></div><div class="cc-inner"><div class="cc-titre">${cap.epreuve}</div><div class="cc-cond"><span class="ccx">${fam.ico} ${fam.nom}</span><span class="ccx" style="border-color:${rc.couleur}66">${div.ico} ${div.nom}</span><span class="ccx" style="color:${cap.couleur}">${cap.ico} ${cap.nom}</span></div><div class="cc-bas"><div class="cc-prix">mise ${div.inscription} 💎 · 🥇${div.crins[0]} 🥈${div.crins[1]} 🥉${div.crins[2]} 💎</div>${fait?`<span class="cc-etat ${fait<=3?'gagne':'perdu'}">${posMedaille(fait).split(' ')[0]}</span>`:'<span class="cc-go">Concourir ▶</span>'}</div></div>`;
    if(!fait)el.onclick=()=>ouvrirSelecteurPeloton(co);
    box.appendChild(el);
  });
  majCompteurReset();
}
function renouvelerConcours(){
  const cout=coutRenouv();
  if(etat.crins<cout){toast('Pas assez de Diamants pour renouveler');return;}
  etat.crins-=cout;etat.concours.refresh=(etat.concours.refresh||0)+1;etat.concours.faits={};
  sauver();majSolde(true);renderConcours();toast('Nouveaux concours !');
}
function ouvrirSelecteurPeloton(co){
  concoursCourant=co;const cap=CAPS.find(c=>c.id===co.cap),div=DIVISIONS.find(d=>d.rarete===co.rarete),fam=libFam(co),rc=RARETES[co.rarete];
  $('#cs-titre').textContent=`${cap.ico} ${cap.epreuve}`;
  $('#cs-sous').innerHTML=`<b style="color:${rc.couleur}">${div.ico} ${div.nom}</b> · ${fam.ico} ${fam.nom} · mise ${div.inscription} Diamants.<br>Choisis un ${co.gab?'poney':'cheval <b>'+fam.nom+'</b>'} de division <b>${div.nom}</b>.`;
  $('#cs-fermer').style.display='';
  const box=$('#cs-liste');box.innerHTML='';
  const owned=poolConcours(co).filter(c=>(etat.collection[c.id]||0)>0).sort((a,b)=>statDe(b,co.cap)-statDe(a,co.cap));
  if(!owned.length)box.innerHTML=`<p class="cs-vide">Aucun ${co.gab?'poney':'cheval <b>'+fam.nom+'</b>'} en division <b>${div.nom}</b>.<br>Collectionne-en un pour concourir !</p>`;
  else owned.forEach(c=>{const v=statDe(c,co.cap);const row=document.createElement('div');row.className='cs-row';row.innerHTML=`<div class="tc-box ratio cs-vig">${carteHTML(c,etat.collection[c.id]||1)}</div><span class="cs-nom">${c.nom}</span><span class="cs-etoiles">${'★'.repeat(palierApplique(c))}</span><span class="cs-stat" style="color:${cap.couleur}">${v}</span>`;row.onclick=()=>lancerPeloton(co,c);box.appendChild(row);});
  $('#concours-fond').classList.add('on');
}
function pelotonAdversaires(co,n){
  let pool=poolConcours(co);
  if(!pool.length)pool=CARTES.filter(c=>c.rarete===co.rarete);if(!pool.length)pool=CARTES;
  const out=[];for(let i=0;i<n;i++){const c=pool[rnd(0,pool.length-1)],pal=rnd(1,5);out.push({carte:c,palier:pal,perf:statCap(c,co.cap,pal),moi:false});}
  return out;
}
function lancerPeloton(co,moi){
  const div=DIVISIONS.find(d=>d.rarete===co.rarete),cap=CAPS.find(c=>c.id===co.cap);
  if(etat.crins<div.inscription){toast('Pas assez de Diamants pour la mise');return;}
  etat.crins-=div.inscription;majSolde(true);
  const comp=[{carte:moi,palier:palierApplique(moi),perf:statDe(moi,co.cap),moi:true},...pelotonAdversaires(co,5)];
  const advs=comp.filter(x=>!x.moi);for(let i=advs.length-1;i>0;i--){const j=rnd(0,i);[advs[i],advs[j]]=[advs[j],advs[i]];}
  const ordre=[...advs,comp.find(x=>x.moi)];
  $('#cs-titre').textContent=`${cap.ico} ${cap.epreuve} — ${div.ico} ${div.nom}`;
  $('#cs-sous').textContent='Le peloton s\u2019élance…';$('#cs-fermer').style.display='none';
  const box=$('#cs-liste');const reveles=new Set();let k=0;
  const dessine=()=>{
    const shown=[...comp].sort((a,b)=>((reveles.has(b)?b.perf:-1)-(reveles.has(a)?a.perf:-1)));
    const rev=shown.filter(y=>reveles.has(y));
    box.innerHTML='<div class="pel-liste">'+shown.map(x=>{const r=reveles.has(x);const rank=r?rev.indexOf(x)+1:0;return `<div class="pel-row${x.moi?' moi':''}${r?' rev':''}"><div class="pel-pos">${r?posMedaille(rank).split(' ')[0]:'·'}</div><div class="tc-box ratio pel-vig">${carteHTML(x.carte,0,{palier:x.palier})}</div><div class="pel-nom">${x.moi?'★ Toi':x.carte.nom}</div><div class="pel-perf" style="color:${cap.couleur}">${r?x.perf:'…'}</div></div>`;}).join('')+'</div>';
  };
  dessine();
  const revele=()=>{
    reveles.add(ordre[k]);k++;dessine();
    if(k<ordre.length)setTimeout(revele,ordre[k].moi?1100:700);
    else setTimeout(()=>finPeloton(co,comp),750);
  };
  setTimeout(revele,600);
}
function finPeloton(co,comp){
  const div=DIVISIONS.find(d=>d.rarete===co.rarete);
  const classe=[...comp].sort((a,b)=>b.perf-a.perf);
  const moi=comp.find(x=>x.moi),pos=classe.indexOf(moi)+1;
  let gc=0,gr=0;
  if(pos<=3){gc=div.crins[pos-1];gr=div.renom[pos-1];etat.crins+=gc;etat.renommee+=gr;etat.renommeeTotale+=gr;}
  etat.concours.faits[co.i]=pos;sauver();majSolde(true);verifierJalons();
  const pod=pos<=3;
  $('#cs-liste').insertAdjacentHTML('beforeend',`<div class="cs-resultat"><div class="csr-t ${pod?'win':'lose'}">${posMedaille(pos)}${pod?' !':''}</div><div class="csr-d">${pod?`+${gc} Diamants · +${gr} ⭐ renommée`:'Hors du podium — mise perdue'}</div><button class="defi-continuer" id="cs-continuer">Continuer ›</button></div>`);
  $('#cs-continuer').onclick=()=>{$('#concours-fond').classList.remove('on');renderConcours();};
}

/* ---- MARCHAND : 3 cartes/jour contre renommée ---- */
function tirerRareteMarchand(rng){const d=Object.entries(POIDS_MARCHAND).filter(([k])=>CARTES.some(c=>c.rarete===k));const t=d.reduce((s,[,w])=>s+w,0);let x=rng()*t;for(const[k,w]of d){if(x<w)return k;x-=w;}return d[0][0];}
function marchandDuJour(){const d=ymd(new Date());const rng=mulberry32(hashStr('marchand-'+profilActif.id+'-'+d));const list=[];for(let k=0;k<3;k++){const rar=tirerRareteMarchand(rng);const pool=CARTES.filter(c=>c.rarete===rar);const c=pool[Math.floor(rng()*pool.length)];list.push({slot:k,id:c.id,rarete:rar,prix:PRIX_MARCHAND[rar]});}return{date:d,list};}
function ensureMarchandJour(){const d=ymd(new Date());if(etat.marchand.date!==d){etat.marchand={date:d,achetes:[]};sauver();}}
function renderMarchand(){
  ensureMarchandJour();
  $('#marchand-renom').innerHTML=`Tu as <b style="color:var(--or)">⭐ ${etat.renommee}</b> de renommée à dépenser.`;
  const box=$('#marchand-liste');box.innerHTML='';
  marchandDuJour().list.forEach(o=>{
    const c=CARTES.find(x=>x.id===o.id),achete=etat.marchand.achetes.includes(o.slot),abordable=etat.renommee>=o.prix,poss=(etat.collection[c.id]||0)>0;
    const row=document.createElement('div');row.className='ma-row'+(achete?' achete':'');
    row.innerHTML=`<div class="tc-box ratio ma-vig">${carteHTML(c,etat.collection[c.id]||0)}</div><div class="ma-info"><div class="ma-nom">${c.nom}</div><div class="ma-rar" style="color:${RARETES[c.rarete].couleur}">${RARETES[c.rarete].nom}${poss?' · déjà en écurie':''}</div></div>${achete?'<span class="ma-etat">✓ Acheté</span>':`<button class="ma-acheter${abordable?'':' off'}">⭐ ${o.prix}</button>`}`;
    if(!achete)row.querySelector('.ma-acheter').onclick=()=>acheterMarchand(o.slot);
    box.appendChild(row);
  });
  majCompteurReset();
}
function acheterMarchand(slot){
  const o=marchandDuJour().list[slot];
  if(etat.marchand.achetes.includes(slot))return;
  if(etat.renommee<o.prix){toast('Pas assez de renommée — gagne des concours !');return;}
  const c=CARTES.find(x=>x.id===o.id);
  etat.renommee-=o.prix;etat.marchand.achetes.push(slot);
  const r=ajouterExemplaire(c);
  sauver();
  $('#marchand-fond').classList.remove('on');
  montrerReveal(c,etat.collection[c.id],r.etatTxt,r.sousTxt,r.cls);
  majSolde(true);majProgression();rendreGrille();renderConcours();
}

/* 10. DÉFIS  (exercices + mini-jeux tirés au hasard) */
const NB_CARTES_DEFI=3;   // cartes-mystère proposées (mettre 2 pour encore moins de choix)
const JEU_TOUS_LES=5;     // un mini-jeu surgit tous les N exercices, en Général / Général +1 seulement
let matSource=null,qCour=null,serieCourante=0,quizVerrou=false;
function capDiff(){const n=profilActif.niveau||5;return n<=3?1:(n===4?2:3);}
function diffMaths(){const off=((packActif&&packActif.nivOffset)||0);const lv=niveauDe(etat.xp.maths)+off*2;return Math.min(3,capDiff()+off,Math.floor((lv-1)/2)+1);}
function statMatiere(id){etat.stats[id]=etat.stats[id]||{ok:0,tot:0};return etat.stats[id];}
function statPack(id){etat.statsPack=etat.statsPack||{};etat.statsPack[id]=etat.statsPack[id]||{ok:0,tot:0};return etat.statsPack[id];}

let theorieCour='';
function afficherTheorie(){const p=document.getElementById('pack-theo-panel');if(!p)return;if(p.dataset.on==='1'){p.style.display='none';p.dataset.on='';return;}p.innerHTML='<button class="theo-fermer" onclick="fermerTheorie()">✕</button><div class="theo-txt"></div>';p.querySelector('.theo-txt').textContent=theorieCour;if(packActif&&packActif.id==='races'&&typeof galerieHisto==='function')p.insertAdjacentHTML('beforeend',galerieHisto());p.style.display='';p.dataset.on='1';}
function fermerTheorie(){const p=document.getElementById('pack-theo-panel');if(p){p.style.display='none';p.dataset.on='';}}
function galerieHisto(){const item=id=>{const c=CARTES.find(x=>x.id===id);const im=c?(Array.isArray(c.image)?c.image[0]:c.image):null;return '<button class="tg-item" onclick="ouvrirFiche(\''+id+'\')">'+(im?'<img src="'+im+'" loading="lazy" alt="">':'')+'<span>'+(c?c.nom:id)+'</span></button>';};const histo=Object.keys(FICHES_HISTO);const leg=[...LEGENDES].filter(aFiche);return '<div class="theo-galerie-t">🏛️ Les chevaux qui ont marqué l\'Histoire</div><div class="theo-galerie">'+histo.map(item).join('')+'</div><div class="theo-galerie-t">✨ Les chevaux de légende</div><div class="theo-galerie">'+leg.map(item).join('')+'</div>';}
function ouvrirFiche(id){const f=ficheDe(id);if(!f)return;const c=CARTES.find(x=>x.id===id);const im=c?(Array.isArray(c.image)?c.image[0]:c.image):null;const fi=$('#fiche-img');if(fi)fi.innerHTML=im?'<img src="'+im+'" alt="'+(c?c.nom:'')+'">':'';const ft=$('#fiche-titre');if(ft)ft.textContent=f.titre;const fp=$('#fiche-paras');if(fp)fp.innerHTML=f.paras.map(p=>'<p>'+p+'</p>').join('');$('#fiche-fond').classList.add('on');}
function blocTheorie(txt,niv){theorieCour=txt||'';if(!txt)return '';return '<div class="pack-niv">'+(niv||'')+'</div><button class="pack-theo" id="pack-theo-btn" onclick="afficherTheorie()">📖 Théorie</button><div class="pack-theo-panel" id="pack-theo-panel" style="display:none"></div>';}
// robes déterminées d'après la race et la description
/* Chevaux historiques réels (individus documentés) : fiches pour l'onglet théorie. */
function estRace(c){return BREEDS.includes(c.id);}
function estHistorique(c){return HISTORIQUES.has(c.id)||!!HISTO[c.id];}
function estLegende(c){return LEGENDES.has(c.id);}
function catCheval(c){return estRace(c)?'race':estHistorique(c)?'histoire':estLegende(c)?'legende':'invente';}
function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
function ficheDe(id){
  if(FICHES_HISTO[id])return FICHES_HISTO[id];
  if(FICHES_LEGENDE[id])return FICHES_LEGENDE[id];
  if(LEGENDES.has(id)&&MYTHES[id]){const c=CARTES.find(x=>x.id===id),my=MYTHES[id];const paras=[];
    if(my.perso)paras.push('Une créature légendaire liée à '+my.perso+'.');
    if(my.fait)paras.push(cap(my.fait)+'.');
    paras.push('Elle fait partie des grandes légendes que se racontent les peuples du monde depuis très longtemps.');
    return {titre:(c?c.nom:id),paras};}
  return null;
}
function aFiche(id){return !!ficheDe(id);}


let packActif=null,recentQ=[],jeuCompteur=0;
const SEUIL_MAITRISE=2;
/* Niveaux 2 : questions de l'année supérieure. Chaque pack a maintenant 2 niveaux à maîtriser. */
const PACK_NIVEAUX={geek:()=>[BANK_GEEK,BANK_GEEK_N2],anglais:()=>[BANK_ANGLAIS,BANK_ANGLAIS_N2],ortho:()=>{const h=Math.ceil(ORTHO_ITEMS.length/2);return [ORTHO_ITEMS.slice(0,h),ORTHO_ITEMS.slice(h)];},art:()=>[BANK_ART,BANK_ART_N2],neerlandais:()=>[BANK_NEERLANDAIS,BANK_NEERLANDAIS_N2],trivia:()=>[BANK_TRIVIA,BANK_TRIVIA_N2]};
const PACK_KEY={geek:q=>q.q,anglais:q=>q.q,ortho:it=>it.r,art:q=>q.q,neerlandais:q=>q.q,trivia:q=>q.q};
function theoriePack(p){if(!p)return '';const t=PACK_THEO_NIV[p.id];if(t){const nv=packNiv(p.id);return t[Math.min(nv,t.length)-1];}return p.theorie||'';}
function nivLabel(p){if(!p)return '';return (PACK_THEO_NIV[p.id]||PACK_NIVEAUX[p.id])?('Niveau '+packNiv(p.id)):(p.niv||'');}

function packProg0(id){let pp=etat.packprog[id];if(!pp||typeof pp.niv!=='number'){pp=etat.packprog[id]={niv:1,c:{},done:{}};}pp.c=pp.c||{};pp.done=pp.done||{};return pp;}
function packNiv(id){return packProg0(id).niv||1;}
function packBank(id){const f=PACK_NIVEAUX[id];if(!f)return null;const banks=f();return banks[Math.min(packNiv(id),banks.length)-1];}
function packCounts(id){const pp=packProg0(id),nv=packNiv(id);pp.c[nv]=pp.c[nv]||{};return pp.c[nv];}
function progPack(id){const bank=packBank(id);if(!bank)return null;const kf=PACK_KEY[id],c=packCounts(id);let done=0,mast=0;bank.forEach(q=>{const cc=Math.min(c[kf(q)]||0,SEUIL_MAITRISE);done+=cc;if(cc>=SEUIL_MAITRISE)mast++;});return {done,total:bank.length*SEUIL_MAITRISE,mast,nb:bank.length,fini:mast>=bank.length,niv:packNiv(id)};}
function choisirQ(id,bank){const kf=PACK_KEY[id],c=packCounts(id);const pond=[];bank.forEach(q=>{const cc=c[kf(q)]||0;if(cc>=SEUIL_MAITRISE)return;const w=SEUIL_MAITRISE-cc;for(let i=0;i<w;i++)pond.push(q);});return pond.length?pond[rnd(0,pond.length-1)]:null;}
function packTermine(z,meta){z.innerHTML='<div class="lecon"><div class="quiz-tete"><button class="qt-retour" onclick="retourPacks()">←</button><div class="qt-titre">'+(meta||'')+'</div><span class="qt-sp"></span></div><div class="lecon-corps"><div class="lecon-ico">🏆</div><div class="lecon-txt">Bravo ! Tu as maîtrisé toutes les questions de ce pack.</div></div><button class="lecon-btn" id="pt-rejouer">🔁 Réviser encore</button><button class="pin-annuler" onclick="retourPacks()">Retour aux défis</button></div>';const r=$('#pt-rejouer');if(r)r.onclick=function(){const pp=packProg0(packActif.id);pp.c={};sauver();packExo();};}
function maitriser(id,key){if(!PACK_NIVEAUX[id])return;const pp=packProg0(id),c=packCounts(id);c[key]=(c[key]||0)+1;const p=progPack(id);if(p&&p.fini&&!pp.done[p.niv]){pp.done[p.niv]=1;const dia=180+p.niv*30,ren=15+p.niv*5;etat.crins+=dia;etat.renommee=(etat.renommee||0)+ren;etat.renommeeTotale=(etat.renommeeTotale||0)+ren;majSolde(true);toast('🏆 Niveau '+p.niv+' maîtrisé ! +'+dia+' 💎 +'+ren+' ⭐');const banks=PACK_NIVEAUX[id]();if(p.niv<banks.length)pp.niv=p.niv+1;}sauver();}

function PMULT(){return packActif?packActif.mult:1;}
/* Multiplicateur de SÉRIE (chaîne de bonnes réponses) : la valeur vit dans la chaîne, pas dans la
   réponse isolée. Décourage le spam (une erreur casse tout) et récompense la concentration.
   Base à ×1 = identique à avant → pas de régression ni de découragement pour qui débute. */
function multSerie(){const s=serieCourante;return s>=10?5:s>=7?4:s>=5?3:s>=3?2:1;}
var _serieCasse=0,_bonusChaine=0;
/* Bonus de FIN de chaîne : encaissé quand une série de ≥3 bonnes réponses se casse. Récompense la
   longueur (impossible à spammer) et fait gagner la concentration au débit/minute. Facteur 0.35 +
   plafond (L-2 capé à 10) pour ne pas gonfler la distribution globale de diamants. */
function chaineBonus(L){return L>=3?Math.round(GAIN_BONNE*PMULT()*Math.min(L-2,10)*0.35):0;}
function gainRep(bon,base){base=base||GAIN_BONNE;if(bon){serieCourante++;_serieCasse=0;_bonusChaine=0;return Math.round(base*PMULT()*multSerie());}_serieCasse=serieCourante;_bonusChaine=chaineBonus(serieCourante);serieCourante=0;return _bonusChaine;}
function comboBadge(){const m=multSerie();return m>1?(' · <b class="qf-combo">🔥 Série ×'+m+'</b>'):'';}
/* Ligne de gain : bonne réponse = base + combo ; mauvaise = rien (0), sauf encaissement de série. */
function gainSlot(bon,g){if(bon)return '+'+g+' Diamants'+comboBadge();if(_bonusChaine>0)return '<b class="qf-combo">🔗 Série de '+_serieCasse+' encaissée : +'+g+' 💎</b>';return '';}
function nivDefi(){return (profilActif.niveau||5)+((packActif&&packActif.nivOffset)||0);}
function norm(s){return (s||'').trim().toLowerCase();}
/* melange: définition unique (version copie, plus haut) */
function lancerPack(p){packActif=p;jeuCompteur=0;$('#defi-menu').style.display='none';packExo();}
function retourPacks(){packActif=null;menuDefis();}

function graphHTML(g){
  const mx=Math.max.apply(null,g.valeurs)||1;let bars='';
  g.labels.forEach((lab,k)=>{const hp=Math.max(6,Math.round(g.valeurs[k]/mx*100));bars+='<div class="gr-col"><div class="gr-barwrap"><div class="gr-bar" style="height:'+hp+'%"><span class="gr-val">'+g.valeurs[k]+'</span></div></div><div class="gr-lab">'+lab+'</div></div>';});
  return (g.titre?'<div class="ae-graphtitre">'+g.titre+'</div>':'')+'<div class="ae-graph">'+bars+'</div>';
}
function visuelQ(q){return (q.graph?graphHTML(q.graph):'')+(q.schema?'<div class="pk-schema">'+q.schema+'</div>':'');}
function bankGen(bank){return ()=>{const q=bank[rnd(0,bank.length-1)];return {q:q.q,choix:melange([...q.choix]),r:q.r,exp:q.e||'',graph:q.graph,schema:q.schema};};}
(function enrichirGeneral(){
  const add=(mid,nom,bank)=>{const m=MATIERES.find(x=>x.id===mid);if(m)m.activites.push({nom,niv:[1,6],gen:bankGen(bank)});};
  add('francais','Vocabulaire & mots',BANK_FR);
  add('histoire','Le temps passé',BANK_HIST);
  add('sciences','Nature & animaux',BANK_SCI);
  add('geo','La Belgique & le monde',BANK_GEO);
  add('maths','Calcul rapide',BANK_MATHS);
})();
function exoBankQuiz(z,meta,mid,packId){
  const bank=packBank(packId)||[],q=choisirQ(packId,bank);if(!q)return packTermine(z,meta);const choix=melange([...q.choix]);
  z.innerHTML=`<div class="quiz-tete"><button class="qt-retour" onclick="retourPacks()">←</button><div class="qt-titre">${meta}${enteteFinDefi(packActif)}<div class="quiz-carte"><div class="quiz-question" id="q-question"></div><div class="quiz-reponses" id="q-reponses"></div></div><div class="quiz-feedback" id="q-feedback"></div>`;
  $('#q-question').textContent=q.q;if(q.graph||q.schema)$('#q-question').insertAdjacentHTML('beforebegin',visuelQ(q));
  const box=$('#q-reponses');let fini=false;
  choix.forEach(v=>{const b=document.createElement('button');b.textContent=v;b.onclick=()=>{
    if(fini)return;fini=true;const bon=v===q.r;if(bon&&packId)maitriser(packId,PACK_KEY[packId](q));
    box.querySelectorAll('button').forEach(x=>{x.disabled=true;if(x.textContent===q.r)x.classList.add('bon');});
    if(!bon)b.classList.add('faux');
    const s=statMatiere(mid);s.tot++;const sp=statPack(packId);sp.tot++;if(bon)sp.ok++;let g,msg;
    if(bon){s.ok++;etat.bonnes++;g=gainRep(true);msg=BRAVOS[rnd(0,BRAVOS.length-1)];}
    else{g=gainRep(false);msg=ENCOURAGE[rnd(0,ENCOURAGE.length-1)];}
    g=crediterDefi((ancreGain=b,g));etat.xp[mid]=(etat.xp[mid]||0)+(bon?XP_BONNE:XP_ESSAI);sauver();majSolde(true);
    feedbackDefi(bon,msg,`${q.e?`<div class="qf-astuce">💡 ${q.e}</div>`:''}`,gainSlot(bon,g),()=>packExo());
  };box.appendChild(b);});
}
/* Origines / Chevaux : n'accepter que les vraies origines géographiques et les catégories établies
   (vraies races, mythes/peuples documentés). Les mondes fictifs n'ont pas d'origine réelle. */
function royaumeReel(c){return !!(c.royaume&&ROYAUMES[c.royaume]&&!ROYAUMES_FICTIFS.has(c.royaume));}
function chevalEtabli(c){return BREEDS.includes(c.id)||!!MYTHES[c.id]||!!HISTO[c.id]||royaumeReel(c);}
function exoOrigines(z){
  const pool=CARTES.filter(c=>royaumeReel(c)&&(estRace(c)||estHistorique(c)||estLegende(c)));
  const cible=pool[rnd(0,pool.length-1)],bonR=cible.royaume;
  const autres=melange([...new Set(pool.map(c=>c.royaume))].filter(r=>r!==bonR)).slice(0,3);
  const choixR=melange([bonR,...autres]);const lab=r=>ROYAUMES[r].ico+' '+ROYAUMES[r].nom;
  z.innerHTML=`<div class="quiz-tete"><button class="qt-retour" onclick="retourPacks()">←</button><div class="qt-titre">🌍 Origines${enteteFinDefi(packActif)}<div class="races-art"><div class="races-photo">${artNu(cible)}</div></div><div class="races-q">D'où vient ce cheval&nbsp;?</div><div class="quiz-reponses" id="q-reponses"></div><div class="quiz-feedback" id="q-feedback"></div>`;
  const box=$('#q-reponses');let fini=false;
  choixR.forEach(r=>{const b=document.createElement('button');b.textContent=lab(r);b.onclick=()=>{
    if(fini)return;fini=true;const bon=r===bonR;
    box.querySelectorAll('button').forEach(x=>{x.disabled=true;if(x.textContent===lab(bonR))x.classList.add('bon');});
    if(!bon)b.classList.add('faux');
    const mid='geo';const s=statMatiere(mid);s.tot++;const sp=statPack('origines');sp.tot++;if(bon)sp.ok++;let g,msg;
    if(bon){s.ok++;etat.bonnes++;g=gainRep(true);msg=BRAVOS[rnd(0,BRAVOS.length-1)];}
    else{g=gainRep(false);msg=cible.nom+" vient de "+ROYAUMES[bonR].nom+".";}
    g=crediterDefi((ancreGain=b,g));etat.xp[mid]=(etat.xp[mid]||0)+(bon?XP_BONNE:XP_ESSAI);sauver();majSolde(true);
    feedbackDefi(bon,msg,`<div class="qf-astuce">💡 ${cible.desc||''}</div>`,gainSlot(bon,g),()=>packExo());
  };box.appendChild(b);});
}


function exoRaces(z){
  const races=CARTES.filter(c=>estRace(c));
  const perso=CARTES.filter(c=>(HISTORIQUES.has(c.id)||LEGENDES.has(c.id))&&MYTHES[c.id]&&MYTHES[c.id].perso);
  const legende=CARTES.filter(c=>LEGENDES.has(c.id));
  const histoRole=CARTES.filter(c=>HISTO[c.id]);
  const robeCards=CARTES.filter(c=>ROBES[c.id]&&(estRace(c)||estHistorique(c)||estLegende(c)));
  const r=Math.random();let cible,question,bonne,choix,theoWrong;
  if(r<0.24&&perso.length){
    cible=perso[rnd(0,perso.length-1)];const m=MYTHES[cible.id];
    question="À qui (ou à quel univers) ce cheval est-il lié ?";bonne=m.perso;
    choix=melange([m.perso,...melange([...new Set(perso.map(c=>MYTHES[c.id].perso))].filter(p=>p!==m.perso)).slice(0,3)]);
    theoWrong=cible.nom+" — "+m.fait;
  }else if(r<0.42&&legende.length>=4){
    cible=legende[rnd(0,legende.length-1)];const m=MYTHES[cible.id]||{};
    question="Quel cheval de légende est-ce ?";bonne=cible.nom;
    const a=melange(legende.filter(c=>c.id!==cible.id)).slice(0,3);choix=melange([cible.nom,a[0].nom,a[1].nom,a[2].nom]);
    theoWrong=cible.nom+(m.fait?" — "+m.fait:"");
  }else if(r<0.60&&histoRole.length){
    cible=histoRole[rnd(0,histoRole.length-1)];const m=HISTO[cible.id];
    question="À quel peuple ou métier appartient ce cheval ?";bonne=m.qui;
    choix=melange([m.qui,...melange([...new Set(histoRole.map(c=>HISTO[c.id].qui))].filter(p=>p!==m.qui)).slice(0,3)]);
    theoWrong=cible.nom+" — "+m.fait;
  }else if(r<0.78&&robeCards.length){
    cible=robeCards[rnd(0,robeCards.length-1)];const robe=ROBES[cible.id];
    question="Quelle est sa robe (sa couleur) ?";bonne=robe;choix=melange([robe,...melange(ROBES_TOUS.filter(x=>x!==robe)).slice(0,3)]);theoWrong=ROBES_DESC[robe]||'';
  }else{
    cible=races[rnd(0,races.length-1)];question="Quelle est la race de ce cheval ?";bonne=cible.nom;
    const a=melange(races.filter(c=>c.id!==cible.id)).slice(0,3);choix=melange([cible.nom,a[0].nom,a[1].nom,a[2].nom]);theoWrong=cible.desc||'';
  }
  z.innerHTML=`<div class="quiz-tete"><button class="qt-retour" onclick="retourPacks()">←</button><div class="qt-titre">🐴 Chevaux${enteteFinDefi(packActif)}<div class="races-art"><div class="races-photo">${artNu(cible)}</div></div><div class="races-q">${question}</div><div class="quiz-reponses" id="q-reponses"></div><div class="quiz-feedback" id="q-feedback"></div>`;
  const box=$('#q-reponses');let fini=false;
  choix.forEach(v=>{const b=document.createElement('button');b.textContent=v;b.onclick=()=>{
    if(fini)return;fini=true;const bon=v===bonne;
    box.querySelectorAll('button').forEach(x=>{x.disabled=true;if(x.textContent===bonne)x.classList.add('bon');});
    if(!bon)b.classList.add('faux');
    const mid='sciences';const s=statMatiere(mid);s.tot++;const sp=statPack('races');sp.tot++;if(bon)sp.ok++;let g,msg;
    if(bon){s.ok++;etat.bonnes++;g=gainRep(true);msg=BRAVOS[rnd(0,BRAVOS.length-1)];}
    else{g=gainRep(false);msg="C'était : <b>"+bonne+"</b>";}
    g=crediterDefi((ancreGain=b,g));etat.xp[mid]=(etat.xp[mid]||0)+(bon?XP_BONNE:XP_ESSAI);sauver();majSolde(true);
    feedbackDefi(bon,msg,`${theoWrong?`<div class="qf-astuce">💡 ${theoWrong}</div>`:''}${aFiche(cible.id)?'<button class="fiche-lien" onclick="ouvrirFiche(\''+cible.id+'\')">📖 Découvrir son histoire</button>':''}`,gainSlot(bon,g),()=>packExo());
  };box.appendChild(b);});
}
function exoOrtho(z){
  const bank=packBank('ortho'),it=choisirQ('ortho',bank);if(!it)return packTermine(z,'✍️ Orthographe');const T=ORTHO_T[it.t]||{i:'✏️',n:'Écris'};
  z.innerHTML=`<div class="quiz-tete"><button class="qt-retour" onclick="retourPacks()">←</button><div class="qt-titre">✍️ Orthographe · ${packActif.niv}${enteteFinDefi(packActif)}<div class="ortho-type">${T.i} ${T.n}</div><div class="ortho-indice">${it.q}</div><input class="ortho-input" id="ortho-in" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="tape ici…"><button class="ae-btn" id="ortho-ok" style="display:block;width:100%">Valider</button><div class="quiz-feedback" id="q-feedback"></div>`;
  const inp=$('#ortho-in');setTimeout(()=>{try{inp.focus();}catch(e){}},120);let fini=false;
  const valider=()=>{
    if(fini)return;const rep=(inp.value||'').trim();if(!rep)return;fini=true;inp.disabled=true;
    const bon=norm(rep)===norm(it.r);if(bon)maitriser('ortho',it.r);const mid='francais';const s=statMatiere(mid);s.tot++;const sp=statPack('ortho');sp.tot++;if(bon)sp.ok++;let g,msg;
    if(bon){s.ok++;etat.bonnes++;g=gainRep(true);msg="Parfait, sans faute ! ✍️";}
    else{g=gainRep(false);msg="On écrit : <b>"+it.r+"</b>";}
    g=crediterDefi((ancreGain=$('#ortho-ok'),g));etat.xp[mid]=(etat.xp[mid]||0)+(bon?XP_BONNE:XP_ESSAI);sauver();majSolde(true);
    feedbackDefi(bon,msg,`${!bon?`<div class="qf-astuce">💡 ${theorieCour}</div>`:''}`,gainSlot(bon,g),()=>packExo());
  };
  $('#ortho-ok').onclick=valider;inp.addEventListener('keydown',e=>{if(e.key==='Enter')valider();});
}

function lancerJeuDefi(z){z.innerHTML='';JEUX[rnd(0,JEUX.length-1)].lancer(z,packExo);const r=document.createElement('button');r.className='defi-retour';r.textContent='← Packs';r.onclick=retourPacks;z.insertBefore(r,z.firstChild);}
function nivCourt(p){const n=(p&&PACK_NIVEAUX[p.id])?packNiv(p.id):null;return n?('nv. '+n):'';}
function enteteFinDefi(p){const nv=nivCourt(p);const theo=theoriePack(p);theorieCour=theo||'';const nvH=nv?`<span class="qt-niv">${nv}</span>`:'';const aLecon=!!leconPour(p.id,packNiv(p.id));const thH=(aLecon||theo)?`<button class="qt-theo" id="pack-theo-btn" onclick="${aLecon?'revoirLecon()':'afficherTheorie()'}">?</button>${theo?'<div class="pack-theo-panel" id="pack-theo-panel" style="display:none"></div>':''}`:'<span class="qt-sp"></span>';return `${nvH}</div>${thH}</div>`;}
function feedbackDefi(bon,msg,astuce,gain,next){const fb=$('#q-feedback');fb.innerHTML=`<div class="qf-msg ${bon?'bon':'faux'}">${msg}</div>${bon?'':(astuce||'')}${gain?`<div class="qf-gain">${gain}</div>`:''}${bon?'':'<button class="defi-continuer">Suivant ›</button>'}`;fb.classList.add('show');if(bon){if(feedbackDefi._t)clearTimeout(feedbackDefi._t);feedbackDefi._t=setTimeout(function(){fb.classList.remove('show');next();},1000);}else{const b=fb.querySelector('.defi-continuer');if(b)b.onclick=function(){fb.classList.remove('show');next();};}}
let leconSlides=[],leconI=0,leconDone=null,leconTitre='';
function fusionLeconVue(a,b){const r={};for(const p of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){r[p]={};const na=(a||{})[p]||{},nb=(b||{})[p]||{};for(const n of new Set([...Object.keys(na),...Object.keys(nb)]))r[p][n]=na[n]||nb[n];}return r;}
function leconPour(id,niv){const L=(typeof LECONS!=='undefined')&&LECONS[id];if(!L)return null;return L[Math.min(niv,L.length)-1]||null;}
function montrerLecon(id,niv,done){const lec=leconPour(id,niv);if(!lec){if(done)done();return;}leconSlides=lec.slides;leconI=0;leconDone=done;leconTitre=lec.titre||'';afficheLecon();}
function afficheLecon(){const z=$('#defi-zone');const s=leconSlides[leconI];const dernier=leconI>=leconSlides.length-1;const intro=leconI===0?'<div class="lecon-intro">📖 Petite leçon — tu pourras la revoir avec le <b>?</b></div>':'';z.innerHTML='<div class="lecon"><div class="quiz-tete"><button class="qt-retour" onclick="retourPacks()">←</button><div class="qt-titre">'+leconTitre+'<span class="qt-niv">leçon</span></div><span class="qt-sp"></span></div>'+intro+'<div class="lecon-corps"><div class="lecon-ico">'+s.ico+'</div><div class="lecon-txt">'+s.t+'</div></div><div class="lecon-dots">'+leconSlides.map(function(_,i){return '<span class="'+(i===leconI?'on':'')+'"></span>';}).join('')+'</div><button class="lecon-btn" id="lecon-next">'+(dernier?"C'est parti ! ▶":'Suivant ›')+'</button></div>';$('#lecon-next').onclick=function(){if(dernier){const d=leconDone;leconDone=null;if(d)d();}else{leconI++;afficheLecon();}};}
function revoirLecon(){if(!packActif)return;montrerLecon(packActif.id,packNiv(packActif.id),function(){packExo();});}
function packExo(){
  const _niv=packNiv(packActif.id);
  if(leconPour(packActif.id,_niv)&&!((etat.leconVue[packActif.id]||{})[_niv])){etat.leconVue[packActif.id]=etat.leconVue[packActif.id]||{};etat.leconVue[packActif.id][_niv]=true;sauver();return montrerLecon(packActif.id,_niv,function(){packExo();});}
  const z=$('#defi-zone');z.innerHTML='';
  if(packActif.id==='general'||packActif.id==='general1'){
    if(jeuCompteur>=JEU_TOUS_LES){jeuCompteur=0;return lancerJeuDefi(z);}
    jeuCompteur++;return defiExercice(z);
  }
  if(packActif.id==='races')return exoRaces(z);
  if(packActif.id==='origines')return exoOrigines(z);
  if(packActif.id==='geek')return exoBankQuiz(z,'🤖 Geek','sciences','geek');
  if(packActif.id==='anglais')return exoBankQuiz(z,'🇬🇧 Anglais · débutant','francais','anglais');
  if(packActif.id==='neerlandais')return exoBankQuiz(z,'🇳🇱 Néerlandais · débutant','francais','neerlandais');
  if(packActif.id==='trivia')return exoBankQuiz(z,'🧠 Trivial','histoire','trivia');
  if(packActif.id==='art')return exoBankQuiz(z,"🎨 Histoire de l'art",'histoire','art');
  if(packActif.id==='ortho')return exoOrtho(z);
  defiExercice(z);
}
function menuDefis(){
  packActif=null;
  $('#defi-zone').innerHTML='';$('#defi-menu').style.display='block';
  const box=$('#defi-cartes');box.innerHTML='';box.classList.add('packs-grille');
  PACKS.forEach(p=>{const cat=p.id==='general'?'principal':p.id==='general1'?'difficile':(PACK_NIVEAUX[p.id]?'maitrise':'infini');const TAG={principal:'⭐ Principal',difficile:'🔥 Difficile',maitrise:'🎯 À maîtriser',infini:'♾️ Infini'}[cat];const b=document.createElement('button');b.className='defi-carte pack-carte pk-cat-'+cat;const pr=progPack(p.id);let prog='';if(pr){const nbNiv=(PACK_NIVEAUX[p.id]?PACK_NIVEAUX[p.id]().length:1);const nivTxt=nbNiv>1?'<span class="pk-niv">Niveau '+pr.niv+' / '+nbNiv+'</span>':'';const fini=pr.fini&&pr.niv>=nbNiv;prog=nivTxt+(fini?'<span class="pk-fini">🏆 Tout maîtrisé</span>':'<div class="pk-bar"><i style="width:'+Math.round(pr.done/pr.total*100)+'%"></i></div>');}b.innerHTML='<span class="pk-tag">'+TAG+'</span><span class="dc-ico">'+p.ico+'</span><span class="dc-nom">'+p.nom+'</span><span class="dc-sous">'+p.sous+'</span>'+prog;b.onclick=()=>lancerPack(p);box.appendChild(b);});
  $('#defi-sous').textContent=`🔥 Jour ${etat.serieJours||0} · série de ${serieCourante}`;
}
function lancerDefiChoix(ch){
  $('#defi-menu').style.display='none';
  const z=$('#defi-zone');z.innerHTML='';
  if(ch.type==='jeu')ch.jeu.lancer(z,finDefi);
  else defiExercice(z,ch.m.id);
}
function finDefi(){menuDefis();}

function dansNiveau(a){const [mn,mx]=a.niv||[1,6];const n=nivDefi();return n>=mn&&n<=mx;}
function activitesDispo(){
  const l=[];for(const m of MATIERES)for(const a of m.activites)if(dansNiveau(a))l.push({m,a});
  if(l.length)return l;
  const n=profilActif.niveau||5;let best=Infinity;const all=[];
  for(const m of MATIERES)for(const a of m.activites){const[mn,mx]=a.niv||[1,6];const d=n<mn?mn-n:(n>mx?n-mx:0);all.push({m,a,d});if(d<best)best=d;}
  return all.filter(x=>x.d===best).map(({m,a})=>({m,a}));
}
function matieresDispo(){const s=new Set(activitesDispo().map(x=>x.m.id));return MATIERES.filter(m=>s.has(m.id));}
function defiExercice(z){
  const mats=matieresDispo();const pond=[];mats.forEach(m=>{pond.push(m);if(m.id!=='maths')pond.push(m);});
  let m,act,tries=0;
  do{m=pond[rnd(0,pond.length-1)];const acts=m.activites.filter(dansNiveau);act=acts.length?acts[rnd(0,acts.length-1)]:m.activites[rnd(0,m.activites.length-1)];qCour=act.gen(m.id==='maths'?diffMaths():1);tries++;}while(recentQ.includes(qCour.q)&&tries<6);
  recentQ.push(qCour.q);if(recentQ.length>10)recentQ.shift();matSource=m;
  z.innerHTML=`<div class="quiz-tete"><button class="qt-retour" onclick="retourPacks()">←</button><div class="qt-titre">${m.ico} ${m.nom} · ${act.nom}${(packActif&&packActif.nivOffset)?' 🔥':''}${enteteFinDefi(packActif)}<div class="quiz-carte"><div class="quiz-question${qCour.q.length<=9?' court':''}" id="q-question"></div><div class="quiz-reponses" id="q-reponses"></div></div><div class="quiz-feedback" id="q-feedback"></div>`;
  $('#q-question').textContent=qCour.q;if(qCour.graph||qCour.schema)$('#q-question').insertAdjacentHTML('beforebegin',visuelQ(qCour));
  const box=$('#q-reponses');qCour.choix.forEach(v=>{const b=document.createElement('button');b.textContent=v;b.onclick=()=>repondre(b,v);box.appendChild(b);});
  quizVerrou=false;
}
function repondre(btn,val){
  if(quizVerrou)return;quizVerrou=true;
  const bon=val===qCour.r,mid=matSource.id,s=statMatiere(mid);s.tot++;
  $$('#q-reponses button').forEach(b=>{b.disabled=true;if(b.textContent===qCour.r)b.classList.add('bon');});
  let crinsGain,xpGain,msg,cls;
  if(bon){s.ok++;etat.bonnes++;crinsGain=gainRep(true,GAIN_BONNE+Math.max(0,niveauDe(etat.xp[mid])-1)*2);xpGain=XP_BONNE+(mid==='maths'?(diffMaths()-1)*2:0);const _m=multSerie();msg=BRAVOS[rnd(0,BRAVOS.length-1)]+(_m>1?` 🔥 Série ×${_m} !`:'');cls='bon';}
  else{btn.classList.add('faux');crinsGain=gainRep(false);xpGain=XP_ESSAI;msg=ENCOURAGE[rnd(0,ENCOURAGE.length-1)];cls='faux';}
  crinsGain=crediterDefi((ancreGain=btn,crinsGain));etat.xp[mid]=(etat.xp[mid]||0)+xpGain;
  const _gs=gainSlot(cls==='bon',crinsGain);
  feedbackDefi(cls==='bon',msg,`${(qCour.exp||(cls==='faux'&&theorieCour))?`<div class="qf-astuce">💡 ${qCour.exp||theorieCour}</div>`:''}`,`${_gs}${_gs?' · ':''}+${xpGain} XP`,()=>packExo());
  sauver();majSolde(true);
}

/* ---- MINI-JEUX : un tour puis « Continuer ». Ajouter un jeu =
   une fonction lancer(zone, onDone) + une entrée dans JEUX. ---- */
function gainJeu(n){etat.crins+=n;sauver();majSolde(n>0);if(typeof montrerGainAnim==='function')montrerGainAnim(n);return n;}
function continuer(z,onDone){const c=document.createElement('button');c.className='defi-continuer';c.textContent='Continuer ›';c.onclick=onDone;z.appendChild(c);}
const PFC_EMO={pierre:'🪨',feuille:'📄',ciseaux:'✂️'},PFC_BAT={pierre:'ciseaux',feuille:'pierre',ciseaux:'feuille'},PFC_LISTE=['pierre','feuille','ciseaux'];
function jeuPFC(z,onDone){
  z.innerHTML=`<div class="jeu-titre">✊ Pierre – Feuille – Ciseaux</div><div class="jeu-res" id="pfc-res">Choisis ton coup !</div><div class="pfc-choix" id="pfc-choix"><button data-c="pierre">🪨</button><button data-c="feuille">📄</button><button data-c="ciseaux">✂️</button></div>`;
  z.querySelectorAll('#pfc-choix button').forEach(b=>b.onclick=()=>{
    const toi=b.dataset.c,ordi=PFC_LISTE[rnd(0,2)];let issue,gain,gagne=false;
    if(toi===ordi){issue='Égalité !';gain=2;}else if(PFC_BAT[toi]===ordi){issue='Gagné ! 🎉';gain=8;gagne=true;}else{issue='Perdu…';gain=0;}
    etat.jeux.joues++;if(gagne)etat.jeux.gagnes++;const g=gainJeu(gain);
    $('#pfc-res').innerHTML=`${PFC_EMO[toi]} vs ${PFC_EMO[ordi]} — <b>${issue}</b>${g?` +${g} Diamants`:''}`;
    $('#pfc-choix').remove();continuer(z,onDone);
  });
}
function jeuPrefere(z,onDone){
  let pool=CARTES.filter(c=>(etat.collection[c.id]||0)>0);if(pool.length<2)pool=CARTES;
  const a=pool[rnd(0,pool.length-1)];let b;do{b=pool[rnd(0,pool.length-1)];}while(b.id===a.id);
  const duo=[a,b];
  z.innerHTML=`<div class="jeu-titre">💖 Ton cheval préféré ?</div><div class="pref-duo">${duo.map((c,i)=>`<button class="pref-choix" data-i="${i}"><div class="tc-box ratio pref-vig">${carteHTML(c,etat.collection[c.id]||0)}</div><div class="pref-nom">${c.nom}</div></button>`).join('')}</div><div class="jeu-sous">Choisis celui que tu préfères !</div>`;
  z.querySelectorAll('.pref-choix').forEach(el=>el.onclick=()=>{
    const c=duo[+el.dataset.i];etat.chouchous[c.id]=(etat.chouchous[c.id]||0)+1;etat.jeux.joues++;etat.jeux.gagnes++;const g=gainJeu(6);
    z.innerHTML=`<div class="jeu-titre">💖 Joli choix !</div><div class="jeu-res">Tu préfères <b>${c.nom}</b> — excellent goût !${g?` +${g} Diamants`:''}</div>`;
    continuer(z,onDone);
  });
}
const JEUX=[{id:'pfc',lancer:jeuPFC},{id:'prefere',lancer:jeuPrefere}];

/* 11. SCORES */
function renderScores(){
  const box=$('#scores-matieres');box.innerHTML='<h3 class="scores-sous">Mes matières</h3>';
  matieresDispo().forEach(m=>{const xp=etat.xp[m.id]||0,s=statMatiere(m.id);const pct=s.tot?Math.round(s.ok/s.tot*100):0;const el=document.createElement('div');el.className='score-carte';el.innerHTML=`<div class="score-tete"><span class="si">${m.ico}</span><span class="sn">${m.nom}</span><span class="snv" style="color:${m.couleur}">Niveau ${niveauDe(xp)}</span></div><div class="score-bar"><div style="width:${(xp%PAS_XP)/PAS_XP*100}%;background:${m.couleur}"></div></div><div class="score-chiffres"><span>✅ ${s.ok}/${s.tot} réussis</span><span>${pct}%</span></div>`;box.appendChild(el);});
  const pbox=$('#scores-packs');if(pbox){pbox.innerHTML='';const supp=PACKS.filter(p=>p.id!=='general'&&p.id!=='general1');const rows=supp.map(p=>({p,s:statPack(p.id)})).filter(x=>x.s.tot>0);if(rows.length){pbox.innerHTML='<h3 class="scores-sous">Compétences spéciales</h3>';rows.forEach(({p,s})=>{const pct=Math.round(s.ok/s.tot*100);const el=document.createElement('div');el.className='score-pack';el.innerHTML=`<span class="sp-ico">${p.ico}</span><span class="sp-nom">${p.nom}</span><span class="sp-bar"><i style="width:${pct}%"></i></span><span class="sp-val">${s.ok}/${s.tot} · ${pct}%</span>`;pbox.appendChild(el);});}}
  const fav=Object.entries(etat.chouchous||{}).filter(([id,n])=>n>0&&CARTES.find(c=>c.id===id)).sort((a,b)=>b[1]-a[1])[0];const favC=fav?CARTES.find(c=>c.id===fav[0]):null;
  $('#scores-resume').innerHTML=`<div class="score-resume"><div class="score-case"><b>${etat.bonnes||0}</b><span>Bonnes réponses</span></div><div class="score-case"><b>${etat.serieJours||0}</b><span>🔥 Jours d'affilée</span></div><div class="score-case"><b>${etat.renommee||0}</b><span>⭐ Renommée</span></div><div class="score-case"><b>${totalEtoiles()}</b><span>⭐ Étoiles</span></div></div>`+(favC?`<div class="score-fav">💖 Cheval préféré : <b>${favC.nom}</b></div>`:'');
}

/* 12. BONUS QUOTIDIEN (habitude / longévité) */
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function bonusQuotidien(){const t=ymd(new Date());if(etat.dernierJour===t)return;const hier=ymd(new Date(Date.now()-864e5));etat.serieJours=(etat.dernierJour===hier)?(etat.serieJours||0)+1:1;etat.dernierJour=t;const b=Math.min(etat.serieJours*5,50);etat.crins+=b;sauver();majSolde(true);toast(`🔥 Jour ${etat.serieJours} · +${b} Diamants`);}

/* 13. NAVIGATION + ÉVÉNEMENTS */

let tutoStep=0,tutoPulled=false,tutoRevealQueue=[];
function lancerTuto(){tutoStep=0;tutoPulled=false;$('#tuto-cartes').innerHTML='';$('#tuto-btn').onclick=tutoSuivant;$('#tuto-skip').onclick=tutoFin;$('#tuto').style.display='flex';tutoAffiche();}
function tutoAffiche(){const e=TUTO_ETAPES[tutoStep];$('#tuto-txt').innerHTML=e.t;const done=(e.act==='cadeau'&&tutoPulled);$('#tuto-btn').textContent=done?'Continuer ›':e.b;$('#tuto-cartes').style.display=done?'flex':'none';}
function tutoCadeau(){
  tutoPulled=true;
  const recus=TUTO_CADEAU.map(id=>CARTES.find(c=>c.id===id)).filter(Boolean);
  recus.forEach(c=>ajouterExemplaire(c));
  sauver();rendreGrille();if(typeof majSolde==='function')majSolde();
  $('#tuto-cartes').innerHTML='';
  tutoRevealQueue=recus.slice();
  $('#tuto').style.display='none';        // la révélation plein écran prend le relais
  tutoRevealSuivant();
}
function tutoRevealSuivant(){
  if(!tutoRevealQueue||!tutoRevealQueue.length){const t=$('#tuto');if(t)t.style.display='flex';tutoAffiche();return;}
  const c=tutoRevealQueue.shift();
  revealApres=tutoRevealSuivant;          // à la fermeture (tap), on montre la suivante
  montrerReveal(c,etat.collection[c.id]||1,'🎁 Cadeau de bienvenue',c.nom+' rejoint ton écurie','neuf');
}
function tutoSuivant(){const e=TUTO_ETAPES[tutoStep];if(e.act==='cadeau'&&!tutoPulled){tutoCadeau();return;}if(e.act==='fin'){tutoFin();switchEcran('aventure');return;}tutoStep++;tutoAffiche();}
function tutoFin(){if(!tutoPulled){TUTO_CADEAU.forEach(id=>{const c=CARTES.find(x=>x.id===id);if(c)ajouterExemplaire(c);});tutoPulled=true;rendreGrille();}etat.tutoVu=true;sauver();$('#tuto').style.display='none';if(typeof majOnglets==='function')majOnglets();}
function debloqueConcours(){try{return (etat.tirages||0)>0||Object.values((etat.aventure&&etat.aventure.prov)||{}).some(p=>p&&p.fini);}catch(e){return true;}}
function majOnglets(){const b=document.querySelector('nav.tabs button[data-ecran="concours"]');if(b)b.style.display=debloqueConcours()?'':'none';}
(function(){function reflow(){const a=document.getElementById('app');if(!a)return;a.style.height='auto';void a.offsetHeight;a.style.height='';}window.addEventListener('resize',reflow);window.addEventListener('orientationchange',reflow);window.addEventListener('pageshow',reflow);document.addEventListener('visibilitychange',function(){if(!document.hidden)reflow();});})();
function setFondImg(el,url,grad){
  if(!el)return;
  el.classList.remove('img-spin');
  if(!url){el.style.backgroundImage='';return;}
  el.style.backgroundImage='';el.classList.add('img-spin');
  const im=new Image();
  const done=function(){el.style.backgroundImage=(grad?grad+', ':'')+'url('+url+')';el.classList.remove('img-spin');};
  im.onload=done;im.onerror=done;im.src=url;
}
function majFondEcran(nom){
  const el=document.getElementById('fond-ecran');if(!el)return;
  const IMG={ecurie:'cartes/belle_champs.jpg',tirage:'cartes/beasts_hypalectryon.jpg',revisions:'cartes/cheval_constellation.jpg',concours:'aventure/fond_newmarket.jpg',scores:'aventure/fond_edimbourg.jpg'};
  const img=IMG[nom];
  if(!img){el.style.backgroundImage='';return;}
  el.style.backgroundImage='linear-gradient(180deg,rgba(20,16,46,.72) 0%,rgba(20,16,46,.26) 17%,rgba(20,16,46,.30) 73%,rgba(20,16,46,.74) 100%),url('+img+')';
}
function switchEcran(nom){majFondEcran(nom);majOnglets();$$('.ecran').forEach(e=>e.classList.remove('actif'));$('#ecran-'+nom).classList.add('actif');const mn=document.querySelector('main');mn.classList.toggle('plein',nom==='aventure');mn.scrollTop=0;$$('nav.tabs button').forEach(b=>b.classList.toggle('actif',b.dataset.ecran===nom));majSolde();if(nom==='revisions'){bonusQuotidien();menuDefis();}if(nom==='scores')renderScores();if(nom==='concours')renderConcours();if(nom==='aventure')ouvrirAventure();}
$$('nav.tabs button').forEach(b=>b.onclick=()=>switchEcran(b.dataset.ecran));
$('#lien-revisions').onclick=()=>switchEcran('revisions');
$('#btn-tirer').onclick=doTirage;$('#btn-tirer10').onclick=doTirage10;$('#btn-tirer-super').onclick=doTirageSuper;$('#ae-quit').onclick=avFermerEtape;$('#cout-nb10').textContent=COUT_TIRAGE10;$('#t10-fermer').onclick=()=>$('#t10-fond').classList.remove('on');$('#btn-resultats').onclick=()=>switchEcran('scores');const _bh=$('#btn-hub');if(_bh)_bh.onclick=()=>switchEcran('scores');$('#btn-classement').onclick=ouvrirClassement;$('#btn-chouchous').onclick=ouvrirChouchous;$('#chouchous-fermer').onclick=()=>$('#chouchous-fond').classList.remove('on');$('#classement-fermer').onclick=()=>$('#classement-fond').classList.remove('on');
$('#filtre-possedes').onclick=()=>{filtrePossedes=!filtrePossedes;$('#filtre-possedes').classList.toggle('on',filtrePossedes);rendreGrille();};
$$('.eo-tri [data-champ]').forEach(b=>b.onclick=()=>{triChamp=b.dataset.champ;$$('.eo-tri [data-champ]').forEach(x=>x.classList.toggle('actif',x===b));rendreGrille();});
$('#tri-sens').onclick=()=>{triSens=-triSens;$('#tri-sens').textContent=triSens<0?'↓':'↑';rendreGrille();};
$('#img-max').onclick=()=>$('#img-max').classList.remove('on');
$('#btn-chances').onclick=()=>$('#aide-fond').classList.add('on');
$('#aide-fermer').onclick=()=>$('#aide-fond').classList.remove('on');
$('#aide-fond').onclick=e=>{if(e.target.id==='aide-fond')$('#aide-fond').classList.remove('on');};
$('#cs-fermer').onclick=()=>$('#concours-fond').classList.remove('on');
$('#concours-fond').onclick=e=>{if(e.target.id==='concours-fond')$('#concours-fond').classList.remove('on');};
$('#btn-marchand').onclick=()=>{renderMarchand();$('#marchand-fond').classList.add('on');};
$('#marchand-fermer').onclick=()=>$('#marchand-fond').classList.remove('on');
$('#marchand-fond').onclick=e=>{if(e.target.id==='marchand-fond')$('#marchand-fond').classList.remove('on');};
majCompteurReset();setInterval(majCompteurReset,30000);
$('#reveal').onclick=fermerReveal;
$('#d-fermer').onclick=()=>$('#feuille-fond').classList.remove('on');
$('#feuille-fond').onclick=e=>{if(e.target.id==='feuille-fond')$('#feuille-fond').classList.remove('on');};
function renderReglageNiveau(){const el=$('#reglage-niveau');el.innerHTML=`<div class="rg-niveau"><div class="rg-lbl">Niveau des exercices <span>· ${profilActif.nom}</span></div><div class="rg-step"><button data-d="-1">‹</button><b>P${profilActif.niveau}</b><button data-d="1">›</button></div></div>`;el.querySelectorAll('.rg-step button').forEach(b=>b.onclick=()=>{profilActif.niveau=Math.max(1,Math.min(6,profilActif.niveau+parseInt(b.dataset.d,10)));sauver();renderReglageNiveau();menuDefis();renderScores();});}
$('#btn-reglages').onclick=()=>{renderReglageNiveau();majReglageInfo();$('#reglages-fond').classList.add('on');};const _bp=$('#btn-partager');if(_bp)_bp.onclick=partagerProfil;$('#btn-cloud-test').onclick=testerCloud;$('#btn-forcemaj').onclick=()=>{if(confirm('Vider le cache et recharger la dernière version ?'))forcerMaj();};$('#sync-dot').onclick=()=>{if(profilActif&&profilActif.cloud&&profilActif.pin){majSync('sync');cloudPush();}else{$('#btn-reglages').click();}};
$('#admin-fermer').onclick=()=>{$('#admin-fond').classList.remove('on');const acc=$('#accueil');if(acc){acc.style.display='';acc.classList.remove('parti');}renderAccueil();};
$('#temps-ok').onclick=()=>{$('#temps-fond').classList.remove('on');retourLogin();};
$('#fiche-fermer').onclick=()=>$('#fiche-fond').classList.remove('on');
$('#reglages-fermer').onclick=()=>$('#reglages-fond').classList.remove('on');
$('#reglages-fond').onclick=e=>{if(e.target.id==='reglages-fond')$('#reglages-fond').classList.remove('on');};
$('#btn-reset').onclick=()=>{if(confirm(`Effacer la collection et les progrès de ${profilActif.nom} ? (les autres profils ne sont pas touchés)`)){profilActif.etat=etatVide();etat=profilActif.etat;serieCourante=0;sauver();rafraichirTout();$('#reglages-fond').classList.remove('on');toast('Profil réinitialisé !');}};

/* 14. PROFILS (multi-enfants, nombre extensible) */
function majAvatar(){$('#pf-ava').textContent=profilActif.emoji;$('#pf-nom').textContent=profilActif.nom;}
function rafraichirTout(){majAvatar();majSolde();majProgression();rendreGrille();menuDefis();renderScores();}
function fermerProfils(){$('#profils-fond').classList.remove('on');$('#profil-form').innerHTML='';}
function ouvrirProfils(){renderProfils();$('#profil-form').innerHTML='';$('#profils-fond').classList.add('on');}
function activerProfil(p){SAVE.actif=p.id;profilActif=p;etat=p.etat;normaliserEtat(etat);migrerTempsLegacy(p.id,etat);serieCourante=0;sauver();rafraichirTout();switchEcran('ecurie');fermerProfils();}
function renderProfils(){
  const box=$('#profils-liste');box.innerHTML='';
  SAVE.profils.forEach(p=>{
    const u=CARTES.reduce((s,c)=>s+(((p.etat.collection||{})[c.id]||0)>0?1:0),0);
    const c=document.createElement('div');c.className='profil-carte'+(p.id===profilActif.id?' actif':'');c.style.setProperty('--pc',p.couleur);
    c.innerHTML=`<div class="pc-ava">${p.emoji}</div><div class="pc-info"><div class="pc-nom">${p.nom}</div><div class="pc-sous">${p.age} ans · ${u} créature${u>1?'s':''}</div></div>${p.id===profilActif.id?'<div class="pc-badge">actif</div>':''}`;
    c.onclick=()=>activerProfil(p);
    box.appendChild(c);
  });
  const add=document.createElement('button');add.className='profil-ajout';add.innerHTML='<span style="font-size:20px">＋</span> Nouveau profil';add.onclick=formNouveauProfil;box.appendChild(add);
}
function formNouveauProfil(){
  let emo=EMOJIS_PROFIL[0];const f=$('#profil-form');
  f.innerHTML=`<div class="pform"><label>Prénom</label><input id="np-nom" maxlength="14" placeholder="Prénom"><label>Âge</label><input id="np-age" type="number" min="4" max="15" inputmode="numeric" placeholder="8"><div class="acc-niv" id="np-niv">Le niveau des exercices s'adapte à l'âge</div><label>Avatar</label><div class="emojis" id="np-emojis">${EMOJIS_PROFIL.map((e,i)=>`<button data-e="${e}" class="${i===0?'on':''}">${e}</button>`).join('')}</div><div class="pf-actions"><button class="pf-annuler" id="np-annuler">Annuler</button><button class="pf-creer" id="np-creer">Créer</button></div></div>`;
  $('#np-age').addEventListener('input',()=>{const age=parseInt($('#np-age').value,10);$('#np-niv').innerHTML=age?`Niveau adapté : <b>P${niveauScolaire(age)}</b> · modifiable dans les réglages`:"Le niveau des exercices s'adapte à l'âge";});
  f.querySelectorAll('#np-emojis button').forEach(b=>b.onclick=()=>{emo=b.dataset.e;f.querySelectorAll('#np-emojis button').forEach(x=>x.classList.toggle('on',x===b));});
  $('#np-annuler').onclick=()=>f.innerHTML='';
  $('#np-creer').onclick=()=>{const nom=($('#np-nom').value||'').trim();if(!nom){toast('Choisis un prénom');return;}const age=parseInt($('#np-age').value,10)||8;const id='p'+Date.now().toString(36);const coul=COULEURS_PROFIL[SAVE.profils.length%COULEURS_PROFIL.length];const p=profilVide(id,nom,age,emo,coul);SAVE.profils.push(p);sauver();activerProfil(p);};
}
function cartesProfil(p){return CARTES.reduce((s,c)=>s+(((p.etat.collection||{})[c.id]||0)>0?1:0),0);}
function fondAccueil(){const el=document.getElementById('accueil');if(!el||!CARTES.length)return;const c=CARTES[rnd(0,CARTES.length-1)];el.style.backgroundImage="radial-gradient(1100px 560px at 50% -8%,#3a2f6699,transparent 55%),linear-gradient(180deg,#1a163699,#120f24dd),url(cartes/"+c.id+".jpg)";el.style.backgroundSize="cover";el.style.backgroundPosition="center";}
function renderAccueil(){
  fondAccueil();
  if(CLOUD.actif()){renderAccueilCloud();return;}
  const box=$('#acc-liste');box.innerHTML='';$('#acc-form').innerHTML='';
  SAVE.profils.forEach(p=>{
    const u=cartesProfil(p);
    const c=document.createElement('div');c.className='profil-carte';c.style.setProperty('--pc',p.couleur);
    c.innerHTML=`<div class="pc-ava">${p.emoji}</div><div class="pc-info"><div class="pc-nom">${p.nom}</div><div class="pc-sous">${p.age} ans · P${p.niveau} · ${u} créature${u>1?'s':''}</div></div><div class="pc-go">Jouer ›</div>`;
    c.onclick=()=>entrerJeu(p);box.appendChild(c);
  });
  const add=document.createElement('button');add.className='profil-ajout';add.innerHTML='<span style="font-size:20px">＋</span> Nouveau joueur';add.onclick=formAccueilCreate;box.appendChild(add);
}
function formAccueilCreate(){
  let emo=EMOJIS_PROFIL[0];const f=$('#acc-form');
  f.innerHTML=`<div class="pform"><label>Prénom</label><input id="ac-nom" maxlength="14" placeholder="Prénom"><label>Âge</label><input id="ac-age" type="number" min="4" max="15" inputmode="numeric" placeholder="8"><div class="acc-niv" id="ac-niv">Le niveau des exercices s'adapte à l'âge</div><label>Avatar</label><div class="emojis" id="ac-emojis">${EMOJIS_PROFIL.map((e,i)=>`<button data-e="${e}" class="${i===0?'on':''}">${e}</button>`).join('')}</div><div class="pf-actions"><button class="pf-annuler" id="ac-annuler">Annuler</button><button class="pf-creer" id="ac-creer">Créer &amp; jouer</button></div></div>`;
  const majNiv=()=>{const age=parseInt($('#ac-age').value,10);$('#ac-niv').innerHTML=age?`Niveau adapté : <b>P${niveauScolaire(age)}</b> · modifiable dans les réglages`:"Le niveau des exercices s'adapte à l'âge";};
  $('#ac-age').addEventListener('input',majNiv);
  f.querySelectorAll('#ac-emojis button').forEach(b=>b.onclick=()=>{emo=b.dataset.e;f.querySelectorAll('#ac-emojis button').forEach(x=>x.classList.toggle('on',x===b));});
  $('#ac-annuler').onclick=()=>{f.innerHTML='';};
  $('#ac-creer').onclick=()=>{const nom=($('#ac-nom').value||'').trim();if(!nom){toast('Choisis un prénom');return;}const age=parseInt($('#ac-age').value,10)||8;const id='p'+Date.now().toString(36);const coul=COULEURS_PROFIL[SAVE.profils.length%COULEURS_PROFIL.length];const p=profilVide(id,nom,age,emo,coul);SAVE.profils.push(p);sauver();entrerJeu(p);};
}
async function demanderCodeFamille(){
  const box=$('#acc-liste');$('#acc-form').innerHTML='';
  box.innerHTML='<div class="pform"><label>Code famille</label><div class="acc-niv" style="margin:2px 0 8px">Un mot partagé par ta famille — vous ne verrez que vos écuries.</div><input id="fam-code" maxlength="16" placeholder="ex. gauder" autocapitalize="none" autocomplete="off"><div class="pf-actions"><button class="pf-creer" id="fam-ok">Continuer ›</button></div></div>';
  const go=()=>{const v=($('#fam-code').value||'').trim().toLowerCase();if(v.length<2)return toast('Choisis un code (2 caractères min)');try{localStorage.setItem('ecurie_fam',v);}catch(e){}renderAccueilCloud();};
  $('#fam-ok').onclick=go;$('#fam-code').addEventListener('keydown',e=>{if(e.key==='Enter')go();});
}
function retirerJoueurAppareil(id,nom,apres){
  if(!id)return;
  if(!confirm('Retirer '+(nom||'ce joueur')+' de CET appareil ?\n\nSes données restent dans le cloud (rien n\'est supprimé côté serveur) — le raccourci et le cache local sont simplement effacés de cet appareil.'))return;
  locauxDel(id);
  try{localStorage.removeItem('ecurie_prof_'+id);localStorage.removeItem('ecurie_bk_'+id);}catch(e){}
  toast('Retiré de cet appareil');
  if(typeof apres==='function')apres();
}
function rendreListeCloud(liste,horsLigne){
  const box=$('#acc-liste');
  box.innerHTML=(horsLigne?'<div class="acc-niv" style="color:#ffb14e">📴 Hors ligne — joueurs en mémoire</div>':'');
  if(!liste||!liste.length)box.insertAdjacentHTML('beforeend','<div class="acc-niv">Aucun joueur ici. Crée le premier ! 🐴</div>');
  (liste||[]).forEach(a=>{
    const c=document.createElement('div');c.className='profil-carte';c.style.setProperty('--pc',a.couleur||'#7ec2ff');
    c.innerHTML='<div class="pc-ava">'+(a.avatar||'🦄')+'</div><div class="pc-info"><div class="pc-nom">'+a.prenom+'</div><div class="pc-sous">'+(a.age||'?')+' ans · P'+(a.niveau||3)+'</div></div><div class="pc-go">▶</div>';
    c.onclick=()=>autoLogin(a);box.appendChild(c);
  });
  const add=document.createElement('button');add.className='profil-ajout';add.innerHTML='<span style="font-size:20px">＋</span> Nouveau joueur';add.onclick=formNouveauJoueur;box.appendChild(add);
  const par=document.createElement('button');par.className='acc-parent';par.textContent='👨‍👩‍👧 Espace parent';par.onclick=ouvrirEspaceParent;box.appendChild(par);
}
function formNouveauJoueur(){
  let emo=EMOJIS_PROFIL[0];const f=$('#acc-form');
  f.innerHTML='<div class="pform"><label>Prénom du joueur</label><input id="nj-nom" maxlength="14" placeholder="Prénom"><label>Âge</label><input id="nj-age" type="number" min="3" max="15" placeholder="âge"><div class="acc-niv" id="nj-niv" style="margin:6px 0"></div><label>Avatar</label><div class="emojis" id="nj-emojis">'+EMOJIS_PROFIL.map(e=>'<button data-e="'+e+'"'+(e===emo?' class="on"':'')+'>'+e+'</button>').join('')+'</div><div class="pf-actions"><button class="pf-creer" id="nj-creer">C\'est parti ! 🐴</button></div><button class="pin-annuler" id="nj-annuler">Annuler</button></div>';
  $('#nj-age').addEventListener('input',()=>{const age=parseInt($('#nj-age').value,10);$('#nj-niv').textContent=age?('Niveau adapté : P'+niveauScolaire(age)):'';});
  f.querySelectorAll('#nj-emojis button').forEach(b=>b.onclick=()=>{emo=b.dataset.e;f.querySelectorAll('#nj-emojis button').forEach(x=>x.classList.remove('on'));b.classList.add('on');});
  $('#nj-annuler').onclick=()=>{f.innerHTML='';};
  $('#nj-creer').onclick=async()=>{
    const nom=($('#nj-nom').value||'').trim();if(!nom)return toast('Choisis un prénom');
    const age=parseInt($('#nj-age').value,10)||8,coul=COULEURS_PROFIL[Math.floor(Math.random()*COULEURS_PROFIL.length)],niv=niveauScolaire(age);
    if(!(CLOUD.actif()&&navigator.onLine))return toast('Connexion requise pour créer un joueur');
    const code=genCode(),pin=genPin();
    try{
      const {id,_pin}=await cloudCreer(nom,pin,emo,coul,age,niv,code);
      const stub={id,prenom:nom,avatar:emo,couleur:coul,age,niveau:niv,code,pin:_pin};
      cacheProfil(stub);locauxAdd(stub);ecrireCache('ecurie_bk_'+id,etatVide());
      entrerJeu({id,nom,age,emoji:emo,couleur:coul,niveau:niv,etat:etatVide(),cloud:true,pin:_pin,code});
    }catch(e){toast('Création impossible (connexion ?)');}
  };
}
async function partagerProfil(){
  if(!profilActif)return;
  const s={i:profilActif.id,n:profilActif.nom,a:profilActif.emoji,c:profilActif.couleur,g:profilActif.age,v:profilActif.niveau,k:profCode(profilActif),p:profilActif.pin};
  const enc=btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const lien=location.origin+location.pathname+'?ajouter='+enc;
  try{if(navigator.share){await navigator.share({title:'Écurie de Légendes',text:'Ajoute '+profilActif.nom+' sur ton appareil :',url:lien});return;}}catch(e){}
  try{await navigator.clipboard.writeText(lien);toast('Lien copié 🔗 — envoie-le sur l\'autre appareil');return;}catch(e){}
  try{prompt('Copie ce lien et envoie-le :',lien);}catch(e){}
}
function ajouterDepuisLien(){
  try{
    const u=new URL(location.href);const enc=u.searchParams.get('ajouter');if(!enc)return;
    const j=JSON.parse(decodeURIComponent(escape(atob(enc.replace(/-/g,'+').replace(/_/g,'/')))));
    if(j&&j.i){const stub={id:j.i,prenom:j.n,avatar:j.a,couleur:j.c,age:j.g,niveau:j.v,code:j.k,pin:j.p};migrerLocaux();cacheProfil(stub);locauxAdd(stub);setTimeout(()=>toast('👋 '+j.n+' a été ajouté(e) !'),500);}
    u.searchParams.delete('ajouter');history.replaceState(null,'',u.pathname+(u.search||'')+u.hash);
  }catch(e){}
}
async function renderAccueilCloud(){
  migrerLocaux();
  $('#acc-form').innerHTML='';
  rendreListeCloud(locauxGet(), !navigator.onLine);
}
function pavePin(cible,onFini){
  let pin='';const ov=$('#pin-fond');
  ov.innerHTML=`<div class="pinpad"><div class="pin-titre">${cible}</div><div class="pin-dots" id="pin-dots">○○○○</div><div class="pin-grid">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-n="${n}">${n}</button>`).join('')}<button class="pin-x" data-x="1">⌫</button><button data-n="0">0</button><button class="pin-ok" data-x="2">↩</button></div><button class="pin-annuler" data-x="3">Annuler</button></div>`;
  ov.classList.add('on');
  const maj=()=>$('#pin-dots').textContent='●'.repeat(pin.length)+'○'.repeat(4-pin.length);
  const fermer=()=>{ov.classList.remove('on');ov.innerHTML='';};
  ov.querySelectorAll('.pinpad button').forEach(b=>b.onclick=()=>{
    if(b.dataset.x==='1'){pin=pin.slice(0,-1);maj();return;}
    if(b.dataset.x==='2'||b.dataset.x==='3'){fermer();return;}
    if(pin.length<4){pin+=b.dataset.n;maj();if(pin.length===4)setTimeout(()=>{fermer();onFini(pin);},140);}
  });
}
async function autoLogin(a){
  const pc=lireCache('ecurie_prof_'+a.id);
  if(!pc||!pc.pin)return demanderPin(a);
  if(CLOUD.actif()&&navigator.onLine){
    try{const r=await CLOUD.rpc('connexion',{p_prenom:a.prenom,p_pin:pc.pin,p_code:(pc.code||codeFamille())});const row=Array.isArray(r)?r[0]:r;
      if(row){cacheProfil({id:row.id,prenom:row.prenom,avatar:row.avatar,couleur:row.couleur,age:row.age,niveau:row.niveau,pin:pc.pin});return entrerJeu(compteVersProfil(Object.assign(row,{_pin:pc.pin})));}}catch(e){}
  }
  const bk=lireCache('ecurie_bk_'+a.id);
  entrerJeu({id:a.id,nom:a.prenom||pc.prenom,age:a.age||pc.age,emoji:a.avatar||pc.avatar,couleur:a.couleur||pc.couleur,niveau:a.niveau||pc.niveau,etat:normaliserEtat(bk||etatVide()),cloud:true,pin:pc.pin,code:(a.code||pc.code||codeFamille()),_offline:true});
}
function demanderPin(a){
  pavePin(`${a.avatar||'🦄'} ${a.prenom} · code secret`,async(pin)=>{
    try{const row=await cloudConnexion(a.prenom,pin);if(!row){toast('Code incorrect');return demanderPin(a);}cacheProfil({id:row.id,prenom:row.prenom,avatar:row.avatar,couleur:row.couleur,age:row.age,niveau:row.niveau,pin:row._pin});entrerJeu(compteVersProfil(row));}
    catch(e){
      const off=await connexionOffline(a,pin);
      if(off){toast('📴 Hors ligne — sauvegarde locale');entrerJeu(off);}
      else{toast('Pas de connexion (code jamais utilisé sur cet appareil ?)');demanderPin(a);}
    }
  });
}
function formCloudCreate(){
  let emo=EMOJIS_PROFIL[0];const f=$('#acc-form');
  f.innerHTML=`<div class="pform"><label>Prénom d'écurie</label><input id="cc-nom" maxlength="14" placeholder="Prénom"><label>Âge</label><input id="cc-age" type="number" min="4" max="15" inputmode="numeric" placeholder="8"><div class="acc-niv" id="cc-niv">Le niveau s'adapte à l'âge</div><label>Avatar</label><div class="emojis" id="cc-emojis">${EMOJIS_PROFIL.map((e,i)=>`<button data-e="${e}" class="${i===0?'on':''}">${e}</button>`).join('')}</div><label>Code secret (4 chiffres)</label><input id="cc-pin" type="tel" maxlength="4" inputmode="numeric" placeholder="••••" style="letter-spacing:6px;text-align:center"><div class="pf-actions"><button class="pf-annuler" id="cc-annuler">Annuler</button><button class="pf-creer" id="cc-creer">Créer &amp; jouer</button></div></div>`;
  $('#cc-age').addEventListener('input',()=>{const age=parseInt($('#cc-age').value,10);$('#cc-niv').innerHTML=age?`Niveau adapté : <b>P${niveauScolaire(age)}</b>`:"Le niveau s'adapte à l'âge";});
  f.querySelectorAll('#cc-emojis button').forEach(b=>b.onclick=()=>{emo=b.dataset.e;f.querySelectorAll('#cc-emojis button').forEach(x=>x.classList.toggle('on',x===b));});
  $('#cc-annuler').onclick=()=>{f.innerHTML='';};
  $('#cc-creer').onclick=async()=>{
    const nom=($('#cc-nom').value||'').trim(),pin=($('#cc-pin').value||'').trim();
    if(!nom)return toast('Choisis un prénom');
    if(!/^\d{4}$/.test(pin))return toast('Code à 4 chiffres');
    const age=parseInt($('#cc-age').value,10)||8,coul=COULEURS_PROFIL[Math.floor(Math.random()*COULEURS_PROFIL.length)];
    try{const {id,_pin}=await cloudCreer(nom,pin,emo,coul,age,niveauScolaire(age));cacheProfil({id,prenom:nom,avatar:emo,couleur:coul,age,niveau:niveauScolaire(age),pin:_pin});entrerJeu({id,nom,age,emoji:emo,couleur:coul,niveau:niveauScolaire(age),etat:etatVide(),cloud:true,pin:_pin});}
    catch(e){toast(String(e).includes('PRENOM_PRIS')?'Ce prénom existe déjà':'Création impossible (connexion ?)');}
  };
}
function entrerJeu(p){
  SAVE.actif=p.id;profilActif=p;let e=normaliserEtat(p.etat);
  try{const bk=localStorage.getItem('ecurie_bk_'+p.id);if(bk){e=normaliserEtat(fusionEtat(e,normaliserEtat(JSON.parse(bk))));}}catch(err){}
  etat=e;p.etat=e;migrerTempsLegacy(p.id,etat);serieCourante=0;sauver();
  majAvatar();majSolde();majProgression();rendreGrille();rendreChances();menuDefis();renderScores();verifierJalons(true);majSync(navigator.onLine?'ok':'off');
  switchEcran('ecurie');
  const a=$('#accueil');a.classList.add('parti');setTimeout(()=>{a.style.display='none';},400);
  const lim=limiteMinutes(p.id);
  if(lim>0&&tempsAujourdhui(p.id)>=lim*60){setTimeout(ecranTempsEcoule,450);return;}
  demarrerChrono();
  if(!etat.tutoVu)setTimeout(lancerTuto,650);
}
$('#btn-profil').onclick=()=>{if(CLOUD.actif()){if(enJeu)chronoFlush();arreterChrono();const a=$('#accueil');a.style.display='';a.classList.remove('parti');renderAccueil();}else ouvrirProfils();};
$('#profils-fermer').onclick=fermerProfils;
$('#profils-fond').onclick=e=>{if(e.target.id==='profils-fond')fermerProfils();};

/* 15. DÉMARRAGE */
$('#cout-nb').textContent=COUT_TIRAGE;$('#cout-super').textContent=COUT_SUPER_RENOM;
$('#btn-atelier').onclick=ouvrirAtelier;$('#atelier-fermer').onclick=()=>$('#atelier-fond').classList.remove('on');
requestAnimationFrame(()=>requestAnimationFrame(()=>{
  ajouterDepuisLien();
  renderAccueil();
  const ch=document.getElementById('chargement');if(ch){ch.classList.add('parti');setTimeout(()=>ch.remove(),500);}
}));

/* PWA : enregistrement du service worker */
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});}
window.addEventListener('online',()=>{if(profilActif&&profilActif.cloud&&profilActif.pin){majSync('sync');cloudPush();}});
window.addEventListener('offline',()=>{if(profilActif&&profilActif.cloud)majSync('off');});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){if(enJeu)chronoFlush();if(profilActif&&profilActif.cloud&&profilActif.pin&&navigator.onLine)cloudPush();}
  else if(enJeu){chronoDernier=Date.now();verifierLimiteTemps();}
});
window.addEventListener('pagehide',()=>{if(enJeu)chronoFlush();});
document.addEventListener('freeze',()=>{if(enJeu)chronoFlush();});

/* ===== AVENTURE : cartes pan/zoom + intro ===== */
let avIntroI=0,avPZM=null,avPZB=null,avPZF=null,avPZI=null,avPZR=null,avPZE=null,avInit=false,mascPays=null,mascI=0;
function avZsc(svg){
  const vb=svg.viewBox.baseVal;const k=svg.clientWidth>0?vb.width/svg.clientWidth:vb.width/400;
  svg.querySelectorAll('.zsc').forEach(g=>g.setAttribute('transform','translate('+g.dataset.x+','+g.dataset.y+') scale('+k+')'));
  const T=88*k,shown=[];
  svg.querySelectorAll('.zsc.lbl').forEach(l=>{const x=+l.dataset.x,y=+l.dataset.y;const clash=shown.some(s=>Math.abs(x-s.x)<T&&Math.abs(y-s.y)<T*0.5);l.style.display=clash?'none':'';if(!clash)shown.push({x,y});});
}
function avPanzoom(svg,opt){
  const vb=svg.viewBox.baseVal;
  function aspect(){let a=svg.clientWidth>0?svg.clientHeight/svg.clientWidth:window.innerHeight/window.innerWidth;return(isFinite(a)&&a>0)?a:1.7;}
  function fitH(){vb.height=vb.width*aspect();}
  const clampW=w=>Math.min(opt.maxW,Math.max(opt.minW,w));
  function clampPan(){const b=opt.bounds;vb.x=vb.width>=b.w?b.x+(b.w-vb.width)/2:Math.min(b.x+b.w-vb.width,Math.max(b.x,vb.x));vb.y=vb.height>=b.h?b.y+(b.h-vb.height)/2:Math.min(b.y+b.h-vb.height,Math.max(b.y,vb.y));}
  const toVB=(cx,cy)=>{const r=svg.getBoundingClientRect();return{x:vb.x+(cx-r.left)/r.width*vb.width,y:vb.y+(cy-r.top)/r.height*vb.height};};
  function upd(){clampPan();avZsc(svg);}
  function zoomAt(f,cx,cy){const p=toVB(cx,cy);const nw=clampW(vb.width*f);const gg=nw/vb.width;vb.x=p.x-(p.x-vb.x)*gg;vb.y=p.y-(p.y-vb.y)*gg;vb.width=nw;fitH();upd();}
  function refit(){fitH();upd();}refit();
  svg.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY>0?1.12:.89,e.clientX,e.clientY);},{passive:false});
  const pts=new Map();let last=null,pinch=0;
  svg.addEventListener('pointerdown',e=>{svg.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});last={x:e.clientX,y:e.clientY};});
  svg.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});const a=[...pts.values()];
    if(a.length>=2){const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);const mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;if(pinch)zoomAt(pinch/d,mx,my);pinch=d;last=null;return;}
    if(last){const r=svg.getBoundingClientRect();vb.x-=(e.clientX-last.x)/r.width*vb.width;vb.y-=(e.clientY-last.y)/r.height*vb.height;last={x:e.clientX,y:e.clientY};upd();}});
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=0;last=pts.size===1?{x:[...pts.values()][0].x,y:[...pts.values()][0].y}:null;};
  svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
  return{refit};
}
function avInitCartes(){
  if(avInit)return;avInit=true;
  $('#av-intro').addEventListener('click',avIntroSuivant);   // toucher n'importe où sur l'image fait avancer (bien plus robuste qu'un bouton)
  try{
  avPZM=avPanzoom($('#svg-monde'),{minW:120,maxW:3600,bounds:{x:0,y:0,w:3600,h:1800}});
  avPZB=avPanzoom($('#svg-belgique'),{minW:250,maxW:1000,bounds:{x:0,y:0,w:1000,h:863}});
  avPZF=avPanzoom($('#svg-france'),{minW:250,maxW:1000,bounds:{x:0,y:0,w:1000,h:863}});
  avPZI=avPanzoom($('#svg-iles'),{minW:250,maxW:1000,bounds:{x:0,y:0,w:1000,h:863}});
  avPZR=avPanzoom($('#svg-rhin'),{minW:250,maxW:1000,bounds:{x:0,y:0,w:1000,h:863}});
  avPZE=avPanzoom($('#svg-iberie'),{minW:250,maxW:1000,bounds:{x:0,y:0,w:1000,h:863}});
  $('#mk-be').addEventListener('click',e=>{e.stopPropagation();avMontrer('belgique');});
  $('#av-retour').addEventListener('click',()=>avMontrer('monde'));
  $('#av-retour-fr').addEventListener('click',()=>avMontrer('monde'));
  $('#av-retour-gb').addEventListener('click',()=>avMontrer('monde'));
  $('#mk-gb').addEventListener('click',e=>{e.stopPropagation();if(paysFini(ETAPES_FR)){avMontrer('iles');}else{toast('Termine d\'abord la France ! 🇫🇷');}});
  $('#av-retour-de').addEventListener('click',()=>avMontrer('monde'));
  $('#mk-de').addEventListener('click',e=>{e.stopPropagation();if(paysFini(ETAPES_GB)){avMontrer('rhin');}else{toast('Termine d\'abord les Îles Britanniques ! 🇬🇧');}});
  $('#av-retour-es').addEventListener('click',()=>avMontrer('monde'));
  $('#mk-es').addEventListener('click',e=>{e.stopPropagation();if(paysFini(ETAPES_DE)){avMontrer('iberie');}else{toast('Termine d\'abord l\'Allemagne & les Pays-Bas ! 🇩🇪');}});
  $('#mk-fr').addEventListener('click',e=>{e.stopPropagation();if(paysFini(ETAPES_BE)){avMontrer('france');}else{toast('Termine d\'abord la Belgique ! 🇧🇪');}});
  avMajPins();
  }catch(e){}   // une carte/panzoom qui échoue ne doit jamais bloquer l'intro ni le reste
}
function avMascIntro(pays){mascPays=pays;mascI=0;etat.aventure.mascVue=etat.aventure.mascVue||{};$('#av-intro').style.display='';avMascAffiche();}
function avMascAffiche(){const m=MASCOTTES[mascPays];setFondImg($('#av-slide'),m.img,'');$('#av-intro-txt').textContent=m.ecrans[mascI];$('#av-dots').innerHTML=m.ecrans.map((_,i)=>'<span class="'+(i===mascI?'on':'')+'"></span>').join('');$('#av-next').textContent=mascI===m.ecrans.length-1?'En route ! →':'Continuer ›';}
function avMontrer(quoi){
  if(MASCOTTES[quoi]&&!((etat.aventure.mascVue||{})[quoi])){return avMascIntro(quoi);}
  avMontrerMap(quoi);
}
function avMontrerMap(quoi){
  $('#av-monde').style.display=quoi==='monde'?'':'none';
  $('#av-belgique').style.display=quoi==='belgique'?'':'none';
  $('#av-france').style.display=quoi==='france'?'':'none';
  $('#av-iles').style.display=quoi==='iles'?'':'none';
  $('#av-rhin').style.display=quoi==='rhin'?'':'none';
  $('#av-iberie').style.display=quoi==='iberie'?'':'none';
  if(quoi==='belgique'||quoi==='france'||quoi==='iles'||quoi==='rhin'||quoi==='iberie'){avMonde=quoi;avMajPins();}
  const pz=quoi==='monde'?avPZM:(quoi==='france'?avPZF:(quoi==='iles'?avPZI:(quoi==='rhin'?avPZR:(quoi==='iberie'?avPZE:avPZB))));if(pz)requestAnimationFrame(()=>requestAnimationFrame(()=>pz.refit()));
}
function avAfficheIntro(){
  const s=AV_INTRO[avIntroI];
  setFondImg($('#av-slide'),s.img,'');
  $('#av-intro-txt').textContent=s.txt;
  $('#av-dots').innerHTML=AV_INTRO.map((_,i)=>'<span class="'+(i===avIntroI?'on':'')+'"></span>').join('');
  $('#av-next').textContent=avIntroI===AV_INTRO.length-1?"Commencer l'aventure →":"Continuer ›";
}
function avIntroSuivant(){
  if(mascPays){mascI++;const m=MASCOTTES[mascPays];if(mascI>=m.ecrans.length){etat.aventure.mascVue[mascPays]=true;sauver();$('#av-intro').style.display='none';const p=mascPays;mascPays=null;avMontrerMap(p);return;}avMascAffiche();return;}
  avIntroI++;
  if(avIntroI>=AV_INTRO.length){etat.aventure.introVu=true;sauver();$('#av-intro').style.display='none';avMontrer('monde');return;}
  avAfficheIntro();
}
function ouvrirAventure(){
  avInitCartes();try{avMajPins();}catch(e){}
  if(!etat.aventure.introVu){avIntroI=0;$('#av-intro').style.display='';avAfficheIntro();}
  else{$('#av-intro').style.display='none';avMontrer('monde');}
}


/* ===== AVENTURE : moteur d'étape (Belgique · Anvers) ===== */
/* ============================================================
   MÉTHODE « NOUVEAU PAYS » (référence de conception — à suivre)
   1. Nouvelle carte SVG du pays + 10 pins numérotés + drapeau boss.
   2. Nouvelle mascotte locale (équivalent Pieter-Jan) + intro.
   3. Choisir 10 villes-étapes + 1 ville boss (capitale).
   4. 1 image de fond par étape : aventure/fond_<region>.jpg.
   5. Par étape : un NARRATIF (enjeu clair : « X a besoin de toi
      pour … ») + un THÈME D'APPRENTISSAGE de prédilection.
   6. Structure : 7 sous-étapes = ouverture-histoire(lecture+
      compréhension) & décider-juste(faits→carnet) & cadeau —
      puis aides/défis thématisés — mini-boss — bonus.
   7. Épreuve phare au format UNIQUE par étape (graphique, ordre,
      circuit, carte, ortho, robes…) + ÉQUIPE ORIGINALE (critère
      jamais répété : eau, vitesse, endurance, bataille, robe…).
   8. Compositions d'équipe : communs + rares, avec ACHATS
      multi-options (buy:'id' ou buy:[ids]) pour ne jamais bloquer.
   9. Rappels automatiques : fait:['cle','valeur'] → journal cumulé
      inter-étapes (aucun code à écrire).
  10. Programme scolaire aligné P5/P6 (FWB), un peu au-delà.
  11. Difficulté : petite marche entre étapes, GRANDE marche au
      boss (fin de pays). Récompense boss : mascotte légendaire.
  12. Ajouter chaque étape à ETAPES{} : gating et pins = AUTO.
      Champs requis par étape : key, pays, drapeau, numero, region,
      province, theme, enjeu, fond, nom, finText, sousEtapes[7].
   Vérification : node tools/qc.js (faisabilité, balance, ids).
   ============================================================ */
const estP5=()=>(((profilActif&&profilActif.niveau)||5)>=5);







let avMonde='belgique';
function MC(){return MONDES[avMonde]||MONDES.belgique;}
function paysFini(etapes){const pr=(etat.aventure.prov)||{};return Object.values(etapes).filter(e=>e.numero>=1&&e.numero<=10).every(e=>pr[e.key]&&pr[e.key].fini);}


function validerEtapes(){
  try{
    const req=['key','pays','drapeau','numero','region','province','theme','enjeu','nom','sousEtapes'];
    Object.entries(ETAP_ALL).forEach(([k,e])=>{
      req.forEach(f=>{if(e[f]==null)console.warn('[ETAPES] '+k+' : champ manquant "'+f+'"');});
      if(e.key!==k)console.warn('[ETAPES] clé "'+k+'" ≠ e.key "'+e.key+'"');
      (e.sousEtapes||[]).forEach((se,i)=>(se.activites||[]).forEach(a=>{
        if(a.type==='compo')(a.slots||[]).forEach(s=>{const b=Array.isArray(s.buy)?s.buy:(s.buy?[s.buy]:[]);b.forEach(id=>{if(!CARTES.some(c=>c.id===id))console.warn('[ETAPES] '+k+' SE'+(i+1)+' buy inexistant '+id);});});
        if(se.cartes)se.cartes.forEach(id=>{if(!CARTES.some(c=>c.id===id))console.warn('[ETAPES] '+k+' grant inexistant '+id);});
      }));
    });
  }catch(e){}
}
validerEtapes();
let AE=null,aeSE=0,aeQ=[],aeQi=0,aeSlots=null,AVkey='anvers';let aeIntroNarr='';
function AVS(){const a=etat.aventure;a.prov=a.prov||{};a.prov[AVkey]=a.prov[AVkey]||{sousEtape:0,faits:{},fini:false};return a.prov[AVkey];}
function avEtapeLancer(e){
  const g=e&&e.currentTarget;const key=(g&&g.dataset&&g.dataset.etape)||'anvers';
  AVkey=key;AE=ETAP_ALL[key]||ETAPE_ANVERS;const b=AVS();
  aeSE=b.fini?0:Math.min(b.sousEtape||0,AE.sousEtapes.length-1);
  const ov=$('#av-etape');setFondImg(ov,AE.fond,"linear-gradient(180deg,rgba(20,16,46,.72) 0%,rgba(20,16,46,.26) 17%,rgba(20,16,46,.30) 73%,rgba(20,16,46,.74) 100%)");ov.style.backgroundSize='cover';ov.style.backgroundPosition='center';
  ov.classList.add('on');
  if(!b.vu&&AE.reveal){b.vu=true;sauver();return avReveal(AE);}
  avSousEtapeStart();
}
function avGuideImg(pays){return pays==='France'?'cartes/francois_camargue.jpg':(pays==='Royaume-Uni'||pays==='Irlande')?'cartes/big_ben.jpg':(pays==='Allemagne'||pays==='Pays-Bas')?'cartes/inge.jpg':(pays==='Espagne'||pays==='Portugal')?'cartes/rocio.jpg':'cartes/pieter_jan.jpg';}
function avReveal(et){
  const g=document.querySelector('.ae-guide img');if(g){g.src=avGuideImg(et.pays);g.alt='Guide';}
  $('#ae-titre').textContent=et.region;
  $('#ae-prog').innerHTML='<div class="aep-txt">'+(et.drapeau||'')+' '+et.pays+' · '+(et.boss?'★ '+et.region:'Étape '+et.numero+' : '+et.region)+'</div>';
  bulle('Regarde bien où nous sommes… 👀');
  $('#ae-corps').innerHTML='<div class="ae-reveal"><div class="ae-reveal-img" style="background-image:url('+et.fond+')"></div><div class="ae-reveal-nom">'+(et.theme||'')+'</div><div class="ae-reveal-txt">'+(et.reveal||'')+'</div><button class="ae-btn" id="ae-reveal-go">Commencer l\'aventure →</button></div>';
  $('#ae-reveal-go').onclick=avSousEtapeStart;
}
function avFermerEtape(){$('#av-etape').classList.remove('on');}
function avSousEtapeStart(){
  const se=AE.sousEtapes[aeSE];
  aeQ=[];if(se.rappel)aeQ.push('rappel');se.activites.forEach((_,i)=>aeQ.push({act:i}));aeQ.push('recompense');
  aeIntroNarr=se.narr||'';
  aeQi=0;$('#ae-titre').textContent='';$('#ae-prog').innerHTML='<div class="aep-txt">'+AE.drapeau+' '+(AE.boss?'★ '+AE.region:'Étape '+AE.numero+' · '+AE.region)+' — '+(aeSE+1)+'/'+AE.sousEtapes.length+'</div><div class="aep-bar"><i style="width:'+Math.round((aeSE+1)/AE.sousEtapes.length*100)+'%"></i></div>';avEcranSuivant();
}
function avEcranSuivant(){
  const se=AE.sousEtapes[aeSE];
  $('#av-etape').classList.remove('rappel');
  if(aeQi>=aeQ.length)return avFinSousEtape();
  const it=aeQ[aeQi++];
  if(it==='narr')return avNarr(se);
  if(it==='rappel')return avRappel();
  if(it==='recompense')return avRecompense(se);
  if(typeof it==='object')return avActivite(se.activites[it.act]);
}
function bulle(txt){const el=$('#ae-narr');let t;if(aeIntroNarr){t=aeIntroNarr;aeIntroNarr='';}else t=txt||'';el.textContent=t;el.style.display=t?'':'none';const ti=$('#ae-titre'),hd=document.querySelector('.ae-header');if(hd)hd.classList.toggle('ae-mute',!t&&!(ti&&ti.textContent));}
function corpsBtn(txt,label,onclick){$('#ae-corps').innerHTML='<div class="ae-bloc">'+(txt||'')+'<button class="ae-btn" id="ae-cont">'+(label||'Continuer ›')+'</button></div>';$('#ae-cont').onclick=onclick;}
function avNarr(se){bulle(se.narr);corpsBtn('','Continuer ›',avEcranSuivant);}
function avRappel(){
  const prov=(etat.aventure.prov)||{};const faits={};for(const k in prov)Object.assign(faits,prov[k].faits||{});
  const cles=Object.keys(faits).filter(k=>{
    const f=faits[k];
    const q=(f&&typeof f==='object'&&f.q)?f.q:RAPPEL_Q[k];
    const ch=(f&&typeof f==='object'&&f.choix)?f.choix:RAPPEL_CHOIX[k];
    const bon=(f&&typeof f==='object')?f.r:f;
    return q&&Array.isArray(ch)&&ch.includes(bon);
  });
  if(!cles.length)return avEcranSuivant();
  const cle=cles[rnd(0,cles.length-1)],f=faits[cle];
  const q=(f&&typeof f==='object'&&f.q)?f.q:RAPPEL_Q[cle];
  const ch=(f&&typeof f==='object'&&f.choix)?f.choix:RAPPEL_CHOIX[cle];
  const bon=(f&&typeof f==='object')?f.r:f;
  bulle("⚡ Rappel éclair !");
  $('#av-etape').classList.add('rappel');
  avQCM(q,ch,bon,avEcranSuivant,"Hmm, souviens-toi… réessaie 🙂");
  $('#ae-corps').insertAdjacentHTML('afterbegin','<div class="ae-rappel-tag">⚡ RAPPEL ÉCLAIR</div>');
}
function avActivite(a){
  if(a.type==='decision')return avDecision(a);
  if(a.type==='compo')return avCompo(a);
  if(a.type==='calcul')return avCalcul(a);
  if(a.type==='quiz')return avQuizA(a);
  if(a.type==='lecture')return avLecture(a);
  if(a.type==='graphique')return avGraphique(a);
  if(a.type==='ordre')return avOrdre(a);
  if(a.type==='ortho')return avOrtho(a);
  if(a.type==='circuit')return avCircuit(a);
  if(a.type==='carte')return avCarte(a);
  if(a.type==='course')return avCourse(a);
  if(a.type==='bonus')return avBonus(a);
  avEcranSuivant();
}
/* QCM générique : gentle re-ask, appelle onOk si bonne réponse */
function avRepondre(choix,r,onOk,msgFaux){
  const box=$('#ae-choix');box.innerHTML='';
  const ordre=melange([...choix]);
  const old=document.getElementById('ae-reward');if(old)old.remove();
  box.insertAdjacentHTML('beforebegin','<div class="ae-reward" id="ae-reward"><span class="aer-lbl">🎁 Premier coup</span><b class="aer-val">+'+REC_AV1+' 💎</b></div>');
  let essais=0;
  const rec=()=>essais===0?REC_AV1:(essais===1?REC_AV2:0);
  const majRec=()=>{const el=document.getElementById('ae-reward');if(!el)return;const g=rec();el.innerHTML=g>0?('<span class="aer-lbl">'+(essais===0?'🎁 Premier coup':'2ᵉ essai')+'</span><b class="aer-val'+(essais>0?' small':'')+'">+'+g+' 💎</b>'):('<span class="aer-lbl dim">Réponds juste du 1er coup pour gagner des 💎 !</span>');};
  ordre.forEach(v=>{const b=document.createElement('button');b.className='ae-rep';b.textContent=v;b.onclick=()=>{
    if(v===r){box.querySelectorAll('button').forEach(x=>x.disabled=true);b.classList.add('bon');etat.exos=(etat.exos||0)+1;
      const g=rec();const el=document.getElementById('ae-reward');
      if(g>0){etat.crins+=g;sauver();majSolde(true);if(typeof montrerGainAnim==='function'){ancreGain=b;montrerGainAnim(g);}if(el)el.innerHTML='<b class="aer-val win">'+(essais===0?'🌟 Premier coup ! ':'')+'+'+g+' 💎</b>';}
      else if(el)el.innerHTML='<span class="aer-lbl dim">Bonne réponse (pas de bonus cette fois)</span>';
      setTimeout(onOk,450);}
    else{essais++;b.classList.add('faux');b.disabled=true;$('#ae-fb').textContent=msgFaux||"Hmm, tu es sûre ? Réfléchis encore…";majRec();}
  };box.appendChild(b);});
}
function avQCM(q,choix,r,onOk,msgFaux){
  $('#ae-corps').innerHTML='<div class="ae-q">'+q+'</div><div class="ae-choix" id="ae-choix"></div><div class="ae-fb" id="ae-fb"></div>';
  avRepondre(choix,r,onOk,msgFaux);
}
function avGraphique(a){
  bulle(a.bulle||"");
  const i=estP5()?1:0;const q=Array.isArray(a.q)?a.q[i]:a.q;const choix=Array.isArray(a.choix[0])?a.choix[i]:a.choix;const r=Array.isArray(a.r)?a.r[i]:a.r;
  $('#ae-corps').innerHTML=graphHTML({titre:a.titre,labels:a.labels,valeurs:a.valeurs})+'<div class="ae-q">'+q+'</div><div class="ae-choix" id="ae-choix"></div><div class="ae-fb" id="ae-fb"></div>';
  avRepondre(choix,r,avEcranSuivant,"Relis bien le graphique 🙂");
}
function avOrdre(a){
  bulle(a.bulle||"");
  const bon=a.elements;const mel=melange(bon.map((t,i)=>({t,i})));let picked=[];
  $('#ae-corps').innerHTML='<div class="ae-q">'+a.consigne+'</div><div class="ae-ordre-pick" id="ae-pick"></div><div class="ae-ordre-src" id="ae-src"></div><div class="ae-fb" id="ae-fb"></div>';
  const src=$('#ae-src'),pick=$('#ae-pick');
  function render(){
    pick.innerHTML=picked.map((idx,pos)=>'<span class="ae-ordpk">'+(pos+1)+'. '+bon[idx]+'</span>').join('');
    src.innerHTML='';mel.forEach(o=>{if(picked.includes(o.i))return;const b=document.createElement('button');b.className='ae-ordel';b.textContent=o.t;b.onclick=()=>pickEl(o.i);src.appendChild(b);});
  }
  function pickEl(oi){picked.push(oi);
    if(!picked.every((idx,pos)=>idx===pos)){$('#ae-fb').textContent="Presque ! On recommence 🙂";picked=[];render();return;}
    $('#ae-fb').textContent='';render();
    if(picked.length===bon.length){$('#ae-fb').textContent="Bravo, dans l'ordre ! 🎉";setTimeout(avEcranSuivant,750);}
  }
  render();
}
function avCourse(a){
  bulle(a.bulle||"");
  let me=0,adv=0;const goal=a.taps||16;let fini=false,timer=null;
  $('#ae-corps').innerHTML='<div class="ae-course"><div class="ae-track"><div class="ae-runner" id="ae-me">🐴</div><div class="ae-fin">🏁</div></div><div class="ae-track"><div class="ae-runner" id="ae-adv">🐎</div><div class="ae-fin">🏁</div></div></div><button class="ae-btn ae-galop" id="ae-galop">GALOP ! 🏇</button><div class="ae-fb" id="ae-fb"></div>';
  const pm=()=>{$('#ae-me').style.left=Math.min(92,me/goal*88)+'%';};
  const pa=()=>{$('#ae-adv').style.left=Math.min(92,adv/goal*88)+'%';};
  timer=setInterval(()=>{if(fini)return;adv+=0.5;pa();if(adv>=goal){fini=true;clearInterval(timer);$('#ae-galop').disabled=true;$('#ae-fb').textContent='Presque ! On retente ? 🙂';setTimeout(()=>avCourse(a),950);}},90);
  $('#ae-galop').onclick=()=>{if(fini)return;me++;pm();if(me>=goal){fini=true;clearInterval(timer);$('#ae-galop').disabled=true;$('#ae-fb').textContent='🏆 Gagné !';setTimeout(()=>avCourseQ(a),700);}};
}
function avCourseQ(a){
  if(!a.q)return avEcranSuivant();
  const i=estP5()?1:0;const q=Array.isArray(a.q)?a.q[i]:a.q;const choix=Array.isArray(a.choix[0])?a.choix[i]:a.choix;const r=Array.isArray(a.r)?a.r[i]:a.r;
  $('#ae-corps').innerHTML='<div class="ae-q">'+q+'</div><div class="ae-choix" id="ae-choix"></div><div class="ae-fb" id="ae-fb"></div>';
  avRepondre(choix,r,avEcranSuivant,"Presque, relis bien !");
}
function avCarte(a){
  const pairs=melange(a.pairs.map(p=>p));let idx=0;const allProv=[...new Set(a.pairs.map(p=>p[1]))];
  function ask(){
    if(idx>=pairs.length){bulle("Bravo, carte complétée ! 🗺️");corpsBtn('<div class="ae-recomp"><div class="ae-rtxt">Carte de '+AE.pays+' complétée ! 🎉</div></div>','Continuer ›',avEcranSuivant);return;}
    const cl=pairs[idx][0],prov=pairs[idx][1];
    bulle("🗺️ Place "+cl+" sur la carte ("+(idx+1)+"/"+pairs.length+")");
    const choix=melange([prov,...melange(allProv.filter(p=>p!==prov)).slice(0,3)]);
    $('#ae-corps').innerHTML='<div class="ae-q"><b>'+cl+'</b> est le chef-lieu de quelle province ?</div><div class="ae-choix" id="ae-choix"></div><div class="ae-fb" id="ae-fb"></div>';
    avRepondre(choix,prov,()=>{idx++;ask();},"Souviens-toi de ton voyage… réessaie 🙂");
  }
  ask();
}
function avCircuit(a){
  bulle(a.bulle||"");
  $('#ae-corps').innerHTML='<div class="ae-circuit" id="ae-circ">'+(a.schema||'🔋 pile — 🔌 fil — ✂️ coupé — 💡')+'</div><div class="ae-q">'+a.q+'</div><div class="ae-choix" id="ae-choix"></div><div class="ae-fb" id="ae-fb"></div>';
  avRepondre(a.choix,a.r,()=>{const c=$('#ae-circ');c.innerHTML='🔋 — 🔌 — 🎚️ — 💡 ✨';c.classList.add('on');setTimeout(avEcranSuivant,1000);},a.msgFaux||"Le circuit n'est pas fermé… le courant ne passe pas 🙂");
}
function avOrtho(a){
  bulle(a.bulle||"");
  $('#ae-corps').innerHTML='<div class="ae-q">'+a.indice+'</div><input class="ortho-input" id="ae-ortho" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="tape ici…"><button class="ae-btn" id="ae-ok">Valider</button><div class="ae-fb" id="ae-fb"></div>';
  const inp=$('#ae-ortho');setTimeout(()=>{try{inp.focus();}catch(e){}},120);let fini=false;
  const val=()=>{
    if(fini)return;const rep=(inp.value||'').trim();if(!rep)return;
    if(rep.toLowerCase()===a.mot.toLowerCase()){fini=true;inp.disabled=true;$('#ae-fb').textContent="Parfait, sans faute ! ✍️";setTimeout(avEcranSuivant,550);}
    else{fini=true;inp.disabled=true;$('#ae-fb').innerHTML="On écrit : <b>"+a.mot+"</b>";const ok=$('#ae-ok');ok.textContent="Continuer ›";ok.onclick=avEcranSuivant;}
  };
  $('#ae-ok').onclick=val;inp.addEventListener('keydown',e=>{if(e.key==='Enter')val();});
}
function avDecision(a){bulle("");avQCM(a.q,a.choix,a.r,()=>{if(a.fait)AVS().faits[a.fait[0]]={r:a.r,q:a.q,choix:a.choix};sauver();avEcranSuivant();});}
function avCalcul(a){const i=estP5()?1:0;bulle("");avQCM(Array.isArray(a.q)?a.q[i]:a.q,Array.isArray(a.choix[0])?a.choix[i]:a.choix,Array.isArray(a.r)?a.r[i]:a.r,avEcranSuivant,"Presque… recompte 🙂");}
function avQuizA(a){bulle("");avQCM(a.q,a.choix,a.r,avEcranSuivant,"Pas tout à fait… réessaie 🙂");}
function avLecture(a){
  bulle("");
  $('#ae-corps').innerHTML='<div class="ae-texte">'+a.texte+'</div><button class="ae-btn" id="ae-cont">J\'ai lu ›</button>';
  let qi=0;
  $('#ae-cont').onclick=()=>poserQ();
  function poserQ(){if(qi>=a.questions.length)return avEcranSuivant();const qq=a.questions[qi++];bulle("Question "+qi+" / "+a.questions.length);avQCM(qq.q,qq.choix,qq.r,poserQ,"Relis le texte… 🙂");$('#ae-corps').insertAdjacentHTML('afterbegin','<div class="ae-texte ae-relire">'+a.texte+'</div>');}
}
/* ---- composition d'équipe ---- */
function acheterHistoire(id,a){
  const c=CARTES.find(x=>x.id===id);if(!c)return;const prix=PRIX_ACHAT[c.rarete]||300;
  if((etat.crins||0)<prix){toast('Pas assez de 💎 — va aux Défis les gagner !');return;}
  etat.crins-=prix;ajouterExemplaire(c);majSolde(true);sauver();rendreGrille();toast('🛒 '+c.nom+' rejoint ton écurie !');
  avCompo(a);
}
const BONUS_COMPO=12;   // bonus max selon la performance (puissance élevée ou écart minime à la cible)
/* Objectif clair et explicite (égalité / inégalité) déduit des contraintes de l'activité. */
function objectifCompo(a,i){
  const CAP=a.cap||((typeof AV_CAP!=='undefined'&&AV_CAP[AVkey])||'force');
  const CN=(CAPS.find(c=>c.id===CAP)||{}).nom||''+CN+'';
  const MUL=((typeof PAYS_MULT!=='undefined'&&AE&&PAYS_MULT[AE.pays])||1)*((typeof AMB_COMPO!=='undefined')?AMB_COMPO:1);
  const pMin=a.puissanceMin?Math.round(a.puissanceMin[i]*MUL):null;
  const pMax=a.puissanceMax?Math.round(a.puissanceMax[i]*MUL):null;
  const cible=a.cible?Math.round(a.cible[i]*MUL):null;
  const contr=a.contrainte?a.contrainte[i]:null;
  if(cible!=null)return'🎯 Objectif : '+CN+' totale <b>la plus proche possible de '+cible+'</b>';
  if(pMin!=null)return'💪 Objectif : '+CN+' totale <b>au moins '+pMin+'</b> (≥ '+pMin+') — vise le plus haut pour un plus gros bonus !';
  if(pMax!=null)return'🪶 Objectif : '+CN+' totale <b>au plus '+pMax+'</b> (≤ '+pMax+')';
  if(contr==='pair')return'🔢 Objectif : '+CN+' totale <b>paire</b>';
  if(contr==='max250')return'🪶 Objectif : '+CN+' totale <b>au plus 250</b> (≤ 250)';
  if(a.robesDistinctes)return'🎨 Objectif : '+a.slots.length+' robes <b>toutes différentes</b>';
  if(a.royaumesDistincts)return'🌍 Objectif : '+a.slots.length+' origines <b>toutes différentes</b>';
  if(a.royaumeUnique)return'🏴 Objectif : tous les chevaux du <b>même royaume</b>';
  return null;
}
function celebrerCompo(cards,note,gain){
  const z=$('#ae-corps');if(!z)return avEcranSuivant();
  const conf=Array.from({length:14}).map((_,i)=>'<span class="ae-conf" style="left:'+Math.round(4+i*6.6)+'%;animation-delay:'+(i%5*0.12)+'s;font-size:'+(14+i%4*4)+'px">'+['✨','🎉','⭐','💫','🏆'][i%5]+'</span>').join('');
  const cartes=cards.map((c,k)=>c?'<div class="ae-celcard" style="animation-delay:'+(0.15+k*0.18)+'s"><div class="tc-box ratio">'+carteHTML(c,etat.collection[c.id]||1)+'</div><div class="ae-celnom">'+c.nom+'</div></div>':'').join('');
  z.innerHTML='<div class="ae-celebre"><div class="ae-conflayer">'+conf+'</div>'
    +'<div class="ae-celtitre">'+(note||'Bravo !')+'</div>'
    +'<div class="ae-celsub">Ton équipe gagnante</div>'
    +'<div class="ae-celcards">'+cartes+'</div>'
    +'<div class="ae-celgain">+'+gain+' 💎</div>'
    +'<button class="ae-btn ae-celbtn" id="ae-celok">Continuer ›</button></div>';
  const b=$('#ae-celok');if(b)b.onclick=avEcranSuivant;
}
function avCompo(a){
  const CAP=a.cap||((typeof AV_CAP!=='undefined'&&AV_CAP[AVkey])||'force');
  const CN=(CAPS.find(c=>c.id===CAP)||{}).nom||''+CN+'';
  const MUL=((typeof PAYS_MULT!=='undefined'&&AE&&PAYS_MULT[AE.pays])||1)*((typeof AMB_COMPO!=='undefined')?AMB_COMPO:1);
  const i=estP5()?1:0;
  // Pour les épreuves "cible", la consigne codait le nombre de base en dur (ex. 104) alors que
  // la vraie condition est cible×MUL (ex. 125). On masque cette consigne redondante : l'Objectif
  // ci-dessous affiche la valeur réelle calculée. Le narratif (bulle) garde le contexte.
  const consigne=a.cible?'':(Array.isArray(a.consigne)?a.consigne[i]:a.consigne);
  const objectif=objectifCompo(a,i);
  const consHTML=(consigne?'<div class="ae-consigne">'+consigne+'</div>':'')+(objectif?'<div class="ae-objectif">'+objectif+'</div>':'');
  const pMin=a.puissanceMin?Math.round(a.puissanceMin[i]*MUL):null;
  const contr=a.contrainte?a.contrainte[i]:null;
  const cible=a.cible?Math.round(a.cible[i]*MUL):null;const TOL=Math.max(12,Math.round(12*MUL));
  aeSlots=a.slots.map(s=>({label:s.label,m:s.m,buy:s.buy,card:null}));
  bulle("");
  const corps=$('#ae-corps');
  const owned=CARTES.filter(c=>(etat.collection[c.id]||0)>0);
  const utile=owned.filter(c=>aeSlots.some(s=>s.m(c)));
  // détecter blocage : un slot sans aucune carte possédée compatible
  const manque=(function(){
    const dispo={};utile.forEach(c=>dispo[c.id]=etat.collection[c.id]||0);
    const slots=aeSlots.map(s=>({s,cand:utile.filter(c=>s.m(c))})).sort((a,b)=>a.cand.length-b.cand.length);
    const m=[];
    for(const o of slots){const c=o.cand.find(x=>dispo[x.id]>0);if(!c)m.push(o.s);else dispo[c.id]--;}
    return m;
  })();
  const bloque=manque.length>0;
  if(bloque){
    const buyIds=[...new Set(manque.reduce((acc,s)=>acc.concat(Array.isArray(s.buy)?s.buy:(s.buy?[s.buy]:[])),[]))].slice(0,8);
    let boutique='';
    if(buyIds.length){boutique='<div class="ae-boutit">🛒 Achète les chevaux qu\'il te manque :</div>';buyIds.forEach(id=>{const c=CARTES.find(x=>x.id===id);if(!c)return;const prix=PRIX_ACHAT[c.rarete]||300;boutique+='<button class="ae-btn ae-buy" data-buy="'+id+'"><span class="tc-box ratio ae-buyvig">'+carteHTML(c,etat.collection[c.id]||0)+'</span>'+c.nom+'<br>'+prix+' 💎</button>';});}
    corps.innerHTML=consHTML+'<div class="ae-manque">🔑 Il te manque des chevaux pour cette mission.'+(buyIds.length?'<br>Achète-les ici, ou gagne-les aux <b>Défis</b>.':'<br>File aux <b>Défis</b> gagner de nouvelles cartes !')+'</div>'+boutique+'<button class="ae-lien" id="ae-defis">→ Aller aux Défis</button><button class="ae-lien" id="ae-later">Retour à la carte</button>';
    $$('#ae-corps .ae-buy').forEach(b=>b.onclick=()=>acheterHistoire(b.dataset.buy,a));
    $('#ae-defis').onclick=()=>{avFermerEtape();switchEcran('revisions');};$('#ae-later').onclick=avFermerEtape;return;
  }
  corps.innerHTML='<div class="ae-cotop">'+consHTML+'<div class="ae-slots" id="ae-slots"></div><div class="ae-fb" id="ae-fb"></div><button class="ae-btn" id="ae-valider">Valider l\'équipe</button></div><div class="ae-poolt">Tes chevaux :</div><div class="ae-pool" id="ae-pool"></div>';
  function puiss(){return aeSlots.reduce((s,x)=>s+(x.card?statDe(x.card,CAP):0),0);}
  function nbUsed(id){return aeSlots.filter(x=>x.card&&x.card.id===id).length;}
  function used(id){const c=utile.find(x=>x.id===id);const ex=c?(etat.collection[id]||0):0;return nbUsed(id)>=ex;}
  function renderSlots(){$('#ae-slots').innerHTML=aeSlots.map((s,k)=>s.card?'<div class="ae-slot plein" data-k="'+k+'"><div class="tc-box ratio ae-mini">'+carteHTML(s.card,etat.collection[s.card.id]||1)+'<span class="ae-puiss mini">💪 '+statDe(s.card,CAP)+'</span></div><span>'+s.card.nom+'</span></div>':'<div class="ae-slot vide" data-k="'+k+'"><span class="ae-plus">+</span><span>'+s.label+'</span></div>').join('');
    $('#ae-slots').querySelectorAll('.ae-slot.plein').forEach(el=>el.onclick=()=>{aeSlots[+el.dataset.k].card=null;renderAll();});
    const p=puiss();const pMax=a.puissanceMax?Math.round(a.puissanceMax[i]*MUL):null;$('#ae-fb').innerHTML=cible!=null?('🎯 Cible <b>'+cible+'</b> · ton équipe <b>'+p+'</b> · écart <b>'+Math.abs(p-cible)+'</b>'):(pMin!=null?('💪 '+CN+' <b>'+p+'</b> · minimum '+pMin+' '+(p>=pMin?'✅':'⛔ (pas encore)')):(pMax!=null?('🪶 '+CN+' <b>'+p+'</b> · maximum '+pMax+' '+(p<=pMax?'✅':'⛔ (trop lourde)')):(contr?(''+CN+' <b>'+p+'</b>'):'')));}
  function renderPool(){$('#ae-pool').innerHTML=utile.slice().sort((x,y)=>statDe(y,CAP)-statDe(x,CAP)).map(c=>'<div class="tc-box ratio ae-pcard'+(used(c.id)?' pris':'')+'" data-id="'+c.id+'">'+carteHTML(c,etat.collection[c.id]||1)+'<span class="ae-puiss">💪 '+statDe(c,CAP)+'</span></div>').join('');
    $('#ae-pool').querySelectorAll('.ae-pcard').forEach(el=>el.onclick=()=>{if(el.classList.contains('pris'))return;const c=utile.find(x=>x.id===el.dataset.id);const slot=aeSlots.find(s=>!s.card&&s.m(c));if(!slot){toast('Aucune place pour ce cheval ici');return;}slot.card=c;renderAll();});}
  function renderAll(){renderSlots();renderPool();}
  renderAll();
  $('#ae-valider').onclick=()=>{
    if(aeSlots.some(s=>!s.card)){$('#ae-fb').textContent='Remplis toutes les places de l\'équipe.';return;}
    const p=puiss();
    if(pMin&&p<pMin){$('#ae-fb').textContent='Pas assez puissante ('+p+' / '+pMin+'). Choisis de plus costauds !';return;}
    if(cible!=null&&Math.abs(p-cible)>TOL){$('#ae-fb').textContent='Approche-toi encore de '+cible+' — tu es à '+p+' (écart '+Math.abs(p-cible)+').';return;}
    if(contr==='pair'&&p%2!==0){$('#ae-fb').textContent='La '+CN+' totale ('+p+') doit être PAIRE.';return;}
    if(contr==='max250'&&p>250){$('#ae-fb').textContent='Trop puissante ('+p+' > 250).';return;}
    if(a.puissanceMax){const mx=Math.round(a.puissanceMax[estP5()?1:0]*MUL);if(p>mx){$('#ae-fb').textContent='Trop lourde ! ('+p+' > '+mx+') — les plus légers passent. Prends des chevaux plus petits 🪶';return;}}
    if(a.royaumesDistincts){const rs=aeSlots.map(s=>s.card&&s.card.royaume).filter(Boolean);if(new Set(rs).size<rs.length){$('#ae-fb').textContent='Deux chevaux du même royaume ! Choisis des origines différentes 🌍';return;}}
    if(a.royaumeUnique){const rs=aeSlots.map(s=>s.card&&s.card.royaume).filter(Boolean);if(new Set(rs).size>1){$('#ae-fb').textContent='Ce ne sont pas tous du même clan (même royaume) ! 🏴';return;}}
    if(a.robesDistinctes){const rb=aeSlots.map(s=>s.card&&ROBES[s.card.id]).filter(Boolean);if(rb.length<aeSlots.length){$('#ae-fb').textContent='Chaque cheval doit avoir une robe connue (choisis des chevaux colorés).';return;}if(new Set(rb).size<rb.length){$('#ae-fb').textContent='Deux chevaux ont la même couleur ! Le cortège doit être bien coloré 🎨';return;}}
    let bonus=0,note='Belle équipe !';if(cible!=null){const gap=Math.abs(p-cible);bonus=Math.max(0,Math.round((TOL-gap)/TOL*BONUS_COMPO));note=gap===0?'🎯 Pile dans le mille !':(gap<=3?'🎯 Tout proche !':'Bien visé !');}else if(pMin!=null){bonus=Math.min(BONUS_COMPO,Math.max(0,Math.round((p-pMin)/2)));note=bonus>=BONUS_COMPO?'💪 Équipe surpuissante !':(bonus>0?'💪 Belle puissance !':'Pile ce qu\'il faut.');}const gain=8+bonus;etat.crins+=gain;majSolde(true);sauver();celebrerCompo(aeSlots.map(s=>s.card),note,gain);
  };
}
function avRecompense(se){
  const premiere=aeSE>=(AVS().sousEtape||0);
  if(premiere){
    etat.crins+=se.crins;etat.renommee+=se.renom;etat.renommeeTotale+=se.renom;majSolde(true);
    const items=(se.cartes||[]).map(id=>CARTES.find(c=>c.id===id)).filter(Boolean).map(c=>{const r=ajouterExemplaire(c);return {c:c,cls:r.cls,etatTxt:r.etatTxt,sousTxt:r.sousTxt};});
    if(items.length)rendreGrille();
    sauver();
    bulle("Bravo, sous-étape réussie ! 🎉");
    corpsBtn('<div class="ae-recomp">+'+se.crins+' Diamants · +'+se.renom+' ⭐ renommée'+(items.length?'<br>🎁 une carte cadeau t\'attend !':'')+'</div>','Continuer ›',function(){avRevealCadeaux(items.slice(),avFinSousEtape);});
  }else{
    bulle("Déjà accompli — mais tu peux t'entraîner !");
    corpsBtn('<div class="ae-recomp"></div>','Continuer ›',avFinSousEtape);
  }
}
function avRevealCadeaux(items,done){
  if(!items||!items.length){done();return;}
  const it=items.shift();
  revealApres=function(){avRevealCadeaux(items,done);};
  montrerReveal(it.c,etat.collection[it.c.id]||1,it.etatTxt,it.sousTxt,it.cls);
}
function avFinSousEtape(){
  const b=AVS();
  if(aeSE>=(b.sousEtape||0))b.sousEtape=aeSE+1;
  if(b.sousEtape>=AE.sousEtapes.length)b.fini=true;
  sauver();verifierJalons();aeSE++;
  if(aeSE>=AE.sousEtapes.length){avEtapeTerminee();return;}
  avSousEtapeStart();
}

function avBonus(a){
  const premiere=aeSE>=(AVS().sousEtape||0);
  const filt=(a&&a.rarete)||['commune','rare'];
  if(premiere){let c;if(a&&a.carteId){c=CARTES.find(x=>x.id===a.carteId)||tirerCarte();}else{let t=0;do{c=tirerCarte();t++;}while(!filt.includes(c.rarete)&&t<150);}
    const r=ajouterExemplaire(c);sauver();rendreGrille();
    $('#ae-corps').innerHTML='<div class="ae-recomp"><div class="ae-rtxt">🎁 Une récompense pour toi !</div><button class="ae-btn" id="ae-cont">Continuer ›</button></div>';
    $('#ae-cont').onclick=avEcranSuivant;
    revealApres=avEcranSuivant;
    montrerReveal(c,etat.collection[c.id]||1,r.etatTxt,r.sousTxt,r.cls);
  } else $('#ae-corps').innerHTML='<div class="ae-recomp"><div class="ae-rtxt">Récompense déjà reçue 🎁</div><button class="ae-btn" id="ae-cont">Continuer ›</button></div>';
  const bc=$('#ae-cont');if(bc)bc.onclick=avEcranSuivant;
}
function avEtapeTerminee(){
  bulle(AE.finText||"Étape terminée ! Cap sur la suite… 🐴");avMajPins();
  corpsBtn('<div class="ae-recomp"><div class="ae-rtxt">Étape '+AE.numero+' · <b>'+AE.region+'</b> terminée ! 🎉</div></div>','Retour à la carte',()=>{avFermerEtape();avMajPins();});
}
function avMajPins(){
  const prov=(etat.aventure.prov)||{};
  const order=Object.values(MC().etapes).filter(e=>e.numero>=1&&e.numero<=10).sort((a,b)=>a.numero-b.numero);
  const pins=[...document.querySelectorAll(MC().pins)];
  order.forEach((et,i)=>{
    const prev=order[i-1];
    const ok=i===0||!!(prev&&prov[prev.key]&&prov[prev.key].fini);
    // Identifiant STABLE : une pastille verte (fait) perd son .pt-num, donc on la retrouve via data-num
    // (posé au premier passage). Sans ça, les vertes deviennent introuvables et ne se réinitialisent
    // jamais → elles « fuitent » d'un profil à l'autre.
    const pin=pins.find(p=>{
      if(p.dataset.num)return +p.dataset.num===et.numero;
      const t=p.querySelector('.pt-num');return t&&(+t.textContent===et.numero);
    });
    if(!pin)return;
    pin.dataset.num=et.numero;
    pin.dataset.etape=et.key;
    const fait=!!(prov[et.key]&&prov[et.key].fini);
    pin.setAttribute('class','zsc etape '+(fait?'fait':ok?'dispo':'lock'));
    if(fait){
      pin.innerHTML='<circle class="pt-glow fait" r="20"/><circle class="pt-core fait" r="12"/><path class="pt-check" d="M -5 0.5 L -1.8 3.8 L 5 -4"/>';
    }else if(ok){
      pin.innerHTML='<circle class="pt-glow" r="20"/><circle class="pt-core" r="11"/><circle class="pt-shine" cx="-3.5" cy="-3.5" r="3"/><text class="pt-num" y="4">'+et.numero+'</text>';
    }else{
      pin.innerHTML='<circle class="pt-core lock" r="10"/><text class="pt-num" y="4">'+et.numero+'</text>';
    }
    if(ok||fait){pin.setAttribute('tabindex','0');if(!pin._wired){pin._wired=1;pin.addEventListener('click',avEtapeLancer);pin.addEventListener('pointerdown',()=>{pin.classList.add('hot');setTimeout(()=>pin.classList.remove('hot'),500);});}}
  });
  const bxl=document.querySelector(MC().bossSel);
  if(bxl){bxl.dataset.etape='bruxelles';const allFini=order.length>=10&&order.every(e=>prov[e.key]&&prov[e.key].fini);if(allFini){bxl.classList.add('boss-on');bxl.style.cursor='pointer';if(!bxl._wired){bxl._wired=1;bxl.addEventListener('click',avEtapeLancer);}}}
}


async function majReglageInfo(){
  let cache='—';try{const ks=await caches.keys();cache=ks.filter(k=>k.startsWith('ecurie-')).join(', ')||'—';}catch(e){}
  const mode=CLOUD.actif()?'☁️ Cloud activé':'📴 Local';
  $('#reglage-version').innerHTML='Version app : <b>'+VERSION_APP+'</b><br>Cache service worker : <b>'+cache+'</b><br>Mode : '+mode+'<div id="cloud-statut"></div>';
}
async function testerCloud(){
  const s=$('#cloud-statut');if(!s)return;s.textContent='Test en cours…';s.style.color='var(--txt-doux)';
  if(!CLOUD.actif()){s.textContent='Cloud non configuré (mode local).';s.style.color='var(--txt-doux)';return;}
  try{const r=await cloudListe();s.innerHTML='✅ Connecté — '+(Array.isArray(r)?r.length:0)+' compte(s) dans la base.';s.style.color='#5ec48a';}
  catch(e){s.innerHTML='❌ Erreur : '+String(e&&e.message||e).slice(0,140);s.style.color='#ff9a9a';}
}


async function forcerMaj(){
  try{if('serviceWorker' in navigator){const rs=await navigator.serviceWorker.getRegistrations();for(const r of rs)await r.unregister();}
      if('caches' in window){const ks=await caches.keys();for(const k of ks)await caches.delete(k);}}catch(e){}
  location.reload();
}


/* piège du bouton retour Android : ferme un overlay ou remonte, ne quitte jamais */
function fermerOverlayHaut(){
  const ave=document.querySelector('#av-etape.on');if(ave){ave.classList.remove('on');return true;}
  const o=document.querySelector('.reveal-overlay.on, .feuille-fond.on');if(o){o.classList.remove('on');return true;}
  return false;
}
try{history.pushState({e:1},'');}catch(e){}
window.addEventListener('popstate',function(){
  try{history.pushState({e:1},'');}catch(e){}
  if(fermerOverlayHaut())return;
  const acc=document.getElementById('accueil');
  if(acc&&acc.style.display!=='none'&&!acc.classList.contains('parti'))return;
  const a=document.querySelector('nav.tabs button.actif');
  if(a&&a.dataset.ecran!=='ecurie')switchEcran('ecurie');
});


async function cloudClassement(){return CLOUD.rpc('classement_mondial',{});}
async function ouvrirClassement(){
  $('#classement-fond').classList.add('on');
  const box=$('#classement-liste');
  const nbMoi=Object.values(etat.collection||{}).filter(v=>v>0).length;
  if(!CLOUD.actif()){box.innerHTML='<div class="cl-vide">Le classement mondial est disponible en mode cloud.<br><br>Toi : <b>'+nbMoi+'</b> chevaux 🐴</div>';return;}
  box.innerHTML='<div class="cl-vide">Chargement…</div>';
  let liste;
  try{liste=await cloudClassement();}
  catch(e){box.innerHTML='<div class="cl-vide">Connexion impossible.<br>'+String(e&&e.message||e).slice(0,90)+'</div>';return;}
  if(!liste||!liste.length){box.innerHTML='<div class="cl-vide">Aucun joueur pour l\'instant.</div>';return;}
  box.innerHTML=liste.map((p,i)=>{
    const moi=(profilActif&&p.prenom===profilActif.nom&&p.avatar===profilActif.emoji);
    const rang=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
    return '<div class="cl-row'+(moi?' moi':'')+'"><span class="cl-rang">'+rang+'</span><span class="cl-ava" style="background:'+(p.couleur||'#7ec2ff')+'33">'+(p.avatar||'🦄')+'</span><span class="cl-nom">'+p.prenom+(moi?' (toi)':'')+'</span><span class="cl-nb">'+p.nb+' 🐴</span></div>';
  }).join('');
}


function ouvrirChouchous(){
  $('#chouchous-fond').classList.add('on');const box=$('#chouchous-liste');
  const votes=Object.entries(etat.chouchous||{}).filter(([id,nb])=>nb>0&&CARTES.find(c=>c.id===id)).sort((a,b)=>b[1]-a[1]).slice(0,20);
  if(!votes.length){box.innerHTML='<div class="cl-vide">Tu n\'as pas encore choisi de chouchou !<br><br>Joue à « Cheval préféré » dans le pack 🎮 Détente pour créer ton classement du cœur.</div>';return;}
  const tot=votes.reduce((s,v)=>s+v[1],0);
  box.innerHTML='<div class="ch-tot">'+tot+' vote(s) du cœur ❤️</div>'+votes.map(([id,nb],i)=>{const c=CARTES.find(x=>x.id===id);const rang=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';return '<div class="ch-row"><span class="cl-rang">'+rang+'</span><div class="tc-box ratio ch-vig">'+carteHTML(c,etat.collection[id]||1)+'</div><div class="ch-info"><div class="ch-nom">'+c.nom+'</div><div class="ch-coeurs">'+'❤️'.repeat(Math.min(nb,5))+(nb>5?' ×'+nb:'')+'</div></div></div>';}).join('');
}

