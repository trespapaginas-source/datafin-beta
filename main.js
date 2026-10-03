/* Datafin Beta — interacciones de la landing */
(() => {
  'use strict';

  // Configuración -----------------------------------------------------------
  // Número de WhatsApp en formato internacional sin "+". Si queda vacío, el botón abre el formulario.
  const WHATSAPP_NUMBER = '573127045885';
  // Mensaje prellenado según el llamado a la acción (data-intent); {servicio} se reemplaza si aplica.
  const WHATSAPP_TEXTS = {
    caso: 'Hola, quiero consultar mi caso en Datafin Beta.',
    asesor: 'Hola, quiero hablar con un asesor de Datafin Beta.',
    orientacion: 'Hola, no sé qué servicio necesito. ¿Me pueden orientar?',
    servicio: 'Hola, me interesa el servicio: {servicio}.',
    contacto: 'Hola, quiero contactar al equipo de Datafin Beta.',
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // Navbar: fondo al hacer scroll + menú móvil ------------------------------
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const links = $('#navLinks');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open) => {
    links.classList.toggle('open', open);
    nav.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    toggle.firstElementChild.firstElementChild.setAttribute('href', open ? '#i-x' : '#i-menu');
  };
  toggle.addEventListener('click', () => setMenu(!links.classList.contains('open')));
  $$('a', links).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Reveal on scroll + línea de progreso de "Cómo funciona" -----------------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, #steps').forEach((el) => io.observe(el));

  // Fotografías reales: assets/equipo.* y assets/asesora.* -------------------
  // Mientras no existan, se muestra un espacio reservado discreto.
  const EXT = ['webp', 'png', 'jpg', 'jpeg', 'avif'];
  const probe = (name) => new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= EXT.length) return resolve(null);
      const src = `assets/${name}.${EXT[i++]}`;
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = next;
      img.src = src;
    };
    next();
  });

  $$('.photo-slot').forEach((slot) => {
    const ph = document.createElement('div');
    ph.className = 'ph';
    ph.innerHTML = `<svg class="ico ico--lg" aria-hidden="true"><use href="#i-users"/></svg>${slot.dataset.label}<small>Agrega assets/${slot.dataset.photo}.png</small>`;
    slot.appendChild(ph);
    probe(slot.dataset.photo).then((src) => {
      if (!src) return;
      const img = document.createElement('img');
      img.src = src;
      img.alt = slot.dataset.label;
      img.decoding = 'async';
      slot.appendChild(img);
      slot.classList.add('loaded');
    });
  });

  // Formulario "Consultar mi caso" ------------------------------------------
  const dialog = $('#caseDialog');
  const form = $('#caseForm');
  const err = $('#caseError');
  const select = $('#caseService');
  const wrap = $('#caseFormWrap');
  const done = $('#caseDone');

  // Textos del formulario según el llamado a la acción que lo abre (data-intent)
  const INTENTS = {
    caso: {
      kicker: 'Asesoría sin costo', title: 'Cuéntanos tu caso',
      lead: 'Un asesor te contactará en menos de 24 horas. Tu información es 100 % confidencial.',
      submit: 'Consultar mi caso', doneTitle: '¡Recibimos tu caso!',
      doneText: 'Un asesor revisará tu situación y te contactará en menos de 24 horas.',
    },
    asesor: {
      kicker: 'Habla con un asesor', title: 'Hablemos de tu caso',
      lead: 'Déjanos tus datos y un asesor te escribirá o llamará para resolver tus dudas.',
      submit: 'Quiero hablar con un asesor', doneTitle: '¡Listo, te contactaremos!',
      doneText: 'Un asesor se comunicará contigo muy pronto para atender tus dudas.',
    },
    orientacion: {
      kicker: 'Asesoría sin costo', title: 'Te ayudamos a elegir',
      lead: 'Cuéntanos tu situación y un asesor te orientará sobre el servicio que más te conviene, sin compromiso.',
      submit: 'Quiero orientación', doneTitle: '¡Recibimos tu solicitud!',
      doneText: 'Un asesor te contactará para orientarte sobre el servicio ideal para ti.',
    },
    servicio: {
      kicker: 'Servicio seleccionado', title: (s) => s,
      lead: 'Déjanos tus datos y un asesor te contactará en menos de 24 horas para ayudarte con este servicio.',
      submit: 'Solicitar este servicio', doneTitle: '¡Recibimos tu solicitud!',
      doneText: (s) => `Un asesor te contactará pronto para ayudarte con: ${s}.`,
    },
    contacto: {
      kicker: 'Contacto', title: 'Escríbenos',
      lead: 'Déjanos tus datos y el equipo de Datafin Beta se pondrá en contacto contigo.',
      submit: 'Quiero que me contacten', doneTitle: '¡Gracias por escribirnos!',
      doneText: 'Nos pondremos en contacto contigo muy pronto.',
    },
  };
  const el = {
    kicker: $('#caseKicker'), title: $('#caseTitle'), lead: $('#caseLead'), submit: $('#caseSubmit'),
    doneTitle: $('#caseDoneTitle'), doneText: $('#caseDoneText'),
  };
  const DEFAULT_SERVICE = select.options[0].value;
  let current = { intent: 'caso', service: '' };

  const openForm = (intent = 'caso', service = '') => {
    const cfg = INTENTS[intent] || INTENTS.caso;
    const svc = intent === 'servicio' ? service : '';
    const txt = (v) => (typeof v === 'function' ? v(svc) : v);
    current = { intent, service: svc };

    el.kicker.textContent = cfg.kicker;
    el.title.textContent = txt(cfg.title);
    el.lead.textContent = cfg.lead;
    el.submit.textContent = cfg.submit;
    el.doneTitle.textContent = cfg.doneTitle;
    el.doneText.textContent = txt(cfg.doneText);

    wrap.hidden = false; done.hidden = true; err.hidden = true;
    const opt = svc && [...select.options].find((o) => o.value === svc || o.textContent === svc);
    select.value = opt ? opt.value : DEFAULT_SERVICE;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    setTimeout(() => form.nombre.focus(), 60);
  };

  document.addEventListener('click', (e) => {
    const wa = e.target.closest('[data-whatsapp]');
    if (wa && WHATSAPP_NUMBER) {
      e.preventDefault();
      const base = WHATSAPP_TEXTS[wa.dataset.intent] || WHATSAPP_TEXTS.caso;
      const text = base.replace('{servicio}', wa.dataset.service || '');
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      return;
    }
    const trigger = wa || e.target.closest('[data-open-form]');
    if (!trigger) return;
    e.preventDefault();
    setMenu(false);
    openForm(trigger.dataset.intent, trigger.dataset.service);
  });

  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = form.nombre.value.trim();
    const celular = form.celular.value.replace(/\D/g, '');
    if (nombre.length < 3) return showError('Escribe tu nombre completo.');
    if (celular.length < 7) return showError('Escribe un número de celular válido.');
    if (!form.acepta.checked) return showError('Debes autorizar el tratamiento de tus datos para continuar.');
    err.hidden = true;

    // TODO: enviar `payload` a tu backend / CRM / automatización antes de publicar.
    const payload = { nombre, celular, servicio: form.servicio.value, origen: current.intent, fecha: new Date().toISOString() };
    console.info('[Datafin] solicitud (pendiente de conectar):', payload);

    wrap.hidden = true; done.hidden = false;
    form.reset();
  });

  function showError(msg) { err.textContent = msg; err.hidden = false; }
})();
