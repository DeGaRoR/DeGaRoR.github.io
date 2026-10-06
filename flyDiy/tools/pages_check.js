#!/usr/bin/env node
// pages_check.js — THE POST-PUSH CHECK (RELEASE-CHECKS G1592, review E8): did the push reach the live site?
// Pages is served by GitHub's LEGACY "deploy from branch" builder (the user's decision, 4 Oct 2026: keep it while it
// works). On 4 Oct it silently started NO run for trains 28-31: every push that updated master together with another
// ref in ONE `git push` started nothing; single-ref pushes did. Nothing told anyone - the site served train 27 for a day.
//
// After a push, this polls two public things, no credentials:
//   - the GitHub API's "pages build and deployment" run for the pushed SHA (GET /repos/:repo/actions/runs?head_sha=)
//   - the live version.json (https://degaror.github.io/flyDiy/version.json, cache-busted) until its build id is the
//     one committed at that SHA (git show SHA:flyDiy/version.json)
// and says which of four things happened. Exit codes (for scripts):
//   0  LIVE      the live version.json carries the SHA's build id
//   1  FAILED    the Pages run for the SHA completed without success
//   2  TIMEOUT   a run started (or no verdict) but the live id did not change within --timeout
//   3  NO RUN    no Pages run started for the SHA within --start-timeout: the recipe to re-trigger is printed
//   4  ERROR     bad arguments, no git / no SHA, the SHA's version.json unreadable
// The unauthenticated API allows 60 requests an hour per IP: the run is polled with If-None-Match (a 304 costs
// nothing), every --interval seconds, slower when X-RateLimit-Remaining runs low, and a 403/429 waits for the reset
// (or gives the API up and keeps watching version.json, which has no limit).
//
// Usage: node tools/pages_check.js [--sha=SHA|REF] [--build=ID] [--timeout=900] [--start-timeout=180] [--interval=20]
//                                  [--once] [--repo=DeGaRoR/DeGaRoR.github.io] [--url=https://.../version.json]
//   --sha     the pushed commit (default origin/master: run it right after `git push`, which updates that ref)
//   --build   the expected build id (default: version.json at --sha)
//   --once    one look, no waiting: 0 when live, 2 otherwise (and the run's state printed)
// In a proxied sandbox Node's fetch needs NODE_USE_ENV_PROXY=1 (and NODE_EXTRA_CA_CERTS); a desktop needs nothing.
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const flag = k => process.argv.includes('--' + k);
const REPO = arg('repo', 'DeGaRoR/DeGaRoR.github.io');
const LIVE = arg('url', 'https://degaror.github.io/flyDiy/version.json');
const TIMEOUT = +arg('timeout', 900) * 1000, START_TIMEOUT = +arg('start-timeout', 180) * 1000;
const INTERVAL = Math.max(5, +arg('interval', 20)) * 1000;
const ONCE = flag('once');
const RUN_NAME = 'pages build and deployment';
const ROOT = path.join(__dirname, '..');

