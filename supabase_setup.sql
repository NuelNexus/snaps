-- Supabase setup for the snaps phishing-awareness demo
-- Project: txusshocoamqmxsbbrdm
--
-- Run this once in the Supabase SQL editor for the project. The local Flask
-- server (app.py) and the Netlify /api/capture function both mirror captures
-- here. The instructor opted into storing the real password so the deployed
-- /password dashboard shows the full demo data; that dashboard is protected
-- by HTTP Basic Auth (DEMO_INSTRUCTOR_PASS).

-- 1) The captures table
-- NOTE: usernames AND passwords are stored in plaintext — that is the point
-- of the "attacker's dashboard". The RLS policy below is what keeps the rows
-- readable only by the owner / the service-role key used by /password.
-- (password_masked is kept for legacy rows; new rows carry the real value in
-- `password`.)
create table if not exists public.captures (
  id bigint generated always as identity primary key,
  username text not null,
  password_masked text not null,   -- legacy: always "********"
  password text,                   -- the captured password (instructor opted in)
  created_at text,
  ip text,
  inserted_at timestamptz default now()
);

-- Existing projects (table already created before the password column):
--   alter table public.captures add column if not exists password text;

-- 2) Row Level Security: the public (anon) key may only INSERT — it can never
--    read, update or delete. Only you (via the Supabase dashboard / service
--    role) can view the rows. Without this, anyone who extracts the key from
--    the page could read the class's submissions.
alter table public.captures enable row level security;

create policy "anon can insert captures"
  on public.captures
  for insert
  to anon
  with check (true);

create policy "no public reads"
  on public.captures
  for select
  to anon
  using (false);

-- 3) IMPORTANT for API inserts: use `Prefer: return=minimal` when POSTing
--    rows (app.py already does). With `return=representation` PostgREST runs
--    a RETURNING on the insert, which the "no public reads" policy filters
--    out — the API then reports a confusing "new row violates row-level
--    security policy" 401 even though the insert itself is allowed.

-- 4) Verify: as the anon role you should be able to INSERT but SELECT (and
--    UPDATE/DELETE) should return/affect zero rows. e.g. open the Table
--    Editor — you (owner) see rows; anyone using the publishable key cannot.
--    The publishable key can only ever INSERT; it cannot read, change or
--    delete anything.
