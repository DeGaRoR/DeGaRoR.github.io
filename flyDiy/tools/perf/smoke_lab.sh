#!/bin/bash
# smoke_lab.sh - THREE LOADS OF THE LAB BUILD BEFORE THE SLOT (PERF-LEAD, 22 Nov 2026). Not for numbers: a build five
# branches met in must boot, read its switches, save its logs and depart BEFORE three hours of box are spent on it.
# Start it through A0's wrapper, which waits for PERF-LEAD's turn in the GPU queue and gives the run its one token:
#   bash D:/Dev/flydiy-notes/cpu_token.sh run PERF-LEAD --gpu -- bash tools/perf/smoke_lab.sh [out dir] [minutes, default 13]
# It takes the GPU lock inside (never outside a --gpu run), holds NO extra token (a busy box is allowed), starts a load
# under 92 C, and frees the lock on exit.
OUT=${1:-D:/Dev/flydiy-notes/evidence/perf-slot-2026-11-22/smoke}; MIN=${2:-13}
T="$(cd "$(dirname "$0")/.." && pwd)"; B=/d/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh
cd "$T" || exit 9
bash $B take gpu PERF-LEAD "lab build smoke, 3 loads" || { echo "no gpu lock"; exit 3; }
trap 'bash $B drop gpu PERF-LEAD' EXIT
LM_HELD=1 LM_NOTOK=1 LM_COOL=92 LM_EST=190 LM_BRIEF_ARGS="--steps compile,frames,worldCompile --miss 1" LM_BRIEF_LINES=40 \
  bash tools/perf/load_matrix.sh tools/perf/rows/smoke-lab.txt "$OUT" $MIN
echo "---- briefs"; head -60 "$OUT/briefs.txt" 2>/dev/null
