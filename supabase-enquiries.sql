-- Rutas Antiguas — enquiries and booking requests.
-- Run this in the SQL Editor of the SAME project as supabase-setup.sql.

-- Every submission lands here: a plain question from the Contact page, and a
-- booking request from a built itinerary. The itinerary column is null for a
-- question and holds the full plan for a booking.
create table if not exists public.enquiries (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind       text        not null default 'question',
  name       text        not null,
  phone      text        not null,
  email      text        not null,
  message    text        not null,
  itinerary  jsonb,
  handoff    text,
  status     text        not null default 'new',

  constraint enquiries_kind    check (kind in ('question', 'booking')),
  constraint enquiries_status  check (status in ('new', 'contacted', 'confirmed', 'closed')),

  -- Length caps. The insert policy below is open to the public by necessity —
  -- a guest has no account — so bound what a single row can carry.
  constraint enquiries_name    check (char_length(name)    between 1 and 120),
  constraint enquiries_phone   check (char_length(phone)   between 1 and 40),
  constraint enquiries_email   check (char_length(email)   between 3 and 200),
  constraint enquiries_message check (char_length(message) between 1 and 4000)
);

create index if not exists enquiries_created_idx on public.enquiries (created_at desc);

alter table public.enquiries enable row level security;

-- ── Who can do what ─────────────────────────────────────────────────────────
-- Anyone may submit. This is the one place the public writes to your database.
drop policy if exists "anyone may submit an enquiry" on public.enquiries;
create policy "anyone may submit an enquiry"
  on public.enquiries for insert
  to anon, authenticated
  with check (true);

-- Only you can read them. Without this, the anon key would let anyone list
-- every guest's name, phone and email — so do not add a public select policy.
drop policy if exists "only operators may read enquiries" on public.enquiries;
create policy "only operators may read enquiries"
  on public.enquiries for select
  to authenticated
  using (true);

-- Only you can mark one contacted or closed.
drop policy if exists "only operators may update enquiries" on public.enquiries;
create policy "only operators may update enquiries"
  on public.enquiries for update
  to authenticated
  using (true)
  with check (true);

-- ── Reading your enquiries ──────────────────────────────────────────────────
-- Table Editor → enquiries, or:
--   select created_at, kind, name, phone, email, message from public.enquiries
--   where status = 'new' order by created_at desc;
--
-- A note on spam: a public insert policy means a determined bot could post
-- junk rows. The length caps above bound the damage, and you can clear junk
-- with `delete from public.enquiries where status = 'new' and ...`. If it ever
-- becomes a real problem, the fix is a captcha or an edge function, not a
-- tighter policy — the form has to stay open to guests.
