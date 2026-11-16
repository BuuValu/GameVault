
const API_BASE = window.GAMEVAULT_API_BASE || '';

const seedGames = [
  {id:'halo',title:'Halo: The Master Chief Collection',genre:'accion',tags:['saga','disparos','primera persona'],age:'+16',price:89900,rating:4.8,description:'Saga de videojuegos de disparos en primera persona creada por Bungie y desarrollada actualmente por Halo Studios (antes 343 Industries) para Xbox y PC.',cover:'HALO',tone:'halo'},
  {id:'tbh',title:'TBH: Task Bar Hero',genre:'aventura',tags:['mundo abierto','historia'],age:'+7',price:90900,rating:4.8,description:'El RPG idle diminuto por excelencia. Adorables héroes en píxel esperan acompañarte en la aventura — desde tu barra de tareas. ¡Combate el aburrimiento!',cover:'TBH',tone:'tbh'},
  {id:'genshin',title:'Genshin Impact Gameplay',genre:'sci-fi',tags:['accion','aventura'],age:'+12',price:49900,rating:4.7,description:'Un popular videojuego de rol de acción y mundo abierto desarrollado por HoYoverse.',cover:'GENSHIN',tone:'genshin'},
  {id:'minecraft',title:'Java & Bedrock',genre:'aventura',tags:['construcción','mundo abierto'],age:'+7',price:74900,rating:4.9,description:'Explora mundos infinitos y construye todo lo que puedas imaginar.',cover:'JAVA & BEDROCK',tone:'minecraft'},
  {id:'mario',title:'Super Mario Bros. U Deluxe',genre:'aventura',tags:['plataformas','familia'],age:'+3',price:69900,rating:4.9,description:'Una gran aventura de plataformas para compartir con toda la familia.',cover:'SUPER MARIO',tone:'mario'},
  {id:'cyber',title:'Cyber World',genre:'accion',tags:['disparos','futurista'],age:'+16',price:89900,rating:4.8,description:'Atraviesa una ciudad futurista en una aventura de acción llena de desafíos.',cover:'CYBER WORLD',tone:'cyber'}
];

const achievementSets = {
  halo:[['Primer contacto','Completa la primera misión'],['Recluta Spartan','Termina un capítulo de la campaña'],['A la carrera','Gana tu primera partida multijugador'],['A salvo','Completa una misión sin morir'],['Equipo completo','Juega una misión cooperativa'],['Jefe Maestro','Completa la campaña']],
  tbh:[['Primer turno','Completa tu primera tarea'],['Barra despejada','Derrota 25 enemigos'],['Héroe constante','Juega durante 30 minutos'],['Sin distracciones','Completa 10 tareas seguidas'],['Equipo de apoyo','Desbloquea tu primer compañero'],['Task Bar Hero','Completa todas las misiones']],
  genshin:[['Viajero','Completa el prólogo'],['Primera aventura','Abre 10 cofres'],['Elementos unidos','Desbloquea 4 personajes'],['Explorador de Teyvat','Activa 10 puntos de teletransporte'],['Aventura compartida','Completa un desafío cooperativo'],['Héroe de Teyvat','Completa la historia principal']],
  minecraft:[['Madera obtenida','Consigue tu primer bloque de madera'],['Refugio seguro','Construye una casa'],['A las profundidades','Entra en una cueva'],['Mesa de trabajo','Crea una mesa de trabajo'],['Un mundo nuevo','Entra al Nether'],['Constructor experto','Construye una estructura completa']],
  mario:[['Primer salto','Completa el primer nivel'],['Monedas brillantes','Consigue 100 monedas'],['Sin tocar el suelo','Completa un nivel sin perder vida'],['Amigos al rescate','Juega una partida cooperativa'],['Camino secreto','Encuentra una salida secreta'],['Rescatador del reino','Completa el juego']],
  cyber:[['Inicio de sesión','Completa el tutorial'],['En la mira','Gana tu primer combate'],['Ciudad abierta','Descubre 5 zonas'],['Mejor equipado','Mejora un arma'],['Trabajo en equipo','Completa una misión cooperativa'],['Leyenda de Cyber World','Completa la campaña']]
};

const defaultState = {
  users: [],
  user: null,
  games: API_BASE ? [] : seedGames,
  library: [],
  reviews: [],
  sales: [],
  hours: {},
  progress: {},
  achievementRecords: [],
  achievementDefinitions: {},
  unlockedAchievementCount: null,
  query: '',
  genre: 'todos',
  selected: '',
  purchaseGame: '',
  notice: '',
  sessionToken: ''
};

let state = loadState();
let view = state.user ? (state.user.role === 'admin' ? 'admin' : 'catalog') : 'home';
let modal = null;
let busy = false;

const achievementRequests = {};
const achievementErrors = {};

if (API_BASE) {
  state.achievementRecords = [];
  state.achievementDefinitions = {};
  state.unlockedAchievementCount = null;
}

function loadState() {
  try {
    return {
      ...defaultState,
      ...JSON.parse(localStorage.getItem('gamevault-state') || '{}')
    };
  } catch {
    return {...defaultState};
  }
}

