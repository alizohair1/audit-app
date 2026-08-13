"use client";

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function BranchTrendCharts({
  dieselTrend,
  fuelTrend,
  rangeLabel = "14 days",
}: {
  dieselTrend: { date: string; litres: number }[];
  fuelTrend: { date: string; pct: number }[];
  rangeLabel?: string;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <h2 className="font-semibold text-ink mb-1">Diesel purchased ({rangeLabel})</h2>
        <p className="text-xs text-grey mb-2">Litres per day</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dieselTrend} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7a8088" }} />
            <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} />
            <Tooltip />
            <Bar dataKey="litres" fill="#2f6ea5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card p-5">
        <h2 className="font-semibold text-ink mb-1">Genset fuel tank % ({rangeLabel})</h2>
        <p className="text-xs text-grey mb-2">Latest reading each day</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={fuelTrend} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7a8088" }} />
            <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="pct" stroke="#c07a1f" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
