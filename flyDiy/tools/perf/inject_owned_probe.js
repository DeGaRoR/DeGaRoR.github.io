'use strict';
const fs = require('fs');
const [port, origin, file, output] = process.argv.slice(2);
if (!/^http:\/\/localhost:\d+\/$/.test(origin)) throw Error('Exact owned localhost origin required');
(async () => {
 const tabs = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
 const tab = tabs.find(t => t.type === 'page' && t.url.startsWith(origin + 'flyDiy/'));
 if (!tab) throw Error('Owned game tab not found');
 const ws = new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject) => { ws.onopen = resolve; ws.onerror = reject; });
 const evaluate=()=>ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: fs.readFileSync(file,'utf8'), returnByValue: true, awaitPromise: true } }));
 ws.onmessage = event => { const message = JSON.parse(event.data); if(message.id===2){if(message.error)throw Error(JSON.stringify(message.error));evaluate();}if (message.id === 1) { fs.writeFileSync(output,JSON.stringify(message,null,2)); console.log(JSON.stringify(message.result)); ws.close(); } };
 if(process.argv.includes('--foreground'))ws.send(JSON.stringify({id:2,method:'Page.bringToFront'}));else evaluate();
})().catch(e => { console.error(e); process.exitCode = 1; });
