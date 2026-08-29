import type { Alert } from "../../types/alert";
import type { ThermalAnomaly } from "../../types/anomaly";

const SEV_STYLES: Record<string, string> = {
  critical: "border-red-500/20 bg-red-500/10 text-red-400",
  high: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  medium: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  low: "border-slate-700 bg-slate-800 text-slate-400",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  alerts: Alert[];
  anomalyById: Map<string, ThermalAnomaly>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AlertList({ alerts, anomalyById, selectedId, onSelect }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-300">No alerts match filters</p>
        <p className="mt-1 text-xs text-slate-500">Adjust severity or status filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-900">
      <ul className="divide-y divide-slate-800">
        {alerts.map((a) => {
          const anomaly = anomalyById.get(a.anomalyId);
          const isSelected = a.id === selectedId;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(a.id)}
                className={[
                  "flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors",
                  isSelected ? "bg-amber-500/10" : "hover:bg-slate-800/50",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={["inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", SEV_STYLES[a.severity]].join(" ")}>
                    {a.severity}
                  </span>
                  <span
                    className={[
                      "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
                      a.status === "active" ? "bg-red-500/15 text-red-400" : a.status === "acknowledged" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400",
                    ].join(" ")}
                  >
                    {a.status}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-slate-500">{fmt(a.createdAt)}</span>
                </div>
                <p className="text-sm font-medium leading-snug text-slate-100">{a.title}</p>
                <p className="line-clamp-1 text-xs text-slate-400">{a.description}</p>
                <p className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="font-mono">{a.id} · {a.anomalyId}</span>
                  {anomaly ? (
                    <>
                      <span className="hidden sm:inline">·</span>
                      <span className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[11px] capitalize text-slate-400">
                        {anomaly.classification.replace("_", " ")} · {anomaly.confidence}% · {anomaly.frp.toFixed(1)} MW
                      </span>
                      {anomaly.nearbyFacility ? <span>· {anomaly.nearbyFacility.name}</span> : null}
                    </>
                  ) : null}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-slate-500">{alerts.length} alerts</div>
    </div>
  );
}
