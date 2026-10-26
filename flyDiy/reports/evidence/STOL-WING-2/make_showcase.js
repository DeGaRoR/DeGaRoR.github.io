// writes tools/fixtures/stol_cub_showcase.json from the user's Cub (builds/cub_2026-09-20_corrected.json)
const T='/home/user/DeGaRoR.github.io/flyDiy/tools';const fs=require('fs');
const {envOf}=require('./showcase.js');
const env=envOf({cage:{wgSlat:1,wgSlatSpan:1,wgVG:1,wgTip:7,wgDroop:1,
  s1R:0.39,whProfile:1,whTread:2,whBulge:1.2,stHinge:0.45,stSpan:1.7},eng:'rotax 915 iS'});
const RED=0xB3202A, WHITE=0xF2F0EA, BLACK=0x161616;
env.name='STOL Cub';
env.note='G2829 (STOL-WING-2): the showcase STOL Cub - the user\'s Cub (builds/cub_2026-09-20_corrected.json) with the STOL kit (full-span fixed slot, VGs, drooped tips, ailerons drooped 10 deg), a Rotax 915 iS, 31-inch tundra tyres, a 45 % elevator on a 20 % wider stab, and a new paint job. Every change is an editor row in spec.cage.';
delete env.plaque; delete env.log;
const S=env.spec;
S.meta=Object.assign({},S.meta,{name:'STOL Cub',reg:'F-STOL'});
S.paint=Object.assign({},S.paint,{job:'full',base:RED,trim:BLACK,gloss:0.55});
const F=S.finish; const sec=F.sections;
for(const k of ['body','ceilingLoop','pillarFront','pillarCabin','floorLoop','pillarWindow','pillarPassenger','pillarTail','finRud']) sec[k]={tint:RED};
sec.gearLeg={tint:BLACK}; sec.waistband={tint:BLACK}; sec.wingTip={tint:BLACK}; sec.spinner={tint:WHITE};
sec.strut={fin:'castAlu',tint:WHITE};
Object.assign(F.decals,{
  regCol:BLACK, regOutOn:1, regOut:WHITE,
  // layer 1: the white sweep under a black keyline, rising aft
  m1On:1,m1Pat:2,m1A:WHITE,m1B:BLACK,m1L:-1.3,m1C:-0.25,m1W:8.6,m1H:1.1,m1P:0.5,m1Q:0.35,m1Rot:0,m1Tgt:0,m1Mode:1,
  // layer 2: a white sunburst on the tail, transparent between the rays
  m2On:1,m2Pat:7,m2A:WHITE,m2B:RED,m2Clr:2,m2P:12,m2Q:0.5,m2R:0,m2S:0,m2Tgt:5,m2Mode:1,m2Fit:1,m2L:4.6,m2C:0.4,m2W:1.4,m2H:1.2,
});
// the spec as the game joins it (its load door), the cage riding with it: the file says what the editor draws
const J=require(T+'/_load_build.js').gameSpec(env);
if(!J.cage) J.cage=S.cage;
env.spec=J;
const out=T+'/fixtures/stol_cub_showcase.json';
fs.writeFileSync(out,JSON.stringify(env));
console.log('wrote',out,fs.statSync(out).size);
