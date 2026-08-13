"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PALETTE = ["#2f5d50", "#2f6ea5", "#c07a1f", "#b23b3b", "#7a8088", "#8a5fb0", "#3a8f7a"];

export default function ScoreTrendChart({
  data,
  branchNames,
}: {
  data: Record<string, string | number>[];
  branchNames: string[];
}) {
  if (data.length === 0 || branchNames.length === 0) {
    return <p className="text-sm text-grey py-8 text-center">Not enough submissions yet to show a trend.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7a8088" }} />
        <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} domain={[0, 100]} />
        <Tooltip formatter={(v: number) => [`${v}%`, ""]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {branchNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
