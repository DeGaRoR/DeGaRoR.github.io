const { chromium } = require('playwright');
(async () => {
  const [html, png, tgt, dist, yaw, pitch, w, h, dpr] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: +(w || 1400), height: +(h || 900) }, deviceScaleFactor: +(dpr || 1) });
  await pg.goto('file://' + html);
  await pg.waitForFunction(() => window.__qvReady === true || typeof window.__qvError === 'string', null, { timeout: 180000 });
  const info = await pg.evaluate(([t, d, y, p]) => { const q = window.__qv; if (t) q.cam.tgt = JSON.parse(t); if (d) q.cam.dist = +d; if (y) q.cam.yaw = +y; if (p) q.cam.pitch = +p; q.draw();
    return JSON.stringify({ cam: q.cam, err: window.__qvError || null }); }, [tgt, dist, yaw, pitch]);
  // hide any UI chrome for a clean picture
  await pg.addStyleTag({ content: 'body > *:not(canvas) { display: none !important; }' }).catch(() => {});
  await pg.evaluate(() => window.__qv.draw());
  await pg.screenshot({ path: png }); console.log(info); await b.close();
})();
