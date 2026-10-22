// town_ring.js — THE NEAR RING (G3416, CITY-B; futureDesigns/CITY-2.0-PLAN-2026-10-20.md, METLA-2.0-HANDOVER.md §0/§4.3).
//
// The user, 18 Oct: "Even when the town is only a few boxes, it impacts frame evenness like crazy." The town's per-frame JS
// walked EVERY plot of the town, every frame, wherever the eye was: the detail cut over every house, the kit host's rung
// over every kit house, the far town's cells, the lots' cells. A far, idle town paid it all. THE RING is the one list those
// ticks walk: what stands near the eye, kept by the stream, rebuilt only when the eye has moved `move` metres (or an item
// came or went inside it). An item far away is in its FAR STATE, set once as it leaves the ring (`onLeave`), and never
// visited again until the eye comes back. Per-frame work is O(near ring), never O(town).
//
//   TOWN_RING.make({ cell: 256, move: 40, onLeave(item) }) -> ring
//     ring.add(item, x, z, reach)  an item at world (x, z): it is in the ring while the eye is within reach + move of it
//                                  (its own farthest switch: past `reach` it is in its far state). Re-adding moves it.
//     ring.remove(item)            gone (no onLeave: the caller tore it down)
//     ring.update(ex, ez)          once a frame: true when the ring was rebuilt (the eye moved `move` m, or `dirty`)
//     ring.updateEye(eye)          the same from an object's x / z (a THREE.Vector3: nothing boxed on the way in)
//     ring.list, ring.n            the items in the ring (list[0 .. n-1]; the array is the ring's own, reused)
//     ring.has(item)               in the ring now
//     ring.dirty()                 rebuild at the next update (a dial changed every item's reach)
//     ring.all(fn)                 every item, near or far (a dial flipped: the caller re-applies the far state)
//     ring.sweep(k)                k slots a call, round-robin: an item `alive(item)` says is gone leaves (o.alive: the
//                                  caller tore it down somewhere it does not tell the ring - a constant cost a frame)
//     ring.stats                   { items, n, rebuilds, visits (items looked at by the rebuilds), cells, reachMax }
//
// ALLOCATION: none per frame. update() with an eye that has not moved is two subtractions; a rebuild walks the cells within
// reachMax + move by NUMERIC keys (no strings), the two lists swap and grow only past their high-water mark. add/remove are
// the stream's (an item built or torn down), not the frame's.
'use strict';
(function () {
const TOWN_RING = {};
// a cell (i, j) as one number: |i|, |j| < 32768 cells (8 388 km at 256 m)
const KEY = (i, j) => (i + 32768) * 65536 + (j + 32768);

TOWN_RING.make = function (o) {
  o = o || {};
  const C = o.cell || 256, MOVE = o.move === undefined ? 40 : +o.move, onLeave = o.onLeave || null, alive = o.alive || null;
  let sweepAt = 0;
  // the items' slots (an item's slot is reused after a remove; the arrays grow by doubling, never shrink)
  let cap = 64;
  let X = new Float64Array(cap), Z = new Float64Array(cap), Rr = new Float64Array(cap), IN = new Int32Array(cap).fill(-1), CK = new Float64Array(cap);
  const items = [], free = [], slotOf = new Map(), cells = new Map();
  let used = 0, reachMax = 0, cx = NaN, cz = NaN, isDirty = true;
  let list = [], next = [], n = 0;
  const stats = { items: 0, n: 0, rebuilds: 0, visits: 0, cells: 0, reachMax: 0, leaves: 0 };
  function grow() {
    const c2 = cap * 2;
    const g = (A, T, fill) => { const B = new T(c2); B.set(A); if (fill !== undefined) B.fill(fill, cap); return B; };
    X = g(X, Float64Array); Z = g(Z, Float64Array); Rr = g(Rr, Float64Array); IN = g(IN, Int32Array, -1); CK = g(CK, Float64Array);
    cap = c2;
  }
  function cellOf(s) { const k = CK[s]; let L = cells.get(k); if (!L) { L = []; cells.set(k, L); stats.cells = cells.size; } return L; }
  function unCell(s) { const L = cells.get(CK[s]); if (!L) return; const i = L.indexOf(s); if (i >= 0) { L[i] = L[L.length - 1]; L.pop(); } }
  function add(item, x, z, reach) {
    let s = slotOf.get(item);
    if (s === undefined) { s = free.length ? free.pop() : used++; if (s >= cap) grow(); slotOf.set(item, s); items[s] = item; }
    else unCell(s);
    X[s] = x; Z[s] = z; Rr[s] = Math.max(0, +reach || 0);
    CK[s] = KEY(Math.floor(x / C), Math.floor(z / C));
    cellOf(s).push(s);
    if (Rr[s] > reachMax) reachMax = Rr[s];
    stats.items = slotOf.size; stats.reachMax = reachMax;
    // an item that lands within the ring's reach joins it at the next update
    if (cx === cx && Math.hypot(x - cx, z - cz) < Rr[s] + 2 * MOVE) isDirty = true;
    return s;
  }
  function remove(item) {
    const s = slotOf.get(item);
    if (s === undefined) return false;
    unCell(s);
    if (IN[s] >= 0) {   // out of the live list: the last one takes its place
      const p = IN[s], t = list[n - 1]; list[p] = t; IN[slotOf.get(t)] = p; list[n - 1] = undefined; n--; stats.n = n;
    }
    IN[s] = -1; items[s] = undefined; slotOf.delete(item); free.push(s);
    stats.items = slotOf.size;
    return true;
  }
  // (the eye as an object: a double handed to a call V8 does not inline is a fresh heap number - two a frame, the ring's whole
  // cost when nothing moved; the caller's eye is read here instead)
  const tmp = { x: 0.5, z: 0.5 };
  function update(ex, ez) { tmp.x = ex; tmp.z = ez; return updateEye(tmp); }
  function updateEye(e) {
    const ex = e.x, ez = e.z;
    if (!isDirty && Math.abs(ex - cx) + Math.abs(ez - cz) < MOVE) return false;
    isDirty = false; cx = ex; cz = ez;
    stats.rebuilds++;
    // the cells within reachMax + move of the eye; each item in by its own reach
    const R = reachMax + MOVE, i0 = Math.floor((ex - R) / C), i1 = Math.floor((ex + R) / C), j0 = Math.floor((ez - R) / C), j1 = Math.floor((ez + R) / C);
    let m = 0;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const L = cells.get(KEY(i, j)); if (L === undefined) continue;
      for (let k = 0; k < L.length; k++) {
        const s = L[k]; stats.visits++;
        const dx = X[s] - ex, dz = Z[s] - ez, r = Rr[s] + MOVE;
        if (dx * dx + dz * dz < r * r) { next[m] = items[s]; m++; IN[s] = -2; }   // (marked: in the new list; its place set below)
      }
    }
    // who left: in the old list (IN its old place, >= 0), not marked
    for (let k = 0; k < n; k++) {
      const it = list[k], s = slotOf.get(it);
      if (s !== undefined && IN[s] >= 0) { IN[s] = -1; stats.leaves++; if (onLeave) onLeave(it); }
      list[k] = undefined;   // (the old list becomes the next rebuild's buffer: it keeps nothing alive)
    }
    for (let k = 0; k < m; k++) IN[slotOf.get(next[k])] = k;
    const t = list; list = next; next = t; n = m;
    stats.n = n;
    return true;
  }
  const ring = {
    add, remove, update, updateEye,
    get list() { return list; }, get n() { return n; },
    has: item => { const s = slotOf.get(item); return s !== undefined && IN[s] >= 0; },
    reachOf: item => { const s = slotOf.get(item); return s === undefined ? NaN : Rr[s]; },
    dirty() { isDirty = true; },
    // the largest reach is kept as a high-water mark; recompute it after a dial shrank every reach
    reMax() { reachMax = 0; for (const s of slotOf.values()) if (Rr[s] > reachMax) reachMax = Rr[s]; stats.reachMax = reachMax; isDirty = true; },
    all(fn) { for (const [it] of slotOf) fn(it); },
    sweep(k) {
      if (!alive || !used) return 0;
      let gone = 0;
      for (let q = 0; q < k; q++) { if (sweepAt >= used) sweepAt = 0; const it = items[sweepAt++]; if (it !== undefined && !alive(it)) { remove(it); gone++; } }
      return gone;
    },
    get size() { return slotOf.size; },
    get centre() { return [cx, cz]; },
    stats, cell: C, move: MOVE,
  };
  return ring;
};

if (typeof window !== 'undefined') window.TOWN_RING = TOWN_RING;
if (typeof module !== 'undefined' && module.exports) module.exports = TOWN_RING;
})();
