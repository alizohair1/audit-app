"use client";

import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BranchMeter } from "@/types/database.types";

/** Local calendar date (YYYY-MM-DD) — not UTC, so it doesn't roll back a day after midnight in UTC+5. */
function todayStr() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

interface PriorReading {
  reading: number;
  date: string;
}

/** Blank -> null. Otherwise a number >= 0 (and <= max if given), or throws a readable error. */
function parseDecimal(raw: string, label: string, max?: number): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) throw new Error(`${label} must be a number of 0 or more.`);
  if (max !== undefined && n > max) throw new Error(`${label} can't be more than ${max}.`);
  return n;
}

/** Number input with a unit sign shown inside the field (m, %, h, min...). */
function UnitInput({
  unit,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { unit: string; invalid?: boolean }) {
  return (
    <div className="relative">
      <input
        {...props}
        className="input"
        style={{
          paddingRight: "3.25rem",
          ...(invalid ? { borderColor: "#b23b3b" } : {}),
        }}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-grey pointer-events-none">
        {unit}
      </span>
    </div>
  );
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

  // Electricity: one input per meter, keyed by meter id
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [previous, setPrevious] = useState<Record<string, PriorReading>>({});
  const [meterErrors, setMeterErrors] = useState<Record<string, string>>({});

  // Diesel
  const [dieselAmount, setDieselAmount] = useState("");
  const [dieselLitres, setDieselLitres] = useState("");

  // Genset
  const [dipStick, setDipStick] = useState(""); // metres
  const [fuelPct, setFuelPct] = useState(""); // percent
  const [gensetHours, setGensetHours] = useState(""); // digital genset meter, hours part
  const [gensetMinutes, setGensetMinutes] = useState(""); // digital genset meter, minutes part

  // External tank
  const [externalTank, setExternalTank] = useState(""); // metres

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When the date changes: load each meter's previous reading (for the hint + validation)
  // and prefill anything already entered for that date.
  useEffect(() => {
    if (meters.length === 0) return;
    let cancelled = false;

    (async () => {
      const { data, error: loadError } = await supabase
        .from("electricity_readings")
        .select("meter_id, date, reading")
        .in(
          "meter_id",
          meters.map((m) => m.id)
        )
        .lte("date", date)
        .order("date", { ascending: false })
        .limit(500);

      if (cancelled || loadError) return;

      const prev: Record<string, PriorReading> = {};
      const sameDay: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        if (r.date === date) {
          if (sameDay[r.meter_id] === undefined) sameDay[r.meter_id] = String(r.reading);
        } else if (!prev[r.meter_id]) {
          prev[r.meter_id] = { reading: Number(r.reading), date: r.date };
        }
      });
      setPrevious(prev);
      setReadings(sameDay);
      setMeterErrors({});
    })();

    return () => {
      cancelled = true;
    };
  }, [date, meters, supabase]);

  async function handleSubmit() {
    setError(null);
    setMessage(null);

    // ---------- Validate everything first; nothing is saved unless all of it passes ----------
    const meterRows: { meter_id: string; reading: number }[] = [];
    const errs: Record<string, string> = {};
    meters.forEach((m) => {
      const raw = (readings[m.id] ?? "").trim();
      if (raw === "") return; // untouched meters are skipped
      const value = Number(raw);
      if (Number.isNaN(value) || value < 0) {
        errs[m.id] = "Enter a valid reading.";
        return;
      }
      const prior = previous[m.id];
      if (prior && value < prior.reading) {
        errs[m.id] = `Can't be less than the previous reading (${prior.reading} on ${prior.date}).`;
        return;
      }
      meterRows.push({ meter_id: m.id, reading: value });
    });
    setMeterErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Fix the highlighted meter readings and try again.");
      return;
    }

    let amount: number | null;
    let litres: number | null;
    let dip: number | null;
    let fuel: number | null;
    let external: number | null;
    let gensetMeterMinutes: number | null = null;
    try {
      amount = parseDecimal(dieselAmount, "Diesel amount");
      litres = parseDecimal(dieselLitres, "Diesel litres");
      dip = parseDecimal(dipStick, "Dip stick measure");
      fuel = parseDecimal(fuelPct, "Fuel tank fill %", 100);
      external = parseDecimal(externalTank, "External tank");

      if (gensetHours.trim() !== "" || gensetMinutes.trim() !== "") {
        const h = gensetHours.trim() === "" ? 0 : Number(gensetHours);
        const mi = gensetMinutes.trim() === "" ? 0 : Number(gensetMinutes);
        if (!Number.isInteger(h) || h < 0) throw new Error("Digital genset meter: hours must be a whole number.");
        if (!Number.isInteger(mi) || mi < 0 || mi > 59)
          throw new Error("Digital genset meter: minutes must be a whole number from 0 to 59.");
        gensetMeterMinutes = h * 60 + mi;
      }
    } catch (e: any) {
      setError(e.message);
      return;
    }

    const hasDiesel = amount !== null || litres !== null;
    const hasGenset = dip !== null || fuel !== null || gensetMeterMinutes !== null;
    const hasExternal = external !== null;

    if (meterRows.length === 0 && !hasDiesel && !hasGenset && !hasExternal) {
      setError("Nothing to submit — enter at least one value.");
      return;
    }

    // ---------- Save ----------
    setSaving(true);
    try {
      if (meterRows.length > 0) {
        const { error: e1 } = await supabase.from("electricity_readings").upsert(
          meterRows.map((r) => ({
            branch_id: branchId,
            meter_id: r.meter_id,
            date,
            reading: r.reading,
            submitted_by: userId,
          })),
          { onConflict: "meter_id,date" }
        );
        if (e1) throw e1;
      }

      if (hasDiesel) {
        const { error: e2 } = await supabase.from("diesel_purchases").insert({
          branch_id: branchId,
          date,
          amount,
          litres,
          submitted_by: userId,
        });
        if (e2) throw e2;
      }

      if (hasGenset || hasExternal) {
        const { error: e3 } = await supabase.from("genset_readings").insert({
          branch_id: branchId,
          date,
          dip_stick_measure: dip,
          fuel_tank_fill_pct: fuel,
          external_tank: external,
          genset_meter_minutes: gensetMeterMinutes,
          submitted_by: userId,
        });
        if (e3) throw e3;
      }

      setMessage("Submitted.");
      setDieselAmount("");
      setDieselLitres("");
      setDipStick("");
      setFuelPct("");
      setGensetHours("");
      setGensetMinutes("");
      setExternalTank("");
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

      <section className="card p-4 space-y-4">
        <h2 className="font-semibold">Electricity</h2>
        {meters.length === 0 ? (
          <p className="text-sm text-grey">No meters configured for this branch.</p>
        ) : (
          <div className="space-y-4">
            {meters.map((m) => {
              const prior = previous[m.id];
              const err = meterErrors[m.id];
              return (
                <div key={m.id} className="grid sm:grid-cols-2 gap-2 sm:gap-4 sm:items-start">
                  <div>
                    <p className="text-sm font-medium text-ink">Meter {m.meter_number}</p>
                    <p className="text-xs text-grey">
                      {prior ? `Previous: ${prior.reading} (${prior.date})` : "No previous reading"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      placeholder="Meter reading"
                      className="input"
                      style={err ? { borderColor: "#b23b3b" } : undefined}
                      value={readings[m.id] ?? ""}
                      onChange={(e) => setReadings((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    />
                    {err && <p className="text-xs text-red">{err}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Diesel Purchase</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-grey">Amount</label>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              placeholder="Amount"
              className="input"
              value={dieselAmount}
              onChange={(e) => setDieselAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-grey">Litres</label>
            <UnitInput
              unit="L"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              placeholder="Litres"
              value={dieselLitres}
              onChange={(e) => setDieselLitres(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">Genset</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-grey">Dip Stick Measure</label>
            <UnitInput
              unit="m"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              placeholder="e.g. 0.45"
              value={dipStick}
              onChange={(e) => setDipStick(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-grey">Fuel Tank Fill</label>
            <UnitInput
              unit="%"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              max={100}
              placeholder="e.g. 62.5"
              value={fuelPct}
              onChange={(e) => setFuelPct(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-grey">Digital Genset Meter</label>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <UnitInput
              unit="h"
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              placeholder="Hours"
              value={gensetHours}
              onChange={(e) => setGensetHours(e.target.value)}
            />
            <UnitInput
              unit="min"
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              max={59}
              placeholder="Minutes"
              value={gensetMinutes}
              onChange={(e) => setGensetMinutes(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="font-semibold">External Tank</h2>
        <div className="space-y-1 max-w-xs">
          <label className="text-xs text-grey">External Tank</label>
          <UnitInput
            unit="m"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            placeholder="e.g. 1.20"
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
