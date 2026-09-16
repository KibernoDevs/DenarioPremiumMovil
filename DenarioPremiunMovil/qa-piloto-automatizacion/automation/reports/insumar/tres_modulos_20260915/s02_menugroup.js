'use strict';
const fs=require('fs');
const { attach, goto } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/main');
  await pg.waitForTimeout(1500);
  const g = await pg.evaluate(() => {
    const res = [];
    // Buscar los <a> raiz de primer nivel del menubar y su UL hermano
    document.querySelectorAll('a').forEach(a => {
      const t = a.textContent.trim().replace(/\s+/g,' ');
      if (!['Empresa','Estructura Comercial','Datos Maestros','Visitas','Transacciones','Reportes','Indicadores'].includes(t)) return;
      if (a.getAttribute('href') && a.getAttribute('href').includes('/pages/') && t!=='Empresa') return;
      const li = a.closest('li');
      if (!li) return;
      const sub = li.querySelector('ul');
      if (!sub) return;
      res.push({ menu: t, items: [...sub.querySelectorAll('a')].map(x => x.textContent.trim().replace(/\s+/g,' ') + ' ::: ' + (x.getAttribute('href')||'')) });
    });
    return res;
  });
  fs.writeFileSync('menu-grupos.json', JSON.stringify(g,null,1));
  g.forEach(m => { console.log('### ' + m.menu + '  (' + m.items.length + ')'); m.items.forEach(i => console.log('    ' + i)); });
  process.exit(0);
})();
