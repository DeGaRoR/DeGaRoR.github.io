#!/usr/bin/env node
// ===========================================================================
// ISLAND FETCH — download the raw source data for URSOY.
// ===========================================================================
//
//   node tools/island_fetch.js              from the flyDiy folder
//
// That is the whole thing. No bash, no jq, no Python — the same `node` you
// already run the gates and the server with. It replaces an earlier .sh that
// assumed a Unix shell on a Windows machine, which was my mistake.
//
// It downloads about 10 GB into assets/island/raw/, which is gitignored and
// never published. Players never touch any of this: it is a BUILD INPUT that
// gets turned into one ~40 MB asset. See futureDesigns/ISLAND-PREPACK.md §5b.
//
// SAFE TO STOP AND RESTART. Every file is resumed from where it stopped, and
// finished files are skipped. Ctrl-C, close the laptop, run it again tomorrow.
//
// FLAGS (all optional)
//   --dtm-only     just the ground (~1.5 GB, 39 tiles) — enough to see the
//                  island. The DSM and radar cells are the other ~8.5 GB and
//                  are only needed for trees and surface variation.
//   --list         show what WOULD be downloaded, and stop. Costs nothing.
//   --out <dir>    default assets/island/raw
// ===========================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API = 'https://tnmaccess.nationalmap.gov/api/v1/products';
const WC = 'https://esa-worldcover.s3.amazonaws.com/v200/2021/map';
const BBOX = '-135.2,57.0,-133.5,58.3';         // the Ursoy footprint

const argv = process.argv.slice(2);
const has = f => argv.includes('--' + f);
const val = (f, d) => { const i = argv.indexOf('--' + f); return i < 0 ? d : argv[i + 1]; };
const OUT = path.resolve(ROOT, val('out', 'assets/island/raw'));
const LIST = has('list'), DTM_ONLY = has('dtm-only');

const MB = b => (b / 1048576).toFixed(1);

// ---- the three USGS datasets, by their exact TNM tags --------------------
const SETS = [
  { tag: 'Alaska IFSAR 5 meter DEM',            dir: 'dtm',
    what: 'the ground — 39 tiles, this is the island itself' },
  { tag: 'Ifsar Digital Surface Model (DSM)',   dir: 'dsm',
    what: 'canopy top; DSM minus DTM gives real forest height' },
  { tag: 'Ifsar Orthorectified Radar Image (ORI)', dir: 'ori',
    what: 'radar intensity — the variation mask, and it has no colour' },
];

async function listSet(tag) {
  const items = [];
  for (let offset = 0, total = 1; offset < total; offset += 100) {
    const url = `${API}?datasets=${encodeURIComponent(tag)}` +
                `&bbox=${encodeURIComponent(BBOX)}&outputFormat=JSON` +
                `&max=100&offset=${offset}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`TNM API ${r.status} for "${tag}"`);
    const j = await r.json();
    if (typeof j.total !== 'number' || !Array.isArray(j.items))
      throw new Error(`unexpected TNM response for "${tag}" — the API shape ` +
                      `changed; see ISLAND-PREPACK.md §2`);
    total = j.total;
    for (const it of j.items)
      if (it.downloadURL) items.push({ url: it.downloadURL, size: it.sizeInBytes || 0 });
  }
  return items;
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
  console.log('URSOY — raw source acquisition');
  console.log(`  bbox ${BBOX}`);
  console.log(`  into ${path.relative(ROOT, OUT) || OUT}`);

  const sets = DTM_ONLY ? SETS.slice(0, 1) : SETS;
  const plan = [];
  for (const s of sets) {
    process.stdout.write(`\n  ${s.dir} — ${s.what}\n    querying… `);
    const items = await listSet(s.tag);
    const bytes = items.reduce((a, b) => a + b.size, 0);
    console.log(`${items.length} file(s), ${MB(bytes)} MB`);
    plan.push({ ...s, items });
  }

  // WorldCover: two fixed tiles, no API needed
  const cover = ['N57W135', 'N57W138'].map(t => ({
    url: `${WC}/ESA_WorldCover_10m_2021_v200_${t}_Map.tif`, size: 0 }));
  if (!DTM_ONLY) {
    plan.push({ dir: 'cover', items: cover,
      what: 'terrain type — CC-BY 4.0, THE ONE attribution this world owes' });
    console.log(`\n  cover — 2 file(s)`);
  }

  const total = plan.reduce((a, p) => a + p.items.reduce((x, y) => x + y.size, 0), 0);
  console.log(`\n  TOTAL ${MB(total)} MB across ` +
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
  console.log('    python3 tools/island_prep.py --in assets/island/raw/dtm \\');
  console.log('        --out bench/ursoy/dem --cell 25');
  console.log('    node tools/terrain_bake.js --source grid \\');
  console.log('        --grid bench/ursoy/dem --eps 4 --out bench/terrain/ursoy');
  console.log('\n  Attribution owed, in full:');
  console.log('    ESA WorldCover 10 m v200, (c) ESA / VITO, CC-BY 4.0');
  console.log('    Elevation and radar: USGS 3DEP Alaska IFSAR (public domain)');
}

main().catch(e => { console.error('\nisland_fetch: ' + e.message); process.exit(1); });
