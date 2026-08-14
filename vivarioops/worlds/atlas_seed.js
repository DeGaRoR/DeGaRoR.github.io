// worlds/atlas_seed.js — the authored library, planted in the Atlas.
//
// The Atlas (ui/screens/atlas.js) lists `specimen:` records, and until now the
// ONLY writer was the tank's Save button (tank.js) — so a fresh install opened an
// empty Atlas even though the project ships a hand-authored creature library.
// This is the "Atlas write path" NEXT-CREATURE-VARIETY.md §D asks for: it plants
// the authored bodies as specimen records the first time the Atlas is opened.
//
// TWO SOURCES, ONE SHAPE. The five seed swimmers (worlds/seeds.js) are already in
// the canonical in-memory genome shape — jointGenes is a MAP — so they are used
// as-is, exactly as tools/_atlas.mjs does. The three frozen residents
// (worlds/w1_residents.js) are stored in SERIALISED form — jointGenes is an ARRAY
// — so they go through `deserialise` first, exactly as tools/_dw.mjs does. Mixing
// the two shapes without this would hand morphogenesis a controller it cannot read.
//
// IDEMPOTENT. Keyed by genomeHash, skipped if already present, so it is safe to
// run on every Atlas mount: the first visit renders eight portraits, every visit
// after is eight cheap key checks. `source: 'authored'` travels with each record
// so the Atlas can label them and refuse to delete the library out from under you.
//
// THUMBNAILS ARE BROWSER-ONLY. renderThumbnail spins a throwaway WebGL context,
// so this cannot run in Node — it plants specimens at runtime, in the app, not at
// build time. That is why it lives here and is called from the Atlas screen.
//
// It reaches UPWARD into render/ and ui/, which nothing under /engine/ may do
// (N3) and which is worth stating rather than leaving to be noticed: this module
// is an APP-TIER writer that happens to live beside the world fixtures, not part
// of the world contract. The two things it needs — a portrait and a vernacular —
// both require design tokens, and a copy of a token here is exactly the drift
// N16 exists to prevent.

import * as store from '../trunk/store.js';
import { SEEDS } from './seeds.js';
import { CURATED } from './w1_curated.js';
import { REEF } from './w1_reef.js';
import { BRED } from './w1_bred.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS } from './w1_residents.js';
import { W1_SLICE } from './w1_slice.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { genomeHash, deserialise } from '../engine/l1/genome.js';
import { binomial } from '../engine/l1/naming.js';
import { W1_SPINE_IDS, W1_SPINE_GENOMES } from './w1_spines.js';
import { W1_PLAYER_IDS, W1_PLAYER_GENOMES, W1_PLAYER_NAMES } from './w1_player.js';
import { renderThumbnail, RENDER_TAG } from '../render/thumbnail.js';
import { lineageOf, nameFor } from '../ui/vernacular.js';

// The seed SWIMMERS, in display order. `staircase` is a deliberate
// counter-example (it self-intersects and morphogenesis rejects it) and is
// excluded here for the same reason engine/l1/breed.js OPENING_SEEDS excludes it.
//
// `jelly` is included because the whole reason it was built is to be LOOKED AT:
// it is the project's first radial body and the open question is whether
// four-fold symmetry reads as a medusa or as a box with four box-arms. A creature
// that answers a rendering question and never reaches the renderer answers
// nothing. It is a weak swimmer and that is expected — it is a reference, not a
// contender, and `origin.founder` says so on every descendant.
const SEED_IDS = ['eel', 'eel-fast', 'eel-slow', 'eel-unison', 'eel-finned', 'jelly'];

