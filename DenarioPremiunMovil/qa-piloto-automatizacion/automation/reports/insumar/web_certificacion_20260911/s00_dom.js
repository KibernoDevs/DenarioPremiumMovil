const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(2000);
  const r = await pg.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>/form:/.test(i) && !/_panel|_items|_item$/.test(i));
    return { url: location.pathname, ids: ids.slice(0,120), wid: Object.keys(window.PrimeFaces?window.PrimeFaces.widgets:{}) , body: document.body.innerText.slice(0,600).replace(/\n+/g,' | ')};
  });
  console.log(JSON.stringify(r,null,1));
  process.exit(0);
})();
