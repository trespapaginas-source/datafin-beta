/* Datafin Beta — sistema de movimiento (entradas, hero, profundidad e interacción)
   Sin librerías: CSS para animar, un solo IntersectionObserver para activar
   y un solo listener de scroll compartido. */
(() => {
  'use strict';

  const root = document.documentElement;
  if (window.__mf) clearTimeout(window.__mf);          // el JS llegó a tiempo: cancela el plan B

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const mq = (q) => window.matchMedia(q);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // Configuración central (tiempos en ms; la curva y las distancias viven en motion.css) -------
  const MOTION = {
    io: { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },   // cuándo entra cada bloque
    hero: {                                                    // línea de tiempo del hero
      eyebrow: 120, title: 220, lineStep: 140, lead: 640, ctas: 780, trust: 900, trustStep: 80, photo: 260,
      navLinks: 100, navStep: 55, navCta: 460, end: 1100,
    },
    phone: 0.78,                                               // el hero se acorta un 22 % en móvil
    parallax: '(min-width: 1041px) and (hover: hover) and (pointer: fine)',
    magnet: { query: '(hover: hover) and (pointer: fine)', x: 7, y: 5 },
    faq: { ms: 380, ease: 'cubic-bezier(.16, 1, .3, 1)' },
    spy: '-35% 0px -50% 0px',                                 // franja central que marca la sección activa
  };

  const reduce = mq('(prefers-reduced-motion: reduce)').matches;
  const late = root.classList.contains('m-fallback');          // el JS llegó tarde: no animar
  const bootAt = performance.now();

  // Scroll compartido: una sola escucha, una sola pasada por frame ------------------------------
  const tasks = new Set();
  let queued = false;
  const run = () => { queued = false; tasks.forEach((t) => t()); };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);

  // Preparación del marcado -------------------------------------------------------------------
  const span = (cls) => { const s = document.createElement('span'); s.className = cls; return s; };
  const wrapInner = (el, outerCls, innerCls) => {
    const outer = span(outerCls), inner = span(innerCls);
    while (el.firstChild) inner.appendChild(el.firstChild);
    outer.appendChild(inner);
    el.appendChild(outer);
  };

  // Títulos: se conserva el texto real; solo se añade una capa que sirve de máscara
  $$('.hero h1 .ln').forEach((ln) => {
    const inner = span('ln__in');
    while (ln.firstChild) inner.appendChild(ln.firstChild);
    ln.appendChild(inner);
  });
  $$('[data-head]').forEach((g) => {
    let i = 0;
    [...g.children].forEach((c) => {
      if (c.matches('[data-stagger], .reveal')) return;      // esos se animan por su cuenta
      if (c.matches('h1, h2')) wrapInner(c, 'mk', 'mk__in');
      else c.classList.add('m-it');
      c.style.setProperty('--i', i++);
    });
  });
  $$('[data-stagger]').forEach((g) => [...g.children].forEach((c, i) => c.style.setProperty('--i', i)));
  $$('.nav__links > *').forEach((c, i) => c.style.setProperty('--i', i));

  // Entradas al hacer scroll (una sola vez por visita) ----------------------------------------
  const targets = $$('.reveal, [data-stagger], [data-head]');
  if (late) {
    targets.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        // Bloques que ya se ven al cargar esperan a que termine el hero
        if (el.hasAttribute('data-after-hero') && performance.now() - bootAt < 900) {
          const extra = parseFloat(el.getAttribute('data-after-hero')) || 0;
          el.style.setProperty('--d', `${MOTION.hero.end / 1000 + extra}s`);
        }
        el.classList.add('in');
        io.unobserve(el);
      });
    }, MOTION.io);
    targets.forEach((el) => io.observe(el));
  }

  // Hero: coreografía de entrada ---------------------------------------------------------------
  const startHero = () => {
    const H = MOTION.hero;
    const k = mq('(max-width: 760px)').matches ? MOTION.phone : 1;
    const set = (el, ms) => el && el.style.setProperty('--h', Math.round(ms * k));

    $$('[data-hero]').forEach((el) => set(el, H[el.dataset.hero] || 0));
    $$('.hero h1 .ln__in').forEach((el, i) => set(el, H.title + i * H.lineStep));
    $$('[data-hero="trust"] > li').forEach((el, i) => set(el, H.trust + i * H.trustStep));
    set($('.nav .logo'), 0);
    $$('.nav__links > a').forEach((el, i) => set(el, H.navLinks + i * H.navStep));
    set($('.nav__cta'), H.navCta);
    set($('.nav__toggle'), 240);
    root.classList.add('m-hero');
  };
  if (late) root.classList.add('m-hero');
  else if (reduce) startHero();
  else {
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise((r) => setTimeout(r, 450))])
      .then(() => setTimeout(startHero, 30));
  }

  // El resplandor ambiental del hero se pausa cuando no se ve
  const hero = $('.hero');
  if (hero && !late) {
    new IntersectionObserver(([en]) => hero.classList.toggle('m-off', !en.isIntersecting)).observe(hero);
  }

  // Profundidad por scroll (solo escritorio con puntero; en móvil no se ejecuta) ----------------
  // data-parallax="k": 'top' (por defecto) = baja k px por cada px de scroll, hasta data-max;
  //                    mode="rise" = la capa sube k px hasta asentarse al entrar en pantalla.
  const layers = $$('[data-parallax]').map((el) => ({
    el, k: parseFloat(el.dataset.parallax) || 0, mode: el.dataset.mode || 'top',
    max: parseFloat(el.dataset.max) || 60, vis: true, y: -1,
  }));
  if (layers.length && !late) {
    const parQ = mq(MOTION.parallax);
    let on = false;
    const update = () => {
      const vh = window.innerHeight, sy = window.scrollY;
      layers.forEach((p) => {
        if (!p.vis) return;
        let y;
        if (p.mode === 'rise') {
          const top = p.el.parentElement.getBoundingClientRect().top;
          y = (1 - clamp((vh - top) / (vh * 0.75), 0, 1)) * p.k;
        } else {
          y = clamp(sy * p.k, 0, p.max);
        }
        if (Math.abs(y - p.y) > 0.3) { p.y = y; p.el.style.setProperty('--py', `${y.toFixed(1)}px`); }
      });
    };
    const vis = new IntersectionObserver((entries) => {
      entries.forEach((en) => { const p = layers.find((l) => l.el === en.target); if (p) p.vis = en.isIntersecting; });
      if (on) queue();
    }, { rootMargin: '150px 0px' });
    layers.forEach((p) => vis.observe(p.el));

    const sync = () => {
      const want = parQ.matches && !reduce;
      if (want === on) return;
      on = want;
      if (on) { tasks.add(update); update(); }
      else { tasks.delete(update); layers.forEach((p) => { p.el.style.removeProperty('--py'); p.y = -1; }); }
    };
    parQ.addEventListener('change', sync);
    sync();
  }

  // Cómo funciona: la línea y los pasos avanzan con el scroll (sin secuestrarlo) ----------------
  const stepsEl = $('#steps');
  if (stepsEl && !late && !reduce) {
    const items = $$('.step', stepsEl);
    const vertical = mq('(max-width: 860px)');
    let visible = true;
    const upd = () => {
      if (!visible) return;
      const vh = window.innerHeight;
      if (vertical.matches) {
        // Vertical: cada paso se activa al llegar a la parte baja de la pantalla; su línea baja hasta el siguiente
        items.forEach((it) => {
          const r = it.getBoundingClientRect();
          if (r.top < vh * 0.86) it.classList.add('on');
          it.style.setProperty('--f', clamp((vh * 0.82 - (r.top + 26)) / r.height, 0, 1).toFixed(3));
        });
      } else {
        // Horizontal: un solo avance repartido entre los cuatro pasos
        const r = stepsEl.getBoundingClientRect();
        const t = clamp((vh * 0.85 - r.top) / Math.max(r.height * 0.8, vh * 0.45), 0, 1);
        items.forEach((it, i) => {
          if (t * items.length > i - 0.25) it.classList.add('on');
          it.style.setProperty('--f', clamp(t * items.length - i, 0, 1).toFixed(3));
        });
      }
    };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) queue(); }, { rootMargin: '200px 0px' }).observe(stepsEl);
    tasks.add(upd);
    root.classList.add('m-steps');
    upd();                                                   // estado inicial sin esperar al primer scroll
  }

  // Menú: sección activa -----------------------------------------------------------------------
  const spy = $$('.nav__links a[href^="#"]').map((a) => ({ a, sec: $(a.getAttribute('href')) })).filter((x) => x.sec);
  if (spy.length && !late) {
    let current = null;
    const mark = () => spy.forEach(({ a, sec }) => {
      const on = sec === current;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    const spyIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) current = en.target;
        else if (current === en.target) current = null;
      });
      mark();
    }, { rootMargin: MOTION.spy });
    spy.forEach(({ sec }) => spyIO.observe(sec));
  }

  // Preguntas frecuentes: altura animada, sin perder el comportamiento nativo -------------------
  $$('.qa').forEach((d) => {
    const sum = d.querySelector('summary');
    if (!sum || !d.animate) return;
    if (d.open) d.classList.add('is-open');
    sum.addEventListener('click', (e) => {
      if (reduce) return;                                    // sin animación: comportamiento nativo
      e.preventDefault();
      const willOpen = !(d._want !== undefined ? d._want : d.open);
      d._want = willOpen;
      const from = d.offsetHeight;
      d.open = true;                                          // abierto para poder medir
      const border = d.offsetHeight - d.clientHeight;
      const to = willOpen ? d.scrollHeight + border : sum.offsetHeight + border;
      d.classList.toggle('is-open', willOpen);
      d.classList.toggle('is-closing', !willOpen);
      d.style.overflow = 'hidden';
      if (d._a) d._a.cancel();
      const a = d._a = d.animate({ height: [`${from}px`, `${to}px`] }, { duration: MOTION.faq.ms, easing: MOTION.faq.ease });
      a.onfinish = () => {
        d.open = willOpen;
        d.classList.remove('is-closing');
        d.style.overflow = '';
        d._a = null;
      };
    });
  });

  // Botones principales: imán muy sutil, solo con ratón ----------------------------------------
  if (!reduce && mq(MOTION.magnet.query).matches) {
    $$('.btn--primary.btn--lg:not(.btn--block)').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / r.width;
        const y = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.translate = `${(x * MOTION.magnet.x * 2).toFixed(1)}px ${(y * MOTION.magnet.y * 2).toFixed(1)}px`;
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  }
})();
