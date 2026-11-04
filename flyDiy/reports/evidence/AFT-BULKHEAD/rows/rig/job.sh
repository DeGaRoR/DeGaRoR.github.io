#!/bin/bash
# AFT-BULKHEAD-SHOTS: one page per build per set (the first and only load of its page, as the study). Resumable: a view
# whose PNG is already there is skipped. usage: job.sh <build_SET> <day|dusk|flip> <views>
S=/tmp/claude-0/-home-user-DeGaRoR-github-io/f139d437-d867-54e1-8325-c9cc34e82a6c/scratchpad; b=$1; set=$2; V=$3
cd $S/tree/flyDiy; mkdir -p $S/out/$set
L=''; for v in ${V//,/ }; do n=$(echo "$v" | tr ':/' '--'); if [[ $v == rows:* ]] || [ ! -f $S/out/$set/${b}_$n.png ]; then L="$L,$v"; fi; done; L=${L#,}
if [ -z "$L" ] || [ "$L" = "${L//bk:/}" ]; then echo "$(date +%H:%M:%S) $b $set skip (all there)" >> $S/out/jobs.done; exit 0; fi
if [ "$set" = dusk ]; then QS='idle=0&day=dusk'; DIM='--dim 0.12'; else QS='idle=0'; DIM=''; fi
echo "=== $(date) views $L" >> $S/out/$set/$b.log
timeout 3000 node tools/plane_shot_bk.js --build $S/b/$b.json --out $S/out/$set --size 1800x1000 --qs "$QS" $DIM --views "$L" >> $S/out/$set/$b.log 2>&1
echo "$(date +%H:%M:%S) $b $set exit $?" >> $S/out/jobs.done
