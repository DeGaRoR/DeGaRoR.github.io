#!/bin/bash
# flyposes.sh <root> <strip> <to> <sg> <dEnd list> -> one line per build x pose
S=/tmp/claude-0/-home-user-DeGaRoR-github-io/1500f37d-1869-5e7e-8d99-3e6e30b84278/scratchpad
R=$1; id=$2; to=$3; sg=$4; shift 4
for d in "$@"; do
 P=$(cd /home/user/DeGaRoR.github.io/flyDiy && node -e "
 const IN=require('./tools/island_node.js');const fs=require('fs');const W=IN.islandWorld('jolene',{premises:fs.readFileSync('tools/fixtures/island_jolene.json','utf8')});
 const a=W.aerodromes.find(q=>q.id==='$id');const ux=Math.cos(a.hdg),uz=Math.sin(a.hdg),s=$sg*(a.len/2-$d);console.log((a.x+ux*s).toFixed(2),(a.z+uz*s).toFixed(2),Math.atan2($sg*uz,$sg*ux).toFixed(4));" 2>/dev/null)
 set -- $P "$@"; X=$1; Z=$2; N=$3; shift 3
 for b in builds/cub_2026-09-20_corrected.json builds/jodel_2026-09-20_corrected.json "bugReports/cessnaMetal (1).json"; do
  out=$(ROOT_T=$R/flyDiy/tools node --max-old-space-size=2048 $S/s/leg2.js --t 150 --from $id --to $to --x $X --z $Z --nose $N --build "$R/flyDiy/$b" 2>&1 | grep -v "^path\|^\[" | tr '\n' ' ')
  echo "$id d$d $(basename "$b" .json): $out" | cut -c1-420
 done
done
