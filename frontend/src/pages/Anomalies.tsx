import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { SearchX, AlertTriangle, RefreshCw } from "lucide-react";

import { GlobalContextBar } from "../components/layout/GlobalContextBar";
import { SavedViewsBar } from "../components/layout/SavedViewsBar";
import { Freshness } from "../components/layout/Freshness";
import { InvestigationFilterBar } from "../components/anomalies/InvestigationFilterBar";
import { AnomalyList } from "../components/anomalies/AnomalyList";
import { InvestigationDrawer } from "../components/anomalies/InvestigationDrawer";
import { MapContainer } from "../components/map/MapContainer";
import { useAnomalies } from "../hooks/useAnomalies";
import { useSources } from "../hooks/useSources";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { useInvestigationFilters, anomalySeverity } from "../hooks/useInvestigationFilters";
import { useRecentStore } from "../store/recentStore";
import { useCommunityStore } from "../store/communityStore";
import { exportAnomaliesCsv, exportAnomaliesGeoJson } from "../lib/export";
import { getRisk } from "../api/risk";
import type { BackendFacility, FacilityStatus, FacilityType, IndustrialFacility } from "../types/facility";
import { getFacilities } from "../api/anomalies";

const REFERENCE_NOW = new Date("2024-06-01T12:00:00Z").getTime();

function normalizeFacilityType(value: string | null): FacilityType {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "refinery" || normalized === "power_plant" || normalized === "steel_plant" || normalized === "mine" || normalized === "lng_terminal" || normalized === "petrochemical" || normalized === "industrial") {
    return normalized;
  }
  return "industrial";
}

function toDisplayFacility(facility: BackendFacility): IndustrialFacility {
  const status: FacilityStatus = "unknown";
  return {
    id: String(facility.facility_id),
    name: facility.name,
    type: normalizeFacilityType(facility.facility_type),
    latitude: facility.latitude,
    longitude: facility.longitude,
    region: "India",
    status,
  };
}

