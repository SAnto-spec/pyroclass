import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Flame,
  Factory,
  Layers,
  BellRing,
  Satellite,
} from "lucide-react";
import { useUiStore } from "../../store/uiStore";

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Anomalies", to: "/anomalies", icon: Flame },
  { label: "Facilities", to: "/facilities", icon: Factory },
  { label: "Persistent Sources", to: "/sources", icon: Layers },
  { label: "Alerts", to: "/alerts", icon: BellRing },
];

export function Sidebar() {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <nav
      aria-label="Primary"
      className="flex h-full flex-col border-r border-slate-800 bg-slate-950"
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500 text-slate-950">
          <Satellite className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-100 leading-none">
            PyroClass
          </div>
          <div className="text-[10px] tracking-wide text-slate-500 leading-none mt-0.5">
            Thermal Intelligence
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Monitoring
        </p>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  [
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500",
                    isActive
                      ? "border-l-2 border-amber-500 bg-slate-900 text-white"
                      : "border-l-2 border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100",
                  ].join(" ")
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate text-[13px] font-medium">
                  {item.label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-md border border-slate-800 bg-slate-900/50 px-3 py-3">
          <p className="text-xs font-medium text-slate-200">Operational mode</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Satellite VIIRS/SLSTR thermal anomaly classification. Mock data
            active.
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-[11px] font-medium text-emerald-400">
              System nominal
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 px-3 py-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-500">
          Data latency
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Last overpass: ~08:30 UTC · 4 min ago
        </p>
      </div>
    </nav>
  );
}