function persist() {
  if (state.user && state.user.role !== 'admin') {
    const user = state.users.find(item => item.email === state.user.email);

    if (user) {
      Object.assign(user, {
        library: [...state.library],
        reviews: [...state.reviews],
        hours: {...state.hours},
        progress: {...state.progress}
      });
    }
  }

  localStorage.setItem('gamevault-state', JSON.stringify(state));
}

function money(n) {
  return '$' + Number(n || 0).toLocaleString('es-CO');
}

function esc(v = '') {
  return String(v).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function game(id) {
  return state.games.find(g => String(g.id) === String(id))
    || state.games[0]
    || {
      id: '',
      title: 'Videojuego',
      genre: '',
      age: '',
      price: 0,
      description: '',
      cover: 'GAME',
      tone: 'cyber',
      tags: []
    };
}

function getAchievements(g) {
  return achievementSets[g.id] || [
    [`Bienvenido a ${g.title}`, 'Completa el tutorial inicial'],
    ['Primer desafío', 'Completa tu primer objetivo'],
    ['En progreso', 'Supera 5 desafíos'],
    ['Explorador', 'Descubre una zona nueva'],
    ['Experto', 'Completa una misión avanzada'],
    [`Leyenda de ${g.title}`, 'Completa la campaña principal']
  ];
}

function setActiveUser(user) {
  state.user = user;
  state.library = [...(user.library || [])];
  state.reviews = [...(user.reviews || [])];
  state.hours = {...(user.hours || {})};
  state.progress = {...(user.progress || {})};
  state.achievementRecords = [];
  state.achievementDefinitions = {};
  state.unlockedAchievementCount = API_BASE ? null : 0;
}

function safeView(v) {
  view = v;
  modal = null;
  render();
  window.scrollTo(0, 0);

  if (typeof adminEnter === 'function') {
    adminEnter(v);
  }

  if (v === 'achievements' && API_BASE) {
    const id = state.library.map(String).includes(String(state.selected))
      ? state.selected
      : state.library[0];

    if (id) {
      loadAchievementsForGame(id);
    }
  }
}

function go(v) {
  if (
    ['catalog', 'library', 'profile', 'achievements', 'review', 'reviews', 'detail', 'payment'].includes(v)
    && !state.user
  ) {
    safeView('login');
    toast('Inicia sesión para continuar');
    return;
  }

  if (v === 'achievements' && !state.library.length) {
    toast('Compra un juego para ver sus logros.');
    safeView('catalog');
    return;
  }

  if (v === 'review' && !state.library.length) {
    toast('Compra un juego para poder escribir una reseña.');
    safeView('catalog');
    return;
  }

  safeView(v);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3000);
}

async function api(path, options = {}) {
  if (!API_BASE) {
    throw Error('API no configurada');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(state.sessionToken ? {Authorization: `Bearer ${state.sessionToken}`} : {})
  };

  const res = await fetch(API_BASE.replace(/\/$/, '') + path, {
    ...options,
    headers: {...headers, ...options.headers}
  });

  let body = {};

  try {
    body = await res.json();
  } catch {}

  if (!res.ok) {
    throw Error(body.message || body.error || `Error ${res.status}`);
  }

  return body;
}

async function syncGames() {
  if (!API_BASE) return;

  try {
    state.games = (await apiAll('/video-games')).map(normGame);
    persist();
    render();
  } catch (e) {
    console.warn('GameVault API:', e.message);
  }
}

function mapSessionUser(u) {
  return {
    id: u.user_id,
    name: u.name,
    email: u.email,
    role: u.role === 'administrator' ? 'admin' : 'user',
    created: u.registration_date
  };
}

async function loadUserData() {
  if (!API_BASE || !state.user?.id || state.user.role === 'admin') {
    return;
  }

  const userId = state.user.id;

  const results = await Promise.allSettled([
    apiAll(`/users/${userId}/purchases?status=confirmed`),
    apiAll(`/reviews?user_id=${userId}`),
    api(`/users/${userId}/achievements`)
  ]);

  if (String(state.user?.id) !== String(userId)) {
    return;
  }

  const [purchases, reviews, achievements] = results;

  if (purchases.status === 'fulfilled') {
    state.library = purchases.value.map(item => item.video_game_id);
  } else {
    console.warn('GameVault purchases:', purchases.reason.message);
  }

  if (reviews.status === 'fulfilled') {
    state.reviews = reviews.value.map(item => ({
      gameId: item.video_game_id,
      rating: item.rating,
      body: item.comment || '',
      author: item.user_name,
      hours: item.hours_played || 0,
      tags: (item.tags || []).map(tag => tag.name)
    }));
  } else {
    console.warn('GameVault reviews:', reviews.reason.message);
  }

  if (achievements.status === 'fulfilled') {
    state.achievementRecords = Array.isArray(achievements.value)
      ? achievements.value
      : [];

    state.unlockedAchievementCount = state.achievementRecords.filter(
      item => Boolean(item.is_unlocked)
    ).length;
  } else {
    state.achievementRecords = [];
    state.unlockedAchievementCount = null;
    console.warn('GameVault achievements:', achievements.reason.message);
  }

  persist();
  render();

  if (view === 'achievements' && API_BASE) {
    const id = state.library.map(String).includes(String(state.selected))
      ? state.selected
      : state.library[0];

    if (id) {
      loadAchievementsForGame(id);
    }
  }
}

