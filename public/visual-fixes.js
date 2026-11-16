
(() => {
  'use strict';

  const labels = new Map(Object.entries({
    'crear cuenta': 'Crear cuenta',
    'recordarme': 'Recordarme',
    'aceptar términos y condiciones': 'Aceptar términos y condiciones',
    'todos': 'Todos',
    'ver juego': 'Ver juego',
    'perfil': 'Perfil',
    'en biblioteca ✓': 'En biblioteca ✓',
    'tus juegos': 'Tus juegos',
    'logros desbloqueados': 'Logros desbloqueados',
    'reseñas escritas': 'Reseñas escritas',
    'últimos juegos adquiridos:': 'Últimos juegos adquiridos:',
    'juegos recomendados:': 'Juegos recomendados:',
    'reseñas recientes:': 'Reseñas recientes:',
    'ver logros ▶': 'Ver logros ▶',
    'ver logros 🏆': 'Ver logros 🏆',
    'escribir reseña ⭐': 'Escribir reseña ⭐',
    'pagar ›': 'Pagar ›',
    'mi biblioteca': 'Mi biblioteca',
    'escribir reseña': 'Escribir reseña',
    'mis reseñas': 'Mis reseñas',
    'únete a nuestra comunidad gamer': 'Únete a nuestra comunidad gamer',
    'gestión de videojuegos': 'Gestión de videojuegos',
    'gestión de usuarios': 'Gestión de usuarios',
    'agregar videojuego': 'Agregar videojuego',
    'editar videojuego': 'Editar videojuego',
    'editar usuario': 'Editar usuario',
    'panel de administración': 'Panel de administración',
    'ventas confirmadas hoy': 'Ventas confirmadas hoy',
    'registros este mes': 'Registros este mes',
    'total usuarios': 'Total de usuarios'
  }));

  const localCovers = {
    'genshin impact': 'images/genshin.png',
    'hollow knight': 'images/hollow-knight.png',
    'minecraft': 'images/minecraft.jpg'
  };

  const imageStates = new Map();

  const placeholders = new Map(Object.entries({
    'correo electronico': 'Correo electrónico',
    'contraseña': 'Contraseña',
    'confirmar contraseña': 'Confirmar contraseña',
    'nombre completo': 'Nombre completo',
    'buscar juego...': 'Buscar juego...',
    'escribe tu opinión sobre el juego...': 'Escribe tu opinión sobre el juego...',
    'ej...25': 'Ej.: 25'
  }));

  function normalize(value) {
    return String(value).trim().toLocaleLowerCase('es');
  }

  function fixVisibleText(app) {
    const walker = document.createTreeWalker(
      app,
      NodeFilter.SHOW_TEXT
    );

    let node;

    while ((node = walker.nextNode())) {
      if (!node.parentElement) continue;

      if (node.parentElement.closest('script,style,textarea')) {
        continue;
      }

      const text = node.nodeValue;
      const key = normalize(text);

      if (!labels.has(key)) continue;

      const corrected = labels.get(key);

      if (text.trim() === corrected) continue;

      const leading = text.match(/^\s*/)?.[0] || '';
      const trailing = text.match(/\s*$/)?.[0] || '';

      node.nodeValue = leading + corrected + trailing;
    }

    app.querySelectorAll(
      'input[placeholder],textarea[placeholder]'
    ).forEach(field => {
      const correction = placeholders.get(
        normalize(field.placeholder)
      );

      if (correction && field.placeholder !== correction) {
        field.placeholder = correction;
      }
    });
  }

  function addLocalCovers(app) {
    app.querySelectorAll('.cover').forEach(cover => {
      const title = normalize(
        cover.querySelector('.cover-title')?.textContent || ''
      );

      const source = localCovers[title];

      if (!source) return;

      let imageState = imageStates.get(source);

      if (!imageState) {
        imageState = {
          loaded: false,
          failed: false
        };

        imageStates.set(source, imageState);

        const image = new Image();

        image.onload = () => {
          imageState.loaded = true;
          scheduleImprovement();
        };

        image.onerror = () => {
          imageState.failed = true;
        };

        image.src = source;
      }

      if (
        imageState.loaded &&
        cover.dataset.gvCover !== source
      ) {
        cover.style.backgroundImage =
          `linear-gradient(
            180deg,
            rgba(16,5,27,.10),
            rgba(16,5,27,.32)
          ), url("${source}")`;

        cover.dataset.gvCover = source;
        cover.classList.add('gv-local-cover');
      }
    });
  }

  function fixEmptyRating(app) {
    const rating = app.querySelector(
      '.detail-left-info .rating'
    );

    const gameName = app.querySelector(
      '.detail-right h2'
    )?.textContent?.trim();

    if (
      !rating ||
      !gameName ||
      typeof state === 'undefined'
    ) {
      return;
    }

    const current = state.games.find(
      game => game.title === gameName
    );

    if (
      current &&
      (current.rating === null ||
       current.rating === undefined) &&
      rating.textContent !== 'Sin calificaciones todavía'
    ) {
      rating.textContent = 'Sin calificaciones todavía';
    }
  }

  function improvePage() {
    const app = document.getElementById('app');

    if (!app) return;

    fixVisibleText(app);
    fixEmptyRating(app);
    addLocalCovers(app);
  }

  let scheduled = false;

  function scheduleImprovement() {
    if (scheduled) return;

    scheduled = true;

    queueMicrotask(() => {
      scheduled = false;
      improvePage();
    });
  }

  const app = document.getElementById('app');

  if (!app) return;

  new MutationObserver(
    scheduleImprovement
  ).observe(app, {
    subtree: true,
    childList: true,
    characterData: true
  });

  scheduleImprovement();
})();