// THE PHASE A EXIT CAST. The Atlas sorts newest first and authored records take
// `AUTHORED_BASE - i`, so index order IS display order: putting the two
// reference swimmers and the four drawn spines in the first six slots makes them
// the default six the Forage screen releases.
//
// The point of the arrangement is comparison. `eel` and `eel-fast` are the
// authored animals the library was always built around; the four spines were
// DRAWN by the post-A2 generator, which before A2 could not produce a segmented
// body at all. Six creatures in one ocean, half of them expressible only after
// this phase.
// ── RE-ORDERED 2026-08-10 FOR THE BEACON ─────────────────────────────────────
//
// This was `['eel', 'eel-fast']`, the two authored references, chosen when the
// question on screen was "does anything swim". The question on screen now is
// "does anything GO SOMEWHERE", and the first six slots should let a person
// answer it by dropping a beacon and watching, rather than by reading a table.
//
// So the cast leads with the three SELECTED creatures and `eel-unison`, ordered
// so the contrast is visible in one tank. Measured with `tools/_zbeacon.mjs`,
// beacon 8 cm away, 120 s, 8 placements spanning the sphere:
//
//     creature            arrives   closure   v cm/s   reach in 120 s
//     stumbler-striped      2/8      0.403     0.216      25.9 cm
//     eel-unison            1/8      0.395     0.510      61.3 cm
//     spokebeast-banded     0/8      0.346     0.033       4.0 cm
//     oddfoot-glossy        0/8      0.165     0.019       2.3 cm
//     eel-fast              —        —         0.763      91.6 cm
//     eel                   0/8      0.095     0.282      33.9 cm
//
// The order is the ARGUMENT. The first two arrive. The next two are the round-one
// winners, which aim well and cannot travel — `spokebeast-banded` swims almost
// straight at the mark on every placement and runs out of body before it gets
// there, which is the clearest thing in the tank to look at and the reason the
// objective was rewritten. The last two are the references: the fastest creature
// in the library, which has range and does not aim, and the eel it all came from.
//
// CAST_ORDER MAY NOW NAME A CURATED SPECIMEN, not only a seed. `authoredList`
// resolves against SEEDS and CURATED together, and both later blocks skip
// anything already placed here, so an id cannot be planted twice.
const CAST_ORDER = [
  'stumbler-striped', 'eel-unison', 'spokebeast-banded', 'oddfoot-glossy',
  'eel-fast', 'eel',
];

// Ordering: authored records get small, stable createdAt values so they form a
// deterministic block in seeds-then-residents order (the Atlas sorts newest
// first). Player-saved specimens use Date.now() — ~1.75e12 in 2026 — so they
// always sort ABOVE the library, and the library is a stable shelf beneath them.
const AUTHORED_BASE = 1_000_000;

/**
 * The authored library as `{ id, commonName, genome, meta }`, genomes in
 * canonical (map-jointGenes) form. Residents carry no authored common name —
 * they are known by their derived binomial — so `commonName` is left null and
 * filled at plant time.
 *
 * ── `meta`, AND WHY IT IS ONE NESTED OBJECT ─────────────────────────────────
 *
 * Six shelves feed this list and each knows things about its creatures that the
 * specimen record used to drop on the floor: which shelf it came off, its id
 * there, and for the bred champions the niche it was selected for, how many
 * births it took, and what it actually scored. Every one of those is a column
 * the Atlas wants to filter and sort on, and they were being computed, carried
 * this far, and then discarded at the write.
 *
 * NESTED, because of the drift test at the bottom of this file. That test lists
 * the fields a stored record is compared on, and a field NOT in the list goes
 * stale forever — the record looks current, the source disagrees, and nothing
 * ever replants it. A growing list of scalar comparisons decays the moment
 * someone adds a seventh field and forgets the seventh clause. One object is
 * one clause, and it cannot rot.
 */
export function authoredList() {
  const list = [];
  /** Every entry declares its shelf, so provenance survives the write. */
  const meta = (shelf, id, extra = null) => ({ shelf, sourceId: id, ...(extra ?? {}) });
  // The cast first (see CAST_ORDER — selected creatures, then references), then
  // the drawn spines, then the rest of the seed library, then the residents.
  //
  // Resolved against SEEDS *and* CURATED so the cast can lead with a selected
  // specimen. Both later blocks skip ids placed here, so nothing is planted twice.
  for (const id of CAST_ORDER) {
    const s = SEEDS.find((x) => x.id === id);
    if (s) { list.push({ id, commonName: s.name, genome: s.genome, meta: meta('seeds', id) }); continue; }
    const c = CURATED.find((x) => x.id === id);
    if (c) list.push({ id, commonName: c.name, genome: c.genome, meta: meta('curated', id) });
  }
  // ── THE SPINES CARRY NO COMMON NAME, AND `W1_SPINE_NAMES` IS WHY ────────────
  //
  // That table says of itself: "Display names, from the derived binomial at
  // SELECTION TIME." They are not names anybody chose — they are a snapshot of
  // what `binomial()` returned in 2026, on GENOME_V 4, before the derivation
  // moved. Feeding them in as `commonName` made a card write
  // `Schizortharthrus denticaudissimus` across the portrait in large type with
  // `Nematortharthrus dentifrontissimus` — the CURRENT binomial for the same
  // animal — in italics directly underneath. Two Latin names, disagreeing,
  // stacked, on one card. That is the reported confusion in its purest form.
  //
  // A stale derivation is not a label, so it is not offered as one. `null` gets
  // the residents' treatment two blocks down (see this function's docstring):
  // `commonName` is filled at plant time from the LIVE binomial, which makes it
  // equal to the record's own `binomial`, which is exactly the condition
  // `names.label()` reads as "no authored name" — so the vernacular leads, as it
  // does on every other card. The table stays where it is: it is a true record
  // of what these four were called when they were drawn.
  for (const id of W1_SPINE_IDS) {
    const raw = W1_SPINE_GENOMES[id];
    if (raw) list.push({ id, commonName: null, genome: deserialise(JSON.stringify(raw)), meta: meta('spines', id) });
  }
  for (const id of SEED_IDS) {
    if (CAST_ORDER.includes(id)) continue;
    const s = SEEDS.find((x) => x.id === id);
    if (s) list.push({ id, commonName: s.name, genome: s.genome, meta: meta('seeds', id) });
  }
  // CURATED SPECIMENS — evolved, then picked out of a live Atlas and promoted.
  // Their genomes are already hydrated and already migrated by `w1_curated.js`,
  // and each carries `origin.founder` set to its own id, so the Vivarium's
  // Ancestry row reports "reference" for every descendant. See that file for why
  // a found creature is still a reference.
  for (const c of CURATED) {
    if (CAST_ORDER.includes(c.id)) continue;   // already placed in the cast block
    list.push({ id: c.id, commonName: c.name, genome: c.genome, meta: meta('curated', c.id) });
  }
  // THE OWNER'S OWN BREEDING STOCK — see worlds/w1_reef.js for why these are a
  // third kind of provenance and not folded into CURATED. They carry the fastest
  // swimmers in the project and the corpus the goal-seeking failure modes were
  // read off, so they belong on the shelf a player picks from.
  for (const c of REEF) {
    if (CAST_ORDER.includes(c.id)) continue;
    list.push({ id: c.id, commonName: c.name, genome: c.genome, meta: meta('reef', c.id) });
  }
  // THE OFFLINE BREEDING PROGRAMME'S OWN OUTPUT — worlds/w1_bred.js, MACHINE
  // GENERATED by tools/_zpromote.mjs from tools/_zbreed_ark_*.json. A fourth
  // provenance: random founders, no authored ancestor anywhere, selected on
  // closedCm against a paired null arm. See design/15-BREEDING.md.
  //
  // EACH ENTRY DECLARES WHETHER IT WAS ACTUALLY BRED. `bred: false` is a
  // founding draw or one of N17's random strangers admitted on merit, and §5.5
  // of that document records what it cost to conflate the two once. Nothing
  // here filters on it — the shelf carries both on purpose, labelled — but a
  // consumer that wants only the programme's output has the field to do it.
  for (const c of BRED) {
    if (CAST_ORDER.includes(c.id)) continue;
    // `headline` and `note` TRAVEL WITH THE ANIMAL. Without them a champion
    // reaches the Atlas as a name and five forage metrics, none of which says
    // what it is a champion AT — and one of which, `turnCapability`, is the
    // field design/15-BREEDING.md section 1.4 retired as a seeking proxy.
    list.push({
      id: c.id, commonName: c.name, genome: c.genome,
      // An EXPLICIT headline wins. A forage champion was selected on grams and
      // never took a beacon trial, so quoting a beacon number on it would be
      // quoting a measurement nobody made.
      headline: c.headline ?? (c.canonCm != null
        ? `beacon ${c.canonCm.toFixed(2)}/8 cm · arrives ${Math.round((c.arrived ?? 0) * 6)}/6`
        : null),
      note: c.note ?? null,
      // THE FIVE FIELDS THAT USED TO BE DROPPED HERE. `niche` is what the
      // champion is a champion AT — the single most useful facet on the whole
      // shelf — and `canonCm`/`arrived`/`births` are what it actually scored on
      // the canonical beacon trial. They reached this line and went no further.
      meta: meta('bred', c.id, {
        niche: c.niche ?? null,
        bred: c.bred ?? null,
        births: c.births ?? null,
        canonCm: c.canonCm ?? null,
        arrived: c.arrived ?? null,
        dwell: c.dwell ?? null,
      }),
    });
  }
  // PLAYER-BRED SPECIES, promoted out of one browser's IndexedDB into the
  // shipped shelf. Serialised at promotion, so `deserialise` migrates them
  // forward like the residents rather than claiming to be current.
  for (const id of W1_PLAYER_IDS) {
    const raw = W1_PLAYER_GENOMES[id];
    if (raw) list.push({ id, commonName: W1_PLAYER_NAMES[id] ?? null, genome: deserialise(raw), meta: meta('player', id) });
  }
  for (const id of W1_RESIDENT_IDS) {
    const raw = W1_RESIDENT_GENOMES[id];
    if (raw) list.push({ id, commonName: null, genome: deserialise(raw), meta: meta('residents', id) });
  }
  return list;
}

