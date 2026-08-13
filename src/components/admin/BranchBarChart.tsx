"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function BranchBarChart({
  data,
  color,
  unit,
  emptyText,
}: {
  data: { name: string; value: number }[];
  color: string;
  unit: string;
  emptyText: string;
}) {
  if (data.every((d) => d.value === 0)) {
    return <p className="text-sm text-grey py-8 text-center">{emptyText}</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7a8088" }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} />
        <Tooltip formatter={(v: number) => [`${v} ${unit}`, ""]} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
