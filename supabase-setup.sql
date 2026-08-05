-- Rutas Antiguas — one-time Supabase setup.
-- Run this in your project's SQL Editor, then press Run.
--
-- This project must be Rutas Antiguas' own. Do not run it in the Bioharmony
-- Babes project — they share no data, no keys and no schema.

-- ── The menu ────────────────────────────────────────────────────────────────
-- One row holds the whole menu as JSON: { settings, tours }. That is exactly
-- what the app's Export produces, so a tours.json file and this row are
-- interchangeable — you can seed one from the other at any time.
create table if not exists public.menu (
  id         int primary key default 1,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  constraint menu_single_row check (id = 1)
);

alter table public.menu enable row level security;

-- ── Who can do what ─────────────────────────────────────────────────────────
-- Guests are anonymous and must be able to read the menu.
drop policy if exists "menu is publicly readable" on public.menu;
create policy "menu is publicly readable"
  on public.menu for select
  to anon, authenticated
  using (true);

-- Only a signed-in operator may change it. Anonymous visitors get no write
-- path at all, which is what makes publishing the anon key safe.
drop policy if exists "operators can create the menu" on public.menu;
create policy "operators can create the menu"
  on public.menu for insert
  to authenticated
  with check (true);

drop policy if exists "operators can update the menu" on public.menu;
create policy "operators can update the menu"
  on public.menu for update
  to authenticated
  using (true)
  with check (true);

-- ── Seed an empty menu ──────────────────────────────────────────────────────
-- Gives the app a row to read before you have published anything. Your first
-- save from the phone overwrites it.
insert into public.menu (id, data)
values (1, '{"settings":{},"tours":[]}'::jsonb)
on conflict (id) do nothing;

-- ── After running this ──────────────────────────────────────────────────────
-- 1. Authentication → Users → Add user → create your operator account with a
--    real email and password, and tick "Auto Confirm User".
-- 2. Authentication → Sign In / Providers → turn OFF "Allow new users to sign
--    up". Nobody should be able to self-register into write access.
-- 3. Paste your Project URL and anon/publishable key into assets/config.js.
