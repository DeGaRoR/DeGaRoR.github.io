#!/usr/bin/env bash
cd "$(dirname "$0")"
until [ "$(date +%Y%m%d%H%M)" -ge 202610081340 ]; do sleep 20; done
date; PHASE=12 bash run8.sh > log8_run.txt 2>&1; echo "run8 exit $?"; tail -8 log8_run.txt
