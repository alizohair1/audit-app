# Internal Audit App

Three roles, each with a Dashboard, a work page, and a separate Reports page:

- **Branch** — Dashboard (today's status, electricity usage table + consumption trend, 14-day diesel/genset trends), Daily Entry (Electricity/Diesel/Genset), Reports (same visuals for a chosen date range + history + Excel export).
- **Auditor** — Dashboard (completion + score insights), Jobs (branch/date picker, all 7 jobs — score or HH:MM:SS for SOS — + report link), Reports (branch + date-range Excel export, own submissions only).
- **Admin** — Dashboard (avg score by job, submissions trend, branch completion today, electricity consumption by branch), Users, Jobs & Std Scores (editable), Assignments (multi-select branches per auditor, with select-all), Reports (job scores by branch — grouped bar chart — with branch + date-range filters, Excel export).

Electricity **units consumed** = latest meter reading − previous reading, computed per meter and summed per branch/day.

Stack: Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, RLS) + Excel export via `exceljs` + charts via `recharts`. Deploys to Vercel, code on GitHub.

---

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard and create a new project.
2. In **Project Settings > API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret — never put it in the browser)
3. In the Supabase Dashboard, open **SQL Editor**, paste the entire contents of `supabase/schema.sql` from this project, and run it. This creates every table, RLS policy, and seeds your 7 branches, meters, and 7 job types.

---

## 2. Local setup (Windows / PowerShell)

Open PowerShell in the folder where you want the project, then:

```powershell
cd C:\Projects
# unzip the project here first, so you have C:\Projects\audit-app
cd C:\Projects\audit-app

# install dependencies
npm install

# create your local env file
Copy-Item .env.example .env.local
notepad .env.local
```

In the `notepad` window, paste in your three Supabase values from step 1, save, and close.

```powershell
cd C:\Projects\audit-app
npm run dev
```

Open http://localhost:3000 — you'll land on the login page.

---

## 3. Create your first admin user

You need at least one admin to log in and create everyone else. Easiest way — in the Supabase Dashboard:

1. Go to **Authentication > Users > Add user**, create yourself with an email + password, tick "Auto Confirm User".
2. Go to **Table Editor > profiles**, find the row that was auto-created for you (the trigger creates it), and edit the `role` column to `admin`.
3. Log in at http://localhost:3000/login with that email/password — you'll land on `/admin`.

From here on, use the **Users** page inside the app to create auditors and branch staff — it handles everything (auth account + role + branch) for you.

---

## 4. Push to GitHub

```powershell
cd C:\Projects\audit-app
git init
git add .
git commit -m "Initial commit: audit app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/audit-app.git
git push -u origin main
```

---

## 5. Deploy to Vercel

1. Go to https://vercel.com/new and import the GitHub repo you just pushed.
2. In the Vercel project's **Settings > Environment Variables**, add the same three variables from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Click **Deploy**.

Vercel will give you a live URL — the app works the same as local, just reachable from anywhere.

---

## Project structure

```
audit-app/
  supabase/schema.sql            — full DB schema, RLS policies, seed data
  src/
    middleware.ts                 — session refresh + role-based route guarding
    lib/
      nav.ts                       — tab nav items per role (ADMIN_NAV, AUDITOR_NAV, BRANCH_NAV)
      scoring.ts                   — % and SOS band calculations (shared)
      consumption.ts               — electricity units-consumed calculations (shared)
      supabase/
        client.ts                  — browser Supabase client
        server.ts                  — server component / route handler client
        admin.ts                   — service-role client (admin API routes only)
        guards.ts                  — getMyProfile() / requireAdmin() helpers
    types/database.types.ts        — TypeScript types matching the schema
    app/
      login/                      — login page
      auditor/
        page.tsx                   — dashboard (insight charts)
        jobs/                      — branch/date picker + all 7 jobs
        reports/                   — branch + date-range Excel export (own data)
      branch/
        page.tsx                   — dashboard (today's status + trend charts)
        entry/                     — Electricity/Diesel/Genset entry form
        reports/                   — history + date-range Excel export
      admin/
        page.tsx                   — dashboard (charts)
        users/                     — create/edit/remove users
        jobs/                      — edit std scores
        assignments/               — multi-select branch assignment per auditor
        reports/                   — all branches, date range
      api/
        reports/                  — auditor/admin Excel export (RLS scopes admin=all, auditor=own)
        reports/branch/           — branch Excel export (own branch only)
        admin/users/              — create/list/edit/delete users (service role)
        admin/jobs/               — edit job std scores
        admin/assignments/        — bulk-assign auditor↔branches (select-all support)
    components/
      Navbar.tsx, SubNav.tsx       — shared header + tab nav
      AuditorJobBoard.tsx          — the 7-job entry board
      BranchEntryForm.tsx          — daily entry form
      BranchTrendCharts.tsx        — diesel/genset trend charts (dashboard + reports)
      ElectricityUsageCard.tsx     — per-meter reading table + consumption trend
      admin/AdminDashboardCharts.tsx — shared chart components (job avg, completion, consumption)
      admin/JobsByBranchChart.tsx  — grouped bar chart for admin Reports (job scores by branch)
```

## Notes on the data model

- **Branches** seeded: Johar Town, Bahria Town, DHA Phase 4, DHA Phase 6, Emporium, Gulberg, Valencia.
- **Electricity meters** seeded for Johar Town, Bahria Town, DHA Phase 6, and DHA Phase 4 — add meters for Emporium/Gulberg/Valencia directly in the Supabase Table Editor (`branch_meters` table) when you have their numbers.
- **Job types** seeded with std scores: Roster Management (52), Restaurant Operations (76), Training & Development (65), Facilities Management (355), Compliance Audit (248), Hygiene (152), SOS (time-based, no std score — uses fixed bands: ≤5min 100% Green, 5–7min 75% Blue, 7–9min 50% Orange, 9–10min 25% Grey, >10min 0% Red).
- Admin can edit any job's std score from **Admin > Jobs & Std Scores**.
- Assigning an auditor to branches (**Admin > Assignments**) fully replaces their assigned set each time you save — check/uncheck branches (or use "Select all") and save.
- One audit submission per branch + job + date (re-submitting updates the existing row).
