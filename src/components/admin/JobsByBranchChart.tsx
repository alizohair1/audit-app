"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const PALETTE = ["#2f5d50", "#2f6ea5", "#c07a1f", "#b23b3b", "#7a8088", "#8a5fb0", "#3a8f7a"];

export default function JobsByBranchChart({
  data,
  branchNames,
}: {
  data: Record<string, string | number>[];
  branchNames: string[];
}) {
  if (data.length === 0 || branchNames.length === 0) {
    return <p className="text-sm text-grey py-8 text-center">No submissions in this range yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
        <XAxis dataKey="job" tick={{ fontSize: 11, fill: "#7a8088" }} interval={0} angle={-20} textAnchor="end" height={70} />
        <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} domain={[0, 100]} />
        <Tooltip formatter={(v: number) => [`${v}%`, ""]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {branchNames.map((name, i) => (
          <Bar key={name} dataKey={name} fill={PALETTE[i % PALETTE.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
