S=${L1_SCRATCH:-/tmp/look1}
cd $S
NI='DAY_CLOCK.set({date:\"2026-12-24\",utc:3*3600,rate:0,cloudCover:0})'
BL='DAY_CLOCK.set({date:\"2026-12-24\",utc:1*3600,rate:0,cloudCover:0})'
KOFF='WORLD.scene.traverse(l => { if (l.isDirectionalLight) { l.userData.__i = l.intensity; l.intensity = 0; } })'
KON='WORLD.scene.traverse(l => { if (l.isDirectionalLight && l.userData.__i !== undefined) l.intensity = l.userData.__i; })'
HOFF='WORLD.scene.traverse(l => { if (l.isHemisphereLight) { l.userData.__i = l.intensity; l.intensity = 0; } })'
HON='WORLD.scene.traverse(l => { if (l.isHemisphereLight && l.userData.__i !== undefined) l.intensity = l.userData.__i; })'
VARS='[{"tag":"night_base","js":"'$NI'","frames":6},
 {"tag":"night_nokey","js":"'$KOFF'","undo":"'$KON'"},
 {"tag":"night_nohemi","js":"'$HOFF'","undo":"'$HON'"},
 {"tag":"night_noenv","js":"window.__env = WORLD.scene.environment; WORLD.scene.environment = null","undo":"WORLD.scene.environment = window.__env"},
 {"tag":"blue_base","js":"'$BL'","frames":8},
 {"tag":"blue_nokey","js":"'$KOFF'","undo":"'$KON'"},
 {"tag":"blue_nohemi","js":"'$HOFF'","undo":"'$HON'"},
 {"tag":"blue_noleaf","js":"TREE_LEAF.uniforms.uWrap.value=0; TREE_LEAF.uniforms.uSSS.value=0","undo":"TREE_LEAF.uniforms.uWrap.value=0.8; TREE_LEAF.uniforms.uSSS.value=1.12"}]'
VARS=$(echo "$VARS" | tr '\n' ' ')
if [ "$1" = "--print" ]; then printf '%s' "$VARS"; exit 0; fi
L1_VIEWS='[{"key":"cedar","d":28,"h":1.7,"side":"moon","tag":"near"}]' L1_OUT=$S/run5 L1_VARS="$VARS" timeout 3000 node /home/user/DeGaRoR.github.io/flyDiy/tools/soft_still.js --page dev.html --size 1280x720 --quality 85 --stage $S/stage5.js --secs 2900 > $S/run5.log 2>&1
