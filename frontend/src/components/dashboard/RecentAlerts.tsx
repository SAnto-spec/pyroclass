import { Link } from "react-router-dom";
import { OctagonAlert, TriangleAlert, CircleAlert, MinusCircle } from "lucide-react";
import type { Alert, AlertSeverity } from "../../types/alert";

interface RecentAlertsProps {
  alerts: Alert[];
  selectedAnomalyId?: string | null;
  onAlertSelect?: (anomalyId: string) => void;
}

const SEVERITY_CFG: Record<
  AlertSeverity,
  { label: string; icon: React.ElementType; cls: string; dot: string }
> = {
  critical: {
    label: "Critical",
    icon: OctagonAlert,
    cls: "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]",
    dot: "bg-[var(--critical)]",
  },
  high: {
    label: "High",
    icon: TriangleAlert,
    cls: "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]",
    dot: "bg-[var(--high)]",
  },
  medium: {
    label: "Medium",
    icon: CircleAlert,
    cls: "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]",
    dot: "bg-[var(--medium)]",
  },
  low: {
    label: "Low",
    icon: MinusCircle,
    cls: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]",
    dot: "bg-[var(--low)]",
  },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date(Date.now());
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

export function RecentAlerts({ alerts, selectedAnomalyId, onAlertSelect }: RecentAlertsProps) {
  // priority order: critical > high > medium > low
  const order: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...alerts].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <section
      aria-labelledby="recent-alerts-heading"
      className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
        <h2
          id="recent-alerts-heading"
          className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]"
        >
          Priority queue
        </h2>
        <span className="rounded-[4px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[11px] font-medium leading-none text-[var(--text-secondary)]">
          {alerts.length} active
        </span>
      </div>

      <ul className="divide-y divide-[var(--border-subtle)]">
        {sorted.map((alert) => {
          const cfg = SEVERITY_CFG[alert.severity];
          const Icon = cfg.icon;
          const isSelected = selectedAnomalyId === alert.anomalyId;
          return (
            <li key={alert.id} className={isSelected ? "bg-[var(--accent-weak)]" : ""}>
              <button
                type="button"
                onClick={() => onAlertSelect?.(alert.anomalyId)}
                className={`group flex w-full flex-col px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:bg-[var(--surface-subtle)] ${isSelected ? "bg-[var(--accent-weak)]" : ""}`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-[4px] border px-1 py-0.5 text-[10px] font-semibold leading-none ${cfg.cls}`}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {cfg.label}
                  </span>
                  <time
                    dateTime={alert.createdAt}
                    className="shrink-0 text-[11px] tabular-nums text-[var(--text-faint)]"
                  >
                    {formatTime(alert.createdAt)}
                  </time>
                </div>
                <h3 className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-[var(--text-primary)]">
                  {alert.title}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  {alert.description}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] tabular-nums text-[var(--text-faint)]">
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
                  {alert.id} · {alert.anomalyId}
                  {isSelected && <span className="ml-auto text-[10px] font-medium text-[var(--accent-muted)]">● selected</span>}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
        <Link
          to="/alerts"
          className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-[4px] px-1 -mx-1"
        >
          View queue →
        </Link>
      </div>
    </section>
  );
}
