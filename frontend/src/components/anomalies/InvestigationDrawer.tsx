import { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  MapPin,
  Clock3,
  Flame,
  Thermometer,
  Gauge,
  Activity,
  Factory,
  Satellite,
  Bookmark,
  Flag,
  ExternalLink,
  AlertTriangle,
  FileJson,
  Link2,
} from "lucide-react";
import type { ThermalAnomaly } from "../../types/anomaly";
import type { IndustrialFacility } from "../../types/facility";
import type { PersistentThermalSource } from "../../types/source";
import type { RiskAssessment } from "../../types/risk";
import type { ArmaanAssessment } from "../../api/armaan";
import { anomalySeverity } from "../../hooks/useInvestigationFilters";
import { OctagonAlert, TriangleAlert, CircleAlert, MinusCircle } from "lucide-react";
import { EvidencePanel } from "./EvidencePanel";
import { useCommunityStore } from "../../store/communityStore";

interface Props {
  anomaly: ThermalAnomaly | null;
  facility?: IndustrialFacility | null;
  source?: PersistentThermalSource | null;
  risk?: RiskAssessment | null;
  riskLoading?: boolean;
  mlAssessment?: ArmaanAssessment | null;
  mlAssessmentLoading?: boolean;
  open: boolean;
  onClose: () => void;
  onFacilityView?: (id: string) => void;
  onViewOnMap?: () => void;
}

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial Fire",
  wildfire: "Wildfire",
  agricultural_burn: "Agricultural Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  other: "Other",
};

const severityCfg = {
  critical: { label: "Critical", icon: OctagonAlert, cls: "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" },
  high: { label: "High", icon: TriangleAlert, cls: "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]" },
  medium: { label: "Medium", icon: CircleAlert, cls: "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]" },
  low: { label: "Low", icon: MinusCircle, cls: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]" },
} as const;

type Tab = "overview" | "history" | "facility" | "evidence" | "ground" | "actions";

