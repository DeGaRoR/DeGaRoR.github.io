S=${L1_SCRATCH:-/tmp/look1}
VIEWS='[{"key":"cedar","d":28,"h":1.7,"side":"moon","tag":"near"},{"key":"cedar","r0":250,"r1":900,"d":200,"h":35,"side":"moon","tag":"forest"}]'
N='DAY_CLOCK.set({date:"2026-12-24",utc:3*3600,rate:0,cloudCover:0})'
LV='[{"tag":"night","js":"PRE; '$N'","frames":6},{"tag":"blue","js":"DAY_CLOCK.set({date:\"2026-12-24\",utc:1*3600,rate:0,cloudCover:0})","frames":8},{"tag":"golden","js":"DAY_CLOCK.set({date:\"2026-12-23\",utc:23*3600,rate:0,cloudCover:0})","frames":8},{"tag":"noon","js":"DAY_CLOCK.set({date:\"2026-12-24\",utc:21*3600,rate:0,cloudCover:0})","frames":8,"undo":"'$N'"}]'
cd $S
L1_VIEWS="$VIEWS" L1_OUT=$S/run3 L1_VARS="${LV/PRE/TREE_LEAF.tint({light: 0.42*1.38*0.69\})}" timeout 3000 node /home/user/DeGaRoR.github.io/flyDiy/tools/soft_still.js --page dev.html --q l1mip=1 --size 1280x720 --quality 85 --stage $S/stage.js --secs 2900 > $S/run3.log 2>&1
L1_VIEWS="$VIEWS" L1_OUT=$S/run4 L1_VARS="${LV/PRE/1}" timeout 3000 node /home/user/DeGaRoR.github.io/flyDiy/tools/soft_still.js --page dev.html --size 1280x720 --quality 85 --stage $S/stage.js --secs 2900 > $S/run4.log 2>&1
