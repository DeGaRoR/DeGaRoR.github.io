#!/usr/bin/env node
/**
 * S-CLEAN Phase 1 migration script — Port Naming + P_column Fix
 * Run: node _migrate_phase1.js
 * Then: node --max-old-space-size=2048 _runTests.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'processThis.html');
let src = fs.readFileSync(FILE, 'utf8');
const hasCRLF = src.includes('\r\n');
if (hasCRLF) { src = src.replace(/\r\n/g, '\n'); console.log('Normalized \\r\\n → \\n'); }
const origLen = src.length;
let changeCount = 0;

function replace(pattern, replacement, label) {
  const before = src;
  if (typeof pattern === 'string') {
    let count = 0, idx = -1;
    while ((idx = before.indexOf(pattern, idx + 1)) !== -1) count++;
    if (count === 0) { console.log(`  SKIP (0): ${label}`); return 0; }
    src = src.split(pattern).join(replacement);
    console.log(`  ${count} × ${label}`);
    changeCount += count;
    return count;
  } else {
    const matches = before.match(pattern);
    const count = matches ? matches.length : 0;
    if (count === 0) { console.log(`  SKIP (0): ${label}`); return 0; }
    src = src.replace(pattern, replacement);
    console.log(`  ${count} × ${label}`);
    changeCount += count;
    return count;
  }
}

// Port rename map for bare 'in'/'out' by defId
const portRenameMap = {
  'source':       { 'out': 'mat_out' },
  'source_multi': { 'out': 'mat_out' },
  'source_air':   { 'out': 'mat_out' },
  'sink':         { 'in': 'mat_in' },
  'valve':        { 'in': 'mat_in', 'out': 'mat_out' },
  'restriction':  { 'in': 'mat_in', 'out': 'mat_out' },
  'mixer':        { 'out': 'mat_out' },
  'splitter':     { 'in': 'mat_in' },
  'grid_supply':  { 'out': 'elec_out' },
  'sink_electrical': { 'in': 'elec_in' }
};

// ════════════════════════════════════════════════════════════════
// 1. GLOBALLY SAFE — unique port name patterns
// ════════════════════════════════════════════════════════════════
console.log('\n=== 1. Safe global replaces ===');

// Mixer numbered ports (unique to mixer)
replace(/'in1'/g, "'mat_in_1'", "'in1'→'mat_in_1'");
replace(/'in2'/g, "'mat_in_2'", "'in2'→'mat_in_2'");
replace(/'out1'/g, "'mat_out_1'", "'out1'→'mat_out_1'");
replace(/'out2'/g, "'mat_out_2'", "'out2'→'mat_out_2'");

// Dotted access: ports.in1 etc.
replace(/ports\.in1\b/g, 'ports.mat_in_1', 'ports.in1');
replace(/ports\.in2\b/g, 'ports.mat_in_2', 'ports.in2');
replace(/ports\.out1\b/g, 'ports.mat_out_1', 'ports.out1');
replace(/ports\.out2\b/g, 'ports.mat_out_2', 'ports.out2');

// Presentation object keys (with or without space before brace)
replace(/\bin1: ?\{/g, 'mat_in_1: {', 'pres key in1:');
replace(/\bin2: ?\{/g, 'mat_in_2: {', 'pres key in2:');
replace(/\bout1: ?\{/g, 'mat_out_1: {', 'pres key out1:');
replace(/\bout2: ?\{/g, 'mat_out_2: {', 'pres key out2:');

// Distillation: mat_out_D → dist_out, mat_out_B → bot_out
replace(/\bmat_out_D\b/g, 'dist_out', 'mat_out_D→dist_out');
replace(/\bmat_out_B\b/g, 'bot_out', 'mat_out_B→bot_out');

// P_column_bar → P_column (globally unique to distillation)
replace(/P_column_bar/g, 'P_column', 'P_column_bar→P_column');

// ════════════════════════════════════════════════════════════════
// 2. ENGINE SECTION — unit registrations, ticks (before test suite)
//    Split file at test boundary to avoid touching _devTest units
// ════════════════════════════════════════════════════════════════
console.log('\n=== 2. Engine section edits ===');

const testBoundary = src.indexOf('<!-- TEST SUITE');
if (testBoundary < 0) { console.log('ERROR: test boundary not found'); process.exit(1); }

let engine = src.substring(0, testBoundary);
let rest = src.substring(testBoundary);

// --- Source (×3): port def 'out' → 'mat_out' ---
engine = engine.replace(
  /portId: 'out', dir: PortDir\.OUT, type: StreamType\.MATERIAL/g,
  "portId: 'mat_out', dir: PortDir.OUT, type: StreamType.MATERIAL"
);
console.log("  source/mixer port def: out→mat_out (engine only)");

// --- Sink/valve/restriction/splitter: port def 'in' → 'mat_in' ---
engine = engine.replace(
  /portId: 'in', dir: PortDir\.IN, type: StreamType\.MATERIAL/g,
  "portId: 'mat_in', dir: PortDir.IN, type: StreamType.MATERIAL"
);
console.log("  sink/valve/restriction/splitter port def: in→mat_in (engine only)");

// --- grid_supply: port def 'out' → 'elec_out' ---
engine = engine.replace(
  /portId: 'out', dir: PortDir\.OUT, type: StreamType\.ELECTRICAL/g,
  "portId: 'elec_out', dir: PortDir.OUT, type: StreamType.ELECTRICAL"
);
console.log("  grid_supply port def: out→elec_out");

// --- sink_electrical: port def 'in' → 'elec_in' ---
engine = engine.replace(
  /portId: 'in', dir: PortDir\.IN, type: StreamType\.ELECTRICAL/g,
  "portId: 'elec_in', dir: PortDir.IN, type: StreamType.ELECTRICAL"
);
console.log("  sink_electrical port def: in→elec_in");

// --- Presentation keys: { out:{x: → { mat_out:{x: ---
// Source/source_multi/source_air presentations: "ports: { out:{x:"
engine = engine.replace(/ports: \{ out: ?\{x:/g, 'ports: { mat_out:{x:', );
console.log("  source presentations: out→mat_out");

// Sink presentations: "ports: { in:{x:"
engine = engine.replace(/ports: \{ in: ?\{x:/g, 'ports: { mat_in:{x:');
console.log("  sink presentations: in→mat_in");

// Valve/restriction presentations: ", out:{x:"
engine = engine.replace(/, out: ?\{x:/g, ', mat_out:{x:');
console.log("  valve/restriction presentations: ,out→,mat_out");

// Now fix grid_supply presentations (were incorrectly set to mat_out by the broad replace)
// Grid supply's presentations are after "type: StreamType.ELECTRICAL" in the registration.
// They now say mat_out but should say elec_out. Find them by surrounding context.
engine = engine.replace(
  /(UnitRegistry\.register\('grid_supply'[\s\S]*?presentations: \{[\s\S]*?)(mat_out)/g,
  (match, before, port) => {
    // Replace all mat_out in this block with elec_out
    return match;
  }
);
// Actually use a simpler approach: the grid_supply presentations are the only ones
// between "category: UnitCategories.POWER," and the grid_supply tick.
// Let me find grid_supply's registration and fix its presentations directly.
const gsRegStart = engine.indexOf("UnitRegistry.register('grid_supply'");
const gsRegEnd = engine.indexOf('});', engine.indexOf('tick(u, ports, par, ctx)', gsRegStart));
if (gsRegStart > 0 && gsRegEnd > 0) {
  let gsBlock = engine.substring(gsRegStart, gsRegEnd + 3);
  // In the presentations section, replace mat_out with elec_out
  gsBlock = gsBlock.replace(/\bmat_out\b(?=:\{x:)/g, 'elec_out');
  gsBlock = gsBlock.replace(/\bmat_out\b(?=: ?\{x:)/g, 'elec_out');
  engine = engine.substring(0, gsRegStart) + gsBlock + engine.substring(gsRegEnd + 3);
  console.log("  grid_supply presentations: mat_out→elec_out (fix)");
}

// Fix sink_electrical presentations (were incorrectly set to mat_in by the broad replace)
const seRegStart = engine.indexOf("UnitRegistry.register('sink_electrical'");
const seRegEnd = engine.indexOf('});', engine.indexOf('tick(u, ports, par, ctx)', seRegStart));
if (seRegStart > 0 && seRegEnd > 0) {
  let seBlock = engine.substring(seRegStart, seRegEnd + 3);
  seBlock = seBlock.replace(/\bmat_in\b(?=:\{x:)/g, 'elec_in');
  seBlock = seBlock.replace(/\bmat_in\b(?=: ?\{x:)/g, 'elec_in');
  engine = engine.substring(0, seRegStart) + seBlock + engine.substring(seRegEnd + 3);
  console.log("  sink_electrical presentations: mat_in→elec_in (fix)");
}

// --- Tick functions: ports.out = { type: StreamType.MATERIAL ---
engine = engine.replace(
  /ports\.out = \{\s*\n(\s*)type: StreamType\.MATERIAL/g,
  'ports.mat_out = {\n$1type: StreamType.MATERIAL'
);
console.log("  tick: ports.out→ports.mat_out (MATERIAL)");

// --- Tick: ports.out = { type: StreamType.ELECTRICAL ---
engine = engine.replace(
  /ports\.out = \{\s*\n(\s*)type: StreamType\.ELECTRICAL/g,
  'ports.elec_out = {\n$1type: StreamType.ELECTRICAL'
);
console.log("  tick: ports.out→ports.elec_out (ELECTRICAL)");

// --- Tick: const sIn = ports.in; ---
// In the engine section, this appears in: sink, splitter
// (sink_electrical also but its tick is different)
engine = engine.replace(/const sIn = ports\.in;/g, 'const sIn = ports.mat_in;');
console.log("  tick: ports.in→ports.mat_in (sink/splitter)");

// Fix sink_electrical tick (was changed to mat_in but should be elec_in)
engine = engine.replace(
  'const sIn = ports.mat_in;\n    const rated_W',
  'const sIn = ports.elec_in;\n    const rated_W'
);
console.log("  sink_electrical tick: mat_in→elec_in (fix)");

// --- _isenthalpicThrottleTick ---
engine = engine.replace(
  'const sIn = ports.in || ports.mat_in;',
  'const sIn = ports.mat_in;'
);
console.log("  isenthalpic: remove dual-read fallback");

engine = engine.replace(/ports\.out = ports\.mat_out = \{/g, 'ports.mat_out = {');
console.log("  isenthalpic: remove dual-write");

// --- Solver traceToAnchor ---
engine = engine.replace(
  "scene, nextId, 'out', Pout,\n      anchorP, P_atm, new Set(visited)",
  "scene, nextId, 'mat_out', Pout,\n      anchorP, P_atm, new Set(visited)"
);
console.log("  traceToAnchor valve: out→mat_out");

engine = engine.replace(
  "scene, nextId, 'out', P_after,\n      anchorP, P_atm, visited, valveStatus, dividerStatus",
  "scene, nextId, 'mat_out', P_after,\n      anchorP, P_atm, visited, valveStatus, dividerStatus"
);
console.log("  traceToAnchor restriction: out→mat_out");

// --- P_column: fix value semantics ---
engine = engine.replace(
  '(par.P_column ?? 1.0) * 1e5',
  '(par.P_column ?? 1e5)'
);
console.log("  distillation tick: remove bar→Pa conversion");

engine = engine.replace(
  'P_column: 1.0, lightKey:',
  'P_column: 1e5, lightKey:'
);
console.log("  placeUnit defaults: P_column→1e5");

// Reassemble
src = engine + rest;

// ════════════════════════════════════════════════════════════════
// 3. Inspector P_column (in UI section, after test boundary is fine)
// ════════════════════════════════════════════════════════════════
console.log('\n=== 3. Inspector P_column ===');

replace(
  "{ label: 'Column P (bar)', get: () => u.params.P_column ?? 1.0,\n        set: v => u.params.P_column = Math.max(0.1, Math.min(50, v)),\n        step: 0.5, decimals: 1 }",
  "{ label: 'Column P (bar)', get: () => (u.params.P_column ?? 1e5) / 1e5,\n        set: v => u.params.P_column = Math.max(0.1, Math.min(50, v)) * 1e5,\n        step: 0.5, decimals: 1 }",
  "inspector P_column: Pa storage with bar display"
);

// Test P_column values: bar→Pa
replace(/P_column: 5,/g, 'P_column: 5e5,', 'test P_column: 5→5e5');

// ════════════════════════════════════════════════════════════════
// 4. Demo scene connections — context-aware bare 'in'/'out'
// ════════════════════════════════════════════════════════════════
console.log('\n=== 4. Demo scene ===');

const demoUnits = {
  'feed': 'source_multi', 'mix': 'mixer', 'rx': 'reactor_equilibrium',
  'cool': 'air_cooler', 'flash': 'flash_drum', 'split': 'splitter',
  'snk-ch4': 'sink', 'snk-h2o': 'sink',
  'solar': 'grid_supply', 'batt': 'battery', 'hub': 'power_hub',
  'hub-q': 'sink_electrical',
  'n2-feed': 'source', 'n2-tank': 'tank', 'n2-vent': 'sink', 'n2-ov': 'sink',
  'a-grid': 'grid_supply', 'a-air': 'source_air',
  'a-comp': 'compressor', 'a-fuel': 'source', 'a-mix': 'mixer',
  'a-comb': 'reactor_equilibrium', 'a-turb': 'gas_turbine',
  'a-exh': 'sink', 'a-eout': 'sink_electrical',
  'ab-hex': 'hex',
  'b-feed': 'source_multi', 'b-rx': 'reactor_equilibrium',
  'b-valve': 'valve', 'b-prod': 'sink', 'b-grid': 'grid_supply',
  'c-grid': 'grid_supply', 'c-src': 'source', 'c-pump': 'pump', 'c-sink': 'sink',
  'd-grid': 'grid_supply', 'd-hub': 'power_hub', 'd-dump': 'sink_electrical',
  'd-n2': 'source', 'd-comp': 'compressor', 'd-csnk': 'sink',
  'd-h2o': 'source', 'd-htr': 'electric_heater', 'd-hsnk': 'sink'
};

const connStart = src.indexOf("connections: [", src.indexOf("scene.importJSON"));
const connEnd = src.indexOf("],\n    modelsActive:", connStart);
if (connStart > 0 && connEnd > 0) {
  let connSection = src.substring(connStart, connEnd);
  let demoRenames = 0;
  connSection = connSection.replace(
    /unitId: '([^']+)', portId: '(in|out)'/g,
    (match, unitId, portId) => {
      const defId = demoUnits[unitId];
      const renames = defId ? portRenameMap[defId] : null;
      if (renames && renames[portId]) {
        demoRenames++;
        return `unitId: '${unitId}', portId: '${renames[portId]}'`;
      }
      return match;
    }
  );
  src = src.substring(0, connStart) + connSection + src.substring(connEnd);
  console.log(`  Demo scene: ${demoRenames} connection port renames`);
  changeCount += demoRenames;
}

// ════════════════════════════════════════════════════════════════
// 5. importJSON migration block
// ════════════════════════════════════════════════════════════════
console.log('\n=== 5. importJSON migration ===');

const migrationCode = `
    // [v14.5.0 S-CLEAN Phase 1] Port naming migration
    if (Array.isArray(data.connections)) {
      const defIdMap = new Map();
      if (Array.isArray(data.units)) {
        for (const u of data.units) defIdMap.set(u.id, u.defId);
      }
      const directMap = {
        'in1': 'mat_in_1', 'in2': 'mat_in_2',
        'out1': 'mat_out_1', 'out2': 'mat_out_2',
        'mat_out_D': 'dist_out', 'mat_out_B': 'bot_out'
      };
      const matOut = new Set(['source','source_multi','source_air','valve','restriction','mixer']);
      const matIn = new Set(['sink','valve','restriction','splitter']);
      const elOut = new Set(['grid_supply']);
      const elIn = new Set(['sink_electrical']);
      for (const c of data.connections) {
        for (const side of ['from', 'to']) {
          if (!c[side]) continue;
          const pId = c[side].portId;
          if (directMap[pId]) { c[side].portId = directMap[pId]; continue; }
          if (pId === 'out') {
            const def = defIdMap.get(c[side].unitId);
            if (elOut.has(def)) c[side].portId = 'elec_out';
            else if (matOut.has(def)) c[side].portId = 'mat_out';
          }
          if (pId === 'in') {
            const def = defIdMap.get(c[side].unitId);
            if (elIn.has(def)) c[side].portId = 'elec_in';
            else if (matIn.has(def)) c[side].portId = 'mat_in';
          }
        }
      }
    }

    // [v14.5.0 S-CLEAN] P_column_bar → P_column (Pa)
    if (Array.isArray(data.units)) {
      for (const u of data.units) {
        if (u.defId === 'distillation_column' && u.params && u.params.P_column_bar != null) {
          u.params.P_column = u.params.P_column_bar * 1e5;
          delete u.params.P_column_bar;
        }
      }
    }`;

const tankMigEnd = "      }\n    }\n\n    // ── Phase 2: Validate";
replace(tankMigEnd,
  "      }\n    }" + migrationCode + "\n\n    // ── Phase 2: Validate",
  "importJSON: add port + P_column migration");

// ════════════════════════════════════════════════════════════════
// 6. Test suite — context-aware bare 'in'/'out' renames
//    Uses regex replace callbacks to preserve exact whitespace
// ════════════════════════════════════════════════════════════════
console.log('\n=== 6. Test suite ===');

const testStart = src.indexOf('<!-- TEST SUITE');
let preTest = src.substring(0, testStart);
let testSection = src.substring(testStart);
const testLines = testSection.split('\n');

const varMap = new Map();
let testRenames = 0;

function renamePort(varName, portName) {
  const def = varMap.get(varName);
  if (def && portRenameMap[def] && portRenameMap[def][portName]) {
    return portRenameMap[def][portName];
  }
  return portName;
}

for (let i = 0; i < testLines.length; i++) {
  const line = testLines[i];

  // Reset var map at each test block
  if (line.includes('t.test(') || line.includes('t.solo(') || /\btest\s*\(/.test(line)) {
    varMap.clear();
  }

  // Track t.place('defId', ...)
  const placeMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*t\.place\s*\(\s*'([^']+)'/);
  if (placeMatch) varMap.set(placeMatch[1], placeMatch[2]);

  // Track scene.placeUnit('defId', ...)
  const scnPlace = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:scene|PG\.scene)\.placeUnit\s*\(\s*'([^']+)'/);
  if (scnPlace) varMap.set(scnPlace[1], scnPlace[2]);

  let newLine = line;

  // ── t.wire(a, 'port', b, 'port') ── uses callback to preserve exact whitespace
  newLine = newLine.replace(
    /t\.wire\((\s*\w+\s*),(\s*)'([^']+)'(\s*),(\s*\w+\s*),(\s*)'([^']+)'(\s*)\)/g,
    (match, vAws, s1, pA, s2, vBws, s3, pB, s4) => {
      const vA = vAws.trim();
      const vB = vBws.trim();
      const nA = renamePort(vA, pA);
      const nB = renamePort(vB, pB);
      if (nA !== pA || nB !== pB) testRenames++;
      return `t.wire(${vAws},${s1}'${nA}'${s2},${vBws},${s3}'${nB}'${s4})`;
    }
  );

  // ── t.port(var, 'in|out') ──
  newLine = newLine.replace(
    /t\.port\((\s*\w+\s*),(\s*)'(in|out)'(\s*)\)/g,
    (match, vws, s1, pName, s2) => {
      const v = vws.trim();
      const nP = renamePort(v, pName);
      if (nP !== pName) testRenames++;
      return `t.port(${vws},${s1}'${nP}'${s2})`;
    }
  );

  // ── t.ud(var).ports.in / .out ──
  newLine = newLine.replace(
    /t\.ud\((\s*\w+\s*)\)\.ports\.(in|out)\b/g,
    (match, vws, pName) => {
      const v = vws.trim();
      const nP = renamePort(v, pName);
      if (nP !== pName) testRenames++;
      return `t.ud(${vws}).ports.${nP}`;
    }
  );

  // ── scene.connect(a, 'port', b, 'port') ──
  newLine = newLine.replace(
    /scene\.connect\((\s*\w+\s*),(\s*)'([^']+)'(\s*),(\s*\w+\s*),(\s*)'([^']+)'(\s*)\)/g,
    (match, vAws, s1, pA, s2, vBws, s3, pB, s4) => {
      const vA = vAws.trim();
      const vB = vBws.trim();
      const nA = renamePort(vA, pA);
      const nB = renamePort(vB, pB);
      if (nA !== pA || nB !== pB) testRenames++;
      return `scene.connect(${vAws},${s1}'${nA}'${s2},${vBws},${s3}'${nB}'${s4})`;
    }
  );

  // ── Inline JSON: unitId: varName, portId: 'in|out' ──
  newLine = newLine.replace(
    /unitId:(\s*)(\w+)(\s*),(\s*)portId:(\s*)'(in|out)'/g,
    (match, s1, vName, s2, s3, s4, pName) => {
      const nP = renamePort(vName, pName);
      if (nP !== pName) testRenames++;
      return `unitId:${s1}${vName}${s2},${s3}portId:${s4}'${nP}'`;
    }
  );

  testLines[i] = newLine;
}

console.log(`  Test suite: ${testRenames} port renames`);
src = preTest + testLines.join('\n');

// ════════════════════════════════════════════════════════════════
// 7. Version bump
// ════════════════════════════════════════════════════════════════
console.log('\n=== 7. Version bump ===');
replace('processThis v14.4.0', 'processThis v14.5.0', 'version bump');

// ════════════════════════════════════════════════════════════════
// VERIFY: check for stale bare 'in'/'out' port names that should be renamed
// ════════════════════════════════════════════════════════════════
console.log('\n=== Verification ===');

// Check for remaining bare portId: 'out' / 'in' in the engine section
const engineAfter = src.substring(0, src.indexOf('<!-- TEST SUITE'));
const staleOut = (engineAfter.match(/portId: 'out'/g) || []).length;
const staleIn = (engineAfter.match(/portId: 'in'/g) || []).length;
console.log(`  Stale portId:'out' in engine: ${staleOut} (expect 0)`);
console.log(`  Stale portId:'in' in engine: ${staleIn} (expect 0)`);

// ════════════════════════════════════════════════════════════════
// WRITE
// ════════════════════════════════════════════════════════════════
if (hasCRLF) { src = src.replace(/\n/g, '\r\n'); console.log('Restored \\r\\n line endings'); }
fs.writeFileSync(FILE, src, 'utf8');
console.log(`\n=== DONE ===`);
console.log(`Total changes: ~${changeCount + testRenames}`);
console.log(`File size: ${origLen} → ${src.length} (Δ ${src.length - origLen})`);
console.log('\nNext: node --max-old-space-size=2048 _runTests.js');
