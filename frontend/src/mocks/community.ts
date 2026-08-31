import type {
  CommunityReport,
  GroundEvidenceSummary,
  ObservationType,
  ReportMedia,
  ReportVerification,
} from "../types/community";
import { mockAnomalies } from "./anomalies";

/**
 * Community Ground Verification — Demo / Mock Dataset
 * ----------------------------------------------------
 * Purpose: Judge-facing demonstration of how PyroClass combines
 * satellite intelligence with human ground observations.
 * 
 * All data below is MOCK / DEMO ONLY — not real observations.
 * Do not treat as ground truth. Each scenario is deliberately
 * crafted to show a distinct operational pattern.
 * 
 * Geography: All coordinates are within India and plausible for
 * industrial, agricultural, and mining contexts.
 */

// ---------------------------------------------------------------------------
// Local haversine — kept here per plan correction (no lib/geo.ts yet).
// Extract to lib/geo.ts when map/report-linking needs it.
// ---------------------------------------------------------------------------
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function anomalyById(id: string) {
  return mockAnomalies.find((a) => a.id === id) ?? null;
}

function distToAnomalyKm(lat: number, lon: number, hotspotId: string | null): number | null {
  if (!hotspotId) return null;
  const an = anomalyById(hotspotId);
  if (!an) return null;
  return Number(haversineKm(lat, lon, an.latitude, an.longitude).toFixed(2));
}

// ---------------------------------------------------------------------------
// Aggregation rules — explicit definitions (do not hard-code claims about counts).
//
// GroundEvidenceSummary aggregates per hotspotId from linked CommunityReports:
//
// 1) Neutral types:  "unknown" is neutral — counts toward totalReports but
//    neither corroborating nor disputing.
//
// 2) Disputing observations:  "no_fire_observed" | "false_alarm" | "fire_extinguished"
//    — these communicate absence/abatement/false positive at the FIRMS location
//    → counted in `disputing`.
//
// 3) Corroborating observations: all other non-neutral types
//    ("fire_visible" | "smoke_visible" | "industrial_activity" | "agricultural_burning")
//    → counted in `corroborating`.
//
// 4) conflicting = corroborating > 0 && disputing > 0
// 5) consensus:
//      if totalReports === 0 → "insufficient" (no GroundEvidenceSummary created)
//      else if conflicting → "conflicting"
//      else if corroborating > disputing → "corroborated"
//      else if disputing > corroborating → "disputed"
//      else → "insufficient" (e.g. only neutral)
//
// 6) avgCredibility = mean(credibilityScore) over linked reports, null if none
// ---------------------------------------------------------------------------
const DISPUTING_TYPES: ReadonlySet<ObservationType> = new Set([
  "no_fire_observed",
  "false_alarm",
  "fire_extinguished",
]);
const NEUTRAL_TYPES: ReadonlySet<ObservationType> = new Set(["unknown"]);

function isDisputing(t: ObservationType): boolean {
  return DISPUTING_TYPES.has(t);
}
function isNeutral(t: ObservationType): boolean {
  return NEUTRAL_TYPES.has(t);
}
function isCorroborating(t: ObservationType): boolean {
  return !isDisputing(t) && !isNeutral(t);
}