export function InvestigationDrawer({ anomaly, facility, source, risk, riskLoading = false, mlAssessment, mlAssessmentLoading = false, open, onClose, onFacilityView, onViewOnMap }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [copied, setCopied] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [watchlist, setWatchlist] = useState(false);

  // Ground evidence via service/store abstraction — UI unaware of mock vs backend
  // getCommunityReports() → GET /reports, getIncidentGroundEvidence() → GET /hotspots/{id}/ground-evidence
  const communityReports = useCommunityStore((s) => s.reports);
  const getGroundEvidence = useCommunityStore((s) => s.getGroundEvidence);
  const allReports = communityReports;
  const reportsForAnomaly = allReports.filter((r) => r.hotspotId === anomaly?.id);
  const groundSummary = anomaly?.id ? getGroundEvidence(anomaly.id) : null;
  const hasGround = reportsForAnomaly.length > 0;

  useEffect(() => {
    if (open) setTab("overview");
  }, [open, anomaly?.id]);

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
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !anomaly) return null;

  const sev = anomalySeverity(anomaly) as Exclude<import("../../hooks/useInvestigationFilters").InvestigationSeverity, "all">;
  const sCfg = severityCfg[sev];
  const SIcon = sCfg.icon;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const coords = `${anomaly.latitude.toFixed(4)}, ${anomaly.longitude.toFixed(4)}`;
  const geoJson = JSON.stringify(
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [anomaly.longitude, anomaly.latitude] },
      properties: {
        id: anomaly.id,
        classification: anomaly.classification,
        confidence: anomaly.confidence,
        frp: anomaly.frp,
        brightness: anomaly.brightness,
        persistenceScore: anomaly.persistenceScore,
        region: anomaly.region,
        status: anomaly.status,
        detectedAt: anomaly.detectedAt,
      },
    },
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label={`Investigation ${anomaly.id}`}>
      <button type="button" aria-label="Close investigation" onClick={onClose} className="absolute inset-0 bg-[#0f172a]/20 backdrop-blur-[1px]" />
      <div className="relative ml-auto flex h-full w-full max-w-[560px] flex-col bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] border-l border-[var(--border)]">
        {/* Header */}
        <div className="shrink-0 border-b border-[var(--border)] bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold ${sCfg.cls}`}>
                  <SIcon className="h-3 w-3" /> {sCfg.label}
                </span>
                <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                  {CLASS_LABEL[anomaly.classification]}
                </span>
                <span
                  className={`rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium capitalize ${anomaly.status === "active" ? "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" : anomaly.status === "review" ? "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]" : "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]"}`}
                >
                  {anomaly.status === "active" ? "Unreviewed" : anomaly.status}
                </span>
              </div>
              <h2 className="mt-2 text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{anomaly.id}</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                {CLASS_LABEL[anomaly.classification]} · {anomaly.region} · detected {new Date(anomaly.detectedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex items-center gap-1 overflow-x-auto">
            {(["overview", "history", "facility", "evidence", "ground", "actions"] as Tab[]).map((t) => {
              const label = t === "ground" ? `Ground Evidence${hasGround ? ` · ${reportsForAnomaly.length}` : ""}` : t;
              const isGround = t === "ground";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`shrink-0 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[11px] font-medium capitalize transition-colors ${tab === t ? "bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border)]" : isGround && hasGround ? "text-[#0f766e] hover:text-[#0f766e] hover:bg-[#f0fdfa] border border-transparent" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[var(--background)] p-4">
          {tab === "overview" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                  <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">CLASSIFICATION</p>
                  <p className="mt-1 text-[13px] font-medium text-[var(--text-primary)]">{CLASS_LABEL[anomaly.classification]}</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                  <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">SEVERITY</p>
                  <p className={`mt-1 inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[11px] font-semibold ${sCfg.cls}`}>
                    <SIcon className="h-3 w-3" /> {sCfg.label}
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                  <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">CONFIDENCE</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)] operational-data">{anomaly.confidence}%</p>
                  <div className="mt-1 h-1 rounded-full bg-[var(--surface-subtle)]">
                    <div className="h-1 rounded-full bg-[var(--text-secondary)]" style={{ width: `${anomaly.confidence}%` }} />
                  </div>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                  <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">FRP</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)] operational-data">{anomaly.frp.toFixed(1)} MW</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{anomaly.brightness.toFixed(1)} K brightness</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                  <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">PERSISTENCE</p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)] operational-data">{(anomaly.persistenceScore * 100).toFixed(0)}%</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{anomaly.persistenceScore >= 0.7 ? "High" : anomaly.persistenceScore >= 0.4 ? "Medium" : "Low"} · {anomaly.persistenceScore >= 0.7 ? "≥7 passes" : "<7 passes"}</p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                  <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">STATUS</p>
                  <p className="mt-1 text-[13px] font-medium capitalize text-[var(--text-primary)]">{anomaly.status === "active" ? "Unreviewed" : anomaly.status}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{anomaly.status === "active" ? "Requires triage" : anomaly.status === "review" ? "Under review" : "Resolved"}</p>
                </div>
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">RISK ASSESSMENT</p>
                  {risk ? <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">{risk.risk_tier}</span> : null}
                </div>
                {riskLoading ? (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Calculating risk...</p>
                ) : risk ? (
                  <>
                    <p className="mt-1 text-[18px] font-semibold text-[var(--text-primary)] operational-data">{risk.risk_score.toFixed(1)} <span className="text-[11px] font-normal text-[var(--text-muted)]">/ 100</span></p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      {Object.entries(risk.probability_breakdown).map(([key, value]) => (
                        <div key={key} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-1.5">
                          <p className="text-[10px] capitalize text-[var(--text-faint)]">{key.replace("_", " ")}</p>
                          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{Math.round(value * 100)}%</p>
                        </div>
                      ))}
                    </div>
                    {typeof risk.explanation.context_note === "string" && <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">{risk.explanation.context_note}</p>}
                    {typeof risk.explanation.proximity_note === "string" && <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{risk.explanation.proximity_note}</p>}
                  </>
                ) : (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Risk assessment unavailable for this hotspot.</p>
                )}
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">HISTORICAL ML ASSESSMENT</p>
                  <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">STAGE-4</span>
                </div>
                {mlAssessmentLoading ? (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Loading historical Stage-4 assessment...</p>
                ) : mlAssessment ? (
                  <>
                    <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{mlAssessment.predicted_class_name}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Confidence {mlAssessment.confidence.toFixed(2)}% · historical evidence only</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                      {Object.entries(mlAssessment.probability_breakdown).map(([key, value]) => (
                        <div key={key} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-1.5">
                          <p className="text-[10px] text-[var(--text-faint)]">{key}</p>
                          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{value.toFixed(2)}%</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-[var(--text-muted)]">
                      <p>
                        Stage-4 observation: {(() => {
                          const ts = mlAssessment.observation_datetime;
                          if (!ts || ts === "unknown") return "Unknown";
                          const parsed = new Date(ts);
                          if (Number.isNaN(parsed.getTime())) return String(ts);
                          return parsed.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
                        })()}
                      </p>
                      <p>Spatial association distance: {mlAssessment.distance_km.toFixed(3)} km</p>
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.04em] text-[var(--text-faint)]">Historical / Stage-4 evidence · not the 2026 operational classification</p>
                  </>
                ) : (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">No historical Stage-4 assessment available for this hotspot.</p>
                )}
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">LOCATION</p>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
                  <MapPin className="h-3 w-3 text-[var(--text-faint)]" /> {anomaly.latitude.toFixed(4)}°, {anomaly.longitude.toFixed(4)}°
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">{anomaly.region} · {anomaly.nearbyFacility ? `${anomaly.nearbyFacility.distanceKm} km from ${anomaly.nearbyFacility.name}` : "No facility within 5 km"}</p>
                <div className="mt-2 flex gap-1.5">
                  <button onClick={() => copy(coords, "coords")} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                    {copied === "coords" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied === "coords" ? "Copied" : "Copy coords"}
                  </button>
                  <button onClick={onViewOnMap} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                    <MapPin className="h-3 w-3" /> View on map
                  </button>
                </div>
              </div>

              {anomaly.nearbyFacility && facility && (
                <div className="rounded-[var(--radius-md)] border border-[var(--accent-border)] bg-[var(--accent-weak)] px-3 py-3">
                  <p className="text-[11px] font-medium text-[var(--accent-muted)] flex items-center gap-1">
                    <Factory className="h-3 w-3" /> Facility context
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--text-primary)]">{facility.name}</p>
                  <p className="text-[11px] capitalize text-[var(--text-secondary)]">
                    {facility.type.replace("_", " ")} · {facility.status.replace("_", " ")} · {facility.region}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {anomaly.nearbyFacility.distanceKm} km away · {facility.district ?? "—"}
                  </p>
                  <button onClick={() => facility && onFacilityView?.(facility.id)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-muted)] hover:underline">
                    Open facility <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Ground Evidence summary — shown when reports exist */}
              {hasGround && (
                <div className="rounded-[var(--radius-md)] border border-[#99f6e4] bg-[#f0fdfa] px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-[0.04em] text-[#0f766e] flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#0f766e]" aria-hidden="true" /> Ground Evidence — {groundSummary ? groundSummary.consensus.toUpperCase() : "MIXED"}
                    </p>
                    <span className="rounded-full border border-[#99f6e4] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#0f766e]">{reportsForAnomaly.length} observations</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-[4px] border border-[#99f6e4] bg-white px-2 py-1.5">
                      <p className="text-[10px] text-[var(--text-faint)]">CORROBORATING</p>
                      <p className="text-[13px] font-semibold text-[#0f766e]">{groundSummary?.corroborating ?? reportsForAnomaly.filter((r) => !["no_fire_observed","false_alarm","fire_extinguished","unknown"].includes(r.observationType)).length}</p>
                    </div>
                    <div className="rounded-[4px] border border-[var(--border)] bg-white px-2 py-1.5">
                      <p className="text-[10px] text-[var(--text-faint)]">DISPUTED</p>
                      <p className="text-[13px] font-semibold text-[var(--high-text)]">{groundSummary?.disputing ?? 0}</p>
                    </div>
                    <div className="rounded-[4px] border border-[var(--border)] bg-white px-2 py-1.5">
                      <p className="text-[10px] text-[var(--text-faint)]">PHOTOS</p>
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">{reportsForAnomaly.reduce((a, r) => a + r.media.length, 0)}</p>
                    </div>
                  </div>
                  <button onClick={() => setTab("ground")} className="mt-2 inline-flex w-full items-center justify-center rounded-[var(--radius-md)] border border-[#0f766e] bg-[#0f766e] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#0e6b63]">
                    View Ground Evidence assessment →
                  </button>
                </div>
              )}
              {!hasGround && (
                <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3 text-center">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)]">No ground observations yet</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Community Evidence will appear here when linked reports are submitted via Map → Report Observation.</p>
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
                <h3 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)] flex items-center gap-1">
                  <Clock3 className="h-3 w-3" /> Timeline
                </h3>
                {source && source.timeline.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Linked persistent source <span className="font-medium text-[var(--text-secondary)]">{source.id}</span> · {source.detectionCount} detections · persistence {(source.persistenceScore * 100).toFixed(0)}%
                    </p>
                    <div className="relative pl-4">
                      <div className="absolute left-1 top-1 bottom-1 w-px bg-[var(--border)]" />
                      {source.timeline.slice(-8).map((t, i) => (
                        <div key={t} className="relative flex items-center gap-2 py-1.5">
                          <span className="absolute left-[-6px] h-2 w-2 rounded-full bg-[var(--accent)] border border-white shadow-sm" />
                          <span className="text-[11px] tabular-nums text-[var(--text-secondary)]">{new Date(t).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}</span>
                          <span className="text-[11px] text-[var(--text-faint)]">· {i === source.timeline.length - 1 ? "latest" : i === 0 ? "first" : `+${i}`}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5">
                        <p className="text-[10px] text-[var(--text-faint)]">FIRST</p>
                        <p className="text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">{new Date(source.firstDetected).toLocaleDateString("en-GB")}</p>
                      </div>
                      <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5">
                        <p className="text-[10px] text-[var(--text-faint)]">LAST</p>
                        <p className="text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">{new Date(source.lastDetected).toLocaleDateString("en-GB")}</p>
                      </div>
                      <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5">
                        <p className="text-[10px] text-[var(--text-faint)]">COUNT</p>
                        <p className="text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">{source.detectionCount}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-[12px] font-medium text-[var(--text-secondary)]">Limited history in current dataset</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                      This anomaly record contains a single detection snapshot. The current API provides `persistenceScore` and `detectedAt` but not a full event timeline. When linked to a persistent source, timeline will appear here.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
                        <p className="text-[10px] text-[var(--text-faint)]">FIRST / LATEST</p>
                        <p className="text-[11px] font-medium tabular-nums text-[var(--text-primary)]">{new Date(anomaly.detectedAt).toLocaleDateString("en-GB")}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{fmtTime(anomaly.detectedAt)}</p>
                      </div>
                      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
                        <p className="text-[10px] text-[var(--text-faint)]">PERSISTENCE</p>
                        <p className="text-[13px] font-semibold text-[var(--text-primary)] operational-data">{(anomaly.persistenceScore * 100).toFixed(0)}%</p>
                        <p className="text-[11px] text-[var(--text-muted)]">FRP {anomaly.frp.toFixed(1)} MW · {anomaly.confidence}% conf</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--text-faint)]">Data limitation: this API response lacks multi-temporal history. Production will show FRP/confidence changes over successive overpasses.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "facility" && (
            <div className="space-y-3">
              {facility && anomaly.nearbyFacility ? (
                <>
                  <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
                    <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">NEAREST FACILITY</p>
                    <p className="mt-1 text-[14px] font-semibold text-[var(--text-primary)]">{facility.name}</p>
                    <p className="text-[11px] capitalize text-[var(--text-secondary)]">{facility.type.replace("_", " ")} · {facility.region} {facility.district ? `· ${facility.district}` : ""}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-weak)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-muted)]">
                      <MapPin className="h-3 w-3" /> {anomaly.nearbyFacility.distanceKm} km away
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                        <p className="text-[10px] text-[var(--text-faint)]">STATUS</p>
                        <p className="text-[11px] font-medium capitalize text-[var(--text-primary)]">{facility.status.replace("_", " ")}</p>
                      </div>
                      <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                        <p className="text-[10px] text-[var(--text-faint)]">COORDINATES</p>
                        <p className="text-[11px] font-mono tabular-nums text-[var(--text-primary)]">{facility.latitude.toFixed(3)}, {facility.longitude.toFixed(3)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={onViewOnMap} className="flex-1 inline-flex items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                        <MapPin className="h-3 w-3" /> View on map
                      </button>
                      <button onClick={() => onFacilityView?.(facility.id)} className="flex-1 inline-flex items-center justify-center gap-1 rounded-[var(--radius-md)] bg-[var(--text-primary)] px-3 py-2 text-[11px] font-medium text-white hover:bg-black">
                        <ExternalLink className="h-3 w-3" /> Open facility
                      </button>
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3">
                    <p className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Relationship</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                      Anomaly is <span className="font-medium text-[var(--text-primary)]">{anomaly.nearbyFacility.distanceKm} km</span> from facility centre. Proximity does not confirm causation — industrial heat, flaring, and agricultural burning can coincide spatially.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 py-8 text-center">
                  <Factory className="mx-auto h-6 w-6 text-[var(--text-faint)]" />
                  <p className="mt-2 text-[13px] font-medium text-[var(--text-primary)]">No facility within 5 km</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">This detection has no nearby industrial facility in the current API data. Likely non-industrial — consider wildfire or agricultural burn context.</p>
                  <p className="mt-2 text-[11px] text-[var(--text-faint)]">Region: {anomaly.region} · status {anomaly.status}</p>
                </div>
              )}
            </div>
          )}

          {tab === "evidence" && (
            <div className="space-y-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
                <h3 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)] flex items-center gap-1">
                  <Satellite className="h-3 w-3" /> Acquisition
                </h3>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                    <dt className="text-[10px] text-[var(--text-faint)]">DETECTED AT</dt>
                    <dd className="font-medium tabular-nums text-[var(--text-primary)]">{new Date(anomaly.detectedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</dd>
                  </div>
                  <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                    <dt className="text-[10px] text-[var(--text-faint)]">SENSOR</dt>
                    <dd className="font-medium text-[var(--text-primary)]">VIIRS / SLSTR</dd>
                  </div>
                  <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                    <dt className="text-[10px] text-[var(--text-faint)]">FRP</dt>
                    <dd className="font-medium tabular-nums text-[var(--text-primary)] flex items-center gap-1"><Flame className="h-3 w-3 text-[var(--text-faint)]" /> {anomaly.frp.toFixed(1)} MW</dd>
                  </div>
                  <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                    <dt className="text-[10px] text-[var(--text-faint)]">BRIGHTNESS</dt>
                    <dd className="font-medium tabular-nums text-[var(--text-primary)] flex items-center gap-1"><Thermometer className="h-3 w-3 text-[var(--text-faint)]" /> {anomaly.brightness.toFixed(1)} K</dd>
                  </div>
                  <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                    <dt className="text-[10px] text-[var(--text-faint)]">CONFIDENCE</dt>
                    <dd className="font-medium tabular-nums text-[var(--text-primary)] flex items-center gap-1"><Gauge className="h-3 w-3 text-[var(--text-faint)]" /> {anomaly.confidence}%</dd>
                  </div>
                  <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                    <dt className="text-[10px] text-[var(--text-faint)]">PERSISTENCE</dt>
                    <dd className="font-medium tabular-nums text-[var(--text-primary)] flex items-center gap-1"><Activity className="h-3 w-3 text-[var(--text-faint)]" /> {(anomaly.persistenceScore * 100).toFixed(0)}%</dd>
                  </div>
                </dl>
                <div className="mt-3 rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                  <dt className="text-[10px] text-[var(--text-faint)]">COORDINATES (WGS84)</dt>
                  <dd className="font-mono text-[11px] tabular-nums font-medium text-[var(--text-primary)]">{coords}</dd>
                  <dd className="text-[11px] text-[var(--text-muted)]">{anomaly.region}</dd>
                </div>
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
                <h3 className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Export & share</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => copy(coords, "coords2")} className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                    {copied === "coords2" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy coords
                  </button>
                  <button onClick={() => copy(anomaly.id, "id")} className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                    {copied === "id" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy ID
                  </button>
                  <button onClick={() => copy(`${window.location.origin}/anomalies/${anomaly.id}${window.location.search}`, "link")} className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                    {copied === "link" ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />} Copy link
                  </button>
                  <button onClick={() => copy(geoJson, "geo")} className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-2 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                    {copied === "geo" ? <Check className="h-3 w-3" /> : <FileJson className="h-3 w-3" />} GeoJSON
                  </button>
                </div>
              </div>

              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3">
                <p className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1"><Satellite className="h-3 w-3" /> Satellite imagery</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">High-resolution optical/SAR imagery not yet integrated. This panel will show before/after chips when the imagery service is connected.</p>
                <p className="mt-2 inline-flex rounded-[4px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[10px] text-[var(--text-faint)]">Not yet integrated — imagery unavailable</p>
              </div>
            </div>
          )}

          {tab === "ground" && (
            <EvidencePanel anomaly={anomaly} reports={reportsForAnomaly} groundSummary={groundSummary} facility={facility ?? null} source={source ?? null} allReports={allReports} />
          )}

          {tab === "actions" && (
            <div className="space-y-3">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3 space-y-2">
                <button
                  onClick={() => setReviewed((v) => !v)}
                  className={`w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-medium transition-colors ${reviewed ? "bg-[var(--success-weak)] border-[var(--success-border)] text-[var(--success-text)]" : "bg-white border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"}`}
                >
                  {reviewed ? <Check className="h-4 w-4" /> : <Flag className="h-4 w-4" />} {reviewed ? "Marked as reviewed" : "Mark reviewed"}
                </button>
                <button
                  onClick={() => copy(anomaly.id, "alert")}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--text-primary)] px-3 py-2 text-[12px] font-medium text-white hover:bg-black"
                >
                  <AlertTriangle className="h-4 w-4" /> Create alert · {anomaly.id}
                </button>
                {copied === "alert" && <p className="text-center text-[11px] text-[var(--success-text)]">ID copied — create alert in Alerts workflow (mock)</p>}
                <button
                  onClick={() => setWatchlist((v) => !v)}
                  className={`w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-[12px] font-medium ${watchlist ? "bg-[var(--accent-weak)] border-[var(--accent-border)] text-[var(--accent-muted)]" : "bg-white border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"}`}
                >
                  <Bookmark className={`h-4 w-4 ${watchlist ? "fill-current" : ""}`} /> {watchlist ? "In watchlist" : "Add to watchlist"}
                </button>
                <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">Actions are local to this browser (mock). No backend persistence yet — state will reset on reload.</p>
              </div>

              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3">
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">Next steps</p>
                <ul className="mt-1 list-disc pl-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  <li>Verify facility proximity on map</li>
                  <li>Check History for persistence trend</li>
                  <li>Review Evidence coordinates & FRP</li>
                  <li>Decide: escalate, monitor, or dismiss</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-white px-4 py-2.5 flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-faint)] tabular-nums">{anomaly.id} · {coords}</span>
          <span className="text-[var(--text-faint)]">Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date(Date.now());
  const diffMin = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}
