#!/usr/bin/env node
// THE BELLY POD, SEEN (G2418): a still per validated build - the built lattice (def.beams as lines) with the pod's
// generated shell (60d_gen_pod genPodShell) under it, side-on and three-quarter, the ground line and the three-point /
// tail-strike / water line the clearance is measured against. Headless Chromium (SwiftShader) and vendor/three.min.js;
// reports/evidence/POD/still_<build>.png. Evidence only: the drawn pod in the cage / flown visual is not wired (HANDOVER).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const L = require(path.join(T, '_treecrash_lib.js'));
const C = L.core();
const { chromium } = require(process.env.PLAYWRIGHT_PATH || (() => { try { return require.resolve('playwright'); } catch (e) { return '/opt/node22/lib/node_modules/playwright'; } })());
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', c172: 'builds/cessna172_2026-09-20_corrected.json',
                 floats: 'bugReports/cessnaFloatsWOrks.json' };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  for (const k in BUILDS) {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, BUILDS[k]), 'utf8')), sp = j.spec || j;
    sp.pod = { on: 1 };
    const def = C.buildGen(C.genMigrateSpec(sp)), R = def.parts.pod, M = C.genPodShell(R, 20);
    const sh = C.genShakedown(def, { corners: false, slim: true }), cl = sh.pod.clearance;
    const S = def.spec, ground = S.gear.y - S.gear.contactR;
    const lines = [];
    for (const b of def.beams) { const a = def.nodes[b.a].p, c = def.nodes[b.b].p; lines.push(a[0], a[1], a[2], c[0], c[1], c[2]); }
    const att = cl.rows.map(r => ({ deg: r.deg, clear: r.clear, name: r.name, water: r.id === 'water', y0: r.id === 'water' ? def.parts.floats[0].pos[1] + r.draft : ground, x0: r.id === 'water' ? 0 : def.parts.gx }));
    const data = { lines, pos: Array.from(M.pos), idx: Array.from(M.idx), att, title: k + ': pod ' + R.len.toFixed(2) + ' x ' + (2 * R.hw).toFixed(2) + ' x ' + R.depth.toFixed(2) + ' m - ' + cl.rows.map(r => r.name + ' ' + r.clear.toFixed(3) + ' m').join(' | ') };
    const page = await br.newPage({ viewport: { width: 1400, height: 800 } });
    await page.setContent('<html><body style="margin:0;background:#e9e4d8;font:16px sans-serif"><div id=t style="position:absolute;left:12px;top:8px"></div></body></html>');
    await page.addScriptTag({ path: path.join(ROOT, 'vendor', 'three.min.js') });
    await page.evaluate(D => {
      document.getElementById('t').textContent = D.title;
      const W = 1400, H = 800, r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      r.setSize(W, H); r.setClearColor(0xe9e4d8); document.body.appendChild(r.domElement);
      const draw = (vx, vy, vw, vh, cam, th, att) => {
        const sc = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.1)); const dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(2, 5, 4); sc.add(dl);
        const root = new THREE.Group(); root.rotation.z = th; sc.add(root);
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(D.lines, 3));
        root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x33415c })));
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(D.pos, 3)); g.setIndex(D.idx); g.computeVertexNormals();
        root.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xd8a23a, roughness: 0.6, side: THREE.DoubleSide })));
        if (att) {   // the ground / water line (the aeroplane already rotated about the contact, below)
          const gl = new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.Float32BufferAttribute([-3, att.y0, 0, 10, att.y0, 0], 3));
          sc.add(new THREE.Line(gl, new THREE.LineBasicMaterial({ color: att.water ? 0x2a6fb5 : 0x5a3d1e })));
        }
        r.setViewport(vx, vy, vw, vh); r.setScissor(vx, vy, vw, vh); r.setScissorTest(true); r.render(sc, cam);
      };
      const side = new THREE.OrthographicCamera(-1.2, 7.4, 1.88, -0.95, -50, 50); side.position.set(0, 0, 10); side.lookAt(0, 0, 0);
      const a = D.att[D.att.length - 1];
      // the attitude: every point rotated tail-down by the attitude's angle about the contact (the clearance's own
      // transform: h = (y - y0) cos - (x - x0) sin)
      const rot = arr => { const o = arr.slice(), c = Math.cos(a.deg * Math.PI / 180), s = Math.sin(a.deg * Math.PI / 180);
        for (let i = 0; i < o.length; i += 3) { const dx = arr[i] - a.x0, dy = arr[i + 1] - a.y0;
          o[i] = a.x0 + dx * c + dy * s; o[i + 1] = a.y0 + dy * c - dx * s; } return o; };
      const L0 = D.lines, P0 = D.pos;
      D.lines = rot(L0); D.pos = rot(P0);
      draw(0, 340, 1400, 460, side, 0, a);
      D.lines = L0; D.pos = P0;
      const q = new THREE.PerspectiveCamera(30, 1400 / 340, 0.1, 100); q.position.set(3.5, -2.6, 5.5); q.lookAt(1.4, -0.3, 0);
      draw(0, 0, 1400, 340, q, 0, null);
    }, data);
    await page.screenshot({ path: path.join(ROOT, 'reports/evidence/POD/still_' + k + '.png') });
    await page.close();
    console.log(k + ' ' + data.title);
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
