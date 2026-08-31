import { Link } from "react-router-dom";
import type { ThermalAnomaly } from "../../types/anomaly";

interface RecentAlertsProps {
  alerts: ThermalAnomaly[];
}

const SEVERITY_STYLES = {
  critical: "border-red-500/20 bg-red-500/10 text-red-400",
  high: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  medium: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  low: "border-slate-700 bg-slate-800 text-slate-400",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);

  if (diffHr < 24) return `${diffHr}h ago`;

  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSeverity(anomaly: ThermalAnomaly) {
  if (anomaly.status === "active") {
    return anomaly.confidence >= 90 ? "critical" : "high";
  }

  if (anomaly.confidence >= 80) {
    return "medium";
  }

  return "low";
}

function getClassificationLabel(
  classification: ThermalAnomaly["classification"]
): string {
  switch (classification) {
    case "industrial_fire":
      return "Industrial Fire";
    case "wildfire":
      return "Wildfire";
    case "agricultural_burn":
      return "Agricultural Burn";
    case "gas_flare":
      return "Gas Flare";
    case "mining":
      return "Mining";
    case "non_industrial":
      return "Non-Industrial";
    case "unknown":
      return "Unknown";
    default:
      return "Other";
  }
}

export function RecentAlerts({ alerts }: RecentAlertsProps) {
  const recentAlerts = [...alerts]
    .sort(
      (a, b) =>
        new Date(b.detectedAt).getTime() -
        new Date(a.detectedAt).getTime()
    )
    .slice(0, 5);

  return (
    <section
      aria-labelledby="recent-alerts-heading"
      className="rounded-md border border-slate-800 bg-slate-900"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2
          id="recent-alerts-heading"
          className="text-xs font-semibold uppercase tracking-widest text-slate-200"
        >
          Recent Alerts
        </h2>

        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
          {recentAlerts.length} shown
        </span>
      </div>

      <ul className="divide-y divide-slate-800">
        {recentAlerts.map((anomaly) => {
          const severity = getSeverity(anomaly);

          return (
            <li key={anomaly.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={[
                    "inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    SEVERITY_STYLES[severity],
                  ].join(" ")}
                >
                  {severity}
                </span>

                <time
                  dateTime={anomaly.detectedAt}
                  className="shrink-0 text-[11px] tabular-nums text-slate-500"
                >
                  {formatTime(anomaly.detectedAt)}
                </time>
              </div>

              <h3 className="mt-2 text-sm font-medium leading-snug text-slate-100">
                {getClassificationLabel(anomaly.classification)}
              </h3>

              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                Hotspot {anomaly.id} detected with{" "}
                {anomaly.confidence.toFixed(0)}% model confidence.
              </p>

              <p className="mt-1.5 text-[11px] tabular-nums text-slate-500">
                Hotspot {anomaly.id} · FRP {anomaly.frp.toFixed(1)} MW
              </p>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-slate-800 px-4 py-2.5">
        <Link
          to="/alerts"
          className="text-xs font-medium text-slate-400 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
        >
          View all alerts →
        </Link>
      </div>
    </section>
  );
}