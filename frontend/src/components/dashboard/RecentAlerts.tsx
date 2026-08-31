import { Link } from "react-router-dom";
import type { ThermalAnomaly } from "../../types/anomaly";
import type { Alert } from "../../types/alert";

type RecentAlertItem = ThermalAnomaly | Alert;

interface RecentAlertsProps {
  alerts: RecentAlertItem[];
  selectedAnomalyId?: string | null;
  onAlertSelect?: (anomalyId: string) => void;
}

const SEVERITY_STYLES = {
  critical: "border-red-500/20 bg-red-500/10 text-red-400",
  high: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  medium: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  low: "border-slate-700 bg-slate-800 text-slate-400",
} as const;

function isAlert(item: RecentAlertItem): item is Alert {
  return "anomalyId" in item && "title" in item && "description" in item;
}

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

function getSeverity(item: RecentAlertItem): "critical" | "high" | "medium" | "low" {
  if (isAlert(item)) {
    return item.severity;
  }

  if (item.status === "active") {
    return item.confidence >= 90 ? "critical" : "high";
  }

  if (item.confidence >= 80) {
    return "medium";
  }

  return "low";
}

function getClassificationLabel(classification: ThermalAnomaly["classification"]): string {
  switch (classification) {
    case "industrial_fire": return "Industrial Fire";
    case "wildfire": return "Wildfire";
    case "agricultural_burn": return "Agricultural Burn";
    case "gas_flare": return "Gas Flare";
    case "mining": return "Mining";
    case "non_industrial": return "Non-Industrial";
    case "unknown": return "Unknown";
    default: return "Other";
  }
}

function getItemId(item: RecentAlertItem): string {
  return isAlert(item) ? item.anomalyId : item.id;
}

function getItemTitle(item: RecentAlertItem): string {
  if (isAlert(item)) return item.title;
  return getClassificationLabel(item.classification);
}

function getItemDescription(item: RecentAlertItem): string {
  if (isAlert(item)) return item.description;
  return `Hotspot ${item.id} detected with ${item.confidence.toFixed(0)}% model confidence.`;
}

function getItemTimestamp(item: RecentAlertItem): string {
  if (isAlert(item)) return item.createdAt;
  return item.detectedAt;
}

function getItemMeta(item: RecentAlertItem): string {
  if (isAlert(item)) return `${item.id} · ${item.anomalyId}`;
  return `Hotspot ${item.id} · FRP ${item.frp.toFixed(1)} MW`;
}

export function RecentAlerts({ alerts, selectedAnomalyId, onAlertSelect }: RecentAlertsProps) {
  const recentAlerts = [...alerts]
    .sort((a, b) => {
      const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDelta = severityRank[getSeverity(a)] - severityRank[getSeverity(b)];
      if (severityDelta !== 0) return severityDelta;
      return new Date(getItemTimestamp(b)).getTime() - new Date(getItemTimestamp(a)).getTime();
    })
    .slice(0, 5);

  return (
    <section aria-labelledby="recent-alerts-heading" className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
        <h2 id="recent-alerts-heading" className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
          Priority queue
        </h2>
        <span className="rounded-[4px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
          {recentAlerts.length} shown
        </span>
      </div>

      <ul className="divide-y divide-[var(--border-subtle)]">
        {recentAlerts.map((item) => {
          const severity = getSeverity(item);
          const itemId = getItemId(item);
          const isSelected = selectedAnomalyId === itemId;

          return (
            <li key={isAlert(item) ? item.id : item.id} className={isSelected ? "bg-[var(--accent-weak)]" : ""}>
              <button
                type="button"
                onClick={() => onAlertSelect?.(itemId)}
                className={`group flex w-full flex-col px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:bg-[var(--surface-subtle)] ${isSelected ? "bg-[var(--accent-weak)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={["inline-flex shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", SEVERITY_STYLES[severity]].join(" ")}>
                    {severity}
                  </span>

                  <time dateTime={getItemTimestamp(item)} className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {formatTime(getItemTimestamp(item))}
                  </time>
                </div>

                <h3 className="mt-2 text-sm font-medium leading-snug text-[var(--text-primary)]">
                  {getItemTitle(item)}
                </h3>

                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
                  {getItemDescription(item)}
                </p>

                <p className="mt-1.5 text-[11px] tabular-nums text-[var(--text-faint)]">
                  {getItemMeta(item)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
        <Link to="/alerts" className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-[4px] px-1 -mx-1">
          View queue →
        </Link>
      </div>
    </section>
  );
}