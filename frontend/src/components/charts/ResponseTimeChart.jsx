import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ResponseTimeChart({ series }) {
  if (!series?.length) {
    return <div className="grid h-72 place-items-center text-sm text-slate-500">No response-time data in this range.</div>;
  }

  const data = series.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(point.timestamp)),
  }));

  return (
    <div className="h-72 w-full" aria-label="Response time chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 8 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} minTickGap={32} />
          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" ms" />
          <Tooltip
            contentStyle={{ background: "#020617", border: "1px solid #334155", borderRadius: 12 }}
            formatter={(value) => [`${value} ms`, "Average response"]}
          />
          <Line type="monotone" dataKey="averageResponseTimeMs" stroke="#34d399" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
