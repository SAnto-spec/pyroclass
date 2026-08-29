import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useUiStore } from "../../store/uiStore";

const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/anomalies": "Thermal Anomalies",
  "/facilities": "Industrial Facilities",
  "/sources": "Persistent Sources",
  "/alerts": "Alerts",
};

function getTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  // handle nested or unknown – fallback to first segment
  const seg = pathname.split("/")[1];
  if (!seg) return "Dashboard";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function DashboardLayout() {
  const location = useLocation();
  const title = getTitle(location.pathname);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 lg:block">
        <div className="fixed inset-y-0 w-[248px]">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px]"
          />
          <div className="absolute inset-y-0 left-0 w-[248px] shadow-xl">
            <Sidebar />
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} />
        <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-950">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