const t0 = Date.now();
const stamp = () => `[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s]`;
const say = m => console.log(`${stamp()} ${m}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const done = (code, m) => { console.log(`PAGES: ${['LIVE', 'FAILED', 'TIMEOUT', 'NO RUN', 'ERROR'][code]}${m ? ' - ' + m : ''}`); process.exit(code); };
const git = a => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }).trim();

let SHA, PREFIX, BUILD = arg('build', null);
try {
  SHA = git(['rev-parse', '--verify', (arg('sha', 'origin/master')) + '^{commit}']);
  PREFIX = git(['rev-parse', '--show-prefix']);
} catch (e) { done(4, `cannot resolve --sha=${arg('sha', 'origin/master')} here (a git checkout, after the push?)`); }
if (!BUILD) {
  try { BUILD = JSON.parse(git(['show', `${SHA}:${PREFIX}version.json`])).build; }
  catch (e) { done(4, `no readable ${PREFIX}version.json at ${SHA.slice(0, 10)} - pass --build=ID`); }
}
if (!/^[0-9a-f]{6,40}$/.test(BUILD || '')) done(4, `the expected build id "${BUILD}" is not one`);

const RECIPE = `
  The legacy builder started no run for ${SHA.slice(0, 10)}. Re-trigger it with an EMPTY commit on master's own tree,
  pushed ALONE (one ref in the push - a push that also moves another branch is the case that started nothing on 4 Oct):

    git fetch origin master
    C=$(git commit-tree "origin/master^{tree}" -p origin/master -m "Pages: re-trigger the deploy (no run started for ${SHA.slice(0, 10)})")
    git push origin "$C:refs/heads/master"

  then run this again for the new commit:  node tools/pages_check.js --sha=$C --build=${BUILD}
  (the tree is unchanged, so the build id is the same; push any other branch in a separate git push)`;

// ---- the API, politely ----
const api = { etag: null, last: null, remaining: null, reset: 0, off: false, wait: 0 };
async function runForSha() {
  if (api.off) return api.last;
  if (Date.now() < api.wait) return api.last;
  const url = `https://api.github.com/repos/${REPO}/actions/runs?head_sha=${SHA}&per_page=20`;
  const h = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'flyDiy-pages-check', 'X-GitHub-Api-Version': '2022-11-28' };
  if (api.etag) h['If-None-Match'] = api.etag;
  let res;
  try { res = await fetch(url, { headers: h }); }
  catch (e) { say(`the API did not answer (${e.cause && e.cause.code || e.message}) - retrying`); api.wait = Date.now() + INTERVAL; return api.last; }
  const hRem = res.headers.get('x-ratelimit-remaining'), hReset = res.headers.get('x-ratelimit-reset');
  api.remaining = hRem == null ? null : +hRem;
  api.reset = hReset == null ? 0 : +hReset * 1000;
  if (res.status === 304) return api.last;
  // a rate limit is a 429, or a 403 with the budget spent or a Retry-After; any other 403 is a refusal, retried below
  if (res.status === 429 || (res.status === 403 && (api.remaining === 0 || res.headers.get('retry-after')))) {
    const until = api.reset || (Date.now() + (+res.headers.get('retry-after') || 60) * 1000);
    if (until - Date.now() > TIMEOUT) { api.off = true; say(`the API is rate-limited until ${new Date(until).toISOString()} - watching version.json alone`); }
    else { api.wait = until + 1000; say(`the API is rate-limited - waiting until ${new Date(until).toISOString()}`); }
    return api.last;
  }
  if (!res.ok) { say(`the API answered ${res.status} - retrying`); api.wait = Date.now() + INTERVAL; return api.last; }
  api.etag = res.headers.get('etag');
  const j = await res.json();
  const runs = (j.workflow_runs || []).filter(r => r.name === RUN_NAME);
  api.last = runs.length ? runs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] : null;
  // spend the hour's budget evenly: under 10 left, poll no faster than the reset allows
  if (api.remaining != null && api.remaining < 10 && api.reset > Date.now())
    api.wait = Date.now() + Math.max(INTERVAL, (api.reset - Date.now()) / Math.max(1, api.remaining));
  return api.last;
}
async function liveBuild() {
  try {
    const res = await fetch(`${LIVE}?pages_check=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'flyDiy-pages-check' } });
    if (!res.ok) return { err: `HTTP ${res.status}` };
    const j = await res.json();
    return { build: j.build, date: j.date };
  } catch (e) { return { err: e.cause && e.cause.code || e.message }; }
}

(async () => {
  say(`${REPO} ${SHA.slice(0, 10)}: waiting for build ${BUILD} at ${LIVE}`);
  let seenRun = null, lastState = '', liveWas = '';
  for (;;) {
    const [run, live] = await Promise.all([runForSha(), liveBuild()]);
    const liveTxt = live.err ? `unreachable (${live.err})` : `${live.build} (${live.date || 'no date'})`;
    if (liveTxt !== liveWas) { say(`live version.json: ${liveTxt}`); liveWas = liveTxt; }
    if (run) {
      seenRun = run;
      const st = `${run.status}${run.conclusion ? '/' + run.conclusion : ''}`;
      if (st !== lastState) { say(`run #${run.run_number} "${RUN_NAME}" (${run.event}): ${st} - ${run.html_url}`); lastState = st; }
    }
    if (!live.err && live.build === BUILD) done(0, `${LIVE} serves ${BUILD} (${SHA.slice(0, 10)})${seenRun ? ', run #' + seenRun.run_number : ''}`);
    if (seenRun && seenRun.status === 'completed' && seenRun.conclusion && seenRun.conclusion !== 'success')
      done(1, `run #${seenRun.run_number} ended ${seenRun.conclusion}: ${seenRun.html_url} - the site still serves ${live.build || '?'}`);
    if (ONCE) {
      if (!seenRun && !api.off) console.log(`  no "${RUN_NAME}" run for ${SHA.slice(0, 10)} (yet)`);
      done(2, live.err ? `the site is unreachable from here (${live.err})` : `the site serves ${live.build}, not ${BUILD}`);
    }
    const age = Date.now() - t0;
    if (!seenRun && !api.off && age > START_TIMEOUT) { console.log(RECIPE); done(3, `no "${RUN_NAME}" run started for ${SHA.slice(0, 10)} in ${Math.round(START_TIMEOUT / 1000)} s`); }
    if (age > TIMEOUT) done(2, `${Math.round(TIMEOUT / 1000)} s and the site ${live.err ? `is unreachable from here (${live.err})` : `still serves ${live.build}`}${seenRun ? ` (run #${seenRun.run_number}: ${lastState})` : ''}`);
    await sleep(INTERVAL);
  }
})().catch(e => done(4, e.stack || String(e)));
