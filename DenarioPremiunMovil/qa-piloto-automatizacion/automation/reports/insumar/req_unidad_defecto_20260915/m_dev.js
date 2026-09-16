module.exports = async (pg) => {
  return await pg.evaluate(async () => {
    const src = await (await fetch('http://localhost/main.js')).text();
    // localizar el bloque del componente devolucion-product-list
    const selIdx = src.indexOf('selectors: [["devolucion-product-list"');
    const selIdx2 = src.search(/selectors:\s*\[\[\s*"devolucion-product-list"/);
    const i = selIdx >= 0 ? selIdx : selIdx2;
    // el bloque de plantillas va ANTES; tomar 260k previos
    const start = Math.max(0, i - 260000);
    const block = src.slice(start, i + 2000);
    const out = [];
    const re = /unitList/g; let m;
    while ((m = re.exec(block))) {
      const w = block.slice(Math.max(0,m.index-420), m.index+80).replace(/_angular_core__WEBPACK_IMPORTED_MODULE_1__/g,'NG').replace(/\s+/g,' ');
      if (/disabled|ɵɵproperty|repeater|ngForOf/.test(w)) out.push(w);
    }
    // también: todas las apariciones de "disabled" en el bloque
    const dis = [];
    const re2 = /"disabled"/g; let m2;
    while ((m2 = re2.exec(block))) {
      dis.push(block.slice(Math.max(0,m2.index-200), m2.index+160).replace(/_angular_core__WEBPACK_IMPORTED_MODULE_1__/g,'NG').replace(/\s+/g,' '));
    }
    return { idx: i, unitListCtx: out.slice(0,10), disabledCtx: dis.slice(0,14) };
  });
};