async function loadAchievementsForGame(id) {
  const key = String(id);

  if (
    !API_BASE
    || !state.user
    || !key
    || achievementRequests[key]
    || Object.prototype.hasOwnProperty.call(state.achievementDefinitions, key)
  ) {
    return;
  }

  const userId = state.user.id;

  achievementRequests[key] = true;
  delete achievementErrors[key];

  if (view === 'achievements') {
    render();
  }

  try {
    const items = await api(
      `/video-games/${encodeURIComponent(key)}/achievements`
    );

    if (String(state.user?.id) !== String(userId)) {
      return;
    }

    state.achievementDefinitions[key] = Array.isArray(items) ? items : [];
    persist();
  } catch (error) {
    achievementErrors[key] = error.message;
  } finally {
    delete achievementRequests[key];

    if (view === 'achievements') {
      render();
    }
  }
}

async function tagIds(labels) {
  if (!labels.length) return [];

  const list = asList(await api('/tags'));

  return labels
    .map(l => list.find(t => String(t.name).toLowerCase() === l.toLowerCase())?.tag_id)
    .filter(Boolean);
}

function brand() {
  return '<div class="brand"><b>GAME</b><span>VAULT</span></div>';
}

function header() {
  if (['home', 'login', 'register'].includes(view)) return '';
  if (state.user?.role === 'admin') return adminHeader();

  return `<header class="topbar">
    <a href="#" onclick="go('catalog');return false">${brand()}</a>
    <nav class="nav">
      <button class="${view === 'catalog' ? 'active' : ''}" onclick="go('catalog')">Catálogo</button>
      <button class="${view === 'achievements' ? 'active' : ''}" onclick="go('achievements')">Logros</button>
      <button class="${view === 'reviews' || view === 'review' ? 'active' : ''}" onclick="go('reviews')">Reseñas</button>
      <button class="${view === 'library' ? 'active' : ''}" onclick="go('library')">Biblioteca</button>
    </nav>
    <button class="profile-icon" aria-label="Perfil" onclick="go('profile')">♙</button>
  </header>`;
}

function cover(g, cls = '') {
  return `<div class="cover ${cls}" style="background:${g.image
    ? `url('${esc(g.image)}') center/cover,`
    : ''}linear-gradient(135deg,${({
      halo: '#102a41,#496a78',
      tbh: '#15452d,#644023',
      genshin: '#258cc2,#e99ca8',
      minecraft: '#28644a,#a6a33b',
      mario: '#b32f39,#69ae52',
      cyber: '#173a67,#551a79'
    })[g.tone] || '#183050,#56206d'})">
    <span class="cover-title">${esc(g.cover || g.title)}</span>
    <span class="cover-kicker">${esc(g.genre || 'AVENTURA')}</span>
  </div>`;
}

function card(g) {
  return `<article class="game-card">
    ${cover(g)}
    <div class="card-body">
      <h3 class="card-title">${esc(g.title)}</h3>
      <div class="card-meta">
        <span>${esc(g.genre)}</span>
        ${state.library.map(String).includes(String(g.id)) ? '<b>en biblioteca ✓</b>' : ''}
      </div>
      <p class="card-desc">${esc(g.description)}</p>
      <div class="card-foot">
        <span class="price">${money(g.price)}</span>
        <button class="btn light small-btn" onclick="selectGame('${esc(g.id)}')">ver juego</button>
      </div>
    </div>
  </article>`;
}

function catalog() {
  const gs = state.games.filter(g =>
    (state.genre === 'todos' || (g.genreList || [g.genre]).includes(state.genre))
    && `${g.title} ${g.genre} ${g.description}`
      .toLowerCase()
      .includes(state.query.toLowerCase())
  );

  return `<main class="page">
    <h1>Catálogo de videojuegos</h1>
    <div class="catalog-tools">
      <input class="search" placeholder="buscar juego..." value="${esc(state.query)}" oninput="state.query=this.value;render()">
      <div class="filters">
        ${['todos', ...new Set(state.games.flatMap(g => g.genreList || [g.genre]).filter(Boolean))].map(x =>
          `<button class="chip ${state.genre === x ? 'active' : ''}" data-g="${esc(x)}" onclick="state.genre=this.dataset.g;render()">${esc(x)}</button>`
        ).join('')}
      </div>
    </div>
    <div class="game-grid">
      ${gs.length ? gs.map(card).join('') : '<div class="empty">No encontramos juegos con esa búsqueda.</div>'}
    </div>
  </main>`;
}

function selectGame(id) {
  state.selected = id;
  go('detail');
}

