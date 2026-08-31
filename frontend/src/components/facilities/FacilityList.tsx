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
      <div className="rounded-md border border-slate-800 bg-slate-900 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-300">No facilities match filters</p>
        <p className="mt-1 text-xs text-slate-500">Try adjusting search or type filter.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Facility</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Type</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Region</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Anomalies</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {facilities.map((f) => {
              const isSelected = f.id === selectedId;
              return (
                <tr
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  className={["cursor-pointer transition-colors", isSelected ? "bg-amber-500/10" : "hover:bg-slate-800/60"].join(" ")}
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="font-medium text-slate-100">{f.name}</div>
                    <div className="font-mono text-[11px] text-slate-500">{f.id}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">
                      {TYPE_LABEL[f.type]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">{f.region}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-300">
                    {f.anomalyCount} {f.anomalyCount === 1 ? "anomaly" : "anomalies"}
                    {f.anomalyCount > 0 ? <span className="ml-2 text-[11px] text-amber-400">{f.maxFrp.toFixed(1)} MW max</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[11px] font-medium capitalize",
                        f.status === "high_attention" ? "bg-red-500/15 text-red-400" : f.status === "monitoring" ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-400",
                      ].join(" ")}
                    >
                      {f.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-slate-500">
        {facilities.length} facilities · Click to inspect
      </div>
    </div>
  );
}
