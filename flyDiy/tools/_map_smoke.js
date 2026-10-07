// _map_smoke.js - THE MAP SCREEN'S ROWS IN GATE UISMOKE / UISMOKE-PHONE (G2253, MAP-MENU). Called by test_ui_smoke.js with
// the built artifact's text; throws on the first broken rule, returns the lines it proved.
//   THE SANDBOX STAYS TODAY'S GAME: the page's loader block, run in a vm, shows NO MAP entry without ?map=1 (nor with
//     ?map=10, nor in the sandbox mode) and one with ?map=1 or FLYDIY_MODE 'career'; the entry appends nothing until it
//     is pressed, then the pack and the screen, in that order (BOOT: nothing loaded before opening). The artifact
//     carries the two as LAZY names only - no static tag, no inlined body.
//   THE SCREEN'S ROWS: map_menu.js's pure core over the fixture and the baked projection - the five providers' tabs and
//     All (their rows summing to All), Fleet / Pilots / Market (the last two "coming" on the fixture; G2290: the real
//     record's Pilots tab lists the roster), every contract's card stating both
//     ends, both strips, the payload and the pay; the fleet against a job as facts that forbid nothing; a build card's
//     criteria; track one, accept many; a selection's markers and route; the gear rule equal to 25_airfield.js's.
//   NOHOVER (MOBILE-GARAGE R17/R18) for the new UI: no title=, no mouseenter / mouseover / pointerover, no :hover in
//     map_menu.js or the entry. R1: every interactive class >= 48 px. --phone: the phone's card (no Fly), the sheet's
//     gestures (R20: the map touch-action none, the sheet pan-y).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

