'use strict';
// _tarjetas.js — extrae de cada resp-<tag>.txt las 4 tarjetas KPI y la serie del grafico de barras
const fs=require('fs'), path=require('path');
const EV=path.join(__dirname,'evidencia');
const CLAVES=['hoy','Mes','A','por Fecha'];
const out={};
for (const f of fs.readdirSync(EV).filter(x=>/^resp-.*\.txt$/.test(x))) {
  const tag=f.replace(/^resp-|\.txt$/g,'');
  const plano=fs.readFileSync(path.join(EV,f),'latin1').replace(/Â| /g,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  const t={};
  const re=/Total Cobrado (hoy|Mes|A\S+o|por Fecha)[^)]*\)\s*([\d.]*\d,\d{2})\s*(USD|Bs)/g;
  for (const m of plano.matchAll(re)) t[m[1]] = m[2]+' '+m[3];
  const raw=fs.readFileSync(path.join(EV,f),'latin1');
  const bar=(raw.match(/"data":\[([^\]]*)\],"label":"(USD|Bs)"/)||[])[1]||null;
  out[tag]={tarjetas:t, barras_tr_de_ef:bar};
}
fs.writeFileSync(path.join(EV,'tarjetas.json'), JSON.stringify(out,null,1));
for (const k of Object.keys(out).sort()) console.log(k.padEnd(18), JSON.stringify(out[k]));