function detail() {
  const g = game(state.selected);
  const owned = state.library.map(String).includes(String(g.id));
  const reviews = state.reviews.filter(r => String(r.gameId) === String(g.id));

  return `<main class="page">
    <div class="detail-card">
      <section class="detail-left">
        ${cover(g)}
        <div class="tag-row">
          ${(g.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}
        </div>
        <div class="detail-left-info">
          <div class="rating">${g.rating || '4.8'}/5.0　★★★★★</div>
          <p>
            <button class="btn ${owned ? 'danger' : ''}" onclick="${owned
              ? `confirmUninstall('${esc(g.id)}')`
              : `buy('${esc(g.id)}')`}">${owned ? 'Desinstalar' : 'Comprar juego'}</button>
          </p>
        </div>
      </section>
      <section class="detail-right">
        <h2>${esc(g.title)}</h2>
        <p class="detail-desc">${esc(g.description)}</p>
        <p>Clasificación: ${esc(g.age)}　·　${esc(g.genre)}</p>
        <div class="detail-actions">
          ${owned
            ? `<button class="btn light" onclick="state.selected='${esc(g.id)}';go('achievements')">🏆 ver logros</button>
               <button class="btn light" onclick="state.selected='${esc(g.id)}';go('review')">escribir reseña ⭐</button>`
            : '<span class="hint">Compra este juego para desbloquear sus logros y publicar una reseña.</span>'}
        </div>
        <div class="reviews">
          <b>reseñas recientes:</b>
          ${reviews.length
            ? reviews.slice(0, 3).map(r => `<div class="review">
                <strong>${esc(r.author || 'Jugador')}
                  <span class="rating">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</span>
                </strong>
                <p>${esc(r.body || 'Una gran experiencia de juego.')}</p>
              </div>`).join('')
            : '<p class="hint">Todavía no hay reseñas para este juego.</p>'}
        </div>
      </section>
    </div>
    <button class="text-button" onclick="go('catalog')">← Volver al catálogo</button>
  </main>`;
}

function home() {
  return `<main class="home">
    ${brand()}
    <div class="home-actions">
      <button class="btn" onclick="go('login')">Iniciar sesión</button>
      <button class="btn" onclick="go('register')">crear cuenta</button>
    </div>
    <div class="home-copy">Tu universo de<br><em>videojuegos</em> en un solo lugar</div>
    <div class="hero-art">${state.games.slice(2, 6).map(g => cover(g)).join('')}</div>
  </main>`;
}

function auth() {
  const reg = view === 'register';

  return `<main class="form-wrap">
    <h1>${reg ? 'Crear Cuenta' : 'Bienvenido de nuevo'}</h1>
    <p class="sub">${reg ? 'únete a nuestra comunidad gamer' : 'Inicia sesión para continuar'}</p>
    <form onsubmit="${reg ? 'registerUser(event)' : 'loginUser(event)'}">
      ${reg ? '<input class="form-input" name="name" placeholder="Nombre Completo" required minlength="2">' : ''}
      <input class="form-input" name="email" type="email" placeholder="correo electronico" required>
      <input class="form-input" name="password" type="password" placeholder="contraseña" required minlength="${reg ? 15 : 1}">
      ${reg ? '<input class="form-input" name="confirm" type="password" placeholder="confirmar contraseña" required minlength="15">' : ''}
      <div id="auth-error" class="err"></div>
      <div class="form-line">
        <input type="checkbox" name="accept" ${reg ? 'required' : 'checked'}>
        <small>${reg ? 'aceptar términos y condiciones' : 'recordarme'}</small>
      </div>
      ${!reg && !API_BASE
        ? '<div class="hint"><strong>Cuenta administrador (demostración local):</strong><br>admin@gamevault.com<br>Contraseña: administrador</div>'
        : ''}
      <button class="btn" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Cargando…' : reg ? 'crear cuenta' : 'Iniciar sesión'}</button>
    </form>
    <div class="form-foot">
      ${reg ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
      <button class="text-button" onclick="go('${reg ? 'login' : 'register'}')">${reg ? 'Iniciar sesión' : 'Crear cuenta'}</button>
    </div>
  </main>`;
}

async function registerUser(e) {
  e.preventDefault();

  const f = new FormData(e.target);
  const name = f.get('name').trim();
  const email = f.get('email').trim().toLowerCase();
  const password = f.get('password');

  if (password !== f.get('confirm')) {
    document.getElementById('auth-error').textContent = 'Las contraseñas no coinciden.';
    return;
  }

  busy = true;
  render();

  try {
    let user;

    if (API_BASE) {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({name, email, password, accepted_terms: true})
      });

      const d = await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({email, password})
      });

      state.sessionToken = d.token;
      user = mapSessionUser(d.user);
    } else {
      if (state.users.some(u => u.email === email)) {
        throw Error('Ya existe una cuenta con ese correo.');
      }

      user = {
        name,
        email,
        password,
        created: new Date().toISOString(),
        library: [],
        reviews: [],
        hours: {},
        progress: {}
      };

      state.users.push(user);
    }

    busy = false;
    setActiveUser(user);
    persist();
    safeView('catalog');
    toast('Cuenta creada correctamente.');

    if (API_BASE) {
      syncGames();
      loadUserData();
    }
  } catch (err) {
    busy = false;
    render();
    document.getElementById('auth-error').textContent = err.message;
  }
}

