import { Search } from "lucide-react";
import type { AnomalyClassification } from "../../types/anomaly";

const CLASSIFICATION_OPTIONS: {
  value: AnomalyClassification | "all";
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "industrial_fire", label: "Industrial Fire" },
  { value: "wildfire", label: "Wildfire" },
  { value: "agricultural_burn", label: "Agricultural Burn" },
  { value: "gas_flare", label: "Gas Flare" },
  { value: "mining", label: "Mining" },
  { value: "non_industrial", label: "Non-Industrial" },
  { value: "unknown", label: "Unknown" },
  { value: "other", label: "Other" },
];

export interface AnomalyFiltersState {
  search: string;
  classification: AnomalyClassification | "all";
  confidence: string;
  dateRange: string;
  frpRange: string;
  region: string;
}

interface Props {
  filters: AnomalyFiltersState;
  onChange: (next: AnomalyFiltersState) => void;
}

export function AnomalyFilters({ filters, onChange }: Props) {
  const update = (patch: Partial<AnomalyFiltersState>) => onChange({ ...filters, ...patch });

  const selectClass =
    "rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
  const inputClass =
    "w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Search</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="ID, facility…"
              className={`${inputClass} pl-7`}
            />
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Classification</span>
          <select
            value={filters.classification}
            onChange={(e) => update({ classification: e.target.value as AnomalyFiltersState["classification"] })}
            className={selectClass}
          >
            {CLASSIFICATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Confidence</span>
          <select value={filters.confidence} onChange={(e) => update({ confidence: e.target.value })} className={selectClass}>
            <option value="all">All</option>
            <option value="high">High ≥90%</option>
            <option value="medium">Medium 80–89%</option>
            <option value="low">Low &lt;80%</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Date range</span>
          <select value={filters.dateRange} onChange={(e) => update({ dateRange: e.target.value })} className={selectClass}>
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">FRP range</span>
          <select value={filters.frpRange} onChange={(e) => update({ frpRange: e.target.value })} className={selectClass}>
            <option value="all">All</option>
            <option value="low">&lt;20 MW</option>
            <option value="medium">20–50 MW</option>
            <option value="high">&gt;50 MW</option>
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
