import { useEffect } from "react";
import { X, MapPin, Flame, BarChart3, Bookmark, BookmarkCheck } from "lucide-react";
import type { IndustrialFacility } from "../../types/facility";
import { useWatchlistStore } from "../../store/watchlistStore";
import { useRecentStore } from "../../store/recentStore";

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
  const isWatched = useWatchlistStore((s) => s.isWatched(facility?.id ?? ""));
  const toggle = useWatchlistStore((s) => s.toggle);
  const pushFacility = useRecentStore((s) => s.pushFacility);

  useEffect(() => {
    if (facility) pushFacility(facility.id);
  }, [facility?.id, pushFacility]);

  if (!facility) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 py-8 text-center">
        <p className="text-[13px] font-medium text-[var(--text-secondary)]">Select a facility to view details</p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Facility detail syncs with map selection</p>
      </div>
    );
  }

  const statusCfg = facility
    ? facility.status === "high_attention"
      ? { label: "High attention", cls: "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" }
      : facility.status === "monitoring"
        ? { label: "Monitoring", cls: "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]" }
        : { label: "Nominal", cls: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]" }
    : { label: "Nominal", cls: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]" };

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{facility.name}</h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            {TYPE_LABEL[facility.type]} · {facility.region}
          </p>
          <span className={`mt-1 inline-flex rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3 bg-[var(--background)] p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">FACILITY TYPE</p>
            <p className="mt-1 text-[12px] font-medium text-[var(--text-primary)]">{TYPE_LABEL[facility.type]}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">REGION</p>
            <p className="mt-1 text-[12px] font-medium text-[var(--text-primary)]">{facility.region}</p>
            {facility.district ? <p className="text-[11px] text-[var(--text-muted)]">{facility.district}</p> : null}
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">NEARBY ANOMALIES</p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)] operational-data">
              <Flame className="h-3.5 w-3.5 text-[var(--text-faint)]" /> {anomalyCount}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">{anomalyCount > 0 ? `max FRP ${maxFrp.toFixed(1)} MW` : "no recent detections"}</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">HIGHEST CONFIDENCE</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)] operational-data">{anomalyCount > 0 ? `${maxConfidence}%` : "—"}</p>
            <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <BarChart3 className="h-3 w-3" /> {persistentNearby} persistent nearby
            </p>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
          <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">LOCATION</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-mono tabular-nums font-medium text-[var(--text-primary)]">
            <MapPin className="h-3 w-3 text-[var(--text-faint)]" /> {facility.latitude.toFixed(3)}°, {facility.longitude.toFixed(3)}°
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span className={`rounded-[4px] border px-1 py-0.5 text-[11px] font-medium capitalize ${statusCfg.cls}`}>{statusCfg.label}</span>
            <span>Last: {lastDetected ? new Date(lastDetected).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</span>
          </p>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(`${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}`)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              Copy coords
            </button>
            <button
              type="button"
              onClick={() => {
                // trigger map fly is handled by parent selection, just keep drawer open
              }}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] bg-[var(--text-primary)] px-2 py-1.5 text-[11px] font-medium text-white hover:bg-black"
            >
              View on map
            </button>
          </div>
          <button
            type="button"
            onClick={() => toggle(facility.id)}
            className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-1.5 text-[11px] font-medium ${isWatched ? "border-[var(--accent-border)] bg-[var(--accent-weak)] text-[var(--accent-muted)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"}`}
          >
            {isWatched ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            {isWatched ? "In watchlist · tap to remove" : "Add to watchlist"}
          </button>
        </div>

        <p className="px-1 text-[11px] leading-relaxed text-[var(--text-faint)]">
          Counts derived from currently loaded anomaly records. Persistent source link shows co-located thermal history.
        </p>
      </div>
    </div>
  );
}
