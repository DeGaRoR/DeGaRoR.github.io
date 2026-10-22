// injects a patched flight_core into require.cache: per-stage body-pitch moment budget (out.mb)
const fs = require('fs'), path = require('path'), Module = require('module');
const F = '/home/user/DeGaRoR.github.io/flyDiy/tools/flight_core.js';
let s = fs.readFileSync(F, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('patch miss: ' + a.slice(0, 60)); s = s.replace(a, b); };
// helpers inside makeSim scope: inserted at substep's head
rep('  function substep(dt) {', `  function _cgv(o){let x=0,y=0,z=0;for(let i=0;i<n;i++){x+=p[i*3]*m[i];y+=p[i*3+1]*m[i];z+=p[i*3+2]*m[i];}o[0]=x/totalM;o[1]=y/totalM;o[2]=z/totalM;return o;}
  const _c=[0,0,0];
  function _mom(){_cgv(_c);let M=0;for(let i=0;i<n;i++){const rx=p[i*3]-_c[0],ry=p[i*3+1]-_c[1],rz=p[i*3+2]-_c[2];const fx=f[i*3],fy=f[i*3+1]-G*m[i],fz=f[i*3+2];M+=(ry*fz-rz*fy)*zRt[0]+(rz*fx-rx*fz)*zRt[1]+(rx*fy-ry*fx)*zRt[2];}return M;}
  function _L(){_cgv(_c);let vx=0,vy=0,vz=0;for(let i=0;i<n;i++){vx+=v[i*3]*m[i];vy+=v[i*3+1]*m[i];vz+=v[i*3+2]*m[i];}vx/=totalM;vy/=totalM;vz/=totalM;let L=0;for(let i=0;i<n;i++){const rx=p[i*3]-_c[0],ry=p[i*3+1]-_c[1],rz=p[i*3+2]-_c[2];const ux=(v[i*3]-vx)*m[i],uy=(v[i*3+1]-vy)*m[i],uz=(v[i*3+2]-vz)*m[i];L+=(ry*uz-rz*uy)*zRt[0]+(rz*ux-rx*uz)*zRt[1]+(rx*uy-ry*ux)*zRt[2];}return L;}
  const MB={bF:0,bA:0,alB:0,alB2:0,nB:0,pre:0,str:0,k_wing:0,k_stab:0,k_fin:0,k_vtail:0,k_wingL:0,k_wingR:0,aero:0,beams:0,rest:0,damp:0,proj:0,n:0,Lend:0};
  function substep(dt) {`);
rep('    aeroPass(false);\n', '    _cgv(_c); MB._agg=true;\n    aeroPass(false);\n    MB._agg=false;\n    const _mA=_mom(); MB.aero+=_mA; MB.n++; MB.post=(MB.post||0)+_mA-MB._m1;\n');
rep('    const dp = Math.max(0, 1 - DEFDAMP * dt);', `    const _mT=_mom(); MB.rest+=_mT-_mA;
    MB._L0=_L(); MB._mT=_mT;
    const dp = Math.max(0, 1 - DEFDAMP * dt);`);
rep('    for (const C of clusters) { if (C.off) continue; shapeMatch(C, dt); twistHold(C, dt); }', `    { const L2=_L(); MB.damp+=(L2-MB._L0)/dt-MB._mT; }
    { const La=_L(); for (const C of clusters) { if (C.off) continue; shapeMatch(C, dt); twistHold(C, dt); } MB.proj+=(_L()-La)/dt; MB.Lend=_L(); }`);
rep('      out.aeroFy += Fy;', '      out.aeroFy += Fy;\n      if (MB._agg) { const rx=spx-_c[0],ry=spy-_c[1],rz=spz-_c[2]; const mm=(ry*Fz-rz*Fy)*zRt[0]+(rz*Fx-rx*Fz)*zRt[1]+(rx*Fy-ry*Fx)*zRt[2]; MB["k_"+st.kind]+=mm; if (st.kind==="wing") MB[st.side<0?"k_wingL":"k_wingR"]+=mm; }');
rep('    out.aeroFy = 0; out.wingFy = 0; out.stabFy = 0;', '    if (MB._agg) MB._m0 = _mom();\n    out.aeroFy = 0; out.wingFy = 0; out.stabFy = 0;');
rep('    // fuselage blobs: anisotropic CdA in body axes', '    if (MB._agg) { const m1 = _mom(); MB.pre += MB._m0; MB.str += m1 - MB._m0; MB._m1 = m1; }\n    // fuselage blobs: anisotropic CdA in body axes');
rep('    blob(def.refs.fusDrag,    P_.fusCdA);\n    blob(def.refs.fusDragAft, P_.fusCdAAft);', '    { const a0 = MB._agg ? _mom() : 0; blob(def.refs.fusDrag,    P_.fusCdA); const a1 = MB._agg ? _mom() : 0;\n    blob(def.refs.fusDragAft, P_.fusCdAAft); if (MB._agg) { const a2 = _mom(); MB.bF += a1 - a0; MB.bA += a2 - a1; } }');
rep('        const alB = Math.atan2(wn, u);', '        const alB = Math.atan2(wn, u); if (MB._agg) { MB.alB += alB; MB.alB2 += alB*alB; MB.nB++; }');
// expose
rep('           snap, unsnap,', '           snap, unsnap, MB,');
const mod = new Module(F, null); mod.filename = F; mod.paths = Module._nodeModulePaths(path.dirname(F));
mod._compile(s, F); require.cache[F] = mod; mod.loaded = true;
