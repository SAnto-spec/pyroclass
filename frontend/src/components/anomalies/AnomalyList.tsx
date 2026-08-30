import { useEffect, useRef } from "react";
import { Clock3, Flame, Activity, MapPin } from "lucide-react";
import { OctagonAlert, TriangleAlert, CircleAlert, MinusCircle } from "lucide-react";
import type { ThermalAnomaly } from "../../types/anomaly";
import { anomalySeverity } from "../../hooks/useInvestigationFilters";
import type { InvestigationSeverity } from "../../hooks/useInvestigationFilters";

interface Props {
  anomalies: ThermalAnomaly[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial Fire",
  wildfire: "Wildfire",
  agricultural_burn: "Agricultural Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  other: "Other",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date(Date.now());
  const diffMin = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return `1d ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

const severityCfg = {
  critical: { label: "CRITICAL", icon: OctagonAlert, cls: "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]", dot: "bg-[var(--critical)]" },
  high: { label: "HIGH", icon: TriangleAlert, cls: "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]", dot: "bg-[var(--high)]" },
  medium: { label: "MEDIUM", icon: CircleAlert, cls: "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]", dot: "bg-[var(--medium)]" },
  low: { label: "LOW", icon: MinusCircle, cls: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]", dot: "bg-[var(--low)]" },
} as const;

export function AnomalyList({ anomalies, selectedId, onSelect, onOpen }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // scroll selected into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  if (anomalies.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-6 py-10 text-center">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">No anomalies match these filters</p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">Adjust search or filter criteria to broaden results.</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Anomalies"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!selectedId) {
          if (e.key === "ArrowDown" && anomalies[0]) {
            e.preventDefault();
            onSelect(anomalies[0].id);
          }
          return;
        }
        const idx = anomalies.findIndex((a) => a.id === selectedId);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = anomalies[Math.min(idx + 1, anomalies.length - 1)];
          if (next) onSelect(next.id);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const prev = anomalies[Math.max(idx - 1, 0)];
          if (prev) onSelect(prev.id);
        }
        if (e.key === "Enter" && selectedId) {
          e.preventDefault();
          onOpen(selectedId);
        }
      }}
      className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white divide-y divide-[var(--border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <div className="max-h-[520px] overflow-y-auto lg:max-h-[560px]">
        {anomalies.map((a) => {
          const sev = anomalySeverity(a) as Exclude<InvestigationSeverity, "all">;
          const cfg = severityCfg[sev];
          const Icon = cfg.icon;
          const isSelected = a.id === selectedId;
          return (
            <button
              key={a.id}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onSelect(a.id);
                onOpen(a.id);
              }}
              onFocus={() => onSelect(a.id)}
              className={`flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors ${isSelected ? "bg-[var(--accent-weak)]" : "hover:bg-[var(--surface-subtle)]"} focus-visible:outline-none`}
            >
              {/* Line 1: severity + classification + status */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${cfg.cls}`}>
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {cfg.label}
                </span>
                <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">{CLASS_LABEL[a.classification]}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.status === "active" ? "bg-[var(--critical)]" : a.status === "review" ? "bg-[var(--medium)]" : "bg-[var(--low)]"}`} />
                  <span className="text-[11px] font-medium capitalize text-[var(--text-secondary)]">{a.status === "active" ? "Unreviewed" : a.status}</span>
                </span>
              </div>

              {/* Line 2: ID + time + facility */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">{a.id}</span>
                <span className="h-2 w-px bg-[var(--border)]" aria-hidden="true" />
                <span className="inline-flex items-center gap-1 tabular-nums text-[var(--text-faint)]">
                  <Clock3 className="h-3 w-3" /> {fmtTime(a.detectedAt)}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 truncate text-[var(--text-muted)]">
                  <MapPin className="h-3 w-3 text-[var(--text-faint)]" />
                  {a.nearbyFacility ? (
                    <>
                      <span className="font-medium text-[var(--text-secondary)]">{a.nearbyFacility.name}</span>
                      <span>· {a.nearbyFacility.distanceKm} km</span>
                    </>
                  ) : (
                    <span>— {a.region}</span>
                  )}
                </span>
                <span className="sm:hidden truncate text-[var(--text-muted)]">{a.nearbyFacility ? `${a.nearbyFacility.distanceKm} km` : a.region}</span>
              </div>

              {/* Line 3: metrics */}
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <span className="text-[var(--text-faint)]">Conf</span>
                  <span className="font-medium text-[var(--text-primary)]">{a.confidence}%</span>
                </span>
                <span className="h-3 w-px bg-[var(--border-subtle)]" aria-hidden="true" />
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Flame className="h-3 w-3 text-[var(--text-faint)]" />
                  <span className="font-medium text-[var(--text-primary)]">{a.frp.toFixed(1)} MW</span>
                </span>
                <span className="h-3 w-px bg-[var(--border-subtle)]" aria-hidden="true" />
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Activity className="h-3 w-3 text-[var(--text-faint)]" />
                  <span className={a.persistenceScore >= 0.7 ? "font-medium text-[var(--critical-text)]" : a.persistenceScore >= 0.4 ? "font-medium text-[var(--text-secondary)]" : "text-[var(--text-faint)]"}>
                    {(a.persistenceScore * 100).toFixed(0)}% persist
                  </span>
                </span>
                <span className="ml-auto hidden sm:inline text-[11px] text-[var(--text-faint)]">{a.region}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] text-[var(--text-faint)]">
        <span className="tabular-nums">{anomalies.length} results · ↑/↓ · Enter</span>
        <span className="hidden sm:inline">Click row or marker to investigate</span>
      </div>
    </div>
  );
}
