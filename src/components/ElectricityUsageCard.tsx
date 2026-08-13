"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface MeterRow {
  meterNumber: string;
  latestDate: string | null;
  latestReading: number | null;
  previousReading: number | null;
  consumed: number | null;
}

export default function ElectricityUsageCard({
  meterRows,
  trend,
  title = "Electricity usage",
}: {
  meterRows: MeterRow[];
  trend: { date: string; consumed: number }[];
  title?: string;
}) {
  const hasTrend = trend.some((t) => t.consumed !== 0);

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-ink mb-1">{title}</h2>
        <p className="text-xs text-grey">Units consumed = latest reading − previous reading, per meter</p>
      </div>

      {meterRows.length === 0 ? (
        <p className="text-sm text-grey py-4">No meters configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-grey border-b border-line">
                <th className="py-2 pr-3">Meter</th>
                <th className="py-2 pr-3">Latest</th>
                <th className="py-2 pr-3">Previous</th>
                <th className="py-2 pr-3">Consumed</th>
              </tr>
            </thead>
            <tbody>
              {meterRows.map((m) => (
                <tr key={m.meterNumber} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 font-medium">{m.meterNumber}</td>
                  <td className="py-2 pr-3">
                    {m.latestReading != null ? m.latestReading : "—"}
                    {m.latestDate && <span className="text-grey text-xs ml-1">({m.latestDate.slice(5)})</span>}
                  </td>
                  <td className="py-2 pr-3">{m.previousReading != null ? m.previousReading : "—"}</td>
                  <td className="py-2 pr-3 font-semibold text-accent">
                    {m.consumed != null ? m.consumed : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <p className="text-xs text-grey mb-2">Total units consumed per day</p>
        {hasTrend ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7a8088" }} />
              <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} />
              <Tooltip />
              <Bar dataKey="consumed" fill="#2f5d50" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-grey py-4 text-center">Not enough readings yet to show a trend.</p>
        )}
      </div>
    </div>
  );
}
