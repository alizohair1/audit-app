"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { ADMIN_NAV } from "@/lib/nav";
import type { JobType } from "@/types/database.types";

export default function AdminJobsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<JobType[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("job_types").select("*").order("sort_order");
    setJobs((data as JobType[]) ?? []);
    setLoading(false);
  }

  async function handleSave(job: JobType) {
    const raw = edits[job.id];
    if (raw === undefined) return;
    const std_score = raw.trim() === "" ? null : Number(raw);
    setSaving(job.id);
    await fetch("/api/admin/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: job.id, std_score }),
    });
    setSaving(null);
    load();
  }

  return (
    <div>
      <Navbar title="Admin" />
      <SubNav items={ADMIN_NAV} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <h1 className="text-xl font-bold">Jobs & Std Scores</h1>
      <p className="text-sm text-grey">
        SOS is time-based and doesn't use a std score — its bands are fixed (≤5min 100%, 5-7min 75%, 7-9min 50%, 9-10min 25%, &gt;10min 0%).
      </p>

      <div className="card clay-divider divide-y divide-line">
        {loading && <p className="p-4 text-sm text-grey">Loading…</p>}
        {jobs.map((job) => (
          <div key={job.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{job.name}</p>
              <p className="text-xs text-grey">{job.report_ref}</p>
            </div>
            {job.scoring_type === "score" ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="input !w-28"
                  defaultValue={job.std_score ?? ""}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [job.id]: e.target.value }))}
                />
                <button
                  onClick={() => handleSave(job)}
                  disabled={saving === job.id}
                  className="btn btn-secondary text-xs"
                >
                  {saving === job.id ? "Saving…" : "Save"}
                </button>
              </div>
            ) : (
              <span className="text-xs text-grey">time-based</span>
            )}
          </div>
        ))}
      </div>
      </main>
    </div>
  );
}
