// _map_smoke.js - THE MAP SCREEN'S ROWS IN GATE UISMOKE / UISMOKE-PHONE (G2253 MAP-MENU; G2328 MAP-SIMPLE, the screen
// rebuilt to the approved mock, GAME-2026-10-06.md §R.2). Called by test_ui_smoke.js with the built artifact's text; throws
// on the first broken rule, returns the lines it proved.
//   THE SANDBOX STAYS TODAY'S GAME: the page's loader block, run in a vm, shows NO MAP entry without ?map=1 (nor with
//     ?map=10, nor in the sandbox mode) and one with ?map=1 or FLYDIY_MODE 'career'; the entry appends nothing until it
//     is pressed, then the pack and the screen, in that order (BOOT: nothing loaded before opening). The artifact
//     carries the two as LAZY names only - no static tag, no inlined body.
//   THE SCREEN'S ROWS (MAP-SIMPLE): map_menu.js's pure core over the fixture, the real record and the baked projection -
//     NO RIGHT PANEL and no Fleet / Pilots / Market on it; one row per contract (the TYPE's colour, the title, the pay,
//     the mark); the customers a filter whose rows sum to All, never a colour; the paragraph (who + what + pay, the
//     runways condensed, the ✗'s reason) and ONE button, Track (accept + track, a second tap untracks); ✓ / ✗ ONLY on
//     the surface-vs-gear no-no's against the fleet (a build: none; payload, seats, runs never judged); the place filter
//     (a place's rows are exactly the contracts involving it); the map's levels of detail (badges always, the hotspots
//     from the second zoom step, their rings and counts closer, the runways at true scale with the designators their
//     names carry); NO AUTO-ZOOM (opening a row never touches the view); the gear rule equal to 25_airfield.js's.
//   THE SWITCH (G2440 MAP-MERGE): Contracts · Fleet · Pilots · Market at the top of the same list, the contracts list
//     exactly the above; Fleet / Pilots / Market drawn the contracts' way (a row: an icon, the title, ONE number; ONE
//     paragraph when opened, at most two buttons; no right panel, no card wall); the paragraphs state what a player
//     decides on (price, seats, payload, gear, range); G2280 PROCURE's market (the makers' models, the used listings
//     where they stand, the drawing board; Buy in the career, Take free in the sandbox) and G2290 PILOTS' roster (Hire /
//     Flies next / Fire, live only in the career); each list's markers on the map in the badge style, sized to the zoom,
//     a tap filtering the list to its place; the place filter across the lists; no auto-zoom from a row or a marker.
//   NOHOVER (MOBILE-GARAGE R17/R18): no title=, no mouseenter / mouseover / pointerover, no :hover in map_menu.js or the
//     entry. R1: every interactive class >= 48 px. R20: the map touch-action none, the list / sheet pan-y, the handle
//     none. --phone: the bottom sheet's rules.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

