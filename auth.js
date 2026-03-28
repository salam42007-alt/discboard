// ============================================================
//  auth.js — Discord OAuth2 + Supabase Auth
//  تأكد إنك حطيت القيم الصحيحة في supabase.js أولاً
// ============================================================

import { supabase } from './supabase.js';

// تسجيل الدخول بالديسكورد
export async function loginWithDiscord() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      // ✅ التعديل هنا: نضع الرابط الكامل والمباشر لصفحة الداشبورد
      redirectTo: 'https://salam42007-alt.github.io/discboard/dashboard.html',
      scopes: 'identify guilds',
    }
  });
  if (error) console.error('Discord login error:', error.message);
}

// تسجيل الخروج
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// الحصول على المستخدم الحالي
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// الحصول على صورة البروفايل واسم المستخدم من Discord
export function getDiscordProfile(user) {
  if (!user) return null;
  const meta = user.user_metadata;
  return {
    id:       user.id,
    name:     meta?.full_name || meta?.name || 'مجهول',
    avatar:   meta?.avatar_url || meta?.picture || null,
    discord_id: meta?.provider_id || null,
  };
}

// حماية الصفحات — استخدمها في dashboard.html
export async function requireAuth(redirectTo = 'index.html') {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

// استمع لتغييرات الجلسة
export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}
