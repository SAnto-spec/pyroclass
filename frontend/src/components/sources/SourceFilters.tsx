import { Search } from "lucide-react";
import type { AnomalyClassification } from "../../types/anomaly";
import type { PersistenceLevel } from "../../types/source";

export interface SourceFiltersState {
  search: string;
  classification: AnomalyClassification | "all";
  persistenceLevel: PersistenceLevel | "all";
  region: string;
}

interface Props {
  filters: SourceFiltersState;
  onChange: (next: SourceFiltersState) => void;
}

export function SourceFilters({ filters, onChange }: Props) {
  const update = (p: Partial<SourceFiltersState>) => onChange({ ...filters, ...p });
  const selectClass = "rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
  const inputClass = "w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Search</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input value={filters.search} onChange={(e) => update({ search: e.target.value })} placeholder="SRC-*, facility…" className={`${inputClass} pl-7`} />
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Classification</span>
          <select value={filters.classification} onChange={(e) => update({ classification: e.target.value as SourceFiltersState["classification"] })} className={selectClass}>
            <option value="all">All</option>
            <option value="industrial_fire">Industrial Fire</option>
            <option value="Vegetation Fire">Vegetation Fire</option>
            <option value="agricultural_burn">Agricultural Burn</option>
            <option value="gas_flare">Gas Flare</option>
            <option value="mining">Mining</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Persistence level</span>
          <select value={filters.persistenceLevel} onChange={(e) => update({ persistenceLevel: e.target.value as SourceFiltersState["persistenceLevel"] })} className={selectClass}>
            <option value="all">All levels</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Region</span>
          <select value={filters.region} onChange={(e) => update({ region: e.target.value })} className={selectClass}>
            <option value="all">All regions</option>
            <option value="Western India">Western India</option>
            <option value="Central India">Central India</option>
            <option value="Eastern India">Eastern India</option>
          </select>
        </label>
      </div>
    </div>
  );
}
