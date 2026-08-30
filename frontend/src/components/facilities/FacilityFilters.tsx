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
    "h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";
  const inputClass =
    "h-7 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Search facility</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Name, type…"
              className={`${inputClass} pl-7`}
            />
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Facility type</span>
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
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Region</span>
          <select value={filters.region} onChange={(e) => update({ region: e.target.value })} className={selectClass}>
            <option value="all">All regions</option>
            <option value="Western India">Western India</option>
            <option value="Central India">Central India</option>
            <option value="Eastern India">Eastern India</option>
          </select>
        </label>
      </div>

      {(filters.search || filters.type !== "all" || filters.region !== "all") && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2.5">
          <span className="text-[11px] text-[var(--text-faint)]">
            {[
              filters.search ? `Search: ${filters.search}` : null,
              filters.type !== "all" ? `Type: ${filters.type.replace("_", " ")}` : null,
              filters.region !== "all" ? `Region: ${filters.region}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <button
            type="button"
            onClick={() => onChange({ search: "", type: "all", region: "all" })}
            className="ml-auto inline-flex h-6 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
