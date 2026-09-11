const D = require('./_drv');
const F='form:j_idt115';
const CASES=[
 ['LIMPIAR',null,null,null,null],
 ['Canales de distribución','Pedido','US$','01/08/2026','31/08/2026'],
 ['Pais','Pedido','US$','01/08/2026','31/08/2026'],
 ['Estado','Pedido','US$','01/08/2026','31/08/2026'],
 ['Empresa','Pedido','UNIDADES','01/08/2026','31/08/2026'],
 ['Empresa','Pedido','US$','01/01/2020','11/09/2026'],
];
(async()=>{
 const {pg}=await D.attach();
 for(const [clas,cump,unid,d1,d2] of CASES){
  await D.goto(pg,'/pages/reportePlanCuota'); await pg.waitForTimeout(1300);
  if(clas==='LIMPIAR'){ await pg.$eval(`[id="${F}:botonLimpiar"]`,e=>e.click()); await pg.waitForTimeout(3000); }
  else {
   await D.pick(pg,`${F}:clasificacion`,clas); await D.pick(pg,`${F}:cumplimiento`,cump); await D.pick(pg,`${F}:unidad`,unid);
   await pg.evaluate(()=>{const w=PrimeFaces.widgets['widget_form_j_idt115_checkboxValor'];try{w.renderPanel()}catch(e){}try{w.checkAll()}catch(e){}});
   await pg.evaluate(([f,x,y])=>{document.getElementById(f+':fechaDesde_input').value=x;document.getElementById(f+':fechaHasta_input').value=y;},[F,d1,d2]);
  }
  let resp=null; const h=async r=>{if(r.request().method()==='POST'&&r.url().includes('reportePlanCuota')){try{resp=await r.text()}catch(e){}}};
  pg.on('response',h);
  await pg.$eval(`[id="${F}:ajax"]`,e=>e.click()); await pg.waitForTimeout(8000); pg.off('response',h);
  const st=await pg.evaluate((f)=>({clas:document.getElementById(f+':clasificacion_input')?.value,cump:document.getElementById(f+':cumplimiento_input')?.value,unid:document.getElementById(f+':unidad_input')?.value,d1:document.getElementById(f+':fechaDesde_input')?.value,d2:document.getElementById(f+':fechaHasta_input')?.value,val:[...document.querySelectorAll(`input[name="${f}:checkboxValor"]`)].filter(i=>i.checked).length}),F);
  const err=resp?(resp.match(/summary:"([^"]*)"/)||[])[1]:null;
  const r=await pg.evaluate(()=>{const t=document.getElementById('form:tablaComparativoPlanCuota');
   const rows=t?[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td')].map(td=>td.innerText.trim().replace(/\s+/g,' '))):[];
   const m=document.body.innerText.match(/Total de Resultados:\s*(\d+)/);return{total:m?m[1]:null,rows};});
  console.log(`${clas} => ESTADO=${JSON.stringify(st)} TOTAL=${r.total} ERR=${err} R0=${JSON.stringify(r.rows[0]||[])}`);
 }
 process.exit(0);
})();
