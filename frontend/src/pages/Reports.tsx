import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Clock3, MapPin, ShieldCheck, ShieldAlert, Users, Filter, SearchX, Download, Eye, ExternalLink, Activity } from "lucide-react";
import { GlobalContextBar } from "../components/layout/GlobalContextBar";
import { SavedViewsBar } from "../components/layout/SavedViewsBar";
import { Freshness } from "../components/layout/Freshness";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Drawer } from "../components/ui/Drawer";
import { ReportVerificationControls } from "../components/community/ReportVerificationControls";
import { DemoScenarioBar } from "../components/community/DemoScenarioBar";
import { useCommunityStore } from "../store/communityStore";
import { mockAnomalies } from "../mocks/anomalies";
import type { CommunityReport, ObservationType, ReportStatus } from "../types/community";
import { partitionReports } from "../lib/association";

const OBS_LABEL: Record<ObservationType, string> = {
  fire_visible: "Fire visible",
  smoke_visible: "Smoke visible",
  industrial_activity: "Industrial activity",
  agricultural_burning: "Agri burning",
  no_fire_observed: "No fire",
  fire_extinguished: "Extinguished",
  false_alarm: "False alarm",
  unknown: "Unknown",
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "New",
  under_review: "Under review",
  corroborated: "Corroborated",
  disputed: "Disputed",
  confirmed: "Confirmed",
  rejected: "Rejected",
  resolved: "Resolved",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}
function fmtTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function daysAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}
function getVisualState(r: CommunityReport): { label: string; variant: "success" | "high" | "medium" | "low" | "secondary" } {
  const c = r.confirmations;
  const d = r.disputes;
  if (c > 0 && d > 0) return { label: "Conflicting", variant: "high" };
  if (c >= 3 && d === 0) return { label: "Corroborated", variant: "success" };
  if (c >= 2 && d === 0) return { label: "Corroborated", variant: "success" };
  if (d >= 2 && c === 0) return { label: "Disputed", variant: "medium" };
  if (c === 0 && d === 0) return { label: "Unverified", variant: "secondary" };
  return { label: "Unverified", variant: "secondary" };
}
function getEvidenceLevel(r: CommunityReport): "HIGH" | "MEDIUM" | "LOW" | "CONFLICTING" | "INSUFFICIENT" {
  const c = r.confirmations;
  const d = r.disputes;
  if (c > 0 && d > 0) return "CONFLICTING";
  if (c >= 3 && r.media.length >= 1 && r.credibilityScore >= 0.65) return "HIGH";
  if (c >= 2 && r.credibilityScore >= 0.6) return "HIGH";
  if (c >= 2) return "MEDIUM";
  if (c === 1 && d === 0) return "MEDIUM";
  if (d > c) return "LOW";
  if (c === 0 && d === 0) return "INSUFFICIENT";
  return "LOW";
}

