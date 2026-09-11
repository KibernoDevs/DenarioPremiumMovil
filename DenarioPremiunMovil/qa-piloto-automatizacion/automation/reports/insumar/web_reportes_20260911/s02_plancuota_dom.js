const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(2000);
  await D.shot(pg, 'A-01-plancuota-inicial');
  console.log('--- TEXTO ---');
  console.log((await D.txt(pg)).slice(0, 2500));
  console.log('--- CONTROLES ---');
  const ctrls = await pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('select, input, button, a.ui-commandlink, .ui-selectonemenu, .ui-selectcheckboxmenu, .ui-datatable').forEach(e => {
      const id = e.id || '(no-id)';
      const tag = e.tagName.toLowerCase();
      const cls = (e.className||'').toString().slice(0,60);
      let lbl = '';
      try { lbl = (e.getAttribute('placeholder')||e.getAttribute('value')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,50); } catch(x){}
      out.push([tag, id, cls, lbl].join(' | '));
    });
    return out;
  });
  console.log(ctrls.join('\n'));
  process.exit(0);
})();
