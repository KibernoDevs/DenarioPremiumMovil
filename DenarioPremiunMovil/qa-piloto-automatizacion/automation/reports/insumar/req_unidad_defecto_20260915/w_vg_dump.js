module.exports = async (pg) => {
  // click pestaña Pedidos
  const tabs = await pg.$$('a[role="tab"], li[role="tab"] a, .ui-tabs-anchor');
  const info = [];
  for (const t of tabs) info.push((await t.innerText()).trim());
  return { tabs: info, ids: await pg.evaluate(() => [...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>/unit|Unit/i.test(i))) };
};
