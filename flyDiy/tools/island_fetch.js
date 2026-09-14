#!/usr/bin/env node
// ===========================================================================
// ISLAND FETCH — download the raw source data for ONE island.
// ===========================================================================
//
//   node tools/island_fetch.js --island jolene       from the flyDiy folder
//
// That is the whole thing. No bash, no jq, no Python — the same `node` you
// already run the gates and the server with.
//
// It downloads into assets/island/raw/<island>/, which is gitignored and
// never published. Players never touch any of this: it is a BUILD INPUT that
// gets turned into one small asset. See futureDesigns/ISLAND-PREPACK.md §5b.
//
// SAFE TO STOP AND RESTART. Every file is resumed from where it stopped, and
// finished files are skipped. Ctrl-C, close the laptop, run it again tomorrow.
//
// THE API IS FOR DISCOVERY ONLY. TNM Access answers a bounding box with the
// tiles that touch it — and on 2026-09-14 it timed out three times in a row
// on Annette's whole box while answering a quarter of it at once. So the
// query is split when it times out, every product is filtered against the
// ISLAND'S footprint (not the query box, which catches open water and the
// neighbours), and each island PINS the products it has already resolved:
// with the pins, the script needs nothing from the API at all, which is the
// point — no live dependency on a third-party service in the pipeline.
//
// FLAGS (all optional)
//   --island <name>   jolene (default) or ursoy. See ISLANDS below.
//   --dtm-only        just the ground — enough to see the island. The DSM
//                     and radar cells are only needed for trees and surface
//                     variation.
//   --list            show what WOULD be downloaded, and stop. Costs nothing.
//   --no-api          use the pins only; never ask TNM Access.
//   --out <dir>       default assets/island/raw/<island>
// ===========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API = 'https://tnmaccess.nationalmap.gov/api/v1/products';
const S3 = 'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation';
const WC = 'https://esa-worldcover.s3.amazonaws.com/v200/2021/map';

// ---- the islands -----------------------------------------------------------
// bbox: the ISLAND's own footprint (W,S,E,N), tight. A product is kept when
// its own footprint intersects this — not the query box.
// cover: ESA WorldCover 3° tiles, named by their SW corner.
// pins: download URLs already resolved for this island, by set. The API
// result is merged over them, so a pin never goes stale and a new tile the
// API finds is not lost.
const ISLANDS = {
  jolene: {
    // JOLENE ISLAND (the game's name, ruled 2026-09-14). Source: Annette
    // Island, Alaska — the real name lives here and in the raw data only.
    title: 'JOLENE — the first island (source: Annette, 2026-09-14)',
    bbox: [-131.75, 54.95, -131.25, 55.35],
    cover: ['N54W132'],
    pins: {
      // one 845 MB tile of the Lower Southeast project holds the whole island
      dtm: [`${S3}/OPR/Projects/Lower_Southeast_Alaska_Mid_Accuracy_DEM/` +
            `AK_Ifsar-LowerSE-L3-C379_2012/TIFF/` +
            `USGS_AK5M_Lower_Southeast_Alaska_Mid_Accuracy_DEM_1903.tif`],
      // the SE Alaska cell holds the island; the Chugach2 sliver touches its
      // north-east corner. Resolved 2026-09-14 by footprint, HEAD-checked.
      dsm: [`${S3}/DSM/TIFF/USGS_NED_DSM_AK_Ifsar_LowerSE_L3_C379_2012_TIFF_2016.zip`,   // 813 MB
            `${S3}/DSM/TIFF/USGS_NED_DSM_AK_IFSAR_Chugach2_C391_2014_TIFF_2018.zip`],   //  55 MB
      ori: [`${S3}/ORI/TIFF/USGS_NED_ORI_AK_Ifsar_LowerSE_L3_C379_2012_TIFF_2016.zip`,   // 1147 MB
            `${S3}/ORI/TIFF/USGS_NED_ORI_AK_IFSAR_Chugach2_C391_2014_TIFF_2018.zip`],   //   76 MB
    },
  },
  ursoy: {
    title: 'URSOY — Admiralty Island (ISLAND-ADMIRALTY.md)',
    bbox: [-134.95, 57.05, -133.75, 58.25],
    cover: ['N57W135', 'N57W138'],
    pins: { dtm: [], dsm: [], ori: [] },
  },
};

