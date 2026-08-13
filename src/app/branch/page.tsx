import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/supabase/guards";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { BRANCH_NAV } from "@/lib/nav";
import BranchTrendCharts from "@/components/BranchTrendCharts";
import ElectricityUsageCard from "@/components/ElectricityUsageCard";
import { computeMeterConsumption, sumConsumptionByDate } from "@/lib/consumption";
import { todayStr, daysAgoStr } from "@/lib/dates";

export default async function BranchDashboardPage() {
  const profile = await getMyProfile();
  if (!profile || profile.role !== "branch") redirect("/login");

  if (!profile.branch_id) {
    return (
      <div>
        <Navbar title="Branch" fullName={profile.full_name} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="card p-6 text-sm text-grey">
            Your account isn't linked to a branch yet. Ask an admin to assign your branch.
          </div>
        </main>
      </div>
    );
  }

  const supabase = createClient();
  const today = todayStr();
  const since14 = daysAgoStr(14);
  const since20 = daysAgoStr(20); // extra lookback so the 14-day trend has a baseline reading to diff against

  const { data: branch } = await supabase.from("branches").select("*").eq("id", profile.branch_id).single();

  const [
    { data: todayElec },
    { data: todayDiesel },
    { data: todayGenset },
    { data: dieselHistory },
    { data: gensetHistory },
    { data: meters },
    { data: elecHistory },
  ] = await Promise.all([
    supabase.from("electricity_readings").select("id").eq("branch_id", profile.branch_id).eq("date", today),
    supabase.from("diesel_purchases").select("id").eq("branch_id", profile.branch_id).eq("date", today),
    supabase.from("genset_readings").select("id").eq("branch_id", profile.branch_id).eq("date", today),
    supabase
      .from("diesel_purchases")
      .select("date, litres")
      .eq("branch_id", profile.branch_id)
      .gte("date", since14)
      .order("date"),
    supabase
      .from("genset_readings")
      .select("date, fuel_tank_fill_pct")
      .eq("branch_id", profile.branch_id)
      .gte("date", since14)
      .order("date"),
    supabase.from("branch_meters").select("id, meter_number").eq("branch_id", profile.branch_id).order("meter_number"),
    supabase
      .from("electricity_readings")
      .select("meter_id, date, reading")
      .eq("branch_id", profile.branch_id)
      .gte("date", since20)
      .order("date"),
  ]);

  const dieselMap = new Map<string, number>();
  (dieselHistory ?? []).forEach((r: any) => {
    dieselMap.set(r.date, (dieselMap.get(r.date) ?? 0) + (r.litres ?? 0));
  });
  const gensetMap = new Map<string, number>();
  (gensetHistory ?? []).forEach((r: any) => {
    gensetMap.set(r.date, r.fuel_tank_fill_pct ?? 0);
  });

  const dieselTrend: { date: string; litres: number }[] = [];
  const fuelTrend: { date: string; pct: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = daysAgoStr(i);
    dieselTrend.push({ date: d.slice(5), litres: dieselMap.get(d) ?? 0 });
    fuelTrend.push({ date: d.slice(5), pct: gensetMap.get(d) ?? 0 });
  }

  // --- Electricity usage (units consumed = latest reading - previous reading, per meter) ---
  const readingsByMeter = new Map<string, { date: string; reading: number }[]>();
  (elecHistory ?? []).forEach((r: any) => {
    const list = readingsByMeter.get(r.meter_id) ?? [];
    list.push({ date: r.date, reading: r.reading });
    readingsByMeter.set(r.meter_id, list);
  });

  const perMeterConsumption = (meters ?? []).map((m: any) => computeMeterConsumption(readingsByMeter.get(m.id) ?? []));
  const consumptionTotals = sumConsumptionByDate(perMeterConsumption);

  const elecTrend: { date: string; consumed: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = daysAgoStr(i);
    elecTrend.push({ date: d.slice(5), consumed: consumptionTotals.get(d) ?? 0 });
  }

  const meterRows = (meters ?? []).map((m: any) => {
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
  });

  return (
    <div>
      <Navbar title={`Branch — ${branch?.name ?? ""}`} fullName={profile.full_name} />
      <SubNav items={BRANCH_NAV} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <StatusCard label="Electricity" done={(todayElec?.length ?? 0) > 0} />
          <StatusCard label="Diesel Purchase" done={(todayDiesel?.length ?? 0) > 0} />
          <StatusCard label="Genset" done={(todayGenset?.length ?? 0) > 0} />
        </div>

        <ElectricityUsageCard meterRows={meterRows} trend={elecTrend} />

        <BranchTrendCharts dieselTrend={dieselTrend} fuelTrend={fuelTrend} />
      </main>
    </div>
  );
}

function StatusCard({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="card p-4 flex items-center justify-between">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span
        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
          done ? "bg-green/15 text-green shadow-sm" : "clay-checkbox text-grey"
        }`}
      >
        {done ? "Submitted today" : "Not yet"}
      </span>
    </div>
  );
}
