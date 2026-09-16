const { attach } = require('./_drv');
(async()=>{
 const {pg}=await attach();
 const r = await pg.evaluate(()=>({
   widgets: Object.keys(window.PrimeFaces?window.PrimeFaces.widgets:{}),
   chkNames: [...new Set([...document.querySelectorAll('input[type=checkbox]')].map(i=>i.name).filter(Boolean))],
   enterpriseOpts: [...(document.getElementById('formFiltros:j_idt116:idEnterprise_input')||{options:[]}).options].map(o=>o.value+'='+o.text.trim()),
   clasOpts: [...(document.getElementById('formFiltros:j_idt116:clasificacion_input')||{options:[]}).options].map(o=>o.text.trim()),
   cumplOpts: [...(document.getElementById('formFiltros:j_idt116:cumplimiento_input')||{options:[]}).options].map(o=>o.text.trim()),
   uniOpts: [...(document.getElementById('formFiltros:j_idt116:unidad_input')||{options:[]}).options].map(o=>o.text.trim()),
   rdvOpts: [...(document.getElementById('formFiltros:j_idt116:codRdv_input')||{options:[]}).options].map(o=>o.text.trim()),
   fechas: {d:(document.getElementById('formFiltros:j_idt116:fechaDesde_input')||{}).value, h:(document.getElementById('formFiltros:j_idt116:fechaHasta_input')||{}).value}
 }));
 console.log(JSON.stringify(r,null,1));
 process.exit(0);
})();
