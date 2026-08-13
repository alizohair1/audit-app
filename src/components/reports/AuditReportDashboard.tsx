"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  JobAverageChart,
  SubmissionsTrendChart,
} from "@/components/admin/AdminDashboardCharts";
import JobsByBranchChart from "@/components/admin/JobsByBranchChart";
import ScoreTrendChart from "@/components/admin/ScoreTrendChart";
import { aggregateAuditReport, type RawSubmissionRow } from "@/lib/reports/aggregateAuditReport";
import { BAND_COLORS } from "@/lib/scoring";
import { todayStr, daysAgoStr } from "@/lib/dates";
import type { Branch, JobType } from "@/types/database.types";
import type { SosBand } from "@/types/database.types";

interface AuditorOption {
  id: string;
  full_name: string | null;
}

export default function AuditReportDashboard({
  mode,
  title = "Reports",
  subtitle,
}: {
  mode: "admin" | "auditor";
  title?: string;
  subtitle?: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [auditors, setAuditors] = useState<AuditorOption[]>([]);

  const [branchId, setBranchId] = useState("");
  const [jobTypeId, setJobTypeId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());

  const [loading, setLoading] = useState(true);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [report, setReport] = useState<ReturnType<typeof aggregateAuditReport> | null>(null);

  useEffect(() => {
    async function loadMeta() {
      const jobsPromise = supabase.from("job_types").select("*").order("sort_order");
      if (mode === "admin") {
        const [{ data: branchData }, { data: jobData }, { data: auditorData }] = await Promise.all([
          supabase.from("branches").select("*").order("name"),
          jobsPromise,
          supabase.from("profiles").select("id, full_name").eq("role", "auditor").order("full_name"),
        ]);
        setBranches((branchData as Branch[]) ?? []);
        setJobTypes((jobData as JobType[]) ?? []);
        setAuditors((auditorData as AuditorOption[]) ?? []);
      } else {
        const [{ data: assignmentData }, { data: jobData }] = await Promise.all([
          supabase.from("auditor_branch_assignments").select("branch:branches(id, name, code, created_at)"),
          jobsPromise,
        ]);
        const list = (assignmentData ?? []).map((a: any) => a.branch).filter(Boolean) as Branch[];
        setBranches(list.sort((a, b) => a.name.localeCompare(b.name)));
        setJobTypes((jobData as JobType[]) ?? []);
      }
      setMetaLoaded(true);
    }
    loadMeta();
  }, [supabase, mode]);

  useEffect(() => {
    if (!metaLoaded) return;
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, jobTypeId, auditorId, from, to, metaLoaded]);

  async function loadReport() {
    setLoading(true);

    // NOTE the explicit <string, RawSubmissionRow> generic on .select() below.
    // Without generated Supabase Database types, postgrest-js's select-string
    // parser can't prove branch/job_type/auditor are one-to-one relations, so
    // it defaults every embedded resource to an array — even with `!inner`.
    // The generic overrides the inferred type directly, matching what the
    // query actually returns at runtime (confirmed against real field shapes).
    let query = supabase
      .from("audit_submissions")
      .select<string, RawSubmissionRow>(
        `date, percentage, obtained_score, std_score_used, time_taken_seconds, band, report_link, submitted_at,
         branch_id, job_type_id, auditor_id,
         branch:branches!inner(id, name, code),
         job_type:job_types!inner(id, name, sort_order, scoring_type, std_score),
         auditor:profiles!audit_submissions_auditor_id_fkey!inner(id, full_name)`
      )
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });

    if (branchId) query = query.eq("branch_id", branchId);
    if (jobTypeId) query = query.eq("job_type_id", jobTypeId);
    if (auditorId) query = query.eq("auditor_id", auditorId);

    const { data } = await query;
    const aggregated = aggregateAuditReport(data ?? [], jobTypes, from, to);
    setReport(aggregated);
    setLoading(false);
  }

  function downloadUrl() {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (jobTypeId) params.set("jobTypeId", jobTypeId);
    if (auditorId) params.set("auditorId", auditorId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/reports?${params.toString()}`;
  }

  const hasData = (report?.summary.totalSubmissions ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-grey mt-1">{subtitle}</p>}
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <h2 className="font-semibold text-ink text-sm uppercase tracking-wide">Filters</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <FilterField label="Branch">
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{mode === "admin" ? "All branches" : "All my branches"}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Job">
            <select className="input" value={jobTypeId} onChange={(e) => setJobTypeId(e.target.value)}>
              <option value="">All jobs</option>
              {jobTypes.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </FilterField>
          {mode === "admin" && (
            <FilterField label="Auditor">
              <select className="input" value={auditorId} onChange={(e) => setAuditorId(e.target.value)}>
                <option value="">All auditors</option>
                {auditors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name ?? a.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </FilterField>
          )}
          <FilterField label="From">
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FilterField>
          <FilterField label="To">
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </FilterField>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <a href={downloadUrl()} className="btn btn-primary inline-flex">
            Download Excel
          </a>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => {
              setBranchId("");
              setJobTypeId("");
              setAuditorId("");
              setFrom(daysAgoStr(30));
              setTo(todayStr());
            }}
          >
            Reset filters
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-grey py-12 text-center">Loading report…</p>
      ) : !hasData ? (
        <div className="card p-8 text-center text-sm text-grey">
          No submissions match the selected filters. Try widening the date range or clearing filters.
        </div>
      ) : report ? (
        <>
          {/* Summary */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <SummaryStat label="Submissions" value={report.summary.totalSubmissions} />
            <SummaryStat label="Average score" value={`${report.summary.avgPct}%`} />
            <SummaryStat label="Branches" value={report.summary.branchCount} />
            <SummaryStat label="Jobs covered" value={report.summary.jobCount} />
            <SummaryStat label="Auditors" value={report.summary.auditorCount} />
          </div>

          {/* Charts row 1 */}
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Average score by job" subtitle="Mean % across filtered submissions">
              <JobAverageChart data={report.jobAvgData} />
            </ChartCard>
            <ChartCard title="Submissions over time" subtitle="Daily submission count">
              <SubmissionsTrendChart data={report.submissionsTrend} />
            </ChartCard>
          </div>

          {/* Jobs by branch */}
          <ChartCard
            title={branchId ? "Job scores" : "Job scores by branch"}
            subtitle="Average % per job, grouped by branch"
          >
            <JobsByBranchChart
              data={report.jobsByBranch.data}
              branchNames={report.jobsByBranch.branchNames}
            />
          </ChartCard>

          {/* Trend charts */}
          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard title="Score trend by job" subtitle="Daily average % per job">
              <ScoreTrendChart
                data={report.scoreTrendByJob.data}
                branchNames={report.scoreTrendByJob.names}
              />
            </ChartCard>
            <ChartCard title="Score trend by branch" subtitle="Daily average % per branch">
              <ScoreTrendChart
                data={report.scoreTrendByBranch.data}
                branchNames={report.scoreTrendByBranch.names}
              />
            </ChartCard>
          </div>

          {/* Branch details */}
          <section className="space-y-3">
            <h2 className="font-semibold text-ink">Branch details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {report.branchDetails.map((b) => (
                <div key={b.id} className="card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-ink">{b.name}</h3>
                      {b.code && <p className="text-xs text-grey">Code: {b.code}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-accent">{b.avgPct}%</p>
                      <p className="text-xs text-grey">avg score</p>
                    </div>
                  </div>
                  <p className="text-sm text-grey">
                    {b.submissionCount} submission{b.submissionCount !== 1 ? "s" : ""}
                    {b.auditors.length > 0 && (
                      <> · {b.auditors.join(", ")}</>
                    )}
                  </p>
                  <div className="space-y-2">
                    {b.jobBreakdown.map((j) => (
                      <div key={j.jobName}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium text-ink">{j.jobName}</span>
                          <span className="text-grey">
                            {j.avgPct}% · {j.count}×
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full clay-progress-track overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.min(j.avgPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Detail table */}
          <section className="space-y-3">
            <h2 className="font-semibold text-ink">All submissions</h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-grey border-b border-line">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Job</th>
                    <th className="py-3 px-4">Score / Time</th>
                    <th className="py-3 px-4">%</th>
                    <th className="py-3 px-4">Band</th>
                    {mode === "admin" && <th className="py-3 px-4">Auditor</th>}
                    <th className="py-3 px-4">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {report.detailRows.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0 hover:bg-white/30">
                      <td className="py-2.5 px-4 whitespace-nowrap text-grey">{row.date}</td>
                      <td className="py-2.5 px-4 font-medium">{row.branch}</td>
                      <td className="py-2.5 px-4">{row.job}</td>
                      <td className="py-2.5 px-4">{row.obtained}</td>
                      <td className="py-2.5 px-4 font-semibold text-accent">
                        {row.percentage != null ? `${row.percentage}%` : "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        {row.band ? (
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                            style={{
                              backgroundColor:
                                BAND_COLORS[row.band as SosBand] ?? "#7a8088",
                            }}
                          >
                            {row.band}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {mode === "admin" && <td className="py-2.5 px-4">{row.auditor}</td>}
                      <td className="py-2.5 px-4">
                        {row.reportLink ? (
                          <a
                            href={row.reportLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline text-xs"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card clay-stat p-4">
      <p className="text-xs uppercase tracking-wide text-grey">{label}</p>
      <p className="text-2xl font-bold text-ink mt-0.5">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-ink mb-1">{title}</h2>
      {subtitle && <p className="text-xs text-grey mb-2">{subtitle}</p>}
      {children}
    </div>
  );
}