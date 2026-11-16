/* GameVault · Panel administrativo. Todo se consume desde la API real (backend /api). */
const AGES = ['TODOS', '3+', '7+', '12+', '16+', '18+'];
const PURCHASE_LABELS = { pending: 'Pendiente', confirmed: 'Confirmada', failed: 'Fallida', cancelled: 'Cancelada' };
const ADM = {
  st: { games: { s: 'idle', e: '' }, users: { s: 'idle', e: '' }, purchases: { s: 'idle', e: '' }, detail: { s: 'idle', e: '' }, genres: { s: 'idle', e: '' } },
  users: [], purchases: [], genres: [], filter: 'todas',
  notice: null, noticeFresh: false,
  saving: false, formError: '', draft: null, editGame: null, editUser: null
};

/* ---------- utilidades ---------- */
const isAdminView = () => String(view).startsWith('admin');
const fmtDate = v => { const d = new Date(v); return v && !isNaN(d) ? d.toLocaleDateString('es-CO') : '—' };
const sameDay = (a, b) => new Date(a).toDateString() === b.toDateString();
const adminNotice = (type, text, fresh) => { ADM.notice = { type, text }; ADM.noticeFresh = !!fresh; toast(text) };
const asList = d => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
const optList = (list, cur) => (cur && !list.includes(cur) ? [cur, ...list] : list).map(o => `<option value="${esc(o)}" ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('');

/* Recorre todas las páginas de un listado paginado { data, pagination:{pages} } */
async function apiAll(path) {
  const out = [];
  for (let page = 1; page <= 50; page++) {
    const d = await api(`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`);
    if (Array.isArray(d)) return d;
    out.push(...(d.data || []));
    if (page >= (d.pagination?.pages || 1)) break;
  }
  return out;
}

function normGame(g) {
  const genres = Array.isArray(g.genres) ? g.genres : [];
  const names = genres.map(x => x.name);
  return {
    id: g.video_game_id,
    title: g.name || '',
    genre: names.join(', '),
    genreList: names,
    genreIds: genres.map(x => x.genre_id),
    age: g.age_rating || '',
    price: Number(g.price ?? 0),
    rating: g.average_rating ?? null,
    description: g.description || '',
    image: g.image_url || '',
    active: g.is_active !== false,
    cover: g.name || 'GAME',
    tone: 'cyber',
    tags: names
  };
}
function normUser(u) {
  return { id: u.user_id, name: u.name || 'Usuario', email: u.email || '', admin: u.role === 'administrator', created: u.registration_date || '' };
}
function normPurchase(p) {
  return {
    id: p.purchase_id, userId: p.user_id, name: p.user_name || 'Usuario', title: p.video_game_name || 'Videojuego',
    price: Number(p.price_paid ?? 0), date: p.purchase_date || '', status: p.status,
    label: PURCHASE_LABELS[p.status] || p.status || '—'
  };
}

/* ---------- carga de datos ---------- */
async function adminLoad(name) {
  const st = ADM.st[name];
  st.s = 'loading'; st.e = ''; if (isAdminView()) render();
  try {
    if (name === 'games') { state.games = (await apiAll('/video-games')).map(normGame); persist() }
    else if (name === 'users') ADM.users = asList(await api('/users')).map(normUser);
    else if (name === 'purchases') ADM.purchases = (await apiAll('/purchases')).map(normPurchase);
    else if (name === 'genres') ADM.genres = asList(await api('/genres'));
    st.s = 'ok';
  } catch (err) { st.s = 'error'; st.e = err.message }
  if (isAdminView()) render();
}
async function adminLoadDetail(kind) {
  const st = ADM.st.detail; st.s = 'loading'; st.e = ''; render();
  try {
    if (kind === 'user') ADM.editUser = normUser(await api(`/users/${encodeURIComponent(state.adminEditUserId)}`));
    else ADM.editGame = normGame(await api(`/video-games/${encodeURIComponent(state.adminEditId)}`));
    st.s = 'ok';
  } catch (err) { st.s = 'error'; st.e = err.message }
  if (isAdminView()) render();
}
function adminEnter(v) {
  if (!state.user || state.user.role !== 'admin' || !String(v).startsWith('admin')) return;
  if (ADM.noticeFresh) ADM.noticeFresh = false; else ADM.notice = null;
  if (v === 'admin') { adminLoad('games'); adminLoad('users'); adminLoad('purchases') }
  else if (v === 'admin-games') adminLoad('games');
  else if (v === 'admin-users') { adminLoad('users'); adminLoad('purchases') }
  else if (v === 'admin-purchases') adminLoad('purchases');
  else if (v === 'admin-game-form') {
    ADM.draft = null; ADM.formError = ''; ADM.saving = false; ADM.editGame = null;
    adminLoad('genres');
    if (state.adminEditId != null) adminLoadDetail('game'); else ADM.st.detail.s = 'ok';
  } else if (v === 'admin-user-form') {
    ADM.draft = null; ADM.formError = ''; ADM.saving = false; ADM.editUser = null;
    adminLoadDetail('user');
  }
}

/* ---------- componentes ---------- */
function adminHeader() {
  const on = (...vs) => vs.includes(view) ? 'active' : '';
  const tab = (v, label, ...also) => `<button class="${on(v, ...also)}" onclick="safeView('${v}')">${label}</button>`;
  return `<header class="topbar"><a href="#" onclick="safeView('admin');return false">${brand()}</a><nav class="nav">${tab('admin', 'Panel')}${tab('admin-games', 'Videojuegos', 'admin-game-form')}${tab('admin-users', 'Usuarios', 'admin-user-form')}${tab('admin-purchases', 'Compras')}</nav><button class="logout" onclick="logout()">Cerrar sesión　♙</button></header>`;
}
const noticeBox = () => ADM.notice ? `<div class="alert ${ADM.notice.type}" role="status">${esc(ADM.notice.text)}</div>` : '';
function stateBox(name, what) {
  const st = ADM.st[name];
  if (st.s === 'error') return `<div class="alert error" role="alert"><span>No se pudo cargar ${what}: ${esc(st.e)}</span><button class="btn small" onclick="adminLoad('${name}')">Reintentar</button></div>`;
  if (st.s !== 'ok') return `<div class="state-box" role="status"><span class="spinner"></span>Cargando ${what}…</div>`;
  return '';
}
const statusBadge = p => `<span class="badge ${p.status === 'pending' ? 'warn' : p.status === 'confirmed' ? 'ok' : p.status === 'cancelled' ? 'muted' : 'bad'}">${esc(p.label)}</span>`;

/* ---------- modal genérico de confirmación ---------- */
function adminConfirm(o) { modal = { type: 'admin-confirm', busy: false, error: '', danger: false, ...o }; render() }
function adminModal() {
  const m = modal;
  return `<div class="modal-backdrop" onclick="if(event.target===this&&!modal.busy){modal=null;render()}"><div class="modal" role="dialog" aria-modal="true"><div class="modal-icon">!?</div><h2>${esc(m.title)}</h2><p>${esc(m.text || '')}</p>${m.error ? `<div class="alert error" role="alert">${esc(m.error)}</div>` : ''}<div class="modal-actions"><button class="btn ${m.danger ? 'danger' : ''}" ${m.busy ? 'disabled' : ''} onclick="adminModalRun()">${m.busy ? '<span class="spinner sm"></span> Procesando…' : esc(m.okLabel || 'Confirmar')}</button><button class="btn light" ${m.busy ? 'disabled' : ''} onclick="modal=null;render()">Regresar</button></div></div></div>`;
}
async function adminModalRun() {
  const m = modal; if (!m || m.busy) return;
  m.busy = true; m.error = ''; render();
  try { await m.run(); if (modal === m) modal = null } catch (err) { m.busy = false; m.error = err.message }
  render();
}

/* ---------- panel ---------- */
function adminDashboard() {
  const ok = n => ADM.st[n].s === 'ok';
  const names = { games: 'videojuegos', users: 'usuarios', purchases: 'compras' };
  const errs = Object.keys(names).filter(n => ADM.st[n].s === 'error');
  const loading = Object.keys(names).some(n => ADM.st[n].s === 'loading' || ADM.st[n].s === 'idle');
  const sold = ADM.purchases.filter(p => p.status === 'confirmed');
  const pending = ADM.purchases.filter(p => p.status === 'pending');
  const today = new Date();
  const totalToday = sold.filter(p => sameDay(p.date, today)).reduce((a, p) => a + p.price, 0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d });
  const totals = days.map(d => sold.filter(p => sameDay(p.date, d)).reduce((a, p) => a + p.price, 0));
  const max = Math.max(1, ...totals);
  const v = (n, val) => ok(n) ? val : '…';
  return `<main class="page"><h1>Panel de Administración</h1>${noticeBox()}
  ${errs.length ? `<div class="alert error" role="alert"><span>No se pudieron cargar: ${errs.map(n => `${names[n]} (${esc(ADM.st[n].e)})`).join(' · ')}</span><button class="btn small" onclick="adminEnter('admin')">Reintentar</button></div>` : ''}
  ${loading && !errs.length ? '<div class="state-box" role="status"><span class="spinner"></span>Cargando datos…</div>' : ''}
  <div class="stats"><div class="stat"><strong>${v('purchases', money(totalToday))}</strong>ventas confirmadas hoy</div><div class="stat"><strong>🛒 ${v('purchases', ADM.purchases.length)}</strong>Transacciones</div><div class="stat"><strong>⏳ ${v('purchases', pending.length)}</strong>Compras pendientes</div><div class="stat"><strong>👥 ${v('users', ADM.users.length)}</strong>Usuarios registrados</div><div class="stat"><strong>🎮 ${v('games', state.games.length)}</strong>Juegos en catálogo</div></div>
  <div class="two-col"><section class="panel"><h3>Ventas confirmadas (7 días)</h3><div class="sales-bars">${totals.map((t, i) => `<i title="${days[i].toLocaleDateString('es-CO')}: ${money(t)}" style="height:${Math.max(4, t / max * 100)}%"></i>`).join('')}</div></section>
  <section class="panel recent-sales-panel"><h3>Compras recientes</h3><div class="recent-sales-list">${ok('purchases') ? (ADM.purchases.length ? ADM.purchases.slice(0, 8).map(p => `<article class="sale-item"><div>${esc(p.name)} · ${esc(p.title)} ${statusBadge(p)}</div><span class="price">${money(p.price)}</span></article>`).join('') : '<p class="hint">Todavía no hay compras registradas.</p>') : '<p class="hint">…</p>'}</div></section></div>
  <div class="admin-shortcuts"><button class="btn" onclick="safeView('admin-games')">Gestionar videojuegos</button><button class="btn" onclick="safeView('admin-users')">Gestionar usuarios</button><button class="btn" onclick="safeView('admin-purchases')">Ver compras</button></div></main>`;
}

/* ---------- videojuegos ---------- */
function adminGames() {
  const box = stateBox('games', 'los videojuegos');
  const rows = state.games.map(g => `<tr><td>${esc(g.title)}</td><td>${esc(g.genre) || '—'}</td><td>${esc(g.age)}</td><td class="price">${money(g.price)}</td><td>${g.rating != null ? '⭐ ' + esc(g.rating) : '—'}</td><td class="${g.active ? 'active-status' : 'inactive-status'}">${g.active ? 'Activo' : 'Inactivo'}</td><td class="row-actions"><button class="btn small" data-id="${esc(g.id)}" onclick="adminEditGame(this.dataset.id)">Editar</button><button class="btn small light" data-id="${esc(g.id)}" onclick="adminAskToggleGame(this.dataset.id)">${g.active ? 'Desactivar' : 'Activar'}</button><button class="btn small danger" data-id="${esc(g.id)}" onclick="adminAskDeleteGame(this.dataset.id)">Eliminar</button></td></tr>`).join('');
  return `<main class="page"><div class="admin-title-row"><div><h1>Gestión de Videojuegos</h1><p class="sub">${ADM.st.games.s === 'ok' ? state.games.length + ' títulos en el catálogo' : ' '}</p></div><button class="btn" onclick="state.adminEditId=null;safeView('admin-game-form')">Agregar videojuego</button></div>${noticeBox()}${box || `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Juego</th><th>Géneros</th><th>Clasificación</th><th>Precio</th><th>Rating</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="hint">No hay videojuegos registrados.</td></tr>'}</tbody></table></div>`}</main>`;
}
const gameById = id => state.games.find(x => String(x.id) === String(id));
function adminEditGame(id) { state.adminEditId = id; safeView('admin-game-form') }
function adminAskDeleteGame(id) {
  const g = gameById(id);
  adminConfirm({
    title: '¿Eliminar este videojuego?', text: g ? g.title : '', okLabel: 'Eliminar', danger: true,
    run: async () => {
      await api(`/video-games/${encodeURIComponent(id)}`, { method: 'DELETE' });
      adminNotice('ok', 'Videojuego eliminado correctamente.');
      await adminLoad('games');
    }
  });
}
function adminAskToggleGame(id) {
  const g = gameById(id); if (!g) return;
  adminConfirm({
    title: `¿${g.active ? 'Desactivar' : 'Activar'} este videojuego?`, text: g.active ? `${g.title} dejará de mostrarse en el catálogo.` : `${g.title} volverá a mostrarse en el catálogo.`, okLabel: g.active ? 'Desactivar' : 'Activar', danger: g.active,
    run: async () => {
      await api(`/video-games/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ is_active: !g.active }) });
      adminNotice('ok', `Videojuego ${g.active ? 'desactivado' : 'activado'} correctamente.`);
      await adminLoad('games');
    }
  });
}
function adminGameForm() {
  const editing = state.adminEditId != null, d = ADM.st.detail, gs = ADM.st.genres;
  const head = `<h1>${editing ? 'Editar Videojuego' : 'Agregar Videojuego'}</h1><p class="sub">Completa los datos del ${editing ? 'videojuego' : 'nuevo juego'} para el catálogo</p>`;
  if (editing && d.s === 'error') return `<main class="page">${head}<div class="alert error" role="alert"><span>No se pudo cargar el videojuego: ${esc(d.e)}</span><button class="btn small" onclick="adminLoadDetail('game')">Reintentar</button></div><button class="btn light" onclick="safeView('admin-games')">Volver</button></main>`;
  if ((editing && d.s !== 'ok') || gs.s === 'idle' || gs.s === 'loading') return `<main class="page">${head}<div class="state-box" role="status"><span class="spinner"></span>Cargando formulario…</div></main>`;
  const g = ADM.draft || ADM.editGame || { title: '', genreIds: [], age: AGES[0], price: '', description: '', image: '', active: true };
  const dis = ADM.saving ? 'disabled' : '';
  const genres = gs.s === 'error'
    ? `<div class="alert error wide" role="alert"><span>No se pudieron cargar los géneros: ${esc(gs.e)}</span><button type="button" class="btn small" onclick="adminLoad('genres')">Reintentar</button></div>`
    : `<fieldset class="wide checks"><legend>Géneros</legend>${ADM.genres.length ? ADM.genres.map(x => `<label class="check"><input type="checkbox" name="genres" value="${esc(x.genre_id)}" ${(g.genreIds || []).includes(x.genre_id) ? 'checked' : ''} ${dis}> ${esc(x.name)}</label>`).join('') : '<span class="hint">No hay géneros creados en el backend.</span>'}</fieldset>`;
  return `<main class="page">${head}<form class="admin-form panel" onsubmit="saveAdminGame(event)"><label>Nombre:<input class="input" name="title" value="${esc(g.title)}" required maxlength="150" ${dis}></label><label>Precio (COP):<input class="input" name="price" type="number" min="0" step="0.01" value="${esc(g.price)}" required ${dis}></label><label>Clasificación por edad:<select class="input" name="age" required ${dis}>${optList(AGES, g.age)}</select></label><label>URL de la imagen (opcional):<input class="input" name="image" type="url" value="${esc(g.image || '')}" placeholder="https://..." ${dis}></label>${genres}<label class="wide">Descripción:<textarea class="input" name="description" required ${dis}>${esc(g.description)}</textarea></label><label class="check wide"><input type="checkbox" name="active" ${g.active !== false ? 'checked' : ''} ${dis}> Activo (visible en el catálogo)</label>${ADM.formError ? `<div class="alert error wide" role="alert">${esc(ADM.formError)}</div>` : ''}<div class="admin-form-actions"><button class="btn" type="button" ${dis} onclick="safeView('admin-games')">Cancelar</button><button class="btn light" type="submit" ${dis}>${ADM.saving ? '<span class="spinner sm"></span> Guardando…' : editing ? 'Guardar cambios' : 'Guardar videojuego'}</button></div></form></main>`;
}
async function saveAdminGame(e) {
  e.preventDefault();
  if (ADM.saving) return;
  const f = new FormData(e.target), editing = state.adminEditId != null;
  const data = { title: f.get('title').trim(), age: f.get('age'), price: Number(f.get('price')), description: f.get('description').trim(), image: f.get('image').trim(), active: f.get('active') === 'on', genreIds: f.getAll('genres').map(Number) };
  ADM.draft = data; ADM.formError = '';
  if (!data.title || !data.description) { ADM.formError = 'Nombre y descripción son obligatorios.'; return render() }
  if (!Number.isFinite(data.price) || data.price < 0 || Math.abs(data.price * 100 - Math.round(data.price * 100)) > 1e-6) { ADM.formError = 'El precio debe ser un número mayor o igual a 0 con máximo 2 decimales.'; return render() }
  const body = { name: data.title, price: data.price, age_rating: data.age, description: data.description, image_url: data.image || null, is_active: data.active, genres: data.genreIds };
  ADM.saving = true; render();
  try {
    await api(editing ? `/video-games/${encodeURIComponent(state.adminEditId)}` : '/video-games', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
    ADM.saving = false; ADM.draft = null; state.adminEditId = null;
    adminNotice('ok', editing ? 'Cambios guardados correctamente.' : 'Videojuego creado correctamente.', true);
    safeView('admin-games');
  } catch (err) { ADM.saving = false; ADM.formError = err.message; render() }
}

/* ---------- usuarios ---------- */
function adminUsers() {
  const box = stateBox('users', 'los usuarios'), now = new Date(), us = ADM.users, pOk = ADM.st.purchases.s === 'ok';
  const month = us.filter(u => { const c = new Date(u.created); return u.created && !isNaN(c) && c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth() }).length;
  const owned = id => pOk ? ADM.purchases.filter(p => p.userId === id && p.status === 'confirmed').length : '—';
  const rows = us.map(u => {
    const self = String(u.id) === String(state.user.id);
    return `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.admin ? 'Administrador' : 'Usuario'}</td><td>${fmtDate(u.created)}</td><td>${owned(u.id)}</td><td class="row-actions"><button class="btn small" data-id="${esc(u.id)}" onclick="adminEditUser(this.dataset.id)">Editar</button><button class="btn small danger" ${self ? 'disabled title="No puedes eliminar tu propia cuenta"' : ''} data-id="${esc(u.id)}" onclick="adminAskDeleteUser(this.dataset.id)">Eliminar</button></td></tr>`;
  }).join('');
  return `<main class="page"><h1>Gestión de Usuarios</h1>${noticeBox()}${box || `<div class="stats admin-user-stats"><div class="stat"><strong>${us.length}</strong>Total usuarios</div><div class="stat"><strong>${us.filter(u => u.admin).length}</strong>Administradores</div><div class="stat"><strong>${String(month).padStart(2, '0')}</strong>registros este mes</div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Registro</th><th>Juegos</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="hint">No hay usuarios registrados.</td></tr>'}</tbody></table></div>`}</main>`;
}
function adminEditUser(id) { state.adminEditUserId = id; safeView('admin-user-form') }
function adminUserForm() {
  const d = ADM.st.detail, head = '<h1>Editar Usuario</h1><p class="sub">Actualiza el nombre y el correo del usuario</p>';
  if (d.s === 'error') return `<main class="page">${head}<div class="alert error" role="alert"><span>No se pudo cargar el usuario: ${esc(d.e)}</span><button class="btn small" onclick="adminLoadDetail('user')">Reintentar</button></div><button class="btn light" onclick="safeView('admin-users')">Volver</button></main>`;
  if (d.s !== 'ok' || !ADM.editUser) return `<main class="page">${head}<div class="state-box" role="status"><span class="spinner"></span>Cargando usuario…</div></main>`;
  const u = ADM.draft || ADM.editUser, dis = ADM.saving ? 'disabled' : '';
  return `<main class="page">${head}<form class="admin-form panel" onsubmit="saveAdminUser(event)"><label>Nombre:<input class="input" name="name" value="${esc(u.name)}" required maxlength="100" ${dis}></label><label>Correo electrónico:<input class="input" name="email" type="email" value="${esc(u.email)}" required maxlength="150" ${dis}></label>${ADM.formError ? `<div class="alert error wide" role="alert">${esc(ADM.formError)}</div>` : ''}<div class="admin-form-actions"><button class="btn" type="button" ${dis} onclick="safeView('admin-users')">Cancelar</button><button class="btn light" type="submit" ${dis}>${ADM.saving ? '<span class="spinner sm"></span> Guardando…' : 'Guardar cambios'}</button></div></form></main>`;
}
async function saveAdminUser(e) {
  e.preventDefault();
  if (ADM.saving) return;
  const f = new FormData(e.target), data = { name: f.get('name').trim(), email: f.get('email').trim() };
  ADM.draft = data; ADM.formError = ''; ADM.saving = true; render();
  try {
    await api(`/users/${encodeURIComponent(state.adminEditUserId)}`, { method: 'PUT', body: JSON.stringify(data) });
    ADM.saving = false; ADM.draft = null;
    adminNotice('ok', 'Usuario actualizado correctamente.', true);
    safeView('admin-users');
  } catch (err) { ADM.saving = false; ADM.formError = err.message; render() }
}
function adminAskDeleteUser(id) {
  const u = ADM.users.find(x => String(x.id) === String(id)); if (!u) return;
  adminConfirm({
    title: '¿Eliminar este usuario?', text: `${u.name} · ${u.email}`, okLabel: 'Eliminar', danger: true,
    run: async () => {
      await api(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      adminNotice('ok', 'Usuario eliminado correctamente.');
      await adminLoad('users');
    }
  });
}

/* ---------- compras ---------- */
function adminPurchases() {
  const box = stateBox('purchases', 'las compras'), all = ADM.purchases;
  const by = s => all.filter(p => p.status === s);
  const list = { todas: all, pendientes: by('pending'), confirmadas: by('confirmed'), fallidas: by('failed'), canceladas: by('cancelled') }[ADM.filter] || all;
  const chip = (k, label, n) => `<button class="chip ${ADM.filter === k ? 'active' : ''}" onclick="ADM.filter='${k}';render()">${label} (${n})</button>`;
  const rows = list.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.title)}</td><td>${fmtDate(p.date)}</td><td class="price">${money(p.price)}</td><td>${statusBadge(p)}</td><td class="row-actions">${p.status === 'pending' ? `<button class="btn small light" data-id="${esc(p.id)}" onclick="adminAskPurchase(this.dataset.id,'confirmed')">Confirmar</button><button class="btn small danger" data-id="${esc(p.id)}" onclick="adminAskPurchase(this.dataset.id,'failed')">Rechazar</button>` : '—'}</td></tr>`).join('');
  return `<main class="page"><div class="admin-title-row"><div><h1>Compras</h1><p class="sub">Revisa y confirma las compras pendientes</p></div><button class="btn" onclick="adminLoad('purchases')">Actualizar</button></div>${noticeBox()}${box || `<div class="stats admin-user-stats"><div class="stat"><strong>${all.length}</strong>Total compras</div><div class="stat"><strong>${by('pending').length}</strong>Pendientes</div><div class="stat"><strong>${money(by('confirmed').reduce((a, p) => a + p.price, 0))}</strong>Ingresos confirmados</div></div><div class="filters toolbar">${chip('todas', 'Todas', all.length)}${chip('pendientes', 'Pendientes', by('pending').length)}${chip('confirmadas', 'Confirmadas', by('confirmed').length)}${chip('fallidas', 'Fallidas', by('failed').length)}${chip('canceladas', 'Canceladas', by('cancelled').length)}</div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Usuario</th><th>Videojuego</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="hint">No hay compras en esta categoría.</td></tr>'}</tbody></table></div>`}</main>`;
}
function adminAskPurchase(id, status) {
  const p = ADM.purchases.find(x => String(x.id) === String(id)); if (!p) return;
  const ok = status === 'confirmed';
  adminConfirm({
    title: ok ? '¿Confirmar esta compra?' : '¿Rechazar esta compra?', text: `${p.name} · ${p.title} · ${money(p.price)}`, okLabel: ok ? 'Confirmar compra' : 'Rechazar compra', danger: !ok,
    run: async () => {
      await api(`/purchases/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      adminNotice('ok', ok ? 'Compra confirmada correctamente.' : 'Compra rechazada.');
      await adminLoad('purchases');
    }
  });
}
