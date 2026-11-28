#!/usr/bin/env python
# profile_window.py - WHAT RAN IN ONE SLICE (PERF-LEAD, 23 Nov 2026): a window of a load's sampled CPU profile, by function
#
#   python tools/perf/profile_window.py <profile.json of boot_perf --profile-out> <row.json of boot_perf --out> [label ...]
#   python tools/perf/profile_window.py <profile.json> --at <start ms> <length ms>
#
# Garage first logs every world-build slice over 50 ms behind the live garage with its start on the page's clock
# (FLYDIY_LAB.gfS.sl: [label it ENDED on, start ms, length ms]). This cuts the profile's samples to each such slice and
# prints the self time by function (and the heaviest callers' chain for the top one): the freeze, named. The profile's
# clock starts about at the navigation and the page's at its first script (within ~0.3 s): the window is widened by
# 150 ms each side, and a slice shorter than 80 ms is not worth reading this way (the sampler ticks every 0.5 ms).
# With labels given, only the slices that ended on them (a part of the label is enough); without, the eight longest.
import io, json, sys

def load(p): return json.load(io.open(p, encoding='utf-8'))

def cut(P, a, b, top=10):
    nodes = {n[0]: n for n in P['nodes']}; parent = {}
    for n in P['nodes']:
        for c in n[4]: parent[c] = n[0]
    t = 0.0; self_ms = {}; total = 0.0
    for sid, dt in zip(P['samples'], P['timeDeltas']):
        t += (dt or 0) / 1000.0
        if t < a or t > b: continue
        n = nodes.get(sid)
        if not n: continue
        k = '%s %s:%s' % (n[1], n[2], n[3]); self_ms[k] = self_ms.get(k, 0) + (dt or 0) / 1000.0; total += (dt or 0) / 1000.0
    rows = sorted(self_ms.items(), key=lambda kv: -kv[1])[:top]
    # the first named frames above the heaviest function: who called it
    chain = []
    if rows:
        tk = rows[0][0]; t = 0.0; best = None; cnt = {}
        for sid, dt in zip(P['samples'], P['timeDeltas']):
            t += (dt or 0) / 1000.0
            if t < a or t > b: continue
            n = nodes.get(sid)
            if not n or '%s %s:%s' % (n[1], n[2], n[3]) != tk: continue
            st = []; cur = sid
            while cur in parent and len(st) < 7:
                cur = parent[cur]; q = nodes[cur]
                if q[2] not in ('(root)', '(anon)', '(program)'): st.append('%s@%s' % (q[2], q[1]))
            key = ' < '.join(st); cnt[key] = cnt.get(key, 0) + (dt or 0) / 1000.0
        if cnt: chain = sorted(cnt.items(), key=lambda kv: -kv[1])[:2]
    return total, rows, chain

def main():
    a = sys.argv[1:]
    if len(a) < 2: print(__doc__ or 'usage'); return 2
    P = load(a[0])
    if a[1] == '--at':
        s0, ln = float(a[2]), float(a[3]); wins = [('window', s0, ln)]
    else:
        R = load(a[1]); ev = R.get('evalOut'); ev = json.loads(ev) if isinstance(ev, str) else (ev or {})
        sl = ((ev.get('gf') or {}).get('sl')) or []
        if not sl: print('no slices logged in %s (gf.sl): a build before 23 Nov 11:00, or garage first was not on' % a[1]); return 2
        want = [w.lower() for w in a[2:]]
        wins = [(l, s, m) for l, s, m in sl if (not want or any(w in l.lower() for w in want))]
        if not want: wins = sorted(wins, key=lambda w: -w[2])[:8]
    for lab, s0, ln in wins:
        tot, rows, chain = cut(P, s0 - 150, s0 + ln + 150)
        print('== the slice that ended on "%s": %d ms from %.1f s of the page; %d ms of samples in the window' % (lab, ln, s0 / 1000.0, tot))
        for k, v in rows: print('   %6.0f ms  %s' % (v, k))
        for k, v in chain: print('   called from (%d ms): %s' % (v, k[:260]))
    return 0

if __name__ == '__main__': sys.exit(main())
