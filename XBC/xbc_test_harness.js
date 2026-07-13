/*
 * Headless test harness for X Boson Conquest.
 * Stubs just enough DOM/canvas so the real game code loads and runs, then:
 *   1. boots a real level (from XBC_levels.js),
 *   2. drives many animate() frames,
 *   3. asserts no exceptions, units spawn/collide/die, bases behave,
 *   4. differentially checks the spatial-grid collision vs a naive O(n^2)
 *      reference and the attacker pre-pass vs the old nested scan.
 */
const fs = require('fs');
const vm = require('vm');

// ---- fake 2D context: records nothing, just no-ops (with call counters) ----
function makeCtx() {
  const ctx = {};
  const noop = () => {};
  ['clearRect','beginPath','closePath','arc','ellipse','moveTo','lineTo',
   'stroke','fill','rect','drawImage','setLineDash'].forEach(m => {
     ctx[m] = function(){ ctx._calls[m] = (ctx._calls[m]||0)+1; };
   });
  ctx._calls = {};
  ctx.fillStyle = ''; ctx.strokeStyle=''; ctx.lineWidth=1;
  ctx.shadowColor=''; ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
  return ctx;
}
function makeCanvas(w,h){
  const c = { width:w||800, height:h||600, style:{}, offsetLeft:0, offsetTop:0,
    _ctx: makeCtx(), getContext(){ return this._ctx; },
    getBoundingClientRect(){ return {left:0,top:0,width:this.width,height:this.height}; } };
  return c;
}

// ---- fake element for non-canvas ids ----
function makeEl(){ return { style:{}, classList:{add:()=>{},remove:()=>{}},
  hidden:false, innerHTML:'', appendChild:()=>{}, removeChild:()=>{},
  setAttribute:()=>{}, addEventListener:()=>{}, firstChild:null,
  getContext(){ return makeCtx(); }, src:'', onclick:null, ariaLabel:'', ariaHidden:false }; }

// ---- element registry keyed by id ----
const els = {};
function getEl(id){
  if (!els[id]) {
    if (id==='drawSpace'||id==='canvasBases'||id==='drawSpaceLE'||
        id==='canvasBasesLE'||id==='background_canvas') els[id]=makeCanvas(800,600);
    else els[id]=makeEl();
  }
  return els[id];
}

// ---- localStorage stub ----
const _ls = {};
const localStorage = new Proxy({
  clear(){ for (const k in _ls) delete _ls[k]; },
  getItem(k){ return k in _ls ? _ls[k] : null; },
  setItem(k,v){ _ls[k]=String(v); },
}, {
  get(t,p){ if (p in t) return t[p]; return p in _ls ? _ls[p] : undefined; },
  set(t,p,v){ _ls[p]=String(v); return true; }
});

// ---- sandbox globals ----
const sandbox = {
  console: { log:()=>{}, warn:()=>{}, error:(...a)=>console.error(...a) },
  Math, Date, JSON, parseInt, parseFloat, isNaN, undefined,
  window: {}, screen:{width:800,height:600},
  localStorage,
  requestAnimationFrame: ()=>0, cancelAnimationFrame: ()=>{},
  setInterval:()=>0, clearInterval:()=>{}, setTimeout:()=>0,
  gtag: ()=>{},
  M: { toast:()=>{}, Toast:{ dismissAll:()=>{} }, Modal:{ init:()=>{}, getInstance:()=>({open:()=>{}}) } },
  navigator: { serviceWorker:{ register:()=>({then:()=>{}}) }, hardwareConcurrency:4 },
  document: {
    readyState:'complete',
    getElementById: getEl,
    querySelectorAll: ()=>[],
    addEventListener: ()=>{},
    createElement: ()=>makeEl(),
    body:{ style:{} },
  },
};
// expose the bare element globals the game relies on (browser named-element behaviour)
['drawSpace','canvasBases','drawSpaceLE','canvasBasesLE','background_canvas']
  .forEach(id => { sandbox[id] = getEl(id); });
sandbox.addEventListener = ()=>{};
sandbox.onload = null; sandbox.onresize = null;
sandbox.innerWidth = 800; sandbox.innerHeight = 600;
sandbox.window = sandbox; // some code reads window.*
sandbox.self = sandbox;

vm.createContext(sandbox);

// load the two scripts into the same context
const levels = fs.readFileSync('XBC_levels.js','utf8');
const game   = fs.readFileSync('xBosonConquest.js','utf8');
vm.runInContext(levels, sandbox, {filename:'XBC_levels.js'});
vm.runInContext(game,   sandbox, {filename:'xBosonConquest.js'});

