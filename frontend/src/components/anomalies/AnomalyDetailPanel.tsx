import { X, History, Satellite, MapPin } from "lucide-react";
import type { ThermalAnomaly } from "../../types/anomaly";

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial Fire",
  wildfire: "Vegetation Fire",
  agricultural_burn: "Agricultural Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  non_industrial: "Non-Industrial",
  unknown: "Unknown",
  other: "Other",
};

interface Props {
  anomaly: ThermalAnomaly | null;
  onClose: () => void;
}

export function AnomalyDetailPanel({ anomaly, onClose }: Props) {
  if (!anomaly) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-4 py-8 text-center">
        <p className="text-sm text-slate-400">
          Select an anomaly to view details
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Detail panel is reusable for map interactions
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Thermal Anomaly {anomaly.id}
          </h3>

          <p className="text-xs text-slate-500">
            {CLASS_LABEL[anomaly.classification]} · {anomaly.region}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Classification */}
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Classification
            </p>

            <p className="mt-1 text-sm font-medium text-slate-100">
              {CLASS_LABEL[anomaly.classification]}
            </p>
          </div>

          {/* Confidence */}
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Confidence
            </p>

            <p className="mt-1 text-sm font-medium text-slate-100">
              {anomaly.confidence.toFixed(0)}%
            </p>
          </div>

          {/* FRP */}
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              FRP
            </p>

            <p className="mt-1 text-sm font-medium text-amber-400">
              {anomaly.frp.toFixed(1)} MW
            </p>
          </div>

          {/* Brightness */}
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Brightness
            </p>

            <p className="mt-1 text-sm font-medium text-slate-100">
              {anomaly.brightness > 0
                ? `${anomaly.brightness.toFixed(1)} K`
                : "Unavailable"}
            </p>
          </div>

          {/* Persistence */}
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Persistence
            </p>

            <p className="mt-1 text-sm font-medium text-slate-100">
              {anomaly.persistenceScore.toFixed(0)}%
            </p>
          </div>

          {/* Status */}
          <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Status
            </p>

            <p className="mt-1 text-sm font-medium capitalize text-slate-100">
              {anomaly.status}
            </p>
          </div>
        </div>

        {/* Detection information */}
        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Detected
          </p>

          <p className="mt-1 text-xs tabular-nums text-slate-300">
            {new Date(anomaly.detectedAt).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3" />

            {anomaly.latitude.toFixed(3)}°N{" "}
            {anomaly.longitude.toFixed(3)}°E · {anomaly.region}
          </p>
        </div>

        {/* Nearby facility */}
        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Nearby Facility
          </p>

          {anomaly.nearbyFacility ? (
            <div className="mt-1">
              <p className="text-sm font-medium text-slate-100">
                {anomaly.nearbyFacility.name}
              </p>

              <p className="text-xs capitalize text-slate-400">
                {anomaly.nearbyFacility.type.replace(/_/g, " ")} ·{" "}
                {anomaly.nearbyFacility.distanceKm.toFixed(1)} km
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              No nearby facility identified
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled
            title="History — coming soon"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-500 opacity-60"
          >
            <History className="h-3.5 w-3.5" />
            View History
          </button>

          <button
            type="button"
            disabled
            title="Satellite imagery — coming soon"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 opacity-60"
          >
            <Satellite className="h-3.5 w-3.5" />
            View Satellite Imagery
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-500">
          Presentational — imagery will be wired to FastAPI later
        </p>
      </div>
    </div>
  );
}
