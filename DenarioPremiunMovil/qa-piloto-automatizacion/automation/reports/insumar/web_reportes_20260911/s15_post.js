const D = require('./_drv');
const F = 'form:j_idt115';
const a = Object.fromEntries(process.argv.slice(2).map(x => x.replace(/^--/,'').split('=')));
const CLAS=a.clas||'Empresa', CUMP=a.cump||'Pedido', UNID=a.unid||'US$';
const D1=a.d1||'01/08/2026', D2=a.d2||'31/08/2026';
(async () => {
  const { pg } = await D.attach();
  await D.goto(pg, '/pages/reportePlanCuota');
  await pg.waitForTimeout(1500);
  await D.pick(pg, `${F}:clasificacion`, CLAS);
  await D.pick(pg, `${F}:cumplimiento`, CUMP);
  await D.pick(pg, `${F}:unidad`, UNID);
  await pg.evaluate(() => { const w=PrimeFaces.widgets['widget_form_j_idt115_checkboxValor']; try{w.renderPanel()}catch(e){} try{w.checkAll()}catch(e){} });
  await pg.waitForTimeout(500);
  // fechas por teclado real
  for (const [id,val] of [[`${F}:fechaDesde_input`,D1],[`${F}:fechaHasta_input`,D2]]) {
    await pg.$eval(`[id="${id}"]`, e=>{e.focus(); e.select();});
    await pg.keyboard.press('Control+A');
    await pg.keyboard.type(val, {delay:50});
    await pg.keyboard.press('Tab');
    await pg.waitForTimeout(800);
  }
  await pg.evaluate(()=>{ const p=document.querySelectorAll('.ui-datepicker-panel, .p-datepicker-panel'); p.forEach(x=>x.style.display='none'); });
  pg.on('request', req => {
    if (req.method()==='POST') {
      const d = req.postData() || '';
      console.log('POST ' + req.url());
      console.log('BODY=' + decodeURIComponent(d).slice(0,1500));
    }
  });
  pg.on('response', async res => {
    if (res.request().method()==='POST') {
      try { const t = await res.text(); console.log('RESP_LEN=' + t.length); const m = t.match(/Total de Resultados:\s*(\d+)/); console.log('RESP_TOTAL=' + (m?m[1]:'n/a')); const e = t.match(/(Exception|Error|error)[^<]{0,200}/); if(e) console.log('RESP_ERR=' + e[0]); } catch(x){}
    }
  });
  await pg.$eval(`[id="${F}:ajax"]`, e=>e.click());
  await pg.waitForTimeout(9000);
  const tot = await pg.evaluate(()=>{const m=document.body.innerText.match(/Total de Resultados:\s*(\d+)/);return m?m[1]:null;});
  console.log('TOTAL_FINAL=' + tot);
  process.exit(0);
})();