/**
 * RECONCILE the authored shelf against `authoredList()`. Keyed by genomeHash.
 *
 * ── THIS USED TO ONLY ADD, AND THAT WAS A BUG WITH A VISIBLE SYMPTOM ─────────
 *
 * It was "plant any missing authored specimens", and a store is not a set of
 * things that were ever true — it is a picture of what IS true. Two consequences,
 * both seen on screen on 2026-08-10:
 *
 *   1. A WITHDRAWN SPECIMEN NEVER LEFT. A second `stumbler` was promoted, then
 *      withdrawn from `w1_curated.js` because it was indistinguishable from its
 *      sibling in the list. Deleting it from source removed it from `library` and
 *      changed nothing on screen: the record was already in IndexedDB and nothing
 *      here ever removed anything. Every browser that had loaded the app once
 *      kept the duplicate forever.
 *   2. RE-ORDERING THE SHELF DID NOTHING. `createdAt` is `AUTHORED_BASE - i` and
 *      the Atlas sorts newest first, so the index IS the display order — but an
 *      already-planted record hit the `continue` above and kept the index it was
 *      first written with. `CAST_ORDER` could be rewritten and the shelf would
 *      not move.
 *
 * So this now also REFRESHES the presentation fields of a record that has drifted
 * and DELETES authored records that are no longer in the library.
 *
 * ⚠ IT ONLY EVER DELETES `source: 'authored'`. A player's bred lineages and
 * hand-named favourites are irreplaceable and are never touched — the authored
 * shelf is reproducible from this file, which is exactly what makes it safe to
 * treat as derived state and nothing else here is.
 *
 * @returns {Promise<number>} records newly written or refreshed this call.
 */
/**
 * ── YIELDING, AND WHY IT IS NOT A COSMETIC CHANGE ────────────────────────────
 *
 * MEASURED on a cold store: 4321 ms to plant 21 portraits, 206 ms each, all of
 * it synchronous on the main thread. The browser cannot paint during it, so
 * first load is several seconds of a frozen page on desktop and plausibly two
 * to four times that on a phone. The work is real — morphogenesis, buildCreature,
 * a render and a `toDataURL` per specimen — so it cannot be optimised away here;
 * what it can do is stop blocking.
 *
 * A MACROTASK, NOT `Promise.resolve()`. Awaiting a microtask does not let the
 * browser paint — it drains the microtask queue and carries straight on, which
 * would leave the freeze exactly as it is while looking like it had been fixed.
 * `setTimeout(0)` yields to the event loop properly.
 *
 * `onProgress` is what makes a loading screen possible at all: it fires with
 * (done, total) after each portrait, so the shell can show real progress rather
 * than a spinner that means nothing.
 */
const yieldToPaint = () => new Promise((r) => setTimeout(r, 0));

