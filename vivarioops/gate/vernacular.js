// gate/vernacular.js — 14 §10. The common-name layer holds its own rules.
//
// WHAT IS ASSERTED AND WHAT IS NOT. 14 §10 lists VN-1..VN-16. Twelve are here.
// Four are PENDING with the reason recorded on the assertion itself rather than
// omitted, because a suite that simply lacks an id is indistinguishable from one
// where it passed — the same argument gate/manifest.js makes for suites.
//
// VN-15 IS THE ONE THAT MATTERS and §10 says so: if slot scoring is wrong the
// layer still emits grammatical names, it just names the same uninformative axis
// every time, and nothing else in the suite would notice. It is written to fail
// against the specific wrong implementation — scoring against the global prior
// only — by fixing the lineage's hue to a word that is GLOBALLY RARE. A
// prior-only scorer would emit it in nearly every name; a lineage-local one
// emits it in none.

import { readFileSync } from 'node:fs';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { mutate, cloneGenome } from '../engine/l1/mutate.js';
import { POPULATION, MUTATIONS_PER_OFFSPRING } from '../engine/l1/breed.js';
import { binomial, NAMING, familySpace } from '../engine/l1/naming.js';
import {
  vernacular, slotsOf, lineageFrom, headNoun, hasPool, bodyRadius,
  VERNACULAR, GRAMMAR, SLOT_ORDER, MAX_MODIFIERS, MAX_SYLLABLES, BANNED_SUFFIXES, M5_EXCEPTIONS,
} from '../engine/l1/vernacular.js';

const CORPUS = 10000;      // §10's "10k corpus", for VN-3 / VN-8

/**
 * The shipped ramp, READ FROM tokens.css rather than copied.
 *
 * `material.hue` is a position along the world's palette, not a hue (see the
 * header of engine/l1/vernacular.js), so a colour assertion is only worth
 * anything if it runs against the ramp that actually ships. A literal here would
 * be the token duplication N16 exists to prevent, and it would keep passing
 * after someone re-graded the world.
 *
 * Exported so tools/_vnprior.mjs measures against the same source.
 */
export function rampFromTokens(world = 'w1') {
  const css = readFileSync(new URL('../trunk/ui/tokens.css', import.meta.url), 'utf8');
  const stops = [];
  for (let i = 0; i < 6; i++) {
    const m = css.match(new RegExp(`--pal-${world}-${i}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
    if (!m) throw new Error(`--pal-${world}-${i} not found in tokens.css`);
    stops.push(m[1]);
  }
  const lm = css.match(/--creature-lum-threshold:\s*([\d.]+)/);
  return { stops, lumThreshold: lm ? Number(lm[1]) : Infinity };
}

function collector() {
  const results = [];
  let cur = null;
  const api = {
    assertion(id, title, fn) {
      cur = { id, title, status: 'pass', checks: 0, failures: [] };
      try { fn(api); } catch (e) { cur.failures.push(`threw: ${e.message}`); }
      if (cur.failures.length) cur.status = 'fail';
      results.push(cur); cur = null;
    },
    pending(id, title, note) {
      results.push({ id, title, status: 'pending', checks: 0, failures: [], note });
    },
    ok(c, label, actual) { cur.checks++; if (!c) cur.failures.push(`${label}${actual !== undefined ? ` (got ${JSON.stringify(actual)})` : ''}`); },
    eq(a, b, label) { cur.checks++; if (a !== b) cur.failures.push(`${label}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); },
    results,
  };
  return api;
}

/** Every word in every EN pool, with its authored syllable count. */
function allWords() {
  const p = VERNACULAR.POOLS.en;
  return [
    ...Object.entries(p.head).map(([, [w, s]]) => [w, s, 'head']),
    ...Object.entries(p.colour).map(([w, s]) => [w, s, 'colour']),
    ...Object.entries(p.colourPrefix).map(([w, s]) => [w, s, 'colourPrefix']),
    ...Object.entries(p.pattern).map(([w, s]) => [w, s, 'pattern']),
    ...Object.entries(p.gait).map(([w, s]) => [w, s, 'gait']),
    ...Object.entries(p.rank).map(([w, s]) => [w, s, 'rank']),
  ];
}

