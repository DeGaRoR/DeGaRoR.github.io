'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync(process.env.PACK_SOURCE||path.join(__dirname,'../src/viewer/house_tarr.js'),'utf8');
const a=s.indexOf('    function packOff(px, A, N) {'),b=s.indexOf('    // ---- the materials',a);
assert(a>0&&b>a);
async function check(failedFetch){
  let draws=0,fetches=0,posts=0,revoked=0,terminated=0;
  const image={id:17,width:8,height:8,src:failedFetch?'map.jpg':'',naturalWidth:failedFetch?2:8,naturalHeight:failedFetch?2:8};
  const stats={},mk=[];
  class FakeWorker {
    terminate(){terminated++;}
    postMessage(m,transfer){posts++;assert.strictEqual(new Set(transfer).size,transfer.length,'no duplicate transfers');
      const received=structuredClone(m,{transfer});assert.strictEqual(received.A[0].buffer,received.N[0][0].buffer,'one prepared input shared across roles');
      assert.strictEqual(received.N[0][0].buffer,received.N[1][1].buffer);
      queueMicrotask(()=>this.onmessage({data:{dA:new Uint8Array([17]),dN:new Uint8Array([17])}}));
    }
  }
  const c={stats,window:{location:{search:''}},Worker:FakeWorker,OffscreenCanvas:function(){},createImageBitmap(){},Blob,
    URL:{createObjectURL:()=> 'worker:test',revokeObjectURL(){revoked++;}},document:{},setTimeout,ArrayBuffer,
    now:()=>0,console,PACK_WORKER_SRC:()=>'',packStack:()=>{throw Error('unexpected page fallback');},
    packDrawer:()=>x=>{draws++;return new Uint8ClampedArray([x.id,2,3,255]);},
    fetch:async()=>{fetches++;throw Error('fetch fails once; shared page fallback');}};
  vm.createContext(c);vm.runInContext(s.slice(a,b)+';this.pack=packOff;',c);
  const r=await c.pack(4,[image],[[image,null],[null,image]]);
  assert.strictEqual(draws,1,'same map resized once across all three roles');assert.strictEqual(stats.marks.shared,2);
  assert.strictEqual(fetches,failedFetch?1:0);assert.strictEqual(posts,1);assert.strictEqual(revoked,1);assert.strictEqual(terminated,1);assert.strictEqual(r.dA[0],17);
  await c.pack(4,[image],[[image,null],[null,image]]);assert.strictEqual(draws,2,'no stale cache across separate packs');
}
(async()=>{await check(false);await check(true);console.log('GATE PACKINPUTS: PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
