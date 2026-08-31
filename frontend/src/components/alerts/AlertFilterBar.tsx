import { Search, X, SlidersHorizontal } from "lucide-react";
import { useAlertFilters } from "../../hooks/useAlertFilters";

interface Props {
  filteredCount: number;
  totalCount: number;
}

export function AlertFilterBar({ filteredCount, totalCount }: Props) {
  const { filters, set, clearAll, hasActive, activeCount } = useAlertFilters();

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.q) chips.push({ key: "q", label: `Search: ${filters.q}`, clear: () => set({ q: "" }) });
  if (filters.severity !== "all") chips.push({ key: "severity", label: `Severity: ${filters.severity}`, clear: () => set({ severity: "all" }) });
  if (filters.status !== "all") chips.push({ key: "status", label: `Status: ${filters.status}`, clear: () => set({ status: "all" }) });
  if (filters.class !== "all") chips.push({ key: "class", label: `Class: ${filters.class.replace("_", " ")}`, clear: () => set({ class: "all" }) });

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Search</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Alert, AN-001, Refinery…"
              className="h-7 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white pl-7 pr-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Severity</span>
          <select
            value={filters.severity}
            onChange={(e) => set({ severity: e.target.value as never })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Status</span>
          <select
            value={filters.status}
            onChange={(e) => set({ status: e.target.value as never })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Classification</span>
          <select
            value={filters.class}
            onChange={(e) => set({ class: e.target.value as never })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All</option>
            <option value="industrial_fire">Industrial Fire</option>
            <option value="wildfire">Wildfire</option>
            <option value="agricultural_burn">Agricultural Burn</option>
            <option value="gas_flare">Gas Flare</option>
            <option value="mining">Mining</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <SlidersHorizontal className="h-3 w-3" />
          <span className="tabular-nums">{filteredCount} of {totalCount} alerts</span>
          {hasActive && <span className="text-[var(--text-faint)]">· {activeCount} filters</span>}
        </span>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
              {c.label}
              <button type="button" onClick={c.clear} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-faint)] hover:bg-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="ml-auto flex gap-1.5">
          {hasActive && (
            <button type="button" onClick={clearAll} className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
              Clear all
            </button>
          )}
          <button type="button" disabled className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-[11px] font-medium text-[var(--text-faint)]">
            Save view
          </button>
        </div>
      </div>
    </div>
  );
}
