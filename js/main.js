// Ágora · interacciones de todas las páginas.
// Cada bloque se activa solo si su elemento existe en la página.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const menosMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Textos según el idioma de la página (<html lang>)
  const TEXTOS = {
    es: { abrir: 'Abrir menú', cerrar: 'Cerrar menú', pausar: 'Pausar el vídeo', reproducir: 'Reproducir el vídeo',
          revisa: 'Revisa los campos marcados.', gracias: 'Gracias. Te confirmaremos la reserva por email en breve.',
          error: 'No se ha podido enviar. Llámanos al 938 000 000.', platos: (n, total) => `${n} de ${total} platos` },
    ca: { abrir: 'Obre el menú', cerrar: 'Tanca el menú', pausar: 'Pausa el vídeo', reproducir: 'Reprodueix el vídeo',
          revisa: 'Revisa els camps marcats.', gracias: 'Gràcies. Et confirmarem la reserva per correu en breu.',
          error: "No s'ha pogut enviar. Truca'ns al 938 000 000.", platos: (n, total) => `${n} de ${total} plats` },
    en: { abrir: 'Open menu', cerrar: 'Close menu', pausar: 'Pause video', reproducir: 'Play video',
          revisa: 'Please check the highlighted fields.', gracias: 'Thank you. We will confirm your booking by email shortly.',
          error: 'It could not be sent. Please call us on +34 938 000 000.', platos: (n, total) => `${n} of ${total} dishes` },
  };
  const t = TEXTOS[document.documentElement.lang] || TEXTOS.es;

  // Ejecuta `alEntrar(elemento)` cuando un elemento entra en pantalla (y `alSalir` cuando sale)
  const vigilar = (elementos, alEntrar, alSalir, opciones) => {
    const io = new IntersectionObserver((entradas) => entradas.forEach((e) =>
      (e.isIntersecting ? alEntrar : alSalir)?.(e.target, io)), opciones);
    elementos.forEach((el) => io.observe(el));
  };

  // Cabecera: transparente sobre la portada y sólida al bajar (o siempre, con data-solid)
  function cabecera() {
    const top = $('#top');
    if (!top) return;
    const actualizar = () => top.classList.toggle('solid', top.hasAttribute('data-solid') || scrollY > innerHeight * 0.6);
    actualizar();
    addEventListener('scroll', actualizar, { passive: true });
  }

  // Menú del móvil: abrir, cerrar al elegir enlace y cerrar con Escape
  function menuMovil() {
    const boton = $('.menu-btn'), menu = $('#menu');
    if (!boton) return;
    const abrir = (abierto) => {
      boton.setAttribute('aria-expanded', abierto);
      boton.setAttribute('aria-label', abierto ? t.cerrar : t.abrir);
      menu.classList.toggle('open', abierto);
      document.body.classList.toggle('menu-open', abierto);
    };
    boton.addEventListener('click', () => abrir(boton.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => e.target.closest('a') && abrir(false));
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) { abrir(false); boton.focus(); }
    });
  }

  // Aparición suave de los bloques .reveal al hacer scroll
  function apariciones() {
    const bloques = $$('.reveal');
    if (menosMovimiento) return bloques.forEach((el) => el.classList.add('in'));
    vigilar(bloques, (el, io) => { el.classList.add('in'); io.unobserve(el); }, null, { rootMargin: '0px 0px -10% 0px' });
  }

  // Vídeo de portada: solo en pantallas grandes, sin ahorro de datos ni «menos movimiento».
  // Se carga después de la página para no retrasarla, y se pausa cuando la portada no se ve.
  function videoPortada() {
    const video = $('.hero-video'), boton = $('.video-btn');
    const red = navigator.connection || {};
    const sinVideo = menosMovimiento || red.saveData || /2g|3g/.test(red.effectiveType || '') || innerWidth < 768;
    if (!video || sinVideo) return;

    let pausadoPorUsuario = false;
    const reproducir = () => video.play().catch(() => {});   // si el navegador bloquea el autoplay, queda la foto
    const pausar = (si) => {
      si ? video.pause() : reproducir();
      boton.classList.toggle('paused', si);
      boton.setAttribute('aria-label', si ? t.reproducir : t.pausar);
    };

    addEventListener('load', () => { video.src = video.dataset.src; reproducir(); });
    video.addEventListener('playing', () => { video.classList.add('on'); boton.hidden = false; }, { once: true });
    video.addEventListener('error', () => video.remove());
    boton.addEventListener('click', () => { pausadoPorUsuario = !video.paused; pausar(pausadoPorUsuario); });
    vigilar([video.closest('.hero')], () => !pausadoPorUsuario && video.src && reproducir(), () => video.pause());
  }

  // Formulario de reserva: validación accesible y envío (simulado mientras no haya ID de Formspree)
  function formularioReserva() {
    const form = $('#form-reserva');
    if (!form) return;
    const msg = $('.form-msg', form);
    const avisar = (texto, tipo) => { msg.textContent = texto; msg.className = `form-msg ${tipo}`; };
    const hoy = new Date();
    form.elements.fecha.min = new Date(hoy - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const campos = [...form.elements].filter((el) => el.willValidate);
      campos.forEach((el) => el.setAttribute('aria-invalid', !el.checkValidity()));
      const primerError = campos.find((el) => !el.checkValidity());
      if (primerError) { avisar(t.revisa, 'err'); return primerError.focus(); }
      if (form.elements._gotcha.value) return;   // antispam: campo trampa relleno

      try {
        const demo = form.action.includes('TU_ID');
        const r = demo ? { ok: true } : await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(r.status);
        avisar(t.gracias, 'ok');
        form.reset();
      } catch {
        avisar(t.error, 'err');
      }
    });
  }

  // Carta: filtro de alérgenos y sección activa en la barra superior
  function filtroAlergenos() {
    const caja = $('.filtro-box');
    if (!caja) return;
    const chips = $$('.f-chip'), platos = $$('.dish'), quitar = $('.f-clear');
    caja.open = innerWidth > 900;   // plegado en el móvil para no tapar la carta

    const aplicar = () => {
      const excluidos = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.al);
      platos.forEach((p) => { p.hidden = excluidos.some((a) => p.dataset.al.split(' ').includes(a)); });
      $$('.cat').forEach((cat) => { $('.cat-empty', cat).hidden = $$('.dish:not([hidden])', cat).length > 0; });
      const visibles = platos.filter((p) => !p.hidden).length;
      $('.filtro-count').textContent = excluidos.length ? t.platos(visibles, platos.length) : '';
      quitar.hidden = !excluidos.length;
    };
    chips.forEach((c) => c.addEventListener('click', () => {
      c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true');
      aplicar();
    }));
    quitar.addEventListener('click', () => {
      chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
      aplicar();
      chips[0].focus();
    });

    const enlaces = $$('.cat-nav a');
    vigilar($$('.cat, .degus'), (seccion) =>
      enlaces.forEach((a) => a.classList.toggle('active', a.hash === `#${seccion.id}`)), null, { rootMargin: '-30% 0px -60% 0px' });
  }

  cabecera();
  menuMovil();
  apariciones();
  videoPortada();
  formularioReserva();
  filtroAlergenos();
})();