module.exports = function mapSmoke(html, phone) {
  const lines = [];
  const need = (c, what) => { if (!c) throw new Error('MAP: ' + what); };
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
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const escH = t => String(t).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'contracts_sample.json'), 'utf8'));
  const M = MM.mapAdapt(raw, pack, null);
  need(M.providers.map(p => p.id).join() === 'trust,minedock,resort,survey,clients', 'the five providers (§R G-PROV: the mine and the dock merged): ' + M.providers.map(p => p.id).join());
  need(M.contracts.length === raw.contracts.length && M.contracts.length >= 10, 'the adapter dropped contracts');
  for (const c of M.contracts) for (const st of c.stages) for (const u of st.subs) for (const id of [u.from, u.to].filter(Boolean))
    need(M.aeros[id], c.id + ' names an aerodrome the projection lacks: ' + id);
  // NO RIGHT PANEL, NO ASSET TABS: the list is the whole interface
  need(!/mmRight|cardHTML|tabsHTML|data-tab=|mmLayers/.test(menuSrc) && !MM.cardHTML && !MM.tabsHTML, 'the screen still carries a right panel, the provider tabs or the layer buttons');
  // (G2440) the switch at the top of the same list: Contracts · Fleet · Pilots · Market; the contracts list carries none of them
  const sw = MM.headHTML(M, { cust: 'all' });
  need((sw.match(/data-act="list"/g) || []).length === 4 && ['contracts', 'fleet', 'pilots', 'market'].every(l => sw.includes('data-list="' + l + '"')) && /class="mmSwB on" data-act="list" data-list="contracts"/.test(sw),
    'the switch: Contracts · Fleet · Pilots · Market, the contracts first');
  need(!/Fleet|Pilots|Market|data-list=/.test(MM.listHTML(M, { cust: 'all' })) && !/mmTypes|mmCust/.test(MM.headHTML(M, { cust: 'all', list: 'fleet' })), 'the contracts list carries the other lists, or the other lists the contracts\' legend / customer');
  // the customer filter: a select, whose rows sum to All
  const st = { cust: 'all', at: null, open: null, phone };
  const all = MM.rowsOf(M, st).length, per = M.providers.map(p => MM.rowsOf(M, { cust: p.id }).length);
  need(all === M.contracts.length && per.reduce((a, b) => a + b, 0) === all && per.every(n => n >= 1), 'the customer filter: All ' + all + ', per customer ' + per.join('/'));
  const head = MM.headHTML(M, st);
  need(/<select class="mmCust"/.test(head) && (head.match(/<option /g) || []).length === M.providers.length + 1, 'the customers are not a select (All + 5)');
  // one row per contract: the type's dot, the title, the pay, the mark; the colours are the TYPES', never a customer's
  const L = MM.listHTML(M, st);
  need((L.match(/class="mmRow"/g) || []).length === all && (L.match(/class="mmDot"/g) || []).length === all && (L.match(/class="mmPay"/g) || []).length === all, 'the All list does not draw one row (dot, title, pay, mark) per contract');
  const typeCols = MM.TYPES.map(t => t[2]), provCols = raw.providers.map(p => p.colour);
  need((L.match(/background:(#[0-9a-f]{6})/gi) || []).every(m => typeCols.includes(m.slice(11))) && !provCols.some(c => L.includes(c)), 'a row is coloured by its customer, not its type');
  const types = {}; for (const c of M.contracts) types[MM.typeOf(c)] = (types[MM.typeOf(c)] || 0) + 1;
  need(MM.typeOf(M.contracts.find(c => c.id === 'clients.b.fast4')) === 'build' && MM.typeOf(M.contracts.find(c => c.id === 'resort.j.guests')) === 'pax' &&
       MM.typeOf(M.contracts.find(c => c.id === 'survey.j.count')) === 'survey' && MM.typeOf(M.contracts.find(c => c.id === 'minedock.j.parts')) === 'cargo', 'the contract types (build / passengers / survey / cargo)');
  say('the list is the whole interface (no right panel, no provider tabs; the switch Contracts · Fleet · Pilots · Market on top): ' + all + ' rows (type dot, title, pay, mark), the customers a select (' + per.join(' + ') + ' = ' + all + '), coloured by type ' + JSON.stringify(types));
  // the paragraph and its one button
  const para = (MX, c) => MM.paraHTML(MX, c);
  const checkPara = (MX, c, tag) => {
    const h = para(MX, c), P = MM.payOf(MX, c);
    need(h.includes(escH(MX.prov[c.provider].name)) && h.includes(escH(c.brief)) && h.includes('Pays ' + fmt(P.total) + '.'), tag + c.id + ': the paragraph lacks who, what or the pay');
    for (const u of MM.subsAll(c)) for (const id of [u.from, u.to].filter(Boolean)) {
      const a = MX.aeros[id], over = u.do === 'survey' && id === u.to;
      need(h.includes(escH(a.name)) && (over || h.includes(escH(MM.stripWord(a)))), tag + c.id + ': the runways line lacks ' + id + (over ? '' : ' or its strip (' + MM.stripWord(a) + ')'));
    }
    need((h.match(/<button /g) || []).length === 1 && /data-act="track"/.test(h) && !/Accept|disabled/.test(h), tag + c.id + ': not ONE button, Track');
    need(!/payload|certified|seats|take-off|<ul|<table/i.test(h), tag + c.id + ': the paragraph carries a per-plane table or a judgement past the hard no-no\'s');
    const K = MM.markOf(MX, c);
    need(['✓', '✗', ''].includes(K.mark) && (K.mark === '✗') === /class="mmWhy"/.test(h) && (c.kind !== 'build' || K.mark === ''), tag + c.id + ': the mark (' + K.mark + ') or its reason');
    return h;
  };
  for (const c of M.contracts) checkPara(M, c, '');
  const ph = para(M, M.contracts.find(c => c.id === 'minedock.j.parts'));
  need(ph.includes('Jumbo Mine Street 250 × 18 m gravel, 347 m up → Annette Dock 1 500 m water lane · 14 km'), 'the runways condensed: ' + (/class="mmRw">([^<]*)/.exec(ph) || [])[1]);
  say('every paragraph (' + M.contracts.length + '): who + what + the pay, the runways condensed ("' + (/class="mmRw">([^<]*)/.exec(ph) || [])[1] + '"), the ✗\'s reason, ONE button (Track); no per-plane table');
  // ✓ / ✗ ONLY on the surface-vs-gear no-no's, against the fleet (wheels: Cub, Jodel, Voyager; floats: the C172)
  const mk = (MX, id) => MM.markOf(MX, MX.contracts.find(c => c.id === id));
  need(mk(M, 'minedock.j.parts').mark === '✗' && /water and land/.test(mk(M, 'minedock.j.parts').why) && mk(M, 'resort.j.guests').mark === '✓' && mk(M, 'trust.j.mail').mark === '✗' &&
       mk(M, 'clients.b.fast4').mark === '' && mk(M, 'resort.b.electric').mark === '', 'the marks on the fixture: parts ✗ (no plane both water and land), guests ✓, mail ✗, the builds none');
  const Mh = MM.mapAdapt(JSON.parse(JSON.stringify(raw)), pack, null); for (const f of Mh.fleet) if (f.cert) Object.assign(f.cert, { payloadKg: 0, seats: 1, toRunM: 9999, ldgRunM: 9999 });
  need(M.contracts.every(c => mk(Mh, c.id).mark === mk(M, c.id).mark), 'a mark moved with the payload, the seats or the runs (only the surface against the gear may judge)');
  const Ma = MM.mapAdapt(JSON.parse(JSON.stringify(raw)), pack, null); Ma.fleet[0].cert.gear = 'amphibian';
  need(mk(Ma, 'minedock.j.parts').mark === '✓' && mk(Ma, 'trust.j.mail').mark === '✓', 'an amphibian in the fleet does not clear the water and land jobs');
  const Mw = MM.mapAdapt(JSON.parse(JSON.stringify(raw)), pack, null); for (const f of Mw.fleet) if (f.cert) f.cert.gear = 'wheels';
  need(mk(Mw, 'trust.j.mail').mark === '✗' && /land on water/.test(mk(Mw, 'trust.j.mail').why) && mk(Mw, 'resort.j.guests').mark === '✓', 'a wheels-only fleet: the water job ✗ "cannot land on water"');
  const Mf = MM.mapAdapt(JSON.parse(JSON.stringify(raw)), pack, null); for (const f of Mf.fleet) if (f.cert) f.cert.gear = 'floats';
  need(mk(Mf, 'resort.j.guests').mark === '✗' && /floats/.test(mk(Mf, 'resort.j.guests').why), 'a floats-only fleet: the land job ✗ (floats only)');
  say('✓ / ✗ only on surface vs gear against the fleet: parts ✗ "' + mk(M, 'minedock.j.parts').why + '"; payload / seats / runs never move a mark; an amphibian clears them; wheels-only ✗ water, floats-only ✗ land; builds unmarked');
  // the place filter: a place's rows are exactly the contracts involving it
  for (const p of M.places) {
    const got = MM.rowsOf(M, { cust: 'all', at: p.id }).map(c => c.id).sort(), want = M.contracts.filter(c => MM.subsAll(c).some(u => p.aeros.includes(u.from) || p.aeros.includes(u.to))).map(c => c.id).sort();
    need(got.join() === want.join(), 'the place filter at ' + p.id + ': ' + got.join() + ' vs ' + want.join());
    const A = MM.atHTML(M, { at: p.id });
    need(A.includes('At ' + escH(p.name)) && /data-act="atx"/.test(A), 'the "At ' + p.name + ' ✕" row');
  }
  need(!MM.atHTML(M, st) && /No contract involves/.test(MM.listHTML({ ...M, contracts: [] }, { cust: 'all', at: 'nv_strip' })), 'the filter row without a place, or the empty place');
  need(M.places.map(p => p.name).join() === 'Jolene AFB,Tamgas Hill Strip,Annette Dock,Metlakatla Seaplane Base,Jumbo Mine Street,East Point Clearing,Skyline Altiport' &&
       M.places.map(p => p.kind).join() === 'airfield,strip,seaplane,seaplane,mine,clearing,altiport', 'the places and their kinds: ' + M.places.map(p => p.name + ' (' + p.kind + ')').join(', '));
  say('the place filter: ' + M.places.length + ' places (' + M.places.map(p => p.name + ' ' + MM.rowsOf(M, { at: p.id }).length).join(', ') + '), each listing exactly the contracts involving it, under "At <place> ✕"');
  // Track: accept and track are one gesture, a second tap untracks
  const M2 = MM.mapAdapt(JSON.parse(JSON.stringify(raw)), pack, null);
  MM.act(M2, 'resort.j.guests');
  need(M2.career.tracked === 'resort.j.guests' && M2.career.accepted.includes('resort.j.guests'), 'Track did not accept and track in one gesture');
  MM.act(M2, 'resort.j.guests');
  need(M2.career.tracked === null && M2.career.accepted.includes('resort.j.guests'), 'a second Track did not untrack');
  need(/★/.test(MM.listHTML(M, st).split('data-id="minedock.reopen"')[2].split('</button>')[0]), 'the tracked row lacks its ★');
  say('Track: one gesture accepts and tracks, a second tap untracks; the tracked row starred');
  // THE MAP's levels of detail, over the projection (fit 0.3 of a 900 px tall view)
  const Mo = MM.mapAdapt(JSON.parse(JSON.stringify(raw)), pack, null); Mo.career.tracked = null;   // nothing tracked: the names keyed on the zoom alone
  const fit = 0.3, ov = (k, st2, at) => { const s = fit * k, c = at || { x: 2000, z: -8000 }; return MM.overlayOf(Mo, st2 || st, pack, { s, fit, tx: 800 - ((c.x - pack.x0) / pack.mpp) * s, ty: 450 - ((c.z - pack.z0) / pack.mpp) * s }); };
  const o1 = ov(1), o2 = ov(1.5), o3 = ov(3), o8 = ov(8, st, { x: 140, z: 60 });
  need(o1.n.badges === M.places.length && o1.n.hot === 0 && o1.n.pois === 0 && o1.n.names === 0, 'at the fit: a badge per place and nothing else named (' + JSON.stringify(o1.n) + ')');
  need(o2.n.hot === pack.hotspots.length && o2.n.rings === 0 && o2.n.counts === 0 && o2.n.names === M.places.length, 'the second zoom step: every hotspot and the names, no rings or counts yet (' + JSON.stringify(o2.n) + ')');
  need(o3.n.rings > 0 && o3.n.counts === pack.hotspots.length && o3.n.pois === pack.pois.length && o3.n.facts === M.places.length, 'closer: the hotspots\' rings and counts, the places of interest, the runway facts (' + JSON.stringify(o3.n) + ')');
  need(o2.bs > o1.bs && o3.bs > o2.bs, 'the badges are not sized to the zoom (' + o1.bs + ' / ' + o2.bs + ' / ' + o3.bs + ' px)');
  need((o3.html.match(/class="mmHot sea"/g) || []).length === pack.hotspots.filter(h => h.kind === 'sea').length && pack.hotspots.some(h => h.kind === 'sea'), 'the sea hotspots are not blue');
  // close up at Jolene AFB: both runways at true scale with the designators their names carry
  const HOMEp = M.places.find(p => p.id === 'HOME');
  for (const id of HOMEp.aeros) {
    const a = M.aeros[id], d = MM.designators(a).slice().sort().join('/'), named = /(\d{2}\/\d{2})$/.exec(a.name)[1];
    need(d === named, a.id + '\'s designators ' + d + ' are not its name\'s ' + named);
    const g = (new RegExp('<g class="mmRwy" data-place="HOME" data-rwy="' + id + '"[\\s\\S]*?</g>').exec(o8.svg) || [''])[0];
    need(g && MM.designators(a).every(n => g.includes('>' + n + '</text>')) && (g.match(/<line /g) || []).length >= 9, id + ' is not drawn close up with its centreline, threshold bars and designators');
  }
  for (const a of Object.values(M.aeros)) if (/\d{2}\/\d{2}$/.test(a.name)) need(MM.designators(a).slice().sort().join('/') === /(\d{2}\/\d{2})$/.exec(a.name)[1], a.id + ' designators');
  const wet = MM.overlayOf(M, st, pack, { s: 2.4, fit, tx: 800 - ((360 - pack.x0) / 12) * 2.4, ty: 450 - ((-3661 - pack.z0) / 12) * 2.4 });
  need(/data-rwy="SEA"[\s\S]*?<circle[\s\S]*?<\/g>/.test(wet.svg) && (/data-rwy="SEA"[\s\S]*?<\/g>/.exec(wet.svg)[0].match(/<circle /g) || []).length >= 8, 'the water lane is not buoyed');
  need(/data-rwy="w3"[\s\S]*?stroke-dasharray="2 7"/.test(MM.overlayOf(M, st, pack, { s: 2.4, fit, tx: 800 - ((-800 - pack.x0) / 12) * 2.4, ty: 450 - ((-2400 - pack.z0) / 12) * 2.4 }).svg), 'the gravel strip has no edge markers');
  // every place is a tap: the badge, the name and the runway carry its id
  need(M.places.every(p => o3.html.includes('class="mmPl') && o3.html.includes('data-place="' + p.id + '"')) && /<button type="button" class="mmNm" data-place=/.test(o3.html) && /<g class="mmRwy" data-place="HOME"/.test(o8.svg), 'a place (badge, name or runway) is not a tap target');
  // the open / tracked contract's places ringed in its type's colour, named even at the fit; its route drawn
  const lit = ov(1, { cust: 'all', at: null, open: 'minedock.j.parts' });
  need(/data-place="mn_strip" [^>]*><i style="box-shadow:0 0 0 3px #d99a3c/.test(lit.html) && /data-place="SEA" [^>]*><i style="box-shadow:0 0 0 3px #d99a3c/.test(lit.html) && lit.n.routes >= 1 && lit.n.names >= 2, 'the open contract\'s places are not ringed in its type colour, named, and joined');
  say('the map: a badge per place at the fit (' + o1.bs + ' px), names + ' + o2.n.hot + ' hotspots from the second step (' + o2.bs + ' px), rings + counts + places + runway facts closer (' + o3.bs + ' px), close up every runway at true scale (Jolene AFB 13/31 and 02/20 with their designators; the lane buoyed, the gravel edge-marked); the open contract ringed in its type colour');
  // NO AUTO-ZOOM: opening a row (and a place filter) never touches the view
  const rowLine = /if \(a === 'row'\)[^\n]*/.exec(menuSrc), atLine = /function filterAt\([^\n]*/.exec(menuSrc);
  need(rowLine && atLine && !/zoom|fit\(|V\.|focus|place\(\)/.test(rowLine[0].replace(/renderList\(\)/, '')) && !/zoom|fit\(|V\.|focus/.test(atLine[0]) && !/function focus/.test(menuSrc), 'opening a row or filtering a place moves the map (no auto-zoom)');
  // (G2440) nor a row of the other lists, the switch, or a list's marker
  const more = ['if \\(a === \'item\'\\)', 'if \\(a === \'list\'\\)', 'if \\(t\\.dataset\\.key\\)'].map(r => new RegExp(r + '[^\\n]*').exec(menuSrc));
  need(more.every(l => l && !/zoom|fit\(|V\.|focus|place\(\)/.test(l[0].replace(/render(List)?\(\)/, ''))), 'a row of the other lists, the switch or a marker moves the map (no auto-zoom)');
  say('no auto-zoom: opening a row (any list), the switch, a marker or a place filter leaves the view as it was');
  // the gear rule: equal to 25_airfield.js's on every strip of the record
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8'));
  for (const r of rec.layers.runways) {
    const a = { id: r.id, kind: +r.surface === 4 ? 'water' : 'strip', surface: r.surface, look: r.look };
    for (const g of ['wheels', 'floats', 'amphibian', 'skis']) need(MM.allows(g, M.aeros[r.id]).ok === C.stripAllows(g, a).ok, 'the gear rule differs from stripAllows: ' + g + ' at ' + r.id);
  }
  say('the gear rule equals 25_airfield.js stripAllows on the 8 strips x 4 gears');

  // ---- NOHOVER, R1, R20 on the new UI's source ------------------------------------------------------------------------------
  const entry = loader.slice(loader.indexOf('G2252'), loader.indexOf('mapEntry();'));
  for (const [what, src] of [['map_menu.js', menuSrc], ['the MAP entry', entry]]) {
    const bad = (src.match(/title=|\.title\s*=|mouseenter|mouseover|pointerover|:hover|onmouse/g) || []);
    need(!bad.length, what + ' carries hover-only information: ' + bad.join(', '));
  }
  const css = /const CSS = `([\s\S]*?)`;/.exec(menuSrc)[1];
  for (const cls of ['mmRow', 'mmTrack', 'mmAtX', 'mmClose', 'mmCust', 'mmNm', 'mmSwB', 'mmAct', 'mmOptSel']) {
    const r = new RegExp('#mapScreen \\.' + cls + '\\{[^}]*?(?:min-height|height):(\\d+)px').exec(css);
    need(r && +r[1] >= 48, '.' + cls + ' is under 48 px (R1)');
  }
  need(/\.mmPl\{[^}]*width:48px;height:48px/.test(css) && /\.mmLm\{[^}]*width:48px;height:48px/.test(css) && /\.mmCtl button\{[^}]*min-width:48px;min-height:48px/.test(css) && /\.mmHandle\{[^}]*height:48px/.test(css), 'the place badges / the lists\' markers / map controls / the handle are under 48 px (R1)');
  need(/\.mmMap\{[^}]*touch-action:none/.test(css) && /\.mmList\{[^}]*touch-action:pan-y/.test(css) && /\.mmHandle\{[^}]*touch-action:none/.test(css), 'R20: the map and the sheet share a gesture');
  need(/\.mmMap\{[^}]*user-select:none/.test(css) && /dragstart/.test(menuSrc) && /selectstart/.test(menuSrc) && /draggable="false"/.test(menuSrc), 'the map lets the picture drag or the text select');
  need(/mmPhone \.mmSide\{[^}]*position:absolute;left:0;right:0;bottom:0/.test(css) && /mmPhone \.mmSide\.open\{/.test(css), 'the phone: the list is not a bottom sheet');
  need(!/navigator\.userAgent|userAgentData|location\.hostname|pointer:\s*coarse|innerWidth\s*</.test(menuSrc), 'map_menu.js tests the device (only welcome.js and the profile table may)');
  need(/map_art|art\.img|pack\.art/.test(menuSrc) && pack.art && /jolene_art\.[0-9a-f]{8}\.jpg$/.test(pack.art.img), 'the screen does not show the user\'s AI map (pack.art)');
  say('NOHOVER: no title= / hover in the map screen or its entry; R1: every target >= 48 px; R20: the map (none) and the list / sheet (pan-y) apart; no image drag or text selection; ' + (phone ? 'the phone\'s bottom sheet; ' : '') + 'the picture is the user\'s AI map (' + pack.art.img + ')');

  // ---- G2320 (CAREER-WIRE): THE SAME ROWS ON THE REAL RECORD - a new career (careerNew: every provider's first arc + 3
  // jobs) through 75_career_wire.js careerMapRecord; the fleet still empty, so the marks judge the voucher's aeroplane ----
  need(/careerMapRecord\(careerNew\(/.test(menuSrc) && /FLYDIY_CAREER\.record\(\)/.test(menuSrc) && /mapsrc=fixture/.test(menuSrc), 'MAP_SOURCE is not the real record (FLYDIY_CAREER / a new career; ?mapsrc=fixture keeps the fixture)');
  const doc0 = C.careerNew({ id: 'dev', seed: 'dev' });
  const RR = C.careerMapRecord(doc0, null, {}), MR = MM.mapAdapt(RR, pack, null, C.CONTRACT_DESIGNS);
  need(MR.source === 'career' && MR.providers.map(p => p.id).join() === Object.keys(C.CONTRACT_PROVIDERS).join(), 'the real record: the five providers ' + MR.providers.map(p => p.id).join());
  need(MR.contracts.length === doc0.career.contracts.offered.length && MR.contracts.length === 5 * 4, 'the real record: a new career\'s 20 offers (' + MR.contracts.length + ')');
  const allR = MM.rowsOf(MR, st).length, perR = MR.providers.map(p => MM.rowsOf(MR, { cust: p.id }).length);
  need(allR === MR.contracts.length && perR.reduce((a, b) => a + b, 0) === allR && perR.every(n => n === 4), 'the real customers: All ' + allR + ', per customer ' + perR.join('/'));
  need((MM.listHTML(MR, st).match(/class="mmRow"/g) || []).length === allR, 'the real All list does not draw every row');
  for (const c of MR.contracts) {
    const h = checkPara(MR, c, 'the real record: ');
    const want = C.contractPay(C.careerContract(doc0, c.id)).total;
    need(MM.payOf(MR, c).total === want && h.includes('Pays ' + fmt(want) + '.'), c.id + ': the paragraph\'s pay is not contractPay\'s (' + MM.payOf(MR, c).total + ' vs ' + want + ')');
    need(!/\[(ct|job|prov|crit)\./.test(h) && !/\{(from|to|load|at)\}/.test(h), c.id + ': an unresolved text key or slot in the paragraph');
  }
  need(MR.voucher && MR.voucher.gear === 'wheels', 'the new career\'s voucher aeroplane (the maker Cub, wheels) is not what the marks judge by');
  const wetR = MR.contracts.filter(c => MM.subsAll(c).some(u => [u.from, u.do === 'survey' ? null : u.to].some(id => id && MR.aeros[id] && MR.aeros[id].surface.cls === 'water')));
  need(wetR.length >= 2 && wetR.every(c => MM.markOf(MR, c).mark === '✗' && /cannot land on water/.test(MM.markOf(MR, c).why)) && MR.contracts.filter(c => !wetR.includes(c)).every(c => MM.markOf(MR, c).mark === '✓'),
    'the real marks: the water jobs ✗ for the voucher\'s Cub, every other ✓');
  const M0 = MM.mapAdapt(RR, pack, null, {});
  need(M0.contracts.every(c => MM.markOf(M0, c).mark === ''), 'with no fleet and nothing to judge by, a mark was still drawn');
  say('the real record (a new career, careerNew + careerMapRecord): ' + allR + ' rows (' + perR.join(' + ') + '), every paragraph contractPay\'s pay, both ends, no unresolved key, ONE Track; the voucher\'s Cub (wheels) marks ' + wetR.length + ' water jobs ✗, the rest ✓');
  // the real fleet: the career's own airframes (the voucher's maker Cub: CONTRACT_DESIGNS' certificate; one not read yet)
  const doc1 = JSON.parse(JSON.stringify(doc0));
  doc1.fleet = { Cub: { aero: 'HOME' }, Kit: { aero: 'w3' } };
  doc1.career.airframes = { Cub: { design: 'cub' } };
  const M1 = MM.mapAdapt(C.careerMapRecord(doc1, null, {}), pack, null, C.CONTRACT_DESIGNS);
  need(M1.fleet.length === 2 && MM.fleetGears(M1).length === 1 && MM.fleetGears(M1)[0].gear === 'wheels', 'the real fleet\'s gears (the Cub\'s certificate; the kit not read yet, so not judged)');
  const o1R = MM.overlayOf(M1, st, pack, { s: 0.3, fit: 0.3, tx: 0, ty: 0 });
  need(o1R.n.planes === 2, 'your planes are not on the map where they stand (' + o1R.n.planes + ')');
  // the held-out contract never reaches the map
  const doc2 = JSON.parse(JSON.stringify(doc0));
  for (const id of ['clients.01', 'clients.02', 'clients.03', 'clients.04']) doc2.career.contracts.done.push({ id, at: 0, pay: 0 });
  doc2.career.providers.clients.rep = 5;
  need(!C.careerMapRecord(doc2, null, {}).contracts.some(c => c.id === 'clients.05'), 'the aerobatic box (+6 g, past the certificate) reached the map');
  say('the real fleet: the Cub judged by its certificate\'s gear, a kit not read yet left out; both drawn where they stand; the aerobatic box held out');

  // ---- G2440 (MAP-MERGE): THE THREE OTHER LISTS, the contracts' way - a row (an icon, the title, ONE number), ONE
  // paragraph when opened, at most two buttons; no card, no table; each list's markers on the map; a marker's tap filters ----
  for (const n of ['marketAdapt', 'marketListHTML', 'modelCardHTML', 'usedCardHTML', 'marketMarkers', 'certRows', 'pilotsListHTML', 'pilotCardHTML', 'fleetListHTML', 'listMarkers', 'switchHTML'])
    need(typeof MM[n] === 'function', 'the pure export ' + n + ' is gone');
  const bodyOf = (h, key) => { const i = h.indexOf('data-key="' + key + '"'); if (i < 0) return null; const j = Math.min(...['<div class="mmItem', '<h3 class="mmSect"', '<p class="mmEmpty"'].map(w => h.indexOf(w, i + 1)).filter(x => x > 0), h.length), seg = h.slice(i, j); const k = seg.indexOf('<div class="mmBody">'); return k < 0 ? '' : seg.slice(k); };
  const keysOf = h => [...h.matchAll(/<div class="mmItem[^"]*" data-key="([^"]+)"/g)].map(m => m[1]);
  // one row's rules: ONE paragraph, at most two buttons, no card wall, no unresolved key
  const checkItem = (MX, s, key, tag) => {
    const b = bodyOf(MM.listHTML(MX, Object.assign({}, s, { item: key })), key);
    need(b && (b.match(/<p>/g) || []).length === 1 && (b.match(/<button /g) || []).length <= 2 && !/<ul|<table|<h2|<h3|mmCard/.test(b), tag + key + ': not ONE paragraph and at most two buttons (' + (b && (b.match(/<button /g) || []).length) + ')');
    need(!/undefined|NaN|\[(mk|mdl|opt|used|pilot)\./.test(b), tag + key + ': an unresolved key or a number missing');
    need(!bodyOf(MM.listHTML(MX, s), key), tag + key + ': a closed row shows its paragraph');
    return b;
  };
  // FLEET: the real fleet (the voucher's Cub at HOME, a kit at w3): where each stands, seats, payload, gear, range
  const fl = { list: 'fleet', cust: 'all', at: null, phone };
  const FH = MM.listHTML(M1, fl);
  need(keysOf(FH).join() === 'f:Cub,f:Kit' && (FH.match(/class="mmRow mmRowI"/g) || []).length === 2 && (FH.match(/class="mmIc"/g) || []).length === 2, 'the Fleet list: a row per aeroplane (' + keysOf(FH).join() + ')');
  const fb = checkItem(M1, fl, 'f:Cub', 'the Fleet: ');
  need(/in the HOME hangar|at Jolene AFB/.test(fb) && /2 seats/.test(fb) && /kg payload/.test(fb) && /on wheels/.test(fb) && /km range/.test(fb) && !/<button /.test(fb), 'the Cub\'s paragraph: where it stands, seats, payload, gear, range (no button): ' + fb.replace(/<[^>]+>/g, ' '));
  need(/not read yet/.test(checkItem(M1, fl, 'f:Kit', 'the Fleet: ')), 'the kit\'s paragraph does not say its certificate is not read yet');
  const homeAt = M1.placeOf.HOME, w3At = M1.placeOf.w3;
  need(keysOf(MM.listHTML(M1, Object.assign({}, fl, { at: homeAt }))).join() === 'f:Cub' && keysOf(MM.listHTML(M1, Object.assign({}, fl, { at: w3At }))).join() === 'f:Kit', 'the place filter on the Fleet');
  need(/No aeroplanes yet/.test(MM.listHTML(MR, fl)), 'an empty fleet\'s line');
  const oF = MM.overlayOf(M1, fl, pack, { s: 0.3, fit: 0.3, tx: 0, ty: 0 }), oF3 = MM.overlayOf(M1, fl, pack, { s: 0.9, fit: 0.3, tx: 0, ty: 0 });
  need(oF.n.marks === 2 && oF.n.planes === 0 && /<button type="button" class="mmLm fleet" data-place="HOME" data-key="f:Cub"/.test(oF.html), 'the Fleet\'s markers: your aeroplanes at their bases, a tap target each (' + JSON.stringify(oF.n) + ')');
  need(+/--ms:(\d+)px/.exec(oF3.html)[1] > +/--ms:(\d+)px/.exec(oF.html)[1], 'the Fleet\'s markers are not sized to the zoom');
  need(o1R.n.marks === 0 && o1R.n.planes === 2, 'the contracts list draws the other lists\' markers');
  say('the Fleet: ' + M1.fleet.length + ' rows (✈, the name, the payload), the paragraph "' + fb.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + '", no button; the place filter; a marker per aeroplane at its base, sized to the zoom (' + /--ms:(\d+)px/.exec(oF.html)[1] + ' -> ' + /--ms:(\d+)px/.exec(oF3.html)[1] + ' px)');
  // PILOTS (G2290): the real record - kit hired, 2-3 looking for work; Hire / Flies next / Fire (disabled in the preview)
  const pst = { list: 'pilots', cust: 'all', at: null, phone };
  const PL = MR.pilots || [], PH = MM.listHTML(MR, pst);
  need(PL.length >= 3 && PL.length <= 4 && PL.filter(p => p.hired).map(p => p.id).join() === 'kit' && PL.filter(p => !p.hired).every(p => p.onOffer), 'the real Pilots: kit hired, 2-3 looking for work (' + PL.map(p => p.id + (p.hired ? '*' : '')).join() + ')');
  need(keysOf(PH).length === PL.length && PH.indexOf('Your pilots') < PH.indexOf('data-key="p:kit"') && PH.indexOf('data-key="p:kit"') < PH.indexOf('Looking for work'), 'the Pilots list: a row per pilot, yours first');
  for (const p of PL) {
    const b = checkItem(MR, pst, 'p:' + p.id, 'the Pilots: ');
    need(b.includes(p.fliesLike.replace(/&/g, '&amp;').replace(/'/g, '&#39;')) && p.traits.every(t => b.includes(t.label.replace(/'/g, '&#39;'))), p.id + ': the paragraph lacks how they fly or a trait');
    need(p.hired ? /data-pa="fire"/.test(b) : b.includes('data-pa="hire" data-pid="' + p.id + '"') && b.includes('Hire · ' + fmt(p.signOn)), p.id + ': the paragraph lacks ' + (p.hired ? 'Fire' : 'Hire · its fee'));
    need(/data-act="pilot"[^>]*disabled/.test(b), p.id + ': the preview (no live career) lets Hire / Fire act');
  }
  need(MM.listMarkers(MR, pst).some(m => m.kind === 'pilot' && m.key === 'p:kit' && m.aero === 'HOME') && keysOf(MM.listHTML(MR, Object.assign({}, pst, { at: MR.placeOf.HOME }))).join() === 'p:kit', 'the hired pilot is not a marker at HOME, or the place filter keeps the others');
  need(/come with the career/.test(MM.listHTML(M, pst)), 'the fixture\'s Pilots (the sandbox ?map=1) do not say they come with the career');
  say('the Pilots (real record): ' + PL.map(p => p.name + (p.hired ? ' (hired)' : ' (' + p.signOn + ')')).join(', ') + '; a row each (initials, the name, flights / the fee), the paragraph (the line, flies like, the traits, the place), Hire or Flies next + Fire; kit a marker at HOME; the fixture: with the career');
  // MARKET (G2280): the makers' models (validated builds only), the used listings where they stand, the drawing board
  {
    const KC = MM.marketAdapt(C, doc0), KS = MM.marketAdapt(C, C.playerDefault());
    need(KC && KC.makers.length === 4 && KC.makers.every(m => m.models.length >= 1) && KC.mode === 'career' && KS.mode === 'sandbox', 'the market: four makers, a career and a sandbox');
    const ids = [].concat(...KC.makers.map(m => m.models));
    need(ids.every(id => Object.values(C.PROCURE_MODELS[id].designs).every(d => C.CONTRACT_DESIGNS[d] && C.CONTRACT_DESIGNS[d].build)), 'a catalogue model that is not a validated build');
    need(KC.used.length >= 1 && KC.used.length <= 4 && KC.used.every(L => MR.aeros[L.aero]), 'the used listings: 1-4, each at an aerodrome of the map (' + KC.used.length + ')');
    const MKc = Object.assign({}, MR, { market: KC }), MKs = Object.assign({}, MR, { market: KS });
    const mst = { list: 'market', cust: 'all', at: null, phone };
    const lh = MM.listHTML(MKc, mst), ks = keysOf(lh);
    need(ks.filter(k => k.startsWith('m:')).length === ids.length && ks.filter(k => k.startsWith('u:')).length === KC.used.length && lh.indexOf('data-key="m:') < lh.indexOf('data-key="u:'), 'the Market list: the makers\' models, then the used listings');
    for (const id of ids) {
      const S = C.procureSheet(id, {}), b = checkItem(MKc, mst, 'm:' + id, 'the Market: ');
      need(b.includes(S.cert.seats + (S.cert.seats === 1 ? ' seat' : ' seats')) && /kg payload/.test(b) && /on (wheels|floats)/.test(b) && /km range/.test(b) && /data-act="buy"[^>]*>Buy · /.test(b), id + ': the paragraph lacks seats, payload, gear, range or Buy');
      need((b.match(/<button /g) || []).length === 1 && !/data-opt="[^"]*:(engine|tank|avionics|seats|finish)"/.test(b), id + ': more than the gear chosen here (the rest stays in the garage)');
      need(!S.rows.some(r => r.row === 'gear' && r.vals.length > 1) || /<select class="mmOptSel" data-opt="[^"]*:gear"/.test(b), id + ': its gear is not chosen in the paragraph');
      need(/data-act="buy"[^>]*>Take it · free in the sandbox/.test(checkItem(MKs, mst, 'm:' + id, 'the sandbox Market: ')), id + ': the sandbox does not Take it free');
    }
    need(/Your voucher pays/.test(bodyOf(MM.listHTML(MKc, Object.assign({}, mst, { item: 'm:scout' })), 'm:scout')) && /Buy · 0</.test(bodyOf(MM.listHTML(MKc, Object.assign({}, mst, { item: 'm:scout' })), 'm:scout')), 'the voucher does not pay for a stock Scout');
    for (const L of KC.used) {
      const b = checkItem(MKc, mst, 'u:' + L.id, 'the Market: '), a = MR.aeros[L.aero];
      need(b.includes('Stands at ' + escH(a.name)) && /kg payload/.test(b) && /km range/.test(b) && b.includes(fmt(L.price)) && /data-act="buy"[^>]*>Buy where it stands · /.test(b), L.id + ': the paragraph lacks where it stands, the facts, the price or Buy');
    }
    const mkU = MM.marketMarkers(MKc, mst);
    need(mkU.length === KC.used.length && mkU.every(m => m.key.startsWith('u:') && m.aero === KC.used.find(L => 'u:' + L.id === m.key).aero), 'the listings\' markers stand at their aerodromes');
    need(!MM.marketMarkers(MKc, st).length && !MM.listMarkers(MKc, st).length, 'the listings\' markers show outside the Market');
    const oM = MM.overlayOf(MKc, mst, pack, { s: 0.3, fit: 0.3, tx: 0, ty: 0 });
    need(oM.n.marks === mkU.filter(m => m.place).length && /class="mmLm used"/.test(oM.html), 'the Market\'s markers are not on the map (' + oM.n.marks + ')');
    const at0 = mkU[0].place, atRows = keysOf(MM.listHTML(MKc, Object.assign({}, mst, { at: at0 })));
    need(atRows.length && atRows.every(k => k.startsWith('u:') && MR.placeOf[KC.used.find(L => 'u:' + L.id === k).aero] === at0), 'a marker\'s place filters the Market to the listings standing there');
    // the drawing board: a design waits to be built, an airframe can be filed as a design; the sandbox: every slot is both
    const docB = JSON.parse(JSON.stringify(doc0)); docB.fleet = { Mine: { aero: 'HOME' } }; docB.career.airframes = { Mine: { from: 'board' } };
    const MB = Object.assign({}, MR, { market: MM.marketAdapt(C, docB, C.procureBoard(docB, ['Idea', 'Mine'])) });
    need(/data-board="build" data-slot="Idea"/.test(bodyOf(MM.listHTML(MB, Object.assign({}, mst, { item: 'b:Idea' })), 'b:Idea')) && /data-board="save" data-slot="Mine"/.test(bodyOf(MM.listHTML(MB, Object.assign({}, mst, { item: 'b:Mine' })), 'b:Mine')), 'the drawing board: Build this design (a design), Save as design (an airframe)');
    checkItem(MB, mst, 'b:Idea', 'the board: ');
    const hs = MM.listHTML(Object.assign({}, MR, { market: MM.marketAdapt(C, C.playerDefault(), C.procureBoard(C.playerDefault(), ['Idea'])) }), mst);
    need(/every saved design is also an aeroplane/.test(hs) && !/data-board=/.test(hs), 'the sandbox\'s drawing board: every slot is both, nothing to build');
    need(/needs the game/.test(MM.listHTML(M, mst)), 'a page without the core: the Market\'s line');
    need(MM.certRows(C.CONTRACT_DESIGNS.cub).length === 10, 'certRows');
    say('the Market: ' + ids.length + ' models of 4 makers (validated builds only; seats, payload, gear, range, the price, the gear chosen here, ONE Buy / Take free in the sandbox; the voucher pays a stock Scout), ' + KC.used.length + ' used listings (where they stand, the facts, the price, Buy where it stands), each a marker at its aerodrome; the drawing board rows');
  }
  return lines;
};
