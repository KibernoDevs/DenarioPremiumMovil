module.exports = async (pg) => {
  return await pg.evaluate(() => {
    const pag = document.querySelector('.ui-paginator');
    const dt  = document.querySelector('[id^="formGlobal:tablaConf"]');
    return {
      paginator: pag ? (pag.innerText||'').replace(/\s+/g,' ').slice(0,200) : null,
      rowsTr: document.querySelectorAll('[id="formGlobal:tablaConf"] tbody tr').length,
      dtId: dt ? dt.id : null,
      bodyHas: /Lista de Precio/i.test(document.body.innerText),
      matchUnidad: (document.body.innerText.match(/[^\n]*[Uu]nidades[^\n]*/g)||[]).slice(0,12),
    };
  });
};
