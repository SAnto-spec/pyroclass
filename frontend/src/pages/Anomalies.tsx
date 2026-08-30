import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { GlobalContextBar } from "../components/layout/GlobalContextBar";
import { SavedViewsBar } from "../components/layout/SavedViewsBar";
import { Freshness } from "../components/layout/Freshness";
import { InvestigationFilterBar } from "../components/anomalies/InvestigationFilterBar";
import { AnomalyList } from "../components/anomalies/AnomalyList";
import { InvestigationDrawer } from "../components/anomalies/InvestigationDrawer";
import { MapContainer } from "../components/map/MapContainer";
import { Skeleton } from "../components/ui/Skeleton";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { useInvestigationFilters, anomalySeverity } from "../hooks/useInvestigationFilters";
import { useRecentStore } from "../store/recentStore";
import { exportAnomaliesCsv, exportAnomaliesGeoJson } from "../lib/export";
import { mockAnomalies } from "../mocks/anomalies";
import { mockFacilities } from "../mocks/facilities";
import { mockSources } from "../mocks/sources";
import { SearchX, AlertTriangle, RefreshCw } from "lucide-react";

const REFERENCE_NOW = new Date("2026-08-29T12:00:00Z").getTime();

export function Anomalies() {
  const { anomalyId: paramId } = useParams<{ anomalyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { filters: global } = useGlobalFilters();
  const { filters: inv, clearAll: clearInv, hasActive: hasInvActive } = useInvestigationFilters();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(paramId ?? null);
  const pushAnomaly = useRecentStore((s) => s.pushAnomaly);

  // simulate loading
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  // sync paramId -> selectedId
  useEffect(() => {
    if (paramId) setSelectedId(paramId);
    else if (paramId === undefined) {
      // when navigating back to /anomalies, clear selection if no param
      // keep last selection for UX? but spec says closing drawer clears
      // we handle close via navigate, so no auto-clear here
    }
  }, [paramId]);

  const filtered = useMemo(() => {
    return mockAnomalies.filter((a) => {
      // global
      if (global.region !== "all" && a.region !== global.region) return false;
      if (global.conf !== "all" && a.confidence < parseInt(global.conf, 10)) return false;
      if (global.range !== "all") {
        const d = (REFERENCE_NOW - new Date(a.detectedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (global.range === "7d" && d > 7) return false;
        if (global.range === "14d" && d > 14) return false;
        if (global.range === "30d" && d > 30) return false;
      }
      // investigation
      if (inv.q) {
        const q = inv.q.toLowerCase();
        const hay = `${a.id} ${a.classification} ${a.nearbyFacility?.name ?? ""} ${a.region}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (inv.class !== "all" && a.classification !== inv.class) return false;
      if (inv.severity !== "all" && anomalySeverity(a) !== inv.severity) return false;
      if (inv.frp !== "all") {
        if (inv.frp === "low" && a.frp >= 20) return false;
        if (inv.frp === "medium" && (a.frp < 20 || a.frp > 50)) return false;
        if (inv.frp === "high" && a.frp <= 50) return false;
      }
      if (inv.persist !== "all") {
        if (inv.persist === "low" && a.persistenceScore >= 0.4) return false;
        if (inv.persist === "medium" && (a.persistenceScore < 0.4 || a.persistenceScore >= 0.7)) return false;
        if (inv.persist === "high" && a.persistenceScore < 0.7) return false;
      }
      if (inv.status !== "all" && a.status !== inv.status) return false;
      return true;
    });
  }, [global, inv]);

  const facilitiesFiltered = useMemo(() => {
    if (global.region === "all") return mockFacilities;
    return mockFacilities.filter((f) => f.region === global.region);
  }, [global]);

  const sourcesFiltered = useMemo(() => {
    if (global.region === "all") return mockSources;
    return mockSources.filter((s) => s.region === global.region);
  }, [global]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return mockAnomalies.find((a) => a.id === selectedId) ?? null;
  }, [selectedId]);

  const selectedFacility = useMemo(() => {
    if (!selected?.nearbyFacility) return null;
    return mockFacilities.find((f) => f.id === selected.nearbyFacility!.id) ?? null;
  }, [selected]);

  const linkedSource = useMemo(() => {
    if (!selected) return null;
    // try find source near facility or same region/classification
    if (selected.nearbyFacility) {
      const s = mockSources.find((src) => src.nearbyFacility?.id === selected.nearbyFacility!.id);
      if (s) return s;
    }
    return mockSources.find((s) => s.classification === selected.classification && s.region === selected.region) ?? null;
  }, [selected]);

  const isNotFound = paramId && !mockAnomalies.some((a) => a.id === paramId);

  const openAnomaly = useCallback(
    (id: string) => {
      setSelectedId(id);
      pushAnomaly(id);
      const search = location.search;
      navigate(`/anomalies/${id}${search}`, { replace: false });
    },
    [navigate, location.search, pushAnomaly]
  );

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
    const search = location.search;
    navigate(`/anomalies${search}`, { replace: false });
  }, [navigate, location.search]);

  const handleMapSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      pushAnomaly(id);
      const search = location.search;
      navigate(`/anomalies/${id}${search}`, { replace: false });
    },
    [navigate, location.search, pushAnomaly]
  );

  const handleClearAll = () => {
    // clear investigation filters, keep global
    clearInv();
  };

  if (error) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6">
        <GlobalContextBar />
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--critical-border)] bg-[var(--critical-weak)] px-6 py-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-[var(--critical)]" />
          <p className="mt-2 text-[13px] font-medium text-[var(--critical-text)]">Could not load anomalies</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              setTimeout(() => setIsLoading(false), 400);
            }}
            className="mt-4 inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 space-y-4">
      <GlobalContextBar />
      <SavedViewsBar />
      <div className="flex items-center justify-between">
        <Freshness source="mock" timestamp={filtered[0]?.detectedAt} />
        <div className="flex gap-1.5">
          <button onClick={() => exportAnomaliesCsv(filtered)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
            Export CSV ({filtered.length})
          </button>
          <button onClick={() => exportAnomaliesGeoJson(filtered)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
            GeoJSON
          </button>
        </div>
      </div>
      <InvestigationFilterBar anomalies={mockAnomalies} filteredCount={filtered.length} />

      {/* 60% map / 40% list */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        {/* List — priority on mobile (order-1) */}
        <div className="order-1 xl:order-2 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-[360px] w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-6 py-10 text-center">
              <SearchX className="mx-auto h-6 w-6 text-[var(--text-faint)]" />
              <p className="mt-2 text-[13px] font-medium text-[var(--text-primary)]">No anomalies match these filters</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Try widening time, region, or investigation filters.</p>
              {(hasInvActive || global.region !== "all" || global.conf !== "80" || global.range !== "30d") && (
                <button onClick={handleClearAll} className="mt-3 inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <AnomalyList
              anomalies={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpen={openAnomaly}
            />
          )}
        </div>

        {/* Map — secondary on mobile */}
        <div className="order-2 xl:order-1 min-w-0">
          {isLoading ? (
            <Skeleton className="h-[380px] sm:h-[440px] lg:h-[560px] w-full rounded-[var(--radius-md)]" />
          ) : (
            <MapContainer
              anomalies={filtered}
              facilities={facilitiesFiltered}
              sources={sourcesFiltered}
              selectedAnomalyId={selectedId}
              onAnomalySelect={handleMapSelect}
            />
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-[11px] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">Visual encoding</span>
            <span className="hidden sm:inline h-3 w-px bg-[var(--border)]" aria-hidden="true" />
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] border border-white shadow-sm" /> Thermal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-[var(--accent)] bg-white" /> Facility
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]/20 border border-sky-300" /> Persistent
            </span>
            <span className="ml-auto hidden sm:inline text-[10px] text-[var(--text-faint)]">Click row or map marker to investigate</span>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {isNotFound ? (
        <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Not found">
          <button type="button" aria-label="Close" onClick={closeDrawer} className="absolute inset-0 bg-[#0f172a]/20 backdrop-blur-[1px]" />
          <div className="relative ml-auto flex h-full w-full max-w-[560px] flex-col bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] border-l border-[var(--border)]">
            <div className="p-6">
              <p className="text-[13px] font-semibold text-[var(--critical-text)]">Anomaly not found</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                No anomaly with ID <span className="font-mono font-medium text-[var(--text-primary)]">{paramId}</span> exists in the current dataset (24 mock anomalies).
              </p>
              <button
                onClick={closeDrawer}
                className="mt-4 inline-flex rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                Back to investigation
              </button>
            </div>
          </div>
        </div>
      ) : (
        <InvestigationDrawer
          anomaly={selected}
          facility={selectedFacility}
          source={linkedSource}
          open={!!selected && !isNotFound}
          onClose={closeDrawer}
          onFacilityView={() => {
            // navigate to facilities with highlight (mock)
            closeDrawer();
            // keep global filters
            navigate(`/facilities${location.search}`);
          }}
          onViewOnMap={() => {
            // keep drawer open, map already flying
          }}
        />
      )}
    </div>
  );
}
