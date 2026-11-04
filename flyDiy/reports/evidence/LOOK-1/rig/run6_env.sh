S=${L1_SCRATCH:-/tmp/look1}
cd $S
NI='DAY_CLOCK.set({date:\"2026-12-24\",utc:3*3600,rate:0,cloudCover:0})'
BL='DAY_CLOCK.set({date:\"2026-12-24\",utc:1*3600,rate:0,cloudCover:0})'
K='WORLD.scene.traverse(l => { if (l.isDirectionalLight) window.__k = l; });'
KZ=$K' Object.defineProperty(window.__k, \"intensity\", { configurable: true, get() { return 0; }, set(v) {} })'
KZU='delete window.__k.intensity; window.__k.intensity = 0.3'
EO='window.__env = window.__env || WORLD.scene.environment; WORLD.scene.environment = null'
EU='WORLD.scene.environment = window.__env'
KN=$K' window.__k.color.setRGB(0.80, 0.90, 1.0); window.__k.color.setRGB = function () { return this; }'
KNU='delete window.__k.color.setRGB'
VARS='[{"tag":"night_base","js":"'$NI'","frames":6},
 {"tag":"night_noenv","js":"'$EO'","undo":"'$EU'"},
 {"tag":"night_nokey","js":"'$KZ'","undo":"'$KZU'"},
 {"tag":"night_hemionly","js":"'$KZ'; '$EO'","undo":"'$KZU'; '$EU'"},
 {"tag":"night_keyneutral","js":"'$KN'","undo":"'$KNU'"},
 {"tag":"night_keyneutral_noenv","js":"'$KN'; '$EO'","undo":"'$KNU'; '$EU'"},
 {"tag":"blue_base","js":"'$BL'","frames":8},
 {"tag":"blue_noenv","js":"'$EO'","undo":"'$EU'"}]'
VARS=$(echo "$VARS" | tr '\n' ' ')
if [ "$1" = "--print" ]; then printf '%s' "$VARS"; exit 0; fi
L1_VIEWS='[{"key":"cedar","d":28,"h":1.7,"side":"moon","tag":"near"}]' L1_OUT=$S/run6 L1_VARS="$VARS" timeout 3000 node /home/user/DeGaRoR.github.io/flyDiy/tools/soft_still.js --page dev.html --size 1280x720 --quality 85 --stage $S/stage5.js --secs 2900 > $S/run6.log 2>&1