async function loginUser(e) {
  e.preventDefault();

  const f = new FormData(e.target);
  const email = f.get('email').trim().toLowerCase();
  const password = f.get('password');

  busy = true;
  render();

  try {
    if (API_BASE) {
      const d = await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({email, password})
      });

      state.sessionToken = d.token;
      setActiveUser(mapSessionUser(d.user));
    } else if (email === 'admin@gamevault.com' && password === 'administrador') {
      setActiveUser({
        name: 'Administrador',
        email,
        role: 'admin',
        created: new Date().toISOString()
      });
    } else {
      const u = state.users.find(x => x.email === email && x.password === password);

      if (!u) {
        throw Error('Correo o contraseña incorrectos.');
      }

      setActiveUser(u);
    }

    busy = false;
    persist();

    safeView(state.user.role === 'admin' ? 'admin' : 'catalog');

    toast(
      state.user.role === 'admin'
        ? 'Sesión de administrador iniciada.'
        : 'Bienvenido a GameVault.'
    );

    syncGames();
    loadUserData();
  } catch (err) {
    busy = false;
    render();

    document.getElementById('auth-error').textContent = API_BASE
      ? `${err.message}`
      : `${err.message} Para probar, crea una cuenta primero.`;
  }
}

function buy(id) {
  if (!state.user) {
    go('login');
    return;
  }

  if (state.library.map(String).includes(String(id))) {
    toast('Este juego ya está en tu biblioteca.');
    return;
  }

  state.purchaseGame = id;
  go('payment');
}

function payment() {
  const g = game(state.purchaseGame || state.selected);

  return `<main class="page">
    <h1>Información del pago</h1>
    <p class="sub">Método y proceso de compra</p>
    <div class="paybox">
      <form onsubmit="payGame(event,'${esc(g.id)}')">
        <label>
          <b>Selecciona un método de pago:</b>
          <select name="method" required>
            <option value="PSE">PSE</option>
            <option value="Visa (Internacional)">Visa (Internacional)</option>
            <option value="Paypal">Paypal</option>
            <option value="Efecty">Efecty</option>
          </select>
        </label>
        <p>
          <label>
            <input type="checkbox" required>
            <small>Acepto el trato de mis datos personales.</small>
          </label>
        </p>
        <button class="btn light" type="submit">pagar　›</button>
        <div class="err" id="pay-error"></div>
      </form>
      <div class="summary">
        <b>${esc(g.title)}</b>
        ${cover(g)}
        <p>${money(g.price)}　·　Cargos adicionales $0</p>
        <hr>
        <b>Total a pagar　${money(g.price)}</b>
      </div>
    </div>
  </main>`;
}

function paymentProcessing() {
  return `<main class="success-screen">
    <div class="processing-icon">♫</div>
    <h1>Agregando el juego a la biblioteca</h1>
    <p>Espera un momento mientras confirmamos el pago.</p>
    <div class="progress"><i></i></div>
  </main>`;
}

function paymentFailure() {
  return `<main class="success-screen">
    <div class="failure-mark">×</div>
    <h1>Pago cancelado</h1>
    <p>No se pudo completar el pago con Visa. No se realizó ningún cargo y el juego no se agregó a tu biblioteca.</p>
    <div class="modal-actions">
      <button class="btn" onclick="safeView('payment')">Intentar de nuevo</button>
      <button class="btn light" onclick="go('catalog')">Volver al catálogo</button>
    </div>
  </main>`;
}

function libraryAddFailure() {
  return `<main class="success-screen">
    <div class="failure-mark">×</div>
    <h1>Error al agregar a biblioteca</h1>
    <p>El juego no pudo agregarse a tu biblioteca. Inténtalo de nuevo más tarde.</p>
    <div class="modal-actions">
      <button class="btn" onclick="safeView('payment')">Intentar de nuevo</button>
      <button class="btn light" onclick="go('library')">Ir a mi biblioteca</button>
    </div>
  </main>`;
}

async function payGame(e, id) {
  e.preventDefault();

  const method = new FormData(e.target).get('method');

  state.paymentMethod = method;
  state.purchaseGame = id;

  busy = true;
  safeView('payment-processing');

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    if (method === 'Visa (Internacional)') {
      busy = false;
      safeView('payment-failure');
      return;
    }

    if (API_BASE) {
      const d = await api('/purchases', {
        method: 'POST',
        body: JSON.stringify({video_game_id: Number(id)})
      });

      const confirmed = d.purchase?.status === 'confirmed';

      if (confirmed && !state.library.map(String).includes(String(id))) {
        state.library.push(id);
      }

      if (state.progress[id] == null) {
        state.progress[id] = 0;
      }

      persist();
      busy = false;
      safeView('library');

      toast(
        confirmed
          ? 'Pago confirmado. El juego ya está en tu biblioteca.'
          : 'Compra registrada. Quedará en tu biblioteca cuando un administrador la confirme.'
      );
      return;
    }

    if (!state.library.map(String).includes(String(id))) {
      state.library.push(id);
    }

    if (state.progress[id] == null) {
      state.progress[id] = 0;
    }

    const purchased = game(id);

    state.sales.unshift({
      name: state.user?.name || 'Jugador',
      email: state.user?.email || '',
      title: purchased.title,
      price: purchased.price,
      date: Date.now()
    });

    persist();
    busy = false;
    safeView('library');
    toast('Pago confirmado. El juego ya está en tu biblioteca.');
  } catch (err) {
    busy = false;
    safeView('library-add-failure');
    toast(err.message);
  }
}

