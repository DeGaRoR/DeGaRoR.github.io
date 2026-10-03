// UI-LAYER evidence: node shoot.js <port> <tag>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const port = process.argv[2], tag = process.argv[3], OUT = '/tmp/claude-0/ev/shots2/';
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.addInitScript(() => { try { localStorage.setItem('flydiy.flPat', JSON.stringify({ graph: true, slope: true, targets: true, map: false })); } catch (e) {} });
  p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 160)));
  const cdp = await p.context().newCDPSession(p);
  const snap = async n => { const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(OUT + tag + '_' + n + '.jpg', Buffer.from(r.data, 'base64')); console.log('  snap', n); };
  const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
  const st = () => p.evaluate(() => ({ cls: document.body.className, go: (document.getElementById('bGo') || {}).textContent,
    acts: (() => { const a = document.getElementById('flActs'); return a ? getComputedStyle(a).display + '/' + [...a.querySelectorAll('button')].filter(x => !x.hidden).map(x => x.textContent).join('|') : null; })(),
    ra: !!(window.ROLLANIM && ROLLANIM.busy && ROLLANIM.busy()) }));
  await p.goto(`http://127.0.0.1:${port}/flyDiy/index.html`, { waitUntil: 'load', timeout: 180000 });
  for (let i = 0; i < 30; i++) { await p.waitForTimeout(3000); const s = await st(); if (/Roll out/.test(s.go || '')) break; }
  await p.waitForTimeout(5000);
  console.log(T(), 'dfClose', await p.evaluate(() => { const x = [...document.querySelectorAll('.dfClose')]; x.forEach(b => b.click()); return x.length; }));
  await p.waitForTimeout(3000);
  console.log(T(), JSON.stringify(await st()));
  await p.evaluate(() => { window.__ev = []; let last = '';
    const tick = () => { const a = document.getElementById('flActs'); const ra = !!(window.ROLLANIM && ROLLANIM.busy && ROLLANIM.busy());
      const k = ra + ' ' + document.body.classList.contains('rollShot') + ' ' + (a ? getComputedStyle(a).display + '/' + [...a.querySelectorAll('button')].filter(x => !x.hidden).map(x => x.textContent).join('|') : '');
      if (k !== last) { last = k; window.__ev.push(Math.round(performance.now()) + ' ' + k); } };
    setInterval(tick, 100);
    document.getElementById('bGo').click(); });
  console.log(T(), 'roll out clicked');
  let n = 0, seenRa = false;
  for (let i = 0; i < 400; i++) {
    await p.waitForTimeout(250);
    const s = await st();
    if (s.ra && !seenRa) { seenRa = true; console.log(T(), 'shot running', JSON.stringify(s)); await p.waitForTimeout(1500); console.log(T(), JSON.stringify(await st())); await snap('rollout'); n++; }
    if (seenRa && !s.ra) { console.log(T(), 'shot over', JSON.stringify(s)); break; }
  }
  console.log(T(), 'trip', await p.evaluate(() => JSON.stringify((window.FLYDIY_TRIPS || []).slice(-1).map(t => ({ kind: t.kind, anim: t.anim, done: t.done })))));
  // the world: wait for the reveal (the verbs back, Pause visible)
  for (let i = 0; i < 120; i++) { await p.waitForTimeout(3000); const s = await st(); if (/Pause/.test(s.acts || '') || /Skip/.test(s.acts || '')) { console.log(T(), 'revealed', JSON.stringify(s)); break; } if (i % 10 === 0) console.log(T(), JSON.stringify(s)); }
  await p.waitForTimeout(8000);
  console.log('EVENTS\n' + (await p.evaluate(() => (window.__ev || []).join('\n'))));
  console.log(T(), 'trip', await p.evaluate(() => JSON.stringify((window.FLYDIY_TRIPS || []).slice(-2).map(t => ({ kind: t.kind, anim: t.anim, done: t.done, ms: t.ms })))));
  // a view from above the stand so the taxi ribbons show
  try { await p.evaluate(() => { const C = window.DEV_CAM || null; return !!C; }); } catch (e) {}
  await snap('stand');
  await p.evaluate(() => document.body.classList.add('rollShot'));
  await p.waitForTimeout(1500);
  console.log(T(), 'with rollShot', JSON.stringify(await st()));
  await snap('verbs_rollShot');
  await p.evaluate(() => document.body.classList.remove('rollShot'));
  console.log(T(), 'done');
  await b.close();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
