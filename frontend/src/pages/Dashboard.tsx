import { Flame, Factory, Layers, BellRing } from "lucide-react";
import { StatsCard } from "../components/dashboard/StatsCard";
import { RecentAlerts } from "../components/dashboard/RecentAlerts";
import { ClassificationSummary } from "../components/dashboard/ClassificationSummary";
import { MapContainer } from "../components/map/MapContainer";
import {
  dashboardStats,
  recentAlerts,
  classificationSummary,
} from "../mocks/dashboard";

export function Dashboard() {
  return (
    <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      {/* Page intro */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Operational Overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Last 30 days · VIIRS & SLSTR detections across monitored region
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
            Region: Western India
          </span>
          <span className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
            Confidence ≥ 80%
          </span>
        </div>
      </div>

      {/* Statistics */}
      <section aria-labelledby="stats-heading" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="stats-heading" className="sr-only">
          Key statistics
        </h2>
        <StatsCard
          label="Total Thermal Anomalies"
          value={dashboardStats.totalAnomalies}
          subtext="Last 30 days · all classifications"
          icon={Flame}
        />
        <StatsCard
          label="Industrial Fires"
          value={dashboardStats.industrialFires}
          subtext="High confidence near facilities"
          icon={Factory}
        />
        <StatsCard
          label="Persistent Sources"
          value={dashboardStats.persistentSources}
          subtext="≥ 7 consecutive overpasses"
          icon={Layers}
        />
        <StatsCard
          label="Active Alerts"
          value={dashboardStats.activeAlerts}
          subtext="Requires operator review"
          icon={BellRing}
        />
      </section>

      {/* Map + side panels */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <MapContainer />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <RecentAlerts alerts={recentAlerts} />
          <ClassificationSummary data={classificationSummary} />
        </div>
      </div>
    </div>
  );
}