module.exports = function mapSmoke(html, phone) {
  const lines = [];
  const need = (c, what) => { if (!c) throw new Error('MAP-MENU: ' + what); };
  const say = s => lines.push(s);
  const menuSrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_menu.js'), 'utf8');
  const packSrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_pack.js'), 'utf8');

  // ---- the artifact: lazy names only --------------------------------------------------------------------------------
  const lazySrc = /var SRC = (\{[^\n]*?\}), got = \{\}/.exec(html);
  need(lazySrc, 'the page has no lazy loader table');
  const SRC = JSON.parse(lazySrc[1]);
  need(/^src\/viewer\/map_menu\.js\?v=/.test(SRC.map_menu || '') && /^src\/viewer\/map_pack\.js\?v=/.test(SRC.map_pack || ''), 'map_menu / map_pack are not lazy names of the page');
  need(!/<script[^>]*src="src\/viewer\/map_(menu|pack)\.js/.test(html), 'the page carries a static <script> for the map screen');
  need(!html.includes('THE MAP SCREEN (G2252') && !html.includes('window.MAP_PACK ='), 'the map screen or its pack is inlined in the page');
  say('the map screen and its pack are lazy names only (no static tag, nothing inlined)');

  // ---- the loader block in a vm: the entry's rule, and nothing loaded before the press ---------------------------------
  const blocks = [...html.matchAll(/<script(?: type="text\/x-flydiy")?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const loader = blocks.find(b => b.includes('FLYDIY_MAP_ENTRY'));
  need(loader, 'no loader block carries FLYDIY_MAP_ENTRY');
  const run = (search, mode) => {
    const els = {}, appended = [];
    const mk = tag => { const e = { tag, style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'src') this.src = v; }, getAttribute(k) { return this.attrs[k]; } }; return e; };
    const body = { appendChild(e) { if (e.tag === 'script') { appended.push(e.attrs['data-lazy']); setImmediate(() => e.onload && e.onload()); } else if (e.id) els[e.id] = e; return e; } };
    const box = { location: { search }, FLYDIY_MODE: mode, console, Promise, setImmediate,
      localStorage: { getItem: () => null }, addEventListener() {},
      document: { body, head: body, readyState: 'complete', createElement: mk, getElementById: id => els[id] || null, addEventListener() {} } };
    box.window = box; vm.createContext(box); vm.runInContext(loader, box, { filename: 'lazy_loader' });
    return { box, els, appended };
  };
  for (const [q, mode, want] of [['', 'sandbox', false], ['?map=10', 'sandbox', false], ['?scenery=1', 'sandbox', false], ['?map=1', 'sandbox', true], ['', 'career', true], ['?audio=0&map=1', undefined, true]]) {
    const r = run(q, mode), b = r.els.mapEntry;
    need(!!b === want, (want ? 'no MAP entry' : 'a MAP entry') + ' with search "' + q + '" in mode ' + mode);
    need(!r.appended.some(n => /^map_/.test(n || '')), 'the map screen was fetched before the entry was pressed (' + q + ')');
    if (b) {
      need(!b.title && !b.attrs.title, 'the MAP entry carries a title= (NOHOVER)');
      const mh = /min-height:(\d+)px/.exec(b.style.cssText || ''), mw = /min-width:(\d+)px/.exec(b.style.cssText || '');
      need(mh && +mh[1] >= 48 && mw && +mw[1] >= 48, 'the MAP entry is under 48 px');
      b.onclick();
      need(r.appended.join() === 'map_pack,map_menu', 'pressing the entry appended ' + r.appended.join() + ', not the pack then the screen');
    }
  }
  say('the MAP entry: none in the sandbox (no flag, ?map=10, ?scenery=1); one with ?map=1 or in the career mode; nothing of the screen fetched before the press, then the pack and the screen');

  // ---- the core over the fixture and the projection -------------------------------------------------------------------
  const C = require('./flight_core.js');
  const MM = require(path.join(ROOT, 'src', 'viewer', 'map_menu.js'));
  const pack = JSON.parse(/window\.MAP_PACK = (\{[\s\S]*\});\s*$/.exec(packSrc)[1]);
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'contracts_sample.json'), 'utf8'));
  const M = MM.mapAdapt(raw, pack, null);
  need(M.providers.map(p => p.id).join() === 'trust,minedock,resort,survey,clients', 'the five providers (§R G-PROV: the mine and the dock merged): ' + M.providers.map(p => p.id).join());
  need(M.contracts.length === raw.contracts.length && M.contracts.length >= 10, 'the adapter dropped contracts');
  for (const c of M.contracts) for (const s of c.stages) for (const u of s.subs) for (const id of [u.from, u.to].filter(Boolean))
    need(M.aeros[id], c.id + ' names an aerodrome the projection lacks: ' + id);
  const all = MM.rowsOf(M, 'all').length, per = M.providers.map(p => MM.rowsOf(M, p.id).length);
  need(all === M.contracts.length && per.reduce((a, b) => a + b, 0) === all && per.every(n => n >= 1), 'the tabs: All ' + all + ', per provider ' + per.join('/'));
  const st = { tab: 'all', sel: null, layers: { contracts: true, fleet: true, fields: true, plots: false }, phone };
  const tabs = MM.tabsHTML(M, st);
  need((tabs.match(/data-tab="/g) || []).length === 9 && /data-tab="fleet"/.test(tabs) && /data-tab="pilots"/.test(tabs) && /data-tab="market"/.test(tabs), 'the tabs: All + 5 providers + Fleet, Pilots, Market');
  need(/coming/.test(MM.listHTML(M, Object.assign({}, st, { tab: 'pilots' }))), 'pilots is not a "coming" placeholder');
  need(!/coming/.test(MM.listHTML(M, Object.assign({}, st, { tab: 'market' }))), 'the Market is still a "coming" placeholder (G2280 PROCURE fills it)');
  need((MM.listHTML(M, st).match(/class="mmRow[ "]/g) || []).length === all, 'the All list does not draw every row');
  say('the rows: ' + M.providers.length + ' provider tabs + All (' + per.join(' + ') + ' = ' + all + '), Fleet (' + M.fleet.length + '), Pilots "coming", the Market below');
  // the card: everything needed, remotely
  for (const c of M.contracts) {
    const h = MM.cardHTML(M, Object.assign({}, st, { sel: 'c:' + c.id }));
    for (const u of MM.subsNow(M, c)) {
      for (const id of [u.from, u.to].filter(Boolean)) {
        const a = M.aeros[id];
        need(h.includes(a.name.replace(/&/g, '&amp;')) && h.includes(String(a.len).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m'), c.id + ': the card lacks ' + id + ' or its strip length');
      }
      if (u.load && u.load.kg) need(h.includes(u.load.kg + ' kg'), c.id + ': the card lacks the payload');
    }
    need(/ net/.test(h) && /data-act="accept"/.test(h) && /data-act="track"/.test(h), c.id + ': the card lacks the pay, Accept or Track');
    need(!/data-act="(accept|track)"[^>]*disabled/.test(h) && !/disabled[^>]*data-act="(accept|track)"/.test(h), c.id + ': a mismatch disabled Accept or Track (the card never forbids)');
    need(phone ? !/Fly it/.test(h) : /Fly it/.test(h), c.id + ': ' + (phone ? 'the phone card offers a flight' : 'the desktop card lacks Fly it'));
  }
  say('every card (' + M.contracts.length + '): both ends by name, both strips\' lengths, the payload, the pay, Accept and Track never disabled' + (phone ? ', no flight on the phone' : ''));
  // the fleet against a job: facts
  const parts = M.contracts.find(c => c.id === 'minedock.j.parts'), F = n => MM.factsFor(M, parts, M.fleet.find(f => f.slot === n)).map(x => (x.ok === true ? '+' : x.ok === false ? '-' : '?') + x.text);
  const cub = F('Cub'), jod = F('Jodel'), flt = F('C172 floats');
  need(cub.some(x => /^\+payload 120 kg: 148 kg spare/.test(x)) && cub.some(x => /^\+Jumbo Mine Street is 250 m gravel; certified take-off run 160 m/.test(x)) && cub.some(x => /^-Annette Dock: a water lane/.test(x)), 'the Cub\'s facts: ' + cub.join(' | '));
  need(jod.some(x => /^-payload 120 kg: 26 kg over its 94 kg/.test(x)) && jod.some(x => /^-Jumbo Mine Street is 250 m gravel; certified take-off run 280 m/.test(x)), 'the Jodel\'s facts: ' + jod.join(' | '));
  need(flt.some(x => /^-Jumbo Mine Street: floats land on water only/.test(x)) && flt.some(x => /^\+Annette Dock: water, on floats/.test(x)), 'the floats\' facts: ' + flt.join(' | '));
  say('the fleet against "Parts to the dock": Cub ' + cub.length + ' facts, Jodel ' + jod.length + ', C172 floats ' + flt.length + ' (spare / over, take-off run vs the strip, floats for water)');
  // the build card
  const fast = M.contracts.find(c => c.id === 'clients.b.fast4'), crit = MM.critsOf(M, fast), D = MM.designsOf(M);
  const v = (n, k) => MM.critFor(M, crit.find(x => x.k === k), D.find(d => d.name === n)).ok;
  need(v('Voyager', 'seats') === true && v('Cub', 'seats') === false && v('Voyager', 'tas') === null && v('Voyager', 'land') === null && v('C172 floats', 'land') === false,
    'the build criteria: seats from the spec, cruise and the strip need a flight, floats cannot land at the street');
  need(/The criteria, against your designs/.test(MM.cardHTML(M, Object.assign({}, st, { sel: 'c:clients.b.fast4' }))), 'the build card lacks its criteria');
  say('the build card: ' + crit.length + ' criteria x ' + D.length + ' designs (✓ / ✗ from the spec and the ledger, ◌ "needs a flight")');
  // the gear rule: equal to 25_airfield.js's on every strip of the record
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8'));
  for (const r of rec.layers.runways) {
    const a = { id: r.id, kind: +r.surface === 4 ? 'water' : 'strip', surface: r.surface, look: r.look };
    for (const g of ['wheels', 'floats', 'amphibian', 'skis']) need(MM.allows(g, M.aeros[r.id]).ok === C.stripAllows(g, a).ok, 'the gear rule differs from stripAllows: ' + g + ' at ' + r.id);
  }
  say('the gear rule equals 25_airfield.js stripAllows on the 8 strips x 4 gears');
  // track one, accept many; a selection's markers and route
  const M2 = MM.mapAdapt(raw, pack, null);
  MM.act(M2, 'resort.j.guests', 'track'); MM.act(M2, 'survey.j.count', 'accept'); MM.act(M2, 'minedock.j.parts', 'track');
  need(M2.career.tracked === 'minedock.j.parts' && ['minedock.reopen', 'resort.j.guests', 'survey.j.count', 'minedock.j.parts'].every(id => M2.career.accepted.includes(id)), 'track one, accept many');
  const sst = Object.assign({}, st, { sel: 'c:minedock.j.parts' }), mk = MM.markersOf(M2, sst), rt = MM.routesOf(M2, sst);
  need(mk.filter(m => m.on).length >= 2 && mk.some(m => m.kind === 'dest' && m.aero === 'SEA') && rt.some(r => r.bold), 'a selection lights its markers and draws its route');
  need(mk.filter(m => m.kind === 'contract').every(m => m.sel && m.sel.startsWith('c:')), 'a contract marker that selects no row');
  say('track one, accept many; a selection lights ' + mk.filter(m => m.on).length + ' markers and draws ' + rt.filter(r => r.bold).length + ' route; every marker selects its row');

  // ---- NOHOVER and R1 on the new UI's source ------------------------------------------------------------------------------
  const entry = loader.slice(loader.indexOf('G2252'), loader.indexOf('mapEntry();'));
  for (const [what, src] of [['map_menu.js', menuSrc], ['the MAP entry', entry]]) {
    const bad = (src.match(/title=|\.title\s*=|mouseenter|mouseover|pointerover|:hover|onmouse/g) || []);
    need(!bad.length, what + ' carries hover-only information: ' + bad.join(', '));
  }
  const css = /const CSS = `([\s\S]*?)`;/.exec(menuSrc)[1];
  for (const cls of ['mmTab', 'mmRow', 'mmBtn', 'mmBack', 'mmLink', 'mmHandle', 'mmClose', 'mmOpt', 'mmIn']) {
    const r = new RegExp('#mapScreen \\.' + cls + '\\{[^}]*?(?:min-height|height):(\\d+)px').exec(css);
    need(r && +r[1] >= 48, '.' + cls + ' is under 48 px (R1)');
  }
  need(/\.mmMk\{[^}]*width:48px;height:48px/.test(css) && /\.mmCtl button,#mapScreen \.mmLay\{min-width:48px;height:48px/.test(css), 'the markers / map controls are under 48 px (R1)');
  need(/\.mmMap\{[^}]*touch-action:none/.test(css) && /\.mmSheetBody\{[^}]*touch-action:pan-y/.test(css) && /\.mmList\{[^}]*touch-action:pan-y/.test(css), 'R20: the map and the sheet share a gesture');
  need(!/navigator\.userAgent|userAgentData|location\.hostname|pointer:\s*coarse|innerWidth\s*</.test(menuSrc), 'map_menu.js tests the device (only welcome.js and the profile table may)');
  say('NOHOVER: no title= / hover in the map screen or its entry; R1: every target >= 48 px; R20: the map (none) and the sheet (pan-y) apart; no device test');

  // ---- G2320 (CAREER-WIRE): THE SAME ROWS ON THE REAL RECORD - a new career (careerNew: every provider's first arc + 3
  // jobs) through 75_career_wire.js careerMapRecord, the adapter untouched but where the record differs from §7.3 -------
  need(/careerMapRecord\(careerNew\(/.test(menuSrc) && /FLYDIY_CAREER\.record\(\)/.test(menuSrc) && /mapsrc=fixture/.test(menuSrc), 'MAP_SOURCE is not the real record (FLYDIY_CAREER / a new career; ?mapsrc=fixture keeps the fixture)');
  const doc0 = C.careerNew({ id: 'dev', seed: 'dev' });
  const RR = C.careerMapRecord(doc0, null, {}), MR = MM.mapAdapt(RR, pack, null);
  need(MR.source === 'career' && MR.providers.map(p => p.id).join() === Object.keys(C.CONTRACT_PROVIDERS).join(), 'the real record: the five providers ' + MR.providers.map(p => p.id).join());
  need(MR.contracts.length === doc0.career.contracts.offered.length && MR.contracts.length === 5 * 4, 'the real record: a new career\'s 20 offers (' + MR.contracts.length + ')');
  for (const c of MR.contracts) for (const st of c.stages) for (const u of st.subs) for (const id of [u.from, u.to].filter(Boolean)) need(MR.aeros[id], c.id + ' names an aerodrome the projection lacks: ' + id);
  const allR = MM.rowsOf(MR, 'all').length, perR = MR.providers.map(p => MM.rowsOf(MR, p.id).length);
  need(allR === MR.contracts.length && perR.reduce((a, b) => a + b, 0) === allR && perR.every(n => n === 4), 'the real tabs: All ' + allR + ', per provider ' + perR.join('/'));
  need((MM.listHTML(MR, st).match(/class="mmRow[ "]/g) || []).length === allR, 'the real All list does not draw every row');
  for (const c of MR.contracts) {
    const h = MM.cardHTML(MR, Object.assign({}, st, { sel: 'c:' + c.id }));
    for (const u of MM.subsNow(MR, c)) {
      for (const id of [u.from, u.to].filter(Boolean)) {
        const a = MR.aeros[id];
        need(h.includes(a.name.replace(/&/g, '&amp;')) && h.includes(String(a.len).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m'), c.id + ': the real card lacks ' + id + ' or its strip length');
      }
      if (u.load && u.load.kg) need(h.includes(u.load.kg + ' kg'), c.id + ': the real card lacks the payload');
    }
    const P = MM.payOf(MR, c), want = C.contractPay(C.careerContract(doc0, c.id)).total;
    need(P.total === want && h.includes('<b>' + String(want).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '</b> net'), c.id + ': the card\'s pay is not contractPay\'s (' + P.total + ' vs ' + want + ')');
    need(!/\[(ct|job|prov|crit)\./.test(h) && !/\{(from|to|load|at)\}/.test(h), c.id + ': an unresolved text key or slot on the card');
    need(/data-act="accept"/.test(h) && /data-act="track"/.test(h) && !/data-act="(accept|track)"[^>]*disabled/.test(h), c.id + ': the real card lacks Accept / Track, or disables one');
    need(phone ? !/Fly it/.test(h) : /Fly it/.test(h), c.id + ': the real card\'s flight button on the ' + (phone ? 'phone' : 'desktop'));
  }
  const mkR = MM.markersOf(MR, st).filter(m => m.kind === 'contract');
  need(mkR.length === MR.contracts.length && mkR.every(m => m.sel && m.sel.startsWith('c:')), 'the real record: every contract a marker that selects its row (' + mkR.length + ')');
  say('the real record (a new career, careerNew + careerMapRecord): ' + MR.providers.length + ' provider tabs + All (' + perR.join(' + ') + ' = ' + allR + '); every card both ends, both strips, the payload, contractPay\'s pay, no unresolved key, Accept / Track; every contract a marker');
  // the fleet on the real record: the career's own airframes (the voucher's maker Cub: CONTRACT_DESIGNS' certificate; one
  // not read yet), and a build contract's criteria against them (the clients' first delivery, offered after clients.01)
  const doc1 = JSON.parse(JSON.stringify(doc0));
  doc1.fleet = { Cub: { aero: 'HOME' }, Kit: { aero: 'w3' } };
  doc1.career.airframes = { Cub: { design: 'cub' } };
  doc1.career.contracts.done.push({ id: 'clients.01', at: 0, pay: 1500 });
  const M1 = MM.mapAdapt(C.careerMapRecord(doc1, null, {}), pack, null);
  const cubF = M1.fleet.find(f => f.slot === 'Cub'), kitF = M1.fleet.find(f => f.slot === 'Kit');
  need(cubF && cubF.cert && cubF.cert.payloadKg === 90 && kitF && kitF.cert === null, 'the real fleet: the Cub\'s certificate (90 kg payload), the kit not read yet');
  const carry = M1.contracts.find(c => c.kind === 'job' && MM.subsNow(M1, c).some(u => u.do === 'carry' && u.load && u.load.kg));
  const fx = MM.factsFor(M1, carry, cubF), fk = MM.factsFor(M1, carry, kitF);
  need(fx.some(x => /^payload \d+ kg: /.test(x.text)) && fk.length === 1 && fk[0].ok === null && /not read yet/.test(fk[0].text), 'the real fleet against ' + carry.id + ': ' + fx.map(x => x.text).join(' | '));
  const b2 = M1.contracts.find(c => c.id === 'clients.02');
  need(b2 && b2.kind === 'build', 'the clients\' first delivery (clients.02) is offered after clients.01');
  const cr2 = MM.critsOf(M1, b2), cv = k => MM.critFor(M1, cr2.find(x => x.k === k), MM.designsOf(M1).find(d => d.name === 'Cub')).ok;
  need(cv('seats') === true && cv('emptyKg') === false && cv('spanM') === false && cr2.every(x => x.words), 'the real build criteria against the Cub: seats ✓, empty mass ✗, span ✗ (worded by contractCritWords)');
  // the held-out contract never reaches the map
  const doc2 = JSON.parse(JSON.stringify(doc0));
  for (const id of ['clients.01', 'clients.02', 'clients.03', 'clients.04']) doc2.career.contracts.done.push({ id, at: 0, pay: 0 });
  doc2.career.providers.clients.rep = 5;
  need(!C.careerMapRecord(doc2, null, {}).contracts.some(c => c.id === 'clients.05'), 'the aerobatic box (+6 g, past the certificate) reached the map');
  // ---- G2280 (PROCURE): THE MARKET TAB - the makers' catalogues (validated builds only), then the used listings where
  // they stand; a model's card states its certificate and its options sheet; a listing's card where it stands, its
  // history and its price; Buy in the career, Take (free) in the sandbox; the listings on the map at their aerodrome ------
  {
    const KC = MM.marketAdapt(C, doc0), KS = MM.marketAdapt(C, C.playerDefault());
    need(KC && KC.makers.length === 4 && KC.makers.every(m => m.models.length >= 1) && KC.mode === 'career' && KS.mode === 'sandbox', 'the market: four makers, a career and a sandbox');
    const ids = [].concat(...KC.makers.map(m => m.models));
    need(ids.every(id => Object.values(C.PROCURE_MODELS[id].designs).every(d => C.CONTRACT_DESIGNS[d] && C.CONTRACT_DESIGNS[d].build)), 'a catalogue model that is not a validated build');
    need(KC.used.length >= 1 && KC.used.length <= 4 && KC.used.every(L => MR.aeros[L.aero]), 'the used listings: 1-4, each at an aerodrome of the map (' + KC.used.length + ')');
    const MK = Object.assign({}, MR, { market: KC }), MS = Object.assign({}, MR, { market: KS });
    const mst = Object.assign({}, st, { tab: 'market' });
    const lh = MM.listHTML(MK, mst);
    need((lh.match(/data-sel="m:/g) || []).length === ids.length && (lh.match(/data-sel="u:/g) || []).length === KC.used.length && lh.indexOf('data-sel="m:') < lh.indexOf('data-sel="u:'), 'the Market list: the makers\' models, then the used listings');
    for (const id of ids) {
      const h = MM.cardHTML(MK, Object.assign({}, mst, { sel: 'm:' + id }));
      need(/Its certificate/.test(h) && /take-off run/.test(h) && /cruise/.test(h) && /data-opt="/.test(h) && /data-act="buy"[^>]*>Buy · /.test(h), id + ': the model card lacks its certificate, options or Buy');
      need(!/\[(mk|mdl|opt|used)\./.test(h) && !/undefined|NaN/.test(h), id + ': an unresolved key on the model card');
      need(/data-act="buy"[^>]*>Take it · free in the sandbox/.test(MM.cardHTML(MS, Object.assign({}, mst, { sel: 'm:' + id }))), id + ': the sandbox card does not Take it free');
      need(!phone || /data-act="back"/.test(h), id + ': the phone card has no way back to the list');
    }
    for (const L of KC.used) {
      const h = MM.cardHTML(MK, Object.assign({}, mst, { sel: 'u:' + L.id })), a = MR.aeros[L.aero];
      need(h.includes(a.name.replace(/&/g, '&amp;')) && /it stands at/.test(h) && /Its history/.test(h) && /data-act="buy"[^>]*>Buy where it stands · /.test(h) && /bring it home \(free\)/.test(h), L.id + ': the listing card lacks where it stands, its history or Buy');
      need(!/\[(mk|mdl|opt|used)\./.test(h) && !/undefined|NaN/.test(h), L.id + ': an unresolved key on the listing card');
    }
    const mkU = MM.markersOf(MK, mst).filter(m => m.kind === 'used');
    need(mkU.length === KC.used.length && mkU.every(m => m.sel.startsWith('u:') && m.aero === KC.used.find(L => 'u:' + L.id === m.sel).aero), 'the listings\' markers stand at their aerodromes');
    need(!MM.markersOf(MK, st).some(m => m.kind === 'used'), 'the listings\' markers show outside the Market');
    // the drawing board: the career - a design waits to be built, an airframe can be filed as a design; the sandbox:
    // every slot is both (nothing to build)
    const docB = JSON.parse(JSON.stringify(doc0)); docB.fleet = { Mine: { aero: 'HOME' } }; docB.career.airframes = { Mine: { from: 'board' } };
    const hb = MM.listHTML(Object.assign({}, MR, { market: MM.marketAdapt(C, docB, C.procureBoard(docB, ['Idea', 'Mine'])) }), mst);
    need(/data-board="build" data-slot="Idea"/.test(hb) && /data-board="save" data-slot="Mine"/.test(hb), 'the drawing board: Build this design (a design), Save as design (an airframe)');
    const hs = MM.listHTML(Object.assign({}, MR, { market: MM.marketAdapt(C, C.playerDefault(), C.procureBoard(C.playerDefault(), ['Idea'])) }), mst);
    need(/every saved design is also an aeroplane/.test(hs) && !/data-board=/.test(hs), 'the sandbox\'s drawing board: every slot is both, nothing to build');
    say('the Market: ' + ids.length + ' models of 4 makers (validated builds only; a certificate, an options sheet, Buy / Take free in the sandbox' + (phone ? ', a way back on the phone' : '') + '), ' + KC.used.length + ' used listings where they stand, each a marker at its aerodrome');
  }
  say('the real fleet: the Cub\'s certificate against "' + carry.title + '" (' + fx.length + ' facts), a kit "not read yet"; clients.02\'s criteria against it; the aerobatic box held out');
  // ---- G2290 (PILOTS): THE PILOTS TAB on the real record - the companion hired, 2-3 looking for work; a card each with the
  // portrait placeholder, "flies like", the traits, the fee, the place; Hire / Fire 48 px buttons (the live career's only:
  // disabled in the preview); pilots as markers; the fixture (the sandbox's ?map=1) keeps "coming" ---------------------------
  const pst = Object.assign({}, st, { tab: 'pilots' });
  const PL = MR.pilots || [], ph = MM.listHTML(MR, pst);
  need(PL.length >= 3 && PL.length <= 4 && PL.filter(p => p.hired).map(p => p.id).join() === 'kit' && PL.filter(p => !p.hired).every(p => p.onOffer), 'the real Pilots tab: kit hired, 2-3 looking for work (' + PL.map(p => p.id + (p.hired ? '*' : '')).join() + ')');
  need(!/coming/.test(ph) && (ph.match(/class="mmPilot/g) || []).length === PL.length && (ph.match(/class="mmFace"/g) || []).length === PL.length, 'the Pilots tab draws a card per pilot (no "coming")');
  for (const p of PL) {
    need(ph.includes('data-sel="p:' + p.id + '"') && ph.includes(p.fliesLike.replace(/&/g, '&amp;').replace(/'/g, '&#39;')) && p.traits.every(t => ph.includes('<i class="mmTrait">' + t.label)), p.id + ': the card lacks its row, "flies like" or a trait chip');
    need(p.hired ? /data-pa="fire"/.test(ph) : ph.includes('data-pa="hire" data-pid="' + p.id + '"'), p.id + ': the card lacks ' + (p.hired ? 'Fire' : 'Hire'));
    const card = MM.cardHTML(MR, Object.assign({}, pst, { sel: 'p:' + p.id }));
    need(card.includes('<h2>' + p.name + '</h2>') && /Flies like/.test(card) && /Traits/.test(card) && !/\[pilot\./.test(card), p.id + ': the detail card');
    need(phone ? /data-act="back"/.test(card) : true, p.id + ': the phone\'s card has no way back');
  }
  need(/data-act="pilot"[^>]*disabled/.test(ph), 'the preview (no live career) lets Hire / Fire act');
  need(MM.markersOf(MR, pst).some(m => m.kind === 'pilot' && m.sel === 'p:kit' && m.aero === 'HOME'), 'the hired pilot is not a marker at HOME');
  need(/coming/.test(MM.listHTML(M, pst)), 'the fixture\'s Pilots tab (the sandbox ?map=1) is no longer "coming"');
  need(/#mapScreen \.mmPRow\{[^}]*min-height:(\d+)px/.test(css) && +/#mapScreen \.mmPRow\{[^}]*min-height:(\d+)px/.exec(css)[1] >= 48, '.mmPRow is under 48 px (R1)');
  say('the Pilots tab (real record): ' + PL.map(p => p.name + (p.hired ? ' (hired)' : ' (' + p.signOn + ')')).join(', ') + '; a card each (face, flies like, traits, the fee, the place), Hire / Fire, a marker; the fixture\'s still "coming"');
  return lines;
};
