const { chromium } = require('playwright');
(async () => {
  const [key, out] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 2600 }, deviceScaleFactor: 1.5 });
  await p.goto('http://127.0.0.1:8791/index.html', { waitUntil: 'load', timeout: 180000 });
  await p.waitForFunction(() => window.FICHE_BOARD && window.FICHE_PHYSICS, null, { timeout: 120000 });
  await p.evaluate(() => { const bt = document.getElementById('boot'); if (bt) bt.remove(); return window.FICHE_PHYSICS.refsLoad(); });
  // the board as tall as its page (the Mass page scrolls in a normal window)
  await p.addStyleTag({ content: '#pfBoard{max-height:none!important;height:auto!important;top:10px!important} #pfBoard .pfBody{max-height:none!important;overflow:visible!important}' });
  await p.evaluate(k => window.FICHE_BOARD.show(k), key);
  await p.waitForSelector('#pfBoard .pfTabs button', { timeout: 60000 });
  const tabs = await p.$$eval('#pfBoard .pfTabs button', bs => bs.map(x => x.textContent));
  const res = [];
  for (const lab of tabs) {
    await p.evaluate(l => [...document.querySelectorAll('#pfBoard .pfTabs button')].find(x => x.textContent === l).click(), lab);
    await p.waitForTimeout(lab === 'Main' || lab === 'Cutaway' ? 3000 : 1500);
    try { await p.waitForFunction(() => !/Working out/.test(document.querySelector('#pfBoard .pfSheet').textContent), null, { timeout: 120000 }); } catch (e) {}
    await p.waitForTimeout(800);
    const f = out + '/' + key.replace(/\W/g, '_') + '_' + lab + '.jpg';
    await (await p.$('#pfBoard .pfSheet')).screenshot({ path: f, type: 'jpeg', quality: 86 });
    res.push([lab, f]);
  }
  console.log(JSON.stringify(res));
  await b.close();
})().catch(e => { console.log('FAIL', e.message.slice(0, 300)); process.exit(1); });
