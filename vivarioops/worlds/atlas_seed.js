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

import * as store from '../trunk/store.js';
import { SEEDS } from './seeds.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS } from './w1_residents.js';
import { W1_SLICE } from './w1_slice.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { genomeHash, deserialise } from '../engine/l1/genome.js';
import { binomial } from '../engine/l1/naming.js';
import { W1_SPINE_IDS, W1_SPINE_GENOMES, W1_SPINE_NAMES } from './w1_spines.js';
import { renderThumbnail, RENDER_TAG } from '../render/thumbnail.js';

// The five seed SWIMMERS, in display order. `staircase` is a deliberate
// counter-example (it self-intersects and morphogenesis rejects it) and is
// excluded here for the same reason engine/l1/breed.js OPENING_SEEDS excludes it.
const SEED_IDS = ['eel', 'eel-fast', 'eel-slow', 'eel-unison', 'eel-finned'];

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
const CAST_ORDER = ['eel', 'eel-fast'];

// Ordering: authored records get small, stable createdAt values so they form a
// deterministic block in seeds-then-residents order (the Atlas sorts newest
// first). Player-saved specimens use Date.now() — ~1.75e12 in 2026 — so they
// always sort ABOVE the library, and the library is a stable shelf beneath them.
const AUTHORED_BASE = 1_000_000;

/**
 * The authored library as `{ id, commonName, genome }`, genomes in canonical
 * (map-jointGenes) form. Residents carry no authored common name — they are known
 * by their derived binomial — so `commonName` is left null and filled at plant time.
 */
export function authoredList() {
  const list = [];
  // The two reference swimmers first, then the drawn spines, then the rest of
  // the seed library, then the residents.
  for (const id of CAST_ORDER) {
    const s = SEEDS.find((x) => x.id === id);
    if (s) list.push({ id, commonName: s.name, genome: s.genome });
  }
  for (const id of W1_SPINE_IDS) {
    const raw = W1_SPINE_GENOMES[id];
    if (raw) list.push({ id, commonName: W1_SPINE_NAMES[id] ?? null, genome: deserialise(JSON.stringify(raw)) });
  }
  for (const id of SEED_IDS) {
    if (CAST_ORDER.includes(id)) continue;
    const s = SEEDS.find((x) => x.id === id);
    if (s) list.push({ id, commonName: s.name, genome: s.genome });
  }
  for (const id of W1_RESIDENT_IDS) {
    const raw = W1_RESIDENT_GENOMES[id];
    if (raw) list.push({ id, commonName: null, genome: deserialise(raw) });
  }
  return list;
}

/**
 * Plant any missing authored specimens. Idempotent, keyed by genomeHash.
 *
 * @returns {Promise<number>} how many records were newly written this call.
 */
export async function seedAtlas() {
  let existing;
  try { existing = new Set(await store.list('specimen:')); }
  catch { return 0; }   // no store, no seeding — the Atlas just shows empty

  const library = authoredList();
  let planted = 0;

  for (let i = 0; i < library.length; i++) {
    const { commonName, genome } = library[i];
    let hash;
    try { hash = genomeHash(genome); } catch { continue; }
    const key = store.KEY.specimen(hash);
    // Idempotent, but re-render if the stored thumbnail was baked by an older
    // render look — otherwise the library card and the live tank disagree.
    if (existing.has(key)) {
      let cur = null;
      try { cur = await store.get(key); } catch { /* unreadable → replant below */ }
      if (cur && cur.render === RENDER_TAG) continue;
    }

    try {
      const plan = morphogenesis(genome);
      const derived = binomial(plan, genome).binomial;
      const specimen = {
        genome,
        hash,
        worldId: W1_SLICE.palette,
        binomial: derived,
        commonName: commonName || derived,
        thumb: renderThumbnail(genome, { worldId: W1_SLICE.palette }),
        stats: { bodies: plan.bodyCount, mass: totalMass(plan) },
        createdAt: AUTHORED_BASE - i,
        source: 'authored',
        render: RENDER_TAG,
      };
      await store.set(key, specimen);
      planted++;
    } catch { /* one bad entry must not block the rest of the library */ }
  }

  return planted;
}
