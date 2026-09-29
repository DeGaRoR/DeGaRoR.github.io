# claude/ci-results

Verdicts of the standing CI session for flyDiy merge trains. For every `claude/train-*` tip it tests
(`node tools/build.js` then `node tools/run_gates.js --all --jobs=4` on a clean detached checkout), it writes
`ci/<train-name>/<sha>.txt`: the non-PASS summary lines, the FAIL detail of each red gate, the wall time and the
node version. Commit subject: `CI: <train> <short-sha> PASS` or `CI: <train> <short-sha> FAIL (<gates>)`.
This branch holds reports only; it is never merged.
