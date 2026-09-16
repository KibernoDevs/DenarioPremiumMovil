'use strict';
const { attach, goto, shot } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/protected/administracion/erroresAplicacion/erroresAplicacion.xhtml');
  await pg.waitForTimeout(6000);
  const r = await pg.evaluate(() => {
    const tabs = [...document.querySelectorAll('div.ui-datatable')].map(t => ({
      id: t.id,
      head: [...t.querySelectorAll('thead th')].map(x => x.innerText.trim()),
      rows: [...t.querySelectorAll('tbody tr')].slice(0, 15).map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim().replace(/\s+/g,' ').slice(0,160))),
    }));
    return { url: location.pathname, tabs, txt: document.body.innerText.replace(/\s+/g,' ').slice(-600) };
  });
  console.log(JSON.stringify(r, null, 1).slice(0, 4000));
  await shot(pg, 'ERRORES_APP');
  process.exit(0);
})();
