// fiche_mass.js - THE FICHE'S MASS PAGE (the user 11-12 Nov, "Mass & price": the SUNBURST, refined): ported from
// PHYSICS-PAGES' prototype (reports/evidence/PHYSICS-PAGES/proto/massproto.js at 8b38623d).
//   THE CIRCLE  the EMPTY aeroplane: the categories on the inner ring (their names curved along the arc where they fit),
//               every part on the outer ring with its own straight callout, all round the circle, inside the frame;
//               the small categories close the ring at twelve o'clock so the callouts split evenly left and right.
//   THE BAR     below it: empty + crew + fuel + cargo, up to the maximum take-off weight; under it THE SEATS CHECK -
//               full tanks, then each seat at 80 kg, against the maximum.
//   BALANCE     a weight-and-balance ENVELOPE: the side picture (bigger), the good range on it, then the chart - CG along,
//               weight up, the good range = genMarginBand's edges (GEN_MARGIN_BANDS: 5 to 40 % of the mean chord ahead of
//               genAidBalance's neutral point) up to the maximum (designGross); the loading walked from empty, the fuel
//               burnt back out.
//   CATEGORIES  (A0's default for L39b, no core change) Structure / Engine (engine, installation, propeller, mount, tank -
//               the spec's own rows) / Gear (main, tail or nose by the ledger's own nodes - GEN_MASS_TRACE -, floats) /
//               Systems / Outfit (cowl, windows, controls: one slice until parts.outfitKg lands) / Interior / Finish;
//               the load (crew, fuel, cargo) is the bar's.
//   THE DATA    data(spec, K) -> massproto data()'s shape { rows [{ key, name, cat, kg, x, payload }], M, cg, steps, noFuel,
//               mtow, bal, seats, occKg, fuelFull, xNodes } - so PHYSICS-PAGES' genFicheMass can later UPGRADE the 'mass'
//               page (FICHE_BOARD.pages.add with the same id) as a swap. The official planes' come baked (fiche_bake.js ->
//               index.json data.mass, node); a plane on the stand is weighed when its page opens.
// GATE PLANEFICHE checks it (tools/_plane_fiche_check.js, the MASS rows).
'use strict';
(function () {
  const CAT = { structure: ['Structure', '#8fb0c4'], engine: ['Engine', '#e2a056'], gear: ['Gear', '#a9bd6e'], systems: ['Systems', '#b99be0'],
                outfit: ['Outfit (cowl, windows, controls)', '#6fc2b0'], interior: ['Interior', '#e0868a'], finish: ['Finish', '#b7ab9b'], load: ['Crew & cargo', '#d8cdb8'] };
  const ROWCAT = { fuselage: 'structure', wings: 'structure', bracing: 'structure', tail: 'structure', stol: 'structure', pod: 'structure', vessel: 'engine',
                   gear: 'gear', panel: 'systems', elec: 'systems', avionics: 'systems', outfit: 'outfit', furnish: 'interior', paint: 'finish',
                   cabin: 'load', fuel: 'load', cargo: 'load' };
  const ROWNAME = { fuselage: 'Fuselage', wings: 'Wings', bracing: 'Struts & bracing', tail: 'Tail', stol: 'STOL kit', pod: 'Belly pod', vessel: 'Tank',
                    panel: 'Instruments', elec: 'Electrics', avionics: 'Radios', outfit: 'Cowl, windows, controls', furnish: 'Seats & trim', paint: 'Paint',
                    cabin: 'Crew & passengers', fuel: 'Fuel', cargo: 'Cargo' };
  const OCC_KG = 80;
  const TH = { bg: '#f3ede0', ink: '#2b2924', dim: '#6d675b', faint: '#9a9283', hair: '#d8cdb8', edge: 'rgba(43,41,36,.55)', lead: 'rgba(43,41,36,.38)', red: '#b5462a', ok: '#55652a' };
  // the core's functions: node passes flight_core; the page finds them as the document's globals
  const coreOf = K => K || {
    buildGen: typeof buildGen === 'function' ? buildGen : null, resolveSpec: typeof resolveSpec === 'function' ? resolveSpec : null,
    POWERPLANTS: typeof POWERPLANTS !== 'undefined' ? POWERPLANTS : null, genAidBalance: typeof genAidBalance === 'function' ? genAidBalance : null,
    GEN_MARGIN_BANDS: typeof GEN_MARGIN_BANDS !== 'undefined' ? GEN_MARGIN_BANDS : null };
  const G = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
  // ---- the data ---------------------------------------------------------------------------------------------------------
  function data(spec, K) {
    K = coreOf(K);
    if (!K.buildGen || !K.genAidBalance) throw new Error('no core to weigh the aeroplane');
    const was = G.GEN_MASS_TRACE; G.GEN_MASS_TRACE = 1;
    let def; try { def = K.buildGen(JSON.parse(JSON.stringify(spec))); } finally { G.GEN_MASS_TRACE = was; }
    const Lg = def.parts.ledger, P = def.nodes, bal = K.genAidBalance(def);
    const rows = [], put = (key, name, cat, kg, x, payload) => { if (kg > 0.05) rows.push({ key, name, cat, kg: +kg.toFixed(2), x: +x.toFixed(3), payload: !!payload }); };
    for (const k of Object.keys(Lg)) {
      const e = Lg[k]; if (!(e.mass > 0.05)) continue;
      const x = e.mx / e.mass;
      if (k === 'engines') {
        // the spec's own rows: the dry engine, its installation (resolveSpec's engInstallM), the propeller (S.prop.mass), each per
        // engine; the mount = the rest the section billed (the bearers, the rings)
        let S = null; try { const R = K.resolveSpec ? K.resolveSpec(JSON.parse(JSON.stringify(spec))) : null; S = R && (R.spec || R); } catch (er) { S = null; }
        const PP = S && (S.pplant || (K.POWERPLANTS && K.POWERPLANTS[S.engine])), n = S ? Math.max(1, (S.engAt || [1]).length) : 1;
        const eng = PP && PP.engine ? PP.engine.mass * n : 0, inst = S ? (S.engInstallM || 0) * n : 0, prop = S && S.prop ? (S.prop.mass || 0) * n : 0;
        if (eng > 0 && eng + inst + prop <= e.mass + 0.5) {
          put('engine', n > 1 ? 'Engines' : 'Engine', 'engine', eng, x, false); put('install', 'Installation', 'engine', inst, x, false);
          put('prop', n > 1 ? 'Propellers' : 'Propeller', 'engine', prop, x, false); put('mount', 'Engine mount', 'engine', Math.max(0, e.mass - eng - inst - prop), x, false);
        } else put('engines', 'Engine & propeller', 'engine', e.mass, x, false);
        continue;
      }
      if (k === 'gear' && Array.isArray(e.nodeM) && e.nodeM.length) {
        // the ledger's own nodes: a float's (FL*) to the floats; the rest to the main gear or the tail / nose wheel, whichever
        // wheel's station is nearer (the axles', the steering wheel's)
        const tag = i => String((P[i] && P[i].tag) || ''), xi = i => (P[i] && P[i].p ? P[i].p[0] : 0);
        const ax = e.nodeM.filter(([i]) => /^AXLE/.test(tag(i))), tw = e.nodeM.filter(([i]) => /^TW/.test(tag(i)));
        const xa = ax.length ? xi(ax[0][0]) : null, xt = tw.length ? xi(tw[0][0]) : null;
        const acc = { main: [0, 0], aux: [0, 0], floats: [0, 0] };
        for (const [i, dm] of e.nodeM) {
          const b = /^FL/.test(tag(i)) ? 'floats' : xt == null || xa == null ? 'main' : Math.abs(xi(i) - xa) <= Math.abs(xi(i) - xt) ? 'main' : 'aux';
          acc[b][0] += dm; acc[b][1] += dm * xi(i);
        }
        const tot = acc.main[0] + acc.aux[0] + acc.floats[0];
        if (Math.abs(tot - e.mass) < 0.02 * e.mass + 0.5) {
          const nose = xt != null && xa != null && xt < xa;
          if (acc.main[0] > 0.05) put('gearMain', 'Main gear', 'gear', acc.main[0], acc.main[1] / acc.main[0], false);
          if (acc.aux[0] > 0.05) put('gearAux', nose ? 'Nose gear' : 'Tail wheel', 'gear', acc.aux[0], acc.aux[1] / acc.aux[0], false);
          if (acc.floats[0] > 0.05) put('floats', 'Floats', 'gear', acc.floats[0], acc.floats[1] / acc.floats[0], false);
          continue;
        }
      }
      put(k, ROWNAME[k] || k, ROWCAT[k] || (e.payload ? 'load' : 'structure'), e.mass, x, e.payload);
    }
    const M = rows.reduce((a, r) => a + r.kg, 0), MX = rows.reduce((a, r) => a + r.kg * r.x, 0);
    const sub = keys => { const rs = rows.filter(r => !keys.includes(r.key)), m = rs.reduce((a, r) => a + r.kg, 0); return { m: +m.toFixed(2), x: +(rs.reduce((a, r) => a + r.kg * r.x, 0) / m).toFixed(4) }; };
    const steps = [['empty', sub(['cabin', 'fuel', 'cargo'])], ['+ crew', sub(['fuel', 'cargo'])], ['+ fuel', sub(['cargo'])], ['+ cargo', { m: +M.toFixed(2), x: +(MX / M).toFixed(4) }]];
    const xs = P.map(n => n.p[0]), cab = (spec && spec.cabin) || {};
    const B = K.GEN_MARGIN_BANDS || { comfy: 0.05, noseHeavy: 0.40 };
    const fuel = rows.find(r => r.key === 'fuel');
    return { rows, M: +M.toFixed(2), cg: +(MX / M).toFixed(4), steps, noFuel: sub(['fuel']), mtow: +(+def.parts.designGross || M).toFixed(1),
             bal: { npX: +bal.npX.toFixed(4), cBar: +bal.cBar.toFixed(3), sm: +bal.sm.toFixed(4), cgX: +bal.cgX.toFixed(4) },
             bands: { comfy: B.comfy, noseHeavy: B.noseHeavy }, seats: cab.seats || null, occKg: OCC_KG, fuelFull: fuel ? fuel.kg : 0,
             xNodes: [+Math.min(...xs).toFixed(3), +Math.max(...xs).toFixed(3)], v: 1 };
  }
  // ---- the drawing (strings: the board, the gate and node draw the same) --------------------------------------------------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const T = (x, y, s, o) => { o = o || {}; return `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.sz || 14}" fill="${o.c || TH.ink}"${o.w ? ` font-weight="${o.w}"` : ''}${o.a ? ` text-anchor="${o.a}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`; };
  const L = (a, b, c, w, d) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w || 1}"${d ? ` stroke-dasharray="${d}"` : ''}/>`;
  const r0 = x => String(Math.round(x)), r1 = x => (Math.round(x * 10) / 10).toFixed(1);
  const cats = rows => { const c = {}; for (const r of rows) (c[r.cat] = c[r.cat] || { key: r.cat, v: 0, rows: [] }).rows.push(r); for (const k in c) c[k].v = c[k].rows.reduce((a, r) => a + r.kg, 0); return Object.values(c); };
  const hatch = id => `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(43,41,36,.22)" stroke-width="1.6"/></pattern>`;
  const colOf = cat => (CAT[cat] || CAT.structure)[1], nameOf = cat => (CAT[cat] || [cat])[0];
  function wrap2(s, n) { if (s.length <= n) return [s]; const w = s.split(' '); let a = '', i = 0; for (; i < w.length; i++) { const t = a ? a + ' ' + w[i] : w[i]; if (t.length > n && a) break; a = t; } return [a, w.slice(i).join(' ')]; }
  // THE CIRCLE: the empty aeroplane (massproto sunburst2, the user's five label rules)
  function circle(rows, Mtot, cx, cy, R, box, uid) {
    const out = [], C2 = cats(rows).sort((a, b) => b.v - a.v), ri = R * 0.28, rm1 = R * 0.62, r2 = R * 0.65;
    const smallA = C2.filter(c => c.v / Mtot < 0.08).reduce((t, c) => t + 2 * Math.PI * c.v / Mtot, 0);
    const arc = (a0, a1, rI, rO) => { const p = (a, r) => [cx + r * Math.sin(a), cy - r * Math.cos(a)], lg = a1 - a0 > Math.PI ? 1 : 0;
      const [A, B, Cc, Dd] = [p(a0, rO), p(a1, rO), p(a1, rI), p(a0, rI)];
      return `M${A[0].toFixed(1)} ${A[1].toFixed(1)} A${rO} ${rO} 0 ${lg} 1 ${B[0].toFixed(1)} ${B[1].toFixed(1)} L${Cc[0].toFixed(1)} ${Cc[1].toFixed(1)} A${rI} ${rI} 0 ${lg} 0 ${Dd[0].toFixed(1)} ${Dd[1].toFixed(1)} Z`; };
    const defs = [], labels = [];
    let a = smallA / 2, id = 0;
    for (const c of C2) {
      const a1 = a + 2 * Math.PI * c.v / Mtot, col = colOf(c.key);
      out.push(`<path d="${arc(a, a1, ri, rm1)}" fill="${col}" fill-opacity=".92" stroke="${TH.bg}" stroke-width="2"/>`);
      const rm = (ri + rm1) / 2, len = (a1 - a) * rm, name = nameOf(c.key), pct = Math.round(100 * c.v / Mtot) + ' %', am = (a + a1) / 2, lower = Math.cos(am) < 0;
      const pth = r => { const p0 = [cx + r * Math.sin(lower ? a1 : a), cy - r * Math.cos(lower ? a1 : a)], p1 = [cx + r * Math.sin(lower ? a : a1), cy - r * Math.cos(lower ? a : a1)];
        return `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r} ${r} 0 ${a1 - a > Math.PI ? 1 : 0} ${lower ? 0 : 1} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`; };
      const sub = pct + ' · ' + r0(c.v) + ' kg', two = len > Math.max(name.length * 6.6, sub.length * 6.2) + 12;
      if (two || len > name.length * 6.2 + 6) {
        const k1 = uid + 'cp' + (id++), k2 = uid + 'cp' + (id++);
        defs.push(`<path id="${k1}" d="${pth(rm + (two ? (lower ? -5 : 5) : (lower ? -4 : 4)))}"/><path id="${k2}" d="${pth(rm + (lower ? 11 : -11))}"/>`);
        out.push(`<text font-size="${two ? 12.5 : 11.5}" font-weight="600" fill="${TH.ink}"><textPath href="#${k1}" startOffset="50%" text-anchor="middle">${esc(name)}</textPath></text>`);
        if (two) out.push(`<text font-size="11.5" fill="${TH.ink}"><textPath href="#${k2}" startOffset="50%" text-anchor="middle">${esc(sub)}</textPath></text>`);
      } else if (len > 26) out.push(T(cx + rm * Math.sin(am), cy - rm * Math.cos(am) + 4, pct, { sz: 11, w: 600, a: 'middle' }));
      let b = a;
      for (const r of c.rows.slice().sort((p, q) => q.kg - p.kg)) {
        const b1 = b + 2 * Math.PI * r.kg / Mtot;
        out.push(`<path d="${arc(b, b1, r2, R)}" fill="${col}" fill-opacity=".62" stroke="${TH.bg}" stroke-width="1.5"/>`);
        labels.push({ r, c, am: (b + b1) / 2 });
        b = b1;
      }
      a = a1;
    }
    out.unshift(`<defs>${defs.join('')}</defs>`);
    // the callouts ALL AROUND the ring: each on a circle outside it at its slice's angle, pushed apart along the circle where
    // two would overlap; one straight leader from the slice to its label; every label kept inside the box
    const RL = R + 34;
    const L2 = labels.map(q => { const lines = wrap2(q.r.name, 16); const w = Math.max(...lines.map(l => l.length), 13) * 6.6, h = 14 * lines.length + 14; return Object.assign(q, { lines, w, h, th: q.am }); }).sort((p, q) => p.am - q.am);
    const place = q => { const x = cx + RL * Math.sin(q.th), y = cy - RL * Math.cos(q.th), sn = Math.sin(q.th), cs = Math.cos(q.th);
      const an = sn > 0.28 ? 'start' : sn < -0.28 ? 'end' : 'middle';
      const bx = an === 'start' ? x : an === 'end' ? x - q.w : x - q.w / 2, by = cs > 0.28 ? y - q.h : cs < -0.28 ? y : y - q.h / 2;
      return { an, bx: Math.max(box.x0 + 2, Math.min(box.x1 - 2 - q.w, bx)), by: Math.max(box.y0 + 2, Math.min(box.y1 - 2 - q.h, by)) }; };
    const hit = (p, q) => p.bx < q.bx + q.q.w + 6 && q.bx < p.bx + p.q.w + 6 && p.by < q.by + q.q.h + 2 && q.by < p.by + p.q.h + 2;
    for (let it = 0; it < 400; it++) {
      let moved = false; const Pl = L2.map(q => Object.assign(place(q), { q }));
      for (let i = 0; i < L2.length; i++) { const j = (i + 1) % L2.length; if (i === j) continue;
        if (hit(Pl[i], Pl[j])) { L2[i].th -= 0.012; L2[j].th += 0.012; moved = true; } }
      if (!moved) break;
    }
    const placed = [];
    for (const q of L2) {
      const p = place(q), ax = cx + (R + 2) * Math.sin(q.am), ay = cy - (R + 2) * Math.cos(q.am);
      const ex = Math.max(p.bx - 3, Math.min(p.bx + q.w + 3, ax)), ey = Math.max(p.by - 2, Math.min(p.by + q.h + 2, ay));
      out.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${TH.lead}" stroke-width=".9"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="1.6" fill="${TH.ink}"/>`);
      const lw = Math.max(...q.lines.map(l => l.length)) * 6.6;
      const tx = p.an === 'start' ? p.bx + 14 : p.an === 'end' ? p.bx + q.w : p.bx + q.w / 2 + 7, chip = p.an === 'start' ? p.bx : p.an === 'end' ? p.bx + q.w - lw - 14 : p.bx + q.w / 2 - lw / 2 - 7;
      out.push(`<rect x="${chip.toFixed(1)}" y="${(p.by + 2).toFixed(1)}" width="10" height="10" rx="2" fill="${colOf(q.c.key)}" fill-opacity=".8" stroke="${TH.edge}" stroke-width=".7"/>`);
      q.lines.forEach((ln, i) => out.push(T(tx, p.by + 11 + 14 * i, ln, { sz: 12.5, w: 500, a: p.an })));
      out.push(T(tx, p.by + 11 + 14 * q.lines.length, r1(q.r.kg) + ' kg · ' + (100 * q.r.kg / Mtot < 1 ? '<1' : Math.round(100 * q.r.kg / Mtot)) + ' %', { sz: 11.5, c: TH.dim, a: p.an }));
      placed.push({ x: p.bx, y: p.by, w: q.w, h: q.h, name: q.r.name });
    }
    out.push(T(cx, cy - 4, r0(Mtot) + ' kg', { sz: 21, w: 600, a: 'middle' }) + T(cx, cy + 16, 'empty', { sz: 12, c: TH.dim, a: 'middle' }));
    return { out, placed };
  }
  // THE BAR: empty + what it carries, up to the maximum; THE SEATS CHECK under it
  function bar(D, bx, by, bw, uid) {
    const out = [], kx = bw / Math.max(D.mtow, D.M) * 0.94, H = 26; let x = bx;
    out.push(T(bx, by - 14, 'AS FLOWN · WHAT GETS ADDED TO THE EMPTY PLANE', { sz: 11, c: TH.faint, w: 600, ls: 1.2 }));
    const empty = D.rows.filter(r => !r.payload), emptyKg = empty.reduce((a, r) => a + r.kg, 0);
    for (const c of cats(empty).sort((a, b) => b.v - a.v)) { const w = c.v * kx;
      out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1).toFixed(1)}" height="${H}" fill="${colOf(c.key)}" fill-opacity=".8" stroke="${TH.edge}" stroke-width=".6"/>`); x += w; }
    out.push(T((bx + x) / 2, by + H / 2 + 4.5, 'empty ' + r0(emptyKg) + ' kg', { sz: 12.5, w: 600, a: 'middle' }));
    const placed = [];
    for (const [key, nm] of [['cabin', 'crew & passengers'], ['fuel', 'fuel'], ['cargo', 'cargo']]) {
      const r = D.rows.find(q => q.key === key); if (!r || r.kg < 0.5) continue; const w = r.kg * kx;
      out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${Math.max(0, w - 1).toFixed(1)}" height="${H}" fill="url(#${uid}ld)" stroke="${TH.dim}" stroke-width="1.2"/>`);
      const lab = '+ ' + nm + ' ' + r0(r.kg) + ' kg', lw = lab.length * 6.4, cxl = x + w / 2;
      let row = 0; while (placed.some(p => p.row === row && Math.abs(p.cx - cxl) < (p.w + lw) / 2 + 8)) row++;
      placed.push({ row, cx: cxl, w: lw });
      const ly = by + H + 22 + 18 * row;
      out.push(L([cxl, by + H + 2], [cxl, ly - 12], TH.lead, 0.8) + T(Math.min(bx + bw - lw / 2, Math.max(bx + lw / 2, cxl)), ly, lab, { sz: 12, a: 'middle' })); x += w;
    }
    const mxp = bx + D.mtow * kx;
    out.push(T(Math.max(bx + 120, x - 2), by - (mxp - x < 150 ? 22 : 6) + (mxp - x < 150 ? 0 : 0), 'as flown ' + r0(D.M) + ' kg', { sz: 12.5, w: 600, a: 'end' }));
    if (D.mtow > D.M) out.push(`<rect x="${x.toFixed(1)}" y="${by}" width="${((D.mtow - D.M) * kx - 1).toFixed(1)}" height="${H}" fill="none" stroke="${TH.ink}" stroke-dasharray="3 3"/>` +
      ((D.mtow - D.M) * kx > 80 ? T(x + (D.mtow - D.M) * kx / 2, by + H / 2 + 4, r0(D.mtow - D.M) + ' kg free', { sz: 11.5, c: TH.dim, a: 'middle' }) : ''));
    out.push(L([mxp, by - 10], [mxp, by + H + 10], TH.red, 1.8) + T(Math.min(bx + bw, mxp + 4), by + H + 24, 'max ' + r0(D.mtow) + ' kg', { sz: 12, w: 600, c: TH.red, a: mxp + 90 > bx + bw ? 'end' : 'start' }));
    // THE SEATS CHECK: full tanks, then each seat at 80 kg - how many fit under the maximum
    const sy = by + H + 22 + 18 * (placed.length ? Math.max(...placed.map(p => p.row)) + 1 : 0) + 30;
    const nS = Math.max(1, D.seats || 1), base = emptyKg + (D.fuelFull || 0);
    out.push(T(bx, sy, 'THE SEATS CHECK · FULL TANKS, THEN ' + D.occKg + ' KG A SEAT', { sz: 11, c: TH.faint, w: 600, ls: 1.2 }));
    let fit = 0;
    for (let i = 1; i <= nS; i++) if (base + i * D.occKg <= D.mtow + 0.5) fit = i;
    // up to seven boxes: every seat, or seven counts spread from one to all (an airliner's 29)
    const nb = Math.min(nS, Math.max(1, Math.floor((bw + 8) / 86))), pick = [];
    for (let j = 0; j < nb; j++) pick.push(nb === nS ? j + 1 : Math.max(1, Math.round(1 + (nS - 1) * j / (nb - 1))));
    for (let j = 0; j < pick.length; j++) {
      const i = pick[j], m = base + i * D.occKg, ok = m <= D.mtow + 0.5;
      const X = bx + j * 86;
      out.push(`<rect x="${X}" y="${sy + 10}" width="78" height="34" rx="5" fill="${ok ? '#a9bd6e' : '#e0868a'}" fill-opacity="${ok ? '.35' : '.4'}" stroke="${ok ? '#7d8f45' : TH.red}" stroke-width="1.2"/>` +
        T(X + 39, sy + 24, i + (i > 1 ? ' people' : ' person'), { sz: 11.5, w: 600, a: 'middle' }) + T(X + 39, sy + 38, r0(m) + ' kg', { sz: 11, c: ok ? TH.ok : TH.red, a: 'middle' }));
    }
    const say = fit >= nS ? 'Every seat can be filled with full tanks.' : fit === 0 ? 'With full tanks no one fits under the maximum: fly with less fuel.'
      : 'With full tanks ' + fit + ' of the ' + nS + ' seats can be filled; more people means less fuel.';
    out.push(T(bx, sy + 64, say, { sz: 12.5, c: fit >= nS ? TH.ink : TH.red }));
    return { out, bottom: sy + 72 };
  }
  // BALANCE: the side picture (bigger) with the good range on it, then the envelope chart
  function balance(D, bx, by, bw, side) {
    const out = [], np = D.bal.npX, cb = D.bal.cBar, B = D.bands || { comfy: 0.05, noseHeavy: 0.40 };
    const g0 = np - B.noseHeavy * cb, g1 = np - B.comfy * cb;
    let Yb = by;
    if (side && side.href && side.W > 0 && side.length > 0) {
      // the picture spans the plane's drawn length; its middle on the middle of the frame's nodes (the fiche's side view is
      // cropped to the silhouette)
      const f = Math.min(bw / side.W, 190 / side.H), w = side.W * f, h = side.H * f, ox = bx + (bw - w) / 2;
      const xc = (D.xNodes[0] + D.xNodes[1]) / 2, x0 = xc - side.length / 2, Xp = x => ox + w * (x - x0) / side.length;
      out.push(`<rect x="${Xp(g0).toFixed(1)}" y="${by - 4}" width="${(Xp(g1) - Xp(g0)).toFixed(1)}" height="${(h + 8).toFixed(1)}" fill="#a9bd6e" fill-opacity=".25" stroke="#7d8f45" stroke-dasharray="4 3"/>`);
      out.push(`<image href="${esc(side.href)}" x="${ox.toFixed(1)}" y="${by}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`);
      const cy = by + h * 0.55, cx = Xp(D.cg);
      out.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="${TH.bg}" stroke="${TH.ink}" stroke-width="1.6"/><path d="M${(cx - 8).toFixed(1)} ${cy.toFixed(1)} A8 8 0 0 1 ${cx.toFixed(1)} ${(cy - 8).toFixed(1)} L${cx.toFixed(1)} ${cy.toFixed(1)} Z M${(cx + 8).toFixed(1)} ${cy.toFixed(1)} A8 8 0 0 1 ${cx.toFixed(1)} ${(cy + 8).toFixed(1)} L${cx.toFixed(1)} ${cy.toFixed(1)} Z" fill="${TH.ink}"/>`);
      Yb = by + h;
      out.push(T(Xp((g0 + g1) / 2), by - 10, 'the good range', { sz: 11.5, c: TH.ok, w: 600, a: 'middle' }));
    }
    const cx0 = bx + 44, cx1 = bx + bw - 10, cy0 = Yb + 40, cy1 = cy0 + 250;
    const xsAll = D.steps.map(s => s[1].x).concat(D.noFuel.x, g0, g1, np);
    const xlo = Math.min(...xsAll) - 0.08, xhi = Math.max(...xsAll) + 0.08;
    const mlo = Math.floor(D.steps[0][1].m * 0.9 / 50) * 50, mhi = Math.ceil(Math.max(D.mtow, D.M) * 1.06 / 50) * 50;
    const X = x => cx0 + (cx1 - cx0) * (x - xlo) / (xhi - xlo), Y = m => cy1 - (cy1 - cy0) * (m - mlo) / (mhi - mlo);
    out.push(`<rect x="${cx0}" y="${cy0.toFixed(1)}" width="${cx1 - cx0}" height="${(cy1 - cy0).toFixed(1)}" fill="none" stroke="${TH.hair}"/>`);
    out.push(`<rect x="${X(g0).toFixed(1)}" y="${Y(D.mtow).toFixed(1)}" width="${(X(g1) - X(g0)).toFixed(1)}" height="${(cy1 - Y(D.mtow)).toFixed(1)}" fill="#a9bd6e" fill-opacity=".28" stroke="#7d8f45" stroke-width="1.2"/>`);
    out.push(T(X((g0 + g1) / 2), Y(D.mtow) + 18, 'the good range', { sz: 12, c: TH.ok, w: 600, a: 'middle' }));
    out.push(L([cx0, Y(D.mtow)], [cx1, Y(D.mtow)], TH.red, 1.4, '6 3') + T(cx0 + 6, Y(D.mtow) - 6, 'max take-off ' + r0(D.mtow) + ' kg', { sz: 12, c: TH.red, w: 600, a: 'start' }));
    out.push(L([X(np), cy0], [X(np), cy1], TH.ink, 1.2, '5 3') + T(X(np) - 4, cy1 - 8, 'neutral point', { sz: 11.5, c: TH.dim, a: 'end' }));
    const dm = mhi - mlo > 1200 ? 500 : mhi - mlo > 600 ? 200 : 100;
    for (let m = Math.ceil(mlo / dm) * dm; m <= mhi; m += dm) out.push(L([cx0 - 4, Y(m)], [cx0, Y(m)], TH.faint, 1) + T(cx0 - 7, Y(m) + 4, r0(m), { sz: 10.5, c: TH.faint, a: 'end' }));
    const dx = xhi - xlo > 2 ? 0.5 : xhi - xlo > 1 ? 0.2 : 0.1;
    for (let x = Math.ceil(xlo / dx) * dx; x <= xhi + 1e-9; x += dx) out.push(L([X(x), cy1], [X(x), cy1 + 4], TH.faint, 1) + T(X(x), cy1 + 16, r0(x * 100), { sz: 10.5, c: TH.faint, a: 'middle' }));
    out.push(T(cx1, cy1 + 32, 'CG, cm behind the firewall', { sz: 11, c: TH.dim, a: 'end' }) + T(cx0 - 38, cy0 - 8, 'kg', { sz: 11, c: TH.dim }));
    // the walk: each point its label, beside it on the side with room; a label that would touch one already placed takes the
    // other side, then steps down a line (the fuel and the cargo points sit close)
    let prev = null; const labs = [];
    const lhit = (a, b) => a.x0 < b.x1 + 4 && b.x0 < a.x1 + 4 && a.y0 < b.y1 + 1 && b.y0 < a.y1 + 1;
    D.steps.forEach(([lab, p], i) => {
      if (i && Math.abs(p.m - D.steps[i - 1][1].m) < 0.5) return;
      const q = [X(p.x), Y(p.m)];
      if (prev) out.push(`<path d="M${prev[0].toFixed(1)} ${prev[1].toFixed(1)} L${q[0].toFixed(1)} ${q[1].toFixed(1)}" stroke="${TH.ink}" stroke-width="1.6" fill="none"/>`);
      const last = i === D.steps.length - 1, txt = lab + ' · ' + r0(p.m) + ' kg', w = txt.length * 6.3;
      out.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${last ? 6 : 4.5}" fill="${last ? TH.ink : TH.bg}" stroke="${TH.ink}" stroke-width="1.5"/>`);
      const pref = q[0] > (cx0 + cx1) / 2;
      let best = null;
      for (let dy = 0; dy <= 70 && !best; dy += 14) for (const lft of [pref, !pref]) {
        const x0 = lft ? q[0] - 9 - w : q[0] + 9, bx = { x0, x1: x0 + w, y0: q[1] - 6 + dy, y1: q[1] + 8 + dy };
        if (bx.x0 < cx0 + 2 || bx.x1 > cx1 - 2) continue;
        if (!labs.some(o => lhit(o, bx))) { best = { lft, bx, dy }; break; }
      }
      if (!best) best = { lft: pref, dy: 0, bx: { x0: pref ? q[0] - 9 - w : q[0] + 9, x1: 0, y0: q[1] - 6, y1: q[1] + 8 } };
      labs.push(best.bx);
      if (best.dy) out.push(L([q[0] + (best.lft ? -4 : 4), q[1] + 2], [best.lft ? best.bx.x1 + 2 : best.bx.x0 - 2, q[1] + best.dy], TH.lead, 0.7));
      out.push(T(best.lft ? q[0] - 9 : q[0] + 9, q[1] + 4 + best.dy, txt, { sz: 12, w: last ? 600 : 400, c: last ? TH.ink : TH.dim, a: best.lft ? 'end' : 'start' }));
      prev = q;
    });
    const nf = D.noFuel, a0 = [X(D.cg), Y(D.M)], z = [X(nf.x), Y(nf.m)];
    out.push(`<path d="M${a0[0].toFixed(1)} ${a0[1].toFixed(1)} L${z[0].toFixed(1)} ${z[1].toFixed(1)}" stroke="#c27a3e" stroke-width="1.6" stroke-dasharray="4 3" fill="none"/><circle cx="${z[0].toFixed(1)}" cy="${z[1].toFixed(1)}" r="4.5" fill="${TH.bg}" stroke="#c27a3e" stroke-width="1.5"/>`);
    const sm = D.bal.sm, band = sm < 0 ? 'behind the neutral point' : sm < B.comfy ? 'close to the neutral point' : sm <= B.noseHeavy ? 'in the good range' : 'far forward';
    out.push(T(bx, cy1 + 58, 'As flown: CG ' + r0(D.cg * 100) + ' cm behind the firewall, ' + band + ', ' + r0(sm * 100) + ' % of the mean chord ahead of the neutral point.', { sz: 12.5 }));
    out.push(T(bx, cy1 + 76, D.mtow >= D.M ? r0(D.mtow - D.M) + ' kg below the maximum take-off weight.' : r0(D.M - D.mtow) + ' kg OVER the maximum take-off weight.', { sz: 12.5, c: D.mtow >= D.M ? TH.dim : TH.red }));
    out.push(`<circle cx="${bx + 4}" cy="${cy1 + 89}" r="4" fill="${TH.bg}" stroke="#c27a3e" stroke-width="1.5"/>` + T(bx + 14, cy1 + 94, 'With the fuel burnt the CG moves ' + Math.abs(Math.round((nf.x - D.cg) * 100)) + ' cm ' + (nf.x >= D.cg ? 'aft' : 'forward') + ' (the dashed line).', { sz: 12.5, c: '#8a5520' }));
    return { out, bottom: cy1 + 104 };
  }
  let SEQ = 0;
  const FONT = `font-family="'IBM Plex Sans', system-ui, sans-serif"`;
  // the page's two pictures, each 720 wide (the board shows them near 1:1): { weight, balance, placed } - placed: the callouts' boxes (the gate's)
  function svg(D, side) {
    const uid = 'fm' + (++SEQ) + '_', W = 720;
    const empty = D.rows.filter(r => !r.payload), eKg = empty.reduce((a, r) => a + r.kg, 0);
    const big = cats(empty).sort((a, b) => b.v - a.v)[0];
    const head = [T(18, 30, 'MASS · THE EMPTY PLANE, THEN WHAT IT CARRIES', { sz: 11.5, c: TH.faint, w: 600, ls: 1.6 }),
      T(18, 56, nameOf(big.key) + ' is ' + r0(100 * big.v / eKg) + ' % of the empty plane', { sz: 19, w: 600 }),
      T(18, 76, 'Empty ' + r0(eKg) + ' kg, as flown ' + r0(D.M) + ' kg, maximum ' + r0(D.mtow) + ' kg.', { sz: 13, c: TH.dim })];
    const box = { x0: 8, x1: W - 8, y0: 92, y1: 520 };
    const C = circle(empty, eKg, W / 2, 306, 112, box, uid);
    const Bq = bar(D, 24, 572, W - 48, uid);
    const H1 = Math.ceil(Bq.bottom + 12);
    const weight = `<svg viewBox="0 0 ${W} ${H1}" width="100%" xmlns="http://www.w3.org/2000/svg" ${FONT}><defs>${hatch(uid + 'ld')}</defs>${head.join('')}${C.out.join('')}${Bq.out.join('')}</svg>`;
    const Bl = balance(D, 24, 54, W - 48, side);
    const H2 = Math.ceil(Bl.bottom + 10);
    const balanceSvg = `<svg viewBox="0 0 ${W} ${H2}" width="100%" xmlns="http://www.w3.org/2000/svg" ${FONT}>${T(18, 30, 'BALANCE · WHERE THE WEIGHT SITS', { sz: 11.5, c: TH.faint, w: 600, ls: 1.6 })}${Bl.out.join('')}</svg>`;
    return { weight, balance: balanceSvg, placed: C.placed, box, W, H1, H2 };
  }
  const API = { CAT, ROWCAT, OCC_KG, data, svg, cats, wrap2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window === 'undefined') return;
  window.FICHE_MASS = API;
  // ---- the page on the board (FICHE_BOARD.pages, the registry) ------------------------------------------------------------
  const $ = (h, c) => { const e = document.createElement(h); if (c) e.className = c; return e; };
  // the side picture's size; a slow load (a busy server, the boot's queue) draws the page without the profile after 4 s
  const sizeOf = src => new Promise(res => { if (!src) return res(null); const im = new Image(); const t = setTimeout(() => res(null), 4000);
    im.onload = () => { clearTimeout(t); res({ W: im.naturalWidth, H: im.naturalHeight }); }; im.onerror = () => { clearTimeout(t); res(null); }; im.src = src; });
  const massOf = (rec, ctx) => (rec && rec.data && rec.data.mass) || (ctx && ctx.mass) || null;
  async function mount(sheet, rec, ctx) {
    const wrap = $('div', 'pfMass'); sheet.appendChild(wrap);
    let D = massOf(rec, ctx);
    if (!D && ctx && ctx.spec) {
      const m = $('div', 'pfMsg'); m.textContent = 'Weighing the aeroplane …'; wrap.appendChild(m);
      await new Promise(r => setTimeout(r, 30));
      try { D = data(ctx.spec); ctx.mass = D; } catch (e) { m.textContent = 'The aeroplane could not be weighed: ' + String(e && e.message || e).slice(0, 90); return; }
      m.remove();
    }
    if (!D) { const m = $('div', 'pfMsg'); m.textContent = 'No weights for this aeroplane yet.'; wrap.appendChild(m); return; }
    const sideSrc = rec && rec.pics && rec.pics.side ? (typeof rec.pics.side === 'string' ? rec.pics.side : (ctx && ctx.urlOf ? ctx.urlOf(rec.pics.side) : '')) : '';
    const sz = await sizeOf(sideSrc), len = rec && rec.data && rec.data.dims && rec.data.dims.length;
    const S = svg(D, sz && len ? { href: sideSrc, W: sz.W, H: sz.H, length: len } : null);
    const a = $('div', 'pfMassW'), b = $('div', 'pfMassB'); a.innerHTML = S.weight; b.innerHTML = S.balance;
    wrap.appendChild(a); wrap.appendChild(b);
  }
  const reg = () => {
    const B = window.FICHE_BOARD; if (!B || !B.pages) return false;
    B.pages.add({ id: 'mass', label: 'Mass', mount, visible: (rec, ctx) => !!(massOf(rec, ctx) || (ctx && ctx.spec)) });
    return true;
  };
  if (!reg()) window.addEventListener('DOMContentLoaded', reg, { once: true });
})();
