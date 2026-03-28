// ======/* ============================================================
   script.js — DiscBoard
   Supabase + Discord OAuth + Server Cards + Modal + Realtime
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

/* ══════════════════════════════════════════
   ⚙️ الإعدادات — استبدل القيم بمشروعك
══════════════════════════════════════════ */
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ══════════════════════════════════════════
   🔒 XSS Protection
══════════════════════════════════════════ */
function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ══════════════════════════════════════════
   🎨 Letter Avatar (fallback للصور المكسورة)
══════════════════════════════════════════ */
function buildLetterAvatar(name = '?') {
  const letter = name.trim()[0]?.toUpperCase() || '?';
  const colors = ['#00d2ff', '#3a7bd5', '#7b5ea7', '#00e676', '#ffab40'];
  const color  = colors[letter.charCodeAt(0) % colors.length];
  const div    = document.createElement('div');
  div.style.cssText = `
    width:100%; height:100%;
    display:flex; align-items:center; justify-content:center;
    background:${color}22; color:${color};
    font-size:20px; font-weight:900;
    font-family:'Cairo',sans-serif;
    border-radius:inherit;
  `;
  div.textContent = letter;
  return div;
}

/* ══════════════════════════════════════════
   🃏 بناء HTML كارت السيرفر
══════════════════════════════════════════ */
function buildServerCard(server, currentUserId) {
  const {
    id, name = '', description = '', category = 'Other',
    invite_url = '#', icon_url = '', member_count = 0,
    owner_id = ''
  } = server;

  const catClass = {
    Gaming: 'cat-gaming',
    Anime:  'cat-anime',
    Dev:    'cat-dev',
    Medieval: 'cat-medieval',
  }[category] || 'cat-other';

  const catLabel = {
    Gaming: '🎮 ألعاب', Anime: '🎌 أنمي',
    Dev: '💻 برمجة',   Medieval: '⚔️ ميديفال',
  }[category] || '🌐 أخرى';

  const members = Number(member_count).toLocaleString('ar-EG');
  const isOwner = currentUserId && currentUserId === owner_id;

  const iconHTML = icon_url
    ? `<img src="${escHtml(icon_url)}" alt="${escHtml(name)}"
           onerror="this.replaceWith(buildLetterAvatar('${escHtml(name)}'))">`
    : `<div id="avatar-${escHtml(id)}"></div>`;

  const deleteBtn = isOwner
    ? `<button class="btn btn-danger btn-sm"
         onclick="window.openDeleteModal('${escHtml(id)}')">🗑️</button>`
    : '';

  return `
    <div class="server-card" data-id="${escHtml(id)}"
         data-name="${escHtml(name)}" data-cat="${escHtml(category)}">
      <div class="card-banner">
        <div class="card-icon">${iconHTML}</div>
      </div>
      <div class="card-body">
        <div class="card-top">
          <div class="card-name">${escHtml(name)}</div>
          <span class="card-category ${catClass}">${catLabel}</span>
        </div>
        <p class="card-desc">${escHtml(description)}</p>
        <div class="card-footer">
          <span class="card-members">
            <span class="members-dot"></span>
            ${members} عضو
          </span>
          <div style="display:flex;gap:8px;align-items:center;">
            ${deleteBtn}
            <a href="${escHtml(invite_url)}" target="_blank"
               rel="noopener noreferrer" class="card-join">
              انضم ←
            </a>
          </div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   📦 State
══════════════════════════════════════════ */
let allServers    = [];
let currentUser   = null;
let activeCategory = 'all';
let searchQuery    = '';
let pendingDeleteId = null;

/* ══════════════════════════════════════════
   🖼️ عرض السيرفرات في الـ Grid
══════════════════════════════════════════ */
function renderServers() {
  const grid = document.getElementById('servers-grid');
  if (!grid) return;

  let filtered = allServers.filter(s => {
    const matchCat  = activeCategory === 'all' || s.category === activeCategory;
    const matchSearch = !searchQuery ||
      s.name?.toLowerCase().includes(searchQuery) ||
      s.description?.toLowerCase().includes(searchQuery);
    return matchCat && matchSearch;
  });

  // تحديث العداد
  const countEl = document.getElementById('server-count');
  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">لا توجد نتائج</div>
        <div class="empty-sub">جرّب تغيير الفلتر أو كلمة البحث</div>
      </div>`;
    return;
  }

  grid.innerHTML = filtered
    .map(s => buildServerCard(s, currentUser?.id))
    .join('');

  // Letter avatars للصور الناقصة
  filtered.forEach(s => {
    if (!s.icon_url) {
      const el = document.getElementById(`avatar-${s.id}`);
      if (el) el.replaceWith(buildLetterAvatar(s.name));
    }
  });
}

/* ══════════════════════════════════════════
   🌀 Skeleton Loader
══════════════════════════════════════════ */
function showSkeleton() {
  const grid = document.getElementById('servers-grid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill(`
    <div class="skeleton">
      <div class="skeleton-banner"></div>
      <div class="skeleton-body">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════
   📡 جلب السيرفرات من Supabase
══════════════════════════════════════════ */
async function fetchServers() {
  showSkeleton();
  const { data, error } = await supabase
    .from('servers')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: false });

  if (error) {
    showToast('خطأ في جلب السيرفرات', 'error');
    console.error(error);
    return;
  }

  allServers = data || [];
  renderServers();
}

