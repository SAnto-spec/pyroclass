import { useNavigate } from "react-router-dom";
import { OctagonAlert, TriangleAlert, CircleAlert, MinusCircle, X, Clock3 } from "lucide-react";
import type { Alert } from "../../types/alert";
import { mockAlerts } from "../../mocks/alerts";

interface Props {
  open: boolean;
  onClose: () => void;
}

const cfg: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  critical: { label: "Critical", icon: OctagonAlert, cls: "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" },
  high: { label: "High", icon: TriangleAlert, cls: "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]" },
  medium: { label: "Medium", icon: CircleAlert, cls: "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]" },
  low: { label: "Low", icon: MinusCircle, cls: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]" },
};

function fmtAge(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function NotificationsPopover({ open, onClose }: Props) {
  const navigate = useNavigate();
  if (!open) return null;

  const active = mockAlerts.filter((a) => a.status === "active");
  const recent = [...active].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Notifications">
      <button type="button" aria-label="Close notifications" onClick={onClose} className="absolute inset-0 bg-transparent" />
      <div className="absolute right-2 top-[52px] z-50 w-[360px] max-w-[calc(100vw-16px)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-lg)] sm:right-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
          <div>
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">Notifications</p>
            <p className="text-[11px] text-[var(--text-muted)] tabular-nums" aria-live="polite">
              {active.length} active · {recent.filter((a) => a.severity === "critical" || a.severity === "high").length} critical/high
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-[var(--text-muted)]">No active alerts</p>
          ) : (
            recent.map((al: Alert) => {
              const c = cfg[al.severity];
              const Icon = c.icon;
              return (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/alerts?alert=${al.id}`);
                  }}
                  className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-[var(--surface-subtle)]"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold ${c.cls}`}>
                      <Icon className="h-3 w-3" /> {c.label}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--text-faint)]">
                      <Clock3 className="h-3 w-3" /> {fmtAge(al.createdAt)}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-[13px] font-medium leading-snug text-[var(--text-primary)]">{al.title}</p>
                  <p className="line-clamp-1 text-[11px] text-[var(--text-muted)]">{al.id} · {al.anomalyId}</p>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
          <span className="text-[10px] text-[var(--text-faint)]">Current data · not live push</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/alerts");
            }}
            className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            View all alerts →
          </button>
        </div>
      </div>
    </div>
  );
}
