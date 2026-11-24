'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),{patchShaderLogs}=require('./three_shader_logs');
const deps=process.env.FLYDIY_NODE_MODULES||path.resolve(__dirname,'../node_modules');
const original=fs.readFileSync(path.join(deps,'three/build/three.module.js'),'utf8'),patched=patchShaderLogs(original);
assert.throws(()=>patchShaderLogs(patched));
const start=patched.indexOf('function onFirstUse( self ) {')+'function onFirstUse( self ) {'.length;
const end=patched.indexOf('// Clean up',start),body=patched.slice(start,end);
for(const [linked,warnings,expectedLogs,expectedErrors]of[[true,false,0,0],[false,false,3,1],[true,undefined,3,0],[false,undefined,3,1]]){
 let logs=0,errors=0;
 const context={renderer:{debug:{checkShaderErrors:true,checkShaderWarnings:warnings,onShaderError(){errors++;}}},
  gl:{LINK_STATUS:1,getProgramParameter(){return linked;},getProgramInfoLog(){logs++;return '';},getShaderInfoLog(){logs++;return '';}},
  program:{},glVertexShader:{},glFragmentShader:{},prefixVertex:'',prefixFragment:'',self:{},warn(){},error(){}};
 vm.runInNewContext('(function(self){'+body+'})(self)',context);
 assert.strictEqual(logs,expectedLogs);assert.strictEqual(errors,expectedErrors);
 if(!linked)assert.strictEqual(context.self.diagnostics.runnable,false);
}
console.log('Shader log policy: PASS (successful opt-out, failed-link diagnostics retained, default unchanged).');
