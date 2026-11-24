(() => {
 const C = __GROUND_BENCH;
 if (C.drawProbe) return 'already installed';
 C.drawProbe = { scope: 'Passive draw/buffer/multi-draw argument validation; no additional error/readiness polling.', calls: 0 };
 const report = (name, args, reason) => { if (C.glTrace.length < 12) C.glTrace.push({ t: performance.now(), phase: window.BOOT?.current?.id, where: 'invalid-draw-arguments:' + name, reason, args: args.map(v => typeof v === 'number' || v == null ? v : { type: v.constructor?.name, length: v.length, bytes: v.byteLength }), stack: new Error().stack }); };
 const multi = extension => {
  if (!extension || extension.__passiveDraw) return extension;
  extension.__passiveDraw = true;
  for (const name of ['multiDrawArraysWEBGL','multiDrawElementsWEBGL','multiDrawArraysInstancedWEBGL','multiDrawElementsInstancedWEBGL']) {
   const own = extension[name]; if (!own) continue;
   extension[name] = function (...a) {
    const elements = name.includes('Elements'), instanced = name.includes('Instanced'), n = a[a.length - 1];
    const lists = elements ? [[a[1],a[2]],[a[4],a[5]]] : [[a[1],a[2]],[a[3],a[4]]];
    if (instanced) lists.push(elements ? [a[6],a[7]] : [a[5],a[6]]);
    let bad = n < 0;
    for (const [list,offset] of lists) { if (!list || offset < 0 || offset + n > list.length) { bad = true; break; } for (let i = offset; i < offset + n; i++) if (list[i] < 0) { bad = true; break; } }
    const v = own.apply(this,a); C.drawProbe.calls++;
    if (bad) report(name,a,'Negative draw value or active list range outside its array');
    return v;
   };
  }
  return extension;
 };
 for (const K of [WebGLRenderingContext,WebGL2RenderingContext]) {
  const p = K.prototype;
  for (const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','bufferData','bufferSubData']) {
   const own = p[name]; if (!own) continue;
   p[name] = function (...a) {
    let bad = false;
    if (name.startsWith('drawArrays')) bad = a[1] < 0 || a[2] < 0 || (name.endsWith('Instanced') && a[3] < 0);
    else if (name.startsWith('drawElements')) bad = a[1] < 0 || a[3] < 0 || (name.endsWith('Instanced') && a[4] < 0);
    else if (name === 'bufferSubData') bad = a[1] < 0 || (a.length > 3 && (a[3] < 0 || (a[4] > 0 && a[3] + a[4] > a[2]?.length)));
    else if (typeof a[1] === 'number') bad = a[1] < 0;
    const v = own.apply(this,a); C.drawProbe.calls++;
    if (bad) report(name,a,'Negative count/offset or source range outside buffer');
    return v;
   };
  }
  const get = p.getExtension;
  p.getExtension = function (...a) { const extension = get.apply(this,a); return a[0] === 'WEBGL_multi_draw' ? multi(extension) : extension; };
 }
 // Reuse the renderer's already-acquired extension; this adds no GL query.
 multi(FLYDIY_RENDERER.extensions.get('WEBGL_multi_draw'));
 return 'installed';
})()