function library() {
  const gs = state.library.map(game);

  return `<main class="page">
    <h1>Mi Biblioteca</h1>
    <p class="sub">${gs.length} ${gs.length === 1 ? 'juego en tu colección' : 'juegos en tu colección'}</p>
    <div class="library-grid">
      ${gs.map(g => card(g)).join('')}
      <button class="add-tile" aria-label="Explorar catálogo" onclick="go('catalog')">+</button>
    </div>
    ${gs.length
      ? ''
      : '<p class="empty">Tu biblioteca está esperando su primer juego. <button class="btn light" onclick="go(\'catalog\')">Explorar catálogo</button></p>'}
  </main>`;
}

function profile() {
  const user = state.user || {name: 'Jugador'};

  return `<main class="page">
    <div class="profile-banner">
      <span>BIENVENIDO DE NUEVO</span>
      <div>
        <h2>${esc(user.name)}</h2>
        <small>Miembro desde ${new Date(user.created || Date.now()).toLocaleDateString('es-CO', {month: 'long', year: 'numeric'})}</small>
      </div>
      <button class="btn light" onclick="go('account')">perfil</button>
    </div>

    <div class="stats">
      <div class="stat">
        <strong>🎮 ${state.library.length}</strong>tus juegos
      </div>
      <div class="stat">
        <strong>🏆 ${state.unlockedAchievementCount ?? '—'}</strong>logros desbloqueados
      </div>
      <div class="stat">
        <strong>🌟 ${state.reviews.length}</strong>reseñas escritas
      </div>
      <div class="stat">
        <strong>▣ ${state.reviews.reduce((total, review) => total + Number(review.hours || 0), 0)}</strong>Horas Jugadas
      </div>
    </div>

    <div class="two-col profile-sections">
      <section class="panel">
        <b>últimos juegos adquiridos:</b>
        ${state.library.slice(-3).map(id =>
          `<div class="review" onclick="selectGame('${esc(id)}')">
            ${esc(game(id).title)}　en biblioteca ✓
            <button class="text-button" onclick="event.stopPropagation();state.selected='${esc(id)}';go('achievements')">ver logros ▶</button>
          </div>`
        ).join('') || '<p>Aún no tienes juegos.</p>'}
      </section>

      <section class="panel">
        <b>juegos recomendados:</b>
        <div onclick="selectGame('tbh')">
          ${cover(game('tbh'))}
        </div>
        <button class="btn light" onclick="logout()">Cerrar sesión</button>
      </section>
    </div>
  </main>`;
}

function account() {
  return `<main class="page">
    <div class="two-col">
      <section class="panel">
        <h1>${esc(state.user.name)}</h1>
        <p>Miembro de GameVault</p>
        <hr>
        <h3>Información de la cuenta</h3>
        <p>Nombre:　${esc(state.user.name)}</p>
        <p>Correo electrónico:　${esc(state.user.email)}</p>
        <p>Fecha de registro:　${new Date(state.user.created || Date.now()).toLocaleDateString('es-CO')}</p>
        <p>Tipo de cuenta:　Usuario estándar</p>
        <button class="btn danger" onclick="logout()">Cerrar sesión</button>
      </section>

      <section class="panel">
        <h3>Estadísticas</h3>
        <p>🎮 ${state.library.length} tus juegos　🏆 ${state.unlockedAchievementCount ?? '—'} logros</p>
        <p>🌟 ${state.reviews.length} reseñas escritas　▣ ${state.reviews.reduce((total, review) => total + Number(review.hours || 0), 0)} Horas Jugadas</p>
      </section>
    </div>
  </main>`;
}

