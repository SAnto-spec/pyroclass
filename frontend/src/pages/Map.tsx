import { useMemo, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Locate, Maximize2, Copy, Layers, MapPin } from "lucide-react";
import { GlobalContextBar } from "../components/layout/GlobalContextBar";
import { SavedViewsBar } from "../components/layout/SavedViewsBar";
import { Freshness } from "../components/layout/Freshness";
import { MapContainer } from "../components/map/MapContainer";
import { ReportObservationModal } from "../components/community/ReportObservationModal";
import { DemoScenarioBar } from "../components/community/DemoScenarioBar";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { useRecentStore } from "../store/recentStore";
import { useCommunityStore } from "../store/communityStore";
import { exportAnomaliesCsv, exportAnomaliesGeoJson } from "../lib/export";
import { mockAnomalies } from "../mocks/anomalies";
import { mockFacilities } from "../mocks/facilities";
import { mockSources } from "../mocks/sources";
import * as maplibregl from "maplibre-gl";

const REFERENCE_NOW = new Date("2026-08-29T12:00:00Z").getTime();

export function MapPage() {
  const { filters: global } = useGlobalFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mapSearch, setMapSearch] = useState(searchParams.get("q") ?? "");
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(searchParams.get("anomaly"));
  const [selectedReportId, setSelectedReportId] = useState<string | null>(searchParams.get("report") ?? null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const communityReports = useCommunityStore((s) => s.reports);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [pickingActive, setPickingActive] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [initialHotspotId, setInitialHotspotId] = useState<string | null>(null);

  // sync anomaly/report param to state
  useEffect(() => {
    setSelectedAnomalyId(searchParams.get("anomaly"));
    setSelectedReportId(searchParams.get("report"));
  }, [searchParams]);

  const filteredAnomalies = useMemo(() => {
    return mockAnomalies.filter((a) => {
      if (global.region !== "all" && a.region !== global.region) return false;
      if (global.conf !== "all" && a.confidence < parseInt(global.conf, 10)) return false;
      if (global.range !== "all") {
        const d = (REFERENCE_NOW - new Date(a.detectedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (global.range === "7d" && d > 7) return false;
        if (global.range === "14d" && d > 14) return false;
        if (global.range === "30d" && d > 30) return false;
      }
      if (mapSearch) {
        const q = mapSearch.toLowerCase();
        const hay = `${a.id} ${a.classification} ${a.nearbyFacility?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [global, mapSearch]);

  const filteredFacilities = useMemo(() => {
    let list = mockFacilities;
    if (global.region !== "all") list = list.filter((f) => f.region === global.region);
    if (mapSearch) {
      const q = mapSearch.toLowerCase();
      list = list.filter((f) => `${f.id} ${f.name} ${f.type}`.toLowerCase().includes(q));
    }
    return list;
  }, [global, mapSearch]);

  const filteredSources = useMemo(() => {
    let list = mockSources;
    if (global.region !== "all") list = list.filter((s) => s.region === global.region);
    if (mapSearch) {
      const q = mapSearch.toLowerCase();
      list = list.filter((s) => `${s.id} ${s.classification} ${s.nearbyFacility?.name ?? ""}`.toLowerCase().includes(q));
    }
    return list;
  }, [global, mapSearch]);

  const [communityType, setCommunityType] = useState<string>("all");
  const [communityEvidence, setCommunityEvidence] = useState<"all" | "corroborated" | "disputed" | "unverified">("all");
  const [communityLinkage, setCommunityLinkage] = useState<"all" | "linked" | "unlinked">("all");

  const filteredCommunityReports = useMemo(() => {
    return communityReports.filter((r) => {
      if (communityType !== "all" && r.observationType !== communityType) return false;
      if (communityEvidence !== "all") {
        const group: "corroborated" | "disputed" | "unverified" = ["corroborated", "confirmed", "resolved"].includes(r.status)
          ? "corroborated"
          : ["disputed", "rejected"].includes(r.status)
            ? "disputed"
            : "unverified";
        if (group !== communityEvidence) return false;
      }
      if (communityLinkage !== "all") {
        const isLinked = r.hotspotId != null && r.hotspotId !== "";
        if (communityLinkage === "linked" && !isLinked) return false;
        if (communityLinkage === "unlinked" && isLinked) return false;
      }
      if (mapSearch) {
        const q = mapSearch.toLowerCase();
        const hay = `${r.id} ${r.observationType} ${r.hotspotId ?? ""} ${r.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (global.region !== "all" && r.hotspotId) {
        const an = mockAnomalies.find((a) => a.id === r.hotspotId);
        if (an && an.region !== global.region) return false;
      }
      return true;
    });
  }, [communityReports, communityType, communityEvidence, communityLinkage, mapSearch, global.region]);

  const pushAnomaly = useRecentStore((s) => s.pushAnomaly);
  const handleAnomalySelect = useCallback(
    (id: string) => {
      setSelectedAnomalyId(id);
      pushAnomaly(id);
      const next = new URLSearchParams(searchParams);
      next.set("anomaly", id);
      if (mapSearch) next.set("q", mapSearch);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams, mapSearch, pushAnomaly]
  );

  const handleReportSelect = useCallback(
    (id: string) => {
      setSelectedReportId(id);
      const next = new URLSearchParams(searchParams);
      next.set("report", id);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  const handleReportObservationClick = useCallback(() => {
    // Prefer selected anomaly hotspot as linked default, else map center
    let hotspot: string | null = selectedAnomalyId;
    let lat = 19.076;
    let lng = 72.877;
    if (mapInstance) {
      const c = mapInstance.getCenter();
      lat = c.lat;
      lng = c.lng;
    }
    if (pendingLocation) {
      lat = pendingLocation.lat;
      lng = pendingLocation.lng;
    }
    setPendingLocation({ lat, lng });
    setInitialHotspotId(hotspot);
    setReportModalOpen(true);
    setPickingActive(false);
  }, [mapInstance, pendingLocation, selectedAnomalyId]);

  const handleMapClickForPicking = useCallback((lngLat: { lng: number; lat: number }) => {
    setPendingLocation({ lat: lngLat.lat, lng: lngLat.lng });
    setPickingActive(false);
  }, []);

  const handlePickLocationRequest = useCallback(() => {
    setPickingActive((v) => !v);
  }, []);

  const handleSearchChange = (v: string) => {
    setMapSearch(v);
    const next = new URLSearchParams(searchParams);
    if (v) next.set("q", v);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const fitFiltered = useCallback(() => {
    if (!mapInstance || filteredAnomalies.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    filteredAnomalies.forEach((a) => bounds.extend([a.longitude, a.latitude]));
    if (!bounds.isEmpty()) {
      mapInstance.fitBounds(bounds, { padding: 40, maxZoom: 10, duration: 800 });
    }
  }, [mapInstance, filteredAnomalies]);

  const resetView = useCallback(() => {
    if (!mapInstance) return;
    mapInstance.easeTo({ center: [72.88, 19.07], zoom: 6, duration: 600 });
  }, [mapInstance]);

  const copyBounds = async () => {
    if (!mapInstance) return;
    const b = mapInstance.getBounds();
    const text = `${b.getSouth().toFixed(4)},${b.getWest().toFixed(4)} → ${b.getNorth().toFixed(4)},${b.getEast().toFixed(4)}`;
    await navigator.clipboard.writeText(text);
  };

  const selectedAnomaly = selectedAnomalyId ? mockAnomalies.find((a) => a.id === selectedAnomalyId) ?? null : null;

  // debut: when filtered changes, if selected not in filtered, clear? keep for URL
  useEffect(() => {
    if (selectedAnomalyId && !filteredAnomalies.some((a) => a.id === selectedAnomalyId) && !mapSearch) {
      // keep selected even if filtered out, but optionally clear — keep for deep link
    }
  }, [filteredAnomalies, selectedAnomalyId, mapSearch]);

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col">
      <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-6 space-y-3">
        <GlobalContextBar />
        <SavedViewsBar />
        <DemoScenarioBar />
        <div className="flex items-center justify-between">
          <Freshness source="mock" timestamp={filteredAnomalies[0]?.detectedAt} />
          <div className="flex gap-1.5">
            <button onClick={() => exportAnomaliesCsv(filteredAnomalies)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
              Export CSV ({filteredAnomalies.length})
            </button>
            <button onClick={() => exportAnomaliesGeoJson(filteredAnomalies)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
              GeoJSON
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-[360px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                value={mapSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search AN-001, REP-001, Refinery…"
                className="h-7 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white pl-7 pr-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
            </div>
            <span className="hidden sm:inline text-[11px] tabular-nums text-[var(--text-muted)]">
              {filteredAnomalies.length} anomalies · {filteredFacilities.length} facilities · {filteredSources.length} persistent · {filteredCommunityReports.length} ground
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={fitFiltered} className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
              <Maximize2 className="h-3 w-3" /> Fit filtered
            </button>
            <button onClick={resetView} className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
              <Locate className="h-3 w-3" /> Reset
            </button>
            <button onClick={copyBounds} className="hidden sm:inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
              <Copy className="h-3 w-3" /> Copy bounds
            </button>
          </div>
        </div>
        {/* Ground Observation filters — does not interfere with anomaly/facility layers */}
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
          <span className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-muted)]">Ground Observations</span>
          <span className="hidden sm:inline h-3 w-px bg-[var(--border)]" aria-hidden="true" />
          <select
            value={communityType}
            onChange={(e) => setCommunityType(e.target.value)}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[11px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            aria-label="Filter by observation type"
          >
            <option value="all">All types</option>
            <option value="fire_visible">Fire visible</option>
            <option value="smoke_visible">Smoke visible</option>
            <option value="industrial_activity">Industrial activity</option>
            <option value="agricultural_burning">Agricultural burning</option>
            <option value="no_fire_observed">No fire observed</option>
            <option value="fire_extinguished">Fire extinguished</option>
            <option value="false_alarm">False alarm</option>
            <option value="unknown">Unknown</option>
          </select>
          <select
            value={communityEvidence}
            onChange={(e) => setCommunityEvidence(e.target.value as typeof communityEvidence)}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[11px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            aria-label="Filter by community evidence"
          >
            <option value="all">All evidence</option>
            <option value="corroborated">Corroborated</option>
            <option value="disputed">Disputed</option>
            <option value="unverified">Unverified</option>
          </select>
          <select
            value={communityLinkage}
            onChange={(e) => setCommunityLinkage(e.target.value as typeof communityLinkage)}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[11px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            aria-label="Filter by linkage"
          >
            <option value="all">All linkages</option>
            <option value="linked">Linked to FIRMS</option>
            <option value="unlinked">Unlinked — candidate</option>
          </select>
          <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
            {filteredCommunityReports.length} / {communityReports.length} reports
          </span>
          {(communityType !== "all" || communityEvidence !== "all" || communityLinkage !== "all") && (
            <button
              onClick={() => {
                setCommunityType("all");
                setCommunityEvidence("all");
                setCommunityLinkage("all");
              }}
              className="ml-auto inline-flex h-7 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              Clear ground filters
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-3 px-3 pb-3 sm:px-6">
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
          <MapContainer
            anomalies={filteredAnomalies}
            facilities={filteredFacilities}
            sources={filteredSources}
            communityReports={filteredCommunityReports}
            selectedAnomalyId={selectedAnomalyId}
            selectedReportId={selectedReportId}
            onAnomalySelect={handleAnomalySelect}
            onReportSelect={handleReportSelect}
            onMapClick={handleMapClickForPicking}
            onReportObservationClick={handleReportObservationClick}
            pickingActive={pickingActive}
            pickingCoords={pendingLocation}
            onMapReady={setMapInstance}
            className="relative flex flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] h-[calc(100vh-240px)] min-h-[520px] lg:min-h-[560px]"
          />
          <ReportObservationModal
            open={reportModalOpen}
            onClose={() => {
              setReportModalOpen(false);
              setPickingActive(false);
            }}
            initialLat={pendingLocation?.lat ?? null}
            initialLng={pendingLocation?.lng ?? null}
            initialHotspotId={initialHotspotId}
            onPickLocationRequest={handlePickLocationRequest}
            pickingActive={pickingActive}
            onSubmitted={(id) => {
              handleReportSelect(id);
              // ensure report is visible: fly handled by MapContainer via selectedReportId
            }}
          />

          {/* Legend — proper */}
          <div className="absolute bottom-2 left-2 z-[1] rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 shadow-[var(--shadow-md)]">
            <p className="text-[10px] font-semibold tracking-[0.05em] text-[var(--text-faint)]">LEGEND</p>
            <div className="mt-2 space-y-2 text-[11px]">
              <div>
                <p className="font-medium text-[var(--text-secondary)] flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--critical)]" /> Thermal anomaly
                </p>
                <div className="mt-1 ml-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--critical-border)] bg-[var(--critical-weak)] px-1 py-0.5 text-[10px] font-medium text-[var(--critical-text)]">Critical</span>
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--high-border)] bg-[var(--high-weak)] px-1 py-0.5 text-[10px] font-medium text-[var(--high-text)]">High</span>
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--medium-border)] bg-[var(--medium-weak)] px-1 py-0.5 text-[10px] font-medium text-[var(--medium-text)]">Medium</span>
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--low-border)] bg-[var(--low-weak)] px-1 py-0.5 text-[10px] font-medium text-[var(--low-text)]">Low</span>
                </div>
                <p className="ml-3 mt-1 text-[10px] text-[var(--text-faint)]">Size ∝ FRP (5–70 MW → 5–14 px)</p>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-2">
                <p className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-[var(--accent)] bg-white" /> Industrial facility
                </p>
                <p className="ml-4 text-[10px] text-[var(--text-faint)]">Refinery, plant, mine — slate fill, amber stroke</p>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-2">
                <p className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]/20 border border-sky-300" /> Persistent source
                </p>
                <p className="ml-4 text-[10px] text-[var(--text-faint)]">≥7 overpasses — opacity 0.55, size ∝ persistence</p>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-2">
                <p className="inline-flex items-center gap-1.5 font-medium text-[#0f766e]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0f766e] border border-white shadow-sm" /> Ground Observation
                </p>
                <div className="ml-4 mt-1 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#99f6e4] bg-[#f0fdfa] px-1 py-0.5 text-[10px] font-medium text-[#0f766e]">Corroborated</span>
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#fed7aa] bg-[#fff7ed] px-1 py-0.5 text-[10px] font-medium text-[#9a3412]">Disputed</span>
                  <span className="inline-flex items-center gap-1 rounded-[4px] border border-[#e2e8f0] bg-[#f8fafc] px-1 py-0.5 text-[10px] font-medium text-[#475569]">Unverified</span>
                </div>
                <p className="ml-4 mt-1 text-[10px] text-[var(--text-faint)]">Teal / amber / slate · dashed link to FIRMS when linked</p>
              </div>
            </div>
          </div>

          {/* Selected context */}
          {selectedAnomaly && (
            <div className="absolute bottom-2 right-2 z-[1] max-w-[280px] rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-2.5 shadow-[var(--shadow-md)]">
              <p className="text-[11px] font-semibold text-[var(--text-primary)]">{selectedAnomaly.id} · {selectedAnomaly.classification.replace("_", " ")}</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {selectedAnomaly.confidence}% · {selectedAnomaly.frp.toFixed(1)} MW · {(selectedAnomaly.persistenceScore * 100).toFixed(0)}% · {selectedAnomaly.region}
              </p>
              {selectedAnomaly.nearbyFacility && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                  <MapPin className="h-3 w-3 text-[var(--text-faint)]" /> {selectedAnomaly.nearbyFacility.name} · {selectedAnomaly.nearbyFacility.distanceKm} km
                </p>
              )}
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => {
                    const search = window.location.search;
                    window.location.href = `/anomalies/${selectedAnomaly.id}${search}`;
                  }}
                  className="flex-1 rounded-[var(--radius-md)] bg-[var(--text-primary)] px-2 py-1 text-[11px] font-medium text-white hover:bg-black"
                >
                  Open investigation
                </button>
                <button
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("anomaly");
                    setSearchParams(next, { replace: true });
                    setSelectedAnomalyId(null);
                  }}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Accessible list alternative — desktop side, mobile bottom sheet style minimal */}
        <div className="hidden w-[320px] shrink-0 flex-col gap-3 lg:flex">
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
              <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Filtered anomalies</p>
              <p className="text-[11px] text-[var(--text-muted)] tabular-nums">{filteredAnomalies.length} in view · keyboard accessible</p>
            </div>
            <div className="max-h-[480px] overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {filteredAnomalies.slice(0, 20).map((a) => {
                const isSel = a.id === selectedAnomalyId;
                return (
                  <button
                    key={a.id}
                    onClick={() => handleAnomalySelect(a.id)}
                    className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-[var(--surface-subtle)] ${isSel ? "bg-[var(--accent-weak)]" : ""}`}
                  >
                    <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">{a.id}</span>
                    <span className="text-[11px] text-[var(--text-secondary)]">{a.classification.replace("_", " ")} · {a.confidence}% · {a.frp.toFixed(1)} MW</span>
                    <span className="text-[11px] tabular-nums text-[var(--text-faint)]">{a.latitude.toFixed(3)}, {a.longitude.toFixed(3)} · {a.region}</span>
                  </button>
                );
              })}
              {filteredAnomalies.length > 20 && <p className="px-3 py-2 text-center text-[11px] text-[var(--text-faint)]">… {filteredAnomalies.length - 20} more · use Investigate for full list</p>}
              {filteredAnomalies.length === 0 && <p className="px-3 py-6 text-center text-[11px] text-[var(--text-muted)]">No anomalies match map filters</p>}
            </div>
            <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2">
              <p className="text-[10px] leading-relaxed text-[var(--text-faint)]">Canvas map not keyboard accessible — this list provides equivalent access. Use ↑/↓ in Investigate for full keyboard workflow.</p>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
            <p className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
              <Layers className="h-3 w-3" /> Keyboard
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">Use Investigate for ↑/↓, Enter, Esc. Map is mouse/touch primary; this list is the accessible alternative.</p>
          </div>
        </div>
      </div>

      {/* Mobile list alternative */}
      <div className="mx-auto w-full max-w-[1600px] px-3 pb-3 sm:px-6 lg:hidden">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <p className="text-[11px] font-semibold text-[var(--text-primary)]">Filtered anomalies (mobile)</p>
            <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{filteredAnomalies.length}</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {filteredAnomalies.slice(0, 8).map((a) => (
              <button key={a.id} onClick={() => handleAnomalySelect(a.id)} className={`flex w-full items-center justify-between px-3 py-2 text-left ${a.id === selectedAnomalyId ? "bg-[var(--accent-weak)]" : "hover:bg-[var(--surface-subtle)]"}`}>
                <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">{a.id}</span>
                <span className="text-[11px] text-[var(--text-muted)] truncate ml-2">{a.classification.replace("_", " ")} · {a.frp.toFixed(1)} MW</span>
                <span className="ml-auto text-[11px] tabular-nums text-[var(--text-faint)]">{a.confidence}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
