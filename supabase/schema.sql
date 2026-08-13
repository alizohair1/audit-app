-- =====================================================================
-- Internal Audit App — full schema
-- Run this once in Supabase Dashboard > SQL Editor (or via CLI migration)
-- =====================================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------- BRANCHES ----------
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique, -- short code e.g. JT, BT, P6, P4, EMP, GUL, VAL
  created_at timestamptz not null default now()
);

-- ---------- PROFILES (extends auth.users with role + branch) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('admin', 'auditor', 'branch')),
  branch_id uuid references public.branches(id), -- only set for role = 'branch'
  created_at timestamptz not null default now()
);

-- Auto-create a placeholder profile row whenever a new auth user is created.
-- Admin sets the real role/branch right after via the admin API.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'branch'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- BRANCH METERS (electricity) ----------
create table if not exists public.branch_meters (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  meter_number text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (branch_id, meter_number)
);

-- ---------- JOB TYPES (the 7 audit jobs) ----------
create table if not exists public.job_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  scoring_type text not null check (scoring_type in ('score', 'time')),
  std_score numeric, -- null for time-based jobs (e.g. SOS)
  report_ref text, -- e.g. "1.1 Roster Management"
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- AUDITOR <-> BRANCH ASSIGNMENTS ----------
create table if not exists public.auditor_branch_assignments (
  id uuid primary key default gen_random_uuid(),
  auditor_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (auditor_id, branch_id)
);

-- ---------- AUDIT SUBMISSIONS (the 7 jobs, one row per branch/date/job) ----------
create table if not exists public.audit_submissions (
  id uuid primary key default gen_random_uuid(),
  auditor_id uuid not null references public.profiles(id),
  branch_id uuid not null references public.branches(id),
  job_type_id uuid not null references public.job_types(id),
  date date not null,
  obtained_score numeric,       -- for scoring_type = 'score'
  time_taken_seconds int,       -- for scoring_type = 'time' (SOS), stored from HH:MM:SS
  percentage numeric,           -- auto-calculated, stored for fast reporting
  band text,                    -- Green/Blue/Orange/Grey/Red — SOS only
  report_link text,             -- pasted URL
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, job_type_id, date)
);

-- ---------- BRANCH DAILY ENTRIES ----------
create table if not exists public.electricity_readings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  meter_id uuid not null references public.branch_meters(id),
  date date not null,
  reading numeric not null,
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  unique (meter_id, date)
);

create table if not exists public.diesel_purchases (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  date date not null,
  amount numeric,
  litres numeric,
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now()
);

create table if not exists public.genset_readings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  date date not null,
  dip_stick_measure numeric,
  fuel_tank_fill_pct numeric,
  external_tank numeric,
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now()
);

-- =====================================================================
-- HELPER FUNCTIONS (used inside RLS policies)
-- =====================================================================
create or replace function public.my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_branch_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select branch_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_assigned_to_branch(target_branch uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.auditor_branch_assignments
    where auditor_id = auth.uid() and branch_id = target_branch
  );
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.branch_meters enable row level security;
alter table public.job_types enable row level security;
alter table public.auditor_branch_assignments enable row level security;
alter table public.audit_submissions enable row level security;
alter table public.electricity_readings enable row level security;
alter table public.diesel_purchases enable row level security;
alter table public.genset_readings enable row level security;

-- branches: everyone logged in can read; only admin can write
create policy "branches_select_all" on public.branches for select using (auth.role() = 'authenticated');
create policy "branches_admin_write" on public.branches for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- profiles: user can read/update own row; admin can read/update/insert/delete all
create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.my_role() = 'admin');
create policy "profiles_update_own_or_admin" on public.profiles for update using (id = auth.uid() or public.my_role() = 'admin');
create policy "profiles_admin_insert" on public.profiles for insert with check (public.my_role() = 'admin');
create policy "profiles_admin_delete" on public.profiles for delete using (public.my_role() = 'admin');

