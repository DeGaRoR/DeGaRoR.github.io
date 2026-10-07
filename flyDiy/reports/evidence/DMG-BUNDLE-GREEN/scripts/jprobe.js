const G=window.CAGE_GEAR, E=window.CAGE_ENG, D=window.CAGE_DATUM;
const cs=Math.cos(G.pitch), sn=Math.sin(G.pitch); const rot=p=>[p[0],p[1]*cs-p[2]*sn,p[1]*sn+p[2]*cs];
const units=(E&&E.units||[]).map(u=>{const h=u.prop&&u.prop.hub; const hg=h?rot(h):null; return {kind:u.kind,at:u.at,hub:h,R:u.prop&&u.prop.R, hubOverGround: hg? hg[1]-G.gy:null, discClear: hg? hg[1]-G.gy-u.prop.R:null};});
return {pitch:G.pitch, gy:G.gy, datum:D, contacts:G.contacts.map(c=>({p:c.p,R:c.R, st:c.st&&c.st.kind})), units, propD: window.CAGE_UI.P.cw_propD, propR: window.CAGE_UI.P.propR};