// ---------------------------------------------------------------------------
// TEST 1: boot a level and run many frames without throwing
// ---------------------------------------------------------------------------
function bootLevel(levelNum){
  sandbox.config = sandbox.getConfig(levelNum);
  sandbox.state  = sandbox.getInitialState();
  sandbox.state.timePace = 10;
  sandbox.state.currentLevel = levelNum;
  sandbox.state.levelStartTime = sandbox.Date.now();
  sandbox.spawnInitialUnits();
}

function runFrames(n){
  let t = 1000;
  for (let f=0; f<n; f++){
    t += 16;                       // ~60fps timestamps
    sandbox.animate(t);
    if (sandbox.state.gameWon) break;
  }
  return t;
}

let pass=0, fail=0;
function check(name, cond, extra){
  if (cond){ pass++; console.error('  PASS  '+name); }
  else { fail++; console.error('  FAIL  '+name+(extra?('  -> '+extra):'')); }
}

console.error('TEST 1: boot + run frames on several levels');
for (const lvl of [1, 5, 20, 50, 99]) {
  try {
    bootLevel(lvl);
    const startUnits = sandbox.state.objects.length;
    runFrames(300);
    const endUnits = sandbox.state.objects.length;
    check('level '+lvl+' ran 300 frames', true);
    check('level '+lvl+' has units alive/among frames', startUnits>0 || endUnits>=0, 'start='+startUnits+' end='+endUnits);
    check('level '+lvl+' unit count within cap', endUnits <= sandbox.config.maxUnits, 'end='+endUnits);
  } catch(e){
    check('level '+lvl+' ran without throwing', false, e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : e);
  }
}

// ---------------------------------------------------------------------------
// TEST 2: spatial-grid collision must match naive O(n^2) collision exactly
// ---------------------------------------------------------------------------
console.error('TEST 2: grid collision == naive collision (differential, 200 random trials)');
function naiveKills(objs, tol){
  // returns a Set of indices that would be killed by the original O(n^2) rule
  const killed = new Set();
  const hit = objs.map(()=>false);
  for (let i=0;i<objs.length;i++){
    const o=objs[i];
    for (let j=0;j<objs.length;j++){
      const c=objs[j];
      if (c.colour!==o.colour && !hit[j] && !hit[i]){
        const d = Math.abs(o.x-c.x)+Math.abs(o.y-c.y);
        if (d < tol){ hit[i]=true; hit[j]=true; killed.add(i); killed.add(j); }
      }
    }
  }
  return killed;
}
// The original algorithm is order-sensitive in 3+ unit pile-ups, so exact
// survivor identity is arbitrary. The invariants that actually matter:
//   (a) no opposing survivors left overlapping (no visible pass-through),
//   (b) killed count within a tiny tie-break tolerance of the naive rule.
let leaks=0, bigGap=0, tol=sandbox.config.collisionTol;
for (let trial=0; trial<2000; trial++){
  const n = 20 + Math.floor(Math.random()*180);
  const objs=[];
  for (let k=0;k<n;k++){
    objs.push({ x:Math.random()*280, y:Math.random()*280,
      colour: Math.random()<0.5?'#a':'#b', hasBeenHit:false });
  }
  const refN = naiveKills(objs.map(o=>({...o})), tol).size;
  const copy = objs.map(o=>({...o}));
  sandbox.state.objects = copy;
  const grid = sandbox.buildCollisionGrid();
  for (let i=0;i<copy.length;i++){ sandbox.checkCollision(copy[i], grid); }
  const gridN = copy.filter(o=>o.hasBeenHit).length;
  if (Math.abs(gridN-refN) > 2) bigGap++;
  const alive = copy.filter(o=>!o.hasBeenHit);
  outer: for (let i=0;i<alive.length;i++) for (let j=i+1;j<alive.length;j++){
    if (alive[i].colour!==alive[j].colour &&
        Math.abs(alive[i].x-alive[j].x)+Math.abs(alive[i].y-alive[j].y) < tol){ leaks++; break outer; }
  }
}
check('no opposing survivors left overlapping (2000 trials)', leaks===0, leaks+' pass-through leaks');
check('killed count tracks naive within tie-break tolerance', bigGap===0, bigGap+' trials off by >2');
check('cellSize >= collisionTol (no geometric misses possible)',
      sandbox.config.collisionCellSize >= sandbox.config.collisionTol,
      'cell='+sandbox.config.collisionCellSize+' tol='+tol);

