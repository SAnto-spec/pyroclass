import { X, MapPin, Flame, BarChart3 } from "lucide-react";
import type { IndustrialFacility } from "../../types/facility";

interface Props {
  facility: IndustrialFacility | null;
  anomalyCount: number;
  maxFrp: number;
  maxConfidence: number;
  persistentNearby: number;
  lastDetected: string | null;
  onClose: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  refinery: "Refinery",
  power_plant: "Power Plant",
  steel_plant: "Steel Plant",
  mine: "Mine",
  lng_terminal: "LNG Terminal",
  petrochemical: "Petrochemical",
  industrial: "Industrial",
};

export function FacilityDetailPanel({ facility, anomalyCount, maxFrp, maxConfidence, persistentNearby, lastDetected, onClose }: Props) {
  if (!facility) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-4 py-8 text-center">
        <p className="text-sm text-slate-400">Select a facility to view details</p>
        <p className="mt-1 text-xs text-slate-500">Facility detail is reusable for map selections</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{facility.name}</h3>
          <p className="text-xs text-slate-500">{TYPE_LABEL[facility.type]} · {facility.region}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Facility type</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{TYPE_LABEL[facility.type]}</p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Region</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{facility.region}</p>
            {facility.district ? <p className="text-xs text-slate-500">{facility.district}</p> : null}
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Nearby anomalies</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-100">
              <Flame className="h-3.5 w-3.5 text-amber-500" /> {anomalyCount}
            </p>
            <p className="text-xs text-slate-500">{anomalyCount > 0 ? `max FRP ${maxFrp.toFixed(1)} MW` : "no recent detections"}</p>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Highest confidence</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{anomalyCount > 0 ? `${maxConfidence}%` : "—"}</p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <BarChart3 className="h-3 w-3" /> persistent nearby {persistentNearby}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Location</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-slate-300">
            <MapPin className="h-3 w-3" /> {facility.latitude.toFixed(3)}°N {facility.longitude.toFixed(3)}°E
          </p>
          <p className="mt-1 text-xs text-slate-500">Status: <span className="capitalize text-slate-300">{facility.status.replace("_", " ")}</span></p>
          <p className="text-xs text-slate-500">Last detected: {lastDetected ? new Date(lastDetected).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" disabled className="flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-500 opacity-60">View Anomalies</button>
          <button type="button" disabled className="flex-1 rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 opacity-60">View on Map</button>
        </div>
        <p className="text-center text-[11px] text-slate-500">Presentational — will filter map + anomalies later</p>
      </div>
    </div>
  );
}
