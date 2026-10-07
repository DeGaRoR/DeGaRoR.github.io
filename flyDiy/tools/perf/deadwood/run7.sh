#!/usr/bin/env bash
# DEADWOOD-BRIGHT G1975.2: FRAMECOST (full gate), TREES, TREEHIT on mixDead ON - A0's CPU slot 13:30-13:40, guarded, give up 14:30
D="C:/Users/denis/AppData/Local/Temp/claude/D--Dev-DeGaRoR-github-io--claude-worktrees-upbeat-williams-52587e/7cac7812-f729-4524-a80f-a6f828a982ef/scratchpad/dw"
L=D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
F=D:/Dev/DeGaRoR.github.io/.claude/worktrees/upbeat-williams-52587e/flyDiy
until [ "$(date +%Y%m%d%H%M)" -ge 202610071330 ]; do sleep 20; done
while S=$(bash $L show | grep -E "CPU_BATTERY|RESERVED"); [ -n "$S" ]; do
  if [ "$(date +%Y%m%d%H%M)" -ge 202610071430 ]; then echo "BUSY, gave up at 14:30: $S"; exit 3; fi; sleep 20; done
left=$(( $(date -d "2026-10-07 14:30" +%s) - $(date +%s) )); [ $left -lt 10 ] && left=10
timeout $left bash $L take cpu DEADWOOD "G1975.2 FRAMECOST + TREES + TREEHIT (13:30-13:40)" || { echo "no cpu lock by 14:30"; exit 4; }
date
cd $F
node tools/_framecost_check.js > $D/g7_framecost.txt 2>&1; echo "FRAMECOST exit $? : $(grep -E 'GATE [A-Z]+: ' $D/g7_framecost.txt | tail -1)"
node tools/_tree_check.js > $D/g7_trees.txt 2>&1; echo "TREES exit $? : $(grep -E 'GATE [A-Z]+: ' $D/g7_trees.txt | tail -1)"
timeout 600 node tools/_treehit_check.js > $D/g7_treehit.txt 2>&1; echo "TREEHIT exit $? : $(grep -E 'GATE [A-Z]+: ' $D/g7_treehit.txt | tail -1)"
date
bash $L drop cpu DEADWOOD
grep -E "RED|ALLOW" $D/g7_framecost.txt | head -40
