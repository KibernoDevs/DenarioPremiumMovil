const D = require('./_drv');
(async()=>{
 const {pg}=await D.attach();
 await D.goto(pg,'/pages/facturaciones'); await pg.waitForTimeout(3000);
 await D.shot(pg,'C-01-facturaciones-inicial');
 const c=await pg.evaluate(()=>[...document.querySelectorAll('select,input[type=text],button,a.ui-commandlink,.ui-selectonemenu,.ui-selectcheckboxmenu,.ui-datatable')].map(e=>e.tagName.toLowerCase()+' | '+(e.id||'-')+' | '+(e.className||'').toString().slice(0,40)).filter(x=>x.includes('form:')));
 console.log(c.join('\n'));
 const t=await D.txt(pg); const i=t.indexOf('Filtros');
 console.log('---TXT---'); console.log(t.slice(i>0?i:0,(i>0?i:0)+900));
 process.exit(0);
})();
