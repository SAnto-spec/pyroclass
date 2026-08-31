import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bookmark } from "lucide-react";

import { FacilityFilters, type FacilityFiltersState } from "../components/facilities/FacilityFilters";
import { FacilityList } from "../components/facilities/FacilityList";
import { FacilityDetailPanel } from "../components/facilities/FacilityDetailPanel";
import { MapContainer } from "../components/map/MapContainer";
import { GlobalContextBar } from "../components/layout/GlobalContextBar";
import { SavedViewsBar } from "../components/layout/SavedViewsBar";
import { Freshness } from "../components/layout/Freshness";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { useWatchlistStore } from "../store/watchlistStore";
import { useRecentStore } from "../store/recentStore";
import { useAnomalies } from "../hooks/useAnomalies";
import { exportFacilitiesCsv, exportFacilitiesGeoJson } from "../lib/export";
import { getFacilities } from "../api/anomalies";
import type { BackendFacility, FacilityType, IndustrialFacility } from "../types/facility";
import type { ThermalAnomaly } from "../types/anomaly";

function toFacilityType(facilityType: string | null): FacilityType {
  switch (facilityType) {
    case "refinery":
    case "power_plant":
    case "lng_terminal":
      return facilityType;
    case "steel":
      return "steel_plant";
    case "mining_quarry":
      return "mine";
    case "chemical":
      return "petrochemical";
    default:
      return "industrial";
  }
}

function toDisplayFacility(facility: BackendFacility): IndustrialFacility {
  return {
    id: String(facility.facility_id),
    name: facility.name,
    type: toFacilityType(facility.facility_type),
    latitude: facility.latitude,
    longitude: facility.longitude,
    region: "Unspecified",
    status: "unknown",
  };
}

