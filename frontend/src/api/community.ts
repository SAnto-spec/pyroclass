import type {
  CommunityReport,
  GroundEvidenceSummary,
  ObservationType,
  ReportMedia,
  ReportStatus,
  VerificationType,
} from "../types/community";
import { mockCommunityReports } from "../mocks/community";

/**
 * Community Ground Verification — Service / API Abstraction
 * --------------------------------------------------------
 * UI components must import from this file (not from mocks/community).
 * For now all functions are backed by local mock/state (no HTTP).
 *
 * Future mapping is 1:1 and requires only swapping the internals:
 *
 *   getCommunityReports()              → GET    /reports
 *   getCommunityReport(id)             → GET    /reports/{id}
 *   createCommunityReport(data)        → POST   /reports
 *   verifyCommunityReport(id, verdict) → POST   /reports/{id}/verify   { verdict }
 *   getIncidentGroundEvidence(id)      → GET    /hotspots/{id}/ground-evidence
 *
 * Keep UI unaware of the implementation:
 *   - Do not make HTTP requests yet.
 *   - Do not import mockCommunityReports in components.
 *   - Use the store (which calls this service) or call these functions directly.
 */

// ---------------------------------------------------------------------------
// Local mock state — future will be remote DB via FastAPI
// ---------------------------------------------------------------------------
let localReports: CommunityReport[] = [...mockCommunityReports];
let reportCounter = localReports.length;

