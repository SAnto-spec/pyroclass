import { useEffect, useState } from "react";

import { Flame, Factory, Layers, BellRing } from "lucide-react";

import { StatsCard } from "../components/dashboard/StatsCard";

import { RecentAlerts } from "../components/dashboard/RecentAlerts";

import { ClassificationSummary } from "../components/dashboard/ClassificationSummary";

import { MapContainer } from "../components/map/MapContainer";

import {
  getAnomalies,
  getFacilities,
} from "../api/anomalies";

import type { BackendFacility } from "../api/anomalies";

import type { ThermalAnomaly } from "../types/anomaly";

export function Dashboard() {
  const [anomalies, setAnomalies] = useState<ThermalAnomaly[]>([]);

  const [facilities, setFacilities] = useState<BackendFacility[]>([]);

  useEffect(() => {
  getAnomalies()
    .then(setAnomalies)
    .catch(() => setAnomalies([]));

  getFacilities()
    .then(setFacilities)
    .catch(() => setFacilities([]));
}, []);

  const totalAnomalies = anomalies.length;

  const industrialFires = anomalies.filter(
    (anomaly) => anomaly.classification === "industrial_fire"
  ).length;

  const persistentSources = anomalies.filter(
    (anomaly) => anomaly.persistenceScore >= 7
  ).length;

  const activeAlerts = anomalies.filter(
    (anomaly) => anomaly.status === "active"
  ).length;

  return (
    <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      {/* Page intro */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Operational Overview
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Current VIIRS & SLSTR detections across monitored region
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
            Region: Western India
          </span>

          <span className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
            ML classifications
          </span>
        </div>
      </div>

      {/* Statistics */}
      <section
        aria-labelledby="stats-heading"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id="stats-heading" className="sr-only">
          Key statistics
        </h2>

        <StatsCard
          label="Total Thermal Anomalies"
          value={totalAnomalies}
          subtext="Current monitored detections"
          icon={Flame}
        />

        <StatsCard
          label="Industrial Fires"
          value={industrialFires}
          subtext="ML classified industrial fires"
          icon={Factory}
        />

        <StatsCard
          label="Persistent Sources"
          value={persistentSources}
          subtext="7+ days of activity"
          icon={Layers}
        />

        <StatsCard
          label="Active Alerts"
          value={activeAlerts}
          subtext="High/critical priority"
          icon={BellRing}
        />
      </section>

      {/* Map + side panels */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <MapContainer
            anomalies={anomalies}
            facilities={facilities}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <RecentAlerts alerts={anomalies} />

          <ClassificationSummary anomalies={anomalies} />
        </div>
      </div>
    </div>
  );
}