'use strict';
const fs=require('fs'),path=require('path');
const { attach, shot, BASE } = require('./_drv');
const pick = require('./_pick2');
const EV=path.join(__dirname,'evidencia');
(async () => {
  const { pg } = await attach();
  // ---- CONTROL 1: IND Vendedores con Cumplimiento = Pedido (debe devolver filas)
  await pg.goto(BASE+'/pages/pedidosVendedores',{waitUntil:'domcontentloaded',timeout:60000});
  await pg.waitForTimeout(4000);
  await pick(pg,'form:j_idt115:vendedor','Todos');
  await pick(pg,'form:j_idt115:cumplimiento','Pedido');
  await pick(pg,'form:j_idt115:idCurrency','US$');
  await pg.evaluate(()=>{const a=document.getElementById('form:j_idt115:dateB_input');if(a)a.value='01/08/2026';const z=document.getElementById('form:j_idt115:dateF_input');if(z)z.value='31/08/2026';});
  await pg.evaluate(()=>document.getElementById('form:j_idt115:ajax').click());
  await pg.waitForTimeout(11000);
  const c1 = await pg.evaluate(()=>{
    const b=document.body.innerText; const i=b.indexOf('Cobertura vendedor');
    const tabs=[...document.querySelectorAll('div.ui-datatable')].map(t=>({id:t.id,head:[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim()),rows:[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.textContent.trim()))}));
    return {frag:b.slice(i,i+600), tabs};
  });
  console.log('=== CTRL IND-Vendedores PEDIDO ago');
  console.log(JSON.stringify(c1,null,1).slice(0,2500));
  fs.writeFileSync(path.join(EV,'res-CTRL_IND_Vend_Pedido_AGO.json'),JSON.stringify(c1,null,1));
  await shot(pg,'CTRL_IND_Vend_Pedido_AGO');

  // ---- CONTROL 2: Ventas Diarias — fijar combos y leer productView (no tiene boton Buscar)
  await pg.goto(BASE+'/pages/protected/indicadores/pedidosProductosVentas.xhtml',{waitUntil:'domcontentloaded',timeout:60000});
  await pg.waitForTimeout(4000);
  await pick(pg,'form:j_idt116:tipoVista','Rango de Fechas');
  await pg.evaluate(()=>{const a=document.getElementById('form:j_idt116:dateF_input');if(a)a.value='01/08/2026';const z=document.getElementById('form:j_idt116:dateB_input');if(z)z.value='31/08/2026';});
  await pg.waitForTimeout(1000);
  // disparar change en las fechas por si la pantalla consulta sola
  await pg.evaluate(()=>{['form:j_idt116:dateF_input','form:j_idt116:dateB_input'].forEach(id=>{const e=document.getElementById(id); if(e) e.dispatchEvent(new Event('change',{bubbles:true}));});});
  await pg.waitForTimeout(9000);
  const c2 = await pg.evaluate(()=>{
    const pv=document.getElementById('form:productView');
    return { combo: [...(document.getElementById('form:j_idt116:idSalesmaView_input')||{options:[]}).options].map(o=>o.value+'|'+o.text.trim()),
             productViewTexto: pv?pv.innerText.slice(0,900):'(no existe form:productView)',
             tablas: [...document.querySelectorAll('div.ui-datatable')].map(t=>t.id) };
  });
  console.log('=== CTRL Ventas Diarias');
  console.log(JSON.stringify(c2,null,1).slice(0,2000));
  fs.writeFileSync(path.join(EV,'res-CTRL_VentasDiarias.json'),JSON.stringify(c2,null,1));
  await shot(pg,'CTRL_VentasDiarias');
  process.exit(0);
})();
