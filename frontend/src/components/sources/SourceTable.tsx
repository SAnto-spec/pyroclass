import type { PersistentThermalSource } from "../../types/source";

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial",
  wildfire: "Wildfire",
  agricultural_burn: "Agr. Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  other: "Other",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  sources: PersistentThermalSource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SourceTable({ sources, selectedId, onSelect }: Props) {
  if (sources.length === 0) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-300">No persistent sources match filters</p>
        <p className="mt-1 text-xs text-slate-500">Adjust search or persistence filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Source ID</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Classification</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">First</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Last</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Count</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Score</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Facility</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sources.map((s) => {
              const sel = s.id === selectedId;
              return (
                <tr key={s.id} onClick={() => onSelect(s.id)} className={["cursor-pointer", sel ? "bg-amber-500/10" : "hover:bg-slate-800/60"].join(" ")}>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono font-medium text-slate-200">{s.id}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">{CLASS_LABEL[s.classification]}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-400">{fmt(s.firstDetected)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-400">{fmt(s.lastDetected)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-300">{s.detectionCount}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={["rounded px-1.5 py-0.5 text-[11px] font-medium", s.persistenceScore >= 0.7 ? "bg-amber-500/15 text-amber-400" : s.persistenceScore >= 0.4 ? "bg-slate-800 text-slate-400" : "bg-slate-800 text-slate-500"].join(" ")}>
                      {(s.persistenceScore * 100).toFixed(0)}%
                    </span>
                    <span className="ml-2 hidden text-[11px] capitalize text-slate-500 sm:inline">{s.persistenceLevel}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">{s.nearbyFacility ? `${s.nearbyFacility.name} · ${s.nearbyFacility.distanceKm}km` : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[11px] font-medium capitalize",
                        s.status === "confirmed" ? "bg-emerald-500/15 text-emerald-400" : s.status === "under_investigation" ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-400",
                      ].join(" ")}
                    >
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-slate-500">{sources.length} sources</div>
    </div>
  );
}
