// RETRACT-ROBUST: run a case file (name|src|overJSON per line) through rr_probe.js, N at a time
//   node reports/evidence/RETRACT-ROBUST/tools/rr_run.js <cases.txt> <outdir> [jobs] [--game]
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const [CASES, OUTD, J] = process.argv.slice(2); const JOBS = +(J || 4), GAME = process.argv.includes('--game');
fs.mkdirSync(OUTD, { recursive: true });
const lines = fs.readFileSync(CASES, 'utf8').trim().split('\n').filter(Boolean);
let i = 0, live = 0, done = 0;
const next = () => { while (live < JOBS && i < lines.length) { const [n, s, o] = lines[i++].split('|'); live++;
  const args = [path.join(__dirname, 'rr_probe.js'), s, o, '--quiet', '--json', path.join(OUTD, n + '.json')].concat(GAME ? [] : ['--nogame']);
  const p = spawn(process.execPath, args, { cwd: path.join(__dirname, '..', '..', '..', '..') }); let log = '';
  p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
  p.on('close', c => { fs.writeFileSync(path.join(OUTD, n + '.log'), log); live--; done++; if (c) console.log('exit ' + c + ' ' + n); if (done === lines.length) console.log('done ' + done); next(); }); } };
next();
