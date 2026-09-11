const L = require('./_lib'); const D = L.D;
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/facturaciones'); await pg.waitForTimeout(3000);
  const r = await pg.evaluate(() => ({
    url: location.pathname,
    ids: [...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>/^form:/.test(i) && !/_panel$|_item/.test(i)),
    body: document.body.innerText.slice(0,1500).replace(/\n+/g,' | ')
  }));
  console.log(JSON.stringify(r.ids));
  console.log('BODY: '+r.body);
  process.exit(0);
})();