export function Facilities() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters: global } = useGlobalFilters();
  const watchlistIds = useWatchlistStore((s) => s.ids);
  const pushFacility = useRecentStore((s) => s.pushFacility);
  const anomaliesQuery = useAnomalies();
  const anomalies = anomaliesQuery.data ?? [];

  const [filters, setFilters] = useState<FacilityFiltersState>({ search: "", type: "all", region: "all" });
  const [facilities, setFacilities] = useState<BackendFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("facility") ?? null);
  const foiOnly = searchParams.get("foi") === "1";

  useEffect(() => {
    setLoading(true);
    setError(null);
    getFacilities()
      .then((result) => {
        setFacilities(result);
        setSelectedId((current) => current ?? (result[0] ? String(result[0].facility_id) : null));
      })
      .catch((reason: unknown) => {
        setFacilities([]);
        setError(reason instanceof Error ? reason.message : "Unable to load facilities.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const f = searchParams.get("facility");
    if (f) setSelectedId(f);
  }, [searchParams]);

  useEffect(() => {
    if (selectedId) pushFacility(selectedId);
  }, [selectedId, pushFacility]);

  const displayFacilities = useMemo(() => facilities.map(toDisplayFacility), [facilities]);

  const anomaliesByFacility = useMemo(() => {
    const map = new Map<string, ThermalAnomaly[]>();
    for (const f of displayFacilities) {
      map.set(f.id, anomalies.filter((a) => a.nearbyFacility?.id === f.id));
    }
    return map;
  }, [anomalies, displayFacilities]);

  const sourcesByFacility = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of displayFacilities) {
      map.set(f.id, 0);
    }
    return map;
  }, [displayFacilities]);

  const enriched = useMemo(() => {
    return displayFacilities.map((f) => {
      const list = anomaliesByFacility.get(f.id) ?? [];
      const maxFrp = list.length ? Math.max(...list.map((a) => a.frp)) : 0;
      return { ...f, anomalyCount: list.length, maxFrp };
    });
  }, [anomaliesByFacility, displayFacilities]);

  const filtered = useMemo(() => {
    return enriched.filter((f) => {
      if (foiOnly && !watchlistIds.includes(f.id)) return false;
      if (global.region !== "all" && f.region !== global.region) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${f.name} ${f.type} ${f.region} ${f.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.type !== "all" && f.type !== filters.type) return false;
      if (filters.region !== "all" && f.region !== filters.region) return false;
      return true;
    });
  }, [enriched, filters, foiOnly, watchlistIds, global.region]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set("facility", id);
    setSearchParams(next, { replace: false });
  };

  const handleClose = () => {
    setSelectedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("facility");
    setSearchParams(next, { replace: false });
  };

  const selected = useMemo(() => filtered.find((f) => f.id === selectedId) ?? filtered[0] ?? null, [filtered, selectedId]);
  const effectiveSelectedId = selected?.id ?? null;

  const detailStats = useMemo(() => {
    if (!selected) return { maxFrp: 0, maxConfidence: 0, persistentNearby: 0, lastDetected: null as string | null };
    const list = anomaliesByFacility.get(selected.id) ?? [];
    const maxFrp = list.length ? Math.max(...list.map((a) => a.frp)) : 0;
    const maxConfidence = list.length ? Math.max(...list.map((a) => a.confidence)) : 0;
    const persistentNearby = sourcesByFacility.get(selected.id) ?? 0;
    const lastDetected = list.length ? list.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())[0].detectedAt : null;
    return { maxFrp, maxConfidence, persistentNearby, lastDetected };
  }, [selected, anomaliesByFacility, sourcesByFacility]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6">
        <GlobalContextBar />
        <Freshness source="api" />
        <p className="mt-4 text-sm text-[var(--text-muted)]">Loading facilities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6">
        <GlobalContextBar />
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--critical-border)] bg-[var(--critical-weak)] px-6 py-8 text-center">
          <p className="text-[13px] font-medium text-[var(--critical-text)]">Could not load facilities</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
      <GlobalContextBar />
      <SavedViewsBar />
      <div className="flex items-center justify-between">
        <Freshness source="api" />
        <div className="flex gap-1.5">
          <button onClick={() => exportFacilitiesCsv(filtered)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
            Export CSV ({filtered.length})
          </button>
          <button onClick={() => exportFacilitiesGeoJson(filtered)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
            GeoJSON
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">Industrial Facilities</h2>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--text-muted)]">
          Inspect facilities that explain or correlate with thermal anomalies. Facility records are loaded from the backend.
        </p>
      </div>

      <FacilityFilters filters={filters} onChange={setFilters} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            if (foiOnly) next.delete("foi");
            else next.set("foi", "1");
            setSearchParams(next, { replace: true });
          }}
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-[11px] font-medium ${foiOnly ? "border-[var(--accent-border)] bg-[var(--accent-weak)] text-[var(--accent-muted)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"}`}
        >
          <Bookmark className="h-3 w-3" />
          {foiOnly ? `FOI only · ${watchlistIds.length} facilities` : `FOI only${watchlistIds.length ? ` · ${watchlistIds.length}` : ""}`}
        </button>
        {foiOnly && <span className="text-[11px] text-[var(--text-muted)]">Showing watchlist only — {filtered.length} facilities</span>}
        <span className="ml-auto text-[11px] tabular-nums text-[var(--text-faint)]">{filtered.length} facilities · {enriched.length} total</span>
      </div>

      {enriched.length === 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-6 py-10 text-center">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">No facilities returned by the backend</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">The facility inventory is currently empty.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="order-1 min-w-0 xl:order-1">
          <FacilityList facilities={filtered} selectedId={effectiveSelectedId} onSelect={handleSelect} />
        </div>
        <div className="order-2 flex min-w-0 flex-col gap-4 xl:order-2">
          <MapContainer facilities={facilities} selectedFacilityId={effectiveSelectedId} onFacilitySelect={handleSelect} />
          <FacilityDetailPanel
            facility={selected ?? null}
            anomalyCount={selected ? (anomaliesByFacility.get(selected.id)?.length ?? 0) : 0}
            maxFrp={detailStats.maxFrp}
            maxConfidence={detailStats.maxConfidence}
            persistentNearby={detailStats.persistentNearby}
            lastDetected={detailStats.lastDetected}
            onClose={handleClose}
          />
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">Facility context</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              Facility markers are distinct from thermal anomalies. Selection syncs map highlight — use to verify proximity to detections before triage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
