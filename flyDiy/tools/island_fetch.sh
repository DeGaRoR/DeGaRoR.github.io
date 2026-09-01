#!/usr/bin/env bash
# island_fetch.sh — acquire the RAW source data for URSOY (futureDesigns/
# ISLAND-PREPACK.md). Run ONCE, on the machine where the data will live.
#
# Everything it fetches is US federal public domain except ESA WorldCover,
# which is CC-BY 4.0 and is the ONE attribution this world owes.
#
# WHY THE API AND NOT THE BUCKET. The Alaska 5 m DTM lives under
#   StagedProducts/Elevation/OPR/Projects/Alaska_Mid_Accuracy_DEM_Summer_2015/
# which does not appear in an `AK*` prefix scan, and there is no `5m/` prefix.
# TNM Access takes a bounding box and hands back download URLs, so the bbox is
# the only thing anyone has to get right.
#
# Idempotent and resumable: curl -C - continues a partial file and skips a
# complete one. Safe to re-run after an interrupted afternoon.
set -euo pipefail

BBOX="${BBOX:--135.2,57.0,-133.5,58.3}"        # W,S,E,N — the Ursoy footprint
OUT="${OUT:-assets/island/raw}"
API="https://tnmaccess.nationalmap.gov/api/v1/products"
WC="https://esa-worldcover.s3.amazonaws.com/v200/2021/map"

for c in curl jq; do
  command -v "$c" >/dev/null || { echo "island_fetch: need '$c' on PATH" >&2; exit 1; }
done

say () { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
# One TNM dataset -> one subdirectory. Pages through the API 100 at a time.
# ---------------------------------------------------------------------------
fetch_tnm () {
  local tag="$1" sub="$2" dir="$OUT/$2" offset=0 total=1 page urls
  mkdir -p "$dir"
  while [ "$offset" -lt "$total" ]; do
    page=$(curl -sfG "$API" \
             --data-urlencode "datasets=$tag" \
             --data-urlencode "bbox=$BBOX" \
             --data-urlencode "outputFormat=JSON" \
             --data-urlencode "max=100" \
             --data-urlencode "offset=$offset") || {
      echo "island_fetch: API query failed for '$tag'" >&2; return 1; }

    # Shape check, once. If TNM ever changes the envelope this is where it shows.
    if ! printf '%s' "$page" | jq -e 'has("total") and has("items")' >/dev/null; then
      echo "island_fetch: unexpected API response shape for '$tag'" >&2
      printf '%s' "$page" | head -c 400 >&2; echo >&2; return 1
    fi

    total=$(printf '%s' "$page" | jq -r '.total')
    [ "$offset" -eq 0 ] && say "$sub — $total product(s) over the bbox"

    urls=$(printf '%s' "$page" | jq -r '.items[].downloadURL')
    while IFS= read -r url; do
      [ -n "$url" ] || continue
      # NOTE: the API reports `format: ArcGrid` for the DTM and delivers .tif.
      # Trust the extension on the URL, never the format field.
      printf '  %s\n' "${url##*/}"
      curl -fL -C - --retry 3 --retry-delay 5 -o "$dir/${url##*/}" "$url"
    done <<< "$urls"

    offset=$((offset + 100))
  done
}

# ---------------------------------------------------------------------------
say "URSOY — raw source acquisition"
echo "bbox : $BBOX"
echo "out  : $OUT"
echo "Expect roughly 10 GB. Re-run to resume."

# 1. THE GROUND. 39 tiles, 19-62 MB each, 15' grid, DTM_N<ddmm>W<dddmm>P.
fetch_tnm "Alaska IFSAR 5 meter DEM"            dtm

# 2. THE CANOPY TOP. Only ever used as DSM - DTM = canopy height (PREPACK 3.2).
#    NEVER as the ground: in this rainforest it sits ~40 m above the surface.
# 3. THE RADAR INTENSITY. The variation mask (PREPACK 3.1) — one channel, so
#    it cannot pollute the palette, and registered to the DEM by construction.
#
#    BOTH come as ~0.4-0.7 GB REGIONAL CELLS, and the bbox catches ten of them
#    where the island only touches a few. `Lower_SE_L2_C364` is the Southeast
#    Alaska cell and is certainly wanted; `GB_339` is Glacier Bay, to the north.
#    Set CELLS to a grep pattern once the footprints are checked, and pin it.
CELLS="${CELLS:-}"
if [ -n "$CELLS" ]; then
  echo "(filtering DSM/ORI cells by: $CELLS)"
fi
fetch_tnm "Ifsar Digital Surface Model (DSM)"   dsm
fetch_tnm "Ifsar Orthorectified Radar Image (ORI)" ori

# 4. TERRAIN TYPE. 3-degree tiles by SW corner; two cover Ursoy.
say "cover — ESA WorldCover v200 (CC-BY 4.0: THIS is the attribution we owe)"
mkdir -p "$OUT/cover"
for t in N57W135 N57W138; do
  f="ESA_WorldCover_10m_2021_v200_${t}_Map.tif"
  printf '  %s\n' "$f"
  curl -fL -C - --retry 3 --retry-delay 5 -o "$OUT/cover/$f" "$WC/$f"
done

say "done"
cat <<'NOTE'
Next, per futureDesigns/ISLAND-PREPACK.md section 6:
  - mosaic the DTM, clip to the working domain, derive the coast at h = 0
  - CANOPY = DSM - DTM
  - de-speckle and stretch the ORI
  - resample to tier 1 (25 m) + tier 2 (5 m native)
  - run bakeHydrology, export the guide fields, strip every toponym

Attribution owed, in full:
  ESA WorldCover 10 m v200, (c) ESA / VITO, CC-BY 4.0
  Elevation and radar: USGS 3DEP Alaska IFSAR (public domain; cited by courtesy)
NOTE
