import { useEffect, useMemo, useState } from "react";
import { FacilityFilters, type FacilityFiltersState } from "../components/facilities/FacilityFilters";
import { FacilityList } from "../components/facilities/FacilityList";
import { FacilityDetailPanel } from "../components/facilities/FacilityDetailPanel";
import { MapContainer } from "../components/map/MapContainer";
import { getFacilities } from "../api/anomalies";
import { mockAnomalies } from "../mocks/anomalies";
import { mockSources } from "../mocks/sources";
import type { BackendFacility, FacilityType, IndustrialFacility } from "../types/facility";

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
  const [filters, setFilters] = useState<FacilityFiltersState>({
    search: "",
    type: "all",
    region: "all",
  });
  const [facilities, setFacilities] = useState<BackendFacility[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    getFacilities()
      .then((result) => {
        setFacilities(result);
        setSelectedId((current) => current ?? (result[0] ? String(result[0].facility_id) : null));
      })
      .catch(() => setFacilities([]));
  }, []);

  const displayFacilities = useMemo(
    () => facilities.map(toDisplayFacility),
    [facilities],
  );

  const anomaliesByFacility = useMemo(() => {
    const map = new Map<string, typeof mockAnomalies>();
    for (const f of displayFacilities) {
      map.set(f.id, mockAnomalies.filter((a) => a.nearbyFacility?.id === f.id));
    }
    return map;
  }, [displayFacilities]);

  const sourcesByFacility = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of displayFacilities) {
      map.set(f.id, mockSources.filter((s) => s.nearbyFacility?.id === f.id).length);
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
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${f.name} ${f.type} ${f.region} ${f.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.type !== "all" && f.type !== filters.type) return false;
      if (filters.region !== "all" && f.region !== filters.region) return false;
      return true;
    });
  }, [enriched, filters]);

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

  return (
    <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Industrial Facilities</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Inspect facilities that explain or correlate with thermal anomalies. Counts are derived from the anomaly mock dataset to keep data internally consistent.
        </p>
      </div>

      <FacilityFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <FacilityList facilities={filtered} selectedId={effectiveSelectedId} onSelect={setSelectedId} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <MapContainer
            facilities={facilities}
            selectedFacilityId={effectiveSelectedId}
            onFacilitySelect={setSelectedId}
          />
          <FacilityDetailPanel
            facility={selected ?? null}
            anomalyCount={selected ? (anomaliesByFacility.get(selected.id)?.length ?? 0) : 0}
            maxFrp={detailStats.maxFrp}
            maxConfidence={detailStats.maxConfidence}
            persistentNearby={detailStats.persistentNearby}
            lastDetected={detailStats.lastDetected}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}
