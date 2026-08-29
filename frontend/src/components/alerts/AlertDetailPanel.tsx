import { X, MapPin } from "lucide-react";
import type { Alert } from "../../types/alert";
import type { ThermalAnomaly } from "../../types/anomaly";

interface Props {
  alert: Alert | null;
  anomaly: ThermalAnomaly | null;
  onClose: () => void;
  onStatusChange: (id: string, status: Alert["status"]) => void;
}

export function AlertDetailPanel({ alert, anomaly, onClose, onStatusChange }: Props) {
  if (!alert) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900 px-4 py-8 text-center">
        <p className="text-sm text-slate-400">Select an alert to review</p>
        <p className="mt-1 text-xs text-slate-500">Local status updates — no backend</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-slate-100">{alert.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className={["rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", alert.severity === "critical" ? "border-red-500/20 bg-red-500/10 text-red-400" : alert.severity === "high" ? "border-orange-500/20 bg-orange-500/10 text-orange-400" : alert.severity === "medium" ? "border-amber-500/20 bg-amber-500/10 text-amber-400" : "border-slate-700 bg-slate-800 text-slate-400"].join(" ")}>
              {alert.severity}
            </span>
            <span className={["rounded px-1.5 py-0.5 text-[11px] capitalize", alert.status === "active" ? "bg-red-500/15 text-red-400" : alert.status === "acknowledged" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"].join(" ")}>
              {alert.status}
            </span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Reason for alert</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{alert.description}</p>
          <p className="mt-2 text-[11px] tabular-nums text-slate-500">{alert.id} · {new Date(alert.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>

        {anomaly ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Classification</p>
              <p className="mt-1 text-sm capitalize text-slate-100">{anomaly.classification.replace("_", " ")}</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Confidence</p>
              <p className="mt-1 text-sm text-slate-100">{anomaly.confidence}%</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">FRP</p>
              <p className="mt-1 text-sm font-medium text-amber-400">{anomaly.frp.toFixed(1)} MW</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Related anomaly</p>
              <p className="mt-1 font-mono text-sm text-slate-100">{anomaly.id}</p>
              <p className="text-xs text-slate-500">{anomaly.region}</p>
            </div>
            <div className="col-span-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Location / Facility</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                <MapPin className="h-3 w-3" /> {anomaly.latitude.toFixed(3)}°N {anomaly.longitude.toFixed(3)}°E
              </p>
              {anomaly.nearbyFacility ? (
                <p className="mt-1 text-xs text-slate-400">{anomaly.nearbyFacility.name} · {anomaly.nearbyFacility.distanceKm} km</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">No facility within 5 km</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No linked anomaly found</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => onStatusChange(alert.id, "acknowledged")}
            disabled={alert.status === "acknowledged"}
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            Acknowledge
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(alert.id, "resolved")}
            disabled={alert.status === "resolved"}
            className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Resolve
          </button>
        </div>
        {alert.status !== "active" ? (
          <button type="button" onClick={() => onStatusChange(alert.id, "active")} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">
            Re-open as active
          </button>
        ) : null}
      </div>
    </div>
  );
}
