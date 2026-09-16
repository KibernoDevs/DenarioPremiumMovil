module.exports = async (pg) => await pg.evaluate(() => {
  const vis = e => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().width > 0;
  return {
    path: location.pathname,
    txt: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 900),
    inputs: [...document.querySelectorAll('input')].map(i => ({
      cls: String(i.className).slice(0, 60), ph: i.placeholder, vis: vis(i),
      r: (() => { const b = i.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })(),
    })).slice(0, 15),
    iconos: [...document.querySelectorAll('ion-icon')].filter(vis).map(i => i.getAttribute('name')).slice(0, 25),
    botones: [...document.querySelectorAll('ion-button, button')].filter(vis).map(b => (b.textContent || '').trim().slice(0, 30)).filter(Boolean).slice(0, 20),
    items: [...document.querySelectorAll('ion-item')].filter(vis).map(i => (i.innerText || '').replace(/\s+/g, ' ').slice(0, 80)).slice(0, 20),
    accs: document.querySelectorAll('ion-accordion').length,
  };
});