function generateId(): string {
  reportCounter += 1;
  return `REP-${String(reportCounter).padStart(3, "0")}`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function mockCredibility(hasPhoto: boolean, distKm: number | null): number {
  const base = 0.38;
  const photo = hasPhoto ? 0.14 : 0;
  const prox = distKm == null ? 0.04 : 0.1 * (1 - Math.min(distKm, 10) / 10);
  const rand = 0.02 * (Math.random() - 0.5);
  return Math.max(0, Math.min(1, Number((base + photo + prox + rand + 0.08).toFixed(2))));
}

// Evidence helpers — kept here so UI does not need to import from mocks
const DISPUTING_TYPES: ReadonlySet<ObservationType> = new Set([
  "no_fire_observed",
  "false_alarm",
  "fire_extinguished",
]);
const NEUTRAL_TYPES: ReadonlySet<ObservationType> = new Set(["unknown"]);

export function isDisputing(t: ObservationType): boolean {
  return DISPUTING_TYPES.has(t);
}
export function isNeutral(t: ObservationType): boolean {
  return NEUTRAL_TYPES.has(t);
}
export function isCorroborating(t: ObservationType): boolean {
  return !isDisputing(t) && !isNeutral(t);
}
export { haversineKm };

// ---------------------------------------------------------------------------
// Types for mutations — keep simple, not a generic repository
// ---------------------------------------------------------------------------
export type CreateReportInput = {
  hotspotId: string | null;
  h3Cell: string | null;
  latitude: number;
  longitude: number;
  observationType: ObservationType;
  description: string;
  observedAt: string; // ISO
  mediaFiles: File[]; // 0-3 files, photo-only
  reporterName?: string;
};

export type CommunityMutationResult =
  | { ok: true; report: CommunityReport }
  | { ok: false; error: string; field?: string };

/**
 * GET /reports
 * Future: return (await apiClient.get<CommunityReport[]>("/reports")).data
 */
export async function getCommunityReports(): Promise<CommunityReport[]> {
  return localReports;
}

/** Alias kept for existing call sites — prefer getCommunityReports */
export async function fetchCommunityReports(): Promise<CommunityReport[]> {
  return getCommunityReports();
}

/** Synchronous read for store initialization (no HTTP) */
export function getCommunityReportsSync(): CommunityReport[] {
  return [...localReports];
}

export function getLocalCommunityReports(): CommunityReport[] {
  return getCommunityReportsSync();
}

/**
 * GET /reports/{id}
 * Future: return (await apiClient.get<CommunityReport>(`/reports/${id}`)).data
 */
export async function getCommunityReport(id: string): Promise<CommunityReport | null> {
  const found = localReports.find((r) => r.id === id) ?? null;
  return found ? { ...found } : null;
}

export function getCommunityReportSync(id: string): CommunityReport | null {
  const found = localReports.find((r) => r.id === id) ?? null;
  return found ? { ...found } : null;
}

/**
 * POST /reports
 * Future: await apiClient.post<CommunityReport>("/reports", formData, { headers: { "Content-Type": "multipart/form-data" } })
 * Body: CreateReportInput.mediaFiles + fields (hotspotId, latitude, longitude, observationType, description, observedAt)
 */
export async function createCommunityReport(input: CreateReportInput): Promise<CommunityMutationResult> {
  if (!input.observationType) return { ok: false, error: "Observation type is required", field: "observationType" };
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90)
    return { ok: false, error: "Latitude must be between -90 and 90", field: "latitude" };
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180)
    return { ok: false, error: "Longitude must be between -180 and 180", field: "longitude" };
  if (!input.observedAt || Number.isNaN(Date.parse(input.observedAt)))
    return { ok: false, error: "Observed date/time is required", field: "observedAt" };
  if (new Date(input.observedAt).getTime() > Date.now() + 60_000)
    return { ok: false, error: "Observed time cannot be in the future", field: "observedAt" };
  if (!input.description || input.description.trim().length < 10)
    return { ok: false, error: "Description must be at least 10 characters", field: "description" };
  if (input.description.trim().length > 600)
    return { ok: false, error: "Description must be 600 characters or less", field: "description" };
  if (input.mediaFiles.length > 3) return { ok: false, error: "Maximum 3 photos allowed", field: "media" };
  const tooLarge = input.mediaFiles.find((f) => f.size > 10 * 1024 * 1024);
  if (tooLarge) return { ok: false, error: `"${tooLarge.name}" exceeds 10 MB`, field: "media" };
  const badType = input.mediaFiles.find((f) => !f.type.startsWith("image/"));
  if (badType) return { ok: false, error: `"${badType.name}" is not an image`, field: "media" };

  await new Promise((r) => setTimeout(r, 450 + Math.random() * 250));

  const nowIso = new Date().toISOString();
  const id = generateId();

  const media: ReportMedia[] = input.mediaFiles.map((file, idx) => {
    const objectUrl = URL.createObjectURL(file);
    return {
      id: `MED-${id}-${idx + 1}`,
      kind: "photo" as const,
      url: objectUrl,
      thumbnailUrl: objectUrl,
      fileName: file.name,
      mimeType: file.type || "image/jpeg",
      sizeBytes: file.size,
      createdAt: nowIso,
    };
  });

  let distanceToIncidentKm: number | null = null;
  if (input.hotspotId) {
    try {
      const { mockAnomalies } = await import("../mocks/anomalies");
      const an = mockAnomalies.find((a) => a.id === input.hotspotId) ?? null;
      if (an) distanceToIncidentKm = Number(haversineKm(input.latitude, input.longitude, an.latitude, an.longitude).toFixed(2));
      else distanceToIncidentKm = 0.85;
    } catch {
      distanceToIncidentKm = 0.85;
    }
  }

  const credibilityScore = mockCredibility(media.length > 0, distanceToIncidentKm);

  const report: CommunityReport = {
    id,
    hotspotId: input.hotspotId,
    incidentId: input.hotspotId,
    h3Cell: input.h3Cell ?? null,
    latitude: input.latitude,
    longitude: input.longitude,
    observationType: input.observationType,
    description: input.description.trim(),
    media,
    observedAt: new Date(input.observedAt).toISOString(),
    submittedAt: nowIso,
    status: "new" as ReportStatus,
    confirmations: 0,
    disputes: 0,
    credibilityScore,
    distanceToIncidentKm,
    reporter: {
      id: "user-local",
      displayName: input.reporterName?.trim() || "Field Reporter",
    },
    verifications: [],
  };

  localReports = [report, ...localReports];
  return { ok: true, report };
}

export async function resetCommunityReports(): Promise<void> {
  localReports = [...mockCommunityReports];
  reportCounter = localReports.length;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_VERIFY_KEY);
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Verification — POST /reports/{id}/verify  { verdict }
// ---------------------------------------------------------------------------
export const CURRENT_USER_ID = "user-local";
const STORAGE_VERIFY_KEY = "pyro:verify:v1";
type VerifyType = VerificationType;

