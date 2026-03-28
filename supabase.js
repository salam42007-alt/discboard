// ============================================================
//  supabase.js — اربط هنا مع Supabase
//  1. روح https://supabase.com وسوي مشروع جديد
//  2. Settings > API  ←  انسخ Project URL و anon key
//  3. في Supabase Dashboard > Authentication > Providers فعّل Discord
//     وحط Client ID و Client Secret من https://discord.com/developers/applications
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL  = 'https://XXXXXXXXXXXXXXXX.supabase.co'; // ← غيّر
export const SUPABASE_ANON = 'YOUR_ANON_KEY_HERE';                   // ← غيّر

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
//  SQL — شغّله مرة واحدة في Supabase > SQL Editor
// ============================================================
/*
-- ============================================================
--  SQL — شغّله مرة واحدة في Supabase > SQL Editor
-- ============================================================
/*
-- جدول السيرفرات
create table servers (
  id           bigint generated always as identity primary key,
  server_name  text    not null,
  invite_link  text    not null,
  description  text,
  category     text    default 'Other',
  owner_id     uuid    references auth.users(id) on delete cascade,
  image_url    text,
  member_count int     default 0,
  created_at   timestamptz default now()
);

-- Row Level Security
alter table servers enable row level security;

-- القراءة: الكل
create policy "anyone can read servers"
  on servers for select using (true);

-- الإضافة: المستخدمون المسجلون فقط
create policy "owner can insert"
  on servers for insert
  with check (auth.uid() = owner_id);

-- ⚠️ التعديل: صاحب السيرفر أو الأدمن
-- غيّر 'YOUR-ADMIN-UUID-HERE' لـ UUID حسابك في Supabase > Authentication > Users
create policy "owner or admin can update"
  on servers for update
  using (
    auth.uid() = owner_id
    OR auth.uid() = 'YOUR-ADMIN-UUID-HERE'::uuid
  );

-- ⚠️ الحذف: صاحب السيرفر أو الأدمن
create policy "owner or admin can delete"
  on servers for delete
  using (
    auth.uid() = owner_id
    OR auth.uid() = 'YOUR-ADMIN-UUID-HERE'::uuid
  );

-- Storage bucket للصور (اختياري)
insert into storage.buckets (id, name, public) values ('server-icons', 'server-icons', true);
*/
