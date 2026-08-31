import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Copy, Check, MapPin, Clock3, Flame, Gauge, Activity, Factory, ExternalLink, Link2, ShieldCheck, AlertTriangle, FileJson } from "lucide-react";
import { OctagonAlert, TriangleAlert, CircleAlert, MinusCircle } from "lucide-react";
import type { Alert, AlertSeverity } from "../../types/alert";
import type { ThermalAnomaly } from "../../types/anomaly";
import type { IndustrialFacility } from "../../types/facility";

interface Props {
  alert: Alert | null;
  anomaly: ThermalAnomaly | null;
  facility: IndustrialFacility | null;
  open: boolean;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string, note: string) => void;
  onEscalate: (id: string) => void;
  onViewOnMap: () => void;
}

const sevCfg: Record<AlertSeverity, { label: string; icon: React.ElementType; cls: string }> = {
  critical: { label: "Critical", icon: OctagonAlert, cls: "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" },
  high: { label: "High", icon: TriangleAlert, cls: "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]" },
  medium: { label: "Medium", icon: CircleAlert, cls: "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]" },
  low: { label: "Low", icon: MinusCircle, cls: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]" },
};

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial Fire",
  wildfire: "Wildfire",
  agricultural_burn: "Agricultural Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  other: "Other",
};

