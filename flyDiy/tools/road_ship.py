# ROAD SHIP (G2956): one road of the user's saved scenery into the shipped fixture, as saved - nothing else of the save.
#   python tools/road_ship.py SAVE.json ROAD_ID [tools/fixtures/island_jolene.json]
# The road's entry is copied as the save holds it (its points and handles, width, class, grade, falloff, curve, traffic,
# clearing - every field), appended after the fixture's roads (the save's order: graded last, it lays nothing under the
# others' ground but its own corridor); a road of that id already there is refused. Beside it, tools/fixtures/
# scenery_user_<id>_<save tag>.json keeps the entry with the save's sha256 - GATE SCENERYED holds the shipped road equal
# to it, bit for bit. The fixture is dumped as it was read (indent 1, '\n': every other byte kept).
import hashlib, json, os, sys

save_p, rid = sys.argv[1], sys.argv[2]
rec_p = sys.argv[3] if len(sys.argv) > 3 else 'tools/fixtures/island_jolene.json'
raw = open(save_p, 'rb').read()
sha = hashlib.sha256(raw).hexdigest()
save = json.loads(raw)
SL = (save.get('premises') or save)['layers']
road = next((r for r in SL['roads'] if r.get('id') == rid), None)
if road is None:
    sys.exit('road_ship: no road ' + rid + ' in ' + save_p)
src = open(rec_p, encoding='utf-8', newline='').read()
rec = json.loads(src)
if json.dumps(rec, indent=1) + '\n' != src:
    sys.exit('road_ship: ' + rec_p + ' does not round-trip as indent-1 JSON - not touched')
L = rec['premises']['layers'] if 'premises' in rec else rec['layers']
if any(r.get('id') == rid for r in L['roads']):
    sys.exit('road_ship: ' + rec_p + ' has a road ' + rid + ' already - not touched')
for k in L:
    if isinstance(L[k], list) and any(isinstance(e, dict) and e.get('id') == rid for e in L[k]):
        sys.exit('road_ship: the id ' + rid + ' is taken in layer ' + k)
L['roads'].append(json.loads(json.dumps(road)))
open(rec_p, 'w', encoding='utf-8', newline='').write(json.dumps(rec, indent=1) + '\n')
tag = os.path.splitext(os.path.basename(save_p))[0]
keep_p = os.path.join(os.path.dirname(rec_p), 'scenery_user_' + rid + '_' + ('rev24' if 'rev24' in tag else tag) + '.json')
open(keep_p, 'w', encoding='utf-8', newline='').write(json.dumps({ 'what': 'a road of the user\'s saved scenery, shipped (tools/road_ship.py)', 'save': os.path.basename(save_p), 'sha256': sha, 'road': road }, indent=1) + '\n')
print('road_ship: %s (%d points) -> %s; kept in %s (save sha256 %s)' % (rid, len(road.get('pts') or []), rec_p, keep_p, sha[:16]))
