import { useMemo, useState } from "react";
import { SourceFilters, type SourceFiltersState } from "../components/sources/SourceFilters";
import { SourceTable } from "../components/sources/SourceTable";
import { SourceDetailPanel } from "../components/sources/SourceDetailPanel";
import { MapContainer } from "../components/map/MapContainer";
import { StatsCard } from "../components/dashboard/StatsCard";
import { mockSources } from "../mocks/sources";
import { Layers, Flame, Factory, Eye } from "lucide-react";

export function Sources() {
  const [filters, setFilters] = useState<SourceFiltersState>({
    search: "",
    classification: "all",
    persistenceLevel: "all",
    region: "all",
  });
  const [selectedId, setSelectedId] = useState<string | null>(mockSources[0]?.id ?? null);

  const filtered = useMemo(() => {
    return mockSources.filter((s) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${s.id} ${s.classification} ${s.nearbyFacility?.name ?? ""} ${s.region}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.classification !== "all" && s.classification !== filters.classification) return false;
      if (filters.persistenceLevel !== "all" && s.persistenceLevel !== filters.persistenceLevel) return false;
      if (filters.region !== "all" && s.region !== filters.region) return false;
      return true;
    });
  }, [filters]);

  const selected = useMemo(() => filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null, [filtered, selectedId]);
  const effectiveId = selected?.id ?? null;

  const metrics = useMemo(() => {
    const total = mockSources.length;
    const high = mockSources.filter((s) => s.persistenceLevel === "high").length;
    const industrial = mockSources.filter((s) => s.classification === "industrial_fire").length;
    const underInvestigation = mockSources.filter((s) => s.status === "under_investigation").length;
    return { total, high, industrial, underInvestigation };
  }, []);

  return (
    <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Persistent Sources</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Locations where thermal activity repeatedly occurs over time. High persistence sources are prioritized for facility correlation.
        </p>
      </div>

      <section aria-label="Summary metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Persistent Sources" value={metrics.total} subtext="All monitored locations" icon={Layers} />
        <StatsCard label="High Persistence" value={metrics.high} subtext="Score ≥70% · priority review" icon={Flame} />
        <StatsCard label="Industrial" value={metrics.industrial} subtext="Industrial fire classification" icon={Factory} />
        <StatsCard label="Under Investigation" value={metrics.underInvestigation} subtext="Awaiting verification" icon={Eye} />
      </section>

      <SourceFilters filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <SourceTable sources={filtered} selectedId={effectiveId} onSelect={setSelectedId} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <MapContainer
            sources={filtered}
            selectedSourceId={effectiveId}
            onSourceSelect={setSelectedId}
          />
          <SourceDetailPanel source={selected ?? null} onClose={() => setSelectedId(null)} />
        </div>
      </div>
    </div>
  );
}
