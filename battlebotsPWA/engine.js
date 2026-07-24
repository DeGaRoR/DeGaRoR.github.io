/* engine.js — moteur pur, déterministe, sans DOM. Testé seul par le harness.
   Ne doit référencer NI data.js NI app.js. Marqueurs ENGINE-START/END conservés
   pour extract.js (artefact CommonJS de test). */
// ENGINE-START
const ENGINE = (() => {
  function makeRng(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const V = {
    add:(a,b)=>({x:a.x+b.x, y:a.y+b.y}),
    sub:(a,b)=>({x:a.x-b.x, y:a.y-b.y}),
    scl:(a,s)=>({x:a.x*s, y:a.y*s}),
    dot:(a,b)=>a.x*b.x+a.y*b.y,
    len:(a)=>Math.hypot(a.x,a.y),
    norm:(a)=>{const l=Math.hypot(a.x,a.y)||1; return {x:a.x/l, y:a.y/l};},
    fromAngle:(t)=>({x:Math.cos(t), y:Math.sin(t)}),
    perp:(a)=>({x:-a.y, y:a.x}),
  };
  // RENDER CONTRACT (3D-ready): the engine only produces geometric state
  // (pos, angle, radius, flippedT, dominatedT, throttles, part ids) and a
  // timestamped event stream. It never touches pixels, colors, or meshes.
  // A renderer (canvas 2D today, three.js tomorrow) maps part ids -> visuals
  // and reads state each frame. Adding z later = extending V and pos, nothing else.
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const angNorm=(t)=>{ while(t>Math.PI)t-=2*Math.PI; while(t<-Math.PI)t+=2*Math.PI; return t; };

  const CHASSIS = {
    wedge: { mass:1.1, radius:17, leverage:2.4, tractionBase:1.0, speedBase:105, pushBase:130, battery:100, selfRight:1.6 },
    boxy:  { mass:1.5, radius:20, leverage:0.9, tractionBase:1.25, speedBase:88,  pushBase:165, battery:130, selfRight:3.5 },
    dart:  { mass:0.8, radius:14, leverage:1.3, tractionBase:0.85, speedBase:135, pushBase:95,  battery:80,  selfRight:2.2 },
    fleche:{ mass:1.6, radius:21, leverage:2.2, tractionBase:1.0, speedBase:100, pushBase:130, battery:136, selfRight:2.4 },
    marteau:{ mass:1.85, radius:24, leverage:1.0, tractionBase:1.0, speedBase:100, pushBase:130, battery:155, selfRight:2.6 },
    tortue:{ mass:1.51, radius:20, leverage:1.4, tractionBase:1.0, speedBase:100, pushBase:130, battery:130, selfRight:2.8 },
    losange:{ mass:1.68, radius:22, leverage:2.0, tractionBase:1.0, speedBase:100, pushBase:130, battery:142, selfRight:2.2 },
    disque:{ mass:2.18, radius:27, leverage:1.2, tractionBase:1.0, speedBase:100, pushBase:130, battery:180, selfRight:3.0 },
    /* E4 — coques S : rayon ≈ 23 → bots à 0,31 du ring (décision ancres),
       petites décharges batterie, vives (masse réelle faible + K_FORCE commun). */
    tortue_s: { mass:0.58, radius:23, leverage:1.2, tractionBase:1.05, speedBase:104, pushBase:120, battery:58, selfRight:3.2 },
    hex_s:    { mass:0.63, radius:23, leverage:1.3, tractionBase:1.0,  speedBase:102, pushBase:124, battery:60, selfRight:3.0 },
    coin_s:   { mass:0.63, radius:24, leverage:2.1, tractionBase:0.95, speedBase:106, pushBase:118, battery:58, selfRight:2.2 },
    losange_s:{ mass:0.72, radius:24, leverage:1.8, tractionBase:1.0,  speedBase:100, pushBase:122, battery:62, selfRight:2.4 },
    totem_s:  { mass:0.74, radius:24, leverage:1.5, tractionBase:1.0,  speedBase:98,  pushBase:126, battery:64, selfRight:2.8 },
  };
  const OPTS = {
    strategy:   ["adaptive","pressure","counter","ambush"],
    aggression: ["cautious","balanced","fierce"],
    edgeGuard:  ["daredevil","normal","fearful"],
    approach:   ["frontal","flank","opportunist"],
    power:      ["speed","mixed","torque"],
    chargeDist: ["short","medium","long"],
    handling:   ["stable","nervous","drift"],
  };
  const DEFAULT_BUILD = { chassis:"boxy", strategy:"adaptive", aggression:"balanced", edgeGuard:"normal",
    approach:"frontal", power:"mixed", chargeDist:"medium", handling:"stable" };

  const POWER = { speed:{spd:1.25,push:0.75}, mixed:{spd:1.0,push:1.0}, torque:{spd:0.78,push:1.35} };
  const GUARD = { daredevil:20, normal:38, fearful:58 };
  const CHARGE = { short:60, medium:110, long:200 };
  const HANDLING = {
    stable:  {turnMax:2.6, latDamp:0.78, jitter:0.02},
    nervous: {turnMax:4.6, latDamp:0.80, jitter:0.10},
    drift:   {turnMax:3.6, latDamp:0.92, jitter:0.05},
  };

  // parts catalog v4 — Denis's invariant taxonomy. FROZEN ids (extend, never renumber).
  // Every part carries its own attributes incl. MASS; bot stats aggregate from parts.
  // Slots with no purchasable entries yet (weapons) are reserved by design.
  const PARTS = {
    propulsion: [ // drive architecture: wheels/treads/layout -> traction & style
      {id:"pr0", cost:0,   traction:1.00, mass:0,    style:"worn"},
      {id:"pr1", cost:90,  traction:1.12, mass:0.06, style:"lug"},
      {id:"pr2", cost:140, traction:1.18, mass:0.04, style:"slick"},
      {id:"pr3", cost:200, traction:1.30, mass:0.16, style:"tread"},
    ],
    motor: [
      {id:"m0", cost:0,   push:1.00, speed:1.00, mass:0},
      {id:"m1", cost:60,  push:1.15, speed:1.07, mass:0.04},
      {id:"m2", cost:150, push:1.30, speed:1.14, mass:0.08},
      {id:"m3", cost:230, push:1.45, speed:1.05, mass:0.14},  // KV90: torque monster
      {id:"m4", cost:230, push:1.10, speed:1.40, mass:0.06},  // KV600: sprint
    ],
    cpu: [ // decision latency (re-plan cadence) + servo gain (alignment speed)
      {id:"c0", cost:0,   interval:18, gain:0.85, mass:0},
      {id:"c1", cost:120, interval:8,  gain:1.05, mass:0.01},
      {id:"c2", cost:240, interval:3,  gain:1.30, mass:0.02},
    ],
    battery: [
      {id:"b0", cost:0,   energy:1.00, mass:0},
      {id:"b1", cost:50,  energy:1.20, mass:0.03},
      {id:"b2", cost:120, energy:1.40, mass:0.06},
      {id:"b3", cost:190, energy:1.65, mass:0.12},
    ],
    armor: [ // blindage & prise
      {id:"a0", cost:0,   leverage:0,    mass:0},
      {id:"a1", cost:90,  leverage:0.12, mass:0.05},
      {id:"a2", cost:180, leverage:0.30, mass:0.08},
      {id:"a3", cost:260, leverage:0.45, mass:0.15},
    ],
    weapon1: [ {id:"w0", cost:0, mass:0} ],   // reserved: sumo rules, no weapons yet
    weapon2: [ {id:"x0", cost:0, mass:0} ],   // reserved
    software: [ // behavior packs (interacts with sensors)
      {id:"s0", cost:0,   mass:0},
      {id:"s1", cost:150, mass:0, edgePush:true}, // v2: steer dominated foes toward the edge
      {id:"s2", cost:240, mass:0, edgePush:true, escape:true}, // v3: break contact when overpowered
    ],
    ballast: [ // lest: mass + friction (weight -> normal force -> grip)
      {id:"l0", cost:0,  mass:0,    grip:0},
      {id:"l1", cost:40, mass:0.07, grip:0.02},
      {id:"l2", cost:90, mass:0.16, grip:0.045},
    ],
    sensors: [ // perception quality -> steering noise
      {id:"n0", cost:0,   noise:1.00, mass:0},
      {id:"n1", cost:110, noise:0.45, mass:0.02},
      {id:"n2", cost:230, noise:0.15, mass:0.03},
    ],
    srimech: [ // self-righting mechanism: multiplies chassis selfRight time
      {id:"r0", cost:0,   srMul:1.00, mass:0},
      {id:"r1", cost:130, srMul:0.60, mass:0.06},
      {id:"r2", cost:240, srMul:0.35, mass:0.09},
    ],
    cooling: [ // consumption efficiency (battery = capacity, cooling = drain)
      {id:"k0", cost:0,   drain:1.00, mass:0},
      {id:"k1", cost:70,  drain:0.95, mass:0.03},
      {id:"k2", cost:160, drain:0.89, mass:0.08},
    ],
  };
  const partOf = (type, id) => PARTS[type].find(p=>p.id===id) || PARTS[type][0];

  // ============================================================
  // PHYSICAL REFERENCE BANK — robot-sumo class (dohyo 154 cm, ≤20×20 cm, ≤3 kg).
  // Real component masses (kg) and electromechanical specs. This is the source
  // of truth for the DISPLAYED figures (kg / Nm / kW / Wh), all bottom-up.
  // STAGE 1: display only — the sim dynamics (force/speed/drain) still use the
  // tuned fields above and get re-derived from these specs in the physics session.
  const G_ACCEL = 9.81, DRIVE_EFF = 0.85;
  // friction model: the dohyo has its own surface factor, and static grip peaks
  // above kinetic. DOHYO_MU=1 is the reference surface (a slick arena would be <1).
  const DOHYO_MU = 1.0, KINETIC_RATIO = 0.8; // μ_kinetic / μ_static
  const VFREE_K = 1.15; // free-speed headroom above the tuned top speed (torque-speed curve)
  const PHYS = {
    /* P-MASSE — classes officielles : M = Hobbyweight 12 lb / 5,44 kg.
       Coques = QC tôle (aire alpha du sprite × 2,5 mm acier, plaques+parois+25 %
       structure — tools/hull_masses.json fait foi dans la porte, ±30 %). */
    chassis: {
      dart:  { kg:2.00, r:0.090 }, wedge: { kg:2.48, r:0.100 }, boxy: { kg:3.25, r:0.110 },
      fleche:{ kg:4.19, r:0.112 },
      marteau:{ kg:3.00, r:0.116 },
      tortue:{ kg:2.93, r:0.11 },
      losange:{ kg:2.16, r:0.113 },
      disque:{ kg:3.39, r:0.121 },
      tortue_s:{ kg:0.58, r:0.045 }, hex_s:{ kg:0.63, r:0.045 },
      coin_s:{ kg:0.63, r:0.045 }, losange_s:{ kg:0.72, r:0.045 }, totem_s:{ kg:0.74, r:0.045 },
    },
    propulsion: { // mu = grip coefficient, rWheel in metres
      pr0:{ kg:0.12, mu:0.70, rWheel:0.025 }, pr1:{ kg:0.30, mu:0.95, rWheel:0.030 },
      pr2:{ kg:0.18, mu:1.05, rWheel:0.028 }, pr3:{ kg:0.55, mu:1.15, rWheel:0.022 },
    },
    motor: { // tau = stall torque per motor (Nm), rpm = free output rpm, P = pair nominal (W)
      m0:{ kg:0.22, tau:0.20, rpm:600,  P:40  }, m1:{ kg:0.28, tau:0.28, rpm:650,  P:60  },
      m2:{ kg:0.34, tau:0.42, rpm:750,  P:120 }, m3:{ kg:0.46, tau:0.75, rpm:500,  P:150 },
      m4:{ kg:0.30, tau:0.30, rpm:1400, P:150 },
    },
    battery: { // real LiPo packs: S cells, mAh -> V, Wh
      b0:{ kg:0.11, S:3, mAh:1300 }, b1:{ kg:0.17, S:4, mAh:1500 },
      b2:{ kg:0.24, S:4, mAh:2200 }, b3:{ kg:0.33, S:6, mAh:2200 },
    },
    armor:   { a0:{kg:0.00}, a1:{kg:0.20}, a2:{kg:0.35}, a3:{kg:0.55} },
    cpu:     { c0:{kg:0.02}, c1:{kg:0.03}, c2:{kg:0.04} },
    sensors: { n0:{kg:0.01}, n1:{kg:0.03}, n2:{kg:0.05} },
    software:{ s0:{kg:0.00}, s1:{kg:0.00} },
    ballast: { l0:{kg:0.00,cog:0}, l1:{kg:0.30,cog:0.30}, l2:{kg:0.60,cog:0.60} }, // slugs sit low → lower CoG, resist flips
    srimech: { r0:{kg:0.00}, r1:{kg:0.15}, r2:{kg:0.25} },
    cooling: { k0:{kg:0.00}, k1:{kg:0.05}, k2:{kg:0.12} },
    weapon1: { w0:{kg:0} }, weapon2:{ x0:{kg:0} },
  };
  const PHYS_SLOTS = ["propulsion","motor","battery","armor","cpu","sensors",
    "software","ballast","srimech","cooling","weapon1","weapon2"];
  const physOf = (slot, id) => (PHYS[slot] && PHYS[slot][id]) || {kg:0};
  const STOCK_ID = {}; for (const s of Object.keys(PARTS)) STOCK_ID[s] = PARTS[s][0].id;
  const partMassKg = (slot, id) => physOf(slot, id).kg || 0;

  // Bottom-up physical figures. Display reads the motor nameplate (torqueNm/
  // powerKW), the sim reads the geared drive (pushN/vmax). The Power lever is a
  // real gear-ratio choice: Couple trades rpm for torque, Vitesse the reverse.
  const STACKABLE = { motor:1, battery:1, cooling:1, ballast:1 };  // L3.5: these slots stack
  function physStats(build){
    const pr = build.parts || {};
    const chassis = build.chassis || "boxy";
    const gear = POWER[build.power] || POWER.mixed;
    const rid = (slot)=> pr[slot] || STOCK_ID[slot];
    const nOf = (slot)=> (build.counts && STACKABLE[slot]) ? Math.max(1, build.counts[slot]|0) : 1;
    const nMotor = nOf("motor"), nBatt = nOf("battery");
    let massKg = PHYS.chassis[chassis].kg;
    for (const slot of PHYS_SLOTS) massKg += partMassKg(slot, rid(slot)) * nOf(slot);
    const mo = physOf("motor", rid("motor")),
          ba = physOf("battery", rid("battery")),
          pp = physOf("propulsion", rid("propulsion"));
    const packWh = (ba.S ? ba.S*3.7 * ba.mAh/1000 : 0) * nBatt;   // parallel packs → capacity ×N
    // Battery↔motor coupling. A DC motor's free speed ∝ V (Kv) and its stall
    // torque ∝ V (Kt·V/R), so more cells make it spin faster AND push harder.
    // Nameplate rpm/τ are quoted at the stock 3S pack, so stock is unchanged.
    const V_REF = 3*3.7;                       // 3S nominal (stock reference)
    const packV = (ba.S||3) * 3.7;             // pack nominal voltage
    // A real motor has a usable voltage band — you don't run a 3S motor on 6S for
    // free double performance. So the coupling is real but with diminishing returns.
    const V_COUPLE = 0.5;
    const vScale = 1 + V_COUPLE * (packV/V_REF - 1); // 3S→1.0, 4S→1.17, 6S→1.5
    const fMotor = 2*mo.tau*gear.push*DRIVE_EFF / pp.rWheel * vScale * nMotor; // N motors in parallel
    // Coulomb friction with a static/kinetic split on a surface of its own μ.
    // The tyre value is the KINETIC coeff (what a spinning wheel delivers);
    // static peak sits above it. Effective grip = tyre × arena. N = m·g.
    const N = massKg * G_ACCEL;
    const muK = pp.mu * DOHYO_MU;              // kinetic (spinning) — the old single μ
    const muS = pp.mu * DOHYO_MU / KINETIC_RATIO; // static peak (headroom)
    const gripKN = muK * N, gripSN = muS * N;
    const pushN  = Math.min(fMotor, gripKN);  // full-throttle operating force (display)
    const bal = physOf("ballast", rid("ballast"));
    return {
      massKg, torqueNm: mo.tau*nMotor, powerKW: mo.P/1000*nMotor, packWh, mu: pp.mu, packV, vScale, nMotor, nBatt,
      pushN, gripKN, gripSN, fMotor, muK, muS, tractionLimited: fMotor > gripSN,
      vmax: mo.rpm*gear.spd/60 * 2*Math.PI * pp.rWheel * vScale,  // free speed ∝ V (Kv)
      cogFactor: 1 + (bal.cog || 0),                          // low CoG resists flipping
    };
  }

  function derivedStats(build){
    const c = CHASSIS[build.chassis], p = POWER[build.power];
    const pr = build.parts || {};
    const nOf = (slot)=> (build.counts && STACKABLE[slot]) ? Math.max(1, build.counts[slot]|0) : 1;
    const g = (type)=>partOf(type, pr[type]);
    const mo=g("motor"), ba=g("battery"), pp=g("propulsion"), ar=g("armor"),
          cp=g("cpu"), sw=g("software"), ls=g("ballast"), sn=g("sensors"),
          sr=g("srimech"), ko=g("cooling"), w1=g("weapon1"), w2=g("weapon2");
    // STAGE 2a: mass is now the real bottom-up assembled mass (kg) from the
    // physical bank — it feeds inertia, the anchor, and collisions. The old
    // per-part sim masses are retired. Drive force/top-speed stay tuned until 2a-bis.
    const weight = physStats(build).massKg;
    // STAGE 2a-bis: drive force, top speed and the anchor are now derived from
    // the physical bank. push = min(motor force, μ·m·g) — grip-limited torque is
    // wasted, exactly as in reality. Constants pinned so stock RUSTY is unchanged.
    const ph = physStats(build);
    const K_FORCE = 47.0, K_SPEED = 56.0;   // P-MASSE : ×2.7 (masses réelles) — même feel
    return {
      speed: ph.vmax * K_SPEED, push: ph.pushN * K_FORCE,
      gripAnchor: ph.gripKN * K_FORCE,                 // anchor = kinetic (sustained slide)
      /* E3b — l'usure mord : build.eff = {motor,battery,propulsion} ∈ [0,1],
         calculé par l'app depuis les instances (HS = 0). Défaut 1 partout. */
      fMotorForce: ph.fMotor * K_FORCE * ((build.eff&&build.eff.motor) ?? 1),
      gripS: ph.gripSN * K_FORCE * ((build.eff&&build.eff.propulsion) ?? 1),
      gripK: ph.gripKN * K_FORCE * ((build.eff&&build.eff.propulsion) ?? 1),
      leverage: c.leverage + ar.leverage,
      traction: ph.mu, // display/grip proxy only; the physics use the grip caps
      energy: ph.packWh * 9.0 * (c.battery/130) * ((build.eff&&build.eff.battery) ?? 1), weight,
      cpuInterval: cp.interval, turnGain: cp.gain, aimNoise: sn.noise,
      selfRight: c.selfRight * sr.srMul, hasSrimech: sr.id !== "r0", drainMul: ko.drain * nOf("motor") / Math.max(1, nOf("cooling")),
      edgePush: !!sw.edgePush, escape: !!sw.escape, cogFactor: ph.cogFactor,
    };
  }
  function statBars(build){
    const s = derivedStats(build);
    return {
      speed: clamp((s.speed-60)/110,0,1), push: clamp((s.push-70)/155,0,1),
      leverage: clamp((s.leverage-0.6)/2.0,0,1), traction: clamp((s.traction-0.7)/0.7,0,1),
      energy: clamp((s.energy-60)/80,0,1),
    };
  }

  const ARENA_R = 150, TICK = 1/60, SUDDEN_DEATH_T = 20, SHRINK_RATE = 0.09, MIN_R = 20;
  /* E3 — seuils de dégâts : en dessous de HIT_J un contact ne compte pas ;
     au-delà de RIPOFF_J sur un composant EXPOSÉ (= qui a un collider), il est
     arraché net. DIRECT_MUL surpondère le choc direct dans l'intégrité. */
  const HIT_J = 70, RIPOFF_J = 260, DIRECT_MUL = 2.2, HIT_COOLDOWN = 0.22;  // P-MASSE : impulsions ∝ masse
  /* HIT_J au-dessus du bruit de POUSSÉE (le grind sumo génère ~12-20 par tick
     en appui continu) ; le temps réfractaire par bot fait qu'un contact
     prolongé compte comme UN choc, pas comme soixante. */
  // deterministic flip model (2b): lift accumulates from leverage × shove,
  // resisted by stability (mass × low CoG). No RNG.
  const LIFT_FLOOR = 2.3, LIFT_GAIN = 0.5, LIFT_DECAY = 8.0, FLIP_K = 17.0, LEVER_CAP = 1.5, BEACH_KO = 5.0;

  function makeBot(id, build, pos, angle){
    const c = CHASSIS[build.chassis], st = derivedStats(build);
    return {
      id, build, chassis:c,
      pos:{...pos}, angle, vel:{x:0,y:0}, angVel:0,
      maxSpeed:st.speed, push:st.push, mass:st.weight, gripAnchor:st.gripAnchor,
      fMotorForce:st.fMotorForce, gripS:st.gripS, gripK:st.gripK, slipping:false, slipAmt:0,
      radius:c.radius, leverage:st.leverage, traction:st.traction,
      colliders:(build.colliders&&build.colliders.list)||null,
      colliderBound:(build.colliders&&build.colliders.bound)||c.radius, gone:null,
      battery:st.energy, batteryMax:st.energy,
      decideEvery:st.cpuInterval, turnGain:st.turnGain, aimNoise:st.aimNoise,
      selfRight:st.selfRight, hasSrimech:st.hasSrimech, drainMul:st.drainMul, edgePush:st.edgePush, escape:st.escape,
      cogFactor:(typeof build.stability==="number"?build.stability:st.cogFactor), lift:0, beachedT:0,
      mode:"stalk", modeChanged:false, dominatedT:0, contactT:0,
      flippedT:0, flipAccT:0, throttleL:0, throttleR:0, edgeTime:0,
      /* E3 — dégâts positionnels : hits = journal des chocs subis
         ({t, impulse, part: MON composant frappé directement ou null=coque,
           ripped: arraché net}), hp = intégrité structurelle 0..1 (barre S9),
         hpPool ∝ masse. gone[slot] retire collider + contribution. */
      hits:[], hp:1, hpPool: 300*st.weight,
    };
  }

  function makeMatch(seed, buildA, buildB){
    const rng = makeRng(seed);
    const yA = (rng()-0.5)*44, yB = (rng()-0.5)*44;
    const aA = (rng()-0.5)*0.7, aB = (rng()-0.5)*0.7;
    return {
      seed, rng, t:0, arenaR:ARENA_R, over:false, winner:null, reason:null,
      bots:[
        makeBot(0, buildA, {x:-70,y:yA}, 0 + aA),
        makeBot(1, buildB, {x: 70,y:yB}, Math.PI + aB),
      ],
      events:[],
      duels:[0,0],
      n:0, // tick counter (CPU decision cadence)
    };
  }

  function control(bot, foe, m){
    const toFoe = V.sub(foe.pos, bot.pos);
    const distF = V.len(toFoe);
    const distEdge = m.arenaR - V.len(bot.pos);
    const facing = V.fromAngle(bot.angle);
    const h = HANDLING[bot.build.handling];

    // CPU latency: the planner only re-evaluates every decideEvery ticks
    // (steering below still runs every tick — servo vs planner). Edge guard
    // stays reflexive: falling off between two thoughts would feel unfair.
    const guard = GUARD[bot.build.edgeGuard];
    const think = ((m.n + bot.id*3) % bot.decideEvery) === 0;
    let mode = bot.mode;
    // finishing move: while shoving a dominated foe who is closer to the edge
    // than we are, do NOT bail out to recenter — finish the push.
    const foeEdgeD = m.arenaR - V.len(foe.pos);
    const finishing = distF < (bot.radius + foe.radius) * 1.25
      && foe.dominatedT > 0.12 && foeEdgeD < distEdge;
    if (distEdge < guard && !finishing) mode = "recenter";
    // software v3: when overpowered in a shove, don't just take it — break
    // contact (reverse out) instead of pushing back into a losing duel.
    else if (bot.escape && bot.dominatedT > 0.3 && distF < (bot.radius+foe.radius)*1.35)
      mode = "escape";
    else if (think || bot.mode === "recenter"){
      mode = "stalk";
      const strat = bot.build.strategy || "adaptive";
      const chargeD = CHARGE[bot.build.chargeDist];
      let want = distF < chargeD;
      // GRAND STRATEGY — the meta layer the tactical params fit into:
      //  pressure: relentless forward pressure (always willing to charge)
      //  counter:  refuse the first engagement; strike only when the foe is
      //            committed to a charge (fast and closing) or exposed side-on
      //  ambush:   sit STILL (statue) until the foe is close, then burst
      if (strat === "pressure") want = true;
      else if (strat === "counter"){
        const foeV = Math.hypot(foe.vel.x, foe.vel.y);
        const vlen = foeV || 1;
        const foeClosing = ((foe.vel.x*(bot.pos.x-foe.pos.x))+(foe.vel.y*(bot.pos.y-foe.pos.y)))/vlen/Math.max(1,distF) > 0.5;
        const foeSideOn = Math.abs(V.dot(V.fromAngle(foe.angle), V.norm(toFoe))) < 0.45;
        const foeSpent  = foeV < 25 && distF < chargeD;      // punish the whiff
        const sd = m.arenaR < ARENA_R - 1;                   // sudden death: waiting stopped paying
        const stale = (bot.orbitT||0) > 5;                   // …or the foe refuses to commit
        if (!(sd || stale)) {
          want = want && (foeSideOn || foeSpent || foe.dominatedT > 0.1);
          if (!want) mode = "orbit";                          // matador: keep circling
        }
      } else if (strat === "ambush"){
        if (distF > chargeD * 0.55){ mode = "hold"; want = false; }
        else want = true;
      }
      if (want){
        const ag = bot.build.aggression;
        if (ag === "fierce") { /* always */ }
        else if (ag === "balanced"){
          const align = V.dot(facing, V.norm(toFoe));
          want = align > 0.4;
        } else {
          const foeEdge = m.arenaR - V.len(foe.pos);
          const foeFacesMe = V.dot(V.fromAngle(foe.angle), V.norm(V.sub(bot.pos,foe.pos)));
          want = (foeEdge < distEdge*0.75) || (foeFacesMe < 0.1);
        }
      }
      if (want) mode = "charge";
    }
    if (mode !== bot.mode){ bot.mode = mode; bot.modeChanged = true; }
    bot.orbitT = (mode==="orbit") ? (bot.orbitT||0) + TICK : (bot.orbitT||0);

    let target;
    if (mode === "escape"){
      // break contact: if reverse points to safety, floor it backward; if not,
      // PIVOT first (full differential) — backing straight into the shove only
      // keeps you pinned under the bulldozer.
      const away = V.norm(V.sub(bot.pos, foe.pos));
      const tail = V.scl(V.fromAngle(bot.angle), -1);
      const align = V.dot(tail, away);                 // is reverse pointing to safety?
      const steer = V.dot({x:-tail.y,y:tail.x}, away);
      if (align > 0.3){ bot.throttleL = -1 - steer*0.3; bot.throttleR = -1 + steer*0.3; }
      else { const sgn = steer>=0?1:-1; bot.throttleL = -sgn; bot.throttleR = sgn; } // pivot
      return;
    }
    if (mode === "orbit"){
      // matador: keep moving tangentially around the foe — a committed charge
      // whiffs past a moving target, and the whiff is the opening.
      const rad = V.sub(bot.pos, foe.pos), rl = Math.max(1, V.len(rad));
      const tangent = {x:-rad.y/rl, y:rad.x/rl};
      const ring = CHARGE[bot.build.chargeDist]*0.75;
      const inout = V.scl(V.norm(rad), (ring - rl) * 0.5);     // hold the orbit radius
      target = V.add(V.add(bot.pos, V.scl(tangent, 42)), inout);
      if (V.len(target) > m.arenaR-24) target = V.scl(V.norm(target), m.arenaR-24); // stay on the dohyo
    } else if (mode === "hold"){
      // statue: keep the nose on the foe, wheels stopped (bait + save battery)
      const aim = Math.atan2(toFoe.y, toFoe.x);
      let dA = aim - bot.angle; while(dA>Math.PI)dA-=2*Math.PI; while(dA<-Math.PI)dA+=2*Math.PI;
      const turn = Math.abs(dA) > 0.15 ? Math.sign(dA)*0.35 : 0;
      bot.throttleL = -turn; bot.throttleR = turn;
      return;
    }
    if (mode === "recenter"){
      const away = V.scl(V.norm(V.sub(bot.pos, foe.pos)), 18);
      target = away;
    } else if (mode === "charge"){
      const ap = bot.build.approach;
      let useFlank = ap === "flank";
      if (ap === "opportunist"){
        const foeFacesMe = V.dot(V.fromAngle(foe.angle), V.norm(V.sub(bot.pos,foe.pos)));
        useFlank = foeFacesMe > 0.5;
      }
      if (useFlank && distF > (bot.radius + foe.radius) * 1.9){
        const side = V.perp(V.fromAngle(foe.angle));
        const s = V.dot(side, V.sub(bot.pos, foe.pos)) >= 0 ? 1 : -1;
        target = V.add(foe.pos, V.scl(side, s * (foe.radius*2.4)));
      } else if (bot.edgePush && foe.dominatedT > 0 && V.len(foe.pos) > 5
          && V.dot(V.norm(toFoe), V.norm(foe.pos)) > 0.25){
        // software v2: when the shove axis is already roughly outward,
        // steer the dominated foe toward their NEAREST edge (outward radial).
        target = V.add(foe.pos, V.scl(V.norm(foe.pos), 48));
      } else target = foe.pos;
    } else {
      const standoff = CHARGE[bot.build.chargeDist] * 1.1;
      const dir = V.norm(toFoe);
      const ring = V.sub(foe.pos, V.scl(dir, standoff));
      const orbit = V.scl(V.perp(dir), 25);
      target = V.add(ring, orbit);
    }

    const j = h.jitter;
    target = V.add(target, {x:(m.rng()-0.5)*2*j*180, y:(m.rng()-0.5)*2*j*180});

    const want = V.sub(target, bot.pos);
    let wantAng = Math.atan2(want.y, want.x);
    // sensor quality: cheap sensors = wandering aim (deterministic wobble).
    // Damped at close range: in contact you FEEL the foe, sensors matter at distance.
    const rangeF = clamp(distF/110, 0.35, 1);
    wantAng += bot.aimNoise * 0.12 * rangeF * Math.sin(m.t*5.3 + bot.id*2.7);
    const err = angNorm(wantAng - bot.angle);
    const turn = clamp(err * 3.0 * bot.turnGain, -1, 1);
    let fwd = clamp(Math.cos(err) * 1.4, -0.25, 1);
    if (mode === "charge") fwd = Math.max(fwd, 0.85);
    bot.throttleL = clamp(fwd - turn, -1, 1);
    bot.throttleR = clamp(fwd + turn, -1, 1);
  }

  function leverageDuel(a, b, m){
    const nAB = V.norm(V.sub(b.pos, a.pos));
    function score(me, other, nToOther){
      const facing = V.fromAngle(me.angle);
      const align = Math.max(0.3, V.dot(facing, nToOther));
      const otherFacing = V.fromAngle(other.angle);
      const flank = V.dot(otherFacing, V.scl(nToOther,-1)) < 0.2 ? 1.5 : 1.0;
      return me.leverage * align * flank;
    }
    let sA = score(a,b,nAB), sB = score(b,a,V.scl(nAB,-1));
    if (b.dominatedT > 0 && b.wasDominatedBy === a.id) sA *= 1.45;
    if (a.dominatedT > 0 && a.wasDominatedBy === b.id) sB *= 1.45;
    let winner=null, loser=null, ratio=1;
    if (sA > sB*1.15){ winner=a; loser=b; ratio=sA/sB; }
    else if (sB > sA*1.15){ winner=b; loser=a; ratio=sB/sA; }
    if (winner){
      loser.dominatedT = 0.35;
      if (loser.wasDominatedBy !== winner.id){
        loser.wasDominatedBy = winner.id;
        winner.wasDominatedBy = -1;
        m.duels[winner.id]++;
        m.events.push({t:m.t, type:"duel", winner:winner.id});
      }
      // deterministic flip: lift builds from leverage advantage × the winner's
      // shove, every tick the clinch holds. It's resisted by the loser's stability
      // (mass × low centre of gravity — ballast helps). Past threshold, it goes over.
      const shove = Math.max(0, (winner.throttleL + winner.throttleR) * 0.5);
      const lever = Math.min(LEVER_CAP, Math.max(0, ratio - LIFT_FLOOR));
      // low CoG (ballast) resists BOTH ways: slower lift build AND higher threshold.
      loser.lift = (loser.lift || 0) + lever * (0.35 + shove) * LIFT_GAIN / loser.cogFactor;
      const threshold = FLIP_K * loser.mass * loser.cogFactor;
      if (loser.lift >= threshold && loser.flippedT <= 0){
        // a srimech is REQUIRED to get back over; without one, the flip is
        // terminal — you stay beached until you lose by attrition.
        loser.flippedT = loser.hasSrimech ? loser.selfRight : 1e9;
        loser.lift = 0;
        m.events.push({t:m.t, type:"flip", bot:loser.id});
      }
    }
  }

  function tick(m){
    m.n++;
    if (m.over) return;
    const dt = TICK;
    const [a,b] = m.bots;

    if (m.t > SUDDEN_DEATH_T && m.arenaR > MIN_R)
      m.arenaR = Math.max(MIN_R, m.arenaR * (1 - SHRINK_RATE*dt));

    for (const bot of m.bots){
      const foe = m.bots[1-bot.id];
      bot.modeChanged = false;
      if (bot.flippedT > 0){
        bot.flipAccT += Math.min(dt, bot.flippedT);  // cumul réel du temps passé retourné
        bot.flippedT -= dt;
        bot.beachedT = (bot.beachedT || 0) + dt; // cumulative time on your back (attrition)
        bot.throttleL = bot.throttleR = 0;
        if (bot.flippedT <= 0 && m.t > 0) m.events.push({t:m.t, type:"righted", bot:bot.id});
      } else {
        control(bot, foe, m);
      }

      const use = (Math.abs(bot.throttleL)+Math.abs(bot.throttleR)) * 0.5;
      bot.battery = Math.max(0, bot.battery - use * 3.2 * bot.drainMul * dt);
      const frac = bot.battery / bot.batteryMax;
      // voltage sag: a LiPo droops under load and as it depletes, so the motor
      // loses rpm and torque late in the fight (physical power fade).
      const powerScale = Math.min(1, 0.45 + frac*1.1);

      const dom = bot.dominatedT > 0 ? 0.6 : 1.0;
      bot.dominatedT = Math.max(0, bot.dominatedT - dt);
      bot.lift = Math.max(0, (bot.lift || 0) - LIFT_DECAY * dt); // recover when not out-levered

      const facing = V.fromAngle(bot.angle);
      const drive = (bot.throttleL + bot.throttleR) * 0.5;
      const turnCmd = (bot.throttleR - bot.throttleL) * 0.5;
      const h = HANDLING[bot.build.handling];

      // Motor torque–speed curve: a DC motor's torque falls linearly from stall
      // (at rest) to zero at free speed. So drive force tapers as the bot nears
      // its top speed — top speed now EMERGES from the physics, not a hard cap.
      const vDrive = V.dot(bot.vel, facing) * Math.sign(drive||1);      // speed in the drive direction
      const speedFrac = Math.max(0, 1 - Math.max(0, vDrive) / (bot.maxSpeed * VFREE_K));
      // Coulomb traction: the motor demands F = fMotor·throttle·(torque-speed), but
      // the floor only transmits up to μ·N. Past the STATIC peak the wheels break
      // loose and spin (kinetic, lower) — real wheelspin, with hysteresis.
      const demanded = bot.fMotorForce * speedFrac * Math.abs(drive);
      if (!bot.slipping && demanded > bot.gripS) bot.slipping = true;
      else if (bot.slipping && demanded < bot.gripK) bot.slipping = false;
      const effGrip = bot.slipping ? bot.gripK : bot.gripS;
      const forceMag = Math.min(demanded, effGrip);
      bot.slipAmt = bot.slipping ? Math.min(1, (demanded - bot.gripK) / bot.gripK) : 0;

      const accel = (forceMag / bot.mass) * 2.0 * powerScale * dom;
      bot.vel = V.add(bot.vel, V.scl(facing, Math.sign(drive) * accel * dt));

      const fwdSpd = V.dot(bot.vel, facing);
      const latV = V.sub(bot.vel, V.scl(facing, fwdSpd));
      const damp = Math.pow(h.latDamp, dt*60);
      bot.vel = V.add(V.scl(facing, fwdSpd), V.scl(latV, damp));

      // drag instead of hard cap: self-drive tops out at maxSpeed, but external
      // shoves CAN exceed it — heavy torque bots are planted, light speed bots fly.
      // traction is part of the anchor: soft tires = harder to shove around.
      // a DOMINATED bot loses its anchor: that's what winning the leverage duel buys you.
      // a FLIPPED bot is dead weight on the floor — hard to shove out while it recovers,
      // so a flip is a tempo loss (can't drive), not a free ring-out.
      const anchor = bot.flippedT > 0 ? 2.0 : (bot.dominatedT > 0 ? 0.45 : 1);
      const kDrag = (bot.gripAnchor * anchor / bot.mass * 2.415) / bot.maxSpeed;
      bot.vel = V.scl(bot.vel, 1/(1 + kDrag*dt));

      bot.angVel = turnCmd * h.turnMax * dom * (bot.flippedT>0 ? 0 : 1);
      bot.angle += bot.angVel * dt;

      if (bot.flippedT > 0) bot.vel = V.scl(bot.vel, Math.pow(0.9, dt*60));

      bot.pos = V.add(bot.pos, V.scl(bot.vel, dt));

      // analytics for the debrief
      if (m.arenaR - V.len(bot.pos) < 32) bot.edgeTime += dt;
    }

    const d = V.sub(b.pos, a.pos);
    const dist = V.len(d);
    // Per-component collision: the deepest overlapping pair of tagged circles.
    // Colliders hug what's drawn (hull + protruding wheels/weapons). Torn-off
    // parts (bot.gone) drop out live. Falls back to a single circle if unset.
    let hit=null;
    if (a.colliders && b.colliders){
      if (dist < a.colliderBound + b.colliderBound){
        const wc=(bot)=>{ const c=Math.cos(bot.angle), s=Math.sin(bot.angle);
          return bot.colliders.filter(k=>!(bot.gone&&bot.gone[k.slot]))
            .map(k=>({x:bot.pos.x+k.x*c-k.y*s, y:bot.pos.y+k.x*s+k.y*c, r:k.r, slot:k.slot})); };
        const WA=wc(a), WB=wc(b); let best=null;
        for(const ca of WA) for(const cb of WB){
          const dx=cb.x-ca.x, dy=cb.y-ca.y, dl=Math.hypot(dx,dy), minD=ca.r+cb.r;
          if(dl<minD && dl>0.001){ const ov=minD-dl;
            if(!best||ov>best.ov) best={ov, n:{x:dx/dl,y:dy/dl}, aPart:ca.slot, bPart:cb.slot}; } }
        if(best) hit={n:best.n, overlap:best.ov, aPart:best.aPart, bPart:best.bPart};
      }
    } else if (dist < a.radius + b.radius && dist > 0.001){
      hit={n:V.scl(d,1/dist), overlap:(a.radius+b.radius)-dist, aPart:null, bPart:null};
    }
    if (hit){
      const n = hit.n, overlap = hit.overlap;
      const tot = a.mass + b.mass;
      a.pos = V.add(a.pos, V.scl(n, -overlap * (b.mass/tot)));
      b.pos = V.add(b.pos, V.scl(n,  overlap * (a.mass/tot)));
      a.lastHitPart = hit.bPart; b.lastHitPart = hit.aPart; // which of MY parts struck / was struck
      a.hitOnFoe = hit.bPart; b.hitOnFoe = hit.aPart;        // foe part I contacted (for future damage)
      const relVn = V.dot(V.sub(b.vel,a.vel), n);
      if (relVn < 0){
        const e = 0.05;
        const jimp = -(1+e)*relVn / (1/a.mass + 1/b.mass);
        a.vel = V.add(a.vel, V.scl(n, -jimp/a.mass));
        b.vel = V.add(b.vel, V.scl(n,  jimp/b.mass));
        if (Math.abs(jimp) > 28) m.events.push({t:m.t, type:"impact", impulse:Math.abs(jimp),
          x:(a.pos.x+b.pos.x)/2, y:(a.pos.y+b.pos.y)/2});
        // E3 : chaque bot journalise le choc qu'il ENCAISSE, attribué à son
        // composant frappé (hit.aPart pour a, hit.bPart pour b) ou à la coque.
        const J = Math.abs(jimp);
        if (J > HIT_J){
          for (const [bot, myPart] of [[a, hit.aPart], [b, hit.bPart]]){
            if (bot._lastHitLogT != null && m.t - bot._lastHitLogT < HIT_COOLDOWN) continue;
            bot._lastHitLogT = m.t;
            const direct = myPart != null && !(bot.gone && bot.gone[myPart]);
            let ripped = false;
            if (direct && J > RIPOFF_J){
              bot.gone = bot.gone || {}; bot.gone[myPart] = true; ripped = true;
              m.events.push({t:m.t, type:"ripoff", bot:bot.id, part:myPart, impulse:J});
            }
            bot.hits.push({t:m.t, impulse:J, part: direct ? myPart : null, ripped});
            bot.hp = Math.max(0, bot.hp - J*(direct ? DIRECT_MUL : 1)/bot.hpPool);
          }
        }
        if (Math.abs(relVn) > 55){ a.lastHardHitT = m.t; b.lastHardHitT = m.t; }
      }
      a.contactT += dt; b.contactT += dt;
      if (a.contactT > 0.1) leverageDuel(a, b, m);
      for (const bot of m.bots){
        const foe = m.bots[1-bot.id];
        const nTo = V.norm(V.sub(foe.pos, bot.pos));
        const facing = V.fromAngle(bot.angle);
        const into = Math.max(0, V.dot(facing, nTo));
        const dom = bot.dominatedT > 0 ? 0.5 : 1.0;
        const drive = Math.max(0,(bot.throttleL+bot.throttleR)*0.5);
        const f = bot.push * into * drive * dom * 1.7;
        foe.vel = V.add(foe.vel, V.scl(nTo, f/foe.mass * dt));
      }
    } else {
      a.contactT = Math.max(0, a.contactT - dt*4);
      b.contactT = Math.max(0, b.contactT - dt*4);
      if (a.contactT===0 && b.contactT===0){ a.wasDominatedBy = b.wasDominatedBy = -1; }
    }

    if (!m.over && m.t > SUDDEN_DEATH_T && m.arenaR <= MIN_R + 0.5){
      m.over = true;
      m.winner = (V.len(a.pos) < V.len(b.pos)) ? 0 : 1;
      m.reason = "shrinkOut";
      m.events.push({t:m.t, type:"end", winner:m.winner, reason:m.reason});
    }

    for (const bot of m.bots){
      if (!m.over && V.len(bot.pos) > m.arenaR){
        m.over = true; m.winner = 1-bot.id;
        m.reason = m.t > SUDDEN_DEATH_T ? "shrinkOut" : "ringOut";
        m.events.push({t:m.t, type:"end", winner:m.winner, reason:m.reason});
      }
      if (!m.over && (bot.beachedT || 0) > BEACH_KO){
        // KO by attrition: flipped too long overall (one flip is a survivable
        // setback; repeated flips, or a slow self-right, end you).
        m.over = true; m.winner = 1-bot.id; m.reason = "koFlip";
        m.events.push({t:m.t, type:"end", winner:m.winner, reason:m.reason});
      }
    }
    m.t += dt;
    if (m.t > 90 && !m.over){
      m.over = true;
      m.winner = (V.len(a.pos) < V.len(b.pos)) ? 0 : 1;
      m.reason = "timeout";
    }
  }

  function runHeadless(seed, buildA, buildB){
    const m = makeMatch(seed, buildA, buildB);
    while(!m.over) tick(m);
    return { winner:m.winner, reason:m.reason, t:m.t, duels:m.duels, events:m.events,
             edgeTime:[m.bots[0].edgeTime, m.bots[1].edgeTime] };
  }

  /* ---------- SLICE 1: player bot, teaching, opponent generator ---------- */
  const SLICE1 = {
    // the used clunker: fixed chassis, "functional but not optimal" defaults
    playerBuild: { chassis:"boxy", strategy:"adaptive", aggression:"balanced", edgeGuard:"daredevil",
      approach:"frontal", power:"mixed", chargeDist:"medium", handling:"stable" },
    // teaching opponents recalibrated for the deterministic flip (2b). Both are
    // BOXY — same leverage class as RUSTY, so no uncounterable flip mismatch early;
    // the lessons are piloting. Wedge/fork flippers are a MID-game threat (buy srimech).
    // T1 GRIZZLI: defaults lose (~13%) — lesson: Aggression -> Fierce (commit, ~100%).
    // T2 PIKPIK: your fierce config over-commits at the rim (~18%) — lesson:
    //            Edge guard -> Normal (guard the edge while you brawl, ~100%).
    teaching: [
      { nameIdx:0, archetype:"bulldozer", build:{ chassis:"marteau", aggression:"cautious",
        edgeGuard:"fearful", approach:"frontal", power:"mixed", chargeDist:"medium", handling:"stable" }},
      { nameIdx:3, archetype:"camper", build:{ chassis:"tortue", aggression:"cautious",
        edgeGuard:"fearful", approach:"frontal", power:"mixed", chargeDist:"short", handling:"stable" }},
    ],
  };

  const OPPONENT_CHASSIS = ["fleche","marteau","tortue","losange","disque"]; // player is locked to RUSTY
  const ARCHETYPES = {
    bulldozer:{ chassis:["marteau","disque"], aggression:["fierce"], approach:["frontal"],
      power:["torque"], edgeGuard:["normal","daredevil"], chargeDist:["medium","long"], handling:["stable"] },
    mosquito:{ chassis:["fleche","losange"], aggression:["balanced","fierce"], approach:["flank"],
      power:["speed"], edgeGuard:["normal","fearful"], chargeDist:["short","medium"], handling:["nervous","drift"] },
    camper:{ chassis:["tortue","disque"], aggression:["cautious"], approach:["opportunist"],
      power:["mixed","torque"], edgeGuard:["fearful"], chargeDist:["short"], handling:["stable"] },
    wedgelord:{ chassis:["fleche","losange"], aggression:["fierce","balanced"], approach:["frontal"],
      power:["mixed","torque"], edgeGuard:["normal"], chargeDist:["medium","long"], handling:["stable","nervous"] },
    chaotic:null, // full random
  };

  function genOpponent(seed, level, opts){
    /* E7b — opts (facultatif) : contraintes de concours pour des adversaires
       LÉGAUX. { allowChassis:[ids], banTracks:bool, maxKg:number } */
    opts = opts || {};
    const rng = makeRng(seed);
    const pool = level <= 1 ? ["bulldozer","mosquito","wedgelord"]
               : level === 2 ? ["bulldozer","mosquito","wedgelord","camper"]
               : ["bulldozer","mosquito","wedgelord","camper","chaotic"];
    const arch = pool[Math.floor(rng()*pool.length)];
    const pick = (arr)=>arr[Math.floor(rng()*arr.length)];
    const build = {};
    const spec = ARCHETYPES[arch];
    build.chassis = spec ? pick(spec.chassis) : pick(OPPONENT_CHASSIS);
    if (opts.allowChassis && opts.allowChassis.length &&
        opts.allowChassis.indexOf(build.chassis) < 0)
      build.chassis = pick(opts.allowChassis);
    for (const key of Object.keys(OPTS))
      build[key] = spec && spec[key] ? pick(spec[key]) : pick(OPTS[key]);
    // low levels carry an exploitable flaw; high levels are clean
    if (level <= 2 && rng() < 0.6) build.edgeGuard = "daredevil";
    if (level <= 2) build.strategy = pick(["adaptive","pressure"]); // metas unlock with level
    // "long" charge is a first-strike auto-win in near-mirrors: locked until the
    // player has unlocked chargeDist too (balance flag, revisit later)
    if (level < 3 && build.chargeDist === "long") build.chargeDist = "medium";
    // high-level opponents come upgraded, keeping pace with the player's shop
    const tier = level >= 5 ? 3 : level >= 4 ? 2 : level >= 3 ? 1 : 0;
    let motor = ["m0","m1","m2"][Math.min(2,tier)];
    if (tier >= 3) motor = (arch==="mosquito"||arch==="chaotic") ? "m4" : "m3";
    build.parts = {
      motor,
      battery: ["b0","b1"][Math.min(1,tier)], // capped at 4S: the big bricks do not fit starter hulls
      propulsion: tier>=3 ? "pr3" : ["pr0","pr1","pr2"][tier],
      armor: (level >= 4 && rng() < (level>=5 ? 0.5 : 0.35))
        ? (level>=5 ? (rng()<0.4?"a3":"a2") : (rng()<0.5?"a2":"a1")) : "a0",
      cpu:      ["c0","c0","c1","c1","c2"][level-1] || "c0",
      sensors:  level>=5 ? "n2" : level>=3 ? "n1" : "n0",
      software: (level>=4 && rng() < (level>=5 ? 0.7 : 0.3)) ? "s1" : "s0",
      ballast:  (arch==="bulldozer" && level>=3 && rng()<0.5) ? "l1" : "l0",
      srimech:  (level>=5 && rng()<0.3) ? "r1" : "r0",
      cooling:  (level>=4 && rng()<0.35) ? "k1" : "k0",
      weapon1:"w0", weapon2:"x0",
    };
    if (opts.banTracks && build.parts.propulsion === "pr3")
      build.parts.propulsion = "pr1";
    if (opts.maxKg){
      const order = [["propulsion","pr0"],["battery","b0"],["motor","m0"]];
      let guard = 0;
      while (physStats({chassis:build.chassis, parts:build.parts}).massKg > opts.maxKg && guard++ < 6){
        const hit = order.find(([sl,base]) => build.parts[sl] && build.parts[sl] !== base);
        if (!hit) break;
        build.parts[hit[0]] = hit[1];
      }
    }

    return { build, archetype:arch };
  }

  // a level's tournament: 3 fixed opponents; the final carries no flaw
  function genTournament(seed, level){
    const opps = [
      genOpponent(seed*3+1, level),
      genOpponent(seed*3+2, level),
      genOpponent(seed*3+3, level),
    ];
    if (opps[2].build.edgeGuard === "daredevil") opps[2].build.edgeGuard = "normal";
    return opps;
  }

  // honest one-word tendency, derived from the ACTUAL generated settings
  function tendencyKey(build){
    if (build.aggression === "fierce") return "tend_charger";
    if (build.approach === "flank") return "tend_circler";
    if (build.edgeGuard === "fearful") return "tend_camper";
    if (build.power === "torque") return "tend_pusher";
    if (build.aggression === "cautious") return "tend_waiter";
    return "tend_wild";
  }

  return { makeMatch, tick, DAMAGE:{HIT_J, RIPOFF_J, DIRECT_MUL}, runHeadless, derivedStats, statBars, genOpponent, genTournament, tendencyKey,
           CHASSIS, OPTS, DEFAULT_BUILD, SLICE1, PARTS, partOf, ARENA_R, TICK, SUDDEN_DEATH_T,
           PHYS, physStats, partMassKg };
})();
// ENGINE-END
