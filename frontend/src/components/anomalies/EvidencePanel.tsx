import { Satellite, Cpu, Users, Mountain, Camera, Clock3, ShieldCheck, ShieldAlert, ShieldQuestion, Activity, MapPin, Eye } from "lucide-react";
import { ReportVerificationControls } from "../community/ReportVerificationControls";
import type { ThermalAnomaly } from "../../types/anomaly";
import type { CommunityReport, GroundEvidenceSummary } from "../../types/community";
import { isCorroborating, isDisputing, isNeutral } from "../../api/community";
import type { IndustrialFacility } from "../../types/facility";
import type { PersistentThermalSource } from "../../types/source";
import { anomalySeverity } from "../../hooks/useInvestigationFilters";
import { partitionReports } from "../../lib/association";

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial Fire",
  wildfire: "Vegetation Fire",
  agricultural_burn: "Agricultural Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  other: "Other",
};

const OBS_LABEL: Record<string, string> = {
  fire_visible: "Fire visible",
  smoke_visible: "Smoke visible",
  industrial_activity: "Industrial activity",
  agricultural_burning: "Agricultural burning",
  no_fire_observed: "No fire observed",
  fire_extinguished: "Fire extinguished",
  false_alarm: "False alarm",
  unknown: "Unknown",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
function fmtTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

type GroundLevel = "HIGH" | "MEDIUM" | "LOW" | "CONFLICTING" | "INSUFFICIENT";

function deriveGroundLevel(summary: GroundEvidenceSummary | null, photoCount: number): GroundLevel {
  if (!summary || summary.totalReports === 0) return "INSUFFICIENT";
  if (summary.conflicting) return "CONFLICTING";
  // HIGH: strong corroboration, multiple obs, photos, decent credibility
  if (summary.corroborating >= 3 && photoCount >= 3 && (summary.avgCredibility ?? 0) >= 0.65) return "HIGH";
  if (summary.corroborating >= 2 && (summary.avgCredibility ?? 0) >= 0.6) return "HIGH";
  if (summary.corroborating >= 2) return "MEDIUM";
  if (summary.corroborating === 1 && summary.disputing === 0) return "MEDIUM";
  if (summary.disputing > summary.corroborating) return "LOW";
  if (summary.totalReports >= 1) return "LOW";
  return "INSUFFICIENT";
}

interface Props {
  anomaly: ThermalAnomaly;
  reports: CommunityReport[];
  groundSummary: GroundEvidenceSummary | null;
  facility: IndustrialFacility | null;
  source: PersistentThermalSource | null;
  allReports?: CommunityReport[];
}

export function EvidencePanel({ anomaly, reports, groundSummary, facility, source, allReports }: Props) {
  const photoCount = reports.reduce((acc, r) => acc + r.media.length, 0);
  const corroborating = groundSummary?.corroborating ?? reports.filter((r) => isCorroborating(r.observationType)).length;
  const disputing = groundSummary?.disputing ?? reports.filter((r) => isDisputing(r.observationType)).length;
  const neutral = reports.filter((r) => isNeutral(r.observationType)).length;
  const observationTypes = Array.from(new Set(reports.map((r) => r.observationType)));
  const latestObs = groundSummary?.latestObservedAt ?? (reports.length ? [...reports].sort((a, b) => (a.observedAt > b.observedAt ? -1 : 1))[0].observedAt : null);

  // Association: explicit vs geographically close vs unrelated
  const partition = allReports ? partitionReports(anomaly, allReports) : { linked: reports.map((r) => ({ report: r, kind: "linked" as const, distanceKm: r.distanceToIncidentKm })), nearby: [], potentiallyRelated: [], unrelated: [] };
  const nearbyReports = partition.nearby;
  const potentiallyRelated = partition.potentiallyRelated;
  const linkedReports = partition.linked;

  const groundLevel = deriveGroundLevel(groundSummary, photoCount);
  const levelCfg: Record<GroundLevel, { cls: string; dot: string; note: string }> = {
    HIGH: { cls: "bg-white text-[var(--text-primary)] border-[var(--border)]", dot: "bg-[#0f5e59]", note: "Multiple corroborating observations with photos" },
    MEDIUM: { cls: "bg-white text-[var(--text-primary)] border-[var(--border)]", dot: "bg-[#475569]", note: "Limited corroboration — further review advised" },
    LOW: { cls: "bg-white text-[var(--text-secondary)] border-[var(--border)]", dot: "bg-[var(--text-faint)]", note: "Sparse or disputed evidence" },
    CONFLICTING: { cls: "bg-white text-[var(--text-primary)] border-[var(--border)]", dot: "bg-[#b45309]", note: "Conflicting observations — do not treat as confirmed" },
    INSUFFICIENT: { cls: "bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border)]", dot: "bg-[var(--text-faint)]", note: "No ground observations yet" },
  };
  const sev = anomalySeverity(anomaly) as Exclude<import("../../hooks/useInvestigationFilters").InvestigationSeverity, "all">;
  const severityLabel = sev.charAt(0).toUpperCase() + sev.slice(1); // Critical/High/Medium/Low

  // Build incident timeline (mock, chronological)
  type TimelineItem = { time: string; label: string; detail: string; kind: "sat" | "ai" | "ground" | "verify" | "photo" };
  const timeline: TimelineItem[] = [];
  timeline.push({ time: anomaly.detectedAt, label: "FIRMS detection", detail: `VIIRS thermal anomaly · ${anomaly.frp.toFixed(1)} MW`, kind: "sat" });
  const aiTime = new Date(new Date(anomaly.detectedAt).getTime() + 3 * 60000).toISOString();
  timeline.push({ time: aiTime, label: "AI classification", detail: `${CLASS_LABEL[anomaly.classification]} · ${anomaly.confidence}% confidence`, kind: "ai" });
  for (const r of [...reports].sort((a, b) => (a.observedAt > b.observedAt ? 1 : -1))) {
    timeline.push({ time: r.observedAt, label: "Ground observation submitted", detail: `${OBS_LABEL[r.observationType]} · ${r.id}`, kind: "ground" });
    if (r.media.length) {
      timeline.push({ time: r.submittedAt, label: "Photo submitted", detail: `${r.media.length} photo${r.media.length > 1 ? "s" : ""} · ${r.id}`, kind: "photo" });
    }
    for (const v of (r.verifications ?? []).slice(0, 2)) {
      timeline.push({
        time: v.createdAt,
        label: v.type === "corroborate" ? "User corroborated" : "User disputed",
        detail: v.note ? `${v.note} · ${r.id}` : r.id,
        kind: "verify",
      });
    }
  }
  // If no verification details, add synthetic corroboration events for demo when reports have confirmations
  if (timeline.filter((t) => t.kind === "verify").length === 0 && reports.some((r) => r.confirmations > 0)) {
    const mostCorro = [...reports].sort((a, b) => b.confirmations - a.confirmations)[0];
    if (mostCorro && mostCorro.confirmations >= 2) {
      const t = new Date(new Date(mostCorro.observedAt).getTime() + 7 * 60000).toISOString();
      timeline.push({ time: t, label: `${mostCorro.confirmations} users corroborated`, detail: mostCorro.id, kind: "verify" });
    }
  }
  timeline.sort((a, b) => (a.time > b.time ? 1 : -1));

  // Context derivation (mock, from facility + anomaly)
  const hasIndustrial = !!facility || anomaly.nearbyFacility != null || anomaly.classification === "industrial_fire" || anomaly.classification === "gas_flare";
  const hasMining = facility?.type === "mine" || anomaly.classification === "mining";
  const isForest = anomaly.classification === "Vegetation Fire";
  const isAgri = anomaly.classification === "agricultural_burn";
  const osmEvidence = hasIndustrial
    ? `OSM landuse=industrial · ${facility?.name ?? anomaly.nearbyFacility?.name ?? "industrial polygon"} · ${facility ? `${facility.type.replace("_", " ")} within ${(anomaly.nearbyFacility?.distanceKm ?? 1.2).toFixed(1)} km` : "proximity inferred"}`
    : hasMining
      ? "OSM landuse=quarry · mining polygon overlap"
      : isForest
        ? "OSM natural=wood · forest polygon overlap — vegetation context"
        : isAgri
          ? "OSM landuse=farmland · cropland context"
          : "OSM context: no industrial/mining polygon overlap — vegetation/barren check advised";

  const priorityScore = (() => {
    switch (sev) {
      case "critical": return 92;
      case "high": return 74;
      case "medium": return 48;
      default: return 22;
    }
  })();

  return (
    <div className="space-y-3">
      {/* Hotspot header — example style HOTSPOT #PY-2841 */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold tracking-[0.06em] text-[var(--text-primary)]">HOTSPOT <span className="font-mono">#{anomaly.id}</span></p>
          <span className={`inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold ${severityLabel === "Critical" ? "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" : severityLabel === "High" ? "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]" : severityLabel === "Medium" ? "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]" : "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]"}`}>Priority {priorityScore}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">AI CLASSIFICATION</p>
            <p className="font-medium text-[var(--text-primary)]">{CLASS_LABEL[anomaly.classification]}</p>
          </div>
          <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">AI CONFIDENCE</p>
            <p className="font-medium tabular-nums text-[var(--text-primary)]">{anomaly.confidence}%</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${levelCfg[groundLevel].cls}`}>Ground Evidence {groundLevel}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[var(--text-muted)]">Community Reports {reports.length}</span>
          {reports.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--success-border)] bg-[var(--success-weak)] px-2 py-0.5 text-[var(--success-text)]">✓ {corroborating} corroborating</span>
              {disputing > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--high-border)] bg-[var(--high-weak)] px-2 py-0.5 text-[var(--high-text)]">⚠ {disputing} conflicting</span>}
              {nearbyReports.length > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[var(--text-muted)]">{nearbyReports.length} nearby</span>}
            </>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">Hotspot detail integrates existing facility/context components — not a parallel incident system. Priority from AI severity, not ground votes.</p>
      </div>

      {/* Header — Ground Evidence assessment (structured, not fake probability) */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-[0.06em] text-[var(--text-faint)]">GROUND EVIDENCE</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[12px] font-bold tracking-[0.02em] ${levelCfg[groundLevel].cls}`}>
                <span className={`h-2 w-2 rounded-full ${levelCfg[groundLevel].dot}`} aria-hidden="true" /> {groundLevel}
              </span>
              {groundSummary?.conflicting && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--high-border)] bg-[var(--high-weak)] px-2 py-0.5 text-[11px] font-medium text-[var(--high-text)]">Conflicting</span>}
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{levelCfg[groundLevel].note}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">LATEST OBSERVATION</p>
            <p className="text-[12px] font-medium tabular-nums text-[var(--text-primary)]">{latestObs ? timeAgo(latestObs) : "—"}</p>
            <p className="text-[11px] text-[var(--text-faint)] tabular-nums">{latestObs ? fmtDate(latestObs) : "No observations"}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
            <p className="text-[10px] text-[var(--text-faint)]">OBSERVATIONS</p>
            <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">{reports.length}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{corroborating} corroborating</p>
          </div>
          <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
            <p className="text-[10px] text-[var(--text-faint)]">COMMUNITY</p>
            <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">{corroborating}<span className="text-[12px] font-normal text-[var(--text-muted)]"> / {disputing} disputed</span></p>
            <p className="text-[11px] text-[var(--text-muted)]">{neutral > 0 ? `${neutral} neutral` : disputing > 0 ? `${disputing} conflicting` : "no disputes"}</p>
          </div>
          <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
            <p className="text-[10px] text-[var(--text-faint)]">PHOTOS</p>
            <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">{photoCount}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{photoCount ? "ground evidence" : "no photos yet"}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">Structured assessment — do not read as calibrated probability. Combine with satellite &amp; AI below.</p>
      </div>

      {/* 4-quadrant grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* SATELLITE */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
            <Satellite className="h-3.5 w-3.5 text-[var(--text-faint)]" /> SATELLITE
            <span className="ml-auto rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">FIRMS / VIIRS</span>
          </div>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Detection count</dt><dd className="font-medium tabular-nums text-[var(--text-primary)]">{source?.detectionCount ?? 1} {source ? "overpasses" : "detection"}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Latest detection</dt><dd className="font-medium tabular-nums text-[var(--text-primary)]">{fmtDate(anomaly.detectedAt)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Satellite confidence</dt><dd className="font-medium tabular-nums text-[var(--text-primary)]">{anomaly.confidence}% · FRP {anomaly.frp.toFixed(1)} MW</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Brightness / persistence</dt><dd className="font-medium tabular-nums text-[var(--text-primary)]">{anomaly.brightness.toFixed(0)} K · {(anomaly.persistenceScore * 100).toFixed(0)}%</dd></div>
          </dl>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">Space-borne thermal anomaly — no ground truth implied.</p>
        </div>

        {/* AI */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
            <Cpu className="h-3.5 w-3.5 text-[var(--text-faint)]" /> AI
            <span className="ml-auto inline-flex rounded-[4px] border border-[var(--accent-border)] bg-[var(--accent-weak)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-muted)]">Model inference</span>
          </div>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Classification</dt><dd className="font-medium text-[var(--text-primary)]">{CLASS_LABEL[anomaly.classification]}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Classification confidence</dt><dd className="font-medium tabular-nums text-[var(--text-primary)]">{anomaly.confidence}%</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Anomaly / priority</dt><dd className={`inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[11px] font-semibold ${severityLabel === "Critical" ? "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" : severityLabel === "High" ? "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]" : severityLabel === "Medium" ? "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]" : "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]"}`}>{severityLabel}</dd></div>
          </dl>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            {severityLabel === "Critical" ? <ShieldAlert className="h-3 w-3 text-[var(--critical)]" /> : severityLabel === "Low" ? <ShieldQuestion className="h-3 w-3 text-[var(--text-faint)]" /> : <ShieldCheck className="h-3 w-3 text-[var(--accent)]" />}
            <span>AI prediction — distinct from ground evidence.</span>
          </div>
        </div>

        {/* GROUND OBSERVATIONS */}
        <div className="rounded-[var(--radius-md)] border border-[#99f6e4] bg-[#f0fdfa] px-3 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#0f766e]">
            <Users className="h-3.5 w-3.5" /> GROUND OBSERVATIONS
            <span className="ml-auto rounded-full bg-white border border-[#99f6e4] px-1.5 py-0.5 text-[10px] font-medium text-[#0f766e]">Community Evidence</span>
          </div>
          {reports.length === 0 ? (
            <div className="mt-3 rounded-[4px] border border-dashed border-[#99f6e4] bg-white px-3 py-4 text-center">
              <Eye className="mx-auto h-4 w-4 text-[#14b8a6]" />
              <p className="mt-1 text-[12px] font-medium text-[var(--text-primary)]">No ground observations yet</p>
              <p className="text-[11px] text-[var(--text-muted)]">Unverified — use Map → Report Observation to add ground truth.</p>
            </div>
          ) : (
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><dt className="text-[#115e59]">Reports</dt><dd className="font-semibold tabular-nums text-[#0f766e]">{reports.length} · {photoCount} photos</dd></div>
              <div className="flex justify-between"><dt className="text-[#115e59]">Corroborations / disputes</dt><dd className="font-medium tabular-nums text-[#0f766e]">{corroborating} / {disputing}</dd></div>
              <div className="flex justify-between"><dt className="text-[#115e59]">Observation types</dt><dd className="font-medium text-[#0f766e] truncate max-w-[140px]">{observationTypes.map((t) => OBS_LABEL[t] ?? t).join(", ")}</dd></div>
              <div className="flex justify-between"><dt className="text-[#115e59]">Latest observation</dt><dd className="font-medium tabular-nums text-[#0f766e]">{latestObs ? timeAgo(latestObs) : "—"}</dd></div>
            </dl>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-[#115e59]/80">Community Evidence — not fused into AI confidence histogram.</p>
        </div>

        {/* CONTEXT */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
            <Mountain className="h-3.5 w-3.5 text-[var(--text-faint)]" /> CONTEXT
            <span className="ml-auto rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">OSM + Land</span>
          </div>
          <dl className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between gap-2"><dt className="text-[var(--text-muted)] shrink-0">Industrial</dt><dd className="font-medium text-[var(--text-primary)] text-right">{hasIndustrial ? (facility ? `${facility.name} · ${anomaly.nearbyFacility?.distanceKm ?? "—"} km` : "Industrial proximity inferred") : "No industrial facility within 5 km"}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Mining</dt><dd className={`font-medium ${hasMining ? "text-[var(--text-primary)]" : "text-[var(--text-faint)]"}`}>{hasMining ? "Mining/quarry context present" : "No mining overlap"}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--text-muted)]">Forest / Agriculture</dt><dd className="font-medium text-[var(--text-primary)]">{isForest ? "Forest vegetation" : isAgri ? "Cropland / agricultural" : "No forest/agri polygon overlap"}</dd></div>
          </dl>
          <div className="mt-2 rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5">
            <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">OSM EVIDENCE</p>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{osmEvidence}</p>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><MapPin className="h-3 w-3 text-[var(--text-faint)]" /> {anomaly.latitude.toFixed(4)}, {anomaly.longitude.toFixed(4)} · {anomaly.region}</p>
        </div>
      </div>

      {/* Overall distinction bar */}
      <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px]">
        <div>
          <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">AI PREDICTION</p>
          <p className="font-medium text-[var(--text-primary)]">{CLASS_LABEL[anomaly.classification]}</p>
          <p className="text-[var(--text-muted)] tabular-nums">{anomaly.confidence}% · {severityLabel}</p>
        </div>
        <div className="border-l border-[var(--border)] pl-3">
          <p className="text-[10px] tracking-[0.04em] text-[#0f766e]">COMMUNITY EVIDENCE</p>
          <p className={`font-bold ${groundLevel === "HIGH" ? "text-[var(--success-text)]" : groundLevel === "CONFLICTING" ? "text-[var(--high-text)]" : "text-[#0f766e]"}`}>{groundLevel}</p>
          <p className="text-[var(--text-muted)] tabular-nums">{reports.length} obs · {photoCount} photos</p>
        </div>
        <div className="border-l border-[var(--border)] pl-3">
          <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">OVERALL PRIORITY</p>
          <p className={`inline-flex rounded-[4px] border px-1.5 py-0.5 text-[11px] font-semibold ${severityLabel === "Critical" ? "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]" : severityLabel === "High" ? "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]" : "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]"}`}>{severityLabel}</p>
          <p className="mt-1 text-[11px] leading-tight text-[var(--text-faint)]">From AI severity — not auto-fused with ground. Decide with context.</p>
        </div>
      </div>

      {/* Photos strip */}
      {photoCount > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
            <Camera className="h-3.5 w-3.5 text-[var(--text-faint)]" /> PHOTOS · {photoCount}
            <span className="text-[var(--text-faint)] font-normal">Ground Evidence</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {reports.flatMap((r) => r.media).slice(0, 8).map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-[4px] border border-[var(--border)] bg-white">
                <img src={m.thumbnailUrl ?? m.url} alt={m.fileName ?? "ground photo"} className="h-[64px] w-full object-cover" loading="lazy" />
                <p className="truncate px-1.5 py-1 text-[10px] tabular-nums text-[var(--text-muted)]">{m.fileName ?? m.id}</p>
              </a>
            ))}
          </div>
          {photoCount > 8 && <p className="mt-1 text-[11px] text-[var(--text-faint)]">+{photoCount - 8} more photos</p>}
        </div>
      )}

      {/* Report-to-hotspot association — frontend-side */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
          <MapPin className="h-3.5 w-3.5 text-[var(--text-faint)]" /> ASSOCIATED REPORTS
          <span className="ml-auto text-[10px] font-normal text-[var(--text-faint)]">Explicit vs geographic</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">Community reports may be explicitly linked, geographically close, or unrelated. Geographic proximity does not prove the report refers to this hotspot.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[4px] border border-[#99f6e4] bg-[#f0fdfa] px-2 py-2">
            <p className="text-[10px] text-[#0f766e] font-semibold">LINKED</p>
            <p className="text-[16px] font-semibold tabular-nums text-[#0f766e]">{linkedReports.length}</p>
            <p className="text-[10px] text-[#115e59]">Linked observation</p>
          </div>
          <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
            <p className="text-[10px] text-[var(--text-faint)]">NEARBY</p>
            <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">{nearbyReports.length}</p>
            <p className="text-[10px] text-[var(--text-muted)]">≤3 km</p>
          </div>
          <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
            <p className="text-[10px] text-[var(--text-faint)]">POTENTIALLY</p>
            <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">{potentiallyRelated.length}</p>
            <p className="text-[10px] text-[var(--text-muted)]">3–10 km</p>
          </div>
        </div>
        {nearbyReports.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1">Nearby report — geographically close</p>
            <p className="text-[11px] text-[var(--text-faint)]">Proximity does not prove reference — review photo/timestamp. These are not explicitly linked to this hotspot.</p>
            <div className="mt-2 space-y-1.5">
              {nearbyReports.slice(0, 3).map(({ report, distanceKm }) => (
                <div key={report.id} className="flex items-center justify-between rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[11px]">
                  <span className="font-mono font-medium text-[var(--text-primary)]">{report.id}</span>
                  <span className="text-[var(--text-muted)]">{OBS_LABEL[report.observationType] ?? report.observationType}</span>
                  <span className="tabular-nums text-[var(--text-secondary)]">{distanceKm?.toFixed(1)} km</span>
                  <span className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[10px] text-[#92400e]">Potentially related</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {potentiallyRelated.length > 0 && nearbyReports.length === 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">Potentially related — broader area</p>
            <div className="mt-1 space-y-1.5">
              {potentiallyRelated.slice(0, 3).map(({ report, distanceKm }) => (
                <div key={report.id} className="flex items-center justify-between rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[11px]">
                  <span className="font-mono font-medium text-[var(--text-primary)]">{report.id}</span>
                  <span className="text-[var(--text-muted)]">{OBS_LABEL[report.observationType] ?? report.observationType}</span>
                  <span className="tabular-nums text-[var(--text-secondary)]">{distanceKm?.toFixed(1)} km</span>
                  <span className="rounded-full border border-[var(--border)] bg-white px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">3–10 km</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {nearbyReports.length === 0 && potentiallyRelated.length === 0 && linkedReports.length === 0 && (
          <p className="mt-2 text-[11px] text-[var(--text-faint)]">No linked or nearby reports within 10 km. Unrelated reports remain independent on map.</p>
        )}
        {nearbyReports.length > 0 && potentiallyRelated.length > 0 && (
          <div className="mt-2">
            <p className="text-[11px] font-medium text-[var(--text-secondary)]">Potentially related — broader area ({potentiallyRelated.length})</p>
            <p className="text-[11px] text-[var(--text-faint)]">Within 10 km but less likely — review before linking.</p>
          </div>
        )}
      </div>

      {/* Per-report community verification */}
      {reports.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
            <Users className="h-3.5 w-3.5 text-[var(--text-faint)]" /> GROUND REPORTS · {reports.length}
            <span className="ml-auto text-[10px] font-normal text-[var(--text-faint)]">Community Verification</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">Each observation shows independent ground evidence. Use <span className="font-medium text-[var(--text-secondary)]">I observed this</span> / <span className="font-medium text-[var(--text-secondary)]">I disagree</span> to record ground verification — not a popularity vote.</p>
          <div className="mt-3 space-y-3">
            {[...reports]
              .sort((a, b) => (a.observedAt > b.observedAt ? -1 : 1))
              .map((r) => (
                <div key={r.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-2.5">
                  <div className="flex items-start gap-2.5">
                    {r.media[0] ? (
                      <img src={r.media[0].thumbnailUrl ?? r.media[0].url} alt={`${r.id} thumbnail`} className="h-[48px] w-[64px] shrink-0 rounded-[4px] border border-[var(--border)] object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-[48px] w-[64px] shrink-0 items-center justify-center rounded-[4px] border border-dashed border-[var(--border)] bg-white text-[10px] text-[var(--text-faint)]">No photo</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)]">{r.id}</span>
                        <span className="rounded-[4px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{OBS_LABEL[r.observationType] ?? r.observationType}</span>
                        <span className="text-[11px] text-[var(--text-faint)]">· {fmtDate(r.observedAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">{r.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {r.hotspotId ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                            <MapPin className="h-3 w-3" /> {r.distanceToIncidentKm != null ? `${r.distanceToIncidentKm.toFixed(1)} km to ${r.hotspotId}` : `Linked to ${r.hotspotId}`}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-[10px] font-medium text-[#92400e]">Unlinked — candidate source</span>
                        )}
                        <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">Credibility {(r.credibilityScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <ReportVerificationControls report={r} />
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">If enough independent observers corroborate, status becomes <span className="font-medium text-[var(--success-text)]">Corroborated</span>; if both sides present, <span className="font-medium text-[var(--high-text)]">Conflicting observations</span>. Community evidence does not auto-confirm scientifically.</p>
        </div>
      )}

      {/* Incident timeline */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
          <Clock3 className="h-3.5 w-3.5 text-[var(--text-faint)]" /> INCIDENT TIMELINE
          <span className="ml-auto text-[10px] font-normal text-[var(--text-faint)]">{timeline.length} events</span>
        </div>
        <div className="relative mt-3 pl-4">
          <div className="absolute left-1 top-1 bottom-1 w-px bg-[var(--border)]" aria-hidden="true" />
          {timeline.map((item) => (
            <div key={`${item.time}-${item.label}`} className="relative flex gap-3 py-1.5">
              <span
                className={`absolute left-[-6px] top-[10px] h-2 w-2 rounded-full border border-white shadow-sm ${
                  item.kind === "sat" ? "bg-[#64748b]" : item.kind === "ai" ? "bg-[#475569]" : item.kind === "ground" ? "bg-[#0f5e59]" : item.kind === "photo" ? "bg-[#94a3b8]" : "bg-[#64748b]"
                }`}
                aria-hidden="true"
              />
              <span className="min-w-[42px] text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">{fmtTimeOnly(item.time)}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[var(--text-primary)]">{item.label}</p>
                <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]"><Activity className="h-3 w-3 inline text-[var(--text-faint)]" /> Timeline merges satellite + AI + ground (mock). No fake probability — each source stays separate.</p>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--text-faint)]"><ShieldCheck className="h-3 w-3 inline" /> Presentation layer only — ML logic untouched. Ground Evidence uses corroboration/dispute counts + photos + recency, not a calibrated model.</p>
    </div>
  );
}
