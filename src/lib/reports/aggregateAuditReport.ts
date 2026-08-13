import { dateRange } from "@/lib/dates";
import type { JobType } from "@/types/database.types";

export interface RawSubmissionRow {
  date: string;
  percentage: number | null;
  obtained_score: number | null;
  std_score_used: number | null;
  time_taken_seconds: number | null;
  band: string | null;
  report_link: string | null;
  submitted_at: string;
  branch_id: string;
  job_type_id: string;
  auditor_id: string;
  branch: { id: string; name: string; code: string | null } | null;
  job_type: {
    id: string;
    name: string;
    sort_order: number;
    scoring_type: string;
    std_score: number | null;
  } | null;
  auditor: { id: string; full_name: string | null } | null;
}

export interface BranchDetail {
  id: string;
  name: string;
  code: string | null;
  submissionCount: number;
  avgPct: number;
  jobBreakdown: { jobName: string; avgPct: number; count: number }[];
  auditors: string[];
}

export interface DetailRow {
  id: string;
  date: string;
  branch: string;
  job: string;
  scoringType: string;
  obtained: string;
  percentage: number | null;
  band: string | null;
  auditor: string;
  reportLink: string | null;
  submittedAt: string;
}

export interface AuditReportData {
  summary: {
    totalSubmissions: number;
    avgPct: number;
    branchCount: number;
    jobCount: number;
    auditorCount: number;
  };
  jobAvgData: { name: string; avgPct: number }[];
  jobsByBranch: { data: Record<string, string | number>[]; branchNames: string[] };
  scoreTrendByBranch: { data: Record<string, string | number>[]; names: string[] };
  scoreTrendByJob: { data: Record<string, string | number>[]; names: string[] };
  submissionsTrend: { date: string; count: number }[];
  branchDetails: BranchDetail[];
  detailRows: DetailRow[];
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function avgPct(values: number[]) {
  if (values.length === 0) return 0;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

export function aggregateAuditReport(
  rows: RawSubmissionRow[],
  jobTypes: JobType[],
  from: string,
  to: string
): AuditReportData {
  const days = dateRange(from, to);
  const pctValues = rows.map((r) => r.percentage).filter((p): p is number => p != null);

  const jobOrder = new Map(jobTypes.map((j) => [j.id, j.sort_order]));
  const jobNameById = new Map(jobTypes.map((j) => [j.id, j.name]));

  // --- Job averages ---
  const jobSum = new Map<string, { sum: number; count: number; name: string; order: number }>();
  rows.forEach((r) => {
    const id = r.job_type_id;
    const name = r.job_type?.name ?? jobNameById.get(id) ?? "Unknown";
    const entry = jobSum.get(id) ?? { sum: 0, count: 0, name, order: r.job_type?.sort_order ?? jobOrder.get(id) ?? 0 };
    entry.sum += r.percentage ?? 0;
    entry.count += 1;
    jobSum.set(id, entry);
  });
  const jobAvgData = Array.from(jobSum.values())
    .sort((a, b) => a.order - b.order)
    .map((e) => ({ name: e.name, avgPct: round1(e.sum / e.count) }));

  // --- Jobs by branch (avg % per job × branch) ---
  const jobBranchSum = new Map<string, { sum: number; count: number; sortOrder: number }>();
  const branchNameSet = new Set<string>();
  rows.forEach((r) => {
    const jobName = r.job_type?.name ?? "Unknown";
    const branchName = r.branch?.name ?? "Unknown";
    branchNameSet.add(branchName);
    const key = `${jobName}__${branchName}`;
    const entry = jobBranchSum.get(key) ?? { sum: 0, count: 0, sortOrder: r.job_type?.sort_order ?? 0 };
    entry.sum += r.percentage ?? 0;
    entry.count += 1;
    jobBranchSum.set(key, entry);
  });
  const jobNamesMap = new Map<string, number>();
  jobBranchSum.forEach((v, key) => jobNamesMap.set(key.split("__")[0], v.sortOrder));
  const sortedJobs = Array.from(jobNamesMap.entries()).sort((a, b) => a[1] - b[1]);
  const sortedBranchNames = Array.from(branchNameSet).sort();
  const jobsByBranchData = sortedJobs.map(([jobName]) => {
    const row: Record<string, string | number> = { job: jobName };
    sortedBranchNames.forEach((branchName) => {
      const entry = jobBranchSum.get(`${jobName}__${branchName}`);
      row[branchName] = entry ? round1(entry.sum / entry.count) : 0;
    });
    return row;
  });

  // --- Score trend by branch (avg % per day per branch) ---
  const byDayBranch = new Map<string, { sum: number; count: number }>();
  rows.forEach((r) => {
    const branchName = r.branch?.name;
    if (!branchName) return;
    const key = `${r.date}__${branchName}`;
    const entry = byDayBranch.get(key) ?? { sum: 0, count: 0 };
    entry.sum += r.percentage ?? 0;
    entry.count += 1;
    byDayBranch.set(key, entry);
  });
  const trendBranchNames = Array.from(new Set(rows.map((r) => r.branch?.name).filter(Boolean) as string[])).sort();
  const scoreTrendByBranchData = days.map((d) => {
    const row: Record<string, string | number> = { date: d.slice(5) };
    trendBranchNames.forEach((name) => {
      const entry = byDayBranch.get(`${d}__${name}`);
      if (entry) row[name] = round1(entry.sum / entry.count);
    });
    return row;
  });

  // --- Score trend by job (avg % per day per job) ---
  const byDayJob = new Map<string, { sum: number; count: number }>();
  rows.forEach((r) => {
    const jobName = r.job_type?.name;
    if (!jobName) return;
    const key = `${r.date}__${jobName}`;
    const entry = byDayJob.get(key) ?? { sum: 0, count: 0 };
    entry.sum += r.percentage ?? 0;
    entry.count += 1;
    byDayJob.set(key, entry);
  });
  const trendJobNames = Array.from(new Set(rows.map((r) => r.job_type?.name).filter(Boolean) as string[])).sort(
    (a, b) => {
      const ja = jobTypes.find((j) => j.name === a)?.sort_order ?? 0;
      const jb = jobTypes.find((j) => j.name === b)?.sort_order ?? 0;
      return ja - jb;
    }
  );
  const scoreTrendByJobData = days.map((d) => {
    const row: Record<string, string | number> = { date: d.slice(5) };
    trendJobNames.forEach((name) => {
      const entry = byDayJob.get(`${d}__${name}`);
      if (entry) row[name] = round1(entry.sum / entry.count);
    });
    return row;
  });

  // --- Submissions per day ---
  const dayCounts = new Map<string, number>();
  days.forEach((d) => dayCounts.set(d, 0));
  rows.forEach((r) => {
    if (dayCounts.has(r.date)) dayCounts.set(r.date, (dayCounts.get(r.date) ?? 0) + 1);
  });
  const submissionsTrend = days.map((d) => ({ date: d.slice(5), count: dayCounts.get(d) ?? 0 }));

  // --- Branch details ---
  const branchMap = new Map<
    string,
    {
      id: string;
      name: string;
      code: string | null;
      pcts: number[];
      jobStats: Map<string, { sum: number; count: number }>;
      auditorSet: Set<string>;
    }
  >();
  rows.forEach((r) => {
    const id = r.branch_id;
    const existing = branchMap.get(id) ?? {
      id,
      name: r.branch?.name ?? "Unknown",
      code: r.branch?.code ?? null,
      pcts: [] as number[],
      jobStats: new Map(),
      auditorSet: new Set(),
    };
    if (r.percentage != null) existing.pcts.push(r.percentage);
    const jobName = r.job_type?.name ?? "Unknown";
    const js = existing.jobStats.get(jobName) ?? { sum: 0, count: 0 };
    js.sum += r.percentage ?? 0;
    js.count += 1;
    existing.jobStats.set(jobName, js);
    if (r.auditor?.full_name) existing.auditorSet.add(r.auditor.full_name);
    branchMap.set(id, existing);
  });
  const branchDetails: BranchDetail[] = Array.from(branchMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      submissionCount: b.pcts.length,
      avgPct: avgPct(b.pcts),
      jobBreakdown: Array.from(b.jobStats.entries())
        .map(([jobName, s]) => ({ jobName, avgPct: round1(s.sum / s.count), count: s.count }))
        .sort((a, c) => {
          const ja = jobTypes.find((j) => j.name === a.jobName)?.sort_order ?? 0;
          const jb = jobTypes.find((j) => j.name === c.jobName)?.sort_order ?? 0;
          return ja - jb;
        }),
      auditors: Array.from(b.auditorSet).sort(),
    }));

  // --- Detail rows ---
  const detailRows: DetailRow[] = rows.map((r, i) => ({
    id: `${r.date}-${r.branch_id}-${r.job_type_id}-${i}`,
    date: r.date,
    branch: r.branch?.name ?? "—",
    job: r.job_type?.name ?? "—",
    scoringType: r.job_type?.scoring_type ?? "score",
    obtained:
      r.job_type?.scoring_type === "time"
        ? r.time_taken_seconds != null
          ? formatHms(r.time_taken_seconds)
          : "—"
        : r.obtained_score != null
        ? String(r.obtained_score)
        : "—",
    percentage: r.percentage,
    band: r.band,
    auditor: r.auditor?.full_name ?? "—",
    reportLink: r.report_link,
    submittedAt: r.submitted_at,
  }));

  return {
    summary: {
      totalSubmissions: rows.length,
      avgPct: avgPct(pctValues),
      branchCount: branchMap.size,
      jobCount: jobSum.size,
      auditorCount: new Set(rows.map((r) => r.auditor_id)).size,
    },
    jobAvgData,
    jobsByBranch: { data: jobsByBranchData, branchNames: sortedBranchNames },
    scoreTrendByBranch: { data: scoreTrendByBranchData, names: trendBranchNames },
    scoreTrendByJob: { data: scoreTrendByJobData, names: trendJobNames },
    submissionsTrend,
    branchDetails,
    detailRows,
  };
}

function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}