#!/usr/bin/env bash
D="C:/Users/denis/AppData/Local/Temp/claude/D--Dev-DeGaRoR-github-io--claude-worktrees-upbeat-williams-52587e/7cac7812-f729-4524-a80f-a6f828a982ef/scratchpad"
until [ "$(date +%H%M)" -ge 1320 ] && [ "$(date +%H)" = "13" ]; do sleep 20; done
date; bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh show
B=D:/Dev/DeGaRoR.github.io/.claude/worktrees/upbeat-williams-52587e/flyDiy; M=$D/mastertree/flyDiy
cd $B
for g in _gfx_check.js _tree_check.js test_tree.js _program_check.js; do node tools/$g > $D/dw/g_$g.txt 2>&1; echo "$g exit $? : $(grep -E 'GATE [A-Z]+: ' $D/dw/g_$g.txt | tail -1)"; done
( cd $B && node --max-old-space-size=6144 --expose-gc tools/_framecost_check.js --census cub > $D/dw/census2_branch.txt 2> $D/dw/census2_branch.err ); echo "branch census exit $?"; date
( cd $M && node --max-old-space-size=6144 --expose-gc tools/_framecost_check.js --census cub > $D/dw/census2_master.txt 2> $D/dw/census2_master.err ); echo "master census exit $?"; date
cd $B && node tools/_framecost_check.js --compare $D/dw/census2_master.txt $D/dw/census2_branch.txt | head -40
