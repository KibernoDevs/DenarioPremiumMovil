module.exports = async (pg) => {
  return await pg.evaluate(async () => {
    const src = await (await fetch('http://localhost/main.js')).text();
    const grab = (re, n = 900) => {
      const m = src.match(re);
      if (!m) return null;
      return src.slice(m.index, m.index + n);
    };
    return {
      len: src.length,
      disableUnitSelector: grab(/disableUnitSelector\s*\(\)\s*\{[\s\S]{0,400}?\}/, 400),
      resolvePrice: grab(/resolveUnitNuPriceForLineTotal\s*\([\s\S]{0,900}/, 900),
      unitByPriceListHits: (src.match(/unitByPriceList/g) || []).length,
      userCanChangeUnitsHits: (src.match(/userCanChangeUnits/g) || []).length,
    };
  });
};
