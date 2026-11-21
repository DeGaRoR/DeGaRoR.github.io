'use strict';
// Preview only the two exported diagrams; never serve the private-save directory.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),cp=require('child_process');
const vis=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),files=['loading-measurement-history-preview.html','garage-waterfall-current-preview.html'];
fs.mkdirSync(out,{recursive:true});const sleep=ms=>new Promise(r=>setTimeout(r,ms)),profile=fs.mkdtempSync(path.join(os.tmpdir(),'wingsmith-viz-check-'));
let chrome,ws,server,timer;const errors=[],results=[];
async function run(){
 server=http.createServer((q,r)=>{const file=decodeURIComponent(q.url.split('?')[0]).slice(1);if(!files.includes(file)){r.writeHead(404);r.end();return;}r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync(path.join(vis,file)));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 chrome=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--enable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
 const portFile=path.join(profile,'DevToolsActivePort');for(let n=0;n<100&&!fs.existsSync(portFile);n++)await sleep(100);const port=+fs.readFileSync(portFile,'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
 ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let seq=0;const pending=new Map(),contexts=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data),session=m.sessionId;if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Target.attachedToTarget'){cmd('Runtime.enable',{},m.params.sessionId).catch(e=>errors.push(String(e)));}else if(m.method==='Runtime.executionContextCreated')contexts.set((session||'')+':'+m.params.context.id,{id:m.params.context.id,session});else if(m.method==='Runtime.executionContextDestroyed')contexts.delete((session||'')+':'+m.params.executionContextId);else if(m.method==='Runtime.executionContextsCleared'){for(const [key,c]of contexts)if(c.session===session)contexts.delete(key);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
 const cmd=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const evaluate=async(expression,context)=>{const v=await cmd('Runtime.evaluate',{expression,contextId:context.id,returnByValue:true,awaitPromise:true},context.session);if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result?.value;};
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"window.__VIZ_ERRORS=[];addEventListener('viz-error',e=>__VIZ_ERRORS.push(e.detail?.message||String(e.detail)),true);"});
 for(const file of files){
  await cmd('Emulation.setDeviceMetricsOverride',{width:1024,height:1600,deviceScaleFactor:1,mobile:false});await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'+file});let context;
  for(let n=0;n<100&&!context;n++){for(const c of contexts.values())try{if(await evaluate("!!document.querySelector('section select:not(:disabled)')",c)){context=c;break;}}catch(_){}if(!context)await sleep(200);}
  if(!context)throw Error('Diagram failed to initialise '+file);
  await evaluate("window.__VIZ_ERRORS ||= [];addEventListener('viz-error',e=>__VIZ_ERRORS.push(e.detail?.message||String(e.detail)),true);true",context);
  for(const width of [1024,320]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height:1600,deviceScaleFactor:1,mobile:false});await evaluate("document.fonts.ready.then(()=>true)",context);await sleep(1000);
   const check=await evaluate(`(()=>{const root=document.querySelector('section'),s=root.querySelector('select');const scan=e=>{let t=e.textContent||'';for(const n of e.querySelectorAll('*'))if(n.shadowRoot)t+=scan(n.shadowRoot);return t;};return{width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,options:s.options.length,errors:window.__VIZ_ERRORS||[],invalid:/Invalid chart|requires style decimal|Error rendering/.test(scan(root)),hiddenLeak:[...root.querySelectorAll('viz-waterfall[hidden]')].some(e=>getComputedStyle(e).display!=='none')};})()`,context);
   if(check.invalid||check.hiddenLeak||check.errors.length||check.scrollWidth>check.width+2)throw Error('Invalid diagram '+file+' '+width+': '+JSON.stringify(check));
   if(width===1024){const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,file.replace('-preview.html','.png')),Buffer.from(shot.data,'base64'));}
   await evaluate("(()=>{const s=document.querySelector('section select');s.selectedIndex=s.options.length-1;s.dispatchEvent(new Event('change',{bubbles:true}));return s.value;})()",context);await sleep(600);
   const changed=await evaluate("({value:document.querySelector('section select').value,errors:window.__VIZ_ERRORS||[]})",context);if(changed.errors.length)throw Error('Updated diagram error '+JSON.stringify(changed));results.push({file,width,initial:check,changed});
  }
 }
 if(errors.length)throw Error('Browser exceptions '+errors.join('\n'));
}
(async()=>{try{await Promise.race([run(),new Promise((_,j)=>{timer=setTimeout(()=>j(Error('Preview deadline')),60000);})]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:true,results},null,2));console.log('Both diagrams:1024/320px, initial and changed selections passed.');}catch(e){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:false,error:String(e),errors,results},null,2));console.error(e);process.exitCode=1;}finally{clearTimeout(timer);if(ws)ws.close();if(chrome&&chrome.exitCode===null)try{cp.execFileSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{stdio:'ignore'});}catch(_){}server?.close();}})();
