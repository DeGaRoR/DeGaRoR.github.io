# MASTER-GREEN sweep, 8 Nov 2026 (cloud session)

Base: origin/master 1bcd01d3e (train L35a). Node only, a 4-CPU cloud box (15 GB), node v22.23.4. Nothing fixed; no
other file touched.

How it was run:
- `run_gates.js --only=ID --no-build` was used throughout. The build was run once first and is clean: `node tools/build.js`
  on 1bcd01d3e leaves `git status` empty.
- Older commits ran in their own sparse worktrees (flyDiy/ without media/, screenshots/, reports/), each built with
  `node tools/build.js`.
- The bisects ran on first-parent history. Where the change came in through a merge's second parent, that side was then
  bisected too.
- Where a gate is slow, a scratch reader stood in for it: the gate's own check, lifted out of the gate file (scratchpad,
  not committed). Each boundary was then confirmed with the real gate where it says "real gate".

## 1. The three reds without an owner

### DMGCERT: the Cessna on floats holds at ultimate x 1.1

On master here, FAIL 67/70 in 712 s. The first failing lines, verbatim:

```
  FAIL  to the ultimate x 1.1 (6.27 g): it breaks (0 members), the first group none, the first member a -
  FAIL  BROKE AT - g (null, null) - within [5.70, 5.99] g (+2.5 % for the ramp's lag); first set 3.85 g
  FAIL  the page's bench thread (bench_worker.js benchLoadRun, the roll-out's certificate handed in) breaks it the same: the card reads "LIMIT 3.8 g · ULTIMATE 5.7 g · BROKE AT none (BROKE UP) — the test to destruction, free"
```

They are printed by `tools/_dmg_cert_check.js:208`, `:211` and `:213`.

**It is two changes, both older than the train list. None of the box's suspects did it:** the CESSNA-TAIL rows, the
Wipline rows and the FLAGSHIP 212 L tank all land after 24 Oct, and the gate was already red on 24 Oct.

- **Change 1, 13 Oct: the floats stop breaking at ultimate x 1.1** (HELD, 0 members; it was BROKE UP at 6.11 g).
  - Real gate: 07f68f9e8 PASS 70/70, then **32d5c364b FAIL 67/70**. 32d5c364b is train t52c's merge of
    `claude/design-trust-g2640`, tip f0ca25877 (G2640 DESIGN-TRUST). Its diff to 30_solver.js:
    - a thin oval skin's break is capped by its local buckling (`S.sigB`);
    - a split tube cluster's piece gets its own omega (`clOmegaPiece`);
    - plus 61_gen_frame / 60_gen_spec changes.
  - It reached the master tip's first-parent line on 18 Oct, at **7abc31170** (TORQUE-RETUNE-66 merges master 8a04876e).
    - First-parent bisect, real gate: a69f31fda PASS 70/70, 7abc31170 FAIL.
    - On master's side, train t57's merge of `claude/t55-held` (8c75cde0c, 14 Oct) carries it: 8c75cde0c FAIL,
      e21d9c7fc PASS.
  - From 7abc31170 to 4ab6c317d (L27) the destruction test still breaks, at 6.6-7.2 g, outside the [5.70, 5.99] band.
    The gate reads 68/70 there: two FAIL lines, `:208` and `:211`.
- **Change 2, L28a: the destruction test ends "BROKE UP" with no BROKE AT** (brokeAt null, 18 members broken; it was
  BROKE AT 7.21 g on 4ab6c317d).
  - Scratch destroy bench: 7075c5892 BROKE AT 7.21 g, then **1bd6cdf93 BROKE UP**. 1bd6cdf93 is train L28a's merge
    of `claude/ready/hydro-trim` (HYDRO-TRIM, tip ef3f0a98f; it reads "validated land builds bit-identical": this one
    is the floats).
  - This adds the third FAIL (`:213`, the card's "BROKE AT none"), and from here `:211` prints null.
  - It has been the same from L28a up to master: tested on L29e, L29h, PHONE-1b, L30b, L30c, L32c, L32g and master.

Side notes:
- The train 41 assembly merge of `claude/dmg-bundle-green` (8b9d055d0, 7 Oct) was briefly red in the same way: BROKE
  AT 6.59 g. That was settled before the train-41 final, and a69f31fda passes.
- The Cub, the Jodel and the land Cessna are not involved. Only the floats fail, matching the box.

**Read: unclear.**
- Change 1 is a deliberate change of the members' strength (G2640). Whether the floats' wing-strut fitting should
  still go by 6.27 g is the certificate owner's call: a **stale band** if G2640 is right, a **real fault** if not.
- Change 2 looks like a **real fault**, unproven: a test to destruction that breaks 18 members and records no break load
  is not a change any commit message names.

### TREECRASH: the 30 m/s trunk ensembles

On master here, the full gate went NOVERDICT: `timeout 1500` killed it while DMGCERT and DMGINST shared the box. So the
gate's own section 7 was lifted for the two cases (`L.ensemble(k, id, {n: 16, jobs: 3})` against master's
`tools/fixtures/treecrash_ensemble_ref.json`, printed by `tools/_treecrash_check.js:188`). On master it reproduces the
box exactly:

```
cub/trunk0   work MOVED p 0.001 med 33015.75->43513.05 (broken p 0.970, pieces p 0.310)
jodel/trunk0 pieces MOVED p 0.004 med 13->14, work MOVED p 0.000 med 19724.1->21613.15
```

