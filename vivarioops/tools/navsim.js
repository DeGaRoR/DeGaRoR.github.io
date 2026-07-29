// tools/navsim.js — diagnostic, not a gate assertion.
// Drives trunk/nav.js against a stubbed DOM and a real back/forward history stack.
// Not in the gate because it must overwrite globalThis.document and history, which
// would be wrong in the browser where the dev panel runs the gate. Re-run it
// whenever nav.js changes: `npm run navsim`, or `HASH='#/world/compile' npm run navsim`.

// Throwaway: stub just enough DOM + History to drive trunk/nav.js.
const mkEl = (id='') => { const e={ id, children:[], dataset:{}, hidden:false, innerHTML:'', textContent:'',
  className:'', append(...c){this.children.push(...c);}, querySelector(s){ return s==='#screen'?screenEl:s==='#overlay'?overlayEl:null; },
  addEventListener(){}, setAttribute(){}, removeAttribute(){} }; return e; };
const screenEl = mkEl('screen'), overlayEl = mkEl('overlay'), hostEl = mkEl('app');
globalThis.document = { createElement: () => mkEl(), title:'' };

// A real back/forward stack.
const H = { entries:[], i:-1 };
globalThis.history = {
  get state(){ return H.entries[H.i]?.state ?? null; },
  pushState(s,_,url){ H.entries.length = H.i+1; H.entries.push({state:s,url}); H.i++; },
  replaceState(s,_,url){ if(H.i<0){H.entries.push({state:s,url});H.i=0;} else H.entries[H.i]={state:s,url}; },
  back(){ if(H.i>0){ H.i--; fire(); } else H.exited = true; },
  forward(){ if(H.i<H.entries.length-1){ H.i++; fire(); } },
};
let popHandler = null;
globalThis.addEventListener = (t,fn) => { if(t==='popstate') popHandler = fn; };
const fire = () => popHandler && popHandler({ state: history.state });
globalThis.location = { hash: process.env.HASH || '' };

const nav = await import('../trunk/nav.js');
const mk = (id) => ({ title:id, mount:(el)=>{ el.dataset.screen=id; return id; } });
for (const s of ['tank','atlas','world','settings','dev','compile']) nav.register(s, mk(s));
nav.register('sheet', { title:'sheet', kind:'modal', mount:(el)=>{ el.dataset.screen='sheet'; return 'sheet'; } });

const at = () => `${nav.currentTab()}/${nav.current().screen}`;
const log = [];
const step = (label, fn) => { fn(); log.push(`${label.padEnd(34)} -> ${at()}  [hist ${H.i+1}/${H.entries.length}]`); };

nav.start(hostEl);
log.push(`boot (hash="${globalThis.location.hash}")`.padEnd(34) + ` -> ${at()}  [hist ${H.i+1}/${H.entries.length}]`);
step('goTab(world)',        () => nav.goTab('world'));
step('push(compile)',       () => nav.push('compile'));
step('push(sheet) [modal]', () => nav.push('sheet'));
step('back  (dismiss sheet)',() => nav.pop());
step('back  (leave compile)',() => nav.pop());
step('goTab(atlas)',        () => nav.goTab('atlas'));
step('back',                () => nav.pop());
step('back',                () => nav.pop());
step('back',                () => nav.pop());
step('forward',             () => history.forward());
console.log(log.join('\n'));
console.log('exited app on back past root:', !!H.exited);
console.log('atlas stack preserved after leaving+returning:', nav._internals.stacks.atlas.length);
