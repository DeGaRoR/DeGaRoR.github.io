---
name: workbench-commit
description: The flyDiy commit, merge and push procedure - use before any git commit, merge, rebase or push in this repo, and before pushing a claude/ready/* ref. Covers built files, CRLF in HANDOVER.md, line endings and final newlines, the exports union, the (built) commit and the hygiene check.
---

# Committing in flyDiy

Read the full procedure once per session: `flyDiy/tools/workbench/COMMIT-PROCEDURE.md`. These are the rules that break trains:

1. **Your own worktree only.** A `git checkout` is an edit: never switch branches where a gate run is going.
2. **No built files in a source commit.**
   - Built files: `flyDiy/tools/flight_core.js`, `flyDiy/index.html`, `flyDiy/dev.html`, `flyDiy/sw.js`, `flyDiy/version.json`, `flyDiy/career_core.<hash>.js`, `flyDiy/route_draw.<hash>.js`.
   - Stage by path (`git add <files>`); never `git add -A` in a source commit.
   - A playable branch gets ONE extra commit titled `<NAME> (built): ...`, staged with `git add -A -- 'flyDiy/career_core.*.js' 'flyDiy/route_draw.*.js'` so the old chunk's deletion is staged too.
3. **flyDiy/HANDOVER.md is CRLF.** Never open it with an editor tool. Append your block as bytes, with `\r\n` lines (`fs.appendFileSync`, or Python `open(p, 'ab')`). Its CR count = master's + your block's lines.
4. **Every file keeps its own line endings and its own final newline.**
   - Python on Windows writes CRLF in text mode: use `newline=''` or binary.
   - A tool that rewrites JSON keeps the file's end.
   - `git diff --stat` shows only the lines you meant.
5. **Merges.**
   - `src/core/90_node_exports.js` and similar lists are a UNION. A deliberate drop says `exports-dropped: NAME` in the commit message.
   - HANDOVER keeps both blocks, as bytes.
   - Built-file conflicts: take either side, rebuild, and commit as (built).
6. **Before you push**, `node flyDiy/tools/_commit_hygiene.js` must print `GATE COMMITHYGIENE: PASS`. Every FAIL line says what to do. The project hook (`flyDiy/tools/workbench/hook_git.js`) runs the same check on every `git push` and blocks built files in a source commit; a deliberate exception adds `# hygiene-override: <why>` to the command.
7. **A ready = exactly what you gated.** Gate, then push `claude/ready/<name>`, or `claude/<name>` if you may not push readies (A0 copies it). More commits after = gate again.
8. **The message**: the first line is `<FEATURE>: what changed (why)`. Quote the user when it's their call. End with your attribution line.
