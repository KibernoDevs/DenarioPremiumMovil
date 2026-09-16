// Pulsa Buscar SIN tocar nada (defaults de la pantalla)
const { attach, shot, BASE } = require('./_drv');
(async()=>{
 const tag=process.argv[2]||'VIRGEN';
 const ruta=process.argv[3]||'/pages/reporteCumplimientoCuota';
 const {pg}=await attach();
 await pg.goto(BASE+ruta,{waitUntil:'domcontentloaded',timeout:60000});
 await pg.waitForTimeout(3500);
 const B = await pg.evaluate(()=>{const s=[...document.querySelectorAll('select')].map(x=>x.id).find(i=>/:cumplimiento_input$/.test(i));return s?s.replace(/:cumplimiento_input$/,''):null;});
 let resp=null,post=null;
 const hr=async r=>{if(r.request().method()==='POST'&&r.url().includes(ruta.split('/').pop())){try{resp=await r.text();post=r.request().postData();}catch(e){}}};
 pg.on('response',hr);
 await pg.$eval(`[id="${B}:ajax"]`,e=>e.click());
 await pg.waitForTimeout(11000);
 pg.off('response',hr);
 const m=resp&&resp.match(/summary:"([^"]*)"[^}]*detail:"([^"]*)"/);
 const body=await pg.evaluate(()=>document.body.innerText);
 console.log(JSON.stringify({tag,B,err:m?m[1]+' / '+m[2]:null,total:(body.match(/Total de Resultados:\s*([\d.,]+)/)||[])[1]||null,
   snippet:(body.match(/Descripci[^\n]{0,400}/)||[])[0]},null,1));
 require('fs').writeFileSync(require('path').join(__dirname,'evidencia','resp-'+tag+'.txt'),(post||'')+'\n\n==RESP==\n'+(resp||''));
 await shot(pg,tag);
 process.exit(0);
})();
