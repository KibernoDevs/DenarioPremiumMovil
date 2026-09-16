'use strict';
// Pulsa Buscar SIN tocar nada (valores por defecto de la pantalla)
const { attach, goto, shot } = require('./_drv');
(async () => {
  const [ruta, btn, tag] = process.argv.slice(2);
  const { pg } = await attach();
  await goto(pg, ruta);
  let resp=null;
  const hr = async r => { if (r.request().method()==='POST') { try{ resp=await r.text(); }catch(e){} } };
  pg.on('response', hr);
  await pg.$eval(`[id="${btn}"]`, e=>e.click());
  await pg.waitForTimeout(9000);
  const m = resp && resp.match(/summary:"([^"]*)"/);
  const body = await pg.evaluate(()=>document.body.innerText);
  const tot = (body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1] || null;
  console.log(JSON.stringify({tag, err: m?m[1]:null, total: tot}));
  await shot(pg, tag);
  process.exit(0);
})();
