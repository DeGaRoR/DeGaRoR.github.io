#!/bin/bash
# AFT-BULKHEAD-LOOK: one page per build per set (G3358: the flood comes on for the first load of a name in a page - each
# build here is the first and only load of its page, as a player sees it). Run from the scratch tree's flyDiy/.
# usage: run_stills.sh <scratch> <build> <set>
S=$1; b=$2; set=$3
if [ "$set" = day ]; then
  V='bk:out/0/0/3,bk:out/30/0/3,bk:out/-30/0/3,bk:infwd,bk:inclose/0.6'; X=''
else
  V='bk:out/0/0/3,bk:infwd'; X='--qs idle=0&day=dusk --dim 0.12'
fi
mkdir -p $S/out/$set
if [ "$set" = day ]; then
  timeout 3000 node tools/plane_shot_bk.js --build $S/b/$set/$b.json --out $S/out/$set --size 1800x1000 --qs idle=0 --views "$V" > $S/out/$set/$b.log 2>&1
else
  timeout 3000 node tools/plane_shot_bk.js --build $S/b/$set/$b.json --out $S/out/$set --size 1800x1000 --qs 'idle=0&day=dusk' --dim 0.12 --views "$V" > $S/out/$set/$b.log 2>&1
fi
echo "$b $set exit $?"
