import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { NotificationsPopover } from "./NotificationsPopover";
import { useUiStore } from "../../store/uiStore";
import { mockAlerts } from "../../mocks/alerts";

const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Overview",
  "/anomalies": "Investigate",
  "/reports": "Ground Reports",
  "/ground-reports": "Ground Reports",
  "/facilities": "Facilities",
  "/sources": "Persistent Sources",
  "/alerts": "Alerts",
  "/map": "Map",
};

function getTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  const seg = pathname.split("/")[1];
  if (!seg) return "Overview";
  if (seg === "dashboard") return "Overview";
  if (seg === "anomalies") return "Investigate";
  if (seg === "reports" || seg === "ground-reports") return "Ground Reports";
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function DashboardLayout() {
  const location = useLocation();
  const title = getTitle(location.pathname);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const activeAlerts = mockAlerts.filter((a) => a.status === "active").length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        lastFocusRef.current = document.activeElement as HTMLElement | null;
        setPaletteOpen((v) => !v);
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (!isInput) {
          // allow quick open via "/" as well
          // e.preventDefault(); // keep typing "/" in palette input
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closePalette = () => {
    setPaletteOpen(false);
    setTimeout(() => lastFocusRef.current?.focus(), 0);
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--text-primary)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-[var(--radius-md)] focus:border focus:border-[var(--border)] focus:bg-white focus:px-3 focus:py-2 focus:text-[12px] focus:font-medium focus:text-[var(--text-primary)] focus:shadow-[var(--shadow-md)]">
        Skip to content
      </a>
      {/* Desktop sidebar — 240px, light surface */}
      <aside className="hidden w-[240px] shrink-0 lg:block">
        <div className="fixed inset-y-0 w-[240px]">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-[#0f172a]/30 backdrop-blur-[1px]"
          />
          <div className="absolute inset-y-0 left-0 w-[260px] max-w-[80vw] shadow-[var(--shadow-lg)]">
            <Sidebar />
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={title}
          onOpenPalette={() => {
            lastFocusRef.current = document.activeElement as HTMLElement | null;
            setPaletteOpen(true);
          }}
          onOpenNotifications={() => setNotificationsOpen((v) => !v)}
          notificationsCount={activeAlerts}
        />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-x-hidden bg-[var(--background)] focus-visible:outline-none">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
      <NotificationsPopover open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
}
