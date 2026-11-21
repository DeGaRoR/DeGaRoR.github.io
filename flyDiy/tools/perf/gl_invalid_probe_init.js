(()=>{
 const C=__GROUND_BENCH;C.glTrace=[];C.glProbe={scope:'Diagnostic only: checks at resource uploads/render/compile boundaries and suspicious deleted-object queries. No per-draw/per-uniform error polling.',checks:0,deletedQueries:[]};
 const P=C.glProbe,stamp=()=>({t:performance.now(),phase:window.BOOT?.current?.id,state:window.BOOT?.state});
 for(const K of[WebGLRenderingContext,WebGL2RenderingContext]){
  const p=K.prototype,get=p.getError,deletedPrograms=new WeakSet(),deletedShaders=new WeakSet();
  const check=(gl,where,args)=>{P.checks++;const error=get.call(gl);if(error&&C.glTrace.length<12)C.glTrace.push({...stamp(),where,error,args:args?.map(v=>typeof v==='number'||typeof v==='string'||typeof v==='boolean'||v==null?v:{type:v.constructor?.name,length:v.length,bytes:v.byteLength,program:C.nativeIds.get(v)}),stack:new Error().stack});return error;};
  for(const [name,set]of[['deleteProgram',deletedPrograms],['deleteShader',deletedShaders]]){const own=p[name];p[name]=function(v){if(v)set.add(v);return own.apply(this,arguments);};}
  for(const name of['getProgramParameter','getProgramInfoLog','getUniformLocation','getActiveUniform','getActiveAttrib','getShaderParameter','getShaderInfoLog']){const own=p[name];if(!own)continue;p[name]=function(...args){const dead=name.startsWith('getShader')?deletedShaders.has(args[0]):deletedPrograms.has(args[0]);if(dead){const before=check(this,name+':before-deleted-query',args),v=own.apply(this,args),after=check(this,name+':after-deleted-query',args);if(P.deletedQueries.length<24)P.deletedQueries.push({...stamp(),name,program:C.nativeIds.get(args[0]),before,after,stack:new Error().stack});return v;}return own.apply(this,args);};}
  // These infrequent resource calls can produce INVALID_VALUE. Check each
  // boundary so an earlier queued error is not blamed on the upload itself.
  for(const name of['texImage2D','texImage3D','texSubImage2D','texSubImage3D','texStorage2D','texStorage3D','texParameteri','texParameterf','pixelStorei','renderbufferStorage','renderbufferStorageMultisample']){const own=p[name];if(!own)continue;p[name]=function(...args){check(this,name+':before',args);const v=own.apply(this,args);check(this,name+':after',args);return v;};}
  // Track vector array shape mistakes without polling every valid upload.
  for(const [name,width]of[['uniform2fv',2],['uniform3fv',3],['uniform4fv',4],['uniformMatrix2fv',4],['uniformMatrix3fv',9],['uniformMatrix4fv',16]]){const own=p[name];p[name]=function(...args){const values=args[name.startsWith('uniformMatrix')?2:1],bad=values&&values.length%width!==0;if(bad)check(this,name+':before-invalid-shape',args);const v=own.apply(this,args);if(bad)check(this,name+':after-invalid-shape',args);return v;};}
 }
 let renderer;
 Object.defineProperty(window,'FLYDIY_RENDERER',{configurable:true,get:()=>renderer,set:R=>{renderer=R;if(!R||R.__invalidProbe)return;R.__invalidProbe=true;const gl=R.getContext(),get=gl.getError.bind(gl);
  const check=where=>{P.checks++;const error=get();if(error&&C.glTrace.length<12)C.glTrace.push({...stamp(),where,error,stack:new Error().stack});};
  for(const name of['render','compile']){const own=R[name];R[name]=function(...args){check(name+':before');const v=own.apply(this,args);check(name+':after');return v;};}
 }});
})();
