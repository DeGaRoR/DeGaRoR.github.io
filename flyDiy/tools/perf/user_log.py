#!/usr/bin/env python3
# user_log.py - A FLIGHT LOG READ AGAINST THE OBJECTIVES TABLE (PERF-LEAD, 22 Nov 2026)
# For the log the user exports after a manual session (the menu's "Export my log" -> flydiy-flightlog-<id>.json in the
# downloads), and for a rig's. One read, no GPU, no node:
#   python tools/perf/user_log.py <flightlog.json> [--md out.md]
# It prints, against flyDiy/PERF-OBJECTIVES.md:
#   the session (build, screen, how long in the garage / in the world, the loading screens and their lengths)
#   row 13  the frame rate: seconds with 29 frames or more, frames on time, in the garage and in the world
#   rows 7 / 8  frames over 100 ms in the garage / in the world, each with its time, height and the three longest slots
#   row 9   20-second blocks of the world with a frame over 35 ms (the profiler's orange bar) / over 100 ms (red)
#   row 14  each crash: the frames of the 20 s after the impact, the frames that drew nothing, the errors caught
#   what the excess over 50 ms is made of, by slot; the water mirror's share of the time; the uploads of 30 ms+
# Everything is the recorder's own columns and events (flight_recorder.js v2); PERF-TRACE's freeze_ledger.js and
# big_uploads.js go deeper on the same file.
import sys, json, io, bisect, collections

