/* Datafin Beta — interacciones de la landing */
(() => {
  'use strict';

  // Configuración -----------------------------------------------------------
  // Número de WhatsApp en formato internacional sin "+".
  const WHATSAPP_NUMBER = '573127045885';
  // Servicio que responde con el estado del proceso (se define en index.html). Vacío = en preparación.
  const PROCESO_API = (window.DATAFIN_PROCESO_API || '').trim();
  // Fecha desde la que se pueden consultar procesos en la web, por ejemplo '15 de noviembre de 2026'.
  // Vacía = el mensaje de «no encontrado» habla del «lanzamiento de este servicio» sin dar fecha.
  const FECHA_LANZAMIENTO = '';

  const track = (n, p) => { if (window.datafinTrack) window.datafinTrack(n, p); };
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

  // Las entradas al hacer scroll y la línea de "Cómo funciona" las activa motion.js

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
      if (!src) { ph.classList.add('on'); return; }
      const img = document.createElement('img');
      img.src = src;
      img.alt = slot.dataset.label;
      img.decoding = 'async';
      slot.appendChild(img);
      slot.classList.add('loaded');
    });
  });

  // Consultar mi caso: estado del proceso (número de proceso + código de seguridad) ------
  const dialog = $('#caseDialog');
  const form = $('#caseForm');
  const err = $('#caseError');
  const wrap = $('#caseFormWrap');
  const result = $('#caseResult');
  const submitBtn = $('#caseSubmit');
  const codeToggle = $('#codeToggle');
  const waLink = (texto) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;

  // Ejemplo para revisar el diseño mientras no haya servicio conectado (no son datos reales)
  const DEMO = {
    proceso: 'DF-2026-00000', codigo: 'DEMO00',
    respuesta: {
      ok: true, demo: true, nombre: 'Jhon',
      procesos: [
        { consecutivo: 'DF-2026-00000', tipo: 'Castigo de permanencia', etapa: 'Tutela', subestado: 'Admitida',
          descripcion: 'El juzgado ya tiene tu solicitud. Estamos esperando sus siguientes actuaciones.',
          proximoPaso: 'Esperar la decisión del juzgado', actualizado: '2026-09-29',
          etapas: ['Petición', 'Verificación', 'Desacato', 'Tutela', 'Impugnación', 'Revisión SIC', 'Cerrado'], etapaIndex: 3 },
        { consecutivo: 'DF-2026-00001', tipo: 'Reporte negativo', etapa: 'Petición', subestado: 'Radicada',
          descripcion: 'Presentamos tu solicitud ante la entidad y esperamos su respuesta.',
          proximoPaso: 'Esperar la respuesta de la entidad', actualizado: '2026-10-02',
          etapas: ['Petición', 'Verificación', 'Desacato', 'Tutela', 'Impugnación', 'Revisión SIC', 'Cerrado'], etapaIndex: 0 },
      ],
    },
  };

  if (!PROCESO_API) {
    const aviso = nodo('p', 'modal__demo');
    aviso.append('Vista previa: para ver un ejemplo usa ', nodo('strong', '', 'DF-2026-00000'), ' y el código ', nodo('strong', '', 'DEMO00'), '.');
    $('.modal__help', form).after(aviso);
  }

  let intentos = 0;
  let bloqueoHasta = 0;

  const showForm = () => {
    result.hidden = true; wrap.hidden = false; err.hidden = true;
    form.reset();
    setCodeVisible(false);
  };
  const openForm = () => {
    track('consulta_proceso_abrir');
    showForm();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    setTimeout(() => form.proceso.focus(), 60);
  };
  function setCodeVisible(v) {
    form.codigo.type = v ? 'text' : 'password';
    codeToggle.textContent = v ? 'Ocultar' : 'Mostrar';
    codeToggle.setAttribute('aria-pressed', String(v));
  }
  function showError(msg) { err.textContent = msg; err.hidden = false; }

  // "130", "df2026130" o "DF-2026-00130" -> "DF-2026-00130"
  const normalizaProceso = (v) => {
    const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const m = s.match(/^DF(\d{4})(\d{1,5})$/);
    return m ? `DF-${m[1]}-${m[2].padStart(5, '0')}` : null;
  };

  const fecha = (v) => {
    const m = String(v).match(/^\d{4}-\d{2}-\d{2}/);          // acepta «2026-10-02» y «2026-10-02T05:00:00Z»
    const d = new Date(`${m ? m[0] : v}T12:00:00`);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  function nodo(tag, cls, txt) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined && txt !== null) n.textContent = txt;
    return n;
  }

  function tarjetaProceso(p) {
    const card = nodo('article', 'proc');
    const head = nodo('header', 'proc__head');
    head.append(nodo('span', 'proc__id', p.consecutivo));
    if (p.tipo) head.append(nodo('span', 'proc__tipo', p.tipo));
    card.append(head);
    const etapaTxt = [p.etapa, p.subestado].filter(Boolean).join(' · ');
    if (etapaTxt) card.append(nodo('p', 'proc__etapa', etapaTxt));
    if (Array.isArray(p.etapas) && p.etapas.length > 1 && Number.isInteger(p.etapaIndex)) {
      const bar = nodo('div', 'proc__bar');
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', `Etapa ${p.etapaIndex + 1} de ${p.etapas.length}: ${p.etapas[p.etapaIndex]}`);
      // Solo se resalta la etapa actual: algunos procesos se saltan etapas, así que no se marca ninguna como «hecha».
      p.etapas.forEach((e, i) => { bar.append(nodo('i', i === p.etapaIndex ? 'now' : '')); });
      card.append(bar);
      card.append(nodo('p', 'proc__count', `Etapa ${p.etapaIndex + 1} de ${p.etapas.length}`));
    }
    if (p.descripcion) card.append(nodo('p', 'proc__desc', p.descripcion));
    const dl = nodo('dl', 'proc__data');
    if (p.entidad) { const r = nodo('div'); r.append(nodo('dt', '', 'Entidad'), nodo('dd', '', p.entidad)); dl.append(r); }
    if (p.proximoPaso) { const r = nodo('div'); r.append(nodo('dt', '', 'Próximo paso'), nodo('dd', '', p.proximoPaso)); dl.append(r); }
    if (p.actualizado) { const r = nodo('div'); r.append(nodo('dt', '', 'Última actualización'), nodo('dd', '', fecha(p.actualizado))); dl.append(r); }
    if (dl.children.length) card.append(dl);
    return card;
  }

  function muestraResultado(data, proceso) {
    result.replaceChildren();
    result.append(nodo('p', 'kicker', 'Estado de tu proceso'));
    result.append(nodo('h2', '', data.nombre ? `Hola, ${data.nombre}` : 'Tu proceso'));
    result.append(nodo('p', 'muted', data.procesos.length > 1 ? 'Estos son tus procesos y en qué etapa va cada uno.' : 'Esto es lo que tenemos registrado de tu proceso.'));
    if (data.demo) result.append(nodo('p', 'proc__demo', 'Vista de ejemplo: estos datos no son reales. Así verás tu proceso cuando esté conectado.'));
    const lista = nodo('div', 'procs');
    data.procesos.forEach((p) => lista.append(tarjetaProceso(p)));
    result.append(lista);
    const acciones = nodo('div', 'modal__actions');
    const hablar = nodo('a', 'btn btn--primary btn--lg', 'Hablar con mi asesor');
    hablar.href = waLink(`Hola, quiero consultar sobre mi proceso ${proceso}.`);
    hablar.target = '_blank'; hablar.rel = 'noopener';
    hablar.addEventListener('click', () => track('whatsapp_click', { origen: 'consulta_proceso' }));
    const otra = nodo('button', 'btn btn--line btn--lg', 'Consultar otro proceso');
    otra.type = 'button';
    otra.addEventListener('click', () => { showForm(); form.proceso.focus(); });
    acciones.append(hablar, otra);
    result.append(acciones);
    wrap.hidden = true; result.hidden = false;
    result.scrollTop = 0;
  }

  async function consulta(proceso, codigo) {
    if (!PROCESO_API) {
      if (proceso === DEMO.proceso && codigo === DEMO.codigo) return DEMO.respuesta;
      return { ok: false, error: 'en_preparacion' };
    }
    // Cuerpo como texto plano y sin encabezados propios: así el navegador no hace consulta previa (CORS)
    // y Google Apps Script responde. Apps Script contesta con una redirección, que fetch sigue solo.
    const r = await fetch(PROCESO_API, {
      method: 'POST', body: JSON.stringify({ proceso, codigo }), redirect: 'follow',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-proceso]');
    if (!t) return;
    e.preventDefault();
    setMenu(false);
    openForm();
  });
  codeToggle.addEventListener('click', () => setCodeVisible(form.codigo.type === 'password'));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  form.codigo.addEventListener('input', () => { form.codigo.value = form.codigo.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (Date.now() < bloqueoHasta) return showError('Hiciste varios intentos. Espera un momento e inténtalo de nuevo.');
    const proceso = normalizaProceso(form.proceso.value);
    const codigo = form.codigo.value.trim().toUpperCase();
    if (!proceso) return showError('Escribe tu número de proceso completo, por ejemplo DF-2026-00130.');
    if (codigo.length !== 6) return showError('Tu código de seguridad tiene 6 caracteres.');
    err.hidden = true;
    form.proceso.value = proceso;

    submitBtn.disabled = true;
    submitBtn.firstElementChild.textContent = 'Consultando…';
    try {
      const data = await consulta(proceso, codigo);
      if (data && data.ok && Array.isArray(data.procesos) && data.procesos.length) {
        intentos = 0;
        track('consulta_proceso', { resultado: data.demo ? 'demo' : 'ok' });
        muestraResultado(data, proceso);
      } else if (data && data.error === 'en_preparacion') {
        showError('Esta consulta estará disponible muy pronto. Mientras tanto, escríbenos por WhatsApp y te contamos cómo va tu proceso.');
      } else if (data && data.error === 'limite') {
        showError('Demasiados intentos. Espera unos minutos o escríbenos por WhatsApp.');
      } else if (data && data.error === 'no_coincide') {
        intentos += 1;
        if (intentos >= 5) { bloqueoHasta = Date.now() + 60000; intentos = 0; }
        const desde = FECHA_LANZAMIENTO ? `desde el ${FECHA_LANZAMIENTO}` : 'desde el lanzamiento de este servicio';
        showError(`Esta consulta funciona para procesos iniciados ${desde}. Si tu proceso empezó antes, escríbenos por WhatsApp y con gusto te contamos cómo va.`);
      } else {
        showError('Ahora mismo no podemos consultarlo. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.');
      }
    } catch (error) {
      showError('Ahora mismo no podemos consultarlo. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.firstElementChild.textContent = 'Consultar mi caso';
    }
  });

  // Chat flotante estilo WhatsApp: el cliente escribe su pregunta y se envía a WhatsApp ------
  const waToggle = $('#waToggle');
  const waPanel = $('#waPanel');
  if (waToggle && waPanel) {
    const waLog = $('#waLog');
    const waForm = $('#waForm');
    const waText = $('#waText');
    const waSend = $('#waSend');
    const hora = () => new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
    $$('.wa-msg--in time', waLog).forEach((t) => { t.textContent = hora(); });

    const setChat = (open) => {
      waPanel.hidden = !open;
      waToggle.setAttribute('aria-expanded', String(open));
      waToggle.setAttribute('aria-label', open ? 'Cerrar chat de WhatsApp' : 'Abrir chat de WhatsApp');
      if (open) { track('chat_open'); setTimeout(() => waText.focus({ preventScroll: true }), 80); }
    };
    const scrollEnd = () => { waLog.scrollTop = waLog.scrollHeight; };
    const grow = () => {
      waText.style.height = 'auto';
      waText.style.height = Math.min(waText.scrollHeight, 120) + 'px';
      waSend.disabled = waText.value.trim() === '';
    };
    const addMsg = (cls, html) => {
      const m = document.createElement('div');
      m.className = `wa-msg ${cls} wa-msg--new`;
      m.innerHTML = html;
      waLog.appendChild(m);
      scrollEnd();
      return m;
    };
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    waToggle.addEventListener('click', () => setChat(waPanel.hidden));
    $('#waClose').addEventListener('click', () => { setChat(false); waToggle.focus(); });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !waPanel.hidden && !dialog.open) { setChat(false); waToggle.focus(); }
    });

    $$('.wa-chips button', waLog).forEach((b) => b.addEventListener('click', () => {
      waText.value = b.dataset.q;
      grow();
      waText.focus();
      waText.setSelectionRange(waText.value.length, waText.value.length);
    }));

    waText.addEventListener('input', grow);
    waText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!waSend.disabled) waForm.requestSubmit(); }
    });

    waForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pregunta = waText.value.trim();
      if (!pregunta) return;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(pregunta)}`;
      addMsg('wa-msg--out', `<p>${esc(pregunta)}</p><time>${hora()} <svg class="ico ico--flat" aria-hidden="true"><use href="#i-checks"/></svg></time>`);
      waText.value = '';
      grow();
      track('whatsapp_click', { origen: 'chat_flotante' });
      window.open(url, '_blank', 'noopener');
      setTimeout(() => {
        addMsg('wa-msg--in', `<p>¡Listo! Abrimos WhatsApp con tu pregunta. Pulsa <strong>Enviar</strong> allí y un asesor te responderá. ¿No se abrió? <a href="${url}" target="_blank" rel="noopener">Toca aquí</a>.</p><time>${hora()}</time>`);
      }, 450);
    });
  }

})();
