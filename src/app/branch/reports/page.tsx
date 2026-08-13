"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { BRANCH_NAV } from "@/lib/nav";
import ElectricityUsageCard from "@/components/ElectricityUsageCard";
import BranchTrendCharts from "@/components/BranchTrendCharts";
import { computeMeterConsumption, sumConsumptionByDate } from "@/lib/consumption";
import { todayStr, daysAgoStr, dateRange } from "@/lib/dates";

interface HistoryRow {
  date: string;
  meter?: string;
  reading?: number;
  dieselAmount?: number;
  dieselLitres?: number;
  dipStick?: number;
  fuelPct?: number;
  externalTank?: number;
}

export default function BranchReportsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [meterRows, setMeterRows] = useState<any[]>([]);
  const [elecTrend, setElecTrend] = useState<{ date: string; consumed: number }[]>([]);
  const [dieselTrend, setDieselTrend] = useState<{ date: string; litres: number }[]>([]);
  const [fuelTrend, setFuelTrend] = useState<{ date: string; pct: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve the caller's own branch_id once on mount.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("branch_id").eq("id", user.id).single();
      setBranchId(profile?.branch_id ?? null);
    })();
  }, [supabase]);

  useEffect(() => {
    if (branchId) loadAll(branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, from, to]);

  async function loadAll(branch: string) {
    setLoading(true);

    const [
      { data: meters },
      { data: elecAll },
      { data: dieselInRange },
      { data: gensetInRange },
      { data: elecHistoryRaw },
      { data: dieselHistoryRaw },
      { data: gensetHistoryRaw },
    ] = await Promise.all([
      supabase.from("branch_meters").select("id, meter_number").eq("branch_id", branch).order("meter_number"),
      // fetch all electricity readings up to `to` (no lower bound) so the first day in range has a correct diff baseline
      supabase.from("electricity_readings").select("meter_id, date, reading").eq("branch_id", branch).lte("date", to).order("date"),
      supabase.from("diesel_purchases").select("date, litres").eq("branch_id", branch).gte("date", from).lte("date", to),
      supabase.from("genset_readings").select("date, fuel_tank_fill_pct").eq("branch_id", branch).gte("date", from).lte("date", to),
      supabase
        .from("electricity_readings")
        .select("date, reading, meter:branch_meters(meter_number)")
        .eq("branch_id", branch)
        .order("date", { ascending: false })
        .limit(20),
      supabase
        .from("diesel_purchases")
        .select("date, amount, litres")
        .eq("branch_id", branch)
        .order("date", { ascending: false })
        .limit(20),
      supabase
        .from("genset_readings")
        .select("date, dip_stick_measure, fuel_tank_fill_pct, external_tank")
        .eq("branch_id", branch)
        .order("date", { ascending: false })
        .limit(20),
    ]);

    // --- Electricity consumption trend + latest-reading table ---
    const readingsByMeter = new Map<string, { date: string; reading: number }[]>();
    (elecAll ?? []).forEach((r: any) => {
      const list = readingsByMeter.get(r.meter_id) ?? [];
      list.push({ date: r.date, reading: r.reading });
      readingsByMeter.set(r.meter_id, list);
    });
    const perMeterConsumption = (meters ?? []).map((m: any) => computeMeterConsumption(readingsByMeter.get(m.id) ?? []));
    const totals = sumConsumptionByDate(perMeterConsumption);
    const days = dateRange(from, to);
    setElecTrend(days.map((d) => ({ date: d.slice(5), consumed: totals.get(d) ?? 0 })));

    setMeterRows(
      (meters ?? []).map((m: any) => {
        const sorted = [...(readingsByMeter.get(m.id) ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1));
        const latest = sorted[sorted.length - 1];
        const previous = sorted[sorted.length - 2];
        return {
          meterNumber: m.meter_number,
          latestDate: latest?.date ?? null,
          latestReading: latest?.reading ?? null,
          previousReading: previous?.reading ?? null,
          consumed: latest && previous ? latest.reading - previous.reading : null,
        };
      })
    );

    // --- Diesel / genset trends within range ---
    const dieselMap = new Map<string, number>();
    (dieselInRange ?? []).forEach((r: any) => dieselMap.set(r.date, (dieselMap.get(r.date) ?? 0) + (r.litres ?? 0)));
    setDieselTrend(days.map((d) => ({ date: d.slice(5), litres: dieselMap.get(d) ?? 0 })));

    const gensetMap = new Map<string, number>();
    (gensetInRange ?? []).forEach((r: any) => gensetMap.set(r.date, r.fuel_tank_fill_pct ?? 0));
    setFuelTrend(days.map((d) => ({ date: d.slice(5), pct: gensetMap.get(d) ?? 0 })));

    // --- Recent submissions list (independent of date range, last 20 of each) ---
    const rows: HistoryRow[] = [];
    (elecHistoryRaw as any[] | null)?.forEach((r) => rows.push({ date: r.date, meter: r.meter?.meter_number, reading: r.reading }));
    (dieselHistoryRaw as any[] | null)?.forEach((r) => rows.push({ date: r.date, dieselAmount: r.amount, dieselLitres: r.litres }));
    (gensetHistoryRaw as any[] | null)?.forEach((r) =>
      rows.push({ date: r.date, dipStick: r.dip_stick_measure, fuelPct: r.fuel_tank_fill_pct, externalTank: r.external_tank })
    );
    rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    setHistory(rows);

    setLoading(false);
  }

  function downloadUrl() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/reports/branch?${params.toString()}`;
  }

  return (
    <div>
      <Navbar title="Branch" />
      <SubNav items={BRANCH_NAV} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl font-bold">Reports</h1>

        <div className="card p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
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

        {!branchId ? (
          <div className="card p-6 text-sm text-grey">
            Your account isn't linked to a branch yet. Ask an admin to assign your branch.
          </div>
        ) : loading ? (
          <p className="text-sm text-grey py-8 text-center">Loading…</p>
        ) : (
          <>
            <ElectricityUsageCard meterRows={meterRows} trend={elecTrend} title="Electricity usage (selected range)" />
            <BranchTrendCharts dieselTrend={dieselTrend} fuelTrend={fuelTrend} rangeLabel="selected range" />
          </>
        )}

        <section>
          <h2 className="font-semibold mb-2">Recent submissions</h2>
          <div className="card clay-divider divide-y divide-line text-sm">
            {history.length === 0 && <p className="p-3 text-grey">Nothing submitted yet.</p>}
            {history.map((row, i) => (
              <div key={i} className="p-3 flex flex-wrap gap-x-6 gap-y-1">
                <span className="text-grey w-24">{row.date}</span>
                {row.meter && (
                  <span>
                    Meter {row.meter}: {row.reading}
                  </span>
                )}
                {row.dieselAmount != null && (
                  <span>
                    Diesel: {row.dieselAmount} / {row.dieselLitres} L
                  </span>
                )}
                {row.dipStick != null && (
                  <span>
                    Genset: dip {row.dipStick}, fuel {row.fuelPct}%, ext {row.externalTank}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}