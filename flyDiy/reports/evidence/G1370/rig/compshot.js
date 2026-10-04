const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [port, tag] of [[8601, 'before'], [8602, 'after']]) {
    const p = await b.newPage({ viewport: { width: 1920, height: 760 } });
    p.on('pageerror', e => console.log(tag, 'PAGEERR', e.message.slice(0, 200)));
    await p.goto(`http://127.0.0.1:${port}/flyDiy/_comp/index.html?${tag === 'before' ? 'BEFORE (master 5502f45)' : 'AFTER (claude/ui-layer-g1370)'}`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.DONE, null, { timeout: 120000 });
    await p.waitForTimeout(500);
    const cdp = await p.context().newCDPSession(p);
    const s = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
    require('fs').writeFileSync(`/tmp/claude-0/ev/shots2/ribbons_${tag}.jpg`, Buffer.from(s.data, 'base64'));
    console.log(tag, 'ok', (await p.evaluate(() => [...document.querySelectorAll('.l')].map(d => d.textContent.split(' - ').slice(-1)[0]).join(' | '))));
  }
  await b.close();
})();
