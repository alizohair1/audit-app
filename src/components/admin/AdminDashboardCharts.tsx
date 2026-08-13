"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface JobAvg {
  name: string;
  avgPct: number;
}
interface DayCount {
  date: string;
  count: number;
}
interface BranchCompletion {
  name: string;
  done: number;
  total: number;
}

export function JobAverageChart({ data }: { data: JobAvg[] }) {
  if (data.length === 0) {
    return <EmptyState text="No audit submissions yet — averages will appear once auditors start submitting." />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7a8088" }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} domain={[0, 100]} />
        <Tooltip formatter={(v: number) => [`${v}%`, "Avg"]} />
        <Bar dataKey="avgPct" fill="#2f5d50" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SubmissionsTrendChart({ data }: { data: DayCount[] }) {
  if (data.every((d) => d.count === 0)) {
    return <EmptyState text="No submissions in the last 14 days yet." />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#7a8088" }} />
        <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#2f5d50" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BranchCompletionList({ data }: { data: BranchCompletion[] }) {
  if (data.length === 0) {
    return <EmptyState text="No branches yet." />;
  }
  return (
    <div className="space-y-3">
      {data.map((b) => {
        const pct = b.total > 0 ? Math.round((b.done / b.total) * 100) : 0;
        return (
          <div key={b.name}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-ink">{b.name}</span>
              <span className="text-grey">
                {b.done}/{b.total} jobs
              </span>
            </div>
            <div className="h-2 rounded-full clay-progress-track overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct === 100 ? "#2f7d4f" : pct === 0 ? "#e2e5ea" : "#c07a1f",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-grey py-8 text-center">{text}</p>;
}

export function BranchConsumptionChart({ data }: { data: { name: string; consumed: number }[] }) {
  if (data.every((d) => d.consumed === 0)) {
    return <EmptyState text="Not enough meter readings yet to show consumption." />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5ea" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7a8088" }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fill: "#7a8088" }} />
        <Tooltip formatter={(v: number) => [`${v} units`, "Consumed"]} />
        <Bar dataKey="consumed" fill="#2f6ea5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
