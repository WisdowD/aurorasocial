/* ─── Config ─── */
const API = '/api';

/* ─── State ─── */
let state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  currentPage: 'home',
  feedTab: 'following',
  profileUser: null,
  notifBadge: 0,
};

/* ─── API ─── */
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403 && data.error?.includes('banida')) {
      alert(data.error);
      state.token = null; state.user = null;
      localStorage.removeItem('token'); localStorage.removeItem('user');
      location.reload();
    }
    throw new Error(data.error || 'Erro');
  }
  return data;
}

/* ─── Toast ─── */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ─── Helpers ─── */
function timeAgo(d) {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function avatarHtml(user, size = 'sm') {
  const letter = (user?.username || '?')[0].toUpperCase();
  if (user?.avatar_url) return `<img class="avatar avatar-${size}" src="${user.avatar_url}" alt="${user.username}" onerror="this.outerHTML='<div class=\\'avatar avatar-${size} avatar-placeholder\\'>${letter}</div>'">`;
  return `<div class="avatar avatar-${size} avatar-placeholder">${letter}</div>`;
}

/* ─── Tema ─── */
function toggleDarkMode(isDark) {
  document.body.classList.toggle('light', !isDark);
  localStorage.setItem('darkMode', isDark ? 'dark' : 'light');
}
function changeFontSize(val) {
  const scale = val / 15;
  document.documentElement.style.fontSize = val + 'px';
  document.documentElement.style.setProperty('--font-size-base', val + 'px');
  document.documentElement.style.setProperty('--font-scale', scale);
  localStorage.setItem('fontSize', val);
}
function applyPreferences() {
  const dm = localStorage.getItem('darkMode');
  const dark = dm !== 'light';
  document.body.classList.toggle('light', !dark);
  const toggle = document.getElementById('toggle-dark');
  if (toggle) toggle.checked = dark;

  const fs = localStorage.getItem('fontSize');
  if (fs) {
    const scale = fs / 15;
    document.documentElement.style.fontSize = fs + 'px';
    document.documentElement.style.setProperty('--font-size-base', fs + 'px');
    document.documentElement.style.setProperty('--font-scale', scale);
    const slider = document.getElementById('font-size-slider');
    if (slider) slider.value = fs;
  }
}

/* ─── Nav ─── */
function navigate(page, data = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');

  // sidebar itens
  document.querySelectorAll('.sidebar-item[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('.mobile-nav-item[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === page));

  state.currentPage = page;
  const init = { home: initHome, search: initSearch, notifications: initNotifications, profile: () => initProfile(data.userId || state.user?.id), settings: initSettings };
  if (init[page]) init[page]();
  window.scrollTo(0, 0);
}

/* ─── Sidebar user info ─── */
function updateSidebarUser() {
  const u = state.user;
  if (!u) return;
  const letter = (u.username || '?')[0].toUpperCase();
  const av = document.getElementById('sidebar-avatar');
  if (av) { av.textContent = u.avatar_url ? '' : letter; if (u.avatar_url) { av.innerHTML = `<img class="avatar avatar-sm" src="${u.avatar_url}" alt="${u.username}">`; } }
  const nm = document.getElementById('sidebar-user-name'); if (nm) nm.textContent = u.username || '—';
  const hd = document.getElementById('sidebar-user-handle'); if (hd) hd.textContent = `@${u.handle || '—'}`;
}

/* ─── Painel Direita (só desktop) ─── */
async function loadWhoToFollow() {
  try {
    const users = await api('/users?q=');
    const list = document.getElementById('right-follow-list');
    if (!list) return;
    const others = users.filter(u => u.id !== state.user?.id).slice(0, 4);
    if (!others.length) { list.innerHTML = '<p style="font-size:13px;color:var(--text-faint);text-align:center;padding:8px">Nenhuma sugestão</p>'; return; }
    list.innerHTML = others.map(u => `
      <div class="follow-item follow-item-clickable" onclick="navigate('profile',{userId:${u.id}})">
        ${avatarHtml(u, 'sm')}
        <div class="follow-info">
          <div class="follow-name">${escHtml(u.username)}</div>
          <div class="follow-handle">@${escHtml(u.handle)}</div>
        </div>
        <button class="btn btn-outline btn-sm ${u.isFollowing ? 'following' : ''}" onclick="event.stopPropagation();quickFollow(${u.id},this)">
          ${u.isFollowing ? 'Seguindo' : 'Seguir'}
        </button>
      </div>
    `).join('');
  } catch { }
}

/* ══════════ AUTH ══════════ */
function initAuth() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('page-auth').style.display = 'flex';
  document.getElementById('page-auth').style.flexDirection = 'column';
  document.getElementById('page-auth').style.alignItems = 'center';
  document.getElementById('page-auth').style.justifyContent = 'center';
  document.getElementById('page-auth').style.minHeight = '100dvh';
  document.getElementById('page-auth').style.background = 'var(--bg)';
}
function showApp() {
  document.getElementById('page-auth').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  updateSidebarUser();
  navigate('home');
  fetchUnreadCount();
  loadWhoToFollow();
  applyPreferences();
  if (state.user?.is_admin) document.getElementById('admin-nav-item').style.display = '';
}
async function handleLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: e.target.email.value, password: e.target.password.value }) });
    state.token = data.token; state.user = data.user;
    localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
    showApp();
  } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; btn.textContent = 'Entrar'; }
}
async function handleRegister(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Criando...';
  try {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ username: e.target.username.value, handle: e.target.handle.value, email: e.target.email.value, password: e.target.password.value }) });
    state.token = data.token; state.user = data.user;
    localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
    showApp();
  } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; btn.textContent = 'Criar conta'; }
}
function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  initAuth();
}

