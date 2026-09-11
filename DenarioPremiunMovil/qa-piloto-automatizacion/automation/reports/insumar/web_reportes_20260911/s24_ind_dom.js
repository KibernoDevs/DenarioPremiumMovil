const D=require('./_drv');
const P=process.argv[2]||'/pages/pedidosVendedores';
(async()=>{const {pg}=await D.attach(); await D.goto(pg,P); await pg.waitForTimeout(3500);
 await D.shot(pg,'C-IND-'+P.split('/').pop());
 const c=await pg.evaluate(()=>[...document.querySelectorAll('select,input[type=text],button,.ui-selectonemenu,.ui-selectcheckboxmenu,.ui-datatable')].map(e=>e.tagName.toLowerCase()+' | '+(e.id||'-')).filter(x=>x.includes('form:')));
 console.log(c.join('\n'));
 const t=await D.txt(pg); const i=t.indexOf('Filtros');
 console.log('---TXT---\n'+t.slice(i>0?i:0,(i>0?i:0)+2500));
 process.exit(0);})();
