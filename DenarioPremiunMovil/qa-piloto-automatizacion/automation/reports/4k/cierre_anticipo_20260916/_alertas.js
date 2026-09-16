'use strict';
/**
 * Captura de alertas y banners — insumo del caso D.
 * Distingue AUSENTE de PRESENTE-PERO-OCULTA: las ion-alert descartadas siguen en
 * el DOM con display:none, así que se listan TODAS con su estado de visibilidad.
 */
module.exports = function (pg) {

  // Todas las ion-alert del DOM, con visibilidad real, texto literal y botones.
  async function dumpAlertas(momento) {
    const r = await pg.evaluate(() => {
      return [...document.querySelectorAll('ion-alert')].map((a, i) => {
        const cs = getComputedStyle(a);
        const rect = a.getBoundingClientRect();
        const btns = [...a.querySelectorAll('.alert-button')].map(b => ({
          txt: (b.textContent || '').trim(),
          w: Math.round(b.getBoundingClientRect().width),
        }));
        const visible = !a.classList.contains('overlay-hidden') &&
          cs.display !== 'none' && cs.visibility !== 'hidden' &&
          rect.width > 0 && btns.some(b => b.w > 0);
        const t = a.querySelector('.alert-title, .alert-head');
        const m = a.querySelector('.alert-message');
        const sub = a.querySelector('.alert-sub-title');
        return {
          i, visible,
          display: cs.display,
          clases: String(a.className).slice(0, 120),
          titulo: (t && t.textContent.trim()) || '',
          subtitulo: (sub && sub.textContent.trim()) || '',
          mensaje: (m && m.textContent.trim()) || '',
          botones: btns.map(b => b.txt),
          botonesVisibles: btns.filter(b => b.w > 0).map(b => b.txt),
        };
      });
    }).catch(e => [{ err: e.message }]);
    return { momento, ts: new Date().toISOString(), total: r.length, visibles: r.filter(x => x.visible), todas: r };
  }

  // Banner persistente de anticipo (COB-PREPAID-012): NO es una ion-alert.
  async function dumpBanner(momento) {
    return pg.evaluate(() => {
      const out = { presente: false, titulo: '', mensaje: '', html: '' };
      const cand = [...document.querySelectorAll('app-cobro *')].filter(el => {
        if (el.children.length > 4) return false;
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        return /anticipo autom/i.test(t) && t.length < 400 && el.getBoundingClientRect().width > 0;
      });
      if (!cand.length) return out;
      // el más profundo/pequeño que contenga el texto
      const el = cand[cand.length - 1];
      const cont = el.closest('ion-card, .prepaid-banner, ion-item, div') || el;
      out.presente = true;
      out.mensaje = (cont.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      out.tag = cont.tagName.toLowerCase();
      out.clases = String(cont.className).slice(0, 120);
      return out;
    }).then(b => Object.assign({ momento }, b)).catch(e => ({ momento, err: e.message }));
  }

  // Sonda del servicio: qué dice el propio código que debería mostrarse.
  async function sondaAvisos() {
    return pg.evaluate(() => {
      try {
        const el = document.querySelector('app-cobro');
        if (!el || !window.ng) return { err: 'sin app-cobro/ng' };
        const c = window.ng.getComponent(el);
        const s = c && (c.collectService || c.collectionService);
        if (!s) return { err: 'sin collectService' };
        const f = (n, ...a) => { try { return typeof s[n] === 'function' ? s[n](...a) : null; } catch (e) { return 'ERR:' + e.message; } };
        return {
          shouldInform: f('shouldShowAutomatedPrepaidInformMessage'),
          informShown: s.automatedPrepaidInformMessageShown,
          recentOpenCollect: s.recentOpenCollect,
          shouldBanner: f('shouldShowAutomatedPrepaidPersistentBanner'),
          bannerTitulo: f('getAutomatedPrepaidPersistentBannerTitle'),
          bannerMensaje: f('buildAutomatedPrepaidPersistentBannerMessage'),
          mensajeInform: f('buildAutomatedPrepaidMessage'),
          createAutomatedPrepaid: s.createAutomatedPrepaid,
          creditBalancePrepaidAmount: s.creditBalancePrepaidAmount,
        };
      } catch (e) { return { err: e.message }; }
    }).catch(e => ({ err: e.message }));
  }

  return { dumpAlertas, dumpBanner, sondaAvisos };
};
