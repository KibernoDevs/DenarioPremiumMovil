'use strict';
const { attach, BASE } = require('./_drv');
(async () => {
  const { pg } = await attach();
  // 1) Cobranzas: por que menciona_transportista dio true
  await pg.goto(BASE+'/pages/protected/indicadores/indicadorCobros.xhtml',{waitUntil:'domcontentloaded',timeout:60000});
  await pg.waitForTimeout(4000);
  const cob = await pg.evaluate(() => {
    const b=document.body.innerText;
    const pats=['T001','T002','T003','T004','T005','T006','JOSE MU','LEANDRO MU','YONI MILANO','SAUL PENOTT','ARMANDO','VACANTE'];
    const hits=[];
    pats.forEach(p=>{let i=b.indexOf(p); if(i>=0) hits.push(p+' => '+JSON.stringify(b.slice(Math.max(0,i-70),i+70)));});
    const sm=document.getElementById('form:j_idt115:idSalesmaView_input');
    return {hits, comboVendedor: sm?[...sm.options].map(o=>o.value+'|'+o.text.trim()):null};
  });
  console.log('=== COBRANZAS');
  console.log(' comboVendedor:', JSON.stringify(cob.comboVendedor));
  cob.hits.forEach(h=>console.log('  HIT', h));
  // 2) VentasDiarias: buscar el boton
  await pg.goto(BASE+'/pages/protected/indicadores/pedidosProductosVentas.xhtml',{waitUntil:'domcontentloaded',timeout:60000});
  await pg.waitForTimeout(4000);
  const vd = await pg.evaluate(() => ({
    clickables:[...document.querySelectorAll('button,a.ui-button,input[type=submit],span.ui-button,div.ui-button')]
      .map(e=>e.id+' ||| '+(e.textContent||e.value||'').trim().slice(0,25)).filter(s=>s.trim()!=='|||'),
    formIds:[...document.querySelectorAll('[id^="form:"]')].map(e=>e.id).slice(0,40),
  }));
  console.log('=== VENTAS DIARIAS');
  console.log(' clickables:', JSON.stringify(vd.clickables,null,1));
  console.log(' formIds:', JSON.stringify(vd.formIds));
  process.exit(0);
})();
