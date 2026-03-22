# PTIS Headless Test Runner — Instructions for Claude

## Prerequisites

The user will upload `processThis.html` (a single-file browser app ~29k lines). Copy it to `/home/claude/processThis.html` before running.

## How It Works

The app is a single HTML file containing `<script>` blocks with all logic, including a built-in test suite. The function `runTests()` executes all tests and returns `{ tests, passed, failed }`. Tests use a `TestCtx` harness with `t.place()`, `t.wire()`, `t.solve()`, `t.assertClose()`, `t.assertOK()`.

The app targets a browser DOM. To run headlessly in Node.js, we extract all `<script>` blocks, provide a mock DOM environment, and execute in a `vm` sandbox.

## The Command

```bash
cd /home/claude && timeout 90 node --max-old-space-size=2048 -e "
const fs=require('fs'),vm=require('vm');let src=fs.readFileSync('processThis.html','utf8');
const scripts=[];const re=/<script[^>]*>([\s\S]*?)<\/script>/gi;let m;
while((m=re.exec(src))!==null)scripts.push(m[1]);let code=scripts.join(';\n');
code=code.replace(/^\s*loadDemo\(\);/gm,'').replace(/^\s*initCanvas\(\);/gm,'');
const noop=function(){};
const mockEl=function(){return{style:new Proxy({},{set:()=>true,get:()=>''}),classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},dataset:{},children:[],childNodes:[],innerHTML:'',outerHTML:'',textContent:'',innerText:'',value:'',id:'',className:'',tagName:'DIV',nodeName:'DIV',nodeType:1,checked:false,disabled:false,hidden:false,selected:false,scrollTop:0,scrollLeft:0,offsetWidth:100,offsetHeight:100,scrollWidth:100,scrollHeight:100,clientWidth:100,clientHeight:100,appendChild:function(c){return c||mockEl();},removeChild:function(c){return c||mockEl();},insertBefore:function(n){return n||mockEl();},append:noop,prepend:noop,remove:noop,replaceWith:noop,replaceChildren:noop,cloneNode:function(){return mockEl();},addEventListener:noop,removeEventListener:noop,setAttribute:noop,removeAttribute:noop,getAttribute:function(){return null;},hasAttribute:function(){return false;},querySelectorAll:function(){return[];},querySelector:function(){return null;},closest:function(){return null;},matches:function(){return false;},contains:function(){return false;},getBoundingClientRect:function(){return{top:0,left:0,right:100,bottom:100,width:100,height:100,x:0,y:0};},getContext:function(){return new Proxy({canvas:{width:100,height:100}},{get:(t,p)=>{if(p==='canvas')return t.canvas;return()=>({addColorStop:noop,width:10});}});},focus:noop,blur:noop,click:noop,scrollTo:noop,scroll:noop,dispatchEvent:noop,setPointerCapture:noop,releasePointerCapture:noop,parentNode:null,parentElement:null,firstChild:null,lastChild:null,nextSibling:null,previousSibling:null,nextElementSibling:null,previousElementSibling:null,ownerDocument:null,animate:function(){return{finished:Promise.resolve()};},};};
const ctx=vm.createContext({console,setTimeout,clearTimeout,setInterval,clearInterval,Math,Date,JSON,RegExp,Error,TypeError,RangeError,SyntaxError,URIError,Array,Object,String,Number,Boolean,Map,Set,WeakMap,WeakSet,WeakRef,Symbol,BigInt,Promise,Proxy,Reflect,parseInt,parseFloat,isNaN,isFinite,NaN,Infinity,undefined,encodeURIComponent,decodeURIComponent,encodeURI,decodeURI,btoa,atob,URL,URLSearchParams,TextEncoder,TextDecoder,queueMicrotask:(fn)=>Promise.resolve().then(fn),structuredClone,Float32Array,Float64Array,Int8Array,Int16Array,Int32Array,Uint8Array,Uint16Array,Uint32Array,DataView,ArrayBuffer});
vm.runInContext('const noop='+noop.toString()+';const mockEl='+mockEl.toString()+';this.window=this;this.self=this;this.globalThis=this;this.addEventListener=noop;this.removeEventListener=noop;this.requestAnimationFrame=function(fn){fn();return 1;};this.cancelAnimationFrame=noop;this.matchMedia=()=>({matches:false,addEventListener:noop,removeEventListener:noop});this.getComputedStyle=()=>new Proxy({},{get:()=>\"\"});this.innerWidth=1920;this.innerHeight=1080;this.devicePixelRatio=1;this.screen={width:1920,height:1080};this.performance={now:()=>Date.now()};this.navigator={userAgent:\"node\",clipboard:{writeText:()=>Promise.resolve()},platform:\"Linux\"};this.localStorage={getItem:()=>null,setItem:noop,removeItem:noop};this.sessionStorage={getItem:()=>null,setItem:noop,removeItem:noop};this.fetch=()=>Promise.resolve({ok:true,json:()=>({}),text:()=>\"\"});this.alert=noop;this.confirm=()=>true;this.prompt=()=>\"\";this.open=noop;this.close=noop;this.CSS={supports:()=>false};this.HTMLElement=class{};this.HTMLCanvasElement=class{};this.SVGElement=class{};this.ResizeObserver=class{observe(){}disconnect(){}unobserve(){}};this.MutationObserver=class{observe(){}disconnect(){}};this.IntersectionObserver=class{observe(){}disconnect(){}};this.customElements={define:noop,get:()=>null};this.DOMParser=class{parseFromString(){return{querySelector:()=>null,querySelectorAll:()=>[]};}};this.Blob=class{constructor(p,o){this.size=0;this.type=o?.type||\"\";}};this.FileReader=class{readAsText(){}readAsDataURL(){}addEventListener(){}};this.Image=class{set src(v){}addEventListener(){}};this.Event=class{constructor(t){this.type=t;}preventDefault(){}stopPropagation(){}};this.CustomEvent=class{constructor(t,d){this.type=t;this.detail=d?.detail;}preventDefault(){}stopPropagation(){}};this.KeyboardEvent=class{constructor(t,d){Object.assign(this,d||{});this.type=t;}preventDefault(){}stopPropagation(){}};this.MouseEvent=class{constructor(t,d){Object.assign(this,d||{});this.type=t;}preventDefault(){}stopPropagation(){}};this.PointerEvent=class{constructor(t,d){Object.assign(this,d||{});this.type=t;}preventDefault(){}stopPropagation(){}};this.WheelEvent=class{constructor(t,d){Object.assign(this,d||{});this.type=t;}preventDefault(){}stopPropagation(){}};this.DragEvent=class{constructor(t,d){Object.assign(this,d||{});this.type=t;this.dataTransfer={getData:()=>\"\",setData:noop};}preventDefault(){}stopPropagation(){}};this.ClipboardEvent=class{constructor(t){this.type=t;}preventDefault(){}stopPropagation(){}};this.InputEvent=class{constructor(t){this.type=t;}preventDefault(){}stopPropagation(){}};this.document={createElement:()=>mockEl(),createElementNS:()=>mockEl(),body:mockEl(),head:mockEl(),documentElement:mockEl(),getElementById:()=>mockEl(),querySelector:()=>mockEl(),querySelectorAll:()=>[],getElementsByClassName:()=>[],getElementsByTagName:()=>[],getElementsByName:()=>[],addEventListener:noop,removeEventListener:noop,createTextNode:()=>mockEl(),createComment:()=>mockEl(),createDocumentFragment:()=>mockEl(),createRange:()=>({selectNodeContents:noop,collapse:noop,setStart:noop,setEnd:noop,createContextualFragment:()=>mockEl()}),getSelection:()=>({removeAllRanges:noop,addRange:noop,toString:()=>\"\"}),execCommand:()=>false,hasFocus:()=>true,hidden:false,visibilityState:\"visible\",readyState:\"complete\",cookie:\"\",title:\"\",activeElement:mockEl(),};',ctx);
try{vm.runInContext(code,ctx,{timeout:60000});const r=ctx.runTests();console.log(JSON.stringify({tests:r.tests||r.total,passed:r.passed,failed:r.failed}));}catch(e){console.log('Error:',String(e.message).substring(0,500));}
" 2>&1 | tail -10
```

