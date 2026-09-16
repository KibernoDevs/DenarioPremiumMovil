module.exports = async (pg) => {
  const log = [];
  // 1. Abrir el menú Empresa
  const emp = pg.locator('span.ui-menuitem-text', { hasText: /^Empresa$/ }).first();
  if (await emp.count()) { await emp.click(); log.push('click Empresa'); }
  else { await pg.getByText('Empresa', { exact: true }).first().click(); log.push('click Empresa (text)'); }
  await pg.waitForTimeout(1200);
  // 2. Variables Globales
  const vg = pg.locator('span.ui-menuitem-text', { hasText: /^Variables Globales$/ }).first();
  await vg.click();
  log.push('click Variables Globales');
  await pg.waitForTimeout(6000);
  const r = await pg.evaluate(() => ({
    path: location.pathname,
    title: document.title,
    txt: (document.body.innerText||'').slice(0, 1500),
  }));
  return { log, ...r };
};
