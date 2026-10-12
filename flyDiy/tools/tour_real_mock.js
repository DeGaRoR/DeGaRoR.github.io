#!/usr/bin/env node
// tour_real_mock.js - TOUR-REAL (G2065): the page rig's own check without the game - tools/tour_real.js driven against
// tools/tour_real_mock.html, which replays a node tour (tools/tour_real_node.js --out) through the same handles.
// A HEADLESS Chrome with --disable-gpu on a static page (no WebGL): the leg chain through #selDest, the moments and
// their stills, the screencast, the flight log's download, the files written.
//   node tools/tour_real_mock.js --root D:/Dev/wt-tour --node <node_tour.json> [--speed 30] [--port 8779] [--out <dir>] [--legs N]
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const ROOT = path.resolve(opt('root', path.join(__dirname, '..', '..')));
const NODE = path.resolve(opt('node'));
const PORT = +opt('port', 8779);
const OUT = path.resolve(opt('out', path.join(require('os').tmpdir(), 'tour_real_mock_out')));
const T = path.join(ROOT, 'flyDiy', 'tools');
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const N = JSON.parse(fs.readFileSync(NODE, 'utf8'));
const data = Object.assign({}, N, { aerodromes: W.aerodromes.map(a => ({ id: a.id, x: a.x, z: a.z, hdg: a.hdg, len: a.len, wid: a.wid, elev: a.elev, water: !!a.water })) });
const body = JSON.stringify(data);
const html = fs.readFileSync(path.join(__dirname, 'tour_real_mock.html'));
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/data.json')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end(body); return; }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(html);
}).listen(PORT, () => {
  const a = [path.join(__dirname, 'tour_real.js'), '--root', ROOT, '--headless', '--url', 'http://127.0.0.1:' + PORT + '/mock.html?data=/data.json&speed=' + opt('speed', '30'),
    '--order', N.order.join(','), '--out', OUT, '--rate', '2'].concat(opt('legs', null) ? ['--legs', opt('legs')] : []);
  const p = spawn(process.execPath, a, { stdio: 'inherit' });
  p.on('exit', c => { srv.close(); console.log('tour_real_mock: the rig exited ' + c + ' - ' + OUT); process.exit(c); });
});
