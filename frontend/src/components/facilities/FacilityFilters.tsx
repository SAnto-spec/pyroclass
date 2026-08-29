import { Search } from "lucide-react";
import type { FacilityType } from "../../types/facility";

export interface FacilityFiltersState {
  search: string;
  type: FacilityType | "all";
  region: string;
}

interface Props {
  filters: FacilityFiltersState;
  onChange: (next: FacilityFiltersState) => void;
}

export function FacilityFilters({ filters, onChange }: Props) {
  const update = (patch: Partial<FacilityFiltersState>) => onChange({ ...filters, ...patch });

  const selectClass =
    "rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
  const inputClass =
    "w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Search facility</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Name, type…"
              className={`${inputClass} pl-7`}
            />
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Facility type</span>
          <select value={filters.type} onChange={(e) => update({ type: e.target.value as FacilityFiltersState["type"] })} className={selectClass}>
            <option value="all">All types</option>
            <option value="refinery">Refinery</option>
            <option value="power_plant">Power Plant</option>
            <option value="steel_plant">Steel Plant</option>
            <option value="mine">Mine</option>
            <option value="lng_terminal">LNG Terminal</option>
            <option value="petrochemical">Petrochemical</option>
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
