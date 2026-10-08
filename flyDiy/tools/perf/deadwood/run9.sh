#!/usr/bin/env bash
# G2590 gates, A0's CPU booking 2026-10-08 16:40-16:50 - UNLOCKED (PILOT holds the GPU, untimed; a cpu take would wait on it):
# no other CPU_BATTERY_* / RESERVED, hard stop 16:50 (every process on a timeout - only our own tree dies), the census pair
# (this branch vs its merge base with origin/master) + PROGRAMS
D="C:/Users/denis/AppData/Local/Temp/claude/D--Dev-DeGaRoR-github-io--claude-worktrees-upbeat-williams-52587e/7cac7812-f729-4524-a80f-a6f828a982ef/scratchpad"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
B=D:/Dev/DeGaRoR.github.io/.claude/worktrees/upbeat-williams-52587e
until [ "$(date +%Y%m%d%H%M)" -ge 202610081640 ]; do sleep 15; done
date; bash $L show
S=$(bash $L show | grep -E "CPU_BATTERY|RESERVED"); if [ -n "$S" ]; then echo "another CPU battery / reservation, skipped: $S"; exit 3; fi
left() { echo $(( $(date -d "2026-10-08 16:50" +%s) - $(date +%s) - 5 )); }
cd $B && git fetch -q origin; BASE=$(git merge-base HEAD origin/master); echo "base $BASE"
git worktree add --detach "$D/basetree" $BASE > /dev/null 2>&1
cd $B/flyDiy && timeout $(left) node tools/_program_check.js > $D/dw/g9_programs.txt 2>&1; echo "PROGRAMS exit $? : $(grep -E 'GATE [A-Z]+: ' $D/dw/g9_programs.txt | tail -1)"
t=$(left); [ $t -gt 20 ] && { cd $B/flyDiy && timeout $t node --max-old-space-size=6144 --expose-gc tools/_framecost_check.js --census cub > $D/dw/census9_branch.txt 2> $D/dw/census9_branch.err; echo "branch census exit $?"; }
t=$(left); [ $t -gt 20 ] && { cd "$D/basetree/flyDiy" && timeout $t node --max-old-space-size=6144 --expose-gc tools/_framecost_check.js --census cub > $D/dw/census9_base.txt 2> $D/dw/census9_base.err; echo "base census exit $?"; }
date
cd $B/flyDiy && node tools/_framecost_check.js --compare $D/dw/census9_base.txt $D/dw/census9_branch.txt | head -40
cd $B && git worktree remove --force "$D/basetree" && echo "base tree removed"
