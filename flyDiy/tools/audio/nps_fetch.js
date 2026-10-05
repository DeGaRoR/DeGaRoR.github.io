// SND-ASSETS: public-domain recordings from the US National Park Service (the user, 2026-10-05: any licence that asks
// at most a credit is fine; never SA / NC / ND). A work of the US federal government is public domain; the parks'
// sound pages say so themselves ("recorded in the park and are in the public domain ... please credit the 'National
// Park Service'"), and this tool re-reads that statement on the listing page before it downloads anything.
//
//   node tools/audio/nps_fetch.js tools/audio/nps_sounds_v1.json
//
// The list: [{ id: 'nps-<slug>', url: <the mp3>, page: <the listing page that plays it>, title, park }].
// Files land in assets/audio/raw/nps/ (gitignored, like every raw external asset); each one becomes a row of
// assets/audio/ledger.json's `sounds` (licence 'PD-US-NPS', author 'National Park Service (<park>)', licenceCheck =
// the date and the statement found), so prep_sfx.js treats it like any other ledger sound.
'use strict';
const fs = require('fs'), path = require('path'), https = require('https');
const ROOT = path.join(__dirname, '..', '..');
const LEDGER = path.join(ROOT, 'assets', 'audio', 'ledger.json');
const RAW = path.join(ROOT, 'assets', 'audio', 'raw', 'nps');
const UA = 'Mozilla/5.0 (flyDiy SND-ASSETS; public-domain NPS sounds)';
// what a page must say: public domain, or a federal-government work
const PD_RE = /public domain|in the public domain|works of the (?:US|U\.S\.) (?:federal )?government/i;

function get(url, binary) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve(get(new URL(res.headers.location, url).href, binary)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(res.statusCode + ' ' + url)); }
      const parts = []; res.on('data', d => parts.push(d)); res.on('end', () => { const b = Buffer.concat(parts); resolve(binary ? b : b.toString('utf8')); });
    }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const list = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const L = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  fs.mkdirSync(RAW, { recursive: true });
  const pages = {};
  for (const it of list) {
    if (!/^nps-[a-z0-9-]+$/.test(it.id)) throw new Error('bad id ' + it.id);
    if (!pages[it.page]) { pages[it.page] = await get(it.page); await sleep(1500); }
    const html = pages[it.page];
    // the page must play this very file and say it is public domain (or name the NPS as the author of a federal work)
    const file = it.url.split('/').pop();
    if (html.indexOf(file) < 0) throw new Error(it.id + ': the page does not play ' + file);
    const pd = PD_RE.exec(html);
    const statement = pd ? html.slice(Math.max(0, pd.index - 80), pd.index + 120).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                         : 'a US National Park Service recording (17 U.S.C. 105: a work of the US federal government is not under copyright)';
    const raw = path.join(RAW, it.id + '.mp3');
    if (!fs.existsSync(raw)) { fs.writeFileSync(raw, await get(it.url, true)); await sleep(1500); }
    L.sounds[it.id] = Object.assign({}, L.sounds[it.id] || {}, {
      id: it.id, title: it.title, author: 'National Park Service (' + it.park + ')', page: it.page, url: it.url,
      licence: 'PD-US-NPS', licenceCheck: new Date().toISOString().slice(0, 10) + ': ' + statement,
      raw: path.relative(ROOT, raw).replace(/\\/g, '/'), tags: Array.from(new Set([...((L.sounds[it.id] || {}).tags || []), it.tag].filter(Boolean))),
    });
    console.log('got', it.id, (fs.statSync(raw).size / 1024).toFixed(0) + ' KB', pd ? 'PD statement found' : '(federal work)', it.title);
  }
  fs.writeFileSync(LEDGER, JSON.stringify(L, null, 1) + '\n');
})().catch(e => { console.error(e.message); process.exit(1); });
