"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { UTILITY_ADMIN_NAV } from "@/lib/nav";
import BranchBarChart from "@/components/admin/BranchBarChart";
import { computeMeterConsumption, sumConsumptionByDate } from "@/lib/consumption";
import type { Branch } from "@/types/database.types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function UtilityAdminReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [elecData, setElecData] = useState<{ name: string; value: number }[]>([]);
  const [dieselData, setDieselData] = useState<{ name: string; value: number }[]>([]);
  const [gensetData, setGensetData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("branches")
      .select("*")
      .order("name")
      .then(({ data }) => setBranches((data as Branch[]) ?? []));
  }, [supabase]);

  useEffect(() => {
    if (branches.length > 0) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, branchId, from, to]);

  async function loadData() {
    setLoading(true);
    const relevantBranches = branchId ? branches.filter((b) => b.id === branchId) : branches;

    let meterQuery = supabase.from("branch_meters").select("id, branch_id");
    if (branchId) meterQuery = meterQuery.eq("branch_id", branchId);

    let elecQuery = supabase.from("electricity_readings").select("meter_id, branch_id, date, reading").lte("date", to);
    if (branchId) elecQuery = elecQuery.eq("branch_id", branchId);

    let dieselQuery = supabase.from("diesel_purchases").select("branch_id, date, litres").gte("date", from).lte("date", to);
    if (branchId) dieselQuery = dieselQuery.eq("branch_id", branchId);

    let gensetQuery = supabase
      .from("genset_readings")
      .select("branch_id, date, fuel_tank_fill_pct")
      .gte("date", from)
      .lte("date", to);
    if (branchId) gensetQuery = gensetQuery.eq("branch_id", branchId);

    const [{ data: meters }, { data: elecAll }, { data: dieselRows }, { data: gensetRows }] = await Promise.all([
      meterQuery,
      elecQuery,
      dieselQuery,
      gensetQuery,
    ]);

    const readingsByMeter = new Map<string, { date: string; reading: number }[]>();
    (elecAll ?? []).forEach((r: any) => {
      const list = readingsByMeter.get(r.meter_id) ?? [];
      list.push({ date: r.date, reading: r.reading });
      readingsByMeter.set(r.meter_id, list);
    });
    const consumptionByBranch = new Map<string, number>();
    (meters ?? []).forEach((m: any) => {
      const points = computeMeterConsumption(readingsByMeter.get(m.id) ?? []);
      const inRange = points.filter((p) => p.date >= from && p.date <= to);
      const total = inRange.reduce((sum, p) => sum + p.consumed, 0);
      consumptionByBranch.set(m.branch_id, (consumptionByBranch.get(m.branch_id) ?? 0) + total);
    });
    setElecData(
      relevantBranches.map((b) => ({ name: b.name, value: Math.round((consumptionByBranch.get(b.id) ?? 0) * 10) / 10 }))
    );

    const dieselByBranch = new Map<string, number>();
    (dieselRows ?? []).forEach((r: any) => {
      dieselByBranch.set(r.branch_id, (dieselByBranch.get(r.branch_id) ?? 0) + (r.litres ?? 0));
    });
    setDieselData(relevantBranches.map((b) => ({ name: b.name, value: Math.round((dieselByBranch.get(b.id) ?? 0) * 10) / 10 })));

    const gensetSumByBranch = new Map<string, { sum: number; count: number }>();
    (gensetRows ?? []).forEach((r: any) => {
      const entry = gensetSumByBranch.get(r.branch_id) ?? { sum: 0, count: 0 };
      entry.sum += r.fuel_tank_fill_pct ?? 0;
      entry.count += 1;
      gensetSumByBranch.set(r.branch_id, entry);
    });
    setGensetData(
      relevantBranches.map((b) => {
        const entry = gensetSumByBranch.get(b.id);
        return { name: b.name, value: entry ? Math.round((entry.sum / entry.count) * 10) / 10 : 0 };
      })
    );

    setLoading(false);
  }

  function downloadUrl() {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/reports/utilities?${params.toString()}`;
  }

  return (
    <div>
      <Navbar title="Utility Admin" />
      <SubNav items={UTILITY_ADMIN_NAV} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl font-bold">Utilities Report</h1>
        <p className="text-sm text-grey">Electricity, diesel, and genset — across all branches.</p>

        <div className="card p-4 space-y-4">
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
          <a href={downloadUrl()} className="btn btn-primary inline-flex">
            Download Excel
          </a>
        </div>

        {loading ? (
          <p className="text-sm text-grey py-8 text-center">Loading…</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="font-semibold text-ink mb-1">Electricity consumed by branch</h2>
              <p className="text-xs text-grey mb-2">Units, for the selected range</p>
              <BranchBarChart data={elecData} color="#2f5d50" unit="units" emptyText="Not enough meter readings yet." />
            </div>
            <div className="card p-5">
              <h2 className="font-semibold text-ink mb-1">Diesel purchased by branch</h2>
              <p className="text-xs text-grey mb-2">Litres, for the selected range</p>
              <BranchBarChart data={dieselData} color="#2f6ea5" unit="L" emptyText="No diesel purchases in this range." />
            </div>
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-semibold text-ink mb-1">Average genset fuel tank % by branch</h2>
              <p className="text-xs text-grey mb-2">For the selected range</p>
              <BranchBarChart data={gensetData} color="#c07a1f" unit="%" emptyText="No genset readings in this range." />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
