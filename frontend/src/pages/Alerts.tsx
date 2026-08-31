import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { GlobalContextBar } from "../components/layout/GlobalContextBar";
import { SavedViewsBar } from "../components/layout/SavedViewsBar";
import { Freshness } from "../components/layout/Freshness";
import { AlertFilterBar } from "../components/alerts/AlertFilterBar";
import { AlertQueue } from "../components/alerts/AlertQueue";
import { AlertDrawer } from "../components/alerts/AlertDrawer";
import { MapContainer } from "../components/map/MapContainer";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { useAlertFilters } from "../hooks/useAlertFilters";
import { useRecentStore } from "../store/recentStore";
import { exportAlertsCsv } from "../lib/export";
import { mockAlerts } from "../mocks/alerts";
import { mockAnomalies } from "../mocks/anomalies";
import { mockSources } from "../mocks/sources";
import type { Alert } from "../types/alert";
import type { BackendFacility, FacilityType, IndustrialFacility } from "../types/facility";
import { getFacilities } from "../api/anomalies";

function toFacilityType(value: string | null): FacilityType {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "refinery" || normalized === "power_plant" || normalized === "steel_plant" || normalized === "mine" || normalized === "lng_terminal" || normalized === "petrochemical" || normalized === "industrial") {
    return normalized;
  }
  return "industrial";
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

const REFERENCE_NOW = new Date("2026-08-29T12:00:00Z").getTime();

