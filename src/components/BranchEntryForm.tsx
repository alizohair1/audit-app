"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BranchMeter } from "@/types/database.types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BranchEntryForm({
  branchId,
  userId,
  meters,
}: {
  branchId: string;
  userId: string;
  meters: BranchMeter[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(todayStr());

  // Electricity
  const [meterId, setMeterId] = useState(meters[0]?.id ?? "");
  const [reading, setReading] = useState("");

  // Diesel
  const [dieselAmount, setDieselAmount] = useState("");
  const [dieselLitres, setDieselLitres] = useState("");

  // Genset
  const [dipStick, setDipStick] = useState("");
  const [fuelPct, setFuelPct] = useState("");
  const [externalTank, setExternalTank] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  async function handleSubmit() {
    setError(null);
    setMessage(null);
    setSaving(true);

    try {
      if (meterId && reading.trim() !== "") {
        const newReading = Number(reading);

        // Block entering a reading lower than the most recent prior reading for this meter.
        const { data: prior, error: priorError } = await supabase
          .from("electricity_readings")
          .select("date, reading")
          .eq("meter_id", meterId)
          .lt("date", date)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (priorError) throw priorError;

        if (prior && newReading < prior.reading) {
          throw new Error(
            `Reading can't be less than the previous reading (${prior.reading} on ${prior.date}). You entered ${newReading}.`
          );
        }

        const { error: e1 } = await supabase.from("electricity_readings").upsert(
          {
            branch_id: branchId,
            meter_id: meterId,
            date,
            reading: newReading,
            submitted_by: userId,
          },
          { onConflict: "meter_id,date" }
        );
        if (e1) throw e1;
      }

      if (dieselAmount.trim() !== "" || dieselLitres.trim() !== "") {
        const { error: e2 } = await supabase.from("diesel_purchases").insert({
          branch_id: branchId,
          date,
          amount: dieselAmount.trim() === "" ? null : Number(dieselAmount),
          litres: dieselLitres.trim() === "" ? null : Number(dieselLitres),
          submitted_by: userId,
        });
        if (e2) throw e2;
      }

      if (dipStick.trim() !== "" || fuelPct.trim() !== "" || externalTank.trim() !== "") {
        const { error: e3 } = await supabase.from("genset_readings").insert({
          branch_id: branchId,
          date,
          dip_stick_measure: dipStick.trim() === "" ? null : Number(dipStick),
          fuel_tank_fill_pct: fuelPct.trim() === "" ? null : Number(fuelPct),
          external_tank: externalTank.trim() === "" ? null : Number(externalTank),
          submitted_by: userId,
        });
        if (e3) throw e3;
      }

      setMessage("Submitted.");
      setDieselAmount("");
      setDieselLitres("");
      setDipStick("");
      setFuelPct("");
      setExternalTank("");
      setReading("");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 space-y-1">
        <label className="text-sm font-medium">Date</label>
        <input type="date" className="input max-w-xs" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Electricity</h2>
        {meters.length === 0 ? (
          <p className="text-sm text-grey">No meters configured for this branch.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <select className="input" value={meterId} onChange={(e) => setMeterId(e.target.value)}>
              {meters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.meter_number}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Meter reading"
              className="input"
              value={reading}
              onChange={(e) => setReading(e.target.value)}
            />
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Diesel Purchase</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            className="input"
            value={dieselAmount}
            onChange={(e) => setDieselAmount(e.target.value)}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Litres"
            className="input"
            value={dieselLitres}
            onChange={(e) => setDieselLitres(e.target.value)}
          />
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Genset</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-grey">Dip Stick Measure</label>
            <input
              type="number"
              step="0.01"
              placeholder="Dip Stick Measure"
              className="input"
              value={dipStick}
              onChange={(e) => setDipStick(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-grey">Fuel Tank Fill %</label>
            <input
              type="number"
              step="0.01"
              placeholder="Fuel Tank Fill %"
              className="input"
              value={fuelPct}
              onChange={(e) => setFuelPct(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">External Tank</h2>
        <div className="space-y-1 max-w-xs">
          <label className="text-xs text-grey">External Tank</label>
          <input
            type="number"
            step="0.01"
            placeholder="External Tank"
            className="input"
            value={externalTank}
            onChange={(e) => setExternalTank(e.target.value)}
          />
        </div>
      </section>

      {error && <p className="text-sm text-red">{error}</p>}
      {message && <p className="text-sm text-green">{message}</p>}

      <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
        {saving ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}