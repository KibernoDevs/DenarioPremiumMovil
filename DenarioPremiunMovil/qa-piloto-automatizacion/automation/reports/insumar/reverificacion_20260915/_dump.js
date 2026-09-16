'use strict';
const { attach, goto, shot } = require('./_drv');
(async () => {
  const p = process.argv[2];
  const { pg } = await attach();
  await goto(pg, p);
  const d = await pg.evaluate(() => {
    const out = { path: location.pathname, selects: [], fechas: [], buttons: [] };
    document.querySelectorAll('select').forEach(s => { if(!/reflowDD|rppDD/.test(s.id)) out.selects.push({ id: s.id, n: s.options.length, opts: [...s.options].map(o => o.value+'='+o.text.trim()).slice(0,20), val: s.value }); });
    document.querySelectorAll('input').forEach(i => { if (/fecha|date/i.test(i.id)) out.fechas.push({id:i.id, val:i.value}); });
    document.querySelectorAll('button').forEach(b => { if(/ajax|buscar|Limpiar/i.test(b.id)||/Buscar/i.test(b.innerText)) out.buttons.push({id:b.id, t:b.innerText.trim()}); });
    return out;
  });
  console.log(JSON.stringify(d, null, 1));
  process.exit(0);
})();
