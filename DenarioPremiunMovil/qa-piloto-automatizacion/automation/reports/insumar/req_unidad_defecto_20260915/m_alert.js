const L = require('./m_lib');
module.exports = async (pg, args) => {
  const info = await pg.evaluate(() => [...document.querySelectorAll('ion-alert')]
    .filter(a => !a.classList.contains('overlay-hidden') && a.offsetParent !== null)
    .map(a => ({
      header: ((a.querySelector('.alert-head') || {}).innerText || '').trim().slice(0, 120),
      msg: ((a.querySelector('.alert-message') || {}).textContent || '').trim().slice(0, 240),
      botones: [...a.querySelectorAll('button.alert-button')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.textContent.trim()),
    })));
  if (args[0]) {
    const cl = await L.alerts(pg, [args[0]]);
    await L.sleep(1500);
    return { info, cerrado: cl, st: await L.estado(pg) };
  }
  return { info };
};
