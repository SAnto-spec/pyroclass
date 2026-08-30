import { useMemo } from "react";
import { OctagonAlert, TriangleAlert, CircleAlert, MinusCircle, Clock3, Factory, CheckSquare, Square } from "lucide-react";
import type { Alert, AlertSeverity } from "../../types/alert";
import type { ThermalAnomaly } from "../../types/anomaly";

interface Props {
  alerts: Alert[];
  anomalyById: Map<string, ThermalAnomaly>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  // bulk
  bulkSelected: Set<string>;
  onToggleBulk: (id: string) => void;
  onToggleAll: () => void;
}

const severityCfg: Record<AlertSeverity, { label: string; icon: React.ElementType; cls: string }> = {
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
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function AlertQueue({ alerts, anomalyById, selectedId, onSelect, onOpen, bulkSelected, onToggleBulk, onToggleAll }: Props) {
  const groups = useMemo(() => {
    const active = alerts.filter((a) => a.status === "active");
    const ack = alerts.filter((a) => a.status === "acknowledged");
    const resolved = alerts.filter((a) => a.status === "resolved");
    return [
      { key: "active" as const, label: "Active", count: active.length, items: active, accent: "text-[var(--critical-text)]" },
      { key: "acknowledged" as const, label: "Acknowledged", count: ack.length, items: ack, accent: "text-[var(--text-secondary)]" },
      { key: "resolved" as const, label: "Resolved", count: resolved.length, items: resolved, accent: "text-[var(--text-faint)]" },
    ];
  }, [alerts]);

  const allIds = alerts.map((a) => a.id);
  const isAllSelected = allIds.length > 0 && allIds.every((id) => bulkSelected.has(id));

  if (alerts.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-6 py-10 text-center">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">No alerts match filters</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Try widening time, region, or alert filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
      {/* Bulk bar */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
        <button
          type="button"
          onClick={onToggleAll}
          aria-label={isAllSelected ? "Deselect all" : "Select all"}
          className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
        >
          {isAllSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          {bulkSelected.size > 0 ? `${bulkSelected.size} selected` : "Select"}
        </button>
        <span className="text-[11px] text-[var(--text-faint)] tabular-nums">{alerts.length} alerts</span>
        <span className="ml-auto text-[11px] text-[var(--text-faint)] hidden sm:inline">Shift+click map to focus</span>
      </div>

      <div className="max-h-[560px] overflow-y-auto">
        {groups.map((g) => {
          if (g.items.length === 0) return null;
          return (
            <div key={g.key}>
              <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-1.5">
                <span className={`text-[11px] font-semibold tracking-[0.04em] ${g.accent}`}>{g.label}</span>
                <span className="rounded-[4px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[11px] font-medium leading-none text-[var(--text-secondary)] tabular-nums">
                  {g.count}
                </span>
              </div>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {g.items.map((al) => {
                  const an = anomalyById.get(al.anomalyId);
                  const cfg = severityCfg[al.severity];
                  const Icon = cfg.icon;
                  const isSelected = al.id === selectedId;
                  const isBulk = bulkSelected.has(al.id);
                  return (
                    <li key={al.id} className={isSelected ? "bg-[var(--accent-weak)]" : ""}>
                      <div className="flex">
                        <button
                          type="button"
                          aria-label={isBulk ? "Deselect" : "Select"}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleBulk(al.id);
                          }}
                          className="flex shrink-0 items-start px-2 py-3 text-[var(--text-faint)] hover:text-[var(--text-secondary)]"
                        >
                          {isBulk ? <CheckSquare className="h-4 w-4 text-[var(--text-primary)]" /> : <Square className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(al.id);
                            onOpen(al.id);
                          }}
                          onFocus={() => onSelect(al.id)}
                          className={`flex flex-1 flex-col gap-1 px-0 py-2.5 pr-3 text-left hover:bg-[var(--surface-subtle)] ${isSelected ? "bg-[var(--accent-weak)]" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${cfg.cls}`}>
                              <Icon className="h-3 w-3" /> {cfg.label}
                            </span>
                            <span className="ml-auto inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--text-faint)]">
                              <Clock3 className="h-3 w-3" /> {fmtAge(al.createdAt)}
                            </span>
                          </div>
                          <p className="line-clamp-1 text-[13px] font-medium leading-snug text-[var(--text-primary)]">{al.title}</p>
                          <p className="flex flex-wrap items-center gap-1 text-[11px] text-[var(--text-muted)]">
                            <span className="font-mono font-medium text-[var(--text-secondary)]">{al.id}</span>
                            <span className="text-[var(--text-faint)]">·</span>
                            <span className="font-mono">{al.anomalyId}</span>
                            {an ? (
                              <>
                                <span className="hidden sm:inline text-[var(--text-faint)]">·</span>
                                <span className="hidden sm:inline-flex items-center gap-1">
                                  <Factory className="h-3 w-3 text-[var(--text-faint)]" />
                                  {an.nearbyFacility ? `${an.nearbyFacility.name} · ${an.nearbyFacility.distanceKm} km` : an.region}
                                </span>
                                <span className="hidden sm:inline text-[var(--text-faint)]">·</span>
                                <span className="hidden sm:inline">
                                  {an.classification.replace("_", " ")} · {an.confidence}% · {an.frp.toFixed(1)} MW
                                </span>
                              </>
                            ) : null}
                          </p>
                          <p className="flex items-center gap-1 text-[11px] text-[var(--text-faint)]">
                            <span className={`h-1.5 w-1.5 rounded-full ${al.severity === "critical" ? "bg-[var(--critical)]" : al.severity === "high" ? "bg-[var(--high)]" : al.severity === "medium" ? "bg-[var(--medium)]" : "bg-[var(--low)]"}`} />
                            Unassigned · {al.status === "active" ? "Needs triage" : al.status === "acknowledged" ? "In progress" : "Resolved"}
                          </p>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
