import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Flame,
  Factory,
  BellRing,
  Map as MapIcon,
  Satellite,
  Bookmark,
  X,
} from "lucide-react";
import { useUiStore } from "../../store/uiStore";
import { useWatchlistStore } from "../../store/watchlistStore";
import { mockFacilities } from "../../mocks/facilities";
import { useNavigate } from "react-router-dom";

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

const PRIMARY_NAV: NavItem[] = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Investigate", to: "/anomalies", icon: Flame },
  { label: "Facilities", to: "/facilities", icon: Factory },
  { label: "Alerts", to: "/alerts", icon: BellRing },
  { label: "Map", to: "/map", icon: MapIcon },
];

export function Sidebar() {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const navigate = useNavigate();
  const ids = useWatchlistStore((s) => s.ids);
  const remove = useWatchlistStore((s) => s.remove);
  const watched = mockFacilities.filter((f) => ids.includes(f.id));

  return (
    <nav
      aria-label="Primary"
      className="flex h-full flex-col border-r border-[var(--border)] bg-[var(--surface)]"
    >
      {/* Brand — compact, operational */}
      <div className="flex h-[48px] shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white">
          <Satellite className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-none tracking-tight text-[var(--text-primary)]">
            PyroClass
          </div>
          <div className="mt-0.5 text-[11px] leading-none text-[var(--text-muted)]">
            Thermal Intelligence
          </div>
        </div>
      </div>

      {/* Nav — dense, no excessive padding */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">
          Monitor
        </p>
        <ul className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    isActive
                      ? "bg-[var(--accent-weak)] text-[var(--text-primary)] border border-[var(--accent-border)]"
                      : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]",
                  ].join(" ")
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Watchlist — FOI */}
        <div className="mt-5">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">
              Watchlist
            </p>
            <span className="text-[10px] tabular-nums text-[var(--text-faint)]">{ids.length}</span>
          </div>
          {watched.length === 0 ? (
            <div className="mt-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-2">
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <Bookmark className="h-3 w-3" />
                <span className="text-[11px] font-medium">No pinned facilities</span>
              </div>
              <p className="text-[10px] leading-relaxed text-[var(--text-faint)]">Pin FOI in Facilities to see them here.</p>
            </div>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {watched.slice(0, 6).map((f) => (
                <li key={f.id} className="group flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1.5 hover:bg-[var(--surface-subtle)]">
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      navigate(`/facilities?facility=${f.id}`);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-[11px] font-medium leading-none text-[var(--text-primary)]">{f.name}</p>
                    <p className="truncate text-[10px] leading-none text-[var(--text-muted)]">{f.id} · {f.type.replace("_", " ")}</p>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => remove(f.id)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-faint)] hover:bg-white hover:text-[var(--critical-text)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
              {ids.length > 6 && <li className="px-2 text-[10px] text-[var(--text-faint)]">+{ids.length - 6} more</li>}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    navigate("/facilities?foi=1");
                  }}
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-white"
                >
                  View FOI only ({ids.length})
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* Context — compact */}
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-2">
          <p className="text-[11px] font-medium text-[var(--text-primary)]">Context</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            VIIRS / SLSTR · mock dataset
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
            <span className="text-[10px] font-medium text-[var(--success-text)]">Nominal</span>
            <span className="text-[10px] text-[var(--text-faint)]">· pending ingestion</span>
          </div>
        </div>
      </div>

      {/* Footer — compact */}
      <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">
          Acquisition
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
          Last overpass: <span className="font-medium operational-data">~08:30 UTC</span>
          <span className="text-[var(--text-muted)]"> · 4 min ago</span>
        </p>
      </div>
    </nav>
  );
}
