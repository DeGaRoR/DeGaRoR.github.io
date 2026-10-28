// writes tools/fixtures/stol_cub_showcase.json from the user's Cub (builds/cub_2026-09-20_corrected.json)
const T='/home/user/DeGaRoR.github.io/flyDiy/tools';const fs=require('fs');
const {envOf}=require('./showcase.js');
const env=envOf({cage:{wgSlat:1,wgSlatSpan:1,wgVG:1,wgTip:7,wgDroop:1,
  // the tyres: the STANDARD 31-inch tundra entry (s1R 0.39 on the tundra balloon carcass, the Cub's own smooth tread
  // and bulge 1.0) - no hand-tuned geometry: AIRCRAFT-LOOKS G3548 fixes the tundra proportions on master (L27a) and
  // this build follows it. The gear 3 in longer (the CubCrafters extended gear: the leg, not the tyre)
  s1R:0.39,whProfile:1,whTread:1,whBulge:1,s1Drop:0.536,
  stHinge:0.45,stSpan:1.7,
  // a three-blade carbon prop (CubCrafters' Carbon Cubs fly a Catto three-blade composite), 1.80 m
  cw_material:3,cw_bladeN:3,cw_propD:1.80,
  // v3 (the user 27 Oct): the wing lamps out (lightOn 0: the bay goes with them), the gear vee's triangular panel
  // out, coil-over shocks for the bungees (the modern Cubs' sprung gear - the XCub's spring aluminium, the
  // aftermarket shock struts), a bigger tailwheel; the cowl narrower with taller cheeks over the 915's heads
  lightOn:0, s1_linkPanel:0, linkPanel:0, s1_shockKind:0, s2R:0.11,
  cw_aftW:0.35, cw_taperW:0.93, cw_lobeAmp:0.06, cw_lobeTSig:0.35},eng:'rotax 915 iS'});
// THE LIVERY (v2, "something more modern ... take inspiration from the CubCrafters Carbon Cubs"): white over graphite,
// one accent colour - signal orange - on the keyline, the fin and the STOL parts that have a section of their own
// (the drooped tips)
const WHITE=0xE9E5DA, GRAPH=0x2A2D31, ORANGE=0xFF5A1F, INK=0x141414, PEARL=0.60;
env.name='STOL Cub';
env.note='G2829 (STOL-WING-2): the showcase STOL Cub - the user\'s Cub (builds/cub_2026-09-20_corrected.json) with the STOL kit (full-span fixed slot, VGs, drooped tips, ailerons drooped 10 deg), a Rotax 915 iS on a three-blade carbon prop, 31-inch tundra tyres on 3-inch extended gear with coil-over shocks, a 45 % elevator on a 20 % wider stab, and a white / graphite / orange paint job. Every change is an editor row in spec.cage.';
delete env.plaque; delete env.log;
const S=env.spec;
S.meta=Object.assign({},S.meta,{name:'STOL Cub',reg:'F-STOL'});
S.paint=Object.assign({},S.paint,{job:'full',base:WHITE,trim:GRAPH,gloss:0.62});
const F=S.finish; const sec=F.sections;
// a warmer off-white with metal flake in it (a pearl), body and flying surfaces alike
for(const k of ['body','ceilingLoop','pillarFront','pillarCabin','floorLoop','pillarWindow','pillarPassenger','pillarTail','finRud']) sec[k]={tint:WHITE,metal:PEARL};
for(const k of ['wingSkin','finSkin']) sec[k]=Object.assign({},sec[k]||{},{tint:WHITE,metal:PEARL});
sec.stabSkin={tint:WHITE,metal:PEARL};
sec.gearLeg={tint:GRAPH}; sec.waistband={tint:GRAPH}; sec.spinner={tint:GRAPH};
sec.strut={fin:'castAlu',tint:GRAPH};
sec.wingTip={tint:ORANGE}; sec.wingStol={tint:ORANGE};   // the STOL parts in the accent: the slot, the VG row, the drooped tips
Object.assign(F.decals,{
  // the registration small and black on the white of the boom, just aft of the orange flash; and large on the wing top
  regCol:INK, regOutOn:0, regFont:2, regH:0.16, regL:3.55, regC:0.16,
  // the wing's: in PLAN, L across the span from the centreline, C along the body (+ forward: the wing is -0.3..-2.0), radians
  wregOn:1, wregH:0.55, wregL:2.6, wregC:-1.1, wregRot:0, wregMode:2,
  // layer 1: graphite below a line that rises aft, under an orange keyline
  m1On:1,m1Pat:2,m1A:GRAPH,m1B:ORANGE,m1L:-1.3,m1C:-0.25,m1W:8.6,m1H:1.1,m1P:0.36,m1Q:0.42,m1Rot:0,m1Tgt:0,m1Mode:1,
  // layer 2: the sweep carried up the tail - graphite below a line rising aft, the orange keyline on it
  m2On:1,m2Pat:2,m2A:GRAPH,m2B:ORANGE,m2P:0.40,m2Q:0.45,m2R:null,m2S:null,m2Clr:0,m2Tgt:5,m2Mode:1,m2Fit:1,m2L:4.6,m2C:0.4,m2W:1.4,m2H:1.2,
  // layer 3: an orange flash along the cabin, stepping up over the wing root
  m3On:1,m3Pat:3,m3A:ORANGE,m3B:GRAPH,m3L:-1.5,m3C:0.12,m3W:5.2,m3H:0.22,m3P:0.30,m3Q:0.35,m3Rot:0,m3Tgt:0,m3Mode:1,
});
// the spec as the game joins it (its load door), the cage riding with it: the file says what the editor draws
const J=require(T+'/_load_build.js').gameSpec(env);
if(!J.cage) J.cage=S.cage;
env.spec=J;
const out=T+'/fixtures/stol_cub_showcase.json';
fs.writeFileSync(out,JSON.stringify(env));
console.log('wrote',out,fs.statSync(out).size);
