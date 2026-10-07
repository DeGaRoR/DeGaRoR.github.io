// FREIGHT-LOAD (G2345-G2349) — THE LOADING VIEW. futureDesigns/game/FREIGHT-2026-10-07.md §2, §4 (RULED, 7 Oct).
//
// The aeroplane on the garage stand, CUT AWAY (one clipping plane just inside the near skin: the near wall, the near
// door and the near wing go, the hold reads), the load drawn as its FREIGHT-ASSETS models (the props mapped to the
// item's goods; a plain box where there is none) at the packer's proposal. The player's hand:
//   drag an item (desktop), or tap it then tap where it goes (the phone; the desktop takes both)
//   drop it beside the aeroplane = left on the ground; Turn = a quarter turn about the vertical
//   tap an empty seat's chip = the seat out / in (the cage's own chair hides with it)
//   Propose again = the packer's answer for the seats as they are; Accept = the placement into the career's record
// What is refused is only what is physically impossible (77_freight_load.js freightLoadTarget, its why on the bar);
// the report is freightReport's, live: the mass against the MTOW, the CG on a small bar against the certified range,
// the worst floor in kg/m2 - out of range shown RED and ALLOWED. No right panel, no cards: one bar.
//
// LAZY (tools/build.js MANIFEST.lazy): loaded when the LOAD entry is pressed (app.js's FREIGHT page half, which only
// exists under ?career=1 or ?freight=1). It owns nothing of the scene: app.js's host hands it the card -> world
// frame, the camera, the build's clip, the seats' visibility and the save.
(function () {
  'use strict';
  const W = window, D = document;
  let H = null, T = null, card = null, job = null, st = null, grp = null, ashGrp = null, ghost = null;
  let objs = new Map(), bar = null, picked = null, drag = null, msg = '', msgBad = false, M = null, Minv = null;
  let floorY = 0, clipZ = 0, lastRep = null, accepted = false;
  const fmt = n => Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ');
  const lin = h => { const c = new T.Color(h); if (c.convertSRGBToLinear) c.convertSRGBToLinear(); return c; };

  // ---- THE MODELS (FREIGHT-ASSETS' catalogue: the existing props first, the Poly Haven loads, a box where none) ----
  const MODEL_OF = { 'goods.parts': 'crate_wood_a', 'goods.tools': 'toolchest_metal', 'goods.samples': 'load_crate_samples',
                     'goods.water': 'box_cardboard', 'goods.supplies': 'load_bag_cement' };
  // (mail sacks, kit bags, tent bags, the stretcher: no model yet - FREIGHT-ASSETS' gap list - a plain box in the kind's colour)
  const KIND_MODEL = { crate: 'crate_wood_a', box: 'box_cardboard', drum: 'drum_steel' };
  const KIND_COL = { crate: 0xa77a48, box: 0xc9a46b, bag: 0x9d8f6a, drum: 0x5d6f7d, long: 0x77787a, bulk: 0xb9ab8a, stretcher: 0xd8d8d0 };
  function modelKey(it) {
    const goods = 'goods.' + String(it.id).replace(/\.\d+$/, '');
    const k = MODEL_OF[goods] || (goods === 'goods.load' ? null : null) || KIND_MODEL[it.kind] || null;
    return (k && typeof PROP_REG !== 'undefined' && PROP_REG.props && PROP_REG.props[k] && typeof propMesh === 'function') ? k : null;
  }
  // a prop still on the wire fits its box when it lands (props.js's one PROP_LANDED hook, chained once)
  const pend = new Map();
  function landing(p, fn) {
    if (!W.__frLanded) {
      const prev = W.PROP_LANDED;
      W.PROP_LANDED = function (k, g) { if (prev) { try { prev(k, g); } catch (e) {} } const f = pend.get(g); if (f) { pend.delete(g); f(); } };
      W.__frLanded = true;
    }
    pend.set(p, fn);
  }
  // an item's look, fitted to its box [lx, ly, lz] (card frame: x aft, y up, z right), its base at y 0
  function itemObject(it, L) {
    const g = new T.Group();
    g.userData.frId = it.id;
    const key = modelKey(it);
    const box = new T.Mesh(new T.BoxGeometry(L[0], L[1], L[2]),
      new T.MeshStandardMaterial({ color: lin(KIND_COL[it.kind] || 0xb0a080), roughness: 0.85, metalness: 0 }));
    box.position.y = L[1] / 2;
    box.userData.frId = it.id;
    g.add(box);
    if (key) {
      // the prop, scaled to the box; the box stays as the pick target (invisible) once the prop has landed
      const p = propMesh(T, key);
      const fit = () => {
        const bb = new T.Box3().setFromObject(p);
        if (!isFinite(bb.min.x) || bb.isEmpty()) return;
        const s = new T.Vector3(); bb.getSize(s);
        // the prop's long horizontal axis along the box's
        const turn = (s.x >= s.z) !== (L[0] >= L[2]);
        const sx = turn ? s.z : s.x, sz = turn ? s.x : s.z;
        const w = new T.Group(); w.add(p);
        p.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
        if (turn) w.rotation.y = Math.PI / 2;
        const sc = new T.Group(); sc.add(w);
        sc.scale.set(L[0] / Math.max(1e-3, sx), L[1] / Math.max(1e-3, s.y), L[2] / Math.max(1e-3, sz));
        g.add(sc);
        box.material.visible = false;
        p.traverse(o => { if (o.isMesh) o.userData.frId = it.id; });
      };
      if (p.userData.propPending) landing(p, fit);
      else fit();
      g.userData.prop = key;
    }
    // the outline: the pick / the red of a floor over its limit
    const e = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(L[0], L[1], L[2])), new T.LineBasicMaterial({ color: 0xffb257, transparent: true, opacity: 0 }));
    e.position.y = L[1] / 2; e.userData.edge = true;
    g.add(e); g.userData.edge = e;
    return g;
  }

  // ---- THE SCENE ------------------------------------------------------------------------------------------------
  const dimsOf = r => [r.at.x1 - r.at.x0, r.at.y1 - r.at.y0, r.at.z1 - r.at.z0];
  function place(o, r) { o.position.set(0.5 * (r.at.x0 + r.at.x1), r.at.y0, 0.5 * (r.at.z0 + r.at.z1)); }
  // the ground beside the aeroplane (the camera's side, past the clip): the items left out, in a row
  function groundSpot(k) {
    const Hd = card.hold;
    return { x: Hd.x0 + Hd.n * Hd.dx + 0.5 + k * 0.8, z: clipZ + 0.55 };
  }
  function rebuild() {
    for (const o of objs.values()) { if (o.parent) o.parent.remove(o); }
    objs = new Map();
    const ash = freightLoadAshore(card, st);
    for (const r of st.placed) {
      const o = itemObject(r, dimsOf(r)); place(o, r); grp.add(o); objs.set(r.id, o);
    }
    ash.forEach((it, k) => {
      const L = frOrients(it)[0], g = groundSpot(k);
      const o = itemObject(it, L);
      // on the room's floor (world y), at the spot's x / z in the aeroplane's frame
      const v = new T.Vector3(g.x, 0, g.z).applyMatrix4(M);
      o.position.set(v.x, H.groundY(), v.z);
      o.rotation.y = Math.atan2(-M.elements[2], M.elements[0]);
      o.userData.ashore = true;
      ashGrp.add(o); objs.set(it.id, o);
    });
    // the passengers the packer works around (the pilot is the cage's own figure) and the seats taken out
    for (const c of grp.children.filter(c => c.userData.frOcc)) grp.remove(c);
    // a passenger: a slim figure where they sit (the packer keeps clear of their whole envelope, legs to head)
    for (const S of freightSeats(card, st)) {
      if (!S.occ || S.i === 0) continue;
      const y = freightRestY(card, S.back - 0.45, S.back) || floorY;
      const m = new T.Mesh(new T.BoxGeometry(0.42, 1.12, Math.min(0.4, S.w * 0.8)),
        new T.MeshStandardMaterial({ color: lin(0x63d3cc), transparent: true, opacity: 0.35, depthWrite: false }));
      m.position.set(S.back - 0.21, y + 0.56, S.z);
      m.userData.frOcc = true; grp.add(m);
    }
    for (const s of card.seats || []) H.seatVisible(s.i, !st.seatsOut.includes(s.i));
    for (const s of st.seatsOut) {
      const S = card.seats.find(q => q.i === s);
      const m = new T.Mesh(new T.PlaneGeometry(0.5, S.w), new T.MeshBasicMaterial({ color: lin(0xd3c3ae), transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(S.back - 0.25, (freightRestY(card, S.back - 0.5, S.back) || floorY) + 0.005, S.z);
      m.userData.frOcc = true; grp.add(m);
    }
    paint();
  }
  // the outlines: the picked item amber, an item over its floor limit red
  function paint() {
    lastRep = freightLoadReport(card, st);
    const badFloor = new Set(lastRep.floor.filter(f => !f.ok).map(f => f.id));
    for (const [id, o] of objs) {
      const e = o.userData.edge;
      const col = id === picked ? 0xffb257 : badFloor.has(id) ? 0xff5a4a : null;
      e.material.opacity = col == null ? 0 : 1;
      if (col != null) e.material.color.set(col);
    }
    renderBar();
  }

  // ---- THE POINTER: card coordinates under the pointer, on the hold's floor --------------------------------------
  const ray = { rc: null };
  function cardAt(ev) {
    const cv = H.canvas, r = cv.getBoundingClientRect();
    const ndc = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    if (!ray.rc) ray.rc = new T.Raycaster();
    ray.rc.setFromCamera(ndc, H.camera());
    return ray.rc;
  }
  function floorHit(rc) {
    // the ray in the card's frame, met with the hold's floor: the lowest floor first, then the floor at the station
    // it lands on (twice - the floor rises fore and aft); the plain floor level beyond the hold's ends
    const o = rc.ray.origin.clone().applyMatrix4(Minv), d = rc.ray.direction.clone().transformDirection(Minv);
    if (Math.abs(d.y) < 1e-6) return null;
    const Hd = card.hold;
    let y = floorY, p = null;
    for (let k = 0; k < 3; k++) {
      const t = (y - o.y) / d.y;
      if (t < 0) return p;
      p = { x: o.x + d.x * t, z: o.z + d.z * t };
      const i = Math.max(0, Math.min(Hd.n, Math.round((p.x - Hd.x0) / Hd.dx)));
      y = Hd.y0 + Hd.floor[i] / 100;
    }
    return p;
  }
  function itemHit(rc) {
    const list = [];
    for (const o of objs.values()) o.traverse(m => { if (m.isMesh && m.userData.frId) list.push(m); });
    const h = rc.intersectObjects(list, false)[0];
    return h ? h.object.userData.frId : null;
  }
  const onGround = p => p && p.z > clipZ + 0.3;
  // what a drop at p would do -> { kind: 'move' | 'ground', res }
  function drop(id, p, turn) {
    if (onGround(p)) return { kind: 'ground', res: freightLoadUnload(card, st, id) };
    return { kind: 'move', res: freightLoadMove(card, st, id, { x: p.x, z: p.z, turn: !!turn }) };
  }
  function showGhost(id, p) {
    if (ghost) { grp.remove(ghost); ghost = null; }
    if (!p || onGround(p)) return null;
    const t = freightLoadTarget(card, st, id, { x: p.x, z: p.z });
    const it = st.items.find(q => q.id === id), cur = st.placed.find(q => q.id === id);
    const L = t.ok ? dimsOf(t.row) : cur ? dimsOf(cur) : frOrients(it)[0];
    ghost = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(L[0], L[1], L[2])), new T.LineBasicMaterial({ color: t.ok ? 0x7be08a : 0xff5a4a }));
    if (t.ok) ghost.position.set((t.row.at.x0 + t.row.at.x1) / 2, t.row.at.y0 + L[1] / 2, (t.row.at.z0 + t.row.at.z1) / 2);
    else ghost.position.set(p.x, floorY + L[1] / 2, p.z);
    grp.add(ghost);
    return t;
  }
  function apply(r, what) {
    if (r.res.ok) { st = r.res.st; accepted = false; say(what, false); rebuild(); }
    else { say(r.res.why, true); paint(); }
  }
  function onDown(ev) {
    if (!H || (ev.button != null && ev.button !== 0)) return;
    if (bar && bar.contains(ev.target)) return;
    if (ev.target !== H.canvas) return;
    const rc = cardAt(ev), id = itemHit(rc);
    if (id) {
      ev.stopPropagation(); ev.preventDefault();
      drag = { id, x: ev.clientX, y: ev.clientY, moved: false, pid: ev.pointerId };
      return;
    }
    if (picked) {   // a tap on the hold or the ground with an item held: it goes there (the phone's way; the desktop's too)
      ev.stopPropagation(); ev.preventDefault();
      drag = { id: null, x: ev.clientX, y: ev.clientY, moved: false, pid: ev.pointerId, place: picked };
    }
  }
  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    ev.stopPropagation();
    if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 8) return;
    drag.moved = true;
    if (drag.id) {
      const p = floorHit(cardAt(ev));
      const t = showGhost(drag.id, p);
      say(onGround(p) ? 'leave ' + drag.id + ' on the ground' : t && !t.ok ? t.why : '', !!(t && !t.ok));
    }
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    ev.stopPropagation();
    const d = drag; drag = null;
    if (ghost) { grp.remove(ghost); ghost = null; }
    if (d.id && !d.moved) { picked = picked === d.id ? null : d.id; say(picked ? describe(picked) : '', false); paint(); return; }
    if (d.id && d.moved) {
      const p = floorHit(cardAt(ev));
      if (!p) { paint(); return; }
      picked = null;
      apply(drop(d.id, p), onGround(p) ? d.id + ' left on the ground' : d.id + ' moved');
      return;
    }
    if (d.place && !d.moved) {
      const p = floorHit(cardAt(ev));
      if (!p) return;
      const id = d.place;
      const r = drop(id, p);
      if (r.res.ok) picked = null;
      apply(r, onGround(p) ? id + ' left on the ground' : id + ' placed');
    }
  }
  function describe(id) {
    const it = st.items.find(q => q.id === id), r = st.placed.find(q => q.id === id);
    return id + ' · ' + it.kg + ' kg · ' + it.dims.map(v => Math.round(v * 100)).join(' × ') + ' cm' +
      (r ? ' · ' + (r.on ? 'on the ' + r.on : r.space === 'baggage' ? 'in the baggage bay' : 'on the cabin floor') : ' · on the ground') +
      ' — ' + (H.phone ? 'tap where it goes' : 'drag it, or click where it goes');
  }
  function say(t, bad) { msg = t || ''; msgBad = !!bad; renderBar(); }

  // ---- THE BAR --------------------------------------------------------------------------------------------------
  const CSS = `
body.fr-loading #c{margin-left:0 !important;width:100% !important;height:100% !important;transition:none !important}
html.phone body.fr-loading #c{position:fixed;left:0;top:0;width:100vw !important;height:100vh !important}
#frLoad{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147481000;width:min(760px,calc(100vw - 24px));box-sizing:border-box;
 background:rgba(22,20,17,.9);color:#efe6d6;border:1px solid rgba(255,178,87,.45);border-radius:10px;padding:10px 14px;font:13px/1.35 'IBM Plex Sans',system-ui,sans-serif}
#frLoad .frHead{display:flex;align-items:center;gap:10px;justify-content:space-between}
#frLoad .frHead b{color:#ffb257;font-weight:600;letter-spacing:.04em}
#frLoad .frRow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;margin-top:6px}
#frLoad .bad{color:#ff6a5a}#frLoad .ok{color:#9fdc9a}
#frLoad .frCg{display:inline-flex;align-items:center;gap:8px}
#frLoad .frTrack{position:relative;width:150px;height:10px;border-radius:5px;background:rgba(255,255,255,.12)}
#frLoad .frBand{position:absolute;top:0;bottom:0;background:rgba(123,224,138,.45);border-radius:5px}
#frLoad .frTick{position:absolute;top:-4px;width:3px;height:18px;margin-left:-1px;background:#fff;border-radius:1px}
#frLoad .frTick.bad{background:#ff5a4a}
#frLoad button,#frLoad select{min-height:34px;padding:0 12px;border-radius:17px;border:1px solid rgba(255,178,87,.6);background:rgba(40,34,28,.9);color:#ffd9a8;font:600 12.5px 'IBM Plex Sans',system-ui,sans-serif;cursor:pointer}
#frLoad button.go{background:#ffb257;color:#1c1814;border-color:#ffb257}
#frLoad button[disabled]{opacity:.45;cursor:default}
#frLoad .seat{min-height:30px;padding:0 10px;font-weight:500}
#frLoad .seat.out{border-style:dashed;color:#d3c3ae}
#frLoad .frMsg{min-height:18px;margin-top:6px}
#frLoad .frAcc{color:#9fdc9a}
#frLoad.phone{bottom:0;border-radius:12px 12px 0 0;width:100vw;padding:8px 10px calc(8px + env(safe-area-inset-bottom));font-size:12px;line-height:1.3}
#frLoad.phone .frHead{flex-wrap:wrap;gap:6px}
#frLoad.phone .frHead>span:first-child{flex:1 1 auto}
#frLoad.phone .frPick{order:3;flex:1 1 100%;display:flex;gap:6px}
#frLoad.phone .frPick select{flex:1 1 0;min-width:0}
#frLoad.phone .frRow{gap:4px 12px;margin-top:4px}
#frLoad.phone button,#frLoad.phone select{min-height:48px;border-radius:24px;padding:0 12px;font-size:12px}
#frLoad.phone .seat{min-height:44px}
#frLoad.phone .frActs{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:6px;width:100%}
#frLoad.phone .frMsg{margin-top:4px}
#frLoad.phone .frTrack{width:96px}`;
  function el(tag, cls, html) { const e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function buildBar() {
    if (!D.getElementById('frLoadCss')) { const s = el('style'); s.id = 'frLoadCss'; s.textContent = CSS; D.head.appendChild(s); }
    bar = el('div'); bar.id = 'frLoad';
    bar.addEventListener('click', onBar);
    bar.addEventListener('change', onBar);
    D.body.appendChild(bar);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function renderBar() {
    if (!bar) return;
    bar.className = H && H.phone ? 'phone' : '';
    const R = lastRep;
    let h = '<div class="frHead"><span><b>LOADING</b> · ' + esc(job.title || '') + ' · ' + esc(card.label) + '</span>';
    if (job.picker) h += '<span class="frPick">' + job.picker + '</span>';
    h += '<button data-a="close" aria-label="close the loading view">✕</button></div>';
    if (R) {
      const C = R.cg, pr = C.pctRange, lo = Math.min(pr[0], C.pct) - 6, hi = Math.max(pr[1], C.pct) + 6, at = v => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%';
      const fl = R.floor.slice().sort((a, b) => b.kgM2 / (b.limit || 1) - a.kgM2 / (a.limit || 1))[0];
      h += '<div class="frRow">' +
        '<span class="' + (R.mass.ok ? '' : 'bad') + '">mass <b>' + fmt(R.mass.kg) + '</b> / ' + fmt(R.mass.mtow) + ' kg</span>' +
        '<span class="frCg ' + (C.ok ? '' : 'bad') + '">CG <span class="frTrack" title="the certified range"><span class="frBand" style="left:' + at(pr[0]) + ';width:calc(' + at(pr[1]) + ' - ' + at(pr[0]) + ')"></span>' +
        '<span class="frTick' + (C.ok ? '' : ' bad') + '" style="left:' + at(C.pct) + '"></span></span><b>' + C.pct.toFixed(1) + ' %</b> MAC <small>(' + pr[0].toFixed(0) + '–' + pr[1].toFixed(0) + ')</small></span>' +
        (fl ? '<span class="' + (R.floorOk ? '' : 'bad') + '">floor <b>' + fmt(fl.kgM2) + '</b> / ' + fl.limit + ' kg/m²</span>' : '<span>floor —</span>') +
        (R.baggage.limit ? '<span class="' + (R.baggage.ok ? '' : 'bad') + '">baggage ' + fmt(R.baggage.kg) + ' / ' + R.baggage.limit + ' kg</span>' : '') +
        '</div>';
      const empty = (card.seats || []).filter(s => s.i > 0 && s.i > st.pax);
      h += '<div class="frRow"><span>' + R.aboard + ' of ' + R.items + ' aboard, ' + fmt(R.cargoKg) + ' kg' +
        (R.ashore.length ? ' · <span class="bad">' + R.ashore.length + ' on the ground (' + esc(R.ashore.join(', ')) + ')</span>' : '') +
        (st.pax ? ' · ' + st.pax + ' passenger' + (st.pax > 1 ? 's' : '') : '') + '</span>' +
        (empty.length ? '<span>' + empty.map(s => '<button class="seat' + (st.seatsOut.includes(s.i) ? ' out' : '') + '" data-a="seat" data-i="' + s.i + '">seat ' + (s.i + 1) + (st.seatsOut.includes(s.i) ? ' out' : ' in') + '</button>').join(' ') + '</span>' : '') +
        '</div>';
      const why = R.why.length ? R.why.join(' · ') : '';
      h += '<div class="frMsg ' + (msgBad ? 'bad' : '') + '">' + esc(msg || (why ? why : (accepted ? '' : 'within every limit'))) + '</div>';
      if (why && msg) h += '<div class="frMsg bad">' + esc(why) + '</div>';
    }
    const ph = H && H.phone;
    h += '<div class="frRow frActs">' +
      '<button data-a="propose">' + (ph ? 'Propose' : 'Propose again') + '</button>' +
      (picked ? '<button data-a="turn">Turn</button>' + (st.placed.some(p => p.id === picked) ? '<button data-a="ground">' + (ph ? 'Unload' : 'Leave on the ground') + '</button>' : '') : '') +
      '<button class="go" data-a="accept"' + (job.canAccept ? '' : ' disabled title="' + esc(job.why || '') + '"') + '>Accept</button>' +
      '</div>' + (accepted ? '<div class="frAcc">accepted · ' + esc(accepted) + '</div>' : '');
    bar.innerHTML = h;
  }
  function onBar(ev) {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    if (ev.type === 'change' && b.tagName !== 'SELECT') return;
    if (ev.type === 'click' && b.tagName === 'SELECT') return;
    const a = b.dataset.a;
    if (a === 'close') return close();
    if (a === 'pick') return H.pick(b.name, b.value);
    if (a === 'propose') { st = freightLoadPropose(card, st); picked = null; accepted = false; say('the packer\'s answer', false); rebuild(); return; }
    if (a === 'seat') { const r = freightLoadSeat(card, st, +b.dataset.i); if (r.ok) { st = r.st; accepted = false; rebuild(); say('seat ' + (+b.dataset.i + 1) + (st.seatsOut.includes(+b.dataset.i) ? ' out' : ' back in'), false); } else say(r.why, true); return; }
    if (a === 'turn' && picked) {
      const cur = st.placed.find(p => p.id === picked);
      if (!cur) { say('a turn on the ground changes nothing: place it first', false); return; }
      apply({ res: freightLoadMove(card, st, picked, { x: (cur.at.x0 + cur.at.x1) / 2, z: (cur.at.z0 + cur.at.z1) / 2, turn: true }) }, picked + ' turned');
      return;
    }
    if (a === 'ground' && picked) { const id = picked; picked = null; apply({ res: freightLoadUnload(card, st, id) }, id + ' left on the ground'); return; }
    if (a === 'accept') {
      const r = H.accept(card, st, job);
      if (r && r.ok) { accepted = r.say || 'saved'; say('', false); } else say((r && r.why) || 'not saved', true);
    }
  }

  // ---- OPEN / CLOSE ---------------------------------------------------------------------------------------------
  // host: { THREE, canvas, camera(), parent, frame() -> Matrix4 (card -> world) | null, groundY(), look(target, az, el,
  //         dist), clip(plane | null), seatVisible(i, on), ui(hidden), job() -> { card, items, pax, rec, title,
  //         canAccept, why, picker }, accept(card, st, job) -> { ok, why, say }, pick(name, value), phone }
  function open(host) {
    if (H) close();
    H = host; T = host.THREE;
    job = host.job();
    card = job.card;
    if (!card || !card.hold) return { ok: false, why: job.why || 'this aeroplane\'s hold is not measured' };
    M = host.frame();
    if (!M) { H = null; return { ok: false, why: 'the aeroplane on the stand is not placed yet' }; }
    Minv = M.clone().invert ? M.clone().invert() : new T.Matrix4().getInverse(M);
    const Hd = card.hold;
    floorY = Hd.y0 + Math.min(...Hd.floor) / 100;
    let mh = 0; for (const row of Hd.half) for (const v of row) mh = Math.max(mh, v);
    clipZ = 0.8 * mh / 100;
    st = job.rec ? freightLoadFromRecord(card, job.rec) : freightLoadNew(card, job.items, { pax: job.pax, seatsOut: job.seatsOut || [] });
    accepted = job.rec ? 'the placement you accepted' : false;
    picked = null; msg = job.note || ''; msgBad = false;
    grp = new T.Group(); grp.name = 'freightLoad'; grp.matrixAutoUpdate = false; grp.matrix.copy(M); grp.matrixWorldNeedsUpdate = true;
    ashGrp = new T.Group(); ashGrp.name = 'freightLoadGround';
    host.parent.add(grp); host.parent.add(ashGrp);
    // THE CUT: keep what is inside z <= clipZ in the card frame (the near skin, door and wing go)
    const zw = new T.Vector3().setFromMatrixColumn(M, 2).normalize(), O = new T.Vector3().setFromMatrixPosition(M);
    host.clip(new T.Plane(zw.clone().negate(), clipZ + zw.dot(O)));
    // THE EYE: from the cut side, a little above the cabin floor, the hold framed
    const c = new T.Vector3((Hd.x0 + Hd.x0 + Hd.n * Hd.dx) / 2, floorY + 0.35, 0).applyMatrix4(M);
    const len = Hd.n * Hd.dx, ph = !!host.phone;
    // the phone (portrait, the bar over the lower ~40 %): farther, lower (under the high wing), the hold lifted into the
    // upper half by aiming below it
    const dist = ph ? Math.max(6.5, len * 3.1) : Math.max(4.2, len * 1.8);
    let elev = 0.32;
    if (ph) {
      // the eye ~1.1 m over the floor (under a high wing, above the floor plane the pointer is met on), looking down
      // past the hold so the hold sits in the upper part of the screen
      const eyeY = new T.Vector3(0, floorY + 1.1, 0).applyMatrix4(M).y, holdY = c.y;
      c.y -= dist * Math.tan(((host.camera().fov || 46) * Math.PI) / 360) * 0.45;
      elev = Math.asin(Math.max(-0.9, Math.min(0.9, (eyeY - c.y) / dist)));
      void holdY;
    }
    host.look(c, Math.atan2(zw.z, zw.x) - 0.12, elev, dist);
    host.ui(true);
    if (!bar) buildBar(); else if (!bar.parentNode) D.body.appendChild(bar);
    D.body.classList.add('fr-loading');
    W.addEventListener('pointerdown', onDown, true);
    W.addEventListener('pointermove', onMove, true);
    W.addEventListener('pointerup', onUp, true);
    W.addEventListener('keydown', onKey, true);
    rebuild();
    return { ok: true };
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if ((e.key === 'r' || e.key === 'R') && picked) { e.stopPropagation(); onBar({ type: 'click', target: { closest: () => ({ dataset: { a: 'turn' }, tagName: 'BUTTON' }) } }); }
  }
  function close() {
    if (!H) return;
    W.removeEventListener('pointerdown', onDown, true);
    W.removeEventListener('pointermove', onMove, true);
    W.removeEventListener('pointerup', onUp, true);
    W.removeEventListener('keydown', onKey, true);
    if (grp && grp.parent) grp.parent.remove(grp);
    if (ashGrp && ashGrp.parent) ashGrp.parent.remove(ashGrp);
    for (const s of (card && card.seats) || []) H.seatVisible(s.i, true);
    H.clip(null); H.ui(false);
    D.body.classList.remove('fr-loading');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    const h = H; H = null; grp = ashGrp = ghost = null; objs = new Map();
    if (h.closed) h.closed();
  }
  W.FREIGHT_LOAD = {
    open, close, isOpen: () => !!H,
    // a rig's hands (the stills, UISMOKE): the session, the report, and the moves the pointer makes
    state: () => (st ? JSON.parse(JSON.stringify(st)) : null), report: () => lastRep, card: () => card, picked: () => picked, msg: () => msg,
    move: (id, x, z, turn) => { apply({ res: freightLoadMove(card, st, id, { x, z, turn }) }, id + ' moved'); return { ok: !msgBad, why: msgBad ? msg : '' }; },
    ground: id => { apply({ res: freightLoadUnload(card, st, id) }, id + ' left on the ground'); return { ok: !msgBad, why: msgBad ? msg : '' }; },
    seat: i => onBar({ type: 'click', target: { closest: () => ({ dataset: { a: 'seat', i: String(i) }, tagName: 'BUTTON' }) } }),
    pick: id => { picked = id; say(id ? describe(id) : '', false); paint(); },
    propose: () => onBar({ type: 'click', target: { closest: () => ({ dataset: { a: 'propose' }, tagName: 'BUTTON' }) } }),
    accept: () => onBar({ type: 'click', target: { closest: () => ({ dataset: { a: 'accept' }, tagName: 'BUTTON' }) } }),
    accepted: () => accepted,
    // the screen point of a card point (a rig taps the phone's way through it)
    screenOf: (x, y, z) => { if (!H) return null; const v = new T.Vector3(x, y, z).applyMatrix4(M).project(H.camera()); const r = H.canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  };
})();
