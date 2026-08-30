import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Factory, Layers, BellRing, Activity, Flame } from "lucide-react";
import { RecentAlerts } from "../components/dashboard/RecentAlerts";
import { ClassificationSummary } from "../components/dashboard/ClassificationSummary";
import { MapContainer } from "../components/map/MapContainer";
import { TrendChart } from "../components/dashboard/TrendChart";
import { GlobalContextBar } from "../components/layout/GlobalContextBar";
import { SavedViewsBar } from "../components/layout/SavedViewsBar";
import { Freshness } from "../components/layout/Freshness";
import { exportAnomaliesCsv, exportAnomaliesGeoJson } from "../lib/export";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import { mockAnomalies } from "../mocks/anomalies";
import { mockFacilities } from "../mocks/facilities";
import { mockSources } from "../mocks/sources";
import { recentAlerts } from "../mocks/dashboard";
import type { ClassificationBreakdown } from "../types/dashboard";

const REFERENCE_NOW = new Date("2026-08-29T12:00:00Z").getTime();

function daysAgo(iso: string): number {
  return (REFERENCE_NOW - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export function Dashboard() {
  const { filters } = useGlobalFilters();
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

  // Filter anomalies by global context
  const filteredAnomalies = useMemo(() => {
    return mockAnomalies.filter((a) => {
      if (filters.region !== "all" && a.region !== filters.region) return false;
      if (filters.conf !== "all") {
        const thr = parseInt(filters.conf, 10);
        if (a.confidence < thr) return false;
      }
      if (filters.range !== "all") {
        const d = daysAgo(a.detectedAt);
        if (filters.range === "7d" && d > 7) return false;
        if (filters.range === "14d" && d > 14) return false;
        if (filters.range === "30d" && d > 30) return false;
      }
      return true;
    });
  }, [filters]);

  // Alerts filtered by same context (via linked anomaly)
  const filteredAlerts = useMemo(() => {
    const anomalyById = new Map(mockAnomalies.map((a) => [a.id, a]));
    return recentAlerts.filter((al) => {
      const an = anomalyById.get(al.anomalyId);
      if (!an) return true; // keep if anomaly not in mock set (demo)
      if (filters.region !== "all" && an.region !== filters.region) return false;
      if (filters.conf !== "all" && an.confidence < parseInt(filters.conf, 10)) return false;
      if (filters.range !== "all") {
        const d = daysAgo(an.detectedAt);
        if (filters.range === "7d" && d > 7) return false;
        if (filters.range === "14d" && d > 14) return false;
        if (filters.range === "30d" && d > 30) return false;
      }
      return true;
    });
  }, [filters]);

  const filteredFacilities = useMemo(() => {
    if (filters.region === "all") return mockFacilities;
    return mockFacilities.filter((f) => f.region === filters.region);
  }, [filters]);

  const filteredSources = useMemo(() => {
    if (filters.region === "all") return mockSources;
    return mockSources.filter((s) => s.region === filters.region);
  }, [filters]);

  // Derived metrics — honest, based on filtered mock, not fake 1,284
  const metrics = useMemo(() => {
    const total = filteredAnomalies.length;
    const industrial = filteredAnomalies.filter((a) => a.classification === "industrial_fire").length;
    const highConf = filteredAnomalies.filter((a) => a.confidence >= 90).length;
    const avgFrp = total ? (filteredAnomalies.reduce((s, a) => s + a.frp, 0) / total).toFixed(1) : "—";
    const activeAlerts = filteredAlerts.length;
    return { total, industrial, highConf, avgFrp, activeAlerts };
  }, [filteredAnomalies, filteredAlerts]);

  const classificationData: ClassificationBreakdown[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of filteredAnomalies) counts.set(a.classification, (counts.get(a.classification) ?? 0) + 1);
    const labels: Record<string, string> = {
      industrial_fire: "Industrial Fire",
      wildfire: "Wildfire",
      agricultural_burn: "Agricultural Burn",
      gas_flare: "Gas Flare",
      mining: "Mining",
      other: "Other",
    };
    const order = ["industrial_fire", "wildfire", "agricultural_burn", "gas_flare", "mining", "other"];
    return order
      .map((k) => ({ key: k as ClassificationBreakdown["key"], label: labels[k], count: counts.get(k) ?? 0 }))
      .filter((d) => d.count > 0);
  }, [filteredAnomalies]);

  // Map interaction: selecting alert highlights its anomaly
  const effectiveSelectedId = useMemo(() => {
    if (selectedAnomalyId && filteredAnomalies.some((a) => a.id === selectedAnomalyId)) return selectedAnomalyId;
    return filteredAnomalies[0]?.id ?? null;
  }, [selectedAnomalyId, filteredAnomalies]);

  const handleAlertSelect = (anomalyId: string) => {
    setSelectedAnomalyId(anomalyId);
  };

  return (
    <div className="px-3 py-4 sm:px-6 sm:py-4 space-y-4 max-w-[1600px] mx-auto">
      {/* Global context — URL synced */}
      <GlobalContextBar />
      <SavedViewsBar />
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

      {/* What requires attention + Where is it happening — PRIMARY */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_0.95fr]">
        {/* Map — primary surface */}
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Geographic situation</h2>
            <span className="text-[11px] text-[var(--text-faint)]">
              {metrics.total} detections · {filteredFacilities.length} facilities · {filteredSources.length} sources
            </span>
          </div>
          <MapContainer
            anomalies={filteredAnomalies}
            facilities={filteredFacilities}
            sources={filteredSources}
            selectedAnomalyId={effectiveSelectedId}
            onAnomalySelect={setSelectedAnomalyId}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-[11px] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">Visual encoding</span>
            <span className="hidden sm:inline h-3 w-px bg-[var(--border)]" aria-hidden="true" />
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] border border-white shadow-sm" /> Industrial / thermal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-[var(--accent)] bg-white" /> Facility
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]/20 border border-sky-300" /> Persistent
            </span>
            <span className="ml-auto hidden sm:inline text-[10px] text-[var(--text-faint)]">Size ∝ FRP / persistence · click to inspect</span>
          </div>
        </div>

        {/* Priority queue — What requires attention */}
        <div className="min-w-0 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 py-8 text-center">
              <p className="text-[13px] font-medium text-[var(--text-secondary)]">No alerts in this context</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Adjust time, region, or confidence to broaden results.</p>
            </div>
          ) : (
            <RecentAlerts
              alerts={filteredAlerts}
              selectedAnomalyId={effectiveSelectedId}
              onAlertSelect={handleAlertSelect}
            />
          )}
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">Operational note</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              Queue ordered by severity. Selection syncs map — verify facility proximity before escalation.
            </p>
          </div>
        </div>
      </div>

      {/* What has changed + What is happening — SECONDARY */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_0.95fr]">
        {/* Trend — What has changed over time */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Detection trend</h3>
            <span className="text-[11px] text-[var(--text-faint)]">
              {filters.range === "all" ? "All time" : filters.range} · {filteredAnomalies.length} events
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Daily detections vs. mean fire radiative power — filtered by current context.</p>
          <div className="mt-3">
            <TrendChart anomalies={filteredAnomalies} />
          </div>
        </div>

        {/* Classification + compact operational state */}
        <div className="space-y-4">
          <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white overflow-hidden">
            <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
              <h3 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Active operational state</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Derived from current filters — mock 24 anomalies</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)]">
              <div className="px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.04em] text-[var(--text-muted)]">DETECTIONS</span>
                  <Activity className="h-3 w-3 text-[var(--text-faint)]" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[20px] font-semibold tracking-tight text-[var(--text-primary)] operational-data">{metrics.total}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">events</span>
                </div>
                <div className="text-[11px] text-[var(--text-faint)]">in selected window</div>
              </div>
              <div className="px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.04em] text-[var(--text-muted)]">INDUSTRIAL</span>
                  <Factory className="h-3 w-3 text-[var(--text-faint)]" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[20px] font-semibold tracking-tight text-[var(--text-primary)] operational-data">{metrics.industrial}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">· {metrics.avgFrp} MW avg</span>
                </div>
                <div className="text-[11px] text-[var(--text-faint)]">industrial fire class</div>
              </div>
              <div className="px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.04em] text-[var(--text-muted)]">HIGH CONF.</span>
                  <Flame className="h-3 w-3 text-[var(--text-faint)]" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[20px] font-semibold tracking-tight text-[var(--text-primary)] operational-data">{metrics.highConf}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">≥90%</span>
                </div>
                <div className="text-[11px] text-[var(--text-faint)]">requires review</div>
              </div>
              <Link to="/alerts" className="group px-3 py-3 hover:bg-[var(--surface-subtle)] transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.04em] text-[var(--critical-text)]">ALERTS</span>
                  <BellRing className="h-3 w-3 text-[var(--critical)]" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[20px] font-semibold tracking-tight text-[var(--critical-text)] operational-data">{metrics.activeAlerts}</span>
                  <span className="text-[11px] text-[var(--critical-text)]">active</span>
                </div>
                <div className="text-[11px] text-[var(--text-faint)] group-hover:text-[var(--text-muted)]">view queue →</div>
              </Link>
            </div>
          </section>

          {classificationData.length > 0 ? (
            <ClassificationSummary data={classificationData} />
          ) : (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 py-6 text-center">
              <p className="text-[12px] font-medium text-[var(--text-secondary)]">No classifications in range</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Widen time or region filters to see distribution.</p>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
            <Layers className="h-3 w-3 mt-0.5 text-[var(--text-faint)]" />
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              Persistent sources: {filteredSources.length} tracked · threshold{" "}
              <span className="font-medium text-[var(--text-secondary)]">≥7 overpasses</span> ·{" "}
              <Link to="/map" className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-2">
                view on map
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
