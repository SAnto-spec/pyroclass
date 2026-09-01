import { Search, X, SlidersHorizontal } from "lucide-react";
import { useInvestigationFilters } from "../../hooks/useInvestigationFilters";

type Chip = { key: string; label: string; onClear: () => void };

interface Props {
  anomalies: unknown[]; // for count display only
  filteredCount: number;
}

export function InvestigationFilterBar({ filteredCount }: Props) {
  const { filters, set, clearAll, hasActive, activeCount } = useInvestigationFilters();

  const chips: Chip[] = [];
  if (filters.q) chips.push({ key: "q", label: `Search: ${filters.q}`, onClear: () => set({ q: "" }) });
  if (filters.class !== "all") chips.push({ key: "class", label: `Class: ${filters.class.replace("_", " ")}`, onClear: () => set({ class: "all" }) });
  if (filters.severity !== "all") chips.push({ key: "severity", label: `Severity: ${filters.severity}`, onClear: () => set({ severity: "all" }) });
  if (filters.frp !== "all") chips.push({ key: "frp", label: `FRP: ${filters.frp}`, onClear: () => set({ frp: "all" }) });
  if (filters.persist !== "all") chips.push({ key: "persist", label: `Persist: ${filters.persist}`, onClear: () => set({ persist: "all" }) });
  if (filters.status !== "all") chips.push({ key: "status", label: `Status: ${filters.status}`, onClear: () => set({ status: "all" }) });

  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
      {/* Controls */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Search</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={filters.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="AN-001, Refinery…"
              className="h-7 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white pl-7 pr-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </span>
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
            <option value="Vegetation Fire">Vegetation Fire</option>
            <option value="agricultural_burn">Agricultural Burn</option>
            <option value="gas_flare">Gas Flare</option>
            <option value="mining">Mining</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Severity</span>
          <select
            value={filters.severity}
            onChange={(e) => set({ severity: e.target.value as never })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">FRP range</span>
          <select
            value={filters.frp}
            onChange={(e) => set({ frp: e.target.value as never })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All</option>
            <option value="low">&lt;20 MW</option>
            <option value="medium">20–50 MW</option>
            <option value="high">&gt;50 MW</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Persistence</span>
          <select
            value={filters.persist}
            onChange={(e) => set({ persist: e.target.value as never })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All</option>
            <option value="high">High ≥70%</option>
            <option value="medium">Medium 40–70%</option>
            <option value="low">Low &lt;40%</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Status</span>
          <select
            value={filters.status}
            onChange={(e) => set({ status: e.target.value as never })}
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text-secondary)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="review">Review</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </div>

      {/* Chips + actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <SlidersHorizontal className="h-3 w-3" />
          <span className="tabular-nums">{filteredCount} results</span>
          {hasActive && <span className="text-[var(--text-faint)]">· {activeCount} filters</span>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
            >
              {c.label}
              <button
                type="button"
                onClick={c.onClear}
                aria-label={`Clear ${c.label}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-faint)] hover:bg-white hover:text-[var(--text-primary)]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {hasActive && (
            <button
              type="button"
              onClick={clearAll}
              className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            disabled
            title="Save view — coming soon (Phase 3)"
            className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-[11px] font-medium text-[var(--text-faint)]"
          >
            Save view
          </button>
        </div>
      </div>
    </div>
  );
}