-- branch_meters: everyone logged in can read; admin writes
create policy "meters_select_all" on public.branch_meters for select using (auth.role() = 'authenticated');
create policy "meters_admin_write" on public.branch_meters for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- job_types: everyone logged in can read; admin can edit (incl. std_score)
create policy "jobtypes_select_all" on public.job_types for select using (auth.role() = 'authenticated');
create policy "jobtypes_admin_write" on public.job_types for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- auditor_branch_assignments: admin full access; auditor can read own assignments
create policy "assignments_admin_all" on public.auditor_branch_assignments for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "assignments_auditor_select_own" on public.auditor_branch_assignments for select using (auditor_id = auth.uid());

-- audit_submissions: admin full access; auditor can insert/select/update own submissions for assigned branches
create policy "submissions_admin_all" on public.audit_submissions for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "submissions_auditor_select" on public.audit_submissions for select using (auditor_id = auth.uid());
create policy "submissions_auditor_insert" on public.audit_submissions for insert with check (
  auditor_id = auth.uid() and public.my_role() = 'auditor' and public.is_assigned_to_branch(branch_id)
);
create policy "submissions_auditor_update" on public.audit_submissions for update using (
  auditor_id = auth.uid() and public.my_role() = 'auditor'
);

-- electricity_readings: admin full access; branch user reads/writes own branch only
create policy "elec_admin_all" on public.electricity_readings for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "elec_branch_select" on public.electricity_readings for select using (branch_id = public.my_branch_id());
create policy "elec_branch_insert" on public.electricity_readings for insert with check (
  branch_id = public.my_branch_id() and submitted_by = auth.uid() and public.my_role() = 'branch'
);
-- auditors can view readings for branches they're assigned to (for reference during audits)
create policy "elec_auditor_select" on public.electricity_readings for select using (public.is_assigned_to_branch(branch_id));

create policy "diesel_admin_all" on public.diesel_purchases for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "diesel_branch_select" on public.diesel_purchases for select using (branch_id = public.my_branch_id());
create policy "diesel_branch_insert" on public.diesel_purchases for insert with check (
  branch_id = public.my_branch_id() and submitted_by = auth.uid() and public.my_role() = 'branch'
);
create policy "diesel_auditor_select" on public.diesel_purchases for select using (public.is_assigned_to_branch(branch_id));

create policy "genset_admin_all" on public.genset_readings for all using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy "genset_branch_select" on public.genset_readings for select using (branch_id = public.my_branch_id());
create policy "genset_branch_insert" on public.genset_readings for insert with check (
  branch_id = public.my_branch_id() and submitted_by = auth.uid() and public.my_role() = 'branch'
);
create policy "genset_auditor_select" on public.genset_readings for select using (public.is_assigned_to_branch(branch_id));

-- =====================================================================
-- SEED DATA
-- =====================================================================

insert into public.branches (name, code) values
  ('Johar Town', 'JT'),
  ('Bahria Town', 'BT'),
  ('DHA Phase 4', 'P4'),
  ('DHA Phase 6', 'P6'),
  ('Emporium', 'EMP'),
  ('Gulberg', 'GUL'),
  ('Valencia', 'VAL')
on conflict (name) do nothing;

insert into public.branch_meters (branch_id, meter_number)
select b.id, m.meter_number from (values
  ('JT', '167612'),
  ('JT', '357257'),
  ('BT', '100000001291'),
  ('BT', '100000016814'),
  ('BT', '100000016815'),
  ('BT', '100000016816'),
  ('P6', '111318'),
  ('P6', '111380'),
  ('P4', '2999015761')
) as m(code, meter_number)
join public.branches b on b.code = m.code
on conflict (branch_id, meter_number) do nothing;

insert into public.job_types (name, scoring_type, std_score, report_ref, sort_order) values
  ('Roster Management', 'score', 52, '1.1 Roster Management', 1),
  ('Restaurant Operations', 'score', 76, '1.2 Restaurant Operations', 2),
  ('Training & Development', 'score', 65, '1.3 Training & Development', 3),
  ('Facilities Management', 'score', 355, '2. Facilities Management', 4),
  ('Compliance Audit', 'score', 248, '3. Compliance Audit', 5),
  ('Hygiene', 'score', 152, 'Hygiene', 6),
  ('SOS', 'time', null, 'SOS', 7)
on conflict (name) do nothing;
