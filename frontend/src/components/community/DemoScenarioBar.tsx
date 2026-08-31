import { useNavigate } from "react-router-dom";
import { MapPin, Flame, Factory, Eye, Sprout, CheckCircle2, AlertTriangle } from "lucide-react";
import { DEMO_SCENARIOS } from "../../api/community";

const ICONS: Record<string, React.ElementType> = {
  "scenario-1": Flame,
  "scenario-2": Factory,
  "scenario-3": AlertTriangle,
  "scenario-4": Eye,
  "scenario-5": Sprout,
  "scenario-6": CheckCircle2,
};

export function DemoScenarioBar({ onSelectHotspot }: { onSelectHotspot?: (hotspotId: string | null, reportId?: string) => void }) {
  const navigate = useNavigate();

  return (
    <div className="rounded-[4px] border border-[var(--border)] bg-white px-3 py-3 border-l-[3px] border-l-[#d97706]">
      <div className="flex items-center gap-2">
        <span className="rounded-[3px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.05em] text-[var(--text-muted)]">DEMO · MOCK</span>
        <p className="text-[11px] font-medium text-[var(--text-secondary)]">Judge demo scenarios — 6 narratives</p>
        <span className="ml-auto hidden sm:inline text-[11px] text-[var(--text-faint)]">India · mock only · not ground truth</span>
      </div>
      <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[var(--text-muted)]">
        6 deliberate scenarios illustrate satellite → AI → ground observation → corroboration → evidence assessment.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_SCENARIOS.map((s) => {
          const Icon = ICONS[s.id] ?? MapPin;
          return (
            <button
              key={s.id}
              onClick={() => {
                if (s.hotspotId) {
                  if (onSelectHotspot) onSelectHotspot(s.hotspotId, s.reportIds[0]);
                  else navigate(`/anomalies/${s.hotspotId}`);
                } else {
                  if (onSelectHotspot) onSelectHotspot(null, s.reportIds[0]);
                  else navigate(`/reports?report=${s.reportIds[0]}`);
                }
              }}
              className="group text-left rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-2 hover:bg-white hover:border-[var(--border-strong)] transition-colors duration-150"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-[4px] border border-[var(--border)] bg-white text-[var(--text-muted)] group-hover:border-[var(--border-strong)] group-hover:text-[var(--text-primary)] transition-colors duration-150">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium leading-tight text-[var(--text-primary)]">{s.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] tabular-nums text-[var(--text-faint)]">
                    <MapPin className="h-3 w-3" /> {s.lat.toFixed(2)}, {s.lng.toFixed(2)} · {s.region}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">{s.narrative}</p>
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded-[3px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)]">{s.hotspotId ?? "unlinked"}</span>
                    <span className="rounded-[3px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{s.reportIds.length} reports</span>
                    <span className="rounded-[3px] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-faint)]">{s.expectedGround}</span>
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
