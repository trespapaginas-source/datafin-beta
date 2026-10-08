/* Medición opcional (Google Analytics, Píxel de Meta, Píxel de TikTok).
   Solo se activa si hay IDs en window.DATAFIN_TRACKING (ver index.html) y la persona acepta las cookies. */
(() => {
  'use strict';
  const cfg = window.DATAFIN_TRACKING || {};
  const KEY = 'datafin_cookies';
  const hayMedicion = Boolean(cfg.meta || cfg.tiktok || cfg.ga4);
  const leer = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* sin almacenamiento */ } };
  let cargado = false;

  function cargar() {
    if (cargado || !hayMedicion) return;
    cargado = true;
    if (cfg.ga4) {
      const s = document.createElement('script');
      s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4)}`;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', cfg.ga4);
    }
    if (cfg.meta) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', cfg.meta);
      window.fbq('track', 'PageView');
    }
    if (cfg.tiktok) {
      /* eslint-disable */
      !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(cfg.tiktok);ttq.page()}(window,document,'ttq');
      /* eslint-enable */
    }
  }

  // Eventos de conversión. nombre: whatsapp_click | lead | chat_open | form_open
  function track(nombre, params) {
    if (!cargado) return;
    const p = params || {};
    if (window.gtag) window.gtag('event', nombre === 'lead' ? 'generate_lead' : nombre, p);
    if (window.fbq) {
      if (nombre === 'whatsapp_click') window.fbq('track', 'Contact', p);
      else if (nombre === 'lead') window.fbq('track', 'Lead', p);
    }
    if (window.ttq) {
      if (nombre === 'whatsapp_click') window.ttq.track('Contact', p);
      else if (nombre === 'lead') window.ttq.track('SubmitForm', p);
    }
  }
  window.datafinTrack = track;

  // Clics en enlaces a WhatsApp (tarjetas de servicios, Consulta General, Quiénes somos, pie)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="wa.me"]');
    if (!a) return;
    const card = a.closest('.card');
    track('whatsapp_click', {
      origen: a.dataset.track || (card ? 'servicio' : (a.closest('section,footer') || {}).id || 'sitio'),
      servicio: card ? (card.querySelector('h3') || {}).textContent : undefined,
    });
  });

  // Aviso de cookies: solo aparece si hay medición configurada
  function aviso() {
    const b = document.createElement('div');
    b.className = 'cookie'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Aviso de cookies');
    b.innerHTML = '<p>Usamos cookies de medición (Google Analytics y píxeles de Meta y TikTok) solo si las aceptas, para saber qué partes del sitio funcionan mejor y mejorar nuestra publicidad. <a href="legal/politica-de-privacidad/#cookies">Más información</a>.</p><div class="cookie__btns"><button type="button" class="btn btn--line" data-c="no">Rechazar</button><button type="button" class="btn btn--primary" data-c="si">Aceptar</button></div>';
    document.body.appendChild(b);
    b.addEventListener('click', (e) => {
      const v = e.target.closest('[data-c]');
      if (!v) return;
      guardar(v.dataset.c === 'si' ? 'aceptadas' : 'rechazadas');
      b.remove();
      if (v.dataset.c === 'si') cargar(); else if (cargado) location.reload();
    });
  }

  function init() {
    if (!hayMedicion) return;
    document.querySelectorAll('[data-cookie-prefs]').forEach((btn) => {
      btn.hidden = false;
      btn.addEventListener('click', () => { try { localStorage.removeItem(KEY); } catch (e) {} if (!document.querySelector('.cookie')) aviso(); });
    });
    const estado = leer();
    if (estado === 'aceptadas') cargar();
    else if (!estado) aviso();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
