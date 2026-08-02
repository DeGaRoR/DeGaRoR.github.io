#!/bin/sh
# Full gate battery. ALL must be green before any delivery.
set -e
python3 build.py >/dev/null   # test_ui_smoke runs the BUILT artifact
for t in test_ui_smoke test_model test_skin test_ctrl test_m3 test_drone test_dc3 test_jodel test_c172 test_chinook test_stress test_tree; do
  echo "=== $t ==="
  node $t.js | tail -3
done
