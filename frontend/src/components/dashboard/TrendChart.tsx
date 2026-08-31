import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ThermalAnomaly } from "../../types/anomaly";

interface TrendChartProps {
  anomalies: ThermalAnomaly[];
}

export function TrendChart({ anomalies }: TrendChartProps) {
  const data = useMemo(() => {
    // group by date YYYY-MM-DD
    const map = new Map<string, { count: number; totalFrp: number }>();
    for (const a of anomalies) {
      const d = new Date(a.detectedAt).toISOString().slice(0, 10);
      const cur = map.get(d) ?? { count: 0, totalFrp: 0 };
      cur.count += 1;
      cur.totalFrp += a.frp;
      map.set(d, cur);
    }
    const sorted = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-14); // last 14 days

    return sorted.map(([date, v]) => ({
      date: new Date(date).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      count: v.count,
      avgFrp: v.count ? Number((v.totalFrp / v.count).toFixed(1)) : 0,
      totalFrp: Number(v.totalFrp.toFixed(1)),
    }));
  }, [anomalies]);

  if (data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-[11px] text-[var(--text-muted)]">
        No detections in selected range
      </div>
    );
  }

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--text-faint)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-faint)" }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 11,
              boxShadow: "var(--shadow-md)",
            }}
            labelStyle={{ color: "var(--text-secondary)", fontSize: 11 }}
            formatter={(value, name) => {
              const label = name === "count" ? "Detections" : name === "avgFrp" ? "Avg FRP (MW)" : String(name);
              return [value as number, label];
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#475569"
            fill="rgba(71, 85, 105, 0.08)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#0f172a", stroke: "white", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="avgFrp"
            stroke="#d97706"
            fill="rgba(217, 119, 6, 0.06)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-center gap-3 text-[10px] text-[var(--text-faint)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#475569]" /> Detections
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Avg FRP
        </span>
      </div>
    </div>
  );
}
