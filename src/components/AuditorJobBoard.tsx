"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcScorePercentage, calcSosBand, hmsToSeconds, secondsToHms, BAND_COLORS } from "@/lib/scoring";
import type { AuditSubmission, Branch, JobType } from "@/types/database.types";
import { todayStr } from "@/lib/dates";

export default function AuditorJobBoard({
  auditorId,
  branches,
  jobTypes,
}: {
  auditorId: string;
  branches: Branch[];
  jobTypes: JobType[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [date, setDate] = useState(todayStr());
  const [submissions, setSubmissions] = useState<Record<string, AuditSubmission>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("audit_submissions")
      .select("*")
      .eq("branch_id", branchId)
      .eq("date", date)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, AuditSubmission> = {};
        (data as AuditSubmission[] | null)?.forEach((s) => (map[s.job_type_id] = s));
        setSubmissions(map);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, date, supabase]);

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">Branch</label>
          <select
            className="input"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {loading && <span className="text-sm text-grey">Loading…</span>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {jobTypes.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            existing={submissions[job.id]}
            onSubmitted={(row) =>
              setSubmissions((prev) => ({ ...prev, [job.id]: row }))
            }
            auditorId={auditorId}
            branchId={branchId}
            date={date}
            supabase={supabase}
          />
        ))}
      </div>
    </div>
  );
}

function JobCard({
  job,
  existing,
  onSubmitted,
  auditorId,
  branchId,
  date,
  supabase,
}: {
  job: JobType;
  existing?: AuditSubmission;
  onSubmitted: (row: AuditSubmission) => void;
  auditorId: string;
  branchId: string;
  date: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const [score, setScore] = useState(existing?.obtained_score?.toString() ?? "");
  const [stdScore, setStdScore] = useState(
    (existing?.std_score_used ?? job.std_score)?.toString() ?? ""
  );
  const [time, setTime] = useState(
    existing?.time_taken_seconds != null ? secondsToHms(existing.time_taken_seconds) : ""
  );
  const [reportLink, setReportLink] = useState(existing?.report_link ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setScore(existing?.obtained_score?.toString() ?? "");
    setStdScore((existing?.std_score_used ?? job.std_score)?.toString() ?? "");
    setTime(existing?.time_taken_seconds != null ? secondsToHms(existing.time_taken_seconds) : "");
    setReportLink(existing?.report_link ?? "");
  }, [existing, job.std_score]);

  async function handleSubmit() {
    setErr(null);
    if (!branchId) {
      setErr("Select a branch first.");
      return;
    }
    let obtained_score: number | null = null;
    let std_score_used: number | null = null;
    let time_taken_seconds: number | null = null;
    let percentage: number | null = null;
    let band: string | null = null;

    if (job.scoring_type === "score") {
      const num = score.trim() === "" ? null : Number(score);
      if (num === null || Number.isNaN(num)) {
        setErr("Enter a valid obtained score.");
        return;
      }
      const std = stdScore.trim() === "" ? null : Number(stdScore);
      if (std === null || Number.isNaN(std) || std <= 0) {
        setErr("Enter a valid std score.");
        return;
      }
      obtained_score = num;
      std_score_used = std;
      percentage = calcScorePercentage(num, std);
    } else {
      const secs = hmsToSeconds(time);
      if (secs === null) {
        setErr("Enter time as HH:MM:SS.");
        return;
      }
      time_taken_seconds = secs;
      const result = calcSosBand(secs);
      percentage = result.percentage;
      band = result.band;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("audit_submissions")
      .upsert(
        {
          auditor_id: auditorId,
          branch_id: branchId,
          job_type_id: job.id,
          date,
          obtained_score,
          std_score_used,
          time_taken_seconds,
          percentage,
          band,
          report_link: reportLink || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "branch_id,job_type_id,date" }
      )
      .select()
      .single();
    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }
    onSubmitted(data as AuditSubmission);
  }

  const pct = existing?.percentage;
  const bandColor = existing?.band ? BAND_COLORS[existing.band as keyof typeof BAND_COLORS] : undefined;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">{job.name}</h3>
        {pct != null && (
          <span
            className="text-xs font-bold px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: bandColor ?? "#2f5d50" }}
          >
            {pct}%{existing?.band ? ` · ${existing.band}` : ""}
          </span>
        )}
      </div>
      {job.scoring_type === "score" ? (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="space-y-1">
            <label className="text-xs text-grey">Std score</label>
            <input
              type="number"
              step="0.01"
              placeholder="Std"
              className="input"
              value={stdScore}
              onChange={(e) => setStdScore(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-grey">Obtained score</label>
            <input
              type="number"
              step="0.01"
              placeholder="Obtained"
              className="input"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <input
          type="text"
          placeholder="HH:MM:SS"
          className="input"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      )}
      <input
        type="url"
        placeholder="Report link (URL)"
        className="input"
        value={reportLink}
        onChange={(e) => setReportLink(e.target.value)}
      />
      {err && <p className="text-xs text-red">{err}</p>}
      <button onClick={handleSubmit} disabled={saving} className="btn btn-primary w-full text-sm">
        {saving ? "Saving…" : existing ? "Update" : "Submit"}
      </button>
    </div>
  );
}