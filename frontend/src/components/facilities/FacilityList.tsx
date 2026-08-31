import type { IndustrialFacility } from "../../types/facility";

const TYPE_LABEL: Record<string, string> = {
  refinery: "Refinery",
  power_plant: "Power Plant",
  steel_plant: "Steel Plant",
  mine: "Mine",
  lng_terminal: "LNG Terminal",
  petrochemical: "Petrochemical",
  industrial: "Industrial",
};

interface Props {
  facilities: (IndustrialFacility & { anomalyCount: number; maxFrp: number })[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FacilityList({ facilities, selectedId, onSelect }: Props) {
  if (facilities.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-6 py-10 text-center">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">No facilities match filters</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Try adjusting search or type filter.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white divide-y divide-[var(--border-subtle)]">
      <div className="max-h-[520px] overflow-y-auto lg:max-h-[560px] divide-y divide-[var(--border-subtle)]">
        {facilities.map((f) => {
          const isSelected = f.id === selectedId;
          const statusCfg =
            f.status === "high_attention"
              ? { label: "High attention", cls: "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]", dot: "bg-[var(--critical)]" }
              : f.status === "monitoring"
                ? { label: "Monitoring", cls: "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]", dot: "bg-[var(--medium)]" }
                : { label: "Nominal", cls: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]", dot: "bg-[var(--low)]" };
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect(f.id)}
              className={`flex w-full flex-col gap-1.5 px-3 py-3 text-left transition-colors ${isSelected ? "bg-[var(--accent-weak)]" : "hover:bg-[var(--surface-subtle)]"} focus-visible:outline-none`}
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">{f.name}</span>
                <span className="shrink-0 rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1 py-0.5 font-mono text-[10px] font-medium text-[var(--text-muted)]">
                  {f.id}
                </span>
                <span className={`ml-auto inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusCfg.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} /> {statusCfg.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <span className="inline-flex items-center rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                  {TYPE_LABEL[f.type]}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="hidden sm:inline h-1 w-px bg-[var(--border)]" aria-hidden="true" />
                  {f.region}
                  <span className="text-[var(--text-faint)]">· {f.anomalyCount} {f.anomalyCount === 1 ? "anomaly" : "anomalies"}</span>
                  {f.anomalyCount > 0 && <span className="font-medium tabular-nums text-[var(--text-secondary)]">· {f.maxFrp.toFixed(1)} MW max</span>}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] text-[var(--text-faint)]">
        <span className="tabular-nums">{facilities.length} facilities</span>
        <span className="hidden sm:inline">Click to inspect · selected syncs map</span>
      </div>
    </div>
  );
}
