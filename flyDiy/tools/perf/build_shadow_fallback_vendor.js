'use strict';
// WebGL-only rebuild for the GPU regression check; never writes to dependencies.
const fs=require('fs'),path=require('path'),{patchShadowArray}=require('../three_shadow_fallback');
const root=path.resolve(__dirname,'../..'),deps=process.env.FLYDIY_NODE_MODULES||path.join(root,'node_modules');
const esbuild=require(path.join(deps,'esbuild')),pkg=JSON.parse(fs.readFileSync(path.join(deps,'three/package.json')));
if(pkg.version!=='0.186.0')throw Error('Review patch for three '+pkg.version);
const moduleFile=path.join(deps,'three/build/three.module.js');
esbuild.buildSync({stdin:{contents:patchShadowArray(fs.readFileSync(moduleFile,'utf8')),resolveDir:path.dirname(moduleFile),sourcefile:'three.module.js',loader:'js'},
 bundle:true,format:'iife',globalName:'THREE',minify:true,legalComments:'none',logLevel:'error',
 banner:{js:'// three.js r186 (npm three@0.186.0) — MIT, © 2010-2026 three.js authors.\n// Generated with Wingsmith shadow-array fallback fix; see tools/three_shadow_fallback.js.'},
 footer:{js:"if (typeof module !== 'undefined' && module.exports) module.exports = THREE;"},outfile:path.join(root,'vendor/three.min.js')});
const T=require(path.join(root,'vendor/three.min.js'));if(String(T.REVISION)!=='186'||!T.ColorManagement.enabled)throw Error('Vendor exports changed');
console.log('Built patched WebGL vendor: r186, managed colour; dependency files untouched.');
