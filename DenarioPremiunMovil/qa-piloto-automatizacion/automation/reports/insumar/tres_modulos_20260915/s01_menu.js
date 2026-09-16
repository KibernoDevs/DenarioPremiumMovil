'use strict';
const fs = require('fs');
const { attach, goto } = require('./_drv');
(async () => {
  const { pg } = await attach();
  await goto(pg, '/pages/main');
  await pg.waitForTimeout(2000);
  // Mapa del menu: recorrer los <li> raiz del menubar y sus submenus
  const map = await pg.evaluate(() => {
    const out = [];
    // submenus de PrimeFaces menubar
    document.querySelectorAll('ul.ui-menu-list > li.ui-menuitem, ul[role="menubar"] > li').forEach(li => {
      const label = (li.querySelector(':scope > a')||{}).textContent;
      const kids = [...li.querySelectorAll('ul a')].map(a => a.textContent.trim() + ' ::: ' + (a.getAttribute('href')||a.getAttribute('onclick')||''));
      out.push({ label: (label||'').trim(), kids });
    });
    return out;
  });
  const all = await pg.evaluate(() => [...document.querySelectorAll('a')]
      .map(a => a.textContent.trim().replace(/\s+/g,' ') + ' ::: ' + (a.getAttribute('href')||''))
      .filter(s => s.includes('/pages/') || s.includes('.xhtml')));
  fs.writeFileSync('menu-map.json', JSON.stringify({ map, all }, null, 1));
  console.log('--- ANCLAS CON RUTA (' + all.length + ') ---');
  all.forEach(s => console.log(s));
  process.exit(0);
})();
