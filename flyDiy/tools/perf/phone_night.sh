#!/usr/bin/env bash
# phone_night.sh - PHONE-1's OVERNIGHT CHECK ON THE USER'S S20 FE (A0 2 Nov: the real phone is PHONE-EDIT-PERF's from 02:00 to
# 08:00, left plugged in by the user; the results and the stills in the phone folder by 08:00).
# It waits for --at (default 02:00), then, on the tree this script lives in (the integration branch's state at that time),
# served to the phone as its own localhost (adb reverse: the user's live-site storage is never touched) through our OWN tab:
#   1. the edit table: every slider family dragged the finger's way, 2 reps, the user's Twin_busher_floats_2, the shed drawing
#      (?idle=0), 20 s of the idle shed's frames, the phone's own flight log (GARAGE EDITS) and a still;
#   2. typed values (the value chip's change) on the same rows;
#   3. the material census on the phone tier (the default) and the full look (?phmat=full), each with a still;
#   3b. the crew: hidden and untextured beside the base (census_crew.json);
#   4. the idle hold (no ?idle=0): frames after 7 s untouched, then after a touch;
#   4b. PHONE-GARAGE's registration check (G3798c: CLOUD-SHOTS/atlas_hook.js + reg_check.js), the Cub and the twin, a side still each;
#   5. PHONE-GARAGE's touch checks (tools/perf/mobile_phone_cdp.js, its touch section, portrait as the phone holds it) and a
#      still of the Edit tab;
#   7. the test flight (PHONE-TESTFLIGHT), last: the Cub, one auto circuit, back to the shed (fly.json);
#   6. RESULTS.md (tools/perf/phone_night_report.js) - the after table beside the 2 Nov live-build table.
# At the end: our tab closed (each rig closes its own), the adb forwards removed, the server stopped. The phone's screen
# settings are left as they are (a sleeping screen is woken with a key event and noted; a locked one is noted and the
# runs skipped - no credentials are ever entered).
# Usage: bash tools/perf/phone_night.sh [--at 0200] [--until 0800] [--out <dir>] [--now]
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; FLY="$(cd "$HERE/../.." && pwd)"; REPO="$(cd "$FLY/.." && pwd)"
ADB="${ADB:-D:/Dev/platform-tools/adb.exe}"; PORT=8741; APORT=9333
AT=0200; UNTIL=0800; OUTD="D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-03/phone-night"; NOW=0
while [ $# -gt 0 ]; do case "$1" in --at) AT="$2"; shift;; --until) UNTIL="$2"; shift;; --out) OUTD="$2"; shift;; --now) NOW=1;; esac; shift; done
mkdir -p "$OUTD"; LOG="$OUTD/night.log"
say() { echo "$(date +%H:%M:%S) $*" | tee -a "$LOG"; }
hm() { date +%H%M; }
late() { [ "$(hm)" -ge "$UNTIL" ] && [ "$(hm)" -lt 1200 ]; }
if [ "$NOW" != 1 ]; then say "waiting for $AT (tree $(git -C "$REPO" rev-parse --short HEAD))"; while [ "$(hm)" -lt "$AT" ] || [ "$(hm)" -ge 1200 ]; do sleep 30; done; fi
say "start: tree $(git -C "$REPO" rev-parse --short HEAD) ($(git -C "$REPO" rev-parse --abbrev-ref HEAD))"
# the phone: on the cable, awake, Chrome reachable
for i in $(seq 1 60); do "$ADB" devices | grep -q "device$" && break; say "no phone on adb yet ($i)"; sleep 30; done
"$ADB" devices | grep -q "device$" || { say "ABORT: no authorized phone on adb"; exit 1; }
WAKE=$("$ADB" shell dumpsys power | grep -o "mWakefulness=[A-Za-z]*" | head -1)
if [ "$WAKE" != "mWakefulness=Awake" ]; then say "screen: $WAKE - waking it (KEYCODE_WAKEUP)"; "$ADB" shell input keyevent KEYCODE_WAKEUP; sleep 3; fi
LOCKED=$("$ADB" shell dumpsys window | grep -o "mDreamingLockscreen=true\|isStatusBarKeyguard=true\|mShowingLockscreen=true" | head -1)
[ -n "$LOCKED" ] && { say "ABORT: the phone is on its lock screen ($LOCKED) - nothing entered; runs skipped"; exit 1; }
say "phone: $("$ADB" shell getprop ro.product.model | tr -d '\r'), $("$ADB" shell dumpsys power | grep -o 'mWakefulness=[A-Za-z]*' | head -1), battery $("$ADB" shell dumpsys battery | grep -o 'level: [0-9]*')"
"$ADB" shell am start -n com.android.chrome/com.google.android.apps.chrome.Main >/dev/null 2>&1; sleep 4
# the server (this tree) and the forwards
node "$FLY/tools/_serve.js" $PORT "$REPO" >/dev/null 2>&1 & SRV=$!
cleanup() { kill $SRV 2>/dev/null; "$ADB" reverse --remove tcp:$PORT >/dev/null 2>&1; "$ADB" forward --remove tcp:$APORT >/dev/null 2>&1; say "cleanup: server stopped, adb forwards removed"; }
trap cleanup EXIT
sleep 2; "$ADB" reverse tcp:$PORT tcp:$PORT >/dev/null; "$ADB" forward tcp:$APORT localabstract:chrome_devtools_remote >/dev/null
ROWS=wgSpan,wgChord,stSpan,finHeight,paxLen,halfW,boomLen,fltL,fltZ,engY,li_lampSize
REP() { node "$FLY/tools/perf/phone_night_report.js" "$OUTD" > /dev/null 2>&1; }
PE() { local name="$1"; shift; late && { say "skip $name: past $UNTIL"; return 0; }
  say "run $name"; timeout 1500 node "$FLY/tools/perf/phone_edit.js" --phone $APORT --port $PORT --page dev.html --build "${PB:-twin}" "$@" >> "$OUTD/$name.txt" 2>&1; say "  $name exit $? ($(tail -1 "$OUTD/$name.txt"))"; REP; }
PE edits   --rows $ROWS --reps 2 --ticks 15 --quiet 3000 --idle 20 --query idle=0 --out "$OUTD/edits.json" --shot "$OUTD/s20_after_tier.jpg" --flightlog "$OUTD/flightlog_edits.json"
# the crew (A0 2 Nov 21:55, the user: the characters untextured, or not drawn at all, if they cost): hidden and flat beside the base
PE crew    --rows none --census base,nocrew,crewflat,base --csec 6 --query idle=0 --out "$OUTD/census_crew.json"
# 7. THE TEST FLIGHT, THIRD (A0 3 Nov 00:55; was last, A0 2 Nov 23:00: the Cub, one auto circuit and back to the shed, capped at
#    8 min; a dead Chrome or a hot phone (45 C) stops it and is named - never retried)
PB=cub PE fly --rows none --fly --flycap 480 --query idle=0 --out "$OUTD/fly.json"
PE typed   --rows $ROWS --reps 1 --typed --quiet 3000 --query idle=0 --out "$OUTD/typed.json"
PE census  --rows none --census --csec 6 --idle 20 --query idle=0 --out "$OUTD/census_tier.json"
PE full    --rows none --census base --csec 6 --idle 20 --query "idle=0&phmat=full" --out "$OUTD/census_full.json" --shot "$OUTD/s20_after_full.jpg"
PE idle    --rows none --idlecheck --out "$OUTD/idle.json"
# PHONE-GARAGE's G3798c (A0 2 Nov): the registration painted in the decal atlas after the page's first paint (the Cub's came out
# blank under SwiftShader) - its own pass (the hook reads page 0 every 250 ms: never on the timed passes), the Cub and the twin
CS=D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-02/CLOUD-SHOTS
for RB in cub twin; do PB=$RB PE reg_$RB --rows none --query idle=0 --initjs "$CS/atlas_hook.js" --evaljs "$CS/reg_check.js" --evalwait 15 --shotview s --shot "$OUTD/s20_reg_${RB}_side.jpg" --out "$OUTD/reg_$RB.json"; done
if ! late; then
  say "run touch (PHONE-GARAGE's checks)"
  timeout 900 node "$FLY/tools/perf/mobile_phone_cdp.js" --port $APORT --url "http://localhost:$PORT/flyDiy/dev.html?profile=phone" --build "$FLY/tools/fixtures/test_copies/Twin_busher_floats_2.json" \
    --skip boot,drag,frames,soak --shot "$OUTD/s20_after_edit_tab.jpg" --out "$OUTD/touch.json" --no-adb >> "$OUTD/touch.txt" 2>&1
  say "  touch exit $?"
fi
node "$FLY/tools/perf/phone_night_report.js" "$OUTD" >> "$LOG" 2>&1 && say "report: $OUTD/RESULTS.md"
say "done"
