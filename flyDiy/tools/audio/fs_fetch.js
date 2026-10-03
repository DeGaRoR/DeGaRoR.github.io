// SND-ASSETS (SOUND-2026-10-04 §7.1): CC0 candidates from freesound.org.
//
// Reads freesound's PUBLIC search pages (no API key, no account) filtered to
// Creative Commons 0, and records every hit in assets/audio/ledger.json:
// id, author, title, duration, sample rate, downloads, rating page, licence,
// the query that found it and the date. Metadata only by default.
//
//   node tools/audio/fs_fetch.js --set sets.json            metadata for every query in a set file
//   node tools/audio/fs_fetch.js --q "forest ambience" --tag amb.forest [--pages 2]
//   node tools/audio/fs_fetch.js --download --ids 850507,860231   fetch the HQ previews (ogg) of chosen ids
//
// Downloads land in assets/audio/raw/freesound/ (gitignored, like every raw
// external asset); only tools/audio/prep.js writes the shipped media/audio/.
// The licence is re-checked on the sound's own page before any download.
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const LEDGER = path.join(ROOT, 'assets', 'audio', 'ledger.json');
const RAW = path.join(ROOT, 'assets', 'audio', 'raw', 'freesound');
const UA = 'Mozilla/5.0 (flyDiy SND-ASSETS; CC0 candidate ledger)';

function get(url, binary) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).href, binary));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(res.statusCode + ' ' + url)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const unesc = s => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function searchUrl(q, page) {
  const f = encodeURIComponent('license:"Creative Commons 0"');
  return `https://freesound.org/search/?q=${encodeURIComponent(q)}&f=${f}&s=Rating+highest+first&g=1&page=${page}`;
}

// One result block per sound: the player carries every data-* attribute.
function parseResults(html) {
  const out = [];
  const re = /data-sound-id="(\d+)"([\s\S]*?)(?=data-sound-id="|$)/g;
  let m;
  while ((m = re.exec(html))) {
    const blk = m[2];
    const a = k => { const r = new RegExp('data-' + k + '="([^"]*)"').exec(blk); return r ? unesc(r[1]) : null; };
    const id = +m[1];
    if (out.some(o => o.id === id)) continue;
    const ogg = a('ogg') || '';
    out.push({
      id,
      title: a('title'),
      author: a('username'),
      duration: +a('duration') || null,
      samplerate: +a('samplerate') || null,
      downloads: +a('num-downloads') || 0,
      preview: ogg ? ogg.replace(/-lq\.ogg$/, '-hq.ogg') : null,
    });
  }
  return out;
}

function loadLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch (e) { return { v: 1, sounds: {} }; }
}
function saveLedger(L) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1) + '\n');
}

async function search(L, q, tag, pages) {
  let n = 0;
  for (let p = 1; p <= pages; p++) {
    const html = await get(searchUrl(q, p));
    const hits = parseResults(html);
    for (const h of hits) {
      const prev = L.sounds[h.id] || {};
      L.sounds[h.id] = Object.assign({}, prev, h, {
        licence: 'CC0-1.0',
        page: `https://freesound.org/people/${h.author}/sounds/${h.id}/`,
        tags: Array.from(new Set([...(prev.tags || []), tag].filter(Boolean))),
        queries: Array.from(new Set([...(prev.queries || []), q])),
        seen: prev.seen || new Date().toISOString().slice(0, 10),
      });
      n++;
    }
    if (hits.length === 0) break;
    await sleep(1500); // be polite
  }
  return n;
}

async function download(L, ids) {
  fs.mkdirSync(RAW, { recursive: true });
  for (const id of ids) {
    const s = L.sounds[id];
    if (!s || !s.preview) { console.log('skip', id, '(not in ledger)'); continue; }
    // re-check the licence on the sound's own page
    const page = await get(s.page);
    if (!/creativecommons\.org\/publicdomain\/zero\/1\.0/.test(page)) {
      console.log('SKIP', id, 'licence on the page is not CC0'); s.licenceCheck = 'failed'; continue;
    }
    const buf = await get(s.preview, true);
    const file = path.join(RAW, `${id}_${s.author}.ogg`);
    fs.writeFileSync(file, buf);
    s.licenceCheck = new Date().toISOString().slice(0, 10);
    s.raw = path.relative(ROOT, file).replace(/\\/g, '/');
    console.log('got', id, (buf.length / 1024).toFixed(0) + ' KB', s.title);
    await sleep(1500);
  }
}

(async () => {
  const argv = process.argv.slice(2);
  const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const L = loadLedger();
  if (argv.includes('--download')) {
    await download(L, (opt('--ids') || '').split(',').filter(Boolean).map(Number));
  } else if (opt('--set')) {
    const set = JSON.parse(fs.readFileSync(opt('--set'), 'utf8'));
    for (const row of set) console.log(row.tag, row.q, await search(L, row.q, row.tag, row.pages || 1));
  } else if (opt('--q')) {
    console.log(await search(L, opt('--q'), opt('--tag'), +(opt('--pages') || 1)));
  } else {
    console.log('usage: see the header'); process.exit(1);
  }
  saveLedger(L);
})().catch(e => { console.error(e); process.exit(1); });