const argv = process.argv.slice(2);
const has = f => argv.includes('--' + f);
const val = (f, d) => { const i = argv.indexOf('--' + f); return i < 0 ? d : argv[i + 1]; };
const NAME = val('island', 'jolene');
const ISLAND = ISLANDS[NAME];
if (!ISLAND) {
  console.error(`island_fetch: unknown island '${NAME}' — one of ` +
                Object.keys(ISLANDS).join(', '));
  process.exit(1);
}
const OUT = path.resolve(ROOT, val('out', `assets/island/raw/${NAME}`));
const LIST = has('list'), DTM_ONLY = has('dtm-only'), NO_API = has('no-api');

const MB = b => (b / 1048576).toFixed(1);

// ---- the three USGS datasets, by their exact TNM tags --------------------
const SETS = [
  { tag: 'Alaska IFSAR 5 meter DEM',            dir: 'dtm',
    what: 'the ground — bare earth, this is the island itself' },
  { tag: 'Ifsar Digital Surface Model (DSM)',   dir: 'dsm',
    what: 'canopy top; DSM minus DTM gives real forest height' },
  { tag: 'Ifsar Orthorectified Radar Image (ORI)', dir: 'ori',
    what: 'radar intensity — the variation mask, and it has no colour' },
];

const intersects = (a, b) => // [W,S,E,N] boxes
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// One query, one box. Throws on a timeout so the caller can split.
async function query(tag, box, offset) {
  const url = `${API}?datasets=${encodeURIComponent(tag)}` +
              `&bbox=${encodeURIComponent(box.join(','))}&outputFormat=JSON` +
              `&max=100&offset=${offset}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error(`TNM API ${r.status} for "${tag}"`);
  const j = await r.json();
  if (typeof j.total !== 'number' || !Array.isArray(j.items))
    throw new Error(j.message || `unexpected TNM response for "${tag}"`);
  return j;
}

// Discover a set over a box: page it; on a timeout, split the box in four
// and recurse. Products are keyed by URL, so the overlap between quarters
// costs nothing.
async function discover(tag, box, found, depth = 0) {
  try {
    for (let offset = 0, total = 1; offset < total; offset += 100) {
      const j = await query(tag, box, offset);
      total = j.total;
      for (const it of j.items) {
        if (!it.downloadURL) continue;
        const bb = it.boundingBox;
        const foot = bb ? [bb.minX, bb.minY, bb.maxX, bb.maxY] : null;
        if (foot && !intersects(foot, ISLAND.bbox)) continue;   // a neighbour
        found.set(it.downloadURL, { url: it.downloadURL, size: it.sizeInBytes || 0 });
      }
    }
  } catch (e) {
    if (depth >= 2) { console.log(`\n    (API: ${e.message} — using pins)`); return; }
    const [w, s, e_, n] = box, mx = (w + e_) / 2, my = (s + n) / 2;
    process.stdout.write('split… ');
    for (const q of [[w, s, mx, my], [mx, s, e_, my], [w, my, mx, n], [mx, my, e_, n]])
      await discover(tag, q, found, depth + 1);
  }
}

async function listSet(set) {
  const found = new Map();
  for (const url of ISLAND.pins[set.dir] || [])
    found.set(url, { url, size: 0 });
  if (!NO_API) await discover(set.tag, ISLAND.bbox, found);
  return [...found.values()];
}

// Resumable single file. Node's fetch gives a web stream; we pump it to disk
// so a 700 MB cell never sits in memory.
async function grab(url, dest) {
  const name = url.split('/').pop();
  let from = 0;
  if (fs.existsSync(dest)) from = fs.statSync(dest).size;

  const head = await fetch(url, { method: 'HEAD' });
  const full = Number(head.headers.get('content-length') || 0);
  if (full && from === full) { console.log(`    = ${name}  (have it)`); return full; }
  if (from > 0 && full && from > full) { fs.unlinkSync(dest); from = 0; }

  const r = await fetch(url, from ? { headers: { Range: `bytes=${from}-` } } : {});
  if (!r.ok && r.status !== 206) throw new Error(`${r.status} on ${name}`);
  const out = fs.createWriteStream(dest, { flags: from ? 'a' : 'w' });

  let got = from, tick = Date.now();
  for await (const chunk of r.body) {
    out.write(Buffer.from(chunk));
    got += chunk.length;
    if (Date.now() - tick > 1000) {
      tick = Date.now();
      const pct = full ? ` ${(100 * got / full).toFixed(0)}%` : '';
      process.stdout.write(`\r    ↓ ${name}  ${MB(got)} MB${pct}   `);
    }
  }
  await new Promise(res => out.end(res));
  process.stdout.write(`\r    ✓ ${name}  ${MB(got)} MB              \n`);
  return got;
}

async function main() {
  console.log(`${ISLAND.title} — raw source acquisition`);
  console.log(`  island bbox ${ISLAND.bbox.join(',')}`);
  console.log(`  into ${path.relative(ROOT, OUT) || OUT}`);

  const sets = DTM_ONLY ? SETS.slice(0, 1) : SETS;
  const plan = [];
  for (const s of sets) {
    process.stdout.write(`\n  ${s.dir} — ${s.what}\n    ${NO_API ? 'pins' : 'querying'}… `);
    const items = await listSet(s);
    const bytes = items.reduce((a, b) => a + b.size, 0);
    console.log(`${items.length} file(s)${bytes ? `, ${MB(bytes)} MB` : ''}`);
    for (const it of items) console.log(`      ${it.url.split('/').pop()}`);
    plan.push({ ...s, items });
  }

  // WorldCover: fixed tiles, no API needed. Wanted even with --dtm-only —
  // it is 80 MB and it is what tells the first look where the forest is.
  const cover = ISLAND.cover.map(t => ({
    url: `${WC}/ESA_WorldCover_10m_2021_v200_${t}_Map.tif`, size: 0 }));
  plan.push({ dir: 'cover', items: cover,
    what: 'terrain type — CC-BY 4.0, THE ONE attribution this world owes' });
  console.log(`\n  cover — ${cover.length} file(s): ${ISLAND.cover.join(' ')}`);

  const total = plan.reduce((a, p) => a + p.items.reduce((x, y) => x + y.size, 0), 0);
  console.log(`\n  TOTAL ${MB(total)} MB (sized files only) across ` +
              `${plan.reduce((a, p) => a + p.items.length, 0)} files`);

  if (LIST) {
    console.log('\n  (--list: nothing downloaded. Drop the flag to fetch.)');
    return;
  }

  console.log('\n  Downloading. Safe to stop with Ctrl-C and run again later —');
  console.log('  finished files are skipped and partial ones resume.\n');

  for (const p of plan) {
    const dir = path.join(OUT, p.dir);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  ${p.dir}/`);
    for (const it of p.items)
      await grab(it.url, path.join(dir, it.url.split('/').pop()));
  }

  console.log('\n  done.\n');
  console.log('  Next, from the flyDiy folder:');
  console.log(`    py -3.11 tools/island_prep.py --island ${NAME}`);
  console.log(`    node tools/terrain_bake.js --source grid \\`);
  console.log(`        --grid bench/${NAME}/dem --eps 4 --out bench/terrain/${NAME}`);
  console.log('\n  Attribution owed, in full:');
  console.log('    ESA WorldCover 10 m v200, (c) ESA / VITO, CC-BY 4.0');
  console.log('    Elevation and radar: USGS 3DEP Alaska IFSAR (public domain)');
}

main().catch(e => { console.error('\nisland_fetch: ' + e.message); process.exit(1); });