// ---------------------------------------------------------------------------
// Mock helpers — photo/media factory (photo-only per plan)
// ---------------------------------------------------------------------------
function photoMedia(seed: string, createdAt: string): ReportMedia {
  // picsum.photos mock — stable per seed, CDN replacement later
  return {
    id: `MED-${seed}`,
    kind: "photo",
    url: `https://picsum.photos/seed/${seed}/400/300`,
    thumbnailUrl: `https://picsum.photos/seed/${seed}/100/75`,
    fileName: `${seed}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1_200_000,
    createdAt,
  };
}

function verification(id: string, reportId: string, type: ReportVerification["type"], userId: string, createdAt: string, note?: string): ReportVerification {
  return { id, reportId, type, userId, createdAt, note };
}

// ---------------------------------------------------------------------------
// Credibility heuristic (mock, 0-1) — DISTINCT from AI confidence 0-100.
// 0.3 base + 0.4*confirmations/(confirmations+disputes+1) + 0.2*hasPhoto + 0.1*(1 - min(dist,10)/10)
// Clamped 0-1. Documented as mock heuristic, not ML.
// ---------------------------------------------------------------------------
function mockCredibility(confirmations: number, disputes: number, hasPhoto: boolean, distKm: number | null): number {
  const base = 0.3;
  const vote = 0.4 * (confirmations / (confirmations + disputes + 1));
  const photo = hasPhoto ? 0.2 : 0;
  const prox = distKm == null ? 0.05 : 0.1 * (1 - Math.min(distKm, 10) / 10);
  return Math.max(0, Math.min(1, Number((base + vote + photo + prox).toFixed(2))));
}

// ---------------------------------------------------------------------------
// Reports — Demo Scenarios for Judge Evaluation
// All mock, geographically plausible within India.
// ---------------------------------------------------------------------------
const REPORTS: CommunityReport[] = [
  // ========================================================================
  // SCENARIO 1 — Strong corroboration (Mumbai Refinery Belt — Western India)
  // FIRMS: AN-001 (19.076,72.877) industrial_fire, 52.4 MW, 0.91 persistence
  // AI: industrial_fire 94% confidence, Priority 74
  // Ground: 3 linked reports with photos, high confirmations, high credibility
  // Result: Ground Evidence HIGH — 3 observations, 3 corroborating, photos 3
  // Demo: Satellite + AI + Human all agree
  // ========================================================================
  {
    id: "REP-001",
    hotspotId: "AN-001",
    incidentId: "AN-001",
    h3Cell: "87254a93fffffff",
    latitude: 19.082,
    longitude: 72.884,
    observationType: "fire_visible",
    description: "[SCENARIO 1] Active flame visible at refinery boundary, ~80m stack flare. Consistent with FIRMS thermal peak. Multiple independent observers confirmed.",
    media: [photoMedia("rep001", "2026-08-29T07:10:00Z")],
    observedAt: "2026-08-29T07:10:00Z",
    submittedAt: "2026-08-29T07:25:00Z",
    status: "confirmed",
    confirmations: 4,
    disputes: 0,
    credibilityScore: mockCredibility(4, 0, true, distToAnomalyKm(19.082, 72.884, "AN-001")),
    distanceToIncidentKm: distToAnomalyKm(19.082, 72.884, "AN-001"),
    reporter: { id: "user-01", displayName: "Community Observer 1" },
    verifications: [
      verification("VER-001a", "REP-001", "corroborate", "user-02", "2026-08-29T08:00:00Z"),
      verification("VER-001b", "REP-001", "corroborate", "user-03", "2026-08-29T08:15:00Z"),
      verification("VER-001c", "REP-001", "corroborate", "user-04", "2026-08-29T08:30:00Z"),
      verification("VER-001d", "REP-001", "corroborate", "user-05", "2026-08-29T09:00:00Z"),
    ],
  },
  {
    id: "REP-014",
    hotspotId: "AN-001",
    incidentId: "AN-001",
    h3Cell: "87254a93fffffff",
    latitude: 19.08,
    longitude: 72.882,
    observationType: "smoke_visible",
    description: "[SCENARIO 1] Dense black smoke plume 0.5 km NE of AN-001. Second independent observation, photo shows smoke column consistent with REP-001 flame location.",
    media: [photoMedia("rep014", "2026-08-29T07:30:00Z")],
    observedAt: "2026-08-29T07:30:00Z",
    submittedAt: "2026-08-29T07:45:00Z",
    status: "corroborated",
    confirmations: 3,
    disputes: 0,
    credibilityScore: mockCredibility(3, 0, true, distToAnomalyKm(19.08, 72.882, "AN-001")),
    distanceToIncidentKm: distToAnomalyKm(19.08, 72.882, "AN-001"),
    reporter: { id: "user-14", displayName: "Field Volunteer — Mumbai" },
    verifications: [
      verification("VER-014a", "REP-014", "corroborate", "user-15", "2026-08-29T08:10:00Z"),
      verification("VER-014b", "REP-014", "corroborate", "user-16", "2026-08-29T08:20:00Z"),
      verification("VER-014c", "REP-014", "corroborate", "user-17", "2026-08-29T08:35:00Z"),
    ],
  },
  {
    id: "REP-015",
    hotspotId: "AN-001",
    incidentId: "AN-001",
    h3Cell: "87254a93fffffff",
    latitude: 19.085,
    longitude: 72.88,
    observationType: "industrial_activity",
    description: "[SCENARIO 1] Third corroborating observation — industrial flare activity confirmed, photo of stack with visible combustion. Independent from REP-001/014.",
    media: [photoMedia("rep015", "2026-08-29T07:50:00Z")],
    observedAt: "2026-08-29T07:50:00Z",
    submittedAt: "2026-08-29T08:05:00Z",
    status: "corroborated",
    confirmations: 3,
    disputes: 0,
    credibilityScore: mockCredibility(3, 0, true, distToAnomalyKm(19.085, 72.88, "AN-001")),
    distanceToIncidentKm: distToAnomalyKm(19.085, 72.88, "AN-001"),
    reporter: { id: "user-18", displayName: "Community Observer — Trombay" },
    verifications: [
      verification("VER-015a", "REP-015", "corroborate", "user-19", "2026-08-29T08:40:00Z"),
      verification("VER-015b", "REP-015", "corroborate", "user-20", "2026-08-29T08:55:00Z"),
      verification("VER-015c", "REP-015", "corroborate", "user-21", "2026-08-29T09:10:00Z"),
    ],
  },
  // ========================================================================
  // SCENARIO 2 — False positive / persistent industrial heat (Mundra, Gujarat)
  // FIRMS: AN-003 (22.74,69.7) persistent gas flare / industrial, 68.1 MW, 0.88 persistence
  // Context: Mundra Petrochemical — known persistent flare, industrial polygon overlap
  // Ground: Reports indicate normal industrial activity, not emergency — low urgency
  // Result: Satellite sees heat, AI may flag industrial_fire, but ground says routine flare
  // ========================================================================
  {
    id: "REP-003",
    hotspotId: "AN-003",
    incidentId: "AN-003",
    h3Cell: "872569a5fffffff",
    latitude: 22.745,
    longitude: 69.705,
    observationType: "smoke_visible",
    description: "[SCENARIO 2 — Baseline] Dense black smoke at petrochemical complex. Initial report triggered review of persistent flare.",
    media: [photoMedia("rep003", "2026-08-28T20:00:00Z")],
    observedAt: "2026-08-28T20:00:00Z",
    submittedAt: "2026-08-28T20:30:00Z",
    status: "under_review",
    confirmations: 2,
    disputes: 1,
    credibilityScore: mockCredibility(2, 1, true, distToAnomalyKm(22.745, 69.705, "AN-003")),
    distanceToIncidentKm: distToAnomalyKm(22.745, 69.705, "AN-003"),
    reporter: { id: "user-03", displayName: "Community Observer 3" },
    verifications: [
      verification("VER-003a", "REP-003", "corroborate", "user-01", "2026-08-28T21:00:00Z", "Flare stack confirmed"),
      verification("VER-003b", "REP-003", "corroborate", "user-04", "2026-08-28T21:10:00Z"),
      verification("VER-003c", "REP-003", "dispute", "user-05", "2026-08-28T21:20:00Z", "Observed downwind — may be neighboring site"),
    ],
  },
  {
    id: "REP-016",
    hotspotId: "AN-003",
    incidentId: "AN-003",
    h3Cell: "872569a5fffffff",
    latitude: 22.742,
    longitude: 69.702,
    observationType: "industrial_activity",
    description: "[SCENARIO 2 — Normalcy] Routine flare activity at Mundra — documented daily operations. Photo shows standard stack height, no abnormal flame. Low urgency — persistent industrial heat, not incident.",
    media: [photoMedia("rep016", "2026-08-28T19:30:00Z")],
    observedAt: "2026-08-28T19:30:00Z",
    submittedAt: "2026-08-28T19:45:00Z",
    status: "corroborated",
    confirmations: 4,
    disputes: 0,
    credibilityScore: mockCredibility(4, 0, true, distToAnomalyKm(22.742, 69.702, "AN-003")),
    distanceToIncidentKm: distToAnomalyKm(22.742, 69.702, "AN-003"),
    reporter: { id: "user-30", displayName: "Plant Observer — Mundra" },
    verifications: [
      verification("VER-016a", "REP-016", "corroborate", "user-31", "2026-08-28T20:10:00Z", "Normal flare — daily log confirms"),
      verification("VER-016b", "REP-016", "corroborate", "user-32", "2026-08-28T20:15:00Z"),
      verification("VER-016c", "REP-016", "corroborate", "user-33", "2026-08-28T20:20:00Z"),
      verification("VER-016d", "REP-016", "corroborate", "user-34", "2026-08-28T20:25:00Z"),
    ],
  },
  {
    id: "REP-017",
    hotspotId: "AN-003",
    incidentId: "AN-003",
    h3Cell: "872569a5fffffff",
    latitude: 22.738,
    longitude: 69.698,
    observationType: "industrial_activity",
    description: "[SCENARIO 2 — Context] Second confirmation: No abnormal heat, OSM industrial polygon overlap, facility log shows 22:00-06:00 flare schedule. Community Evidence suggests persistent heat, not emergency.",
    media: [photoMedia("rep017", "2026-08-28T20:10:00Z")],
    observedAt: "2026-08-28T20:10:00Z",
    submittedAt: "2026-08-28T20:25:00Z",
    status: "corroborated",
    confirmations: 3,
    disputes: 0,
    credibilityScore: mockCredibility(3, 0, true, distToAnomalyKm(22.738, 69.698, "AN-003")),
    distanceToIncidentKm: distToAnomalyKm(22.738, 69.698, "AN-003"),
    reporter: { id: "user-35", displayName: "Community Observer — Mundra West" },
    verifications: [
      verification("VER-017a", "REP-017", "corroborate", "user-36", "2026-08-28T20:40:00Z"),
      verification("VER-017b", "REP-017", "corroborate", "user-37", "2026-08-28T20:45:00Z"),
      verification("VER-017c", "REP-017", "corroborate", "user-38", "2026-08-28T20:50:00Z"),
    ],
  },
  // ========================================================================
  // SCENARIO 3 — Conflicting evidence (Jamnagar Steel Belt — Gujarat)
  // FIRMS: AN-010 (22.47,70.07) industrial_fire, 37.8 MW, steel plant proximity
  // Ground: One report smoke/fire, another no fire — status Conflicting
  // ========================================================================
  {
    id: "REP-008",
    hotspotId: "AN-010",
    incidentId: "AN-010",
    h3Cell: "8725694cfffffff",
    latitude: 22.475,
    longitude: 70.075,
    observationType: "agricultural_burning",
    description: "[SCENARIO 3 — Part A] Field burning on farmland 1.1 km from steel plant — FIRMS classified as industrial_fire but ground photo shows agricultural residue burn. Conflicts with industrial hypothesis.",
    media: [photoMedia("rep008", "2026-08-27T05:00:00Z")],
    observedAt: "2026-08-27T05:00:00Z",
    submittedAt: "2026-08-27T05:30:00Z",
    status: "disputed",
    confirmations: 1,
    disputes: 2,
    credibilityScore: mockCredibility(1, 2, true, distToAnomalyKm(22.475, 70.075, "AN-010")),
    distanceToIncidentKm: distToAnomalyKm(22.475, 70.075, "AN-010"),
    reporter: { id: "user-08", displayName: "Field Volunteer B", role: "volunteer" },
    verifications: [
      verification("VER-008a", "REP-008", "corroborate", "user-01", "2026-08-27T06:00:00Z", "Crop residue visible"),
      verification("VER-008b", "REP-008", "dispute", "user-02", "2026-08-27T06:10:00Z", "Steel plant activity also present"),
      verification("VER-008c", "REP-008", "dispute", "user-03", "2026-08-27T06:15:00Z"),
    ],
  },
  {
    id: "REP-018",
    hotspotId: "AN-010",
    incidentId: "AN-010",
    h3Cell: "8725694cfffffff",
    latitude: 22.472,
    longitude: 70.072,
    observationType: "no_fire_observed",
    description: "[SCENARIO 3 — Part B] Second visit 6 hours later — no fire observed at same coordinates. Field shows no new burn, steel plant stacks cold. Directly conflicts with REP-008.",
    media: [photoMedia("rep018", "2026-08-27T11:00:00Z")],
    observedAt: "2026-08-27T11:00:00Z",
    submittedAt: "2026-08-27T11:15:00Z",
    status: "disputed",
    confirmations: 0,
    disputes: 3,
    credibilityScore: mockCredibility(0, 3, true, distToAnomalyKm(22.472, 70.072, "AN-010")),
    distanceToIncidentKm: distToAnomalyKm(22.472, 70.072, "AN-010"),
    reporter: { id: "user-40", displayName: "Field Officer — Jamnagar" },
    verifications: [
      verification("VER-018a", "REP-018", "dispute", "user-41", "2026-08-27T11:30:00Z"),
      verification("VER-018b", "REP-018", "dispute", "user-42", "2026-08-27T11:35:00Z"),
      verification("VER-018c", "REP-018", "dispute", "user-43", "2026-08-27T11:40:00Z", "No thermal activity on second visit"),
    ],
  },
  // ========================================================================
  // SCENARIO 4 — New community-only observation (Sehore, Madhya Pradesh)
  // No FIRMS hotspot within 10 km — proves unlinked ground observations appear
  // independently on map. No AI classification — ground-only candidate.
  // Location: 23.50,78.00 (Sehore district, ~400 km from nearest AN-005)
  // ========================================================================
  {
    id: "REP-019",
    hotspotId: null,
    incidentId: null,
    h3Cell: null,
    latitude: 23.5,
    longitude: 78.0,
    observationType: "smoke_visible",
    description: "[SCENARIO 4 — Community-only] Unlinked smoke plume over scrub near Sehore, MP. No FIRMS detection within 10 km — new ground-only candidate. Demonstrates community adds coverage beyond satellite.",
    media: [photoMedia("rep019", "2026-08-29T06:00:00Z")],
    observedAt: "2026-08-29T06:00:00Z",
    submittedAt: "2026-08-29T06:15:00Z",
    status: "new",
    confirmations: 2,
    disputes: 0,
    credibilityScore: mockCredibility(2, 0, true, null),
    distanceToIncidentKm: null,
    reporter: { id: "user-50", displayName: "Community Observer — Sehore" },
    verifications: [
      verification("VER-019a", "REP-019", "corroborate", "user-51", "2026-08-29T06:30:00Z"),
      verification("VER-019b", "REP-019", "corroborate", "user-52", "2026-08-29T06:35:00Z"),
    ],
  },
  // Keep existing nearby unlinked examples for geographic demonstration
  {
    id: "REP-007",
    hotspotId: null,
    incidentId: null,
    h3Cell: null,
    latitude: 20.96,
    longitude: 85.23,
    observationType: "fire_visible",
    description: "[SCENARIO 4 — Nearby] Nearby report — 1.4 km from AN-007 thermal anomaly (geographically close but not explicitly linked). Proximity does not prove reference — verification required.",
    media: [photoMedia("rep007", "2026-08-27T16:00:00Z")],
    observedAt: "2026-08-27T16:00:00Z",
    submittedAt: "2026-08-27T16:20:00Z",
    status: "new",
    confirmations: 0,
    disputes: 0,
    credibilityScore: mockCredibility(0, 0, true, null),
    distanceToIncidentKm: null,
    reporter: { id: "user-07", displayName: "Community Observer 7" },
    verifications: [],
  },
  {
    id: "REP-010",
    hotspotId: null,
    incidentId: null,
    h3Cell: null,
    latitude: 19.078,
    longitude: 72.885,
    observationType: "smoke_visible",
    description: "[SCENARIO 1 — Nearby] Nearby report — 0.9 km from AN-001 (geographically close, not explicitly linked). Potentially related but proximity alone does not confirm reference. Supports Scenario 1 via geographic context.",
    media: [photoMedia("rep010", "2026-08-26T10:00:00Z")],
    observedAt: "2026-08-26T10:00:00Z",
    submittedAt: "2026-08-26T10:30:00Z",
    status: "under_review",
    confirmations: 2,
    disputes: 1,
    credibilityScore: mockCredibility(2, 1, true, null),
    distanceToIncidentKm: null,
    reporter: { id: "user-10", displayName: "Community Observer 10" },
    verifications: [
      verification("VER-010a", "REP-010", "corroborate", "user-01", "2026-08-26T10:45:00Z"),
      verification("VER-010b", "REP-010", "corroborate", "user-02", "2026-08-26T10:50:00Z"),
      verification("VER-010c", "REP-010", "dispute", "user-03", "2026-08-26T11:00:00Z", "Could be low cloud"),
    ],
  },
  {
    id: "REP-013",
    hotspotId: null,
    incidentId: null,
    h3Cell: null,
    latitude: 19.12,
    longitude: 72.93,
    observationType: "industrial_activity",
    description: "[SCENARIO 1 — Potentially related] Potentially related — 6.8 km from AN-001 thermal anomaly. Within broader area but not directly linked. Proximity alone does not confirm reference.",
    media: [photoMedia("rep013", "2026-08-26T15:00:00Z")],
    observedAt: "2026-08-26T15:00:00Z",
    submittedAt: "2026-08-26T15:20:00Z",
    status: "new",
    confirmations: 0,
    disputes: 0,
    credibilityScore: mockCredibility(0, 0, true, null),
    distanceToIncidentKm: null,
    reporter: { id: "user-13", displayName: "Community Observer 13" },
    verifications: [],
  },
  // ========================================================================
  // SCENARIO 5 — Agricultural burning (Eastern Maharashtra — Nagpur Hinterland)
  // FIRMS: AN-011 (19.11,72.92) actually Mumbai coastal, but demo uses Central
  // Better use AN-005/AN-011/AN-018 agri cluster — choose AN-011 agricultural_burn
  // AI may confuse agri burn with industrial — ground photo clarifies cropland
  // ========================================================================
  {
    id: "REP-020",
    hotspotId: "AN-011",
    incidentId: "AN-011",
    h3Cell: "872567f1fffffff",
    latitude: 19.115,
    longitude: 72.925,
    observationType: "agricultural_burning",
    description: "[SCENARIO 5] Cropland residue fire near Kalyan agricultural belt. FIRMS 22.1 MW at 19.11,72.92 classified as agricultural_burn — community photo shows harvested paddy stubble burn, OSM farmland polygon, no industrial facility within 5 km.",
    media: [photoMedia("rep020", "2026-08-26T16:30:00Z")],
    observedAt: "2026-08-26T16:30:00Z",
    submittedAt: "2026-08-26T16:45:00Z",
    status: "corroborated",
    confirmations: 3,
    disputes: 0,
    credibilityScore: mockCredibility(3, 0, true, distToAnomalyKm(19.115, 72.925, "AN-011")),
    distanceToIncidentKm: distToAnomalyKm(19.115, 72.925, "AN-011"),
    reporter: { id: "user-60", displayName: "Field Volunteer — Kalyan Agri" },
    verifications: [
      verification("VER-020a", "REP-020", "corroborate", "user-61", "2026-08-26T17:00:00Z", "Stubble burn confirmed — farmland"),
      verification("VER-020b", "REP-020", "corroborate", "user-62", "2026-08-26T17:05:00Z"),
      verification("VER-020c", "REP-020", "corroborate", "user-63", "2026-08-26T17:10:00Z"),
    ],
  },
  // Keep original agricultural field case for additional coverage
  {
    id: "REP-002",
    hotspotId: "AN-002",
    incidentId: "AN-002",
    h3Cell: "87254a97fffffff",
    latitude: 19.125,
    longitude: 72.915,
    observationType: "smoke_visible",
    description: "Light smoke over scrubland 0.6km from detection centroid. No flame at time of visit, vegetation charring nearby.",
    media: [photoMedia("rep002", "2026-08-29T05:45:00Z")],
    observedAt: "2026-08-29T05:45:00Z",
    submittedAt: "2026-08-29T06:05:00Z",
    status: "corroborated",
    confirmations: 2,
    disputes: 0,
    credibilityScore: mockCredibility(2, 0, true, distToAnomalyKm(19.125, 72.915, "AN-002")),
    distanceToIncidentKm: distToAnomalyKm(19.125, 72.915, "AN-002"),
    reporter: { id: "user-02", displayName: "Field Volunteer A", role: "volunteer" },
    verifications: [
      verification("VER-002a", "REP-002", "corroborate", "user-01", "2026-08-29T06:30:00Z"),
      verification("VER-002b", "REP-002", "corroborate", "user-03", "2026-08-29T06:45:00Z"),
    ],
  },
  // ========================================================================
  // SCENARIO 6 — Resolved incident (Paradip, Odisha — Eastern India)
  // FIRMS: AN-006 (20.31,86.61) industrial_fire 47.9 MW, 0.84 persistence
  // Timeline: 2026-08-27 fire_visible with confirmations → 2026-08-28 fire_extinguished → resolved
  // ========================================================================
  {
    id: "REP-021",
    hotspotId: "AN-006",
    incidentId: "AN-006",
    h3Cell: "8725744bfffffff",
    latitude: 20.308,
    longitude: 86.608,
    observationType: "fire_visible",
    description: "[SCENARIO 6 — Initial] Active fire at Paradip periphery 2026-08-27 10:00 UTC — photo of flame near slag heap. High confidence industrial fire.",
    media: [photoMedia("rep021", "2026-08-27T10:00:00Z")],
    observedAt: "2026-08-27T10:00:00Z",
    submittedAt: "2026-08-27T10:15:00Z",
    status: "corroborated",
    confirmations: 3,
    disputes: 0,
    credibilityScore: mockCredibility(3, 0, true, distToAnomalyKm(20.308, 86.608, "AN-006")),
    distanceToIncidentKm: distToAnomalyKm(20.308, 86.608, "AN-006"),
    reporter: { id: "user-70", displayName: "Community Observer — Paradip" },
    verifications: [
      verification("VER-021a", "REP-021", "corroborate", "user-71", "2026-08-27T10:30:00Z"),
      verification("VER-021b", "REP-021", "corroborate", "user-72", "2026-08-27T10:40:00Z"),
      verification("VER-021c", "REP-021", "corroborate", "user-73", "2026-08-27T10:50:00Z"),
    ],
  },
  {
    id: "REP-005",
    hotspotId: "AN-006",
    incidentId: "AN-006",
    h3Cell: "8725744bfffffff",
    latitude: 20.315,
    longitude: 86.615,
    observationType: "fire_extinguished",
    description: "[SCENARIO 6 — Resolved] Follow-up 2026-08-28 08:00 UTC — flame extinguished before arrival. Burn marks and cooling slag visible at Paradip periphery. Previous fire (REP-021) now resolved.",
    media: [photoMedia("rep005", "2026-08-28T08:00:00Z")],
    observedAt: "2026-08-28T08:00:00Z",
    submittedAt: "2026-08-28T08:25:00Z",
    status: "resolved",
    confirmations: 2,
    disputes: 0,
    credibilityScore: mockCredibility(2, 0, true, distToAnomalyKm(20.315, 86.615, "AN-006")),
    distanceToIncidentKm: distToAnomalyKm(20.315, 86.615, "AN-006"),
    reporter: { id: "user-05", displayName: "Community Observer 5" },
    verifications: [
      verification("VER-005a", "REP-005", "corroborate", "user-02", "2026-08-28T09:00:00Z"),
      verification("VER-005b", "REP-005", "corroborate", "user-03", "2026-08-28T09:10:00Z"),
    ],
  },
  // ------------------------------------------------------------------------
  // Remaining reports — support all scenarios, diverse evidence types
  // ------------------------------------------------------------------------
  {
    id: "REP-004",
    hotspotId: "AN-005",
    incidentId: "AN-005",
    h3Cell: "87255c2afffffff",
    latitude: 21.26,
    longitude: 81.64,
    observationType: "no_fire_observed",
    description: "Visited agri_burn location 3 days after FIRMS timestamp — no active fire, no residual ash. Field appears harvested, not burnt.",
    media: [photoMedia("rep004", "2026-08-28T13:00:00Z")],
    observedAt: "2026-08-28T13:00:00Z",
    submittedAt: "2026-08-28T13:20:00Z",
    status: "disputed",
    confirmations: 0,
    disputes: 3,
    credibilityScore: mockCredibility(0, 3, true, distToAnomalyKm(21.26, 81.64, "AN-005")),
    distanceToIncidentKm: distToAnomalyKm(21.26, 81.64, "AN-005"),
    reporter: { id: "user-04", displayName: "Field Officer — Central", role: "field officer" },
    verifications: [
      verification("VER-004a", "REP-004", "dispute", "user-01", "2026-08-28T14:00:00Z"),
      verification("VER-004b", "REP-004", "dispute", "user-02", "2026-08-28T14:10:00Z"),
      verification("VER-004c", "REP-004", "dispute", "user-03", "2026-08-28T14:15:00Z"),
    ],
  },
  {
    id: "REP-006",
    hotspotId: "AN-012",
    incidentId: "AN-012",
    h3Cell: "87256713fffffff",
    latitude: 21.715,
    longitude: 72.595,
    observationType: "false_alarm",
    description: "Reported wildfire is sun-heated metal roof glint — no vegetation burn, no smoke. FIRMS likely false positive on bright surface.",
    media: [photoMedia("rep006", "2026-08-26T18:00:00Z")],
    observedAt: "2026-08-26T18:00:00Z",
    submittedAt: "2026-08-26T18:20:00Z",
    status: "rejected",
    confirmations: 0,
    disputes: 2,
    credibilityScore: mockCredibility(0, 2, true, distToAnomalyKm(21.715, 72.595, "AN-012")),
    distanceToIncidentKm: distToAnomalyKm(21.715, 72.595, "AN-012"),
    reporter: { id: "user-06", displayName: "Volunteer — Western", role: "volunteer" },
    verifications: [
      verification("VER-006a", "REP-006", "dispute", "user-01", "2026-08-26T18:40:00Z"),
      verification("VER-006b", "REP-006", "dispute", "user-02", "2026-08-26T18:45:00Z"),
    ],
  },
  {
    id: "REP-009",
    hotspotId: "AN-008",
    incidentId: "AN-008",
    h3Cell: "87255c0afffffff",
    latitude: 21.145,
    longitude: 79.085,
    observationType: "unknown",
    description: "Unclear observation — hazy conditions, distant heat shimmer over barren land. Insufficient evidence to confirm or dispute.",
    media: [],
    observedAt: "2026-08-27T14:30:00Z",
    submittedAt: "2026-08-27T14:45:00Z",
    status: "under_review",
    confirmations: 1,
    disputes: 0,
    credibilityScore: mockCredibility(1, 0, false, distToAnomalyKm(21.145, 79.085, "AN-008")),
    distanceToIncidentKm: distToAnomalyKm(21.145, 79.085, "AN-008"),
    reporter: { id: "user-09", displayName: "Community Observer 9" },
    verifications: [verification("VER-009a", "REP-009", "corroborate", "user-01", "2026-08-27T15:00:00Z")],
  },
  {
    id: "REP-011",
    hotspotId: "AN-004",
    incidentId: "AN-004",
    h3Cell: "87256249fffffff",
    latitude: 22.355,
    longitude: 82.685,
    observationType: "industrial_activity",
    description: "Active coal handling and spontaneous heating signs at Korba mine edge. Strongly corroborates FIRMS mining classification.",
    media: [photoMedia("rep011", "2026-08-28T17:00:00Z")],
    observedAt: "2026-08-28T17:00:00Z",
    submittedAt: "2026-08-28T17:15:00Z",
    status: "corroborated",
    confirmations: 5,
    disputes: 1,
    credibilityScore: mockCredibility(5, 1, true, distToAnomalyKm(22.355, 82.685, "AN-004")),
    distanceToIncidentKm: distToAnomalyKm(22.355, 82.685, "AN-004"),
    reporter: { id: "user-11", displayName: "Field Officer — Mining", role: "field officer" },
    verifications: [
      verification("VER-011a", "REP-011", "corroborate", "user-01", "2026-08-28T17:30:00Z"),
      verification("VER-011b", "REP-011", "corroborate", "user-02", "2026-08-28T17:35:00Z"),
      verification("VER-011c", "REP-011", "corroborate", "user-03", "2026-08-28T17:40:00Z"),
      verification("VER-011d", "REP-011", "corroborate", "user-04", "2026-08-28T17:45:00Z"),
      verification("VER-011e", "REP-011", "corroborate", "user-05", "2026-08-28T18:00:00Z"),
      verification("VER-011f", "REP-011", "dispute", "user-06", "2026-08-28T18:10:00Z", "Activity is haul road dust, not thermal"),
    ],
  },
  {
    id: "REP-012",
    hotspotId: "AN-009",
    incidentId: "AN-009",
    h3Cell: "8725667bfffffff",
    latitude: 21.125,
    longitude: 72.635,
    observationType: "fire_visible",
    description: "Visible flare at LNG terminal — tall luminous flame, audible. FIRMS gas_flare detection confirmed on site.",
    media: [photoMedia("rep012", "2026-08-27T09:30:00Z")],
    observedAt: "2026-08-27T09:30:00Z",
    submittedAt: "2026-08-27T09:50:00Z",
    status: "confirmed",
    confirmations: 3,
    disputes: 0,
    credibilityScore: mockCredibility(3, 0, true, distToAnomalyKm(21.125, 72.635, "AN-009")),
    distanceToIncidentKm: distToAnomalyKm(21.125, 72.635, "AN-009"),
    reporter: { id: "user-12", displayName: "Community Observer 12" },
    verifications: [
      verification("VER-012a", "REP-012", "corroborate", "user-01", "2026-08-27T10:00:00Z"),
      verification("VER-012b", "REP-012", "corroborate", "user-02", "2026-08-27T10:05:00Z"),
      verification("VER-012c", "REP-012", "corroborate", "user-03", "2026-08-27T10:10:00Z"),
    ],
  },
];

/**
 * Demo Scenario Index — for judge navigation and documentation.
 * Each scenario groups hotspot(s) + reports that illustrate the storyline.
 * All data is MOCK — not scientific ground truth.
 */
export const DEMO_SCENARIOS = [
  {
    id: "scenario-1",
    title: "Strong corroboration — Mumbai Refinery (AN-001)",
    hotspotId: "AN-001",
    lat: 19.076,
    lng: 72.877,
    region: "Western India — Trombay, Mumbai",
    firs: "industrial_fire 52.4 MW, 0.91 persistence, FIRMS VIIRS",
    ai: "industrial_fire 94% — Priority 74",
    reportIds: ["REP-001", "REP-014", "REP-015"],
    nearbyIds: ["REP-010", "REP-013"],
    narrative: "FIRMS + AI + 3 independent ground photos/confirmations → HIGH ground evidence. Photos 3, 10 confirmations, conflicting 0.",
    expectedGround: "HIGH",
  },
  {
    id: "scenario-2",
    title: "False positive / persistent industrial heat — Mundra (AN-003)",
    hotspotId: "AN-003",
    lat: 22.74,
    lng: 69.7,
    region: "Western India — Mundra, Gujarat",
    firs: "gas_flare 68.1 MW, 0.88 persistence, industrial polygon",
    ai: "gas_flare/industrial_fire ~96% — but persistent flare",
    reportIds: ["REP-016", "REP-017"],
    baselineId: "REP-003",
    narrative: "Community reports normal industrial flare (routine operations), low urgency — demonstrates distinguishing persistent heat from incident.",
    expectedGround: "HIGH (normalcy corroborated)",
  },
  {
    id: "scenario-3",
    title: "Conflicting evidence — Jamnagar (AN-010)",
    hotspotId: "AN-010",
    lat: 22.47,
    lng: 70.07,
    region: "Western India — Jamnagar, Gujarat",
    firs: "industrial_fire 37.8 MW, near steel plant",
    ai: "industrial_fire 88%",
    reportIds: ["REP-008", "REP-018"],
    narrative: "One report agricultural burning, another no fire — hotspot-level conflicting. Status Conflicting, not confirmed.",
    expectedGround: "CONFLICTING",
  },
  {
    id: "scenario-4",
    title: "New community-only observation — Sehore, MP",
    hotspotId: null,
    lat: 23.5,
    lng: 78.0,
    region: "Central India — Sehore, MP (unlinked, >300 km from nearest FIRMS)",
    firs: "No FIRMS hotspot within 10 km",
    ai: "No AI classification — ground-only candidate",
    reportIds: ["REP-019"],
    narrative: "Unlinked smoke plume, 2 corroborations, appears as independent ground observation on map. Proves community adds coverage beyond satellite.",
    expectedGround: "Unlinked candidate",
  },
  {
    id: "scenario-5",
    title: "Agricultural burning — Kalyan (AN-011)",
    hotspotId: "AN-011",
    lat: 19.11,
    lng: 72.92,
    region: "Western India — Kalyan agricultural belt",
    firs: "agricultural_burn 22.1 MW, farmland polygon",
    ai: "agricultural_burn 78%",
    reportIds: ["REP-020"],
    narrative: "Ground photo shows harvested paddy stubble burn, OSM farmland polygon, no industrial facility — clarifies agri vs industrial.",
    expectedGround: "HIGH (agri corroborated)",
  },
  {
    id: "scenario-6",
    title: "Resolved incident — Paradip, Odisha (AN-006)",
    hotspotId: "AN-006",
    lat: 20.31,
    lng: 86.61,
    region: "Eastern India — Paradip, Odisha",
    firs: "industrial_fire 47.9 MW, 0.84 persistence",
    ai: "industrial_fire 93%",
    reportIds: ["REP-021", "REP-005"],
    narrative: "Initial fire_visible (10:00) with 3 corroborations → follow-up fire_extinguished (08:00 next day) with burn marks — status resolved, timeline shows resolution.",
    expectedGround: "Resolved",
  },
] as const;

// Keep credibility in sync if counts change — recompute here to avoid drift
// (already aligned above; validated below).

export const mockCommunityReports: CommunityReport[] = REPORTS;

// ---------------------------------------------------------------------------
// GroundEvidenceSummary builder — explicit, validated aggregation.
// See rules doc above.
// ---------------------------------------------------------------------------
export function buildGroundEvidence(reports: CommunityReport[] = mockCommunityReports): GroundEvidenceSummary[] {
  const byHotspot = new Map<string, CommunityReport[]>();
  for (const r of reports) {
    if (!r.hotspotId) continue;
    const arr = byHotspot.get(r.hotspotId) ?? [];
    arr.push(r);
    byHotspot.set(r.hotspotId, arr);
  }

  const summaries: GroundEvidenceSummary[] = [];
  for (const [hotspotId, list] of byHotspot) {
    let corroborating = 0;
    let disputing = 0;
    let credibilitySum = 0;
    let latest: string | null = null;

    for (const r of list) {
      if (isCorroborating(r.observationType)) corroborating++;
      else if (isDisputing(r.observationType)) disputing++;
      // neutral contributes only to total/latests/avgCredibility
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

    summaries.push({
      hotspotId,
      totalReports,
      corroborating,
      disputing,
      conflicting,
      latestObservedAt: latest,
      avgCredibility,
      consensus,
    });
  }

  return summaries.sort((a, b) => a.hotspotId.localeCompare(b.hotspotId));
}

export const mockGroundEvidence: GroundEvidenceSummary[] = buildGroundEvidence(mockCommunityReports);

// ---------------------------------------------------------------------------
// Validated distribution — computed, not hard-claimed.
// These exports let consumers/tests validate coverage without brittle narrative.
// ---------------------------------------------------------------------------
export const mockCommunityStats = (() => {
  const total = mockCommunityReports.length;
  const unlinked = mockCommunityReports.filter((r) => r.hotspotId == null).length;
  const linked = total - unlinked;
  const multiConfirm = mockCommunityReports.filter((r) => r.confirmations >= 3).length;
  // per-report conflicting: has both corroborate and dispute verifications
  const perReportConflicting = mockCommunityReports.filter((r) => r.confirmations > 0 && r.disputes > 0).length;
  // ground-level conflicting hotspots
  const groundConflicting = mockGroundEvidence.filter((s) => s.conflicting).length;
  // status breakdown
  const byStatus = mockCommunityReports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  // observation type breakdown
  const byObservationType = mockCommunityReports.reduce<Record<string, number>>((acc, r) => {
    acc[r.observationType] = (acc[r.observationType] ?? 0) + 1;
    return acc;
  }, {});
  // linked corroborating vs disputing (ground evidence lever)
  const totalCorroborating = mockGroundEvidence.reduce((s, g) => s + g.corroborating, 0);
  const totalDisputing = mockGroundEvidence.reduce((s, g) => s + g.disputing, 0);

  return {
    total,
    linked,
    unlinked,
    multiConfirm,
    perReportConflicting,
    groundConflicting,
    byStatus,
    byObservationType,
    totalCorroborating,
    totalDisputing,
  };
})();

// ---------------------------------------------------------------------------
// Self-validation — warns in dev if judge-demo coverage requirements break.
// Requirements:
// - at least 1 corroborating report exists
// - at least 1 disputing report exists
// - at least 1 unlinked report exists
// - at least 1 multi-confirm (>=3) exists
// - at least 1 per-report conflicting (both confirm+dispute) exists
// - at least 1 hotpot has mixed ground evidence (groundConflicting >=1) OR per-report conflicting satisfies
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  const s = mockCommunityStats;
  const problems: string[] = [];
  if (s.totalCorroborating === 0) problems.push("no corroborating observations");
  if (s.totalDisputing === 0) problems.push("no disputing observations");
  if (s.unlinked === 0) problems.push("no unlinked (null hotspotId) reports");
  if (s.multiConfirm === 0) problems.push("no report with confirmations >=3");
  if (s.perReportConflicting === 0 && s.groundConflicting === 0) problems.push("no conflicting evidence (need both corroborate+dispute on a report or hotspot)");
  if (problems.length && typeof console !== "undefined") {
    console.warn(`[mocks/community] validation: ${problems.join("; ")}`, s);
  }
}

// Re-export helpers useful for future map/report-linking phase
export { haversineKm, isCorroborating, isDisputing, isNeutral };
