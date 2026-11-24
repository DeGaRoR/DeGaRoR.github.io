'use strict';
// three r186 initializes comparison mode for a missing single shadow map,
// but omits it for a missing shadow-map array. Invalid warm-up draws follow.
// Patch only that fallback; real shadow maps and all shader sources are unchanged.
function patchShadowArray(source) {
  const start=source.indexOf('function setValueT1Array( gl, v, textures ) {');
  const end=source.indexOf('function setValueT3DArray(',start);
  if(start<0||end<start)throw Error('Three shadow-array setter changed: review vendor patch');
  const section=source.slice(start,end),needle='\t\temptyTexture2D = emptyShadowTexture;';
  if(section.includes('emptyShadowTexture.compareFunction')||section.split(needle).length!==2)
    throw Error('Three shadow-array fallback changed or already fixed: review vendor patch');
  const replacement='\t\t// Wingsmith: shadow sampler arrays need the same valid fallback as single samplers.\n'
    +'\t\tconst compare = textures.isReversedDepthBuffer() ? GreaterEqualCompare : LessEqualCompare;\n'
    +'\t\tif ( emptyShadowTexture.compareFunction !== compare ) {\n'
    +'\t\t\temptyShadowTexture.compareFunction = compare;\n'
    +'\t\t\temptyShadowTexture.needsUpdate = true;\n'
    +'\t\t}\n\n'+needle;
  return source.slice(0,start)+section.replace(needle,replacement)+source.slice(end);
}
module.exports={patchShadowArray};
