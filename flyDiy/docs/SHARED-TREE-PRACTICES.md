# SHARED-TREE PRACTICES — committing, measuring and proving from a working copy that six sessions write to

Written 2026-09-05 after G188 (the pawnee) and the G190/G194 fix-ups, the day
four commits landed with hunks at the wrong offsets and the committed tree
was red for hours while every gate run from the working copy was green.
Everything below was paid for that day. HANDOVER.md stays the canonical log;
this file is the short list a session reads BEFORE its first edit and BEFORE
its commit.

## 1. The working copy is not yours

- Several Claude sessions and the user edit `D:\Dev\DeGaRoR.github.io` at the
  same time. Almost every file is dirty with somebody else's unpushed work,
  and the INDEX is shared too — another session's `git add` sits in it.
- Never `git checkout --`, `git restore`, `git stash`, `git reset --hard`.
  Undo your own edit by editing it back. (A one-line revert destroyed another
  session's AEROSKIN block on 2026-08-30.)
- Never a bare `git commit` or `git commit -a`: it commits whatever the shared
  index holds under your message. `git commit -- <paths>` is no better — it
  takes the WORKING-TREE content of those paths, i.e. everyone's hunks in them.
- Check `ls -l --time-style=full-iso` on a file before opening it; a file
  touched in the last minutes is hot. Edit hot files with exact-string edits
  of a few lines, never a rewrite, and re-read the region right before the
  edit.

## 2. The staging trap (G190, G194, and how G188 avoided it)

A hunk-based staging (`git add -p`, a hand-split patch, a `diff -u0` with
zero context) applies at the WORKING TREE'S line numbers. With other
sessions' hunks above yours, your hunk lands in the committed file at the
wrong offset: the G194 commit put the engine's `sense:` block inside a gear
comment, the frame's `engIdx` inside the twin-boom fin loop, a test block
outside its try, and lost a one-token `(e, i)`; G190 lost `loadSpec`'s fifth
argument. All four files parsed. JOIN, BUILD and UISMOKE were red at HEAD
for hours while the same gates passed on the working copy.

The recipe that holds:

1. For every file you touched, build the COMMIT'S version as `HEAD's blob +
   your exact edits` (the same old→new strings you used, applied to
   `git show HEAD:<path>`; assert each anchor matches exactly once).
2. Write those blobs into a TEMPORARY index, never the shared one:
   ```
   GIT_INDEX_FILE=<tmp> git read-tree HEAD
   sha=$(git hash-object -w --path=<path> <file>)
   GIT_INDEX_FILE=<tmp> git update-index --cacheinfo 100644,$sha,<path>
   tree=$(GIT_INDEX_FILE=<tmp> git write-tree)
   commit=$(git commit-tree $tree -p HEAD -F msg.txt)
   git update-ref refs/heads/master $commit HEAD
   ```
   The last argument to `update-ref` is the expected old value: if another
   session moved master meanwhile, the update fails instead of overwriting.
3. Then `git reset -q -- <your paths>` on the shared index so those entries
   equal the new HEAD (other sessions' remaining hunks in them show as
   unstaged, as they should; their OTHER staged paths are untouched).
4. PROVE THE COMMIT, NOT THE WORKING COPY: `git worktree add <tmp> HEAD`,
   `node tools/build.js` there, run the gates there (`--no-build --only=…`
   for the fast ones, the whole battery for a delivery). Remove the worktree
   after (`git worktree remove --force`, `git worktree prune`). A gate that
   passes on the working copy proves nothing about the commit.
5. Generated outputs (`tools/flight_core.js`, `index.html`, `dev.html`) are
   not committed with a source commit since 2026-09-05; the next build
   regenerates them. Committing them would ship every session's uncommitted
   source inside the artifact.

## 3. The G number

Take the number when the chantier LANDS, by re-reading the last `## G`
heading in HANDOVER.md at that moment — not at the start of the session.
G106 was taken twice, G107/G109/G110/G111 mid-flight, G186 and G187 on
2026-09-05 (G188 was the third try). Search the tree for your marker
(`grep -rn G18x src tools`) before renaming; a sibling's marker in the
handover but not in code is still taken.

Other sessions sweep HANDOVER.md into their commits whole, so your entry may
reach HEAD under somebody else's message before your code does. That is
fine; check with `git show HEAD:flyDiy/HANDOVER.md | grep "^## G<n>"`.

## 4. A measurement must REACH the frame (G188)

The join measures the drawn aeroplane; three layers downstream can each
replace the measurement in silence. When a spec field is measured:

- the join must WRITE it (and say so with an ERRS line when it cannot — the
  merge's "last good number" rule keeps a stale value otherwise; on the
  pawnee that was a stab station from a different aeroplane);
- `merge` must not lose it (arrays replace whole; `cage` and `finish`
  replace whole; a null written on purpose must survive);
- `clampSpec` must not cut it — a clamp is a geometric envelope, and any
  floor that encodes a design rule (0.9-chord tail arm, mains ahead of the
  firewall, cabin width) belongs on the DERIVED value only (`auto[...]`);
- `resolveSpec`'s rules must yield to it (`put`, not assignment);
- the frame must READ it, not its own formula (three wing-height formulas
  existed in three files, none measured).

Pin every new measured field end to end in `tools/_join_check.js`:
`cageJoinSpec → resolveSpec → genFrame`, asserting the node position.

Instrument first: load the build in dev.html, `CAGE_JOIN.export()`,
`CAGE_JOIN.errors()`, `CAGE_JOIN.fitReport(spec, CAGE_JOIN.snapshot(spec))`.
Every symptom is a row. A field present in `GARAGE_SPEC.get()` but absent
from the export is STALE. A classifier keyed on a coordinate (`x <= 0.01`
for "the single wheel") is a bug waiting for a row; key on identity.

## 5. Instruments that lie

- Deflection measured in the world frame includes the three-point stance:
  2 m × sin 7° read as 27 cm of "bearer sag"; in the body frame it was 1 cm.
  Un-rotate by the body axis (`noseFrame → tailMid`) before believing a sag.
- A screenshot's pixel positions are perspective; the fit report's numbers
  are the instrument. Use the picture to decide what to measure.
- A gate that ran on the wrong artifact certifies the wrong thing: dev.html
  loads loose `src/`, index.html is as fresh as the last build, the battery
  builds once at its start. Rebuild and rerun the affected gate after any
  source edit that followed a battery.
- Background gate runs on a loaded machine (three batteries at once) take
  ten times their quiet duration; never treat a past run's duration as a
  timeout.
- A FRESH CHECKOUT IS CRLF (core.autocrlf=true on this machine) while the
  shared tree is LF. A gate that scans source text with a bare `\n` in its
  regex passes on the working copy and fails on every clean worktree of
  HEAD with nothing missing from the commit (SKINMAT, 2026-09-05, fixed by
  1a9a391 reading its sources as LF). Normalise `\r\n` before scanning, or
  match `\r?\n`; when a worktree gate is red, check line endings before
  hunting for a lost hunk.

## 6. Documents and memory

- `flyDiy/HANDOVER.md`: the log. One `## G<n>` entry per landed chantier:
  what was measured, what changed, what the gates say, what is OWED.
- `flyDiy/ROADMAP.md`: a short dated blockquote when a landing changes the
  plan's premises.
- `flyDiy/docs/`: procedures that outlive a chantier (this file, the import
  procs).
- Windows: `io.open(p, 'w')` from Python flips a file to CRLF and the
  source-scanning gates break; write bytes or `newline=''`.