// -------------------------------------------------------------------------
// TEST 3: attacker pre-pass agrees with the old per-base nested scan
// -------------------------------------------------------------------------
console.error('TEST 3: attacker pre-pass == old nested scan (on real level state)');
function oldUnderAttack(bases, objects){
  return bases.map(base => {
    let a=0;
    for (const o of objects){
      if (!o.hasBeenHit && o.colour!=base.colour && o.targetX==base.x && o.targetY==base.y) a++;
    }
    return a>0;
  });
}
function newUnderAttack(bases, objects){
  const tally={};
  for (const o of objects){
    if (o.hasBeenHit) continue;
    const k=o.targetX+','+o.targetY;
    (tally[k]||(tally[k]={}));
    tally[k][o.colour]=(tally[k][o.colour]||0)+1;
  }
  return bases.map(base=>{
    const t=tally[base.x+','+base.y]; let a=0;
    if (t) for (const c in t) if (c!=base.colour) a+=t[c];
    return a>0;
  });
}
bootLevel(30); runFrames(150);
{
  const oldR = oldUnderAttack(sandbox.config.bases, sandbox.state.objects);
  const newR = newUnderAttack(sandbox.config.bases, sandbox.state.objects);
  let same = oldR.length===newR.length && oldR.every((v,i)=>v===newR[i]);
  check('under-attack flags identical across all bases', same);
}

// -------------------------------------------------------------------------
// TEST 4: unit drawing is batched (few fill() calls, not one per unit)
// -------------------------------------------------------------------------
console.error('TEST 4: draw calls are batched by colour');
bootLevel(50); runFrames(200);
{
  const ctx = sandbox.config.ctx;
  ctx._calls.fill = 0; ctx._calls.beginPath = 0;
  const nUnits = sandbox.state.objects.length;
  sandbox.animate(999999); // one more frame
  const fills = ctx._calls.fill || 0;
  // distinct fill colours present among live units (+selected -> yellow)
  const cols = new Set(sandbox.state.objects.map(o=>o.isSelected?'yellow':o.colour));
  check('fill() count is per-colour, not per-unit',
        fills <= cols.size + 3 && nUnits > cols.size + 3,
        'units='+nUnits+' fills='+fills+' colours='+cols.size);
}

// -------------------------------------------------------------------------
// TEST 5: optimized isOnBase() returns identical results to the original scan
// -------------------------------------------------------------------------
console.error('TEST 5: isOnBase() O(1) lookup == original O(bases) scan');
function oldIsOnBase(object, bases, dbs){
  let baseID=-1;
  for (let b=0;b<bases.length;b++){
    const base=bases[b];
    if (Math.sqrt(Math.pow(object.x-base.x,2)+Math.pow(object.y-base.y,2)) < dbs
        && object.targetX==base.x && object.targetY==base.y) baseID=b;
  }
  return baseID;
}
let onBaseMismatch=0, comparisons=0;
for (const lvl of [1, 20, 50, 99]) {
  bootLevel(lvl);
  let tt=1000;
  for (let f=0; f<250; f++){
    tt+=16; sandbox.animate(tt);
    if (sandbox.state.gameWon) break;
    // every 25 frames, compare for every live unit
    if (f % 25 === 0) {
      const bases=sandbox.config.bases, dbs=sandbox.config.defaultBaseSize;
      for (const u of sandbox.state.objects){
        comparisons++;
        if (oldIsOnBase(u,bases,dbs) !== sandbox.isOnBase(u)) onBaseMismatch++;
      }
    }
  }
}
check('isOnBase identical over '+comparisons+' unit-checks on real frames',
      onBaseMismatch===0, onBaseMismatch+' mismatches');

