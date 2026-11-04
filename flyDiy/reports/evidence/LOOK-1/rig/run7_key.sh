S=${L1_SCRATCH:-/tmp/look1}
cd $S
NI='DAY_CLOCK.set({date:\"2026-12-24\",utc:3*3600,rate:0,cloudCover:0})'
K='window.__k = null; WORLD.scene.traverse(l => { if (l.isDirectionalLight && l.visible && (!window.__k || l.intensity > window.__k.intensity)) window.__k = l; });'
KZ=$K' Object.defineProperty(window.__k, \"intensity\", { configurable: true, get() { return 0; }, set(v) {} })'
KZU='delete window.__k.intensity; window.__k.intensity = 0.3'
H='window.__h = null; WORLD.scene.traverse(l => { if (l.isHemisphereLight && l.visible) window.__h = l; });'
GS=$H' window.__h.groundColor.copy(window.__h.color); window.__h.groundColor.setRGB = function () { return this; }'
GSU='delete window.__h.groundColor.setRGB'
EO='window.__env = window.__env || WORLD.scene.environment; WORLD.scene.environment = null'
VARS='[{"tag":"n_noenv","js":"'$NI'; '$EO'","frames":6},
 {"tag":"n_noenv_nokey","js":"'$KZ'","undo":"'$KZU'"},
 {"tag":"n_noenv_gndsky","js":"'$GS'","undo":"'$GSU'"},
 {"tag":"n_noenv_flat","js":"'$KZ'; '$GS'","undo":"'$KZU'; '$GSU'"}]'
VARS=$(echo "$VARS" | tr '\n' ' ')
if [ "$1" = "--print" ]; then printf '%s' "$VARS"; exit 0; fi
L1_VIEWS='[{"key":"cedar","d":28,"h":1.7,"side":"moon","tag":"near"},{"key":"cedar","r0":250,"r1":900,"d":200,"h":35,"side":"moon","tag":"forest"}]' L1_OUT=$S/run7 L1_VARS="$VARS" timeout 3000 node /home/user/DeGaRoR.github.io/flyDiy/tools/soft_still.js --page dev.html --size 1280x720 --quality 85 --stage $S/stage5.js --secs 2900 > $S/run7.log 2>&1
