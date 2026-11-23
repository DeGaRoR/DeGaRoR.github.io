#!/usr/bin/env python
# gf_garage.py - THE GARAGE'S FRAME TABLE WHILE THE WORLD LOADS BEHIND IT (PERF-LEAD, 23 Nov 2026)
#
#   python tools/perf/gf_garage.py <row.json of boot_perf --out, a ?boot=garagefirst load> [more rows ...]
#
# The user, 23 Nov: "If that's background loading, but the garage freezes for the whole time, there's little point.
# That's the right solution, but garage shouldn't freeze." The FIRST target of garage first is rows 7 and 10 in the
# garage during the background load: no task over 100 ms (this week's bar), none over 50 ms (the sliders' row).
# This reads the page's own long tasks (PerformanceObserver 'longtask': every task of 50 ms or more, its start and
# length) from the garage's reveal to the end of the background run (or to Go, when Go came first), and files each under
# the background step it fell in (FLYDIY_LAB.gfS.log: [id, ms, ran, start ms after the run began, programs, live|screen])
# and, inside the world step, under the build's own label (gfS.sl: the slice that ENDED on it). A task before the run
# began (the first 1.5 s) is the garage's own. Tasks while the roll-out's screen was up (a step marked 'screen') are
# listed apart: nobody sees those.
import io, json, sys

def read(path):
    d = json.load(io.open(path, encoding='utf-8')); ev = d.get('evalOut'); ev = json.loads(ev) if isinstance(ev, str) else (ev or {})
    g = ev.get('gf') or {}
    if not g: print('%s: not a garage-first row (no gf in its eval)' % path); return None
    # every long task is in the row's flight log (the recorder's 'longtask' events: [start on the page's clock, 'longtask', ms]);
    # the row's own list keeps the eight longest only
    tasks = []
    try:
        fl = json.load(io.open(path[:-5] + '.flightlog.json', encoding='utf-8'))
        tasks = [(e[0], e[2]) for e in fl.get('events', []) if e[1] == 'longtask' and e[2]]
    except Exception:
        tasks = [(t['t'], t['d']) for t in (d.get('longTasks') or [])]
        print('(%s: no flight log beside the row - only its eight longest tasks are read)' % path)
    reveal = g.get('revealAt') or 0; t0 = reveal + (g.get('delayMs') or 1500)
    steps = [(r[0], t0 + r[3], t0 + r[3] + r[1], r[5] if len(r) > 5 else 'live') for r in (g.get('log') or [])]
    end = max([s[2] for s in steps] + [t0])
    sl = [(l, s, s + m) for l, s, m in (g.get('sl') or [])]
    return dict(tag=d.get('tag') or path, tasks=tasks, reveal=reveal, t0=t0, steps=steps, end=end, sl=sl, g=g, garage=(d.get('bootGone') or 0) / 1000.0)

def main():
    rows = [r for r in (read(p) for p in sys.argv[1:]) if r]
    if not rows: print(__doc__ or 'usage'); return 2
    for R in rows:
        live_end = min([s[1] for s in R['steps'] if s[3] != 'live'] + [R['end']])
        seen = [(t, d) for t, d in R['tasks'] if R['reveal'] <= t < live_end]
        under = [(t, d) for t, d in R['tasks'] if live_end <= t < R['end']]
        buckets = {}
        def put(k, d):
            b = buckets.setdefault(k, [0, 0, 0, 0.0]); b[0] += 1; b[1] += d > 100; b[2] = max(b[2], d); b[3] += d
        for t, d in seen:
            k = 'the garage itself (before the run began)'
            for sid, a, b, how in R['steps']:
                if a - 5 <= t < b + 5: k = sid; break
            else:
                if t >= R['t0']: k = '(between steps)'
            if k == 'world':
                for l, a, b in R['sl']:
                    if a - 60 <= t <= b + 10: k = 'world: ' + l; break
                else: k = 'world: (a slice under 50 ms, or not the build\'s)'
            put(k, d)
        secs = (live_end - R['reveal']) / 1000.0
        n50 = len(seen); n100 = sum(1 for _, d in seen if d > 100); worst = max([d for _, d in seen] + [0]); total = sum(d for _, d in seen)
        print('== %s: the garage shown at %.1f s; the world loading behind it for %.1f s%s' % (R['tag'], R['garage'], secs, '' if live_end >= R['end'] - 1 else ' (then Go: the rest under its screen)'))
        print('   THE GARAGE MEANWHILE: %d tasks of 50 ms or more, %d over 100 ms, the worst %d ms, %.1f s in them (%.0f %% of the time)   [bar: none over 100 ms; the sliders\' row: none over 50]' % (n50, n100, worst, total / 1000.0, 100.0 * total / max(1.0, live_end - R['reveal'])))
        print('   %-52s %5s %6s %7s %8s' % ('by the step it fell in', '>=50', '>100', 'worst', 'ms in all'))
        for k, b in sorted(buckets.items(), key=lambda kv: (-kv[1][1], -kv[1][2])):
            print('   %-52s %5d %6d %7d %8d' % (k[:52], b[0], b[1], b[2], b[3]))
        if under: print('   (under the roll-out\'s screen after Go: %d tasks, the worst %d ms - not seen)' % (len(under), max(d for _, d in under)))
        g = R['g']; print('   the run: world ready %.1f s after it began; steps %s' % ((g.get('ms') or 0) / 1000.0, ' | '.join('%s %.1f' % (r[0], r[1] / 1000.0) for r in (g.get('log') or []) if r[1] >= 500)))
    return 0

if __name__ == '__main__': sys.exit(main())
