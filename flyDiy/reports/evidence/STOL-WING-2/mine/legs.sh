# legs.sh OUTDIR : the mine departure (expert, student), HOME->mine (expert, student) for the showcase; the stock Cub; stock+915
S=/tmp/claude-0/-home-user-DeGaRoR-github-io/3a55678d-42d1-56ae-b636-a49470347b13/scratchpad; O=$1
cd /home/user/DeGaRoR.github.io/flyDiy
J="tools/fixtures/stol_cub_showcase.json|showcase builds/cub_2026-09-20_corrected.json|cub $S/mine/eng/stockcub_915.json|cub915"
for jb in $J; do b=${jb%|*}; n=${jb#*|}; for p in expert student; do
  echo "$b --world jolene --from mn_strip --profile $p --max 400 > $O/${n}_mine_$p.log"
  echo "$b --world jolene --to mn_strip --profile $p --max 900 > $O/${n}_home2mine_$p.log"
done; done | while read l; do echo "$l"; done | xargs -P 4 -I{} sh -c "timeout 1200 node --max-old-space-size=4096 tools/pilot_trace.js {}"
echo ALLDONE > $O/done.txt
