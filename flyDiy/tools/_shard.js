// _shard.js — a gate's heavy loop split across N processes (2026-09-14, the
// gate rationalization). run_gates.js spawns a row declared `shards: N` as N
// processes of the same file with `--shard=i/N`; each prints its own
// `GATE <ID>: PASS|FAIL`, and the runner passes the gate only when every
// shard passed AND the partition line every shard writes on exit agrees:
//   SHARD i/N: k of K heavy jobs
// (same K in every shard, the k's summing to K — nothing dropped, nothing
// flown twice). No --shard flag = the whole list, exactly today's run.
//
//   take()        the round-robin gate on ONE heavy job: every shard must call
//                 it in the same sequence (call it unconditionally in the loop,
//                 never inside a branch only some shards take), and only the
//                 shard whose turn it is runs the job
//   shardOf(list) the rows of a list this shard owns (round-robin by index)
//   inShard(i)    whether index i is this shard's
//   first         true in shard 0 and when unsharded — for a line that should
//                 be printed once per battery (a backlog, a summary)
//   tag           ' [shard i/N]' or '' — for a log line's own account
'use strict';
const m = (process.argv.find(a => a.startsWith('--shard=')) || '').match(/^--shard=(\d+)\/(\d+)$/);
const S = m ? { i: +m[1], n: +m[2] } : null;
if (S && !(S.n >= 1 && S.i >= 0 && S.i < S.n)) { console.error('bad --shard ' + m[0]); process.exit(2); }
let k = 0, taken = 0;
const take = () => { const mine = !S || (k++ % S.n) === S.i; if (mine && S) taken++; return mine; };
process.on('exit', () => { if (S) process.stderr.write(`SHARD ${S.i}/${S.n}: ${taken} of ${k} heavy jobs\n`); });
module.exports = {
  S,
  tag: S ? ` [shard ${S.i}/${S.n}]` : '',
  first: !S || S.i === 0,
  inShard: idx => !S || idx % S.n === S.i,
  shardOf: list => list.filter((_, idx) => !S || idx % S.n === S.i),
  take,
};
