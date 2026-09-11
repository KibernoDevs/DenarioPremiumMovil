const D = require('./_drv');
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/main');
  const menus = await pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('a').forEach(a => {
      const h = a.getAttribute('href') || '';
      const t = (a.textContent||'').trim().replace(/\s+/g,' ');
      if (t) out.push(t + ' ::: ' + h);
    });
    return out;
  });
  console.log(menus.join('\n'));
  process.exit(0);
})();