function achievements() {
  const owned = state.library.map(String);
  const id = owned.includes(String(state.selected))
    ? state.selected
    : state.library[0];

  if (!id) {
    return '<main class="page"><h1>Logros</h1><p class="empty">Compra un juego para ver sus logros.</p></main>';
  }

  const selected = game(id);
  const key = String(id);
  const icons = ['🎯', '🚩', '🧪', '⭐', '🗺️', '💎'];

  let items;

  if (API_BASE) {
    if (achievementErrors[key]) {
      return `<main class="page">
        <h1>Logros</h1>
        <p class="empty">No se pudieron cargar los logros: ${esc(achievementErrors[key])}</p>
        <button class="btn light" onclick="loadAchievementsForGame('${esc(key)}')">Reintentar</button>
      </main>`;
    }

    if (!Object.prototype.hasOwnProperty.call(state.achievementDefinitions, key)) {
      return '<main class="page"><h1>Logros</h1><p class="empty">Cargando logros…</p></main>';
    }

    const progressById = new Map(
      state.achievementRecords.map(item => [String(item.achievement_id), item])
    );

    items = state.achievementDefinitions[key].map(item => ({
      name: item.name,
      description: item.description,
      unlocked: Boolean(progressById.get(String(item.achievement_id))?.is_unlocked),
      progress: progressById.get(String(item.achievement_id))?.progress ?? 0,
      target: item.target,
      type: item.type
    }));
  } else {
    const localUnlocked = Math.max(0, Number(state.progress[id] || 0));

    items = getAchievements(selected).map((item, index) => ({
      name: item[0],
      description: item[1],
      unlocked: index < localUnlocked
    }));
  }

  const total = items.length;
  const unlocked = items.filter(item => item.unlocked).length;

  return `<main class="page">
    <button class="text-button" onclick="go('library')">← Todos los juegos</button>
    <div class="achievement">
      <div>${cover(selected)}</div>
      <div>
        <b>${esc(selected.title)}</b>
        <h2>${unlocked}/${total} desbloqueados</h2>
        <div class="progress">
          <i style="width:${total ? unlocked / total * 100 : 0}%"></i>
        </div>
      </div>
    </div>

    ${total
      ? `<div class="achievement-list">
          ${items.map((item, index) => `<div class="achievement">
            <span style="font-size:35px">${icons[index % icons.length]}</span>
            <div>
              <b>${esc(item.name)}</b><br>
              <small>${esc(item.description)}</small>
              ${item.type === 'progress' && !item.unlocked
                ? `<br><small>Progreso: ${Number(item.progress)} / ${Number(item.target || 0)}</small>`
                : ''}
            </div>
            <span style="color:${item.unlocked ? '#31ed32' : '#8a6698'}">
              ${item.unlocked ? 'Desbloqueado' : 'Bloqueado'}
            </span>
          </div>`).join('')}
        </div>`
      : '<p class="empty">Este videojuego todavía no tiene logros registrados.</p>'}
  </main>`;
}

function openReview() {
  go('reviews');
}