/* ══════════════════════════════════════════
   🔔 Realtime — تحديث تلقائي عند إضافة/حذف
══════════════════════════════════════════ */
function subscribeRealtime() {
  supabase
    .channel('servers-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'servers' },
      payload => {
        if (payload.eventType === 'INSERT' && payload.new?.approved) {
          allServers.unshift(payload.new);
          renderServers();
          showToast('سيرفر جديد تمت إضافته!', 'info');
        }
        if (payload.eventType === 'DELETE') {
          allServers = allServers.filter(s => s.id !== payload.old.id);
          renderServers();
        }
        if (payload.eventType === 'UPDATE') {
          allServers = allServers.map(s =>
            s.id === payload.new.id ? payload.new : s
          );
          renderServers();
        }
      }
    )
    .subscribe();
}

/* ══════════════════════════════════════════
   🔐 Auth — Discord OAuth
══════════════════════════════════════════ */
async function handleLogin() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: window.location.origin + '/index.html',
      scopes: 'identify guilds',
    }
  });
  if (error) showToast('فشل تسجيل الدخول', 'error');
}

async function handleLogout() {
  await supabase.auth.signOut();
  currentUser = null;
  updateNavUI(null);
  showToast('تم تسجيل الخروج', 'info');
  renderServers();
}

/* ══════════════════════════════════════════
   🧭 تحديث الـ Navbar بحسب حالة المستخدم
══════════════════════════════════════════ */
function updateNavUI(user) {
  // Desktop
  const loginBtn    = document.getElementById('login-btn');
  const addBtn      = document.getElementById('add-server-btn');
  const userBlock   = document.getElementById('user-block');

  // Mobile
  const loginBtnM   = document.getElementById('login-btn-m');
  const addBtnM     = document.getElementById('add-btn-m');
  const userBlockM  = document.getElementById('user-block-m');

  if (user) {
    const avatarUrl = user.user_metadata?.avatar_url || '';
    const username  = user.user_metadata?.full_name
                   || user.user_metadata?.name
                   || 'مستخدم';

    const avatarHTML = avatarUrl
      ? `<img src="${escHtml(avatarUrl)}" class="avatar" alt="${escHtml(username)}">`
      : `<div class="avatar-placeholder">${escHtml(username[0]?.toUpperCase())}</div>`;

    const blockHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        ${avatarHTML}
        <span style="font-size:14px;font-weight:600;">${escHtml(username)}</span>
        <button class="nav-btn nav-btn-ghost" style="padding:6px 12px;font-size:13px;"
                onclick="window.handleLogout()">خروج</button>
      </div>`;

    if (userBlock)  { userBlock.innerHTML  = blockHTML; userBlock.classList.remove('hidden'); }
    if (userBlockM) { userBlockM.innerHTML = avatarHTML; userBlockM.classList.remove('hidden'); }
    if (loginBtn)   loginBtn.classList.add('hidden');
    if (loginBtnM)  loginBtnM.classList.add('hidden');
    if (addBtn)     addBtn.classList.remove('hidden');
    if (addBtnM)    addBtnM.classList.remove('hidden');
  } else {
    if (userBlock)  { userBlock.innerHTML = ''; userBlock.classList.add('hidden'); }
    if (userBlockM) { userBlockM.innerHTML = ''; userBlockM.classList.add('hidden'); }
    if (loginBtn)   loginBtn.classList.remove('hidden');
    if (loginBtnM)  { loginBtnM.classList.remove('hidden'); loginBtnM.style.display = 'flex'; }
    if (addBtn)     addBtn.classList.add('hidden');
    if (addBtnM)    addBtnM.classList.add('hidden');
  }
}

/* ══════════════════════════════════════════
   🗑️ Modal الحذف
══════════════════════════════════════════ */
function openDeleteModal(serverId) {
  pendingDeleteId = serverId;
  document.getElementById('modal-overlay')?.classList.remove('hidden');
  document.getElementById('delete-modal')?.classList.remove('hidden');
}

function closeModal() {
  pendingDeleteId = null;
  document.getElementById('modal-overlay')?.classList.add('hidden');
  document.getElementById('delete-modal')?.classList.add('hidden');
}

async function confirmDelete() {
  if (!pendingDeleteId) return;

  const { error } = await supabase
    .from('servers')
    .delete()
    .eq('id', pendingDeleteId)
    .eq('owner_id', currentUser?.id); // أمان إضافي

  closeModal();

  if (error) {
    showToast('فشل الحذف — تحقق من صلاحياتك', 'error');
    console.error(error);
  } else {
    showToast('تم حذف السيرفر بنجاح', 'success');
    // Realtime سيحدّث الـ Grid تلقائياً
  }
}

/* ══════════════════════════════════════════
   🔍 Filter Tabs + Search
══════════════════════════════════════════ */
function initFilters() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat || 'all';
      renderServers();
    });
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderServers();
    });
  }
}

/* ══════════════════════════════════════════
   🍞 Toast Notifications
══════════════════════════════════════════ */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ══════════════════════════════════════════
   🚀 تهيئة التطبيق
══════════════════════════════════════════ */
async function init() {
  // جلب جلسة المستخدم الحالية
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    updateNavUI(currentUser);
  }

  // مراقبة تغييرات الـ Auth
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateNavUI(currentUser);
    renderServers(); // إعادة رسم الكروت لإظهار/إخفاء زر الحذف
  });

  initFilters();
  await fetchServers();
  subscribeRealtime();
}

/* ══════════════════════════════════════════
   ✅ تصدير الدوال للـ window
   (ضروري لأن type="module" يعزل الـ scope)
══════════════════════════════════════════ */
window.handleLogin     = handleLogin;
window.handleLogout    = handleLogout;
window.openDeleteModal = openDeleteModal;
window.closeModal      = closeModal;
window.confirmDelete   = confirmDelete;
window.buildLetterAvatar = buildLetterAvatar; // تستخدمها الـ onerror في الكروت

// تشغيل التطبيق
init();
