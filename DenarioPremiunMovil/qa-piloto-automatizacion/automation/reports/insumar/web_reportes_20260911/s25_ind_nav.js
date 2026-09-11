const D=require('./_drv');
const NAME=process.argv[2]||'Vendedores';
(async()=>{const {pg}=await D.attach();
 await D.goto(pg,'/pages/main'); await pg.waitForTimeout(2000);
 const href = await pg.evaluate((n)=>{const a=[...document.querySelectorAll('a')].filter(x=>x.textContent.trim()===n && (x.getAttribute('href')||'').includes('/pages/'));return a.length?a[a.length-1].getAttribute('href'):null;},NAME);
 console.log('HREF='+href);
 if(href){ await pg.goto('http://denarioelyaque.ddns.net:8080'+href,{waitUntil:'domcontentloaded',timeout:60000}); await pg.waitForTimeout(4000); }
 console.log('URL='+pg.url());
 const t=await D.txt(pg); const i=t.indexOf('Filtros');
 console.log((i>=0?t.slice(i,i+2200):t.slice(0,900)));
 await D.shot(pg,'C-IND-'+NAME);
 const c=await pg.evaluate(()=>[...document.querySelectorAll('select,input[type=text],button,.ui-selectonemenu,.ui-selectcheckboxmenu,.ui-datatable,table')].map(e=>e.tagName.toLowerCase()+' | '+(e.id||'-')).filter(x=>x.includes('form')));
 console.log('---CTRL---\n'+c.join('\n'));
 process.exit(0);})();
