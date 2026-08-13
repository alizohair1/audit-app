import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/supabase/guards";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { AUDITOR_NAV } from "@/lib/nav";
import { JobAverageChart, SubmissionsTrendChart, BranchCompletionList } from "@/components/admin/AdminDashboardCharts";
import ScoreTrendChart from "@/components/admin/ScoreTrendChart";
import { todayStr, daysAgoStr } from "@/lib/dates";

export default async function AuditorDashboardPage() {
  const profile = await getMyProfile();
  if (!profile || profile.role !== "auditor") redirect("/login");

  const supabase = createClient();

  const { data: assignments } = await supabase
    .from("auditor_branch_assignments")
    .select("branch:branches(id, name)")
    .eq("auditor_id", profile.id);
  const branches = (assignments ?? []).map((a: any) => a.branch).filter(Boolean);

  const { data: jobTypes } = await supabase.from("job_types").select("id, name, sort_order").order("sort_order");
  const totalJobs = (jobTypes ?? []).length;

  const since30 = daysAgoStr(30);
  const today = todayStr();

  // RLS already scopes this to the logged-in auditor's own rows.
  const { data: recentSubs } = await supabase
    .from("audit_submissions")
    .select("date, percentage, job_type_id, branch_id")
    .gte("date", since30);

  const jobAvgMap = new Map<string, { sum: number; count: number }>();
  (recentSubs ?? []).forEach((s: any) => {
    const entry = jobAvgMap.get(s.job_type_id) ?? { sum: 0, count: 0 };
    entry.sum += s.percentage ?? 0;
    entry.count += 1;
    jobAvgMap.set(s.job_type_id, entry);
  });
  const jobAvgData = (jobTypes ?? []).map((jt: any) => {
    const entry = jobAvgMap.get(jt.id);
    return { name: jt.name, avgPct: entry ? Math.round((entry.sum / entry.count) * 10) / 10 : 0 };
  });

  const dayCounts = new Map<string, number>();
  for (let i = 13; i >= 0; i--) dayCounts.set(daysAgoStr(i), 0);
  (recentSubs ?? []).forEach((s: any) => {
    if (dayCounts.has(s.date)) dayCounts.set(s.date, (dayCounts.get(s.date) ?? 0) + 1);
  });
  const trendData = Array.from(dayCounts.entries()).map(([date, count]) => ({ date: date.slice(5), count }));

  // --- Score trend by branch (14 days) — average % per day, one line per assigned branch ---
  const branchNameById = new Map(branches.map((b: any) => [b.id, b.name]));
  const scoreByDayBranch = new Map<string, { sum: number; count: number }>();
  (recentSubs ?? []).forEach((s: any) => {
    const branchName = branchNameById.get(s.branch_id);
    if (!branchName) return;
    const key = `${s.date}__${branchName}`;
    const entry = scoreByDayBranch.get(key) ?? { sum: 0, count: 0 };
    entry.sum += s.percentage ?? 0;
    entry.count += 1;
    scoreByDayBranch.set(key, entry);
  });
  const scoreTrendBranchNames = Array.from(new Set(branches.map((b: any) => b.name))).sort();
  const scoreTrendData: Record<string, string | number>[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = daysAgoStr(i);
    const row: Record<string, string | number> = { date: d.slice(5) };
    scoreTrendBranchNames.forEach((name) => {
      const entry = scoreByDayBranch.get(`${d}__${name}`);
      if (entry) row[name] = Math.round((entry.sum / entry.count) * 10) / 10;
    });
    scoreTrendData.push(row);
  }

  const { data: todaySubs } = await supabase
    .from("audit_submissions")
    .select("branch_id, job_type_id")
    .eq("date", today);
  const doneByBranch = new Map<string, Set<string>>();
  (todaySubs ?? []).forEach((s: any) => {
    const set = doneByBranch.get(s.branch_id) ?? new Set();
    set.add(s.job_type_id);
    doneByBranch.set(s.branch_id, set);
  });
  const completionData = branches.map((b: any) => ({
    name: b.name,
    done: doneByBranch.get(b.id)?.size ?? 0,
    total: totalJobs,
  }));

  return (
    <div>
      <Navbar title="Auditor" fullName={profile.full_name} />
      <SubNav items={AUDITOR_NAV} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {branches.length === 0 ? (
          <div className="card p-6 text-sm text-grey">
            You don't have any branches assigned yet. Ask an admin to assign you a branch.
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="font-semibold text-ink mb-1">Today's completion</h2>
              <p className="text-xs text-grey mb-2">Out of {totalJobs} jobs per branch</p>
              <BranchCompletionList data={completionData} />
            </div>
            <div className="card p-5">
              <h2 className="font-semibold text-ink mb-1">Your average score by job (30 days)</h2>
              <JobAverageChart data={jobAvgData} />
            </div>
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-semibold text-ink mb-1">Score trend by branch (14 days)</h2>
              <p className="text-xs text-grey mb-2">Average % per day, per branch</p>
              <ScoreTrendChart data={scoreTrendData} branchNames={scoreTrendBranchNames} />
            </div>
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-semibold text-ink mb-1">Your submissions trend (14 days)</h2>
              <SubmissionsTrendChart data={trendData} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}