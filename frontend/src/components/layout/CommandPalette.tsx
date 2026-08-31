import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, LayoutDashboard, Flame, BellRing, Factory, Map as MapIcon, Trash2, Maximize2, Locate, RefreshCw, Bookmark } from "lucide-react";
import { useRecentStore } from "../../store/recentStore";
import { useAnomalies } from "../../hooks/useAnomalies";
import { useFacilities } from "../../hooks/useFacilities";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  action: () => void;
  keywords: string;
};

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recent = useRecentStore((s) => s.anomalies);
  const anomalies = useAnomalies().data ?? [];
  const facilities = useFacilities().data ?? [];

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const commands: Command[] = useMemo(() => {
    const base: Command[] = [
      { id: "nav-overview", label: "Go to Overview", hint: "/dashboard", icon: LayoutDashboard, action: () => navigate("/dashboard"), keywords: "overview dashboard home" },
      { id: "nav-investigate", label: "Go to Investigate", hint: "/anomalies", icon: Flame, action: () => navigate("/anomalies"), keywords: "investigate anomalies thermal" },
      { id: "nav-alerts", label: "Go to Alerts", hint: "/alerts", icon: BellRing, action: () => navigate("/alerts"), keywords: "alerts triage" },
      { id: "nav-facilities", label: "Go to Facilities", hint: "/facilities", icon: Factory, action: () => navigate("/facilities"), keywords: "facilities plant refinery" },
      { id: "nav-map", label: "Go to Map", hint: "/map", icon: MapIcon, action: () => navigate("/map"), keywords: "map geospatial" },
      {
        id: "action-clear",
        label: "Clear filters",
        hint: "Reset URL filters",
        icon: Trash2,
        action: () => {
          navigate(location.pathname);
        },
        keywords: "clear filters reset",
      },
      {
        id: "action-fit",
        label: "Fit map to filtered results",
        hint: "Map",
        icon: Maximize2,
        action: () => {
          window.dispatchEvent(new CustomEvent("pyro:fit-map"));
        },
        keywords: "fit map bounds",
      },
      {
        id: "action-reset-map",
        label: "Reset map view",
        hint: "India overview",
        icon: Locate,
        action: () => window.dispatchEvent(new CustomEvent("pyro:reset-map")),
        keywords: "reset map locate",
      },
      {
        id: "action-refresh",
        label: "Refresh data",
        hint: "Reload",
        icon: RefreshCw,
        action: () => window.location.reload(),
        keywords: "refresh reload",
      },
    ];

    // recent anomalies
    const recentCmds: Command[] = recent.slice(0, 3).map((id) => {
      const a = anomalies.find((x) => x.id === id);
      return {
        id: `recent-${id}`,
        label: `Recent: ${id} ${a ? `· ${a.classification.replace("_", " ")}` : ""}`,
        hint: a ? `${a.region}` : "",
        icon: Bookmark,
        action: () => navigate(`/anomalies/${id}${location.search}`),
        keywords: `recent ${id}`,
      };
    });

    // search anomalies/facilities/alerts when query present
    const searchCmds: Command[] = [];
    if (q.trim().length >= 2) {
      const qq = q.toLowerCase();
      anomalies
        .filter((a) => `${a.id} ${a.classification} ${a.nearbyFacility?.name ?? ""}`.toLowerCase().includes(qq))
        .slice(0, 3)
        .forEach((a) => {
          searchCmds.push({
            id: `search-anomaly-${a.id}`,
            label: `Anomaly ${a.id} · ${a.classification.replace("_", " ")}`,
            hint: `${a.region} · ${a.confidence}%`,
            icon: Flame,
            action: () => navigate(`/anomalies/${a.id}${location.search}`),
            keywords: `anomaly ${a.id}`,
          });
        });
      facilities
        .filter((f) => `${f.facility_id} ${f.name} ${f.facility_type ?? ""}`.toLowerCase().includes(qq))
        .slice(0, 2)
        .forEach((f) => {
          searchCmds.push({
            id: `search-fac-${f.facility_id}`,
            label: `Facility ${f.name}`,
            hint: String(f.facility_id),
            icon: Factory,
            action: () => navigate(`/facilities?facility=${f.facility_id}`),
            keywords: `facility ${f.name}`,
          });
        });
    }

    const all = [...searchCmds, ...recentCmds, ...base];
    if (!q.trim()) return all;
    const qq = q.toLowerCase();
    return all.filter((c) => `${c.label} ${c.hint ?? ""} ${c.keywords}`.toLowerCase().includes(qq));
  }, [q, navigate, location.pathname, location.search, recent, anomalies, facilities]);

  useEffect(() => setIdx(0), [q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" aria-label="Close command palette" onClick={onClose} className="absolute inset-0 bg-[#0f172a]/30 backdrop-blur-[1px]" />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <Search className="h-4 w-4 text-[var(--text-faint)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx((i) => Math.min(i + 1, commands.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                commands[idx]?.action();
                onClose();
              }
            }}
            placeholder="Search anomalies, facilities, alerts or run commands…"
            className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none"
            aria-label="Command palette search"
          />
          <span className="hidden sm:inline-flex rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-faint)]">Esc</span>
        </div>

        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-1">
          {commands.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-[var(--text-muted)]">No commands match “{q}”</p>
          ) : (
            commands.map((c, i) => {
              const Icon = c.icon;
              const active = i === idx;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => {
                    c.action();
                    onClose();
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${active ? "bg-[var(--surface-subtle)]" : "hover:bg-[var(--surface-subtle)]"}`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <span className="flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{c.label}</span>
                  {c.hint && <span className="hidden sm:inline text-[11px] text-[var(--text-faint)]">{c.hint}</span>}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-1.5 text-[10px] text-[var(--text-faint)]">
          <span className="hidden sm:inline">↑/↓ to navigate · Enter to run · Esc to close · ⌘K to toggle</span>
          <span className="sm:hidden">Tap to run · Esc to close</span>
        </div>
      </div>
    </div>
  );
}