## Reading Output

**Success:** `✓ 272/272 tests passed  1710/1710 checks passed` followed by JSON `{"tests":272,"passed":1710,"failed":0}`

**Failure:** Failed tests print a table showing calculated vs reference values. The JSON will show `"failed": N`. Look at the table rows with `✗` to identify the broken assertion.

**Crash:** If the mock DOM is missing a method the new code needs, you'll get a `TypeError: X is not a function`. Fix by adding the missing method to `mockEl` or the global context setup. This is rare — the mock covers all APIs used as of v11.0.2.

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot read properties of undefined` | New code accesses a DOM API not in mock | Add method to `mockEl` or global context |
| `loadDemo is not defined` | The regex strip missed a call | The command already handles this with `.replace()` |
| Timeout (>60s) | Infinite loop in solver or test | Check last test output before timeout |
| Tests pass but count drops | A test was deleted or renamed | Compare `tests` count to expected (272 as of v11.0.2) |

## Tail Options

- `tail -10` shows pass/fail summary only
- `tail -30` shows the last few test tables (useful when debugging failures)
- Remove `| tail` entirely to see all output (very verbose — hundreds of test tables)

## After Code Changes

1. Make edits to `/home/claude/processThis.html`
2. Run the command above
3. Verify all tests pass and count hasn't dropped
4. Copy to outputs: `cp /home/claude/processThis.html /mnt/user-data/outputs/processThis.html`

## Key Facts

- As of v11.0.2: **272 tests, 1710 assertions**
- Test suite is defined inside `function runTests()` near end of file (~line 20700+)
- Tests are numbered T1–T283 (some numbers retired/skipped)
- `t.place()` bypasses `Scene.connect()` validation — `t.wire()` pushes directly to `scene.connections`
- Tests that need `Scene.connect()` validation must call it explicitly (see T269, T278)
