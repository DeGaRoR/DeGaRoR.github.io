#!/usr/bin/env python
# screen_read.py - THE PICTURE PASS: what the SCREEN showed in a recorded run (PERF-LEAD, 23 Nov 2026; rows 14 and 15)
#
#   python tools/perf/screen_read.py <screen dir of flight_script.js --screencast> [--step "<part of a step's name>"] [--md out.md]
#
# The user, 22-23 Nov: "No blue screen, not in the garage, not in the world, not when crashing, ever"; "the 200 ms quoted
# before are rubbish, it freezes for several seconds". The game's frame times do not see either: a frame the draw guard
# holds costs its 100-230 ms and puts nothing on the screen, and the canvas's own pixels are not what the compositor
# shows. The screen's recording does. This reads it:
#   1. THE PAGE SHOWN (row 15): every saved picture (one a second, and each one the recorder flagged) is looked at - the
#      share of it that is the page's background (magenta when the run set it so: tools/flight_scripts/perf/*_magenta.json;
#      the page's own pale blue #cfe0ec otherwise). Over half = the page, not the world. Between the saved pictures the
#      recorded frames' sizes carry it: a page frame is a fraction of a world frame's bytes.
#   2. THE SCREEN FROZEN WHOLE: the longest time between two recorded frames (the compositor sends a frame when anything
#      on the screen changed, the HUD included: a gap is a screen where NOTHING moved - one long frame).
#   3. THE WORLD'S PICTURE STANDING STILL (row 14, approximate): the longest stretch where the frames' sizes stay within
#      1 % (the HUD ticking over a frozen picture). Approximate: a calm picture also changes little - read it in a step
#      where the picture must move (the crash), with --step. The exact figure is the flight log's 'still' events
#      (tools/perf/user_log.py), on a build of 23 Nov or later.
# Exit code 0: no page seen; 1: the page was shown; 2: usage / nothing to read.
import io, json, os, re, sys

def page_share(path):
    try:
        from PIL import Image
    except Exception:
        return None
    try:
        im = Image.open(path).convert('RGB').resize((96, 24))
    except Exception:
        return None
    px = list(im.getdata()); n = len(px)
    mag = sum(1 for r, g, b in px if r > 190 and g < 100 and b > 190)
    blue = sum(1 for r, g, b in px if abs(r - 207) <= 10 and abs(g - 224) <= 10 and abs(b - 236) <= 10)
    return max(mag, blue) / float(n), ('magenta' if mag >= blue else 'page blue')

def main():
    a = sys.argv[1:]
    if not a: print(__doc__ or 'usage: screen_read.py <screen dir>'); return 2
    d = a[0]; step = a[a.index('--step') + 1] if '--step' in a else None; md = a[a.index('--md') + 1] if '--md' in a else None
    try: J = json.load(io.open(os.path.join(d, 'screencast.json'), encoding='utf-8'))
    except Exception as e: print('screen_read: no screencast.json in %s (%s)' % (d, e)); return 2
    sizes = J.get('sizes') or []; marks = J.get('marks') or []
    if not sizes: print('screen_read: no frames recorded'); return 2
    out = []; P = out.append
    def step_of(t):
        s = '(before the first step)'
        for m in marks:
            if m['t'] <= t: s = m['step']
        return s
    P('# The screen, %s' % d.replace('\\', '/'))
    P('%d frames recorded in %.0f s (median %d bytes)' % (len(sizes), (sizes[-1][0] - sizes[0][0]) / 1000.0, sorted(b for _, b in sizes)[len(sizes) // 2]))
    # 1. the saved pictures
    pics = []
    for f in sorted(os.listdir(d)):
        m = re.match(r'f(\d+)(_FLAT)?\.jpg$', f)
        if m:
            r = page_share(os.path.join(d, f))
            if r: pics.append((int(m.group(1)), r[0], r[1], f))
    opening = [p for p in pics if p[1] > 0.5 and p[0] < 2000]   # the page as it opens, before the loading screen is drawn: named, not counted
    page = [p for p in pics if p[1] > 0.5 and p[0] >= 2000]
    P('')
    P('## Row 15, the page shown instead of the world')
    if not pics: P('- no saved picture could be read (PIL missing, or none saved)')
    elif not page: P('- NONE: %d saved pictures looked at, none is over half the page\'s background' % len(pics))
    else:
        runs = []
        for p in page:
            if runs and p[0] - runs[-1][1] <= 1600: runs[-1][1] = p[0]; runs[-1][2] += 1
            else: runs.append([p[0], p[0], 1, p[2], p[3]])
        P('- THE PAGE WAS SHOWN: %d of %d saved pictures, in %d stretch(es)' % (len(page), len(pics), len(runs)))
        for r in runs:
            # the stretch's true ends, from the frames' sizes: page frames are small beside the world's before them
            before = [b for t, b in sizes if r[0] - 6000 <= t < r[0] - 1500]; ref = sorted(before)[len(before) // 2] if before else 0
            lo = r[0]; hi = r[1]
            if ref:
                small = [t for t, b in sizes if r[0] - 3000 <= t <= r[1] + 3000 and b < 0.5 * ref]
                if small: lo, hi = min(small + [lo]), max(small + [hi])
            P('    from %.2f s to %.2f s (%.1f s), %s, in "%s"; a picture of it: %s' % (lo / 1000.0, hi / 1000.0, (hi - lo) / 1000.0, r[3], step_of(r[0]), r[4]))
    if opening: P('- (the page as it opens, %.1f s into the recording, is its bare background for a frame, before the loading screen is drawn: not counted)' % (opening[0][0] / 1000.0))
    # 2. the screen frozen whole
    gaps = sorted(((sizes[i + 1][0] - sizes[i][0], sizes[i][0]) for i in range(len(sizes) - 1)), reverse=True)
    P('')
    P('## The screen frozen whole (nothing on it moved, the HUD included)')
    big = [g for g in gaps if g[0] > 250]
    P('- %d gap(s) over 250 ms between two recorded frames; the longest %d ms' % (len(big), gaps[0][0] if gaps else 0))
    for g in big[:8]: P('    %6d ms from %.2f s, in "%s"' % (g[0], g[1] / 1000.0, step_of(g[1])))
    # 3. the world's picture standing still, in one step
    if step:
        t0 = next((m['t'] for m in marks if step.lower() in m['step'].lower()), None)
        if t0 is None: P(''); P('(no step named like "%s")' % step)
        else:
            w = [(t, b) for t, b in sizes if t0 <= t <= t0 + 25000]
            ch = [w[0]] if w else []
            for t, b in w[1:]:
                if abs(b - ch[-1][1]) > 0.01 * ch[-1][1]: ch.append((t, b))
            st = sorted(((ch[i + 1][0] - ch[i][0], ch[i][0]) for i in range(len(ch) - 1)), reverse=True)
            P('')
            P('## Row 14, the picture standing still in the 25 s from "%s" (approximate: frames within 1 %% in size)' % step)
            P('- %d frames recorded, %d different pictures; the longest stretches without a new one:' % (len(w), len(ch)))
            for g in st[:5]: P('    %6d ms from %+.2f s' % (g[0], (g[1] - t0) / 1000.0))
    text = '\n'.join(out); print(text)
    if md: io.open(md, 'w', encoding='utf-8', newline='\n').write(text + '\n')
    return 1 if page else 0

if __name__ == '__main__': sys.exit(main())
