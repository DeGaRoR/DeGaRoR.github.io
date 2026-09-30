#!/usr/bin/env bash
# lc_build.sh - LOAD-COMPILE's measurement build: tools/build.js, then FLYDIY_BUILD pinned to the landed build's id so
# the landed parked cook (keyed on it, parked.js cookSig) is taken as it will be once the coordinator re-cooks at landing.
# NEVER commit the outputs (built files are the coordinator's).
cd "$(dirname "$0")/../.." && node tools/build.js | tail -1 && id=$(node -e "console.log(require('./src/core/parked_packs.json').build)") \
  && sed -i "s/window.FLYDIY_BUILD='[0-9a-f]*'/window.FLYDIY_BUILD='$id'/" index.html dev.html && grep -o "FLYDIY_BUILD='[0-9a-f]*'" index.html dev.html
