// SND-ASSETS (SOUND-2026-10-04 §7.2): music candidates from the Free Music Archive.
//
//   node tools/audio/fma_fetch.js --albums albums.json          ledger every track of every album (metadata only)
//   node tools/audio/fma_fetch.js --download --ids 243029,265835  fetch chosen tracks (licence re-checked per track)
//   node tools/audio/fma_fetch.js --genre Jazz --pages 3 --tag st.jazz   ledger a genre's tracks, each album's licence read
//                                                                          once (the genre pages list 20 tracks a page)
//
// Ledger: assets/audio/music_ledger.json (local). Files: assets/audio/raw/music/ (gitignored).
// Accepted licences: CC0 1.0 and CC BY (any version). NC, ND and SA are refused — the game may be sold, and a
// share-alike track would drag its terms onto whatever the game builds from it.
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const LEDGER = path.join(ROOT, 'assets', 'audio', 'music_ledger.json');
const RAW = path.join(ROOT, 'assets', 'audio', 'raw', 'music');
const UA = 'Mozilla/5.0 (flyDiy SND-ASSETS; music candidate ledger)';
const PACE = 3000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
const unesc = s => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// the licence a page declares: the first creativecommons.org link in it
function licenceOf(html) {
  const m = /creativecommons\.org\/(publicdomain\/zero\/1\.0|licenses\/([a-z-]+)\/(\d\.\d))/.exec(html);
  if (!m) return null;
  if (m[1].startsWith('publicdomain')) return 'CC0-1.0';
  return 'CC-' + m[2].toUpperCase() + '-' + m[3];
}
const accepted = l => l === 'CC0-1.0' || /^CC-BY-\d/.test(l || '');

function load() { try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch (e) { return { v: 1, tracks: {} }; } }
function save(L) { fs.mkdirSync(path.dirname(LEDGER), { recursive: true }); fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1) + '\n'); }

async function album(L, url, tag) {
  const html = await get(url);
  const lic = licenceOf(html);
  const re = /data-track-info='([^']*)'/g;
  let m, n = 0;
  while ((m = re.exec(html))) {
    const d = JSON.parse(unesc(m[1]));
    const prev = L.tracks[d.id] || {};
    L.tracks[d.id] = Object.assign({}, prev, {
      id: d.id, title: d.title, artist: d.artistName, album: d.albumTitle,
      page: d.url, artistUrl: d.artistUrl, file: d.fileUrl,
      albumLicence: lic, tags: Array.from(new Set([...(prev.tags || []), tag].filter(Boolean))),
      seen: prev.seen || new Date().toISOString().slice(0, 10),
    });
    n++;
  }
  return { n, lic };
}

// a genre's pages: the tracks, then each album's licence line (one fetch per album); only accepted licences stay
async function genre(L, name, pages, tag) {
  const albums = new Map();
  let kept = 0, seen = 0;
  for (let p = 1; p <= pages; p++) {
    const html = await get(`https://freemusicarchive.org/genre/${name}/?page=${p}`);
    const re = /data-track-info='([^']*)'/g;
    let m;
    while ((m = re.exec(html))) {
      const d = JSON.parse(unesc(m[1]));
      seen++;
      const albumUrl = d.url.replace(/[^/]+\/$/, '');
      if (!albums.has(albumUrl)) {
        await sleep(PACE);
        try { albums.set(albumUrl, licenceOf(await get(albumUrl))); } catch (e) { albums.set(albumUrl, null); }
      }
      const lic = albums.get(albumUrl);
      if (!accepted(lic)) continue;
      const prev = L.tracks[d.id] || {};
      L.tracks[d.id] = Object.assign({}, prev, {
        id: d.id, title: d.title, artist: d.artistName, album: d.albumTitle, page: d.url, artistUrl: d.artistUrl,
        file: d.fileUrl, albumLicence: lic, genre: name, rank: prev.rank || seen,
        tags: Array.from(new Set([...(prev.tags || []), tag].filter(Boolean))),
        seen: prev.seen || new Date().toISOString().slice(0, 10),
      });
      kept++;
    }
    save(L);
    await sleep(PACE);
  }
  return { seen, kept, albums: albums.size };
}

async function download(L, ids) {
  fs.mkdirSync(RAW, { recursive: true });
  for (const id of ids) {
    const t = L.tracks[id];
    if (!t) { console.log('skip', id, '(not in ledger)'); continue; }
    const page = await get(t.page);
    const lic = licenceOf(page);
    t.licence = lic;
    if (!accepted(lic)) { console.log('SKIP', id, t.title, 'licence', lic); t.licenceCheck = 'refused'; save(L); await sleep(PACE); continue; }
    if (!t.file) {   // a genre page's track info carries no file: read it off the track's own page
      const m = new RegExp(`data-track-info='([^']*"id":${t.id},[^']*)'`).exec(page);
      if (m) t.file = JSON.parse(unesc(m[1])).fileUrl;
      if (!t.file) { console.log('SKIP', id, t.title, 'no file url on its page'); save(L); continue; }
    }
    const buf = await get(t.file, true);
    const safe = (t.artist + '_' + t.title).replace(/[^A-Za-z0-9]+/g, '_').slice(0, 80);
    const file = path.join(RAW, `${id}_${safe}.mp3`);
    fs.writeFileSync(file, buf);
    t.licenceCheck = new Date().toISOString().slice(0, 10);
    t.raw = path.relative(ROOT, file).replace(/\\/g, '/');
    t.bytes = buf.length;
    console.log('got', id, (buf.length / 1048576).toFixed(1) + ' MB', lic, t.artist, '-', t.title);
    save(L);
    await sleep(PACE);
  }
}

(async () => {
  const argv = process.argv.slice(2);
  const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const L = load();
  if (argv.includes('--download')) await download(L, (opt('--ids') || '').split(',').filter(Boolean).map(Number));
  else if (opt('--genre')) console.log(opt('--genre'), await genre(L, opt('--genre'), +(opt('--pages') || 2), opt('--tag')));
  else if (opt('--albums')) {
    for (const a of JSON.parse(fs.readFileSync(opt('--albums'), 'utf8'))) {
      const r = await album(L, a.url, a.tag);
      console.log(r.n, r.lic, a.url);
      save(L);
      await sleep(PACE);
    }
  } else { console.log('usage: see the header'); process.exit(1); }
  save(L);
})().catch(e => { console.error(e); process.exit(1); });