export function Reports() {
  const reports = useCommunityStore((s) => s.reports);
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [obsType, setObsType] = useState<ObservationType | "all">("all");
  const [date, setDate] = useState<"all" | "7d" | "14d" | "30d">("all");
  const [linked, setLinked] = useState<"all" | "linked" | "unlinked">("all");
  const [evidence, setEvidence] = useState<"all" | "HIGH" | "MEDIUM" | "LOW" | "CONFLICTING" | "INSUFFICIENT">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Summary derived from all reports (operational, not social)
  const summary = useMemo(() => {
    const active = reports.filter((r) => r.status !== "rejected" && r.status !== "resolved").length;
    const corroborated = reports.filter((r) => getVisualState(r).label === "Corroborated").length;
    const conflicting = reports.filter((r) => getVisualState(r).label === "Conflicting").length;
    const unverified = reports.filter((r) => getVisualState(r).label === "Unverified").length;
    return { active, corroborated, conflicting, unverified, total: reports.length };
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (q) {
        const hay = `${r.id} ${r.observationType} ${r.hotspotId ?? ""} ${r.description} ${r.reporter.displayName}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (status !== "all" && r.status !== status) return false;
      if (obsType !== "all" && r.observationType !== obsType) return false;
      if (date !== "all") {
        const d = daysAgo(r.observedAt);
        if (date === "7d" && d > 7) return false;
        if (date === "14d" && d > 14) return false;
        if (date === "30d" && d > 30) return false;
      }
      if (linked !== "all") {
        const isLinked = !!r.hotspotId;
        if (linked === "linked" && !isLinked) return false;
        if (linked === "unlinked" && isLinked) return false;
      }
      if (evidence !== "all" && getEvidenceLevel(r) !== evidence) return false;
      return true;
    });
  }, [reports, q, status, obsType, date, linked, evidence]);

  const selected = useMemo(() => (selectedId ? reports.find((r) => r.id === selectedId) ?? null : null), [reports, selectedId]);
  const selectedAnomaly = selected?.hotspotId ? mockAnomalies.find((a) => a.id === selected.hotspotId) ?? null : null;

  const hasActiveFilters = q !== "" || status !== "all" || obsType !== "all" || date !== "all" || linked !== "all" || evidence !== "all";
  const clearAll = () => {
    setQ("");
    setStatus("all");
    setObsType("all");
    setDate("all");
    setLinked("all");
    setEvidence("all");
  };

  // Timeline for selected report
  const timeline = useMemo(() => {
    if (!selected) return [];
    type Item = { time: string; label: string; detail: string; kind: "sat" | "ai" | "ground" | "verify" | "photo" };
    const items: Item[] = [];
    if (selectedAnomaly) {
      items.push({ time: selectedAnomaly.detectedAt, label: "FIRMS detection", detail: `VIIRS · ${selectedAnomaly.frp.toFixed(1)} MW · ${selectedAnomaly.id}`, kind: "sat" });
      const aiTime = new Date(new Date(selectedAnomaly.detectedAt).getTime() + 3 * 60000).toISOString();
      items.push({ time: aiTime, label: "AI classification", detail: `${selectedAnomaly.classification} · ${selectedAnomaly.confidence}%`, kind: "ai" });
    }
    items.push({ time: selected.observedAt, label: "Ground observation submitted", detail: `${OBS_LABEL[selected.observationType]} · ${selected.id}`, kind: "ground" });
    if (selected.media.length) items.push({ time: selected.submittedAt, label: "Photo submitted", detail: `${selected.media.length} photo(s)`, kind: "photo" });
    for (const v of (selected.verifications ?? [])) {
      items.push({ time: v.createdAt, label: v.type === "corroborate" ? "User corroborated" : "User disputed", detail: v.note ?? selected.id, kind: "verify" });
    }
    return items.sort((a, b) => (a.time > b.time ? 1 : -1));
  }, [selected, selectedAnomaly]);

  // Association label for selected
  const association = useMemo(() => {
    if (!selected || !selectedAnomaly) return null;
    // find partition via helper would need allReports; simplify: if explicitly linked show linked, else compute distance
    if (selected.hotspotId === selectedAnomaly.id) return { kind: "Linked observation" as const, distance: selected.distanceToIncidentKm };
    // For demo, compute via association lib if available
    const all = reports;
    const part = partitionReports(selectedAnomaly, all);
    const near = part.nearby.find((p) => p.report.id === selected.id);
    if (near) return { kind: "Nearby report" as const, distance: near.distanceKm };
    const pot = part.potentiallyRelated.find((p) => p.report.id === selected.id);
    if (pot) return { kind: "Potentially related" as const, distance: pot.distanceKm };
    return null;
  }, [selected, selectedAnomaly, reports]);

  return (
    <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 space-y-4">
      <GlobalContextBar />
      <SavedViewsBar />
      <div className="flex items-center justify-between">
        <Freshness source="mock" timestamp={reports[0]?.submittedAt} />
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-[11px] text-[var(--text-muted)]">{filtered.length} / {reports.length} reports</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const rows = filtered.map((r) => ({
                id: r.id,
                status: r.status,
                observationType: r.observationType,
                latitude: r.latitude,
                longitude: r.longitude,
                hotspotId: r.hotspotId ?? "",
                submittedAt: r.submittedAt,
                confirmations: r.confirmations,
                disputes: r.disputes,
                credibility: (r.credibilityScore * 100).toFixed(0),
              }));
              const cols = ["id", "status", "observationType", "latitude", "longitude", "hotspotId", "submittedAt", "confirmations", "disputes", "credibility"];
              const csv = [cols.join(","), ...rows.map((row) => cols.map((c) => `"${String((row as Record<string, unknown>)[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "ground-reports.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-3 w-3" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[#0f766e] text-white">
            <ShieldCheck className="h-4 w-4" />
          </span>
          Community Ground Verification
        </h1>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-[var(--text-muted)]">
          Operational verification of ground reports — distinct from AI prediction and satellite confidence. Review linked, nearby, and unlinked observations before escalation.
        </p>
      </div>

      <DemoScenarioBar />

      {/* Summary cards — operational, restrained */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[4px] border border-[var(--border)] bg-white px-3 py-3 border-l-[3px] border-l-[var(--border-strong)] transition-colors duration-150">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium tracking-[0.05em] text-[var(--text-muted)]">ACTIVE REPORTS</p>
            <Users className="h-3.5 w-3.5 text-[var(--text-faint)]" aria-hidden="true" />
          </div>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">{summary.active}</p>
          <p className="text-[11px] text-[var(--text-muted)]">{summary.total} total · awaiting review</p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-white px-3 py-3 border-l-[3px] border-l-[#0f5e59] transition-colors duration-150">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium tracking-[0.05em] text-[#0f5e59]">CORROBORATED</p>
            <ShieldCheck className="h-3.5 w-3.5 text-[#0f5e59]" aria-hidden="true" />
          </div>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">{summary.corroborated}</p>
          <p className="text-[11px] text-[var(--text-muted)]">Community Evidence — high</p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-white px-3 py-3 border-l-[3px] border-l-[#b45309] transition-colors duration-150">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium tracking-[0.05em] text-[#92400e]">CONFLICTING</p>
            <ShieldAlert className="h-3.5 w-3.5 text-[#b45309]" aria-hidden="true" />
          </div>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">{summary.conflicting}</p>
          <p className="text-[11px] text-[var(--text-muted)]">Requires adjudication</p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-white px-3 py-3 border-l-[3px] border-l-[var(--border-strong)] transition-colors duration-150">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium tracking-[0.05em] text-[var(--text-muted)]">UNVERIFIED</p>
            <Eye className="h-3.5 w-3.5 text-[var(--text-faint)]" aria-hidden="true" />
          </div>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-[var(--text-secondary)] tabular-nums">{summary.unverified}</p>
          <p className="text-[11px] text-[var(--text-muted)]">Awaiting corroboration</p>
        </div>
      </div>

      {/* Filters — operational, dense */}
      <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="text-[11px] font-medium tracking-[0.04em] text-[var(--text-secondary)]">Filters</p>
          <span className="ml-auto text-[11px] tabular-nums text-[var(--text-muted)]">{filtered.length} of {reports.length} reports</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 text-[11px] transition-colors duration-150">
              Clear
            </Button>
          )}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-muted)]">SEARCH</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="REP-001, fire_visible…" className="mt-1 h-7 bg-white text-[12px] transition-colors duration-150" />
          </div>
          <div>
            <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-muted)]">STATUS</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as never)} className="mt-1 h-7 bg-white text-[12px] transition-colors duration-150">
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="under_review">Under review</option>
              <option value="corroborated">Corroborated</option>
              <option value="disputed">Disputed</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
              <option value="resolved">Resolved</option>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-muted)]">OBSERVATION</label>
            <Select value={obsType} onChange={(e) => setObsType(e.target.value as never)} className="mt-1 h-7 bg-white text-[12px] transition-colors duration-150">
              <option value="all">All types</option>
              <option value="fire_visible">Fire visible</option>
              <option value="smoke_visible">Smoke visible</option>
              <option value="industrial_activity">Industrial activity</option>
              <option value="agricultural_burning">Agri burning</option>
              <option value="no_fire_observed">No fire</option>
              <option value="fire_extinguished">Extinguished</option>
              <option value="false_alarm">False alarm</option>
              <option value="unknown">Unknown</option>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-muted)]">DATE</label>
            <Select value={date} onChange={(e) => setDate(e.target.value as never)} className="mt-1 h-7 bg-white text-[12px] transition-colors duration-150">
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-muted)]">LINKAGE</label>
            <Select value={linked} onChange={(e) => setLinked(e.target.value as never)} className="mt-1 h-7 bg-white text-[12px] transition-colors duration-150">
              <option value="all">All linkages</option>
              <option value="linked">Linked to hotspot</option>
              <option value="unlinked">Unlinked</option>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-muted)]">EVIDENCE</label>
            <Select value={evidence} onChange={(e) => setEvidence(e.target.value as never)} className="mt-1 h-7 bg-white text-[12px] transition-colors duration-150">
              <option value="all">All levels</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="CONFLICTING">Conflicting</option>
              <option value="INSUFFICIENT">Insufficient</option>
            </Select>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">Operational filters — not social feed ranking. Linked vs unlinked distinguishes explicit reference from geographic proximity.</p>
      </div>

      {/* Table — operational, dense */}
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Ground Reports</p>
          <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{filtered.length} records</span>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)]">
              <SearchX className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            </div>
            <p className="mt-3 text-[13px] font-medium text-[var(--text-primary)]">No reports match filters</p>
            <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-[var(--text-muted)]">Adjust status, observation type, date range, linkage or evidence level. Filters combine with AND — clear to show all operational reports.</p>
            {hasActiveFilters && (
              <Button variant="secondary" size="sm" onClick={clearAll} className="mt-4 transition-colors duration-150">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[12px]">
              <thead className="bg-[var(--surface-subtle)] text-[11px] tracking-[0.04em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Report</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Observation</th>
                  <th className="px-2 py-2 font-medium">Location</th>
                  <th className="px-2 py-2 font-medium">Linked hotspot</th>
                  <th className="px-2 py-2 font-medium">Submitted</th>
                  <th className="px-2 py-2 font-medium text-right">Conf.</th>
                  <th className="px-2 py-2 font-medium text-right">Disp.</th>
                  <th className="px-3 py-2 font-medium text-right">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((r) => {
                  const vs = getVisualState(r);
                  const level = getEvidenceLevel(r);
                  const an = r.hotspotId ? mockAnomalies.find((a) => a.id === r.hotspotId) ?? null : null;
                  return (
                    <tr key={r.id} onClick={() => setSelectedId(r.id)} className="cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-subtle)]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)]">{r.id}</span>
                          {r.media.length > 0 && <Camera className="h-3 w-3 text-[var(--text-faint)]" />}
                        </div>
                        <span className="text-[11px] text-[var(--text-faint)]">{r.reporter.displayName}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${vs.label === "Corroborated" ? "bg-[#0f5e59]" : vs.label === "Conflicting" ? "bg-[#b45309]" : vs.label === "Disputed" ? "bg-[#a16207]" : "bg-[var(--text-faint)]"}`}
                            aria-hidden="true"
                          />
                          {STATUS_LABEL[r.status]}
                        </span>
                        <div className="mt-1 text-[10px] text-[var(--text-faint)]">{vs.label}</div>
                      </td>
                      <td className="px-2 py-2.5 text-[var(--text-secondary)]">{OBS_LABEL[r.observationType]}</td>
                      <td className="px-2 py-2.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                        {r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}
                      </td>
                      <td className="px-2 py-2.5">
                        {r.hotspotId ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                            {r.hotspotId} {an ? `· ${an.classification.replace("_", " ")}` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-[11px] text-[#92400e]">Unlinked</span>
                        )}
                        {r.distanceToIncidentKm != null && <div className="text-[10px] tabular-nums text-[var(--text-faint)]">{r.distanceToIncidentKm.toFixed(1)} km</div>}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-[var(--text-muted)]">{fmtDate(r.submittedAt)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-medium text-[var(--success-text)]">{r.confirmations}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-medium text-[var(--high-text)]">{r.disputes}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                          <span className={`h-1.5 w-1.5 rounded-full ${level === "HIGH" ? "bg-[#0f5e59]" : level === "CONFLICTING" ? "bg-[#b45309]" : level === "MEDIUM" ? "bg-[#0284c7]" : "bg-[var(--text-faint)]"}`} aria-hidden="true" />
                          {level} · {(r.credibilityScore * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer — operational */}
      <Drawer open={!!selected} onClose={() => setSelectedId(null)} title={selected ? `Ground Report ${selected.id}` : undefined} description={selected ? `${OBS_LABEL[selected.observationType]} · ${STATUS_LABEL[selected.status]}` : undefined} width="w-[560px]">
        {selected && (
          <div className="space-y-4 p-4">
            {/* Photo — prominent but not social */}
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
              {selected.media[0] ? (
                <img src={selected.media[0].url} alt={`${selected.id} photo`} className="h-[220px] w-full object-cover" />
              ) : (
                <div className="flex h-[160px] items-center justify-center bg-[var(--surface-subtle)] text-[11px] text-[var(--text-faint)]">No photo — observation unverified</div>
              )}
              <div className="grid grid-cols-3 gap-2 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
                {selected.media.slice(0, 3).map((m) => (
                  <img key={m.id} src={m.thumbnailUrl ?? m.url} alt={m.fileName} className="h-[56px] w-full rounded-[4px] border border-[var(--border)] object-cover" />
                ))}
                {selected.media.length === 0 && <span className="col-span-3 text-center text-[11px] text-[var(--text-faint)]">No additional photos</span>}
              </div>
            </div>

            {/* Key facts — dense operational */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">LOCATION (WGS84)</p>
                <p className="mt-1 flex items-center gap-1 font-mono text-[12px] font-medium tabular-nums text-[var(--text-primary)]">
                  <MapPin className="h-3 w-3 text-[var(--text-faint)]" /> {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">H3 {selected.h3Cell ?? "—"}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">LINKED HOTSPOT</p>
                {selected.hotspotId ? (
                  <>
                    <p className="mt-1 font-mono text-[12px] font-medium text-[var(--text-primary)]">{selected.hotspotId}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {(() => {
                        const an = mockAnomalies.find((a) => a.id === selected.hotspotId);
                        return an ? `${an.classification.replace("_", " ")} · ${selected.distanceToIncidentKm?.toFixed(1) ?? "—"} km` : "Linked — not in current view";
                      })()}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--text-faint)]">Linked observation — explicit reference</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-[12px] font-medium text-[#92400e]">Unlinked — candidate source</p>
                    <p className="text-[11px] text-[var(--text-muted)]">No FIRMS hotspot reference</p>
                  </>
                )}
                {selected.hotspotId && (
                  <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => navigate(`/anomalies/${selected.hotspotId}`)}>
                    <ExternalLink className="h-3 w-3" /> View hotspot {selected.hotspotId}
                  </Button>
                )}
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">OBSERVATION TIME</p>
                <p className="mt-1 flex items-center gap-1 text-[12px] font-medium tabular-nums text-[var(--text-primary)]">
                  <Clock3 className="h-3 w-3 text-[var(--text-faint)]" /> {fmtDate(selected.observedAt)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">Submitted {fmtDate(selected.submittedAt)}</p>
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">EVIDENCE STATUS</p>
                <p className="mt-1">
                  <Badge variant={getVisualState(selected).variant === "success" ? "success" : getVisualState(selected).variant === "high" ? "high" : "secondary"}>
                    {getVisualState(selected).label}
                  </Badge>
                  <span className="ml-2 text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">{getEvidenceLevel(selected)} · {(selected.credibilityScore * 100).toFixed(0)}%</span>
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">Community Evidence — distinct from AI confidence</p>
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
              <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">DESCRIPTION</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{selected.description}</p>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">Reporter: {selected.reporter.displayName} {selected.reporter.role ? `· ${selected.reporter.role}` : ""}</p>
            </div>

            {/* Confirmations / disputes + verification */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Community Verification</p>
                <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                  {selected.confirmations} corroborate · {selected.disputes} dispute
                </span>
              </div>
              <div className="mt-3">
                <ReportVerificationControls report={selected} />
              </div>
            </div>

            {/* Incident timeline — per report */}
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-3">
              <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)] flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-[var(--text-faint)]" /> Incident timeline
              </p>
              <div className="relative mt-3 pl-4">
                <div className="absolute left-1 top-1 bottom-1 w-px bg-[var(--border)]" aria-hidden="true" />
                {timeline.map((item) => (
                  <div key={`${item.time}-${item.label}`} className="relative flex gap-3 py-1.5">
                    <span
                      className={`absolute left-[-6px] top-[10px] h-2 w-2 rounded-full border border-white shadow-sm ${item.kind === "sat" ? "bg-[#64748b]" : item.kind === "ai" ? "bg-[#475569]" : item.kind === "ground" ? "bg-[#0f5e59]" : item.kind === "photo" ? "bg-[#94a3b8]" : "bg-[#64748b]"}`}
                    />
                    <span className="min-w-[42px] text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">{fmtTimeOnly(item.time)}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--text-primary)]">{item.label}</p>
                      <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              {association && (
                <p className="mt-2 rounded-[4px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  Association: <span className="font-medium text-[var(--text-secondary)]">{association.kind}</span> {association.distance != null ? `· ${association.distance.toFixed(1)} km` : ""} — geographic proximity does not prove reference.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setSelectedId(null)}>
                Close
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => selected.hotspotId && navigate(`/anomalies/${selected.hotspotId}`)} disabled={!selected.hotspotId}>
                <ExternalLink className="h-3 w-3" /> Open hotspot
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
