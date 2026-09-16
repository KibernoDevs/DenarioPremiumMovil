module.exports = async (pg) => {
  await pg.goto('http://denarioelyaque.ddns.net:8080/DenarioPremium/pages/variablesConfiguracion',
    { waitUntil: 'domcontentloaded', timeout: 90000 });
  await pg.waitForTimeout(5000);
  return await pg.evaluate(() => ({
    path: location.pathname,
    title: document.title,
    txt: (document.body.innerText || '').slice(0, 2500),
  }));
};
