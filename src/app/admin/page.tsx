import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/supabase/guards";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { ADMIN_NAV } from "@/lib/nav";
import { JobAverageChart, SubmissionsTrendChart, BranchCompletionList, BranchConsumptionChart } from "@/components/admin/AdminDashboardCharts";
import ScoreTrendChart from "@/components/admin/ScoreTrendChart";
import { computeMeterConsumption } from "@/lib/consumption";
import { todayStr, daysAgoStr } from "@/lib/dates";

export default async function AdminPage() {
  const profile = await getMyProfile();
  if (!profile || profile.role !== "admin") redirect("/login");

  const supabase = createClient();

  const [{ count: userCount }, { count: branchCount }, { count: submissionCount }, { data: branches }, { data: jobTypes }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("branches").select("*", { count: "exact", head: true }),
      supabase.from("audit_submissions").select("*", { count: "exact", head: true }),
      supabase.from("branches").select("id, name").order("name"),
      supabase.from("job_types").select("id, name, sort_order").order("sort_order"),
    ]);

  const since30 = daysAgoStr(30);
  const today = todayStr();

  const { data: recentSubs } = await supabase
    .from("audit_submissions")
    .select("date, percentage, job_type_id, branch_id")
    .gte("date", since30);

  // --- Avg % by job type (last 30 days) ---
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

  // --- Submissions per day (last 14 days) ---
  const dayCounts = new Map<string, number>();
  for (let i = 13; i >= 0; i--) dayCounts.set(daysAgoStr(i), 0);
  (recentSubs ?? []).forEach((s: any) => {
    if (dayCounts.has(s.date)) dayCounts.set(s.date, (dayCounts.get(s.date) ?? 0) + 1);
  });
  const trendData = Array.from(dayCounts.entries()).map(([date, count]) => ({
    date: date.slice(5),
    count,
  }));

  // --- Score trend by branch (14 days) — average % per day, one line per branch ---
  const branchNameById = new Map((branches ?? []).map((b: any) => [b.id, b.name]));
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
  const scoreTrendBranchNames = Array.from(new Set((branches ?? []).map((b: any) => b.name))).sort();
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

  // --- Branch completion today (out of total jobs) ---
  const totalJobs = (jobTypes ?? []).length;
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
  const completionData = (branches ?? []).map((b: any) => ({
    name: b.name,
    done: doneByBranch.get(b.id)?.size ?? 0,
    total: totalJobs,
  }));

  // --- Electricity consumption by branch (30 days) ---
  const since34 = daysAgoStr(34); // extra lookback for a diff baseline
  const { data: meters } = await supabase.from("branch_meters").select("id, branch_id");
  const { data: elecHistory } = await supabase
    .from("electricity_readings")
    .select("meter_id, date, reading")
    .gte("date", since34)
    .order("date");

  const readingsByMeter = new Map<string, { date: string; reading: number }[]>();
  (elecHistory ?? []).forEach((r: any) => {
    const list = readingsByMeter.get(r.meter_id) ?? [];
    list.push({ date: r.date, reading: r.reading });
    readingsByMeter.set(r.meter_id, list);
  });

  const consumptionByBranch = new Map<string, number>();
  (meters ?? []).forEach((m: any) => {
    const points = computeMeterConsumption(readingsByMeter.get(m.id) ?? []);
    const inWindow = points.filter((p) => p.date >= since30);
    const total = inWindow.reduce((sum, p) => sum + p.consumed, 0);
    consumptionByBranch.set(m.branch_id, (consumptionByBranch.get(m.branch_id) ?? 0) + total);
  });
  const consumptionData = (branches ?? []).map((b: any) => ({
    name: b.name,
    consumed: Math.round((consumptionByBranch.get(b.id) ?? 0) * 10) / 10,
  }));

  return (
    <div>
      <Navbar title="Admin" fullName={profile.full_name} />
      <SubNav items={ADMIN_NAV} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="Users" value={userCount ?? 0} />
          <Stat label="Branches" value={branchCount ?? 0} />
          <Stat label="Audit submissions" value={submissionCount ?? 0} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="font-semibold text-ink mb-1">Average score by job (30 days)</h2>
            <p className="text-xs text-grey mb-2">Across all branches and auditors</p>
            <JobAverageChart data={jobAvgData} />
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-ink mb-1">Today's completion by branch</h2>
            <p className="text-xs text-grey mb-2">Out of {totalJobs} jobs each</p>
            <BranchCompletionList data={completionData} />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-1">Score trend by branch (14 days)</h2>
          <p className="text-xs text-grey mb-2">Average % per day, per branch</p>
          <ScoreTrendChart data={scoreTrendData} branchNames={scoreTrendBranchNames} />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-1">Submissions trend (14 days)</h2>
          <SubmissionsTrendChart data={trendData} />
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-1">Electricity consumption by branch (30 days)</h2>
          <p className="text-xs text-grey mb-2">Total units consumed, summed across each branch's meters</p>
          <BranchConsumptionChart data={consumptionData} />
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card clay-stat p-4">
      <p className="text-xs uppercase tracking-wide text-grey">{label}</p>
      <p className="text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}