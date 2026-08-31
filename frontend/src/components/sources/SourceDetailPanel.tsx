import { X, MapPin } from "lucide-react";
import type { PersistentThermalSource } from "../../types/source";

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial Fire",
  wildfire: "Wildfire",
  agricultural_burn: "Agricultural Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  other: "Other",
};

interface Props {
  source: PersistentThermalSource | null;
  onClose: () => void;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function SourceDetailPanel({ source, onClose }: Props) {
  if (!source) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-4 py-8 text-center">
        <p className="text-sm text-slate-400">Select a persistent source</p>
        <p className="mt-1 text-xs text-slate-500">Timeline unavailable from the backend</p>
      </div>
    );
  }

  const timeline = source.timeline;

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Persistent Source {source.id}</h3>
          <p className="text-xs text-slate-500">{CLASS_LABEL[source.classification]} · {source.region}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Persistence Score</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-amber-400">{(source.persistenceScore * 100).toFixed(0)}%</p>
            <p className="text-xs capitalize text-slate-500">{source.persistenceLevel} · {source.status.replace("_", " ")}</p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Detection Count</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{source.detectionCount}</p>
            <p className="text-xs text-slate-500">in monitoring window</p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">First Detected</p>
            <p className="mt-1 text-sm text-slate-100">{fmtDate(source.firstDetected)}</p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Last Detected</p>
            <p className="mt-1 text-sm text-slate-100">{fmtDate(source.lastDetected)}</p>
          </div>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Classification & Facility</p>
          <p className="mt-1 text-sm font-medium text-slate-100">{CLASS_LABEL[source.classification]}</p>
          {source.nearbyFacility ? (
            <p className="text-xs text-slate-400">{source.nearbyFacility.name} · {source.nearbyFacility.distanceKm} km</p>
          ) : (
            <p className="text-xs text-slate-500">No facility within 5 km</p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3" /> {source.latitude.toFixed(3)}°N {source.longitude.toFixed(3)}°E
          </p>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Historical Activity</p>
          <p className="text-[11px] text-slate-500">Detections over time — CSS timeline (no chart library)</p>
          <div className="mt-3 space-y-1.5">
            {timeline.map((t) => {
              const d = new Date(t);
              const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
              return (
                <div key={t} className="flex items-center gap-2">
                  <span className="w-[56px] shrink-0 text-[11px] tabular-nums text-slate-500">{label}</span>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                  <span className="h-1.5 flex-1 rounded-full bg-slate-800">
                    <span className="block h-1.5 rounded-full bg-amber-500/70" style={{ width: `${Math.min(100, 30 + Math.round(source.persistenceScore * 50))}%` }} />
                  </span>
                  <span className="hidden text-[11px] text-slate-500 sm:inline">{d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} UTC</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{timeline.length} detections in timeline · Score drives bar length</p>
        </div>
      </div>
    </div>
  );
}
