'use strict';
// Preserve full failed-link diagnostics. Let performance tests opt out of
// fetching shader warning logs for an already successfully linked program.
function patchShaderLogs(source) {
 const needle='if ( renderer.debug.checkShaderErrors ) {';
 if(source.includes('renderer.debug.checkShaderWarnings')||source.split(needle).length!==2)
  throw Error('Three first-use diagnostics changed/already patched; review shader-log patch');
 return source.replace(needle,'if ( renderer.debug.checkShaderErrors && ( renderer.debug.checkShaderWarnings !== false || gl.getProgramParameter( program, gl.LINK_STATUS ) === false ) ) {');
}
module.exports={patchShaderLogs};
