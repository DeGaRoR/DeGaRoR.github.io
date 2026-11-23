'use strict';
// Prototype only. Preserve the shadowed-point-light path byte for byte.
function block(count){return `#if ( ${count} > 0 ) && defined( RE_Direct )
 PointLight pointLight;
 for ( int pointIndex = 0; pointIndex < ${count}; pointIndex ++ ) {
  pointLight = pointLights[ pointIndex ];
  getPointLightInfo( pointLight, geometryPosition, directLight );
  RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
 }
#endif
`;}
function chunk(s){const start=s.indexOf('#if ( NUM_POINT_LIGHTS'),end=s.indexOf('#if ( NUM_SPOT_LIGHTS');if(start<0||end<=start)throw Error('Point/spot chunk anchors missing');return s.slice(0,start)+'#if NUM_POINT_LIGHT_SHADOWS == 0\n'+block('NUM_POINT_LIGHTS')+'#else\n'+s.slice(start,end)+'#endif\n'+s.slice(end);}
function expanded(s,uniformBound=false){
 const count=+(s.match(/uniform PointLight pointLights\[\s*(\d+)\s*\]/)?.[1]||0);if(!count)throw Error('No point-light array');
 const decl=s.indexOf('PointLight pointLight;'),spot=s.indexOf('SpotLight spotLight;',decl);if(decl<0||spot<0)throw Error('Expanded loop anchors missing');
 const start=s.lastIndexOf('#if (',decl),end=s.lastIndexOf('#if (',spot),region=s.slice(start,end);
 if(!region.includes('#if defined( USE_SHADOWMAP ) && 0 > 0'))throw Error('Shadowed point lights are outside this prototype');
 if((region.match(/pointLight = pointLights\[\s*\d+\s*\];/g)||[]).length!==count)throw Error('Unrolled point-light count mismatch');
 let source=s.slice(0,start)+block(count)+s.slice(end);
 if(uniformBound){source=source.replace('pointIndex < '+count,'pointIndex < min( '+count+', uPointLightLoopN )').replace(/void main\s*\(\s*\)\s*\{/,m=>'uniform int uPointLightLoopN;\n'+m);if(!source.includes('uniform int uPointLightLoopN;'))throw Error('Missing main declaration');}
 return {source,count};
}
module.exports={chunk,expanded};