def main():
    if len(sys.argv) < 2: print(__doc__ or 'usage: user_log.py <flightlog.json> [--md out.md]'); return 2
    path = sys.argv[1]; md = sys.argv[sys.argv.index('--md') + 1] if '--md' in sys.argv else None
    d = json.load(io.open(path, encoding='utf-8'))
    h, f, ev = d['header'], d['frames'], d.get('events', [])
    n, FL, codes, slots = f['n'], h['flags'], h.get('codes', {}), h['slots']
    t, dt, fl = f['t'], f['dt'], f['flags']
    col = lambda k: f.get(k) or [None] * n
    agl, ph, gpu, work, mir = col('agl'), col('phase'), col('gpu'), col('work'), col('mirror')
    out = []
    def P(s=''): out.append(s)
    garage = [i for i in range(n) if (fl[i] & FL['garage']) and not (fl[i] & FL['boot'])]
    world = [i for i in range(n) if not (fl[i] & FL['garage']) and not (fl[i] & FL['boot']) and (fl[i] & FL['running'])]
    secs = lambda idx: sum(dt[i] for i in idx) / 1000.0
    P('# The log against the objectives')
    P('')
    P('file: %s' % path)
    P('build %s, screen %s, window %s, dpr %s; %d frames kept (ring %s), %d events%s' % (
        h['build'].get('build') if isinstance(h.get('build'), dict) else h.get('build'), h.get('screen'), h.get('window'), h.get('dpr'), n, h.get('ring'), len(ev),
        (', %d events DROPPED' % h['eventsDropped']) if h.get('eventsDropped') else ''))
    if n and h.get('frames') and h['frames'] > n: P('NOTE: the session had %d frames and the ring kept the last %d: the start is not in this log (open the game with ?recring=131072 for a long session)' % (h['frames'], n))
    P('in the garage %.0f s (%d frames), in the world %.0f s (%d frames)' % (secs(garage), len(garage), secs(world), len(world)))
    P('(the limits sit on a multiple of the screen's 16.7 ms: a frame of 6 intervals is 100.0 ms give or take its jitter. A frame counts as OVER 50 / 100 / 250 ms from 54 / 104 / 254 ms, so the count does not flip on the jitter - 23 Nov)')
    # the loading screens: the boot events 'loading <set>' ... 'gone <set>'
    P('')
    P('## Loading screens (rows 2, 3, 4)')
    up = None; rows = 0
    for e in ev:
        if e[1] != 'boot': continue
        s = str(e[3]); st, _, st_set = s.partition(' ')
        if st != 'gone' and up is None: up = (e[0], st_set)
        elif st == 'gone' and up is not None:
            P('- %-8s screen: %6.1f s (up at %.1f s of the page, gone at %.1f s)' % (st_set or up[1], (e[0] - up[0]) / 1000.0, up[0] / 1000.0, e[0] / 1000.0)); up = None; rows += 1
    if not rows: P('- none in the kept part of the log')
    P('  (the first one starts when the recorder starts, a few seconds after the click: add the scripts\' time for row 2)')

    def fps(idx, label):
        if not idx: P('- %s: no frames' % label); return
        ds = sorted(dt[i] for i in idx); T = secs(idx)
        # 23 Nov: a frame the draw guard HELD was rendered and not shown (PERF-TRACE's notShown flag, tool 7): the seconds
        # with 29+ frames count the frames SHOWN. A second that had frames and showed none counts as 0.
        NS = FL.get('notShown', 0); hid = sum(1 for i in idx if fl[i] & NS) if NS else 0
        per = collections.Counter(int(t[i] // 1000) for i in idx if not (NS and fl[i] & NS))
        full = [per.get(k, 0) for k in set(int(t[i] // 1000) for i in idx)]
        if hid: P('- %s: %d of %d frames were rendered and NOT SHOWN (held by the draw guard): left out of the frames a second below' % (label, hid, len(idx)))
        P('- %s: %.1f fps mean, median frame %.1f ms; seconds with 29+ frames %.1f %%; frames on time (<= 34.5 ms) %.1f %%; frames over 50 ms %.2f %%' % (
            label, len(idx) / T, ds[len(ds) // 2], 100.0 * sum(1 for v in full if v >= 29) / len(full), 100.0 * sum(1 for v in ds if v <= 34.5) / len(ds), 100.0 * sum(1 for v in ds if v > 54) / len(ds)))
    P('')
    P('## Row 13, the frame rate (target: 30 fps held)')
    fps(garage, 'garage'); fps(world, 'world ')
    g = sorted(gpu[i] for i in world if gpu[i]); w = sorted(work[i] for i in world if work[i] is not None)
    if g and w: P('- world, where the time goes: GPU %.1f ms median, %.1f at the 90th percentile; the page\'s own work %.1f ms median, %.1f at the 90th (a frame has 33.3 ms)' % (g[len(g) // 2], g[int(len(g) * .9)], w[len(w) // 2], w[int(len(w) * .9)]))

    def top3(i): return ', '.join('%s %.0f' % (s, v) for v, s in sorted(((f[s][i] or 0), s) for s in slots if s in f)[::-1][:3])
    def freezes(idx, label, t0):
        fr = [i for i in idx if dt[i] > 104]
        P('- %s: %d frames over 100 ms%s' % (label, len(fr), (', the worst %.0f ms' % max(dt[i] for i in fr)) if fr else ''))
        for i in fr[:40]:
            P('    t+%7.1f s  %4.0f ms  %s%s  [%s]' % ((t[i] - t0) / 1000.0, dt[i], ('AGL %4.0f m ' % agl[i]) if agl[i] is not None and label.startswith('world') else '',
                (codes.get('phase') or [''] * 99)[ph[i] or 0] if label.startswith('world') and ph[i] is not None else '', top3(i)))
        if len(fr) > 40: P('    ... and %d more' % (len(fr) - 40))
    P('')
    P('## Rows 7 and 8, freezes (target: no frame over 100 ms)')
    if garage: freezes(garage, 'garage', t[garage[0]])
    if world: freezes(world, 'world ', t[world[0]])
    P('  (a slot can be billed for a neighbour\'s work: the first pass to draw pays the uploads of the frame)')

    if world:
        t0 = t[world[0]]; blocks = collections.defaultdict(lambda: [0, 0, 0])
        for i in world:
            b = blocks[int((t[i] - t0) // 20000)]; b[0] += 1
            if dt[i] > 35: b[1] += 1      # (the profiler's ORANGE bar and freeze_ledger.js's limit: a frame that missed its 30 fps tick)
            if dt[i] > 104: b[2] += 1
            if dt[i] > 54: b.append(1)
        nb = len(blocks); orange = sum(1 for b in blocks.values() if b[1]); red = sum(1 for b in blocks.values() if b[2])
        P('')
        P('## Row 9, evenness (target: at most 5 % of 20-second blocks with a frame over 35 ms, none with a freeze)')
        P('- %d of %d blocks have a frame over 35 ms (%.0f %%); %d have one over 50 ms; %d have a frame over 100 ms' % (orange, nb, 100.0 * orange / nb, sum(1 for b in blocks.values() if len(b) > 3), red))
        line = ''.join('R' if blocks[k][2] else 'o' if blocks[k][1] else '.' for k in sorted(blocks))
        P('- the flight, a character a block (. even, o a frame over 35 ms, R over 100 ms):');
        for a in range(0, len(line), 60): P('    ' + line[a:a + 60])
        # what the excess is made of
        ex = collections.Counter(); tot = 0.0
        for i in world:
            if dt[i] <= 50: continue
            over = dt[i] - 50; tot += over
            parts = [(f[s][i] or 0, s) for s in slots if s in f]; sm = sum(v for v, s in parts) or 1.0
            for v, s in parts: ex[s] += over * v / sm
        P('')
        P('## What the time over 50 ms is made of (world, %.1f s in all), by the frame\'s own slots' % (tot / 1000.0))
        for s, v in ex.most_common(8): P('- %-7s %5.1f s  %4.1f %%' % (s, v / 1000.0, 100.0 * v / max(tot, 1e-9)))
        on = [i for i in world if (mir[i] or 0) >= 1.0]
        if on:
            ms = sorted(mir[i] for i in on); hi = [i for i in on if (agl[i] or 0) >= 400]
            P('')
            P('## The water mirror')
            P('- running %.1f %% of the world\'s time (%.0f s), %.0f %% of that above 400 m; its slot %.1f ms median, %.1f at the 90th percentile' % (
                100.0 * secs(on) / secs(world), secs(on), 100.0 * secs(hi) / max(secs(on), 1e-9), ms[len(ms) // 2], ms[int(len(ms) * .9)]))
        big = [e for e in ev if e[1] == 'gpuup' and isinstance(e[3], dict) and e[3].get('buf') and e[3]['buf'][1] >= 30 and t0 <= e[0] <= t[world[-1]]]
        P('')
        P('## Uploads of 30 ms or more to the graphics card (world)')
        if big:
            mb = sorted(e[3]['buf'][2] / 1024.0 for e in big)
            P('- %d of them, %.1f s in all, median %.0f MB, the largest %.0f MB' % (len(big), sum(e[3]['buf'][1] for e in big) / 1000.0, mb[len(mb) // 2], mb[-1]))
        else: P('- none')
    # ROW 14, THE CRASH: an impact is read from the frames (no crash event in the recorder yet): low over the ground, the
    # speed falling by 8 m/s or more within half a second. For each, the 20 s after it (and the second before).
    spd, calls = col('spd'), col('calls')
    if world:
        imp = []; k = 0
        while k < len(world):
            i = world[k]
            if agl[i] is not None and agl[i] < 6 and spd[i] is not None:
                j = k
                while j + 1 < len(world) and t[world[j + 1]] - t[i] <= 500: j += 1
                lo = min((spd[world[m]] for m in range(k, j + 1) if spd[world[m]] is not None), default=spd[i])
                if spd[i] - lo >= 8 and spd[i] >= 10:
                    imp.append(i)
                    while k < len(world) and t[world[k]] - t[i] < 20000: k += 1
                    continue
            k += 1
        P('')
        P('## Row 14, the crash (target: no frame over 250 ms, no frame that draws nothing)')
        if not imp: P('- no impact found in this log (a speed loss of 8 m/s in half a second under 6 m)')
        t0w = t[world[0]]
        for i0 in imp:
            win = [i for i in world if t[i0] - 1000 <= t[i] <= t[i0] + 20000]
            pre = sorted(calls[i] for i in world if t[i0] - 5000 <= t[i] < t[i0] and calls[i])
            med = pre[len(pre) // 2] if pre else 0
            worst = max(win, key=lambda i: dt[i])
            over250 = [i for i in win if dt[i] > 254]; over100 = [i for i in win if dt[i] > 104]
            nor = [i for i in win if fl[i] & FL.get('noRender', 0)]
            thin = [i for i in win if med and calls[i] is not None and calls[i] < 0.1 * med and not (fl[i] & FL.get('noRender', 0))]
            errs = [e for e in ev if e[1] == 'catch' and t[i0] - 1000 <= e[0] <= t[i0] + 20000]
            P('- impact at t+%.1f s (%.0f m/s, AGL %.1f m): the worst frame of the next 20 s is %.0f ms (%+.1f s after) [%s]' % ((t[i0] - t0w) / 1000.0, spd[i0], agl[i0], dt[worst], (t[worst] - t[i0]) / 1000.0, top3(worst)))
            P('    frames over 250 ms: %d; over 100 ms: %d; frames not rendered: %d; frames drawing under a tenth of the usual %d calls: %d; errors caught in the loop: %d' % (len(over250), len(over100), len(nor), med, len(thin), len(errs)))
            for i in over100[:12]: P('    %+6.2f s  %4.0f ms  calls %s  [%s]' % ((t[i] - t[i0]) / 1000.0, dt[i], calls[i], top3(i)))
            for i in (nor + thin)[:8]: P('    %+6.2f s  a frame with %s draw calls%s' % ((t[i] - t[i0]) / 1000.0, calls[i], ' (not rendered)' if fl[i] & FL.get('noRender', 0) else ''))
            for e in errs[:5]: P('    %+6.2f s  caught: %s' % ((e[0] - t[i0]) / 1000.0, str(e[2:])[:160]))
            # THE SCREEN (23 Nov): a held frame costs 100-230 ms in the frame times and puts NOTHING on the screen; the game
            # logs every run of them as 'still' (ms from the last presented frame to the next one). THAT is the freeze.
            st = [e for e in ev if e[1] == 'still' and t[i0] - 1000 <= e[0] <= t[i0] + 20000 and e[2]]
            if st:
                w = max(st, key=lambda e: e[2]); keep = bool((w[3] or {}).get('keep')) if isinstance(w[3], dict) else False
                P('    THE SCREEN: %d stretches with no new picture, %.1f s in all; the longest %.0f ms (ending %+.1f s after), %s' % (len(st), sum(e[2] for e in st) / 1000.0, w[2], (w[0] - t[i0]) / 1000.0, 'the last picture frozen (keepframe)' if keep else 'THE PAGE SHOWN (row 15)'))
                P('    ROW 14 READ ON THE SCREEN: the longest wait for a new picture is %.0f ms (target 250)' % max(w[2], dt[worst]))
            elif not any(e[1] == 'still' for e in ev):
                P('    (this log has no \'still\' events: either no frame was held, or the build is older than 23 Nov and its frame times do NOT show the time the screen stood still)')
    # ROW 15 OVER THE WHOLE LOG: every stretch the screen showed no new picture (held frames), wherever it was
    st = [e for e in ev if e[1] == 'still' and e[2]]
    if st:
        P('')
        P('## Row 15, the screen with no new picture (held frames), the whole log')
        pg = [e for e in st if not (isinstance(e[3], dict) and e[3].get('keep'))]
        P('- %d stretches, %.1f s in all, the longest %.0f ms; %d of them showed the PAGE (no keepframe): %.1f s' % (len(st), sum(e[2] for e in st) / 1000.0, max(e[2] for e in st), len(pg), sum(e[2] for e in pg) / 1000.0))
        for e in sorted(st, key=lambda e: -e[2])[:10]: P('    t %.1f s  %5.0f ms  %s' % (e[0] / 1000.0, e[2], str(e[3])[:80]))
    text = '\n'.join(out)
    print(text)
    if md: io.open(md, 'w', encoding='utf-8', newline='\n').write(text + '\n')
    return 0

if __name__ == '__main__': sys.exit(main())
