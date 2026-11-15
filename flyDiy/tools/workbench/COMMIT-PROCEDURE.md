# Commit procedure (the workbench, A0 15 Nov 2026)

The user, 15 Nov: "We also need a procedure for committing, avoiding the build files and preserving the end of files for example. Feels like we get to a point where procedures need to exist and be enforced."
Every rule below cost a train or a re-make this month.

## 1. Before you commit: where are you?
- Your own worktree only, one per session. Never write in another session's tree.
- A `git checkout` is an edit: never switch branches in a tree where run_gates is running. Run a second branch's gates from a `git archive` copy in your scratchpad.
- Base check: your branch sits on origin/master, or on the ref A0 named (`git merge-base --is-ancestor origin/master HEAD`).

## 2. Source commits: no built files
- The BUILT files are written by `node tools/build.js` and by the train: `flyDiy/tools/flight_core.js`, `flyDiy/index.html`, `flyDiy/dev.html`, `flyDiy/sw.js`, `flyDiy/version.json`, `flyDiy/career_core.<hash>.js`, `flyDiy/route_draw.<hash>.js`.
- A source commit contains NONE of them. Stage by path (`git add <files you edited>`), never `git add -A` / `git add .` in a source commit.
- A branch that needs a playable build adds ONE separate commit titled `<NAME> (built): ...`, with every built file, the hashed chunks included: `git add -A -- 'flyDiy/career_core.*.js' 'flyDiy/route_draw.*.js'`, quoted, so the deleted old chunk is staged too. Otherwise index.html names a chunk the tree lacks.
- The train rebuilds anyway; built files in a ready are tolerated, but never mixed into a source commit.
- Cooked packs (`*_packs.json`, `fleet_spots_pack.js`, `map_pack.js`, media) only when your job is the cook, in their own commit.

## 3. Line endings and file ends: write bytes, change nothing else
- `flyDiy/HANDOVER.md` is CRLF (about 205 000 CRs). NEVER open it with an editor tool. Append your block as bytes (Node `fs.appendFileSync` with `\r\n`, or Python `open(p, 'ab')`), CRLF lines, matching the file.
- Check before committing: `git show HEAD:flyDiy/HANDOVER.md | tr -cd '\r' | wc -c` vs the working copy. Yours = master's + your block's lines, never fewer. A merge that normalised the CRs is refused by the train.
- Every other file keeps ITS OWN line ending and its own final newline (or lack of one). Python on Windows writes CRLF in text mode: write with `newline=''` or in binary. After an edit, `git diff --stat` must show only the lines you meant. A whole-file diff = you flipped the endings: redo it.
- `git diff --check` must be clean on the lines you touched.

## 4. Merges
- `90_node_exports.js` and similar name lists: UNION, never drop a name.
- HANDOVER: keep both sides' blocks, as bytes, CRs = master's + yours.
- Built files in a merge conflict: take either side, then rebuild in a separate (built) commit.
- After a merge: `node --check` on every .js you touched, then the gates that read those files (grep tools/ for the file names).

## 5. The ready ref
- `claude/ready/<name>` = exactly the commit you gated. Gate, then push; never push a ready and then commit more onto it without re-gating.
- The ready's note (HANDOVER block or the message to A0) names: the base sha, the gates run, each red by check name against master's own run, and every re-pin with its reason.
- Never weaken a gate to pass. A re-pin is a separate, named commit with the reason.
- Cloud sessions that may not push `claude/ready/*` push `claude/<name>`; A0 copies it after checks.

## 6. Messages
- First line: `<SESSION/FEATURE>: what changed (why)`. Quote the user when it is the user's call.
- End with the attribution line your session is given.

## Enforcement
1. GATE COMMITHYGIENE (`node flyDiy/tools/_commit_hygiene.js [--head <ref>] [--base <ref>]`, node, core tier, seconds) fails on built files inside a non-(built) commit, HANDOVER CRs below master's, a whole-file line-ending flip, a changed final newline, index.html naming a missing chunk, and an exports name dropped.
2. The train (ltrain.sh) runs it on each ref before the merge and drops a failing ref with the reason (it already drops HANDOVER CR losses).
3. THE HOOK (live): `.claude/settings.json` runs `flyDiy/tools/workbench/hook_git.js` before every Bash/PowerShell command of every Claude session in this repo. It blocks a `git commit` that stages built files without "(built)" in the command, or HANDOVER.md with lost CRs, and a `git push` whose commit fails the hygiene check. The block message says the fix. A deliberate exception adds `# hygiene-override: <why>` to the command.
4. The skill `.claude/skills/workbench-commit` carries this page, so sessions see it before they commit.

Run it yourself before you push: `node flyDiy/tools/_commit_hygiene.js` (your branch vs origin/master). Every FAIL line says what to do.