/* ══════════ HOME ══════════ */
async function initHome() { setFeedTab(state.feedTab); }
function setFeedTab(tab) {
  state.feedTab = tab;
  document.querySelectorAll('#page-home .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  loadFeed(tab);
}
async function loadFeed(tab) {
  const c = document.getElementById('feed-posts');
  c.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try {
    let endpoint;
    if (tab === 'popular') endpoint = '/posts/popular';
    else if (tab === 'home') endpoint = '/posts/home';
    else endpoint = '/posts/feed'; // 'following'
    const posts = await api(endpoint);
    if (!posts.length && tab === 'following') {
      c.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg><p>Siga alguém para ver posts aqui!</p></div>`;
    } else {
      renderPosts(c, posts);
    }
  } catch { c.innerHTML = `<div class="empty-state"><p>Erro ao carregar.</p></div>`; }
}
function renderPosts(c, posts) {
  if (!posts.length) { c.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9"/></svg><p>Nada por aqui. Siga alguém!</p></div>`; return; }
  c.innerHTML = posts.map(postCard).join('');
}
function postCard(p) {
  const isOwner = state.user && p.author?.id === state.user.id;
  const isAdmin = state.user?.is_admin;
  const canDelete = isOwner || isAdmin;
  const deleteAction = isAdmin && !isOwner ? `adminDeletePost(${p.id},this)` : `deletePost(${p.id},this)`;
  return `<div class="card" data-post-id="${p.id}" onclick="navigate('profile',{userId:${p.author?.id}})" style="cursor:pointer">
    <div class="post-header">
      <div style="flex-shrink:0" onclick="event.stopPropagation();navigate('profile',{userId:${p.author?.id}})">${avatarHtml(p.author, 'sm')}</div>
      <div style="flex:1;min-width:0" onclick="event.stopPropagation();navigate('profile',{userId:${p.author?.id}})">
        <div class="post-author-name">${escHtml(p.author?.username || 'Usuário')}</div>
        <div class="post-author-handle">@${escHtml(p.author?.handle || '')} · ${timeAgo(p.created_at)}</div>
      </div>
      ${canDelete ? `<button class="post-action post-delete-btn" title="Excluir post" onclick="event.stopPropagation();${deleteAction}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </button>` : ''}
    </div>
    <div class="post-content" onclick="event.stopPropagation()">${escHtml(p.content)}</div>
    ${p.image_url ? `<img class="post-image" src="${escHtml(p.image_url)}" alt="" loading="lazy" onclick="event.stopPropagation()">` : ''}
    <div class="post-actions" onclick="event.stopPropagation()">
      <button class="post-action ${p.liked ? 'liked' : ''}" onclick="event.stopPropagation();toggleLike(${p.id},this)">
        <svg viewBox="0 0 24 24" fill="${p.liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        <span>${p.likes}</span>
      </button>
      <button class="post-action" onclick="event.stopPropagation();openComments(${p.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <span>${p.comments}</span>
      </button>
      <button class="post-action ${p.saved ? 'saved' : ''}" onclick="event.stopPropagation();toggleSave(${p.id},this)" style="margin-left:auto">
        <svg viewBox="0 0 24 24" fill="${p.saved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
      </button>
    </div>
  </div>`;
}
async function deletePost(id, btn) {
  if (!confirm('Excluir este post?')) return;
  try {
    await api(`/posts/${id}`, { method: 'DELETE' });
    const card = btn.closest('[data-post-id]');
    if (card) { card.style.transition = 'opacity 0.2s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 200); }
    toast('Post excluído!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

/* ── Interações ── */
async function toggleLike(id, btn) {
  try {
    const r = await api(`/posts/${id}/like`, { method: 'POST' });
    btn.classList.toggle('liked', r.liked);
    btn.querySelector('svg').setAttribute('fill', r.liked ? 'currentColor' : 'none');
    const s = btn.querySelector('span'); s.textContent = parseInt(s.textContent) + (r.liked ? 1 : -1);
  } catch (e) { toast(e.message, 'error'); }
}
async function toggleShare(id, btn) {
  try {
    const r = await api(`/posts/${id}/share`, { method: 'POST' });
    btn.classList.toggle('shared', r.shared);
    const s = btn.querySelector('span'); s.textContent = parseInt(s.textContent) + (r.shared ? 1 : -1);
  } catch (e) { toast(e.message, 'error'); }
}
async function toggleSave(id, btn) {
  try {
    const r = await api(`/posts/${id}/save`, { method: 'POST' });
    btn.classList.toggle('saved', r.saved);
    btn.querySelector('svg').setAttribute('fill', r.saved ? 'currentColor' : 'none');
    toast(r.saved ? 'Post salvo!' : 'Removido dos salvos', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

/* ── Post ── */
let replyToId = null;
let currentCommentPostId = null;

function openNewPost() { replyToId = null; openPostSheet(); }
function openReply(id) { replyToId = id; openPostSheet(); }

/* ══════════ COMMENTS ══════════ */
async function openComments(postId) {
  currentCommentPostId = postId;
  const overlay = document.getElementById('overlay-comments');
  const listEl = document.getElementById('comments-list');
  const origEl = document.getElementById('comments-original-post');
  overlay.classList.add('open');
  listEl.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  origEl.innerHTML = '';
  // updatar avatar
  if (state.user) {
    const av = document.getElementById('comments-my-avatar');
    if (state.user.avatar_url) { av.innerHTML = `<img src="${escHtml(state.user.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; av.style.background = 'none'; }
    else { av.textContent = (state.user.username||'?')[0].toUpperCase(); }
  }
  try {
    const data = await api(`/posts/${postId}`);
    // backend retorna { ...post, replies: [...] }
    const p = data;
    origEl.innerHTML = `<div class="comment-original-card">
      <div style="display:flex;gap:10px;align-items:flex-start">
        ${avatarHtml(p.author, 'sm')}
        <div>
          <span class="post-author-name">${escHtml(p.author?.username||'')}</span>
          <span class="post-author-handle" style="margin-left:6px">@${escHtml(p.author?.handle||'')} · ${timeAgo(p.created_at)}</span>
          <div class="post-content" style="margin-top:4px">${escHtml(p.content)}</div>
        </div>
      </div>
    </div>`;
    const replies = data.replies || [];
    if (!replies.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:32px 0"><p>Nenhum comentário ainda. Seja o primeiro!</p></div>`;
    } else {
      listEl.innerHTML = replies.map(r => `
        <div class="comment-item">
          <div style="display:flex;gap:10px;align-items:flex-start">
            ${avatarHtml(r.author, 'sm')}
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span class="post-author-name">${escHtml(r.author?.username||'')}</span>
                <span class="post-author-handle">@${escHtml(r.author?.handle||'')} · ${timeAgo(r.created_at)}</span>
              </div>
              <div class="post-content" style="margin-top:2px">${escHtml(r.content)}</div>
              ${r.image_url ? `<img src="${escHtml(r.image_url)}" style="max-width:100%;border-radius:10px;margin-top:8px" loading="lazy">` : ''}
            </div>
          </div>
        </div>`).join('');
    }
  } catch(e) {
    listEl.innerHTML = `<div class="empty-state"><p>Erro ao carregar comentários.</p></div>`;
  }
}

function closeComments() {
  document.getElementById('overlay-comments').classList.remove('open');
  document.getElementById('comments-textarea').value = '';
  currentCommentPostId = null;
}

async function submitComment() {
  const ta = document.getElementById('comments-textarea');
  const content = ta.value.trim();
  if (!content) return toast('Escreva algo!', 'error');
  try {
    await api('/posts', { method: 'POST', body: JSON.stringify({ content, parent_id: currentCommentPostId }) });
    ta.value = '';
    ta.style.height = '';
    toast('Comentário enviado!', 'success');
    openComments(currentCommentPostId); // reload
  } catch(e) { toast(e.message, 'error'); }
}

function autoResizeCommentBox(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ══════════ TRENDING SEARCH ══════════ */
function searchTrending(tag) {
  navigate('search');
}
let postImageDataUrl = null;

function handlePostImagePick(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    postImageDataUrl = e.target.result;
    document.getElementById('post-img-preview-img').src = postImageDataUrl;
    document.getElementById('post-img-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function clearPostImage() {
  postImageDataUrl = null;
  document.getElementById('post-img-preview').style.display = 'none';
  document.getElementById('post-img-preview-img').src = '';
  document.getElementById('post-img-file').value = '';
}

function handleEditAvatarPick(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('edit-avatar').value = '';
    document.getElementById('edit-avatar-img').src = e.target.result;
    document.getElementById('edit-avatar-img').style.display = 'block';
    document.getElementById('edit-avatar').dataset.localSrc = e.target.result;
  };
  reader.readAsDataURL(file);
}

function previewAvatarUrl(url) {
  const img = document.getElementById('edit-avatar-img');
  if (url) { img.src = url; img.style.display = 'block'; }
  else img.style.display = 'none';
}

function handleEditBannerPick(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('edit-banner').value = '';
    document.getElementById('edit-banner-img').src = e.target.result;
    document.getElementById('edit-banner-img').style.display = 'block';
    document.getElementById('edit-banner').dataset.localSrc = e.target.result;
  };
  reader.readAsDataURL(file);
}

function previewBannerUrl(url) {
  const img = document.getElementById('edit-banner-img');
  if (url) { img.src = url; img.style.display = 'block'; }
  else img.style.display = 'none';
}

function openPostSheet() { document.getElementById('overlay-post').classList.add('open'); document.getElementById('post-textarea').focus(); }
function closePostSheet() { document.getElementById('overlay-post').classList.remove('open'); document.getElementById('post-textarea').value = ''; clearPostImage(); document.getElementById('post-char-count').textContent = '280'; }
async function submitPost() {
  const content = document.getElementById('post-textarea').value.trim();
  const image_url = postImageDataUrl || undefined;
  if (!content) return toast('Escreva algo!', 'error');
  try {
    await api('/posts', { method: 'POST', body: JSON.stringify({ content, image_url, parent_id: replyToId }) });
    closePostSheet(); toast('Post publicado!', 'success');
    if (state.currentPage === 'home') loadFeed(state.feedTab);
    else if (state.currentPage === 'profile') loadProfilePosts();
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════════ SEARCH ══════════ */
let searchTimer;
async function initSearch() { document.getElementById('search-input').value = ''; loadHighlights(); }
async function loadHighlights() {
  const c = document.getElementById('search-results');
  c.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try { const p = await api('/posts/home'); c.innerHTML = p.slice(0, 10).map(postCard).join(''); } catch { c.innerHTML = ''; }
}
function handleSearch(v) { clearTimeout(searchTimer); searchTimer = setTimeout(() => doSearch(v.trim()), 350); }
async function doSearch(q) {
  const c = document.getElementById('search-results');
  if (!q) { loadHighlights(); return; }
  c.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try {
    const users = await api(`/users?q=${encodeURIComponent(q)}`);
    if (!users.length) { c.innerHTML = `<div class="empty-state"><p>Nenhum resultado para "${escHtml(q)}"</p></div>`; return; }
    c.innerHTML = users.map(u => `
      <div class="card" style="cursor:pointer" onclick="navigate('profile',{userId:${u.id}})">
        <div class="post-header">
          ${avatarHtml(u, 'sm')}
          <div style="flex:1">
            <div class="post-author-name">${escHtml(u.username)}</div>
            <div class="post-author-handle">@${escHtml(u.handle)}</div>
          </div>
          <button class="btn btn-outline btn-sm ${u.isFollowing ? 'following' : ''}" onclick="event.stopPropagation();quickFollow(${u.id},this)">${u.isFollowing ? 'Seguindo' : 'Seguir'}</button>
        </div>
        ${u.bio ? `<p style="font-size:13px;color:var(--text-muted)">${escHtml(u.bio)}</p>` : ''}
      </div>`).join('');
  } catch { c.innerHTML = `<div class="empty-state"><p>Erro na busca.</p></div>`; }
}
async function quickFollow(id, btn) {
  try { const r = await api(`/users/${id}/follow`, { method: 'POST' }); btn.textContent = r.following ? 'Seguindo' : 'Seguir'; btn.classList.toggle('following', r.following); } catch (e) { toast(e.message, 'error'); }
}

/* ══════════ NOTIFICATIONS ══════════ */
async function initNotifications() {
  const c = document.getElementById('notif-list');
  c.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try {
    const notifs = await api('/notifications');
    await api('/notifications/read', { method: 'PUT' });
    state.notifBadge = 0; updateNotifBadge();
    renderNotifications(c, notifs);
  } catch { c.innerHTML = `<div class="empty-state"><p>Erro ao carregar.</p></div>`; }
}
function renderNotifications(c, notifs) {
  if (!notifs.length) { c.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg><p>Sem notificações.</p></div>`; return; }
  const now = Date.now(), day = 86400000;
  const groups = { today: [], yesterday: [], older: [] };
  notifs.forEach(n => { const d = now - new Date(n.created_at); if (d < day) groups.today.push(n); else if (d < 2 * day) groups.yesterday.push(n); else groups.older.push(n); });
  let html = '';
  if (groups.today.length) html += `<div class="notif-section-label">Hoje</div>` + groups.today.map(notifItem).join('');
  if (groups.yesterday.length) html += `<div class="notif-section-label">Ontem</div>` + groups.yesterday.map(notifItem).join('');
  if (groups.older.length) html += `<div class="notif-section-label">Anteriores</div>` + groups.older.map(notifItem).join('');
  c.innerHTML = html;
}
const notifIcons = {
  like: `<svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  follow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`
};
const notifMessages = { like: 'curtiu seu post', comment: 'comentou no seu post', share: 'compartilhou seu post', follow: 'começou a te seguir' };
function notifItem(n) {
  return `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="navigate('profile',{userId:${n.actor_id}})">
    <div class="notif-icon-wrap ${n.type}">${notifIcons[n.type] || ''}</div>
    <div style="display:flex;align-items:center;gap:8px;flex:1">
      ${avatarHtml({ username: n.actor_name, avatar_url: n.actor_avatar }, 'sm')}
      <div class="notif-text"><strong>${escHtml(n.actor_name)}</strong> ${notifMessages[n.type] || ''}</div>
    </div>
    <span class="notif-time">${timeAgo(n.created_at)}</span>
  </div>`;
}
async function fetchUnreadCount() {
  try { const { count } = await api('/notifications/unread-count'); state.notifBadge = count; updateNotifBadge(); } catch { }
}
function updateNotifBadge() {
  ['notif-badge', 'notif-badge-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = state.notifBadge; el.style.display = state.notifBadge > 0 ? 'flex' : 'none'; }
  });
}

/* ══════════ PROFILE ══════════ */
async function initProfile(userId) {
  const isMe = !userId || userId === state.user?.id;
  const c = document.getElementById('profile-content');
  c.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try {
    const user = isMe ? await api('/users/me') : await api(`/users/${userId}`);
    state.profileUser = user;
    renderProfile(user, isMe);
    loadProfilePosts('posts');
  } catch { c.innerHTML = `<div class="empty-state"><p>Erro ao carregar perfil.</p></div>`; }
}
function renderProfile(user, isMe) {
  const c = document.getElementById('profile-content');
  c.innerHTML = `
    <div class="profile-banner" ${user.banner_url ? `style="background-image:url('${user.banner_url}');background-size:cover;background-position:center"` : ''}>
    </div>
    <div class="profile-info">
      <div class="profile-avatar-wrap">${avatarHtml(user, 'lg')}</div>
      <div class="profile-name">${escHtml(user.username)}</div>
      <div class="profile-handle">@${escHtml(user.handle)}</div>
      ${user.bio ? `<div class="profile-bio">${escHtml(user.bio)}</div>` : ''}
      <div class="profile-stats">
        <div class="stat-item" onclick="setProfileTab('followers',${user.id})" title="Ver seguidores">
          <div class="stat-value">${user.followers ?? 0}</div>
          <div class="stat-label">Seguidores ↗</div>
        </div>
        <div class="stat-item" style="cursor:default" onclick="setProfileTab('posts',${user.id})">
          <div class="stat-value">${user.posts_count ?? 0}</div>
          <div class="stat-label">Posts</div>
        </div>
        <div class="stat-item" onclick="setProfileTab('following',${user.id})" title="Ver seguindo">
          <div class="stat-value">${user.following ?? 0}</div>
          <div class="stat-label">Seguindo ↗</div>
        </div>
      </div>
      ${isMe
      ? `<button class="btn btn-outline" onclick="openEditProfile()">Editar Perfil</button>`
      : `<button id="follow-btn" class="btn ${user.isFollowing ? 'btn-outline following' : 'btn-primary'}" onclick="toggleFollow(${user.id})">${user.isFollowing ? 'Seguindo' : 'Seguir'}</button>`
    }
    </div>
    <div class="tab-bar" style="position:static">
      <button class="tab active" data-ptab="posts" onclick="setProfileTab('posts',${user.id})">Posts</button>
      <button class="tab" data-ptab="comments" onclick="setProfileTab('comments',${user.id})">Respostas</button>
      <button class="tab" data-ptab="saved" onclick="setProfileTab('saved',${user.id})">Salvos</button>
    </div>
    <div id="profile-posts"></div>`;
}
function setProfileTab(tab, uid) {
  document.querySelectorAll('[data-ptab]').forEach(t => t.classList.toggle('active', t.dataset.ptab === tab));
  loadProfilePosts(tab, uid);
}
async function loadProfilePosts(tab = 'posts', uid) {
  const id = uid || state.profileUser?.id;
  const c = document.getElementById('profile-posts');
  if (!c || !id) return;
  c.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try {
    if (tab === 'followers' || tab === 'following') {
      const users = await api(`/users/${id}/${tab}`);
      if (!users.length) {
        c.innerHTML = `<div class="empty-state"><p>${tab === 'followers' ? 'Nenhum seguidor ainda.' : 'Não está seguindo ninguém.'}</p></div>`;
        return;
      }
      c.innerHTML = users.map(u => `
        <div class="follow-item follow-item-clickable" onclick="navigate('profile',{userId:${u.id}})">
          ${avatarHtml(u, 'sm')}
          <div class="follow-info">
            <div class="follow-name">${escHtml(u.username)}</div>
            <div class="follow-handle">@${escHtml(u.handle)}</div>
            ${u.bio ? `<div class="follow-bio">${escHtml(u.bio)}</div>` : ''}
          </div>
          ${u.id !== state.user?.id ? `<button class="btn btn-sm ${u.isFollowing ? 'btn-outline following' : 'btn-primary'}" onclick="event.stopPropagation();quickFollow(${u.id},this)">${u.isFollowing ? 'Seguindo' : 'Seguir'}</button>` : ''}
        </div>`).join('');
    } else {
      const p = await api(`/posts/user/${id}?tab=${tab}`);
      renderPosts(c, p);
    }
  } catch { c.innerHTML = `<div class="empty-state"><p>Erro.</p></div>`; }
}
async function toggleFollow(userId) {
  try {
    const r = await api(`/users/${userId}/follow`, { method: 'POST' });
    const btn = document.getElementById('follow-btn');
    btn.textContent = r.following ? 'Seguindo' : 'Seguir';
    btn.className = `btn ${r.following ? 'btn-outline following' : 'btn-primary'}`;
  } catch (e) { toast(e.message, 'error'); }
}
function openEditProfile() {
  const u = state.profileUser || state.user;
  document.getElementById('edit-username').value = u.username || '';
  document.getElementById('edit-bio').value = u.bio || '';
  document.getElementById('edit-avatar').value = u.avatar_url || '';
  document.getElementById('edit-banner').value = u.banner_url || '';
  const avatarImg = document.getElementById('edit-avatar-img');
  if (u.avatar_url) { avatarImg.src = u.avatar_url; avatarImg.style.display = 'block'; } else avatarImg.style.display = 'none';
  const bannerImg = document.getElementById('edit-banner-img');
  if (u.banner_url) { bannerImg.src = u.banner_url; bannerImg.style.display = 'block'; } else bannerImg.style.display = 'none';
  document.getElementById('overlay-edit').classList.add('open');
}
async function submitEditProfile() {
  try {
    const avatarInput = document.getElementById('edit-avatar');
    const bannerInput = document.getElementById('edit-banner');
    const avatar_url = avatarInput.dataset.localSrc || avatarInput.value;
    const banner_url = bannerInput.dataset.localSrc || bannerInput.value;
    const user = await api('/users/me', { method: 'PUT', body: JSON.stringify({ username: document.getElementById('edit-username').value, bio: document.getElementById('edit-bio').value, avatar_url, banner_url }) });
    avatarInput.dataset.localSrc = ''; bannerInput.dataset.localSrc = '';
    state.user = user; localStorage.setItem('user', JSON.stringify(user));
    document.getElementById('overlay-edit').classList.remove('open');
    toast('Perfil atualizado!', 'success');
    updateSidebarUser();
    initProfile(state.user.id);
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════════ SETTINGS ══════════ */
function initSettings() {
  applyPreferences();
  const adminSection = document.getElementById('settings-admin-section');
  if (adminSection) adminSection.style.display = state.user?.is_admin ? '' : 'none';
}

/* ══════════ ADMIN PANEL ══════════ */
let _banTargetId = null;

function openAdminPanel() {
  document.getElementById('overlay-admin').classList.add('open');
  switchAdminTab('users');
}
function closeAdminPanel() {
  document.getElementById('overlay-admin').classList.remove('open');
}
function switchAdminTab(tab) {
  document.getElementById('admin-tab-users').classList.toggle('active', tab === 'users');
  document.getElementById('admin-tab-posts').classList.toggle('active', tab === 'posts');
  if (tab === 'users') loadAdminUsers();
  else loadAdminPosts();
}
async function loadAdminUsers() {
  const c = document.getElementById('admin-content');
  c.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try {
    const users = await api('/admin/users');
    if (!users.length) { c.innerHTML = `<p style="color:var(--text-2);text-align:center">Nenhum usuário.</p>`; return; }
    c.innerHTML = users.map(u => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        ${avatarHtml(u, 'sm')}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;display:flex;align-items:center;gap:6px">
            ${escHtml(u.username)}
            ${u.is_admin ? `<span style="font-size:.65em;background:var(--accent);color:#fff;padding:1px 5px;border-radius:4px">Admin</span>` : ''}
            ${u.banned ? `<span style="font-size:.65em;background:#e53e3e;color:#fff;padding:1px 5px;border-radius:4px">Banido</span>` : ''}
          </div>
          <div style="color:var(--text-2);font-size:.82em">@${escHtml(u.handle)} · ${escHtml(u.email)}</div>
          ${u.banned && u.ban_reason ? `<div style="color:#e53e3e;font-size:.78em;margin-top:2px">Motivo: ${escHtml(u.ban_reason)}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          ${!u.is_admin && !u.banned ? `<button class="btn btn-sm" style="background:#e53e3e;color:#fff;border:none" onclick="openBanModal(${u.id},'${escHtml(u.username)}')">Banir</button>` : ''}
          ${!u.is_admin && u.banned ? `<button class="btn btn-sm btn-outline" onclick="unbanUser(${u.id},this)">Desbanir</button>` : ''}
        </div>
      </div>`).join('');
  } catch (e) { c.innerHTML = `<p style="color:var(--text-2)">Erro: ${e.message}</p>`; }
}
async function loadAdminPosts() {
  const c = document.getElementById('admin-content');
  c.innerHTML = `<div class="loader"><div class="spinner"></div></div>`;
  try {
    const posts = await api('/posts/home');
    if (!posts.length) { c.innerHTML = `<p style="color:var(--text-2);text-align:center">Nenhum post.</p>`; return; }
    c.innerHTML = posts.map(p => `
      <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start">
        ${avatarHtml(p.author, 'sm')}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.88em">${escHtml(p.author?.username||'')} <span style="color:var(--text-2);font-weight:400">· ${timeAgo(p.created_at)}</span></div>
          <div style="font-size:.88em;margin-top:2px;word-break:break-word">${escHtml(p.content)}</div>
        </div>
        <button class="post-action post-delete-btn" title="Excluir" onclick="adminDeletePost(${p.id},this)" style="flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>`).join('');
  } catch (e) { c.innerHTML = `<p style="color:var(--text-2)">Erro: ${e.message}</p>`; }
}
async function adminDeletePost(id, btn) {
  if (!confirm('Excluir este post como admin?')) return;
  try {
    await api(`/admin/posts/${id}`, { method: 'DELETE' });
    const card = btn.closest('[data-post-id]') || btn.closest('div[style*="border-bottom"]');
    if (card) { card.style.transition = 'opacity .2s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 200); }
    toast('Post excluído!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
function openBanModal(userId, username) {
  _banTargetId = userId;
  document.getElementById('ban-modal-username').textContent = `Banir: ${username}`;
  document.getElementById('ban-reason-input').value = '';
  document.getElementById('overlay-ban').classList.add('open');
}
function closeBanModal() {
  _banTargetId = null;
  document.getElementById('overlay-ban').classList.remove('open');
}
async function confirmBan() {
  const reason = document.getElementById('ban-reason-input').value.trim();
  if (!reason) { toast('Informe o motivo do banimento', 'error'); return; }
  try {
    await api(`/admin/users/${_banTargetId}/ban`, { method: 'POST', body: JSON.stringify({ reason }) });
    toast('Usuário banido com sucesso.', 'success');
    closeBanModal();
    loadAdminUsers();
  } catch (e) { toast(e.message, 'error'); }
}
async function unbanUser(userId, btn) {
  if (!confirm('Desbanir este usuário?')) return;
  try {
    await api(`/admin/users/${userId}/unban`, { method: 'POST' });
    toast('Usuário desbanido.', 'success');
    loadAdminUsers();
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════════ INIT ══════════ */
document.addEventListener('DOMContentLoaded', () => {
  applyPreferences();
  if (state.token && state.user) showApp();
  else initAuth();
  setInterval(fetchUnreadCount, 60000);
});