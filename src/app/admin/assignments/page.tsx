"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { ADMIN_NAV } from "@/lib/nav";
import type { Branch } from "@/types/database.types";

interface AuditorRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface AssignmentRow {
  id: string;
  auditor_id: string;
  branch_id: string;
}

export default function AdminAssignmentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [auditors, setAuditors] = useState<AuditorRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [selectedAuditor, setSelectedAuditor] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const [usersRes, { data: branchData }, { data: assignmentData }] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      supabase.from("branches").select("*").order("name"),
      supabase.from("auditor_branch_assignments").select("*"),
    ]);
    setAuditors((usersRes.users ?? []).filter((u: any) => u.role === "auditor"));
    setBranches((branchData as Branch[]) ?? []);
    setAssignments((assignmentData as AssignmentRow[]) ?? []);
    setLoading(false);
  }

  // When switching auditors, pre-check whatever branches they're already assigned to.
  function selectAuditor(id: string) {
    setSelectedAuditor(id);
    const already = new Set(assignments.filter((a) => a.auditor_id === id).map((a) => a.branch_id));
    setSelectedBranches(already);
  }

  function toggleBranch(id: string) {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedBranches.size === branches.length) {
      setSelectedBranches(new Set());
    } else {
      setSelectedBranches(new Set(branches.map((b) => b.id)));
    }
  }

  async function handleSave() {
    if (!selectedAuditor) return;
    setSaving(true);
    await fetch("/api/admin/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditor_id: selectedAuditor, branch_ids: Array.from(selectedBranches) }),
    });
    setSaving(false);
    load();
  }

  function branchName(id: string) {
    return branches.find((b) => b.id === id)?.name ?? id;
  }
  function auditorName(id: string) {
    const a = auditors.find((a) => a.id === id);
    return a?.full_name ?? a?.email ?? id;
  }

  const grouped = auditors
    .map((a) => ({ auditor: a, branchIds: assignments.filter((x) => x.auditor_id === a.id).map((x) => x.branch_id) }))
    .filter((g) => g.branchIds.length > 0);

  return (
    <div>
      <Navbar title="Admin" />
      <SubNav items={ADMIN_NAV} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl font-bold">Assignments</h1>

        <div className="card p-4 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Auditor</label>
            <select
              className="input"
              value={selectedAuditor}
              onChange={(e) => selectAuditor(e.target.value)}
            >
              <option value="">Select auditor</option>
              {auditors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name ?? a.email}
                </option>
              ))}
            </select>
          </div>

          {selectedAuditor && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Branches</label>
                <button onClick={toggleSelectAll} className="text-xs text-accent font-medium">
                  {selectedBranches.size === branches.length ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {branches.map((b) => (
                  <label key={b.id} className="clay-checkbox flex items-center gap-2 text-sm px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedBranches.has(b.id)}
                      onChange={() => toggleBranch(b.id)}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                {saving ? "Saving…" : "Save assignments"}
              </button>
            </div>
          )}
        </div>

        <div className="card clay-divider divide-y divide-line">
          {loading && <p className="p-4 text-sm text-grey">Loading…</p>}
          {!loading && grouped.length === 0 && <p className="p-4 text-sm text-grey">No assignments yet.</p>}
          {grouped.map((g) => (
            <div key={g.auditor.id} className="p-4">
              <p className="font-medium text-sm">{auditorName(g.auditor.id)}</p>
              <p className="text-xs text-grey mt-1">{g.branchIds.map(branchName).join(", ")}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
