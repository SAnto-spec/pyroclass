import { useMemo, useState } from "react";
import { AlertFilters, type AlertFiltersState } from "../components/alerts/AlertFilters";
import { AlertList } from "../components/alerts/AlertList";
import { AlertDetailPanel } from "../components/alerts/AlertDetailPanel";
import { MapContainer } from "../components/map/MapContainer";
import { StatsCard } from "../components/dashboard/StatsCard";
import { mockAlerts } from "../mocks/alerts";
import { mockAnomalies } from "../mocks/anomalies";
import type { Alert } from "../types/alert";
import { BellRing, Siren, TriangleAlert, ShieldCheck } from "lucide-react";

const REFERENCE_NOW = new Date("2026-08-29T12:00:00Z").getTime();

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [filters, setFilters] = useState<AlertFiltersState>({
    search: "",
    severity: "all",
    status: "all",
    classification: "all",
    date: "all",
  });
  const [selectedId, setSelectedId] = useState<string | null>(mockAlerts[0]?.id ?? null);

  const anomalyById = useMemo(() => new Map(mockAnomalies.map((a) => [a.id, a])), []);

  const filtered = useMemo(() => {
    return alerts.filter((al) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!`${al.id} ${al.anomalyId} ${al.title}`.toLowerCase().includes(q)) return false;
      }
      if (filters.severity !== "all" && al.severity !== filters.severity) return false;
      if (filters.status !== "all" && al.status !== filters.status) return false;
      if (filters.classification !== "all") {
        const anomaly = anomalyById.get(al.anomalyId);
        if (!anomaly || anomaly.classification !== filters.classification) return false;
      }
      if (filters.date !== "all") {
        const diffDays = (REFERENCE_NOW - new Date(al.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (filters.date === "7d" && diffDays > 7) return false;
        if (filters.date === "14d" && diffDays > 14) return false;
        if (filters.date === "30d" && diffDays > 30) return false;
      }
      return true;
    });
  }, [alerts, filters, anomalyById]);

  const selected = useMemo(() => filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null, [filtered, selectedId]);
  const effectiveId = selected?.id ?? null;
  const selectedAnomaly = selected ? (anomalyById.get(selected.anomalyId) ?? null) : null;

  const metrics = useMemo(() => {
    const active = alerts.filter((a) => a.status === "active").length;
    const critical = alerts.filter((a) => a.severity === "critical").length;
    const high = alerts.filter((a) => a.severity === "high").length;
    const medium = alerts.filter((a) => a.severity === "medium").length;
    return { active, critical, high, medium };
  }, [alerts]);

  const handleStatusChange = (id: string, status: Alert["status"]) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  return (
    <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Alerts</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Operational review of high-value thermal events. Acknowledge and resolve locally — backend wiring will replace local state in Step 14.
        </p>
      </div>

      <section aria-label="Alert summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Active Alerts" value={metrics.active} subtext="Requires operator review" icon={BellRing} />
        <StatsCard label="Critical" value={metrics.critical} subtext="Immediate attention" icon={Siren} />
        <StatsCard label="High" value={metrics.high} subtext="High severity" icon={TriangleAlert} />
        <StatsCard label="Medium" value={metrics.medium} subtext="Under review" icon={ShieldCheck} />
      </section>

      <AlertFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <AlertList alerts={filtered} anomalyById={anomalyById} selectedId={effectiveId} onSelect={setSelectedId} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <MapContainer />
          <AlertDetailPanel alert={selected ?? null} anomaly={selectedAnomaly} onClose={() => setSelectedId(null)} onStatusChange={handleStatusChange} />
        </div>
      </div>
    </div>
  );
}