**It is not one train, and the reference itself is in doubt.**

The reference does not reproduce here even on the commit it was captured on: 49b2932ce, the train-41 final
(344f5cf19, 8 Oct, "56/56").
- On 49b2932ce, cub/trunk0 work is 40.1 kJ against the reference's 33.0 kJ, and its seed-0 hash is 460faa0e, not
  e3559a48.
- So the cub's member work has read about 40 kJ, with p hovering around 0.01, on every commit tested since:

| commit | cub/trunk0 work, against 33.0 kJ |
|---|---|
| 49b2932ce | 40.1 kJ, p 0.011 |
| a69f31fda | 40.4 kJ, p 0.004 (MOVED) |
| 07f68f9e8 | 40.1 kJ, p 0.011 |
| 062c61251 (22 Oct) to adb2d2a92 (L30b) | 40.7 kJ, p 0.044, the same seed-0 hash cf9b14c2 throughout |

Possible causes, none checked: a warm gitignored `tools/.joincache` on the box at capture, or a page-dumped spec.

- **cub/trunk0: last crossed at L30c, train L30c's merge of `claude/ready/new-plane` (04ffb5b6e, 3 Nov).**
  - d17dbbac6: 40.7 kJ, p 0.044, then 04ffb5b6e: 42.7 kJ, p 0.002 MOVED.
  - Later trains add to it: 43.3 kJ on L32c, 43.5 kJ on master.
  - That merge's physics change is the load chain: `tools/_cage_join.js` now measures the fin's taper above the deck
    (`finTaperAbove`, "the user 3 Nov"). Its `_cage_cowl.js` hunk is a UI preset door. **No nose, mount or cowl change**
    is in it.
- **jodel/trunk0: changed at 7abc31170 (18 Oct)**, the same entry as DMGCERT.
  - a69f31fda: work 20.8 kJ, p 0.925, then 7abc31170: 22.6 kJ, p 0.000 MOVED, pieces 13 -> 14.
  - Inside, train t52c's G2640 merge: 07f68f9e8 work p 0.337, then 32d5c364b work 22.4 kJ, p 0.000 MOVED.
  - It has been red on every train since (tested 5f3f2c797, 062c61251, 2b381015d, 1db22c8a4, d17dbbac6, 04ffb5b6e
    and master).
  - Note: jodel pieces already read MOVED, p 0.010, on 49b2932ce itself: the same doubt about the reference.

**Read: stale pin, probable, for both rows.**
- G2640 (the Jodel) and NEW-PLANE's fin taper (the Cub) are deliberate changes of the physics, and the reference was
  never rewritten on master for either. The rewrite cb1049254 (G2809, 26 Oct) left master again with the avionics-gps
  revert df347ca21 (2 Nov).
- The reference should be re-captured, on the box, with a cold `.joincache`. That it was right on 8 Oct is unproven.

### DMGINST: the speed guard and k x 5

On master here, FAIL in 590 s:

```
  FAIL  every k x 5 in flight (past the integrator's limit): tripped at frame 1 as 'speed' (node 22 at 687.59 m/s off the CG), every number finite, stats().bad; it never went NaN in 600 frames - the old watchdog would have flown it on (at rest the fastest node read 0.16 m/s)
  FAIL  the worker host's diverged() (its snapshot's F_DIVERGED, the page's sw.diverged): false, then true on the blown lattice with p still finite
```

They are printed by `tools/_dmg_instruments_check.js:93` (it pins `fr.f === 0`) and `:129` (one step after k x 5).

**Turned red with train t52c's merge of `claude/design-trust-g2640` (32d5c364b, 13 Oct). It reached the master tip's
first-parent line on 18 Oct, at 7abc31170** (the merge of master 8a04876e; on master's side, t57's merge of
`claude/t55-held`, 8c75cde0c).
- Same as DMGCERT. It is red on every train in the list.
- Bisected with the gate's two checks lifted out:
  - first parent: a69f31fda good, 7abc31170 bad;
  - master's side: e21d9c7fc good, 8c75cde0c bad;
  - t55-held's own line: b0cbaf781 good, the t52-full side bad;
  - t52-full's line: 07f68f9e8 good, 32d5c364b bad.

What moved: the fastest node off the CG on the frames after k x 5, on the Cub.

| | first frame | second frame |
|---|---|---|
| before (07f68f9e8 / e21d9c7fc) | 869 m/s, guard trips | |
| after (8c75cde0c) | 1.7 m/s | 653 m/s, guard trips |
| master | 1.0 m/s | 688 m/s, guard trips |

The guard itself is fine: it trips on the first frame it sees past 150 m/s. The lattice on G2640's members simply blows up
one frame later.

**Read: stale pin, probable.** The gate's frame-0 assumption and its one-step diverged() read pin the old lattice's
blow-up speed, not the guard. Which G2640 hunk delays it is unproven.

**The common thread:** two of the three reds (DMGCERT's first step, DMGINST) and TREECRASH's Jodel row all date from one
merge: G2640 DESIGN-TRUST (train t52c, 32d5c364b, 13 Oct), on master's first-parent line since 7abc31170 (18 Oct). All
three have been red on every train from 24 Oct to 8 Nov.

## 2. The sweep (257 gates)

(in progress)