export function runVernacularGate() {
  const g = collector();
  const palette = rampFromTokens('w1');

  // ── the corpus, built once ────────────────────────────────────────────────
  const rows = [];
  for (let i = 0; i < CORPUS; i++) {
    const genome = createRandomGenome(rngFrom('gate', 'vn', i), SLICE_LIMITS);
    let plan;
    try { plan = morphogenesis(genome); } catch { continue; }
    rows.push({ plan, genome, binomial: binomial(plan, genome) });
  }
  const slots = rows.map((r) => slotsOf(r.plan, r.genome, { palette, binomial: r.binomial }));
  const lineage = lineageFrom(slots);
  const named = rows.map((r, i) =>
    vernacular(r.plan, r.genome, { palette, lineage, binomial: r.binomial }));
  const words = allWords();

  // ── VN-1 · determinism ────────────────────────────────────────────────────
  g.assertion('VN-1', 'Identical (plan, genome, ctx, lang) yields an identical string', (t) => {
    for (let i = 0; i < 60; i++) {
      const r = rows[i];
      const a = vernacular(r.plan, r.genome, { palette, lineage });
      const b = vernacular(r.plan, r.genome, { palette, lineage });
      t.eq(a.name, b.name, `row ${i} reproduces`);
    }
    // And the ctx genuinely participates: a different lineage must be able to
    // produce a different name, or "deterministic" would mean "constant".
    const empty = lineageFrom([]);
    const moved = rows.slice(0, 400).filter((r, i) =>
      vernacular(r.plan, r.genome, { palette, lineage }).name
      !== vernacular(r.plan, r.genome, { palette, lineage: empty }).name);
    t.ok(moved.length > 0, `the lineage ctx changes at least one name in 400 (${moved.length})`);
  });

  // ── VN-2 · the head noun ──────────────────────────────────────────────────
  g.assertion('VN-2', 'Head noun always present, always last, always from the 24-entry table', (t) => {
    const table = new Set(Object.values(VERNACULAR.HEADS_EN).map(([w]) => w));
    t.eq(table.size, 24, 'the head table holds exactly 24 distinct nouns');
    t.eq(Object.keys(VERNACULAR.HEADS_EN).length, 24, 'one head per family');

    let bad = 0, notLast = 0, offTable = 0;
    for (const v of named) {
      if (!v.head) { bad++; continue; }
      if (!table.has(v.head)) offTable++;
      if (v.name.split(' ').at(-1) !== v.head) notLast++;
    }
    t.eq(bad, 0, `every name has a head (${named.length} names)`);
    t.eq(offTable, 0, 'every head comes from the table');
    t.eq(notLast, 0, 'the head is the last word of every name');

    // §3.1's whole point: the families naming.js can produce and the heads this
    // file can produce are the SAME 24 keys, so no creature can be headless.
    const missing = familySpace().filter((f) => !headNoun(f));
    t.eq(missing.length, 0, `every family naming.js emits has a head (${missing.join(', ')})`);
  });

  // ── VN-3 · head is a pure function of family ──────────────────────────────
  g.assertion('VN-3', `Head noun is a pure function of family — ${CORPUS} corpus, zero exceptions`, (t) => {
    const seen = new Map();
    let exceptions = 0;
    for (let i = 0; i < named.length; i++) {
      const fam = rows[i].binomial.family;
      const prev = seen.get(fam);
      if (prev === undefined) seen.set(fam, named[i].head);
      else if (prev !== named[i].head) exceptions++;
    }
    t.eq(exceptions, 0, `no family emitted two heads over ${named.length} genomes`);
    t.ok(seen.size >= 6, `families reached: ${seen.size} of 24`);
    // The converse — one head, two families — would break §3.1's promise that a
    // player who learns "whipfoot" has learned a clade.
    const byHead = new Map();
    for (const [fam, head] of seen) byHead.set(head, (byHead.get(head) ?? 0) + 1);
    t.eq([...byHead.values()].filter((n) => n > 1).length, 0, 'no head is shared by two families');
  });

  // ── VN-4 · M2 ─────────────────────────────────────────────────────────────
  g.assertion('VN-4', 'M2: never more than two modifiers', (t) => {
    const over = named.filter((v) => v.modifiers.length > MAX_MODIFIERS);
    t.eq(over.length, 0, `${over.length} names carry more than ${MAX_MODIFIERS} modifiers`, over.slice(0, 3).map((v) => v.name));
    t.eq(MAX_MODIFIERS, 2, '14 §2 grammar: at most two modifiers plus the head');
    // A name of head-alone is legal; a name of nothing is not.
    t.eq(named.filter((v) => !v.name.trim()).length, 0, 'no empty name');
  });

  // ── VN-5 · M3 ─────────────────────────────────────────────────────────────
  g.assertion('VN-5', `M3: at most ${MAX_SYLLABLES} syllables excluding the possessive`, (t) => {
    // 14 §2.1 M3 SAYS FIVE AND §2's OWN EXAMPLE IS SIX: "Gauder's greater rowing
    // whipfoot" is great-er row-ing whip-foot. Three of the four worked examples
    // fit five and that one does not, so the budget is six — the smallest number
    // consistent with the document's own output. Recorded as an obligation; the
    // document should say one or the other.
    const counts = Object.fromEntries(words.map(([w, s]) => [w, s]));
    let over = 0; const worst = [];
    for (const v of named) {
      const n = v.name.split(' ').reduce((a, w) => a + (counts[w] ?? 99), 0);
      if (n > MAX_SYLLABLES) { over++; if (worst.length < 3) worst.push(`${v.name} = ${n}`); }
    }
    t.eq(over, 0, `${over} of ${named.length} names exceed the budget`, worst);
    // The budget must BIND, or it is decorative: some name must have been cut
    // back from two modifiers to one by it.
    const wouldOverflow = named.filter((v) => {
      const head = counts[v.head];
      return v.modifiers.length < 2 && head >= 3;
    });
    t.ok(wouldOverflow.length > 0, `the budget actually cuts names back (${wouldOverflow.length})`);
  });

  // ── VN-6 · M5 ─────────────────────────────────────────────────────────────
  g.assertion('VN-6', 'M5: no banned diminutive suffix in any pool or any output', (t) => {
    // A LITERAL SUFFIX MATCH REJECTS FIVE OF 14'S OWN WORDS — `whirling`,
    // `tumbling`, `sculling`, `dusky`, `glossy` — because M5 is a rule about
    // DERIVATION and those endings are inflection and adjectival quality. Each
    // is waived by name with a reason in M5_EXCEPTIONS; an unlisted word that
    // ends in a banned suffix still fails, which is what would catch `duckling`
    // or `spotty` arriving in a pool later.
    for (const [w, , pool] of words) {
      for (const suf of BANNED_SUFFIXES) {
        if (!w.endsWith(suf)) continue;
        t.ok(Boolean(M5_EXCEPTIONS[w]), `${pool} word "${w}" ends in the banned -${suf} with no recorded reason`);
      }
    }
    // The waiver list must be EXACTLY the words that need it — a stale entry is
    // a licence nobody is using, and this is where it would be noticed.
    const pool = new Set(words.map(([w]) => w));
    for (const w of Object.keys(M5_EXCEPTIONS)) {
      t.ok(pool.has(w), `M5 exception "${w}" is still in a pool`);
      t.ok(BANNED_SUFFIXES.some((s) => w.endsWith(s)), `M5 exception "${w}" is still needed`);
    }
    // Three of the five are waived because §3.4 authors the gait pool as present
    // participles. If that stopped being true the waiver would stop applying,
    // so the claim is asserted rather than assumed.
    for (const w of Object.keys(VERNACULAR.GAIT_EN)) {
      t.ok(w.endsWith('ing'), `gait word "${w}" is a present participle (§3.4)`);
    }

    let bad = 0;
    for (const v of named) {
      const last = v.name.split(' ').at(-1);
      for (const suf of BANNED_SUFFIXES) if (last.endsWith(suf) && !M5_EXCEPTIONS[last]) bad++;
    }
    t.eq(bad, 0, 'no emitted name ends in an unwaived diminutive');
  });

  // ── VN-7 · M6 ─────────────────────────────────────────────────────────────
  g.assertion('VN-7', 'M6: no word repeats within a name', (t) => {
    let dup = 0; const worst = [];
    for (const v of named) {
      const ws = v.name.split(' ');
      if (new Set(ws).size !== ws.length) { dup++; if (worst.length < 3) worst.push(v.name); }
    }
    t.eq(dup, 0, `${dup} names repeat a word`, worst);
    // The structural reason it cannot happen — the pools are disjoint. If a
    // future pool edit broke that, the count above might still pass by luck.
    const all = words.map(([w]) => w);
    t.eq(new Set(all).size, all.length, 'no word appears in two pools');
  });

  // ── VN-8 · adjective order ────────────────────────────────────────────────
  g.assertion('VN-8', `Adjective order RANK > PATTERN > COLOUR > GAIT holds in EN, ${CORPUS} corpus`, (t) => {
    t.eq(JSON.stringify(SLOT_ORDER), JSON.stringify(['rank', 'pattern', 'colour', 'gait']),
      '14 §4 fixed order');
    let wrong = 0; const worst = [];
    for (const v of named) {
      const idx = v.slots.map((s) => SLOT_ORDER.indexOf(s));
      for (let i = 1; i < idx.length; i++) {
        if (idx[i] <= idx[i - 1]) { wrong++; if (worst.length < 3) worst.push(`${v.name} [${v.slots}]`); break; }
      }
    }
    t.eq(wrong, 0, `${wrong} of ${named.length} names are out of order`, worst);
    // Both orderings must actually occur, or the assertion is only testing that
    // one code path exists.
    const pairs = new Set(named.filter((v) => v.slots.length === 2).map((v) => v.slots.join('>')));
    t.ok(pairs.size >= 3, `distinct two-slot orderings observed: ${pairs.size} (${[...pairs].slice(0, 6).join(', ')})`);
  });

  // ── VN-9 · deferred ───────────────────────────────────────────────────────
  g.pending('VN-9', '`false` emitted iff a recombination scar is present',
    'DEFERRED, not skipped. §3.5 reads `false` off a recombination scar (13 §10), and '
    + 'naming.js:214 records that scars are absent from the genome — they need a GENOME_V '
    + 'bump and a migration. A `false` drawn from anything else would be a lie about '
    + 'provenance, which is the one thing this marker exists to tell the truth about. '
    + 'Additive later: one word in RANK_EN and one branch in rankWord().');

  // ── VN-10 · `true` iff tautonym ───────────────────────────────────────────
  g.assertion('VN-10', '`true` is emitted iff the binomial is a tautonym', (t) => {
    let taut = 0, mism = 0;
    for (let i = 0; i < named.length; i++) {
      const isTaut = rows[i].binomial.genus.toLowerCase() === rows[i].binomial.species;
      const saysTrue = named[i].words.rank === 'true';
      if (isTaut) taut++;
      if (isTaut !== saysTrue) mism++;
    }
    t.eq(mism, 0, `rank word and tautonymy agree on all ${named.length} rows`);

    // The corpus reaches no tautonym (they need `veryTypical` and then win a
    // 0.005-weight channel), so a corpus-only check would pass vacuously. The
    // rule is exercised directly against a constructed one.
    const r = rows[0];
    const forced = { ...r.binomial, channel: 'tautonym' };
    const v = vernacular(r.plan, r.genome, { palette, lineage, binomial: forced });
    t.eq(v.words.rank, 'true', 'a tautonym reads `true`');
    t.ok(v.slots[0] === 'rank', '§4 priority 1: it is emitted, and first', v.slots);
    t.ok(v.name.startsWith('true '), `and it leads the name (${v.name})`);
    t.ok(taut >= 0, `tautonyms in the corpus: ${taut} (rare by construction)`);
  });

  // ── VN-11 · deferred ──────────────────────────────────────────────────────
  g.pending('VN-11', 'Possessive rate 15% ± 3 points over 10k draws',
    'DEFERRED for the same reason as VN-9. §3.6 draws the possessive from the author '
    + 'citation (13 §8), which naming.js:214 records as absent pending a GENOME_V bump. '
    + 'A possessive hashed from the genome would attribute a discovery to someone who did '
    + 'not make it. §11.2 also records the 15% rate as arbitrary until played, so the '
    + 'number this assertion would bound is not yet a decision.');

  // ── VN-12, VN-13 · deferred ───────────────────────────────────────────────
  const frNote = 'DEFERRED. §6 is explicit that pools are authored per language and never '
    + 'machine-translated. The BRANCH POINTS ship (GRAMMAR.fr: post-position, the six '
    + 'pre-nominal rank words, and per-head gender on all 24 FR heads) but there is no '
    + 'modifier pool, so `lang: "fr"` falls back to the binomial and VN-14 asserts it. '
    + 'Adding FR is 44 modifier words and nothing else. §11.1 also records the FR head '
    + 'table as a first draft wanting a native pass.';
  g.pending('VN-12', 'FR: gender and number agreement for all 24 heads × 44 modifiers', frNote);
  g.pending('VN-13', 'FR: adjective post-position except the six pre-nominal rank words', frNote);

  // ── VN-14 · fallback ──────────────────────────────────────────────────────
  g.assertion('VN-14', 'Missing-pool fallback returns the binomial, never a partial translation', (t) => {
    t.eq(hasPool('fr'), false, 'fr ships branch points but no pool');
    t.eq(hasPool('en'), true, 'en ships a pool');

    const englishWords = new Set(words.map(([w]) => w));
    for (let i = 0; i < 200; i++) {
      const r = rows[i];
      const v = vernacular(r.plan, r.genome, { palette, lineage, binomial: r.binomial }, 'fr');
      t.eq(v.fallback, true, `row ${i} reports the fallback`);
      t.eq(v.name, r.binomial.binomial, `row ${i} returns the binomial verbatim`);
      // The failure this guards is a HALF-translated name: an FR head noun
      // wearing English modifiers, which §6 says must never be shown.
      const leaked = v.name.split(' ').filter((w) => englishWords.has(w.toLowerCase()));
      t.eq(leaked.length, 0, `row ${i} leaks no English pool word`, leaked);
    }
    // The branch points that make adding FR cheap are present and complete.
    t.eq(GRAMMAR.fr.adjectives, 'post', 'FR adjective position is declared');
    t.eq(GRAMMAR.fr.prenominal.size, 6, 'the six pre-nominal rank words are declared');
    t.eq(Object.keys(GRAMMAR.fr.heads).length, 24, 'all 24 FR heads carry a gender');
    t.eq(Object.values(GRAMMAR.fr.heads).filter(([, gd]) => gd !== 'm' && gd !== 'f').length, 0,
      'every FR head gender is m or f');
  });

  // ── VN-15 · THE ONE THAT MATTERS ──────────────────────────────────────────
  g.assertion('VN-15', 'Slot selection tracks lineage-local unusualness: fixed hue emits colour in < 5%', (t) => {
    // The lineage is built around a hue whose colour word is GLOBALLY RARE on
    // the w1 ramp. That is what makes this a test rather than a tautology: an
    // implementation that scored against the global prior alone would find this
    // word maximally surprising and emit it in nearly every name, which is
    // exactly the silent failure §10 warns about.
    const fixed = findRareHue(palette);
    t.ok(fixed.share <= 0.06,
      `the pinned hue reads "${fixed.word}", ${(fixed.share * 100).toFixed(1)}% of the ramp — globally rare`);

    const members = [];
    let genome = createRandomGenome(rngFrom('gate', 'vn15', 'founder'), SLICE_LIMITS);
    for (let i = 0; members.length < 150 && i < 600; i++) {
      const g2 = cloneGenome(genome);
      // Hue and iridescence pinned: iridescence decides whether the bone stop is
      // in play, so pinning the hue alone would not pin the COLOUR.
      g2.material.hue = fixed.hue;
      g2.material.iridescence = 0;
      let plan;
      try { plan = morphogenesis(g2); } catch { genome = mutate(genome, rngFrom('gate', 'vn15', i)).genome; continue; }
      members.push({ plan, genome: g2, binomial: binomial(plan, g2) });
      genome = mutate(genome, rngFrom('gate', 'vn15', i)).genome;
    }
    t.ok(members.length >= 100, `a lineage was grown (${members.length})`);

    const ss = members.map((m) => slotsOf(m.plan, m.genome, { palette, binomial: m.binomial }));
    t.eq(new Set(ss.map((s) => s.words.colour)).size, 1, 'the lineage is genuinely one colour');

    const lin = lineageFrom(ss);
    const vs = members.map((m) => vernacular(m.plan, m.genome, { palette, lineage: lin, binomial: m.binomial }));
    const withColour = vs.filter((v) => v.slots.includes('colour')).length;
    t.ok(withColour / vs.length < 0.05,
      `colour emitted in ${withColour}/${vs.length} = ${(100 * withColour / vs.length).toFixed(1)}% (< 5%)`);

    // THE CONTROL ARM. Without it the assertion would also pass for an
    // implementation that never emits colour at all. Same lineage, hue allowed
    // to vary: colour must come back.
    const varied = members.map((m, i) => {
      const g2 = cloneGenome(m.genome);
      g2.material.hue = (i * 0.0731) % 1;
      return { plan: m.plan, genome: g2, binomial: binomial(m.plan, g2) };
    });
    const vss = varied.map((m) => slotsOf(m.plan, m.genome, { palette, binomial: m.binomial }));
    const lin2 = lineageFrom(vss);
    const vs2 = varied.map((m) => vernacular(m.plan, m.genome, { palette, lineage: lin2, binomial: m.binomial }));
    const withColour2 = vs2.filter((v) => v.slots.includes('colour')).length;
    t.ok(withColour2 / vs2.length > 0.15,
      `control arm — with hue varying, colour is emitted in ${withColour2}/${vs2.length} = ${(100 * withColour2 / vs2.length).toFixed(1)}% (> 15%)`);
  });

  // ── VN-16 · drift harness ─────────────────────────────────────────────────
  let vn16 = null;
  g.assertion('VN-16', 'Drift: 300 generations, 100 described — >= 60 distinct vernaculars, exactly 1 head', (t) => {
    // §8's "one lineage" means one FAMILY — that is what makes the head noun
    // constant. Two things about this harness are deliberate and both were got
    // wrong first:
    //
    // 1. `lockMorphology` is the obvious way to hold the family and is WRONG:
    //    it restricts mutation to the controller branch (mutate.js:659), so the
    //    material genes never move and colour and pattern could not vary by
    //    construction. A family-changing offspring is rejected instead, which is
    //    what a converged lineage actually is — 14 §1 states the claim being
    //    tested exactly: "a converged lineage whose topology has stopped moving
    //    still produces varied vernacular names."
    //
    // 2. A LINEAGE IS A POPULATION, NOT A CHAIN. The first harness advanced one
    //    genome by one mutation per generation and reached 54 distinct names —
    //    and the reason was NOT the assembler: the 100 specimens held only 15
    //    distinct (rank, pattern, colour, gait) tuples between them, so 15 was
    //    the ceiling whatever the naming did. That is a fact about the drift
    //    rate, not about §4. breed.js runs POPULATION offspring at
    //    MUTATIONS_PER_OFFSPRING mutations each, and describing one member of a
    //    population is what the player actually does, so the harness does that.
    //    Selection and viability are left out: this is a naming assertion, and
    //    borrowing the physics would make a naming failure and a breeding
    //    failure indistinguishable.
    const GENS = 300, DESCRIBE_EVERY = 3, POP = POPULATION;
    const [, MUTS] = MUTATIONS_PER_OFFSPRING;
    const founder = createRandomGenome(rngFrom('gate', 'vn16', 'founder'), SLICE_LIMITS);
    const family = binomial(morphogenesis(founder), founder).family;

    let pop = Array.from({ length: POP }, () => founder);
    const described = [];
    const taken = new Set();
    const samples = [];
    let rejected = 0;
    for (let gen = 1; gen <= GENS; gen++) {
      const next = [];
      for (let k = 0; k < POP; k++) {
        const parent = pop[(gen + k) % pop.length];
        let child = null;
        for (let a = 0; a < 6 && !child; a++) {
          const rng = rngFrom('gate', 'vn16', gen, k, a);
          let c = parent;
          try { for (let m = 0; m < MUTS; m++) c = mutate(c, rng).genome; } catch { rejected++; continue; }
          let p;
          try { p = morphogenesis(c); } catch { rejected++; continue; }
          if (binomial(p, c).family !== family) { rejected++; continue; }
          child = { genome: c, plan: p };
        }
        next.push(child ?? { genome: parent, plan: morphogenesis(parent) });
      }
      pop = next.map((n) => n.genome);

      if (gen % DESCRIBE_EVERY) continue;
      // One member described per event, against everything described so far —
      // which is what a player does, and what makes §7's suppression load-bearing.
      const { plan, genome } = next[gen % POP];
      const bino = binomial(plan, genome);
      samples.push(slotsOf(plan, genome, { palette, binomial: bino }));
      const v = vernacular(plan, genome, { palette, lineage: lineageFrom(samples), taken, binomial: bino });
      taken.add(v.name);
      described.push(v);
    }

    const distinct = new Set(described.map((v) => v.name)).size;
    const heads = new Set(described.map((v) => v.head));
    const tuples = new Set(samples.map((s) => SLOT_ORDER.map((k) => s.words[k]).join('|'))).size;
    vn16 = { described: described.length, distinct, heads: heads.size, rejected, family, tuples, sample: described.slice(-6).map((v) => v.name) };

    // THE HARNESS MUST ACTUALLY DRIFT, asserted separately from the result it
    // produces. The first version of this harness advanced one genome by one
    // mutation per generation and its 100 specimens held only 15 distinct
    // (rank, pattern, colour, gait) tuples between them — so the name count was
    // capped by the CORPUS and said nothing about §4. This floor is what makes
    // the difference visible immediately rather than after an afternoon.
    //
    // Note the two numbers do not bound each other: names are minted against a
    // GROWING lineage, so one tuple can legitimately yield different names at
    // different points in the lineage's history, which is §4 doing its job.
    t.ok(tuples >= 20, `the lineage genuinely varies: ${tuples} distinct slot-word tuples across ${samples.length} specimens`);

    t.ok(described.length >= 90, `${described.length} specimens described over ${GENS} generations`);
    t.eq(heads.size, 1, `exactly one head noun (${[...heads].join(', ')})`);
    t.ok(distinct >= 60, `${distinct} distinct vernaculars over ${described.length} described (§8 wants >= 60)`);
    // §8 is equally clear that it must NOT be all distinct — "some of them are
    // the same kind of whipfoot" is what a real collection looks like, and 100
    // unique names would mean the layer is behaving like an identifier, which §7
    // says it is not.
    t.ok(distinct < described.length, `and not all distinct (${distinct}/${described.length}) — §7: the vernacular is not an identifier`);
  });

  const slotUse = named.flatMap((v) => v.slots)
    .reduce((a, s) => (a[s] = (a[s] ?? 0) + 1, a), {});
  const distinctAll = new Set(named.map((v) => v.name)).size;

  return {
    name: 'vernacular', results: g.results,
    passed: g.results.filter((r) => r.status === 'pass').length,
    failed: g.results.filter((r) => r.status === 'fail').length,
    pending: g.results.filter((r) => r.status === 'pending').length,
    checks: g.results.reduce((n, r) => n + r.checks, 0),
    diagnostics: [
      `corpus ${named.length} · ${distinctAll} distinct vernaculars · ${new Set(named.map((v) => v.head)).size} heads reached`,
      `slot emission: ${JSON.stringify(slotUse)} — 14 §4 self-tunes to whatever axis is informative, so this MOVES with the corpus`,
      `w1 colour prior: ${JSON.stringify(VERNACULAR.colourPrior({ stops: palette.stops.map(VERNACULAR.parseHex) }))}`,
      vn16 ? `VN-16 drift: family ${vn16.family}, ${vn16.distinct}/${vn16.described} distinct over ${vn16.tuples} slot-word tuples, ${vn16.rejected} offspring rejected as family-changing · e.g. ${vn16.sample.join(' / ')}` : 'VN-16 did not run',
      `sample: ${named.slice(0, 6).map((v) => v.display).join(' · ')}`,
    ],
    obligations: [
      '14 §2.1 M3 CONTRADICTS §2. M3 caps a name at five syllables; §2\'s own worked '
      + 'example "Gauder\'s greater rowing whipfoot" is six. The budget shipped is SIX — '
      + 'the smallest value consistent with the document\'s own output — and it binds, so '
      + 'the choice is visible in the names. 14 should say one or the other.',
      '14 §3.2 ASSUMES `material.hue` IS A HUE AND IT IS NOT. render/creature.js:84 reads '
      + 'it as a position along the world\'s six-stop ramp, and w1\'s ramp holds no ochre, '
      + 'amber, olive or jade at all — a flat twelve-way split of the circle would have '
      + 'named creatures for colours the world cannot render. The colour word is derived '
      + 'from the ramp colour instead, which is why `ctx.palette` exists and why a caller '
      + 'without one gets no colour slot. 14 §3.2 should record that the pool is a set of '
      + 'words the RAMP selects from, not a partition of hue.',
      '14 §3.2\'s `pale`/`dusky` now read MEASURED SATURATION rather than `hueVariance`, '
      + 'which is the accent offset and never had anything to do with saturation. That is '
      + 'what §3.2 asks for; it only became computable once the ramp was in hand.',
      '14 §2.1 M5 BANS `-y` AND §3.3 SHIPS `glossy`. Held as a diminutive ban (-ling, '
      + '-kin, -ie) plus an allowlist of exactly one adjectival -y word, asserted in VN-6.',
      '14 §11.3 DECIDED: `dwarf`/`giant` are LINEAGE-RELATIVE, per §11.3\'s own '
      + 'recommendation. The reference is a QUANTILE PAIR, not naming.js\'s '
      + 'median-and-spread: `signature.traits.size` is clamped to [0,1] and saturates for '
      + '24% of the corpus, so no z-threshold on it can separate large from enormous. '
      + 'Measured on bodyRadius instead; tools/_vnprior.mjs re-measures.',
      'VN-9 and VN-11 are the same blocked pair naming.js:214 already records: author '
      + 'citations (13 §8) and recombination scars (13 §10) need GENOME_V 5 and a '
      + 'migration. Until then `false` and the possessive are not emitted at all — an '
      + 'invented one would be a false claim about provenance.',
    ],
  };
}

/**
 * A hue whose colour word is rare on this ramp. VN-15 needs one: pinning the
 * lineage to a COMMON colour would let a prior-only scorer pass by accident.
 */
function findRareHue(palette) {
  const stops = palette.stops.map(VERNACULAR.parseHex);
  const prior = VERNACULAR.colourPrior({ stops });
  const N = 400;
  let best = null;
  for (let i = 0; i < N; i++) {
    const hue = (i + 0.5) / N;
    const word = VERNACULAR.colourWord(VERNACULAR.rampColour(stops, hue, false));
    const share = prior[word] ?? 0;
    if (share > 0 && (!best || share < best.share)) best = { hue, word, share };
  }
  return best;
}