function reviewHistory() {
  const entries = [...state.reviews].reverse();

  return `<main class="page">
    <div class="admin-title-row">
      <div>
        <h1>Mis Reseñas</h1>
        <p class="sub">Reseñas que has compartido con la comunidad</p>
      </div>
      ${state.library.length
        ? '<button class="btn light" onclick="openReviewForm()">Escribir reseña</button>'
        : ''}
    </div>

    ${entries.length
      ? `<div class="my-reviews">
          ${entries.map(r => {
            const g = game(r.gameId);

            return `<article class="my-review">
              <div class="my-review-head">
                <b>${esc(g.title)}</b>
                <span class="rating">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</span>
              </div>
              <p>${esc(r.body || 'Sin comentario')}</p>
              ${r.tags?.length
                ? `<div class="review-tags">${r.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>`
                : ''}
              <small>${r.hours ? `${r.hours} horas jugadas · ` : ''}Publicada</small>
            </article>`;
          }).join('')}
        </div>`
      : `<section class="panel empty-review">
          <div class="empty-review-icon">☆</div>
          <h2>Aún no has publicado reseñas</h2>
          <p>Cuando compartas tu opinión sobre un juego, aparecerá aquí.</p>
          ${state.library.length
            ? '<button class="btn light" onclick="openReviewForm()">Escribir mi primera reseña</button>'
            : '<button class="btn light" onclick="go(\'catalog\')">Explorar catálogo</button>'}
        </section>`}
  </main>`;
}

function openReviewForm() {
  if (!state.library.length) {
    toast('Compra un juego para poder escribir una reseña.');
    go('catalog');
    return;
  }

  state.selected = state.library.map(String).includes(String(state.selected))
    ? state.selected
    : state.library[0];

  go('review');
}

function review() {
  const owned = state.library.map(String);

  if (!owned.length) {
    return `<main class="page">
      <h1>Reseñas</h1>
      <p class="empty">Compra un juego para poder publicar una reseña.
        <button class="btn light" onclick="go('catalog')">Ver catálogo</button>
      </p>
    </main>`;
  }

  if (!owned.includes(String(state.selected))) {
    state.selected = state.library[0];
  }

  const g = game(state.selected);

  return `<main class="page">
    <h1>Escribir Reseña</h1>
    <p class="sub">Comparte tu experiencia con la comunidad</p>

    ${owned.length > 1
      ? `<label class="hint">
          Juego a reseñar
          <select class="search" onchange="state.selected=this.value;state.rating=0;render()">
            ${owned.map(id => `<option value="${esc(id)}" ${String(id) === String(g.id) ? 'selected' : ''}>${esc(game(id).title)}</option>`).join('')}
          </select>
        </label>`
      : ''}

    <form class="review-form" onsubmit="publishReview(event,'${esc(g.id)}')">
      <section>
        <b>JUEGO A RESEÑAR</b>
        ${cover(g)}
        <p>${esc(g.title)}</p>
        <b>TU CALIFICACIÓN *</b>

        <div class="stars">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" onclick="setRating(${n})" aria-label="${n} estrellas">${n <= (state.rating || 0) ? '★' : '☆'}</button>`).join('')}
        </div>

        <label>
          HORAS JUGADAS
          <input class="form-input" type="number" min="0" name="hours" placeholder="ej...25" value="${state.hours[g.id] || ''}">
        </label>
      </section>

      <section>
        <label>
          <b>COMENTARIO (OPCIONAL)</b>
          <textarea name="body" placeholder="escribe tu opinión sobre el juego..."></textarea>
        </label>

        <b>ETIQUETAS (OPCIONALES)</b>

        <div class="review-tags">
          ${['Divertido', 'Historia', 'Gráficos', 'Dificultad', 'Recomendado', 'Música', 'Multijugador'].map(t =>
            `<button type="button" onclick="this.classList.toggle('selected')">${t}</button>`
          ).join('')}
        </div>

        <p style="text-align:right">
          <button class="btn light">Publicar Reseña</button>
        </p>

        <div class="err" id="review-error"></div>
      </section>
    </form>
  </main>`;
}

function setRating(n) {
  state.rating = n;

  document.querySelectorAll('.stars button').forEach(
    (button, index) => button.textContent = index < n ? '★' : '☆'
  );

  const error = document.getElementById('review-error');

  if (error) {
    error.textContent = '';
  }
}

async function publishReview(e, id) {
  e.preventDefault();

  if (!state.library.map(String).includes(String(id))) {
    document.getElementById('review-error').textContent = 'Solo puedes reseñar juegos de tu biblioteca.';
    return;
  }

  if (!state.rating) {
    document.getElementById('review-error').textContent = 'Selecciona una calificación.';
    return;
  }

  const f = new FormData(e.target);

  const r = {
    gameId: id,
    rating: state.rating,
    body: f.get('body'),
    author: state.user.name,
    hours: Number(f.get('hours') || 0),
    tags: [...document.querySelectorAll('.review-tags .selected')].map(x => x.textContent)
  };

  try {
    if (API_BASE) {
      await api('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          video_game_id: Number(id),
          rating: r.rating,
          comment: r.body || null,
          hours_played: r.hours || null,
          tags: await tagIds(r.tags)
        })
      });
    }

    state.reviews.push(r);

    if (r.hours) {
      state.hours[id] = r.hours;
    }

    state.rating = 0;
    persist();
    safeView('review-success');

    setTimeout(() => {
      if (view === 'review-success') {
        go('library');
      }
    }, 1800);
  } catch (err) {
    document.getElementById('review-error').textContent = err.message;
  }
}

function confirmUninstall(id) {
  modal = {type: 'uninstall', id};
  render();
}

function uninstall(id) {
  state.library = state.library.filter(x => String(x) !== String(id));
  persist();
  modal = null;
  render();
  toast('Juego desinstalado de tu biblioteca.');
}

function logout() {
  state.user = null;
  state.sessionToken = '';
  state.achievementRecords = [];
  state.achievementDefinitions = {};
  state.unlockedAchievementCount = null;
  persist();
  safeView('home');
}

function success(title, copy, buttons) {
  return `<main class="success-screen">
    <div class="success-mark">☑</div>
    <h1>${title}</h1>
    <p>${copy}</p>
    <div class="modal-actions">${buttons}</div>
  </main>`;
}

function purchaseSuccess() {
  return success(
    '¡Compra completada!',
    'El videojuego ya está disponible en tu biblioteca.',
    `<button class="btn" onclick="go('library')">ver biblioteca</button>
     <button class="btn light" onclick="go('catalog')">ver catálogo</button>`
  );
}

function reviewSuccess() {
  return success(
    '¡Reseña publicada!',
    'Tu opinión sobre el juego ha sido publicada correctamente.',
    '<button class="btn light" onclick="go(\'library\')">Ver mi biblioteca</button>'
  );
}

function modalHtml() {
  if (!modal) return '';

  if (String(modal.type).startsWith('admin')) {
    return adminModal();
  }

  const g = game(modal.id);

  return `<div class="modal-backdrop" onclick="if(event.target===this){modal=null;render()}">
    <div class="modal">
      <div class="modal-icon">!?</div>
      <h2>¿Está seguro de que desea<br>desinstalar esta aplicación?</h2>
      <div class="modal-actions">
        <button class="btn" onclick="uninstall('${esc(g.id)}')">Desinstalar</button>
        <button class="btn light" onclick="modal=null;render()">Regresar</button>
      </div>
    </div>
  </div>`;
}

function render() {
  const routes = {
    home,
    login: auth,
    register: auth,
    catalog,
    detail,
    library,
    profile,
    account,
    achievements,
    review,
    reviews: reviewHistory,
    payment,
    'payment-processing': paymentProcessing,
    'payment-failure': paymentFailure,
    'library-add-failure': libraryAddFailure,
    admin: adminDashboard,
    'admin-games': adminGames,
    'admin-game-form': adminGameForm,
    'admin-users': adminUsers,
    'admin-user-form': adminUserForm,
    'admin-purchases': adminPurchases,
    purchaseSuccess,
    'review-success': reviewSuccess
  };

  document.getElementById('app').innerHTML =
    header() + (routes[view] || home)() + modalHtml();
}

render();

if (API_BASE) {
  syncGames();
}

if (state.user) {
  if (state.user.role === 'admin') {
    adminEnter(view);
  } else {
    loadUserData();
  }
}
