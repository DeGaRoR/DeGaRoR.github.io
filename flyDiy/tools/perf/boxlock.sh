#!/usr/bin/env bash
# boxlock.sh - THE BOX'S TWO-WAY LOCK (G1015, 2026-09-28). One GPU bench OR any number of CPU batteries, never both.
# Hand-rolled lock code got it wrong three times on 2026-09-27/28 (a CPU battery started under a live GPU bench),
# so every session takes and drops its locks through this.
#
#   bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh take gpu <who> [note]  # waits: no GPU lock AND no CPU lock
#   bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh take cpu <who> [note]  # waits: no GPU lock (CPU locks share)
#   bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh drop gpu|cpu <who>
#   bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh show
#   bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh reserve <who> [note]   # PRIORITY: every OTHER take waits
#   bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh unreserve <who>         # (the coordinator's call, e.g. the user watching)
#
# The lock files live in the MAIN checkout's tools/perf/ whatever worktree you run from - always call this by the
# absolute path above. Creation is noclobber, and the conflict is re-checked AFTER creating (a gpu and a cpu taken in
# the same second each see the other's file and back off, then retry). <who> is one word (your session's code).
# A lock older than 90 min is reported as stale and waited on - this never deletes another session's lock.
D="D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf"
cmd="$1"; kind="$2"; who="$3"; shift 3 2>/dev/null; note="$*"
gpu="$D/GPU_BENCH.lock"
cpu_any() { ls "$D"/CPU_BATTERY_*.lock >/dev/null 2>&1; }
res="$D/RESERVED"
# a reservation blocks every take but its holder's (and is ignored when older than 180 min: a forgotten one must not stop the box)
reserved_other() { [ -e "$res" ] || return 1; local a=$(( ($(date +%s) - $(stat -c %Y "$res")) / 60 )); [ $a -gt 180 ] && return 1; ! grep -q "^$who " "$res"; }
stale() { for f in "$D"/*.lock; do [ -e "$f" ] || continue; a=$(( ($(date +%s) - $(stat -c %Y "$f")) / 60 )); [ $a -gt 90 ] && echo "boxlock: STALE ($a min) $(basename "$f"): $(cat "$f") - tell the coordinator" >&2; done; }
case "$cmd" in
  show) for f in "$D"/*.lock "$res"; do [ -e "$f" ] && echo "$(basename "$f"): $(cat "$f")"; done; exit 0 ;;
  reserve) [ -n "$kind" ] || { echo "usage: boxlock.sh reserve <who> [note]" >&2; exit 2; }; echo "$kind $(date +%H:%M) $who $note" > "$res"; echo "boxlock: box RESERVED for $kind"; exit 0 ;;
  unreserve) if grep -q "^$kind " "$res" 2>/dev/null; then rm -f "$res"; echo "boxlock: reservation by $kind released"; else echo "boxlock: no reservation by $kind" >&2; fi; exit 0 ;;
  take)
    [ -n "$who" ] || { echo "usage: boxlock.sh take gpu|cpu <who> [note]" >&2; exit 2; }
    n=0
    while true; do
      if reserved_other; then :
      elif [ "$kind" = gpu ]; then
        # 2026-10-01 (the user): GPU locks only - a GPU take no longer waits for CPU locks (a CPU lock is for a SHORT
        # benchmark at most; node gates, builds, censuses, cooks and stills take no lock at all)
        if [ ! -e "$gpu" ] && ( set -C; echo "$who $(date +%H:%M) $note" > "$gpu" ) 2>/dev/null; then
          echo "boxlock: GPU taken by $who"; exit 0
        fi
      elif [ "$kind" = cpu ]; then
        f="$D/CPU_BATTERY_$who.lock"
        if [ ! -e "$gpu" ] && ( set -C; echo "$who $(date +%H:%M) $note" > "$f" ) 2>/dev/null; then
          if [ -e "$gpu" ]; then rm -f "$f"; else echo "boxlock: CPU battery taken by $who"; exit 0; fi
        fi
      else echo "boxlock: kind must be gpu or cpu" >&2; exit 2; fi
      n=$((n + 1)); [ $((n % 20)) -eq 1 ] && { echo "boxlock: $who waiting for $kind - held: $(ls "$D"/*.lock 2>/dev/null | xargs -n1 basename 2>/dev/null | tr '\n' ' ')" >&2; stale; }
      sleep 15
    done ;;
  drop)
    if [ "$kind" = gpu ]; then
      if grep -q "^$who " "$gpu" 2>/dev/null; then rm -f "$gpu"; echo "boxlock: GPU released by $who"; else echo "boxlock: $who holds no GPU lock" >&2; fi
    else rm -f "$D/CPU_BATTERY_$who.lock"; echo "boxlock: CPU battery released by $who"; fi
    exit 0 ;;
  *) echo "usage: boxlock.sh take|drop gpu|cpu <who> [note] | show" >&2; exit 2 ;;
esac