function loadVerifyMap(): Record<string, VerifyType> {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};
    const raw = window.localStorage.getItem(STORAGE_VERIFY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, VerifyType>;
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

function saveVerifyMap(map: Record<string, VerifyType>) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_VERIFY_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function hasVerified(reportId: string, userId: string = CURRENT_USER_ID): boolean {
  const map = loadVerifyMap();
  if (map[reportId]) return true;
  const report = localReports.find((r) => r.id === reportId);
  if (!report) return false;
  return (report.verifications ?? []).some((v) => v.userId === userId);
}

export function getUserVerificationType(reportId: string, userId: string = CURRENT_USER_ID): VerifyType | null {
  const map = loadVerifyMap();
  if (map[reportId]) return map[reportId];
  const report = localReports.find((r) => r.id === reportId);
  if (!report) return null;
  const v = (report.verifications ?? []).find((x) => x.userId === userId);
  return v ? v.type : null;
}

function recalcCredibility(confirmations: number, disputes: number, hasPhoto: boolean, distKm: number | null): number {
  const base = 0.30;
  const vote = 0.40 * (confirmations / (confirmations + disputes + 1));
  const photo = hasPhoto ? 0.20 : 0;
  const prox = distKm == null ? 0.05 : 0.10 * (1 - Math.min(distKm, 10) / 10);
  return Math.max(0, Math.min(1, Number((base + vote + photo + prox).toFixed(2))));
}

function deriveReportStatus(confirmations: number, disputes: number, current: ReportStatus): ReportStatus {
  if (confirmations === 0 && disputes === 0) return current;
  if (confirmations > 0 && disputes > 0) {
    if (current === "new") return "under_review";
    return current;
  }
  if (confirmations >= 3 && disputes === 0) {
    if (current === "new" || current === "under_review") return "corroborated";
    return current;
  }
  if (disputes >= 2 && confirmations === 0) {
    if (current === "new" || current === "under_review") return "disputed";
    return current;
  }
  if (confirmations > 0 && disputes === 0 && current === "new") return "under_review";
  return current;
}

export type VerifyReportInput = {
  reportId: string;
  type: VerifyType;
  note?: string;
  userId?: string;
};

/**
 * POST /reports/{id}/verify
 * Future: await apiClient.post(`/reports/${reportId}/verify`, { verdict, note })
 * @param verdict - "corroborate" | "dispute" (spec calls it verdict)
 */
export async function verifyCommunityReport(
  reportId: string,
  verdict: VerifyType,
  opts?: { note?: string; userId?: string }
): Promise<CommunityMutationResult> {
  const userId = opts?.userId ?? CURRENT_USER_ID;
  const note = opts?.note;
  const type = verdict;

  const idx = localReports.findIndex((r) => r.id === reportId);
  if (idx === -1) return { ok: false, error: "Report not found" };

  const report = localReports[idx];
  const verifyMap = loadVerifyMap();
  if (verifyMap[reportId]) {
    return { ok: false, error: `Already verified as "${verifyMap[reportId]}" — each observer may only submit one ground verification per report.` };
  }
  if ((report.verifications ?? []).some((v) => v.userId === userId)) {
    const existing = (report.verifications ?? []).find((v) => v.userId === userId)!;
    verifyMap[reportId] = existing.type;
    saveVerifyMap(verifyMap);
    return { ok: false, error: `Already verified as "${existing.type}" — each observer may only submit one ground verification per report.` };
  }
  if (report.reporter.id === userId) {
    return { ok: false, error: "Cannot verify your own ground observation." };
  }

  await new Promise((r) => setTimeout(r, 280 + Math.random() * 220));

  const nowIso = new Date().toISOString();
  const newVerification = {
    id: `VER-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 5)}`,
    reportId,
    type,
    userId,
    note,
    createdAt: nowIso,
  };

  const confirmations = report.confirmations + (type === "corroborate" ? 1 : 0);
  const disputes = report.disputes + (type === "dispute" ? 1 : 0);
  const credibilityScore = recalcCredibility(confirmations, disputes, report.media.length > 0, report.distanceToIncidentKm);
  const nextStatus = deriveReportStatus(confirmations, disputes, report.status);

  const updated: CommunityReport = {
    ...report,
    confirmations,
    disputes,
    credibilityScore,
    status: nextStatus,
    verifications: [...(report.verifications ?? []), newVerification],
  };

  localReports = [...localReports.slice(0, idx), updated, ...localReports.slice(idx + 1)];
  verifyMap[reportId] = type;
  saveVerifyMap(verifyMap);

  return { ok: true, report: updated };
}

// ---------------------------------------------------------------------------
// Ground evidence — GET /hotspots/{id}/ground-evidence
// ---------------------------------------------------------------------------
function buildGroundEvidenceFor(hotspotId: string, reports: CommunityReport[]): GroundEvidenceSummary | null {
  const list = reports.filter((r) => r.hotspotId === hotspotId);
  if (list.length === 0) return null;
  let corroborating = 0;
  let disputing = 0;
  let credibilitySum = 0;
  let latest: string | null = null;
  for (const r of list) {
    if (isCorroborating(r.observationType)) corroborating++;
    else if (isDisputing(r.observationType)) disputing++;
    credibilitySum += r.credibilityScore;
    if (!latest || r.observedAt > latest) latest = r.observedAt;
  }
  const totalReports = list.length;
  const avgCredibility = totalReports ? Number((credibilitySum / totalReports).toFixed(2)) : null;
  const conflicting = corroborating > 0 && disputing > 0;
  let consensus: GroundEvidenceSummary["consensus"];
  if (conflicting) consensus = "conflicting";
  else if (corroborating > disputing) consensus = "corroborated";
  else if (disputing > corroborating) consensus = "disputed";
  else consensus = "insufficient";
  return {
    hotspotId,
    totalReports,
    corroborating,
    disputing,
    conflicting,
    latestObservedAt: latest,
    avgCredibility,
    consensus,
  };
}

/**
 * GET /hotspots/{id}/ground-evidence
 * Future: return (await apiClient.get<GroundEvidenceSummary>(`/hotspots/${hotspotId}/ground-evidence`)).data
 */
export async function getIncidentGroundEvidence(hotspotId: string): Promise<GroundEvidenceSummary | null> {
  const list = localReports.filter((r) => r.hotspotId === hotspotId);
  if (list.length === 0) return null;
  return buildGroundEvidenceFor(hotspotId, localReports);
}

export function getIncidentGroundEvidenceSync(hotspotId: string): GroundEvidenceSummary | null {
  const list = localReports.filter((r) => r.hotspotId === hotspotId);
  if (list.length === 0) return null;
  return buildGroundEvidenceFor(hotspotId, localReports);
}

/**
 * GET /hotspots/ground-evidence (optional helper for bulk)
 * Future: GET /hotspots/ground-evidence?ids=...
 */
export async function getAllGroundEvidence(): Promise<GroundEvidenceSummary[]> {
  const byHotspot = new Map<string, CommunityReport[]>();
  for (const r of localReports) {
    if (!r.hotspotId) continue;
    const arr = byHotspot.get(r.hotspotId) ?? [];
    arr.push(r);
    byHotspot.set(r.hotspotId, arr);
  }
  const summaries: GroundEvidenceSummary[] = [];
  for (const [hotspotId] of byHotspot) {
    const s = buildGroundEvidenceFor(hotspotId, localReports);
    if (s) summaries.push(s);
  }
  return summaries.sort((a, b) => a.hotspotId.localeCompare(b.hotspotId));
}

export function getAllGroundEvidenceSync(): GroundEvidenceSummary[] {
  const byHotspot = new Map<string, CommunityReport[]>();
  for (const r of localReports) {
    if (!r.hotspotId) continue;
    const arr = byHotspot.get(r.hotspotId) ?? [];
    arr.push(r);
    byHotspot.set(r.hotspotId, arr);
  }
  const summaries: GroundEvidenceSummary[] = [];
  for (const [hotspotId] of byHotspot) {
    const s = buildGroundEvidenceFor(hotspotId, localReports);
    if (s) summaries.push(s);
  }
  return summaries.sort((a, b) => a.hotspotId.localeCompare(b.hotspotId));
}

// Re-export demo scenarios for judge navigation — still mock, but via service abstraction
export { DEMO_SCENARIOS } from "../mocks/community";
