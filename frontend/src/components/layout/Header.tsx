import { Menu, Search, Bell } from "lucide-react";
import { useUiStore } from "../../store/uiStore";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 lg:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-slate-100 sm:text-[15px]">
            {title}
          </h1>
          <p className="hidden text-xs text-slate-500 sm:block">
            Satellite thermal anomaly monitoring · VIIRS / SLSTR
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Search – presentational/disabled */}
        <div
          role="search"
          aria-label="Search"
          className="hidden items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-500 sm:flex"
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs">Search anomalies…</span>
          <span className="ml-2 hidden rounded bg-slate-800 px-1 py-0.5 text-[10px] font-medium text-slate-400 lg:inline">
            /
          </span>
        </div>
        {/* Mobile search icon presentational */}
        <button
          type="button"
          aria-label="Search (coming soon)"
          disabled
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-500 opacity-60 sm:hidden"
          title="Search — coming soon"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications — 12 active alerts"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
          title="12 active alerts"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-slate-950">
            12
          </span>
        </button>

        {/* Divider */}
        <div className="hidden h-6 w-px bg-slate-800 sm:block" aria-hidden="true" />

        {/* User */}
        <div className="flex items-center gap-2.5">
          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium leading-none text-slate-200">
              Operator
            </div>
            <div className="text-[11px] leading-none text-slate-500">
              py-ops@pyroclass
            </div>
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200"
            aria-label="User menu — CF"
            title="CF — Operator (presentational)"
          >
            CF
          </div>
        </div>
      </div>
    </header>
  );
}
