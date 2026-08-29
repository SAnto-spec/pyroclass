import type { ThermalAnomaly } from "../../types/anomaly";

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial Fire",
  wildfire: "Wildfire",
  agricultural_burn: "Agricultural Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  other: "Other",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  anomalies: ThermalAnomaly[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AnomalyTable({ anomalies, selectedId, onSelect }: Props) {
  if (anomalies.length === 0) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-300">No anomalies match filters</p>
        <p className="mt-1 text-xs text-slate-500">Adjust search or filter criteria to see results.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">ID</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Detected</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Classification</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Conf.</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">FRP</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Persist.</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Nearby facility</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {anomalies.map((a) => {
              const isSelected = a.id === selectedId;
              return (
                <tr
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  className={[
                    "cursor-pointer transition-colors",
                    isSelected ? "bg-amber-500/10" : "hover:bg-slate-800/60",
                  ].join(" ")}
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-medium text-slate-200">{a.id}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-400">{fmtDate(a.detectedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">
                      {CLASS_LABEL[a.classification]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-300">{a.confidence}%</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-300">{a.frp.toFixed(1)} MW</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[11px] font-medium",
                        a.persistenceScore >= 0.7 ? "bg-amber-500/15 text-amber-400" : a.persistenceScore >= 0.4 ? "bg-slate-800 text-slate-400" : "bg-slate-800 text-slate-500",
                      ].join(" ")}
                    >
                      {(a.persistenceScore * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">
                    {a.nearbyFacility ? `${a.nearbyFacility.name} · ${a.nearbyFacility.distanceKm}km` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[11px] font-medium capitalize",
                        a.status === "active" ? "bg-emerald-500/15 text-emerald-400" : a.status === "review" ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-400",
                      ].join(" ")}
                    >
                      {a.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-slate-500">
        {anomalies.length} {anomalies.length === 1 ? "result" : "results"} · Click a row for details
      </div>
    </div>
  );
}