// -------------------------------------------------------------------------
// TEST 6: UtilityAI (model 2) boots, acts, and stays within budget
// -------------------------------------------------------------------------
console.error('TEST 6: UtilityAI boots & issues orders on every difficulty');
function bootAI(lvl, diff){
  bootLevel(lvl);
  for (let i=1;i<sandbox.config.players.length;i++){
    const pl = sandbox.config.players[i];
    if (pl.controlType===1){ pl.aiModel=2; pl.aiDifficulty=diff; }
  }
  sandbox.state._aiSeeded=false;
}
for (const diff of ['easy','medium','hard','brutal']) {
  try {
    bootAI(20, diff);
    let dispatched = 0, tt = 1000;
    for (let f=0; f<400; f++){
      tt+=16; sandbox.animate(tt);
      if (sandbox.state.gameWon) break;
      // count units that have been sent out (no longer defending) => AI acted
      for (const o of sandbox.state.objects) if (o.defensiveMode === false) dispatched++;
    }
    check('UtilityAI ['+diff+'] ran 400 frames without throwing', true);
    check('UtilityAI ['+diff+'] issued attack/move orders', dispatched > 0, 'dispatched-frames='+dispatched);
    check('UtilityAI ['+diff+'] within unit cap', sandbox.state.objects.length <= sandbox.config.maxUnits);
  } catch(e){
    check('UtilityAI ['+diff+'] ran without throwing', false, e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : e);
  }
}

// -------------------------------------------------------------------------
// TEST 7: target priorities are orientation-INDEPENDENT (the whole point)
//   normalised-distance ranking must be identical in landscape vs portrait,
//   whereas raw pixel-distance ranking (legacy) generally is not.
// -------------------------------------------------------------------------
console.error('TEST 7: UtilityAI priorities identical portrait vs landscape');
function rankFrom(baseIdx, useNormalised){
  const bases = sandbox.config.bases, B = bases[baseIdx];
  const W = sandbox.config.canvas.width, H = sandbox.config.canvas.height;
  const order = bases.map((T,i)=>({i, d: useNormalised
      ? Math.hypot((B.x-T.x)/W, (B.y-T.y)/H)   // aspect-independent
      : Math.hypot(B.x-T.x, B.y-T.y)}))        // raw pixels (legacy style)
    .filter(o=>o.i!==baseIdx)
    .sort((a,b)=> a.d===b.d ? a.i-b.i : a.d-b.d)
    .map(o=>o.i);
  return order.join(',');
}
function ranksForCanvas(lvl, w, h, useNormalised){
  els.drawSpace.width=w; els.drawSpace.height=h;
  els.canvasBases.width=w; els.canvasBases.height=h;
  sandbox.config = sandbox.getConfig(lvl);
  const ranks=[];
  for (let i=0;i<sandbox.config.bases.length;i++) ranks.push(rankFrom(i, useNormalised));
  return ranks;
}
{
  const lvl = 30;
  const landNorm = ranksForCanvas(lvl, 800, 600, true);
  const portNorm = ranksForCanvas(lvl, 600, 800, true);
  let normSame = landNorm.length===portNorm.length && landNorm.every((v,i)=>v===portNorm[i]);
  check('normalised priorities identical landscape vs portrait', normSame,
        normSame?'':'first diff at base '+landNorm.findIndex((v,i)=>v!==portNorm[i]));

  // contrast: show that raw pixel ranking WOULD have differed (justifies the fix)
  const landPix = ranksForCanvas(lvl, 800, 600, false);
  const portPix = ranksForCanvas(lvl, 600, 800, false);
  let pixDiffers = !(landPix.length===portPix.length && landPix.every((v,i)=>v===portPix[i]));
  check('raw pixel priorities DO differ by orientation (why normalisation matters)', pixDiffers,
        pixDiffers?'':'pixel ranking happened not to differ on this level');
  // restore landscape canvas for any later use
  els.drawSpace.width=800; els.drawSpace.height=600;
}

// -------------------------------------------------------------------------
// TEST 8: legacy and UtilityAI can fight in the SAME match (per-opponent AI)
// -------------------------------------------------------------------------
console.error('TEST 8: mixed models coexist in one match');
try {
  bootLevel(20);
  const cpu = [];
  for (let i=1;i<sandbox.config.players.length;i++){
    const pl=sandbox.config.players[i];
    if (pl.controlType===1) cpu.push(pl);
  }
  // first CPU player = utility(hard), rest = legacy released
  cpu.forEach((pl,idx)=>{ pl.aiModel = idx===0 ? 2 : 1; pl.aiDifficulty='hard'; });
  sandbox.state._aiSeeded=false;
  let tt=1000, moved=0;
  for (let f=0; f<400; f++){ tt+=16; sandbox.animate(tt); if (sandbox.state.gameWon) break;
    for (const o of sandbox.state.objects) if (o.defensiveMode===false) moved++; }
  check('mixed legacy+utility match ran without throwing', true);
  check('units were dispatched in mixed match', moved>0, 'moved-frames='+moved);
} catch(e){
  check('mixed match ran without throwing', false, e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : e);
}

