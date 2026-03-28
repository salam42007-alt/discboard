// ============================================================
//  script.js — عرض السيرفرات + Real-time
// ============================================================

import { supabase }           from './supabase.js';
import { getCurrentUser, loginWithDiscord } from './auth.js';

let allServers = [];
let activeCategory = 'all';

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  updateAuthUI();
  await loadServers();
  subscribeRealtime();
  setupFilters();
  setupSearch();
});

// ── Auth UI ──
async function updateAuthUI() {
  const user = await getCurrentUser();
  const loginBtn  = document.getElementById('login-btn');
  const addBtn    = document.getElementById('add-server-btn');
  const userBlock = document.getElementById('user-block');

  if (user) {
    loginBtn?.classList.add('hidden');
    addBtn?.classList.remove('hidden');
    if (userBlock) {
      const meta = user.user_metadata;
      const name   = meta?.full_name || meta?.name || 'مستخدم';
      const avatar = meta?.avatar_url || meta?.picture || null;
      userBlock.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          ${avatar
            ? `<img src="${avatar}" class="avatar" alt="${name}"/>`
            : `<div class="avatar-placeholder">${name[0].toUpperCase()}</div>`
          }
          <span style="font-size:14px;font-weight:600">${name}</span>
        </div>`;
      userBlock.classList.remove('hidden');
    }
  } else {
    loginBtn?.classList.remove('hidden');
    addBtn?.classList.add('hidden');
    userBlock?.classList.add('hidden');
  }
}

// ── Load Servers ──
async function loadServers() {
  showSkeletons();

  const { data, error } = await supabase
    .from('servers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showEmpty('⚠️ خطأ في تحميل السيرفرات. تأكد من إعدادات Supabase.');
    return;
  }

  allServers = data || [];
  renderServers(allServers);
  updateCount(allServers.length);
}

// ── Render ──
function renderServers(servers) {
  const grid = document.getElementById('servers-grid');
  if (!grid) return;

  if (!servers.length) {
    showEmpty('لا توجد سيرفرات في هذا التصنيف بعد.');
    return;
  }

  grid.innerHTML = servers.map(s => serverCardHTML(s)).join('');
}

// ── Avatar: لون عشوائي ثابت بناءً على اسم السيرفر ──
function serverAvatarHTML(name, imageUrl) {
  if (imageUrl) {
    return `<img src="${escHtml(imageUrl)}" alt="${escHtml(name)}"
              onerror="this.replaceWith(buildLetterAvatar('${escHtml(name)}'))"/>`;
  }
  return buildLetterAvatarHTML(name);
}

function buildLetterAvatarHTML(name) {
  const colors = [
    ['#00d2ff','#003a4d'], ['#3a7bd5','#0a1a3a'], ['#7b5ea7','#1a0e2e'],
    ['#00e676','#003318'], ['#ff6b6b','#3a0a0a'], ['#ffab40','#3a2200'],
    ['#26c6da','#003a40'], ['#ec407a','#3a0020'],
  ];
  // نفس اللون دايماً لنفس الاسم
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const [fg, bg] = colors[Math.abs(hash) % colors.length];
  const letter = name.charAt(0).toUpperCase();
  return `<span style="
    display:flex;align-items:center;justify-content:center;
    width:100%;height:100%;
    background:${bg};color:${fg};
    font-size:20px;font-weight:900;font-family:'Cairo',sans-serif;
    border-radius:inherit;
  ">${letter}</span>`;
}

// نسخة تُرجع DOM node (للـ onerror)
window.buildLetterAvatar = function(name) {
  const span = document.createElement('span');
  span.innerHTML = buildLetterAvatarHTML(name);
  return span.firstElementChild;
};

function serverCardHTML(s) {
  const catClass = {
    'Gaming':   'cat-gaming',
    'Anime':    'cat-anime',
    'Dev':      'cat-dev',
    'Medieval': 'cat-medieval',
  }[s.category] || 'cat-other';

  const icon = serverAvatarHTML(s.server_name, s.image_url);

  const members = s.member_count
    ? `<span class="members-dot"></span>${s.member_count.toLocaleString('ar')} عضو`
    : `<span class="members-dot"></span>— عضو`;

  return `
  <div class="server-card" data-id="${s.id}">
    <div class="card-banner">
      <div class="card-icon">${icon}</div>
    </div>
    <div class="card-body">
      <div class="card-top">
        <div class="card-name">${escHtml(s.server_name)}</div>
        <div class="card-category ${catClass}">${escHtml(s.category || 'Other')}</div>
      </div>
      <div class="card-desc">${escHtml(s.description || 'لا يوجد وصف')}</div>
      <div class="card-footer">
        <div class="card-members">${members}</div>
        <a href="${escHtml(s.invite_link)}" target="_blank" rel="noopener" class="card-join">
          انضم ←
        </a>
      </div>
    </div>
  </div>`;
}

// ── Filters ──
function setupFilters() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeCategory = tab.dataset.cat;
      applyFilters();
    });
  });
}

function setupSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', applyFilters);
}

function applyFilters() {
  const q = document.getElementById('search-input')?.value.toLowerCase() || '';
  let filtered = allServers;

  if (activeCategory !== 'all')
    filtered = filtered.filter(s => s.category === activeCategory);

  if (q)
    filtered = filtered.filter(s =>
      s.server_name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );

  renderServers(filtered);
  updateCount(filtered.length);
}

// ── Real-time ──
function subscribeRealtime() {
  supabase
    .channel('servers-public')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'servers' }, payload => {
      allServers.unshift(payload.new);
      applyFilters();
      showToast('سيرفر جديد أُضيف! 🎉', 'success');
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'servers' }, payload => {
      allServers = allServers.filter(s => s.id !== payload.old.id);
      applyFilters();
    })
    .subscribe();
}

// ── UI helpers ──
function showSkeletons(n = 6) {
  const grid = document.getElementById('servers-grid');
  if (!grid) return;
  grid.innerHTML = Array(n).fill(0).map(() => `
    <div class="skeleton">
      <div class="skeleton-banner"></div>
      <div class="skeleton-body">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
      </div>
    </div>`).join('');
}

function showEmpty(msg) {
  const grid = document.getElementById('servers-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🌐</div>
      <div class="empty-title">${msg}</div>
      <div class="empty-sub">كن أول من يضيف سيرفره!</div>
    </div>`;
}

function updateCount(n) {
  const el = document.getElementById('server-count');
  if (el) el.textContent = n;
}

// ── Toast ──
window.showToast = function(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
};

// ── Login button ──
window.handleLogin = function() {
  loginWithDiscord();
};

function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
