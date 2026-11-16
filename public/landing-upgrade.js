/* GameVault: mejora visual de la pantalla publica. No cambia la API ni la autenticacion. */
(() => {
  'use strict';

  const slides = [
    { title: 'Minecraft', subtitle: 'Construye tu próxima aventura', image: 'images/minecraft.jpg' },
    { title: 'Genshin Impact', subtitle: 'Explora mundos extraordinarios', image: 'images/genshin.png' },
    { title: 'Hollow Knight', subtitle: 'Descubre cada rincón del reino', image: 'images/hollow-knight.png' }
  ];

  const gamepad = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.4 8.5h11.2a4 4 0 0 1 3.9 3.2l1 5a2.5 2.5 0 0 1-4.2 2.3l-2.4-2.3H8.1l-2.4 2.3a2.5 2.5 0 0 1-4.2-2.3l1-5a4 4 0 0 1 3.9-3.2Z"/><path d="M7 11.2v4.2M4.9 13.3h4.2"/><circle cx="16.2" cy="11.7" r=".7" fill="currentColor" stroke="none"/><circle cx="18.3" cy="13.8" r=".7" fill="currentColor" stroke="none"/></svg>`;
  const layers = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/></svg>`;
  const people = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7.5" r="3"/><path d="M3 20v-2.5a6 6 0 0 1 12 0V20H3ZM17 5a3 3 0 0 1 0 6M17.4 14a5 5 0 0 1 3.6 4.8V20"/></svg>`;

  function upgradeHome() {
    const home = document.querySelector('#app > main.home');
    if (!home || home.classList.contains('gv-landing-ready')) return;

    home.classList.add('gv-landing-ready');
    home.innerHTML = `
      <div class="gv-ambient gv-ambient-left" aria-hidden="true"></div>
      <div class="gv-ambient gv-ambient-right" aria-hidden="true"></div>

      <header class="gv-landing-header">
        <div class="gv-logo"><span class="gv-logo-icon">${gamepad}</span><span><strong>GAME</strong>VAULT</span></div>
        <nav class="gv-header-actions" aria-label="Acceso">
          <button type="button" class="gv-button gv-button-outline gv-header-btn" onclick="go('login')">Iniciar sesión</button>
          <button type="button" class="gv-button gv-button-solid gv-header-btn" onclick="go('register')">Crear cuenta</button>
        </nav>
      </header>

      <section class="gv-landing-hero" aria-labelledby="gv-hero-title">
        <div class="gv-hero-copy">
          <div class="gv-eyebrow"><span class="gv-eyebrow-dot"></span> TU ESPACIO GAMER</div>
          <h1 id="gv-hero-title">Tu universo de<br><span>videojuegos</span> en un<br>solo lugar</h1>
          <p>Explora nuevos mundos, amplía tu biblioteca y comparte tus experiencias en una misma plataforma.</p>
          <div class="gv-hero-actions">
            <button type="button" class="gv-button gv-button-solid gv-button-primary" onclick="go('register')">${gamepad}<span>Crear cuenta</span><span class="gv-arrow" aria-hidden="true">→</span></button>
            <button type="button" class="gv-button gv-button-outline gv-button-primary" onclick="go('login')">Iniciar sesión</button>
          </div>
          <div class="gv-hero-note"><span aria-hidden="true">✦</span> Tu próxima aventura empieza aquí</div>
        </div>

        <div class="gv-showcase-wrap">
          <div class="gv-showcase" aria-label="Videojuego destacado">
            <div class="gv-showcase-inner">
              <div class="gv-showcase-fallback" aria-hidden="true">GAMEVAULT</div>
              <img class="gv-showcase-image" src="images/minecraft.jpg" alt="Portada de Minecraft" decoding="async">
              <div class="gv-showcase-shade"></div>
              <div class="gv-showcase-caption"><span class="gv-showcase-tag">DESTACADO</span><strong class="gv-showcase-title">Minecraft</strong><span class="gv-showcase-subtitle">Construye tu próxima aventura</span></div>
            </div>
          </div>
          <div class="gv-slider-nav" aria-label="Elegir videojuego destacado">
            ${slides.map((slide, i) => `<button type="button" class="gv-slider-dot${i === 0 ? ' active' : ''}" data-slide="${i}" aria-label="Mostrar ${slide.title}" aria-pressed="${i === 0}"></button>`).join('')}
          </div>
        </div>
      </section>

      <section class="gv-landing-features" aria-label="Qué puedes hacer en GameVault">
        <div class="gv-feature"><span class="gv-feature-icon">${gamepad}</span><div><h2>Descubre juegos</h2><p>Explora el catálogo y encuentra tu próxima aventura.</p></div></div>
        <div class="gv-feature"><span class="gv-feature-icon">${layers}</span><div><h2>Organiza tu biblioteca</h2><p>Mantén tus videojuegos adquiridos en un solo lugar.</p></div></div>
        <div class="gv-feature"><span class="gv-feature-icon">${people}</span><div><h2>Comparte tu opinión</h2><p>Valora videojuegos y descubre reseñas de la comunidad.</p></div></div>
      </section>
      <div class="gv-landing-bottom-glow" aria-hidden="true"></div>
    `;

    const image = home.querySelector('.gv-showcase-image');
    const captionTitle = home.querySelector('.gv-showcase-title');
    const captionSubtitle = home.querySelector('.gv-showcase-subtitle');
    const dots = [...home.querySelectorAll('.gv-slider-dot')];

    image.addEventListener('error', () => image.classList.add('gv-image-missing'));
    image.addEventListener('load', () => image.classList.remove('gv-image-missing'));

    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const index = Number(dot.dataset.slide);
        const slide = slides[index];
        if (!slide) return;
        image.classList.remove('gv-image-missing');
        image.src = slide.image;
        image.alt = `Portada de ${slide.title}`;
        captionTitle.textContent = slide.title;
        captionSubtitle.textContent = slide.subtitle;
        dots.forEach((other, otherIndex) => {
          const active = otherIndex === index;
          other.classList.toggle('active', active);
          other.setAttribute('aria-pressed', String(active));
        });
      });
    });
  }

  const app = document.getElementById('app');
  if (!app) return;
  new MutationObserver(upgradeHome).observe(app, {childList: true, subtree: true});
  upgradeHome();
})();
