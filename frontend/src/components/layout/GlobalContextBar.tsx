import { Clock3, MapPin, SlidersHorizontal, RefreshCw } from "lucide-react";
import { useGlobalFilters } from "../../hooks/useGlobalFilters";
import type { TimeRange, Region, Confidence } from "../../hooks/useGlobalFilters";

const rangeOptions: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const regionOptions: { value: Region; label: string }[] = [
  { value: "all", label: "All regions" },
  { value: "Western India", label: "Western India" },
  { value: "Central India", label: "Central India" },
  { value: "Eastern India", label: "Eastern India" },
];

const confOptions: { value: Confidence; label: string }[] = [
  { value: "all", label: "Any confidence" },
  { value: "80", label: "≥ 80%" },
  { value: "90", label: "≥ 90%" },
];

export function GlobalContextBar() {
  const { filters, set, refresh } = useGlobalFilters();

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <Clock3 className="h-3 w-3 text-[var(--text-faint)]" aria-hidden="true" />
          <select
            value={filters.range}
            onChange={(e) => set({ range: e.target.value as TimeRange })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[11px] font-medium text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            aria-label="Time range"
          >
            {rangeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-[var(--text-faint)]" aria-hidden="true" />
          <select
            value={filters.region}
            onChange={(e) => set({ region: e.target.value as Region })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[11px] font-medium text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            aria-label="Region"
          >
            {regionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3 w-3 text-[var(--text-faint)]" aria-hidden="true" />
          <select
            value={filters.conf}
            onChange={(e) => set({ conf: e.target.value as Confidence })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[11px] font-medium text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            aria-label="Confidence threshold"
          >
            {confOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <span className="hidden lg:inline-flex items-center gap-1 rounded-[4px] bg-[var(--surface-subtle)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] leading-none text-[var(--text-faint)]">
          VIIRS / SLSTR
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
          <span className="tabular-nums">Updated 4m ago</span>
          <span className="hidden sm:inline text-[var(--text-faint)]">· ~08:30 UTC</span>
        </span>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:border-[var(--border-strong)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>
    </div>
  );
}