export function Alerts() {
  const { filters: global } = useGlobalFilters();
  const { filters: alertFilters } = useAlertFilters();
  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities, staleTime: 60000 });
  const [searchParams, setSearchParams] = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const pushAlert = useRecentStore((s) => s.pushAlert);
  const latestAlert = [...alerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const selectedAlertId = searchParams.get("alert");
  const [selectedId, setSelectedId] = useState<string | null>(selectedAlertId);

  useEffect(() => {
    setSelectedId(selectedAlertId);
  }, [selectedAlertId]);

  const anomalyById = useMemo(() => new Map(mockAnomalies.map((a) => [a.id, a])), []);
  const facilities = facilitiesQuery.data ?? [];
  const facilityById = useMemo(() => new Map(facilities.map((facility) => {
    const display = toDisplayFacility(facility);
    return [display.id, display] as const;
  })), [facilities]);

  // filtered alerts (global + alert filters)
  const filtered = useMemo(() => {
    return alerts.filter((al) => {
      const an = anomalyById.get(al.anomalyId);
      // global region/conf/range
      if (an) {
        if (global.region !== "all" && an.region !== global.region) return false;
        if (global.conf !== "all" && an.confidence < parseInt(global.conf, 10)) return false;
        if (global.range !== "all") {
          const d = (REFERENCE_NOW - new Date(al.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (global.range === "7d" && d > 7) return false;
          if (global.range === "14d" && d > 14) return false;
          if (global.range === "30d" && d > 30) return false;
        }
        if (alertFilters.class !== "all" && an.classification !== alertFilters.class) return false;
      } else {
        // if anomaly not found, only check global date
        if (global.range !== "all") {
          const d = (REFERENCE_NOW - new Date(al.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (global.range === "7d" && d > 7) return false;
          if (global.range === "14d" && d > 14) return false;
          if (global.range === "30d" && d > 30) return false;
        }
      }

      if (alertFilters.q) {
        const q = alertFilters.q.toLowerCase();
        const hay = `${al.id} ${al.anomalyId} ${al.title} ${an?.nearbyFacility?.name ?? ""} ${an?.classification ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (alertFilters.severity !== "all" && al.severity !== alertFilters.severity) return false;
      if (alertFilters.status !== "all" && al.status !== alertFilters.status) return false;
      return true;
    });
  }, [alerts, alertFilters, anomalyById, global]);

  const selected = useMemo(() => filtered.find((a) => a.id === selectedId) ?? (selectedId ? alerts.find((a) => a.id === selectedId) ?? null : null), [filtered, alerts, selectedId]);
  const selectedAnomaly = selected ? (anomalyById.get(selected.anomalyId) ?? null) : null;
  const selectedFacility = selectedAnomaly?.nearbyFacility ? (facilityById.get(selectedAnomaly.nearbyFacility.id) ?? null) : null;

  const filteredAnomaliesForMap = useMemo(() => {
    // map shows global-filtered anomalies (same as Overview) but highlight only filtered alerts' anomalies
    // For Alerts page, show all anomalies that pass global filter (so geographic context)
    return mockAnomalies.filter((a) => {
      if (global.region !== "all" && a.region !== global.region) return false;
      if (global.conf !== "all" && a.confidence < parseInt(global.conf, 10)) return false;
      if (global.range !== "all") {
        const d = (REFERENCE_NOW - new Date(a.detectedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (global.range === "7d" && d > 7) return false;
        if (global.range === "14d" && d > 14) return false;
        if (global.range === "30d" && d > 30) return false;
      }
      return true;
    });
  }, [global]);

  const filteredFacilities = useMemo(() => {
    return facilities;
  }, [facilities]);

  const filteredSources = useMemo(() => {
    if (global.region === "all") return mockSources;
    return mockSources.filter((s) => s.region === global.region);
  }, [global]);

  const selectAlert = useCallback(
    (id: string) => {
      pushAlert(id);
      const next = new URLSearchParams(searchParams);
      next.set("alert", id);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams, pushAlert]
  );

  const closeDrawer = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("alert");
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  const handleMapAnomalySelect = useCallback(
    (anomalyId: string) => {
      const foundAlert = filtered.find((al) => al.anomalyId === anomalyId) ?? alerts.find((al) => al.anomalyId === anomalyId);
      if (foundAlert) {
        selectAlert(foundAlert.id);
      } else {
        // if no alert for anomaly, still select anomaly on map (no alert drawer)
        // For Alerts page, we only show alert drawer, so ignore
      }
    },
    [filtered, alerts, selectAlert]
  );

  const handleAcknowledge = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "acknowledged" as const } : a)));
  };
  const handleResolve = (id: string, _note: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "resolved" as const } : a)));
  };
  const handleEscalate = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const next = a.severity === "low" ? "medium" : a.severity === "medium" ? "high" : a.severity === "high" ? "critical" : "critical";
        return { ...a, severity: next as never };
      })
    );
  };

  const handleViewOnMap = useCallback(() => {
    // map already highlights selectedAnomaly; drawer stays open
  }, []);

  const toggleBulk = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (bulkSelected.size === filtered.length) setBulkSelected(new Set());
    else setBulkSelected(new Set(filtered.map((a) => a.id)));
  };

  const bulkAcknowledge = () => {
    if (bulkSelected.size === 0) return;
    setAlerts((prev) => prev.map((a) => (bulkSelected.has(a.id) ? { ...a, status: "acknowledged" as const } : a)));
    setBulkSelected(new Set());
  };

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 space-y-4">
      <GlobalContextBar />
      <SavedViewsBar />
      <div className="flex items-center justify-between">
        <Freshness source="mock" timestamp={latestAlert?.createdAt} />
        <button onClick={() => exportAlertsCsv(filtered)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
          Export CSV ({filtered.length})
        </button>
      </div>
      <AlertFilterBar filteredCount={filtered.length} totalCount={alerts.length} />

      {/* Bulk bar */}
      {bulkSelected.size > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-weak)] px-3 py-2">
          <span className="text-[11px] font-medium text-[var(--accent-muted)] tabular-nums">{bulkSelected.size} selected</span>
          <button onClick={bulkAcknowledge} className="ml-auto inline-flex rounded-[var(--radius-md)] bg-[var(--text-primary)] px-3 py-1 text-[11px] font-medium text-white hover:bg-black">
            Acknowledge selected
          </button>
          <button onClick={() => setBulkSelected(new Set())} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_1.15fr]">
        {/* Queue */}
        <div className="min-w-0 order-1">
          <AlertQueue
            alerts={filtered}
            anomalyById={anomalyById}
            selectedId={selected?.id ?? null}
            onSelect={selectAlert}
            onOpen={selectAlert}
            bulkSelected={bulkSelected}
            onToggleBulk={toggleBulk}
            onToggleAll={toggleAll}
          />
        </div>

        {/* Map + context */}
        <div className="min-w-0 order-2 flex flex-col gap-4">
          <div className="min-w-0">
            <MapContainer
              anomalies={filteredAnomaliesForMap}
              facilities={filteredFacilities}
              sources={filteredSources}
              selectedAnomalyId={selectedAnomaly?.id ?? null}
              onAnomalySelect={handleMapAnomalySelect}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-[11px] text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text-secondary)]">Map context</span>
              <span className="hidden sm:inline h-3 w-px bg-[var(--border)]" />
              <span>{filteredAnomaliesForMap.length} anomalies in view</span>
              <span className="ml-auto hidden sm:inline text-[10px] text-[var(--text-faint)]">Select alert to fly to anomaly · click map marker to focus queue</span>
            </div>
          </div>

          {/* Quick stats — light, not dark cards */}
          <div className="hidden xl:grid grid-cols-3 divide-x divide-[var(--border)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-center">
            <div className="px-3 py-3">
              <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">ACTIVE</p>
              <p className="text-[18px] font-semibold text-[var(--critical-text)] tabular-nums">{alerts.filter((a) => a.status === "active").length}</p>
            </div>
            <div className="px-3 py-3">
              <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">ACKNOWLEDGED</p>
              <p className="text-[18px] font-semibold text-[var(--text-secondary)] tabular-nums">{alerts.filter((a) => a.status === "acknowledged").length}</p>
            </div>
            <div className="px-3 py-3">
              <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">RESOLVED</p>
              <p className="text-[18px] font-semibold text-[var(--success-text)] tabular-nums">{alerts.filter((a) => a.status === "resolved").length}</p>
            </div>
          </div>
        </div>
      </div>

      <AlertDrawer
        alert={selected}
        anomaly={selectedAnomaly}
        facility={selectedFacility}
        open={!!selected}
        onClose={closeDrawer}
        onAcknowledge={handleAcknowledge}
        onResolve={handleResolve}
        onEscalate={handleEscalate}
        onViewOnMap={handleViewOnMap}
      />
    </div>
  );
}
