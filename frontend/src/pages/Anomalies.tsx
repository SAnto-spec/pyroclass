import { useEffect, useMemo, useState } from "react";
import {
  AnomalyFilters,
  type AnomalyFiltersState,
} from "../components/anomalies/AnomalyFilters";
import { AnomalyTable } from "../components/anomalies/AnomalyTable";
import { AnomalyDetailPanel } from "../components/anomalies/AnomalyDetailPanel";
import { MapContainer } from "../components/map/MapContainer";
import { getAnomalies } from "../api/anomalies";
import type { ThermalAnomaly } from "../types/anomaly";

export function Anomalies() {
  const [anomalies, setAnomalies] = useState<ThermalAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<AnomalyFiltersState>({
    search: "",
    classification: "all",
    confidence: "all",
    dateRange: "all",
    frpRange: "all",
    region: "all",
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnomalies() {
      try {
        setLoading(true);
        setError(null);

        const data = await getAnomalies();

        if (cancelled) return;

        setAnomalies(data);

        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? `Failed to load thermal anomalies: ${err.message}`
            : "Failed to load thermal anomalies"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnomalies();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return anomalies.filter((a) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();

        const hay = `
          ${a.id}
          ${a.classification}
          ${a.nearbyFacility?.name ?? ""}
          ${a.region}
        `.toLowerCase();

        if (!hay.includes(q)) {
          return false;
        }
      }

      if (
        filters.classification !== "all" &&
        a.classification !== filters.classification
      ) {
        return false;
      }

      if (filters.confidence !== "all") {
        if (filters.confidence === "high" && a.confidence < 90) {
          return false;
        }

        if (
          filters.confidence === "medium" &&
          (a.confidence < 80 || a.confidence >= 90)
        ) {
          return false;
        }

        if (filters.confidence === "low" && a.confidence >= 80) {
          return false;
        }
      }

      if (filters.region !== "all" && a.region !== filters.region) {
        return false;
      }

      if (filters.frpRange !== "all") {
        if (filters.frpRange === "low" && a.frp >= 20) {
          return false;
        }

        if (
          filters.frpRange === "medium" &&
          (a.frp < 20 || a.frp > 50)
        ) {
          return false;
        }

        if (filters.frpRange === "high" && a.frp <= 50) {
          return false;
        }
      }

      if (filters.dateRange !== "all") {
        const detectedTime = new Date(a.detectedAt).getTime();
        const diffDays =
          (Date.now() - detectedTime) / (1000 * 60 * 60 * 24);

        if (filters.dateRange === "7d" && diffDays > 7) {
          return false;
        }

        if (filters.dateRange === "14d" && diffDays > 14) {
          return false;
        }

        if (filters.dateRange === "30d" && diffDays > 30) {
          return false;
        }
      }

      return true;
    });
  }, [anomalies, filters]);

  const selected = useMemo(
    () =>
      filtered.find((a) => a.id === selectedId) ??
      filtered[0] ??
      null,
    [filtered, selectedId]
  );

  const effectiveSelectedId = selected?.id ?? null;

  if (loading) {
    return (
      <div className="px-3 py-6 sm:px-6">
        <p className="text-sm text-slate-400">
          Loading thermal anomalies...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-6 sm:px-6">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Thermal Anomalies
        </h2>

        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Investigate satellite detections. Filter by classification,
          confidence and region. Select a row to inspect thermal properties
          and facility correlation.
        </p>
      </div>

      <AnomalyFilters
        filters={filters}
        onChange={setFilters}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <AnomalyTable
            anomalies={filtered}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <MapContainer
            anomalies={filtered}
            selectedAnomalyId={effectiveSelectedId}
            onAnomalySelect={setSelectedId}
          />

          <AnomalyDetailPanel
            anomaly={selected}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}