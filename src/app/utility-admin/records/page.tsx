"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { UTILITY_ADMIN_NAV } from "@/lib/nav";
import { formatGensetMeter } from "@/lib/genset";
import type { Branch } from "@/types/database.types";

type Section = "electricity" | "diesel" | "genset";

/** Local calendar date (YYYY-MM-DD), not UTC — so the default range is right early in the morning in Pakistan. */
function localDate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function todayStr() {
  return localDate(new Date());
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDate(d);
}

interface Row {
  id: string;
  date: string;
  branchName: string;
  [key: string]: any;
}

const TABLE_BY_SECTION: Record<Section, string> = {
  electricity: "electricity_readings",
  diesel: "diesel_purchases",
  genset: "genset_readings",
};

export default function UtilityAdminRecordsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [section, setSection] = useState<Section>("electricity");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("branches")
      .select("*")
      .order("name")
      .then(({ data }) => setBranches((data as Branch[]) ?? []));
  }, [supabase]);

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, branchId, from, to]);

  async function loadRows() {
    setLoading(true);

    let data: any[] | null = null;

    if (section === "electricity") {
      let q = supabase
        .from("electricity_readings")
        .select("id, date, reading, branch:branches(name), meter:branch_meters(meter_number)")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data: d } = await q;
      data = (d ?? []).map((r: any) => ({
        id: r.id,
        date: r.date,
        branchName: r.branch?.name ?? "—",
        Meter: r.meter?.meter_number ?? "—",
        Reading: r.reading,
      }));
    } else if (section === "diesel") {
      let q = supabase
        .from("diesel_purchases")
        .select("id, date, amount, litres, branch:branches(name)")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data: d } = await q;
      data = (d ?? []).map((r: any) => ({
        id: r.id,
        date: r.date,
        branchName: r.branch?.name ?? "—",
        Amount: r.amount,
        "Litres (L)": r.litres,
      }));
    } else {
      let q = supabase
        .from("genset_readings")
        .select("id, date, dip_stick_measure, fuel_tank_fill_pct, external_tank, genset_meter_minutes, branch:branches(name)")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data: d } = await q;
      data = (d ?? []).map((r: any) => ({
        id: r.id,
        date: r.date,
        branchName: r.branch?.name ?? "—",
        "Dip Stick (m)": r.dip_stick_measure,
        "Fuel (%)": r.fuel_tank_fill_pct,
        "Digital Genset Meter": formatGensetMeter(r.genset_meter_minutes),
        "External Tank (m)": r.external_tank,
      }));
    }

    setRows(data ?? []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this record? This can't be undone.")) return;
    setDeletingId(id);
    const { error } = await supabase.from(TABLE_BY_SECTION[section]).delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      alert(`Couldn't delete: ${error.message}`);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]).filter((k) => k !== "id" && k !== "date" && k !== "branchName") : [];

  return (
    <div>
      <Navbar title="Utility Admin" />
      <SubNav items={UTILITY_ADMIN_NAV} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl font-bold">Records</h1>
        <p className="text-sm text-grey">View and delete individual utility entries across all branches.</p>

        <div className="card p-4 space-y-4">
          <div className="flex gap-2">
            {(["electricity", "diesel", "genset"] as Section[]).map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`btn text-sm ${section === s ? "btn-primary" : "btn-secondary"}`}
              >
                {s === "electricity" ? "Electricity" : s === "diesel" ? "Diesel" : "Genset"}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Branch</label>
              <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">From</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">To</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-grey border-b border-line">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Branch</th>
                {columns.map((c) => (
                  <th key={c} className="py-3 px-4">
                    {c}
                  </th>
                ))}
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={columns.length + 3} className="py-6 text-center text-grey">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 3} className="py-6 text-center text-grey">
                    No records in this range.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 px-4 whitespace-nowrap text-grey">{row.date}</td>
                  <td className="py-2.5 px-4 font-medium">{row.branchName}</td>
                  {columns.map((c) => (
                    <td key={c} className="py-2.5 px-4 whitespace-nowrap">
                      {row[c] ?? "—"}
                    </td>
                  ))}
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                      className="btn btn-secondary text-xs text-red"
                    >
                      {deletingId === row.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