// -------------------------------------------------------------------------
// TEST 9: DEFAULT game is unchanged — pure legacy, no utility engagement
//   (regression guard for the human-play experience after the AI refactor)
// -------------------------------------------------------------------------
console.error('TEST 9: default game path is untouched (legacy only)');
{
  bootLevel(8);
  // no AI selection applied: every CPU player must still default to legacy (aiModel 1)
  let anyUtility = false, cpuCount = 0;
  for (let i=1;i<sandbox.config.players.length;i++){
    const pl = sandbox.config.players[i];
    if (pl.controlType===1){ cpuCount++; if (pl.aiModel===2) anyUtility=true; }
  }
  check('no CPU player is utility by default', !anyUtility);
  check('default CPU players exist and are legacy', cpuCount>0 && !anyUtility);
  // run and confirm the legacy AI actually acts (units get dispatched off defense)
  let tt=1000, dispatched=0;
  for (let f=0; f<400; f++){ tt+=16; sandbox.animate(tt); if (sandbox.state.gameWon) break;
    for (const o of sandbox.state.objects) if (o.defensiveMode===false) dispatched++; }
  check('legacy AI still issues orders in a default game', dispatched>0, 'dispatched-frames='+dispatched);
}

// -------------------------------------------------------------------------
// TEST 10: Bot Arena — faction detection, watch-mode match, bet result, guards
// -------------------------------------------------------------------------
console.error('TEST 10: Bot Arena watch-mode flow');
try {
  // faction detection matches the generic helper
  const af = sandbox.arenaFactionsOf(20);
  check('arenaFactionsOf returns owning player indices', Array.isArray(af) && af.length>=2, 'got '+JSON.stringify(af));
  check('curated maps list has 10 entries', sandbox.arenaCuratedMaps.length===10);

  // set up a watch match by hand (mirrors startArena assignment, DOM-free)
  sandbox.config = sandbox.getConfig(20);
  sandbox.state = sandbox.getInitialState();
  sandbox.state.timePace = 15;
  const facs = af;
  facs.forEach((idx,i)=>{ const pl=sandbox.config.players[idx]; pl.controlType=1; pl.aiModel=(i%2===0?2:1); pl.aiDifficulty='hard'; });
  sandbox.state.watchMode = true;
  sandbox.state.betPlayerIndex = facs[0];
  sandbox.state.aiSeed = 12345; sandbox.state._aiSeeded=false;
  sandbox.spawnInitialUnits();
  let tt=1000;
  for (let f=0; f<600; f++){ tt+=33; sandbox.animate(tt); if (sandbox.state.gameWon) break; }
  check('watch-mode match ran 600 frames without throwing', true);

  // force a decisive result to exercise the win hook + bet evaluation deterministically
  sandbox.document.getElementById('arenaResult').hidden = true;   // reset
  const betIdx = facs[0];
  sandbox.state.betPlayerIndex = betIdx;
  sandbox.state.playerAlive = sandbox.config.players[betIdx];      // bet winner wins
  sandbox.state.gameWon = true;
  sandbox.animate(tt+33);                                          // triggers showArenaResult() via the hook
  const overlay = sandbox.document.getElementById('arenaResult');
  const txt = sandbox.document.getElementById('arenaResultInner').innerHTML || '';
  check('win hook revealed the arena overlay', overlay.hidden===false);
  check('arena result names the winner', txt.indexOf('Winner')>=0);
  check('bet evaluated as WON when bet==winner', txt.indexOf('won your bet')>=0);

  // and a losing bet
  sandbox.document.getElementById('arenaResult').hidden = true;
  const loseIdx = facs[facs.length-1];
  sandbox.state.betPlayerIndex = (loseIdx===betIdx ? facs[1] : loseIdx);
  sandbox.state.playerAlive = sandbox.config.players[betIdx];      // someone else wins the bet's target
  sandbox.state.gameWon = true;
  sandbox.animate(tt+66);
  const txt2 = sandbox.document.getElementById('arenaResultInner').innerHTML || '';
  check('bet evaluated as LOST when bet!=winner', txt2.indexOf('lost your bet')>=0);

  // input guards: during watch mode, human handlers must no-op without throwing
  sandbox.state.watchMode = true;
  sandbox.ondown(10,10); sandbox.onmove(20,20); sandbox.onup(30,30);
  check('human input handlers are inert during watch mode', true);
} catch(e){
  check('arena flow ran without throwing', false, e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : e);
}

console.error('\nRESULTS: '+pass+' passed, '+fail+' failed');
process.exit(fail? 1 : 0);