function fmtAge(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function AlertDrawer({ alert, anomaly, facility, open, onClose, onAcknowledge, onResolve, onEscalate, onViewOnMap }: Props) {
  const [resolveNote, setResolveNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    setResolveNote("");
    setCopied(null);
  }, [alert?.id, open]);

  if (!open || !alert) return null;

  const cfg = sevCfg[alert.severity];
  const Icon = cfg.icon;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label={`Alert ${alert.id}`}>
      <button type="button" aria-label="Close alert detail" onClick={onClose} className="absolute inset-0 bg-[#0f172a]/20 backdrop-blur-[1px]" />
      <div className="relative ml-auto flex h-full w-full max-w-[560px] flex-col bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] border-l border-[var(--border)]">
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--border)] bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
                  <Icon className="h-3 w-3" /> {cfg.label}
                </span>
                <span className={`rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium capitalize ${alert.status === "active" ? "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" : alert.status === "acknowledged" ? "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]" : "bg-[var(--success-weak)] text-[var(--success-text)] border-[var(--success-border)]"}`}>
                  {alert.status}
                </span>
                <span className="text-[11px] tabular-nums text-[var(--text-faint)] inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" /> {fmtAge(alert.createdAt)} · {new Date(alert.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <h2 className="mt-2 text-[14px] font-semibold leading-snug text-[var(--text-primary)]">{alert.title}</h2>
              <p className="mt-1 text-[11px] font-mono text-[var(--text-faint)] tabular-nums">{alert.id} · {alert.anomalyId} · Unassigned</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[var(--background)] p-4 space-y-3">
          {/* Alert */}
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">ALERT</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{alert.description}</p>
            <p className="mt-2 text-[11px] tabular-nums text-[var(--text-faint)]">{alert.id} · created {fmtAge(alert.createdAt)}</p>
            <div className="mt-2 flex gap-1.5">
              <button onClick={() => copy(alert.id, "aid")} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                {copied === "aid" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy alert ID
              </button>
              <button onClick={() => copy(`${window.location.origin}/alerts?alert=${alert.id}`, "link")} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                {copied === "link" ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />} Copy link
              </button>
            </div>
          </div>

          {/* Related anomaly */}
          {anomaly ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">RELATED ANOMALY</p>
                <button
                  onClick={() => navigate(`/anomalies/${anomaly.id}${window.location.search}`)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Open investigation <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                  <p className="text-[10px] text-[var(--text-faint)]">CLASSIFICATION</p>
                  <p className="text-[11px] font-medium text-[var(--text-primary)]">{CLASS_LABEL[anomaly.classification]}</p>
                </div>
                <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                  <p className="text-[10px] text-[var(--text-faint)]">CONFIDENCE</p>
                  <p className="text-[11px] font-medium tabular-nums text-[var(--text-primary)] flex items-center gap-1"><Gauge className="h-3 w-3 text-[var(--text-faint)]" /> {anomaly.confidence}%</p>
                </div>
                <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                  <p className="text-[10px] text-[var(--text-faint)]">FRP</p>
                  <p className="text-[11px] font-medium tabular-nums text-[var(--text-primary)] flex items-center gap-1"><Flame className="h-3 w-3 text-[var(--text-faint)]" /> {anomaly.frp.toFixed(1)} MW</p>
                </div>
                <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                  <p className="text-[10px] text-[var(--text-faint)]">PERSISTENCE</p>
                  <p className="text-[11px] font-medium tabular-nums text-[var(--text-primary)] flex items-center gap-1"><Activity className="h-3 w-3 text-[var(--text-faint)]" /> {(anomaly.persistenceScore * 100).toFixed(0)}%</p>
                </div>
              </div>
              <p className="mt-2 font-mono text-[11px] font-medium text-[var(--text-primary)]">{anomaly.id} · {new Date(anomaly.detectedAt).toLocaleString("en-GB")}</p>
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                <MapPin className="h-3 w-3 text-[var(--text-faint)]" /> {anomaly.latitude.toFixed(3)}°, {anomaly.longitude.toFixed(3)}° · {anomaly.region}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button onClick={onViewOnMap} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                  <MapPin className="h-3 w-3" /> View on map
                </button>
                <button onClick={() => copy(`${anomaly.latitude.toFixed(4)}, ${anomaly.longitude.toFixed(4)}`, "coords")} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                  {copied === "coords" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy coords
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-4 text-center">
              <p className="text-[11px] text-[var(--text-muted)]">No linked anomaly found for {alert.anomalyId}</p>
            </div>
          )}

          {/* Facility */}
          {facility && anomaly?.nearbyFacility ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-weak)] px-3 py-3">
              <p className="text-[10px] tracking-[0.04em] text-[var(--accent-muted)] flex items-center gap-1"><Factory className="h-3 w-3" /> FACILITY</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{facility.name}</p>
              <p className="text-[11px] capitalize text-[var(--text-secondary)]">{facility.type.replace("_", " ")} · {facility.status.replace("_", " ")} · {facility.region}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{anomaly.nearbyFacility.distanceKm} km away · {facility.district ?? "—"} · {facility.latitude.toFixed(3)}, {facility.longitude.toFixed(3)}</p>
              <div className="mt-2 flex gap-1.5">
                <button onClick={onViewOnMap} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                  <MapPin className="h-3 w-3" /> View on map
                </button>
                <button onClick={() => copy(`${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}`, "fcoords")} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                  {copied === "fcoords" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy coords
                </button>
              </div>
            </div>
          ) : anomaly && !anomaly.nearbyFacility ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3 text-center">
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">No facility within 5 km</p>
              <p className="text-[11px] text-[var(--text-muted)]">Likely non-industrial context.</p>
            </div>
          ) : null}

          {/* Location / Map note */}
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
            <p className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Related anomaly shown on map. Selection syncs highlight — use to verify facility proximity before action.</p>
          </div>

          {/* History */}
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">HISTORY</p>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
                <span className="font-medium text-[var(--text-primary)]">Created</span>
                <span className="text-[var(--text-muted)] tabular-nums">{new Date(alert.createdAt).toLocaleString("en-GB")}</span>
              </div>
              {alert.status === "acknowledged" && (
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--medium)]" />
                  <span className="font-medium text-[var(--text-primary)]">Acknowledged</span>
                  <span className="text-[var(--text-muted)]">· mock local state</span>
                </div>
              )}
              {alert.status === "resolved" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--medium)]" />
                    <span className="font-medium text-[var(--text-primary)]">Acknowledged</span>
                    <span className="text-[var(--text-muted)]">· mock</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                    <span className="font-medium text-[var(--text-primary)]">Resolved</span>
                    <span className="text-[var(--text-muted)]">· mock local note</span>
                  </div>
                </>
              )}
              <p className="pt-1 text-[11px] leading-relaxed text-[var(--text-faint)]">
                No persistent backend history yet. Activity is local mock — will be replaced by API audit log.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3 space-y-2">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">ACTIONS</p>
            <p className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">Mock local state — actions do not persist to backend. UI shows correct architecture.</p>
            <button
              onClick={() => onAcknowledge(alert.id)}
              disabled={alert.status === "acknowledged" || alert.status === "resolved"}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] disabled:opacity-40"
            >
              <ShieldCheck className="h-4 w-4" /> {alert.status === "acknowledged" ? "Acknowledged" : "Acknowledge"}
            </button>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">Resolution note (required to resolve)</label>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="Describe verification or action taken…"
                rows={2}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              />
              <button
                onClick={() => resolveNote.trim() && onResolve(alert.id, resolveNote.trim())}
                disabled={alert.status === "resolved" || !resolveNote.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--success)] px-3 py-2 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <Check className="h-4 w-4" /> Resolve
              </button>
            </div>
            <button
              onClick={() => onEscalate(alert.id)}
              disabled={alert.severity === "critical"}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--critical-border)] bg-[var(--critical-weak)] px-3 py-2 text-[12px] font-medium text-[var(--critical-text)] hover:bg-red-50 disabled:opacity-40"
            >
              <AlertTriangle className="h-4 w-4" /> Escalate severity {alert.severity !== "critical" ? `(${alert.severity} → ${nextSeverity(alert.severity)})` : "(already critical)"}
            </button>
            <button
              onClick={() => anomaly && navigate(`/anomalies/${anomaly.id}${window.location.search}`)}
              disabled={!anomaly}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--text-primary)] px-3 py-2 text-[12px] font-medium text-white hover:bg-black disabled:opacity-40"
            >
              <FileJson className="h-4 w-4" /> Open investigation · {anomaly?.id ?? "—"}
            </button>
            <button
              onClick={onViewOnMap}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              <MapPin className="h-4 w-4" /> View on map
            </button>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-white px-4 py-2.5 flex items-center justify-between text-[11px] text-[var(--text-faint)]">
          <span className="tabular-nums">{alert.id} · {alert.anomalyId}</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}

function nextSeverity(s: AlertSeverity): AlertSeverity {
  if (s === "low") return "medium";
  if (s === "medium") return "high";
  if (s === "high") return "critical";
  return "critical";
}