export async function seedAtlas({ onProgress = null } = {}) {
  let existing;
  try { existing = new Set(await store.list('specimen:')); }
  catch { return 0; }   // no store, no seeding — the Atlas just shows empty

  const library = authoredList();
  let planted = 0;

  // THE LIBRARY IS ITS OWN LINEAGE for naming purposes (14 §4). Built from the
  // library rather than from the Atlas, because these plant BEFORE the player
  // has one and because it makes the shipped names stable: the same eight
  // creatures always arrive with the same eight vernaculars, whatever else is
  // in the store. Names accumulate into `taken` as they are minted, so §7's
  // suppression applies across the shelf.
  const ctx = lineageOf(library.map(({ genome }) => ({ genome, worldId: W1_SLICE.palette })));

  /** Keys the library still claims. Everything authored outside this is stale. */
  const live = new Set();

  for (let i = 0; i < library.length; i++) {
    const { commonName, genome, headline = null, note = null, meta = null } = library[i];
    let hash;
    try { hash = genomeHash(genome); } catch { continue; }
    const key = store.KEY.specimen(hash);
    live.add(key);
    // Idempotent, but rewrite when the stored record has DRIFTED from the
    // library: an older render look (card and live tank would disagree), a
    // changed shelf position, or a changed common name. Position matters as much
    // as the picture — `createdAt` is the sort key, so a record that keeps a
    // stale one pins the shelf to an order the source no longer describes.
    if (existing.has(key)) {
      let cur = null;
      try { cur = await store.get(key); } catch { /* unreadable → replant below */ }
      // A RECORD THE PLAYER HAS SAVED OVER IS THEIRS, AND IS LEFT ALONE.
      //
      // Saving from the Vivarium writes to `KEY.specimen(genomeHash)` with no
      // `source` field, so a player who releases a library creature, names it
      // and saves it OWNS that key from then on. Refreshing it back to the
      // library's own `commonName` would silently undo the rename on the next
      // load — which is the same class of defect as never deleting anything,
      // pointed the other way: treating a store as derived state when part of it
      // is not.
      if (cur && cur.source !== 'authored') continue;
      // `headline` IS IN THE DRIFT TEST, and it has to be. The three fields
      // above are the record's picture, its shelf position and its name; a
      // champion's verdict line is a fourth thing the source can change, and a
      // freshness test that does not cover a field lets that field go stale
      // forever — the record looks current, the shelf disagrees, and nothing
      // ever replants it. Added the same day `headline` was, rather than after
      // discovering it silently missing.
      //
      // `meta` IS ONE CLAUSE ON PURPOSE. It carries six or seven fields — shelf,
      // source id, niche, births, canonCm, arrived, dwell — and comparing them
      // one by one is a list that decays: the day someone adds an eighth field
      // and forgets the eighth clause, that field goes stale on every install
      // that has already planted the library, permanently and silently. One
      // nested object, one structural comparison, and it cannot happen.
      if (cur
        && cur.render === RENDER_TAG
        && cur.createdAt === AUTHORED_BASE - i
        && (cur.headline ?? null) === headline
        && JSON.stringify(cur.meta ?? null) === JSON.stringify(meta)
        && cur.commonName === (commonName || cur.binomial)) continue;
    }

    try {
      const plan = morphogenesis(genome);
      const derived = binomial(plan, genome).binomial;
      const vn = nameFor(genome, ctx, W1_SLICE.palette);
      ctx.taken.add(vn.name);
      const specimen = {
        genome,
        hash,
        worldId: W1_SLICE.palette,
        binomial: derived,
        vernacular: vn.name,
        commonName: commonName || derived,
        thumb: renderThumbnail(genome, { worldId: W1_SLICE.palette }),
        stats: { bodies: plan.bodyCount, mass: totalMass(plan) },
        createdAt: AUTHORED_BASE - i,
        source: 'authored',
        // Null for every shelf that does not carry them, which is all of them
        // except the promoted champions. `ui/cards.js` renders `headline` and
        // hangs `note` off it as the element's title.
        headline, note,
        // WHERE IT CAME FROM AND WHAT IT WAS SELECTED FOR. Six shelves feed this
        // library and every one of them knew things — the shelf, the id, the
        // niche a champion won, the beacon distance it closed — that stopped
        // here and went no further. They are Atlas facets now (ui/atlas/derive.js).
        meta,
        render: RENDER_TAG,
      };
      await store.set(key, specimen);
      planted++;
      // Only after work that actually cost something. A skipped record (the
      // common case on every load after the first) falls through the `continue`s
      // above and never reaches here, so a warm boot does not pay 21 yields for
      // nothing.
      if (onProgress) onProgress(planted, library.length);
      await yieldToPaint();
    } catch { /* one bad entry must not block the rest of the library */ }
  }

  // ── SWEEP: authored records the library no longer claims ────────────────────
  //
  // `source: 'authored'` and nothing else. A record without that field is a
  // player's, and a seeding pass that could delete a player's bred lineage would
  // be a far worse defect than the duplicate this exists to remove.
  for (const key of existing) {
    if (live.has(key)) continue;
    let cur = null;
    try { cur = await store.get(key); } catch { continue; }
    // THREE CONDITIONS TO DELETE, AND ANY ONE FAILING SPARES THE RECORD.
    // `source === 'authored'` is the rule; `!== 'player'` is belt to its braces,
    // because a row that says outright that it belongs to the player must never
    // be removed even if something else about it looks authored. Unreadable rows
    // are spared by the `catch` above rather than cleaned up — a record this
    // build cannot parse may still be one a later build can.
    if (!cur || cur.source !== 'authored' || cur.source === 'player') continue;
    try { await store.del(key); planted++; } catch { /* leave it rather than loop */ }
  }

  return planted;
}
