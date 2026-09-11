const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  const r = await pg.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>/^form:/.test(i));
    return { url: location.pathname, ids, wid: Object.keys(window.PrimeFaces.widgets).filter(w=>/form_/.test(w)), body: document.body.innerText.slice(0,800).replace(/\n+/g,' | ')};
  });
  console.log(JSON.stringify(r,null,1));
  process.exit(0);
})();
