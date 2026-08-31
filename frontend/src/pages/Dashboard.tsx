import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Factory, Layers, BellRing, Flame } from "lucide-react";

import { StatsCard } from "../components/dashboard/StatsCard";
import { RecentAlerts } from "../components/dashboard/RecentAlerts";
import { ClassificationSummary } from "../components/dashboard/ClassificationSummary";
import { TrendChart } from "../components/dashboard/TrendChart";
import { MapContainer } from "../components/map/MapContainer";
import { GlobalContextBar } from "../components/layout/GlobalContextBar";
import { SavedViewsBar } from "../components/layout/SavedViewsBar";
import { Freshness } from "../components/layout/Freshness";
import { getAnomalies, getFacilities } from "../api/anomalies";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { useCommunityStore } from "../store/communityStore";
import type { BackendFacility } from "../types/facility";
import type { ThermalAnomaly } from "../types/anomaly";

const REFERENCE_NOW = new Date("2026-08-29T12:00:00Z").getTime();

function daysAgo(iso: string): number {
  return (REFERENCE_NOW - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export function Dashboard() {
  const { filters } = useGlobalFilters();
  const [anomalies, setAnomalies] = useState<ThermalAnomaly[]>([]);
  const [facilities, setFacilities] = useState<BackendFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const communityReports = useCommunityStore((state) => state.reports);

  const loadDashboard = () => {
    setLoading(true);
    setError(null);
    Promise.all([getAnomalies(), getFacilities()])
      .then(([nextAnomalies, nextFacilities]) => {
        setAnomalies(nextAnomalies);
        setFacilities(nextFacilities);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Failed to load dashboard data.");
        setAnomalies([]);
        setFacilities([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const filteredAnomalies = useMemo(() => anomalies.filter((anomaly) => {
    if (filters.region !== "all" && anomaly.region !== filters.region) return false;
    if (filters.conf !== "all" && anomaly.confidence < parseInt(filters.conf, 10)) return false;
    if (filters.range !== "all") {
      const ageDays = daysAgo(anomaly.detectedAt);
      if (filters.range === "7d" && ageDays > 7) return false;
      if (filters.range === "14d" && ageDays > 14) return false;
      if (filters.range === "30d" && ageDays > 30) return false;
    }
    return true;
  }), [anomalies, filters]);

  const filteredFacilities = facilities;

  const filteredCommunityReports = useMemo(() => communityReports.filter((report) => {
    if (!report.hotspotId) return true;
    const anomaly = anomalies.find((candidate) => candidate.id === report.hotspotId);
    return !anomaly || filteredAnomalies.some((candidate) => candidate.id === anomaly.id);
  }), [anomalies, communityReports, filteredAnomalies]);

  const metrics = useMemo(() => {
    const total = filteredAnomalies.length;
    const industrial = filteredAnomalies.filter((anomaly) => anomaly.classification === "industrial_fire").length;
    const persistent = filteredAnomalies.filter((anomaly) => anomaly.persistenceScore >= 7).length;
    const active = filteredAnomalies.filter((anomaly) => anomaly.status === "active").length;
    return { total, industrial, persistent, active };
  }, [filteredAnomalies]);

  const selectedId = selectedAnomalyId && filteredAnomalies.some((anomaly) => anomaly.id === selectedAnomalyId)
    ? selectedAnomalyId
    : null;

  if (loading) {
    return (
      <div className="px-3 py-6 sm:px-6">
        <Freshness source="api" />
        <p className="mt-4 text-sm text-[var(--text-muted)]">Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-6 sm:px-6">
        <GlobalContextBar />
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--critical-border)] bg-[var(--critical-weak)] px-6 py-8 text-center">
          <AlertTriangleIcon />
          <p className="mt-2 text-[13px] font-medium text-[var(--critical-text)]">Could not load dashboard data</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">{error}</p>
          <button type="button" onClick={loadDashboard} className="mt-4 inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <GlobalContextBar />
      <SavedViewsBar />
      <div className="flex items-center justify-between">
        <Freshness source="api" timestamp={filteredAnomalies[0]?.detectedAt} />
        <span className="text-[11px] text-[var(--text-faint)]">VIIRS / SLSTR · backend data</span>
      </div>

      <section aria-labelledby="stats-heading" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="stats-heading" className="sr-only">Key statistics</h2>
        <StatsCard label="Total Thermal Anomalies" value={metrics.total} subtext="Current monitored detections" icon={Flame} />
        <StatsCard label="Industrial Fires" value={metrics.industrial} subtext="ML classified industrial fires" icon={Factory} />
        <StatsCard label="Persistent Sources" value={metrics.persistent} subtext="7+ days of activity" icon={Layers} />
        <StatsCard label="Active Alerts" value={metrics.active} subtext="High/critical priority" icon={BellRing} href="/alerts" />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_0.95fr]">
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Geographic situation</h2>
            <span className="text-[11px] text-[var(--text-faint)]">{metrics.total} detections · {filteredFacilities.length} facilities · {filteredCommunityReports.length} ground</span>
          </div>
          <MapContainer anomalies={filteredAnomalies} facilities={filteredFacilities} communityReports={filteredCommunityReports} selectedAnomalyId={selectedId} onAnomalySelect={setSelectedAnomalyId} showReportButton={false} />
        </div>
        <div className="min-w-0 space-y-3">
          <RecentAlerts alerts={filteredAnomalies} selectedAnomalyId={selectedId} onAlertSelect={setSelectedAnomalyId} />
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-[11px] text-[var(--text-muted)]">Selection syncs the map. Verify facility proximity before escalation.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_0.95fr]">
        <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Detection trend</h3>
            <span className="text-[11px] text-[var(--text-faint)]">{filters.range === "all" ? "All time" : filters.range} · {filteredAnomalies.length} events</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Daily detections vs. mean fire radiative power, filtered by current context.</p>
          <div className="mt-3"><TrendChart anomalies={filteredAnomalies} /></div>
        </section>
        <div className="space-y-4">
          <ClassificationSummary anomalies={filteredAnomalies} />
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
            <Layers className="mt-0.5 h-3 w-3 text-[var(--text-faint)]" />
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">Persistent sources: {metrics.persistent} tracked · threshold <span className="font-medium text-[var(--text-secondary)]">≥7 overpasses</span> · <Link to="/map" className="underline underline-offset-2">view on map</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertTriangleIcon() {
  return <div className="mx-auto h-6 w-6 text-[var(--critical)]" aria-hidden="true">!</div>;
}