export function Anomalies() {
  const { anomalyId: paramId } = useParams<{ anomalyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { filters: global } = useGlobalFilters();
  const { filters: inv, clearAll: clearInv, hasActive: hasInvActive } = useInvestigationFilters();
  const anomaliesQuery = useAnomalies();
  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities, staleTime: 60000 });
  const sourcesQuery = useSources();
  const pushAnomaly = useRecentStore((state) => state.pushAnomaly);
  const communityReports = useCommunityStore((state) => state.reports);

  const anomalies = anomaliesQuery.data ?? [];
  const facilities = facilitiesQuery.data ?? [];
  const sources = sourcesQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(paramId ?? null);

  useEffect(() => {
    setSelectedId(paramId ?? null);
  }, [paramId]);

  const filtered = useMemo(() => {
    return anomalies.filter((anomaly) => {
      if (global.region !== "all" && anomaly.region !== global.region) return false;
      if (global.conf !== "all" && anomaly.confidence < parseInt(global.conf, 10)) return false;
      if (global.range !== "all") {
        const ageDays = (REFERENCE_NOW - new Date(anomaly.detectedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (global.range === "7d" && ageDays > 7) return false;
        if (global.range === "14d" && ageDays > 14) return false;
        if (global.range === "30d" && ageDays > 30) return false;
      }
      if (inv.q) {
        const query = inv.q.toLowerCase();
        const haystack = `${anomaly.id} ${anomaly.classification} ${anomaly.nearbyFacility?.name ?? ""} ${anomaly.region}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (inv.class !== "all" && anomaly.classification !== inv.class) return false;
      if (inv.severity !== "all" && anomalySeverity(anomaly) !== inv.severity) return false;
      if (inv.frp === "low" && anomaly.frp >= 20) return false;
      if (inv.frp === "medium" && (anomaly.frp < 20 || anomaly.frp > 50)) return false;
      if (inv.frp === "high" && anomaly.frp <= 50) return false;
      if (inv.persist === "low" && anomaly.persistenceScore >= 0.4) return false;
      if (inv.persist === "medium" && (anomaly.persistenceScore < 0.4 || anomaly.persistenceScore >= 0.7)) return false;
      if (inv.persist === "high" && anomaly.persistenceScore < 0.7) return false;
      if (inv.status !== "all" && anomaly.status !== inv.status) return false;
      return true;
    });
  }, [anomalies, global, inv]);

  const filteredFacilities = useMemo(() => {
    return facilities;
  }, [facilities]);

  const filteredSources = useMemo(() => {
    if (global.region === "all") return sources;
    return sources.filter((source) => source.region === global.region);
  }, [sources, global.region]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return anomalies.find((anomaly) => anomaly.id === selectedId) ?? null;
  }, [anomalies, selectedId]);

  const riskQuery = useQuery({
    queryKey: ["risk", selectedId],
    queryFn: () => getRisk(Number(selectedId)),
    enabled: Boolean(selectedId && /^\d+$/.test(selectedId)),
    staleTime: 30000,
  });

  const selectedFacility = useMemo(() => {
    const nearbyName = selected?.nearbyFacility?.name;
    if (!nearbyName) return null;
    const facility = facilities.find((candidate) => candidate.name === nearbyName);
    return facility ? toDisplayFacility(facility) : null;
  }, [facilities, selected]);

  const linkedSource = useMemo(() => {
    if (!selected) return null;
    if (selected.nearbyFacility) {
      const facilitySource = sources.find((source) => source.nearbyFacility?.name === selected.nearbyFacility?.name);
      if (facilitySource) return facilitySource;
    }
    return sources.find((source) => source.classification === selected.classification && source.region === selected.region) ?? null;
  }, [selected, sources]);

  const isNotFound = Boolean(paramId && !anomalies.some((anomaly) => anomaly.id === paramId));
  const isLoading = anomaliesQuery.isLoading || facilitiesQuery.isLoading || sourcesQuery.isLoading;
  const queryError = anomaliesQuery.error ?? facilitiesQuery.error ?? sourcesQuery.error;

  const openAnomaly = useCallback((id: string) => {
    setSelectedId(id);
    pushAnomaly(id);
    navigate(`/anomalies/${id}${location.search}`);
  }, [location.search, navigate, pushAnomaly]);

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
    navigate(`/anomalies${location.search}`);
  }, [location.search, navigate]);

  const handleClearAll = () => clearInv();

  if (isLoading) {
    return (
      <div className="px-3 py-6 sm:px-6">
        <Freshness source="api" />
        <p className="mt-4 text-sm text-[var(--text-muted)]">Loading thermal anomalies...</p>
      </div>
    );
  }

  if (queryError) {
    const message = queryError instanceof Error ? queryError.message : "Unable to load anomaly data.";
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6">
        <GlobalContextBar />
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--critical-border)] bg-[var(--critical-weak)] px-6 py-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-[var(--critical)]" />
          <p className="mt-2 text-[13px] font-medium text-[var(--critical-text)]">Could not load anomalies</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">{message}</p>
          <button type="button" onClick={() => { void anomaliesQuery.refetch(); void facilitiesQuery.refetch(); void sourcesQuery.refetch(); }} className="mt-4 inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 sm:px-6">
      <GlobalContextBar />
      <SavedViewsBar />
      <div className="flex items-center justify-between">
        <Freshness source="api" timestamp={filtered[0]?.detectedAt} />
        <div className="flex gap-1.5">
          <button type="button" onClick={() => exportAnomaliesCsv(filtered)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">Export CSV ({filtered.length})</button>
          <button type="button" onClick={() => exportAnomaliesGeoJson(filtered)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">GeoJSON</button>
        </div>
      </div>

      <InvestigationFilterBar anomalies={anomalies} filteredCount={filtered.length} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="order-1 min-w-0 xl:order-2">
          {filtered.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-6 py-10 text-center">
              <SearchX className="mx-auto h-6 w-6 text-[var(--text-faint)]" />
              <p className="mt-2 text-[13px] font-medium text-[var(--text-primary)]">No anomalies match these filters</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Try widening time, region, or investigation filters.</p>
              {(hasInvActive || global.region !== "all" || global.conf !== "80" || global.range !== "30d") && <button type="button" onClick={handleClearAll} className="mt-3 inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">Clear filters</button>}
            </div>
          ) : (
            <AnomalyList anomalies={filtered} selectedId={selectedId} onSelect={setSelectedId} onOpen={openAnomaly} />
          )}
        </div>

        <div className="order-2 min-w-0 xl:order-1">
          <MapContainer anomalies={filtered} facilities={filteredFacilities} sources={filteredSources} communityReports={communityReports} selectedAnomalyId={selectedId} onAnomalySelect={openAnomaly} />
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-[11px] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">Visual encoding</span>
            <span className="hidden h-3 w-px bg-[var(--border)] sm:inline" aria-hidden="true" />
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-white bg-[var(--accent)] shadow-sm" /> Thermal</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-amber-600 bg-slate-700 shadow-sm" /> Facility</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-white bg-[var(--accent)]/50 shadow-sm" /> Persistent</span>
            <span className="ml-auto hidden text-[10px] text-[var(--text-faint)] sm:inline">Click row or map marker to investigate</span>
          </div>
        </div>
      </div>

      {isNotFound ? (
        <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Not found">
          <button type="button" aria-label="Close" onClick={closeDrawer} className="absolute inset-0 bg-[#0f172a]/20 backdrop-blur-[1px]" />
          <div className="relative ml-auto flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)]">
            <div className="p-6">
              <p className="text-[13px] font-semibold text-[var(--critical-text)]">Anomaly not found</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">No anomaly with ID <span className="font-mono font-medium text-[var(--text-primary)]">{paramId}</span> exists in the current backend dataset.</p>
              <button type="button" onClick={closeDrawer} className="mt-4 inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">Back to investigation</button>
            </div>
          </div>
        </div>
      ) : (
        <InvestigationDrawer anomaly={selected} facility={selectedFacility} source={linkedSource} risk={riskQuery.data ?? null} riskLoading={riskQuery.isLoading} open={Boolean(selected && !isNotFound)} onClose={closeDrawer} onFacilityView={() => { closeDrawer(); navigate(`/facilities${location.search}`); }} onViewOnMap={() => undefined} />
      )}
    </div>
  );
}
