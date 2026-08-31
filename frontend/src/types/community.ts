/**
 * Community Ground Verification — Types
 * frontend/src/types/community.ts
 *
 * Judge-facing prototype. Clean mock-data architecture that will later be
 * replaced by API calls (see future `api/community.ts`).
 *
 * Architecture distinguishes four concepts — DO NOT merge:
 *  1. AI classification confidence  (ThermalAnomaly.confidence 0-100, satellite model)
 *  2. Anomaly / priority score     (FRP, persistence, industrial proximity — system severity)
 *  3. Community report credibility (CommunityReport.credibilityScore 0-1, per-report human evidence)
 *  4. Overall ground evidence      (GroundEvidenceSummary, aggregated per hotspot)
 */

// ---------------------------------------------------------------------------
// Observation types — 8 values exactly. Keep as proposed.
// fire_extinguished / false_alarm / no_fire_observed are operationally distinct.
// ---------------------------------------------------------------------------
export type ObservationType =
  | "fire_visible"
  | "smoke_visible"
  | "industrial_activity"
  | "agricultural_burning"
  | "no_fire_observed"
  | "fire_extinguished"
  | "false_alarm"
  | "unknown";

// ---------------------------------------------------------------------------
// Report lifecycle — 7 values exactly.
// mock status is derived from corroboration/disputation counts + credibility
// (see mocks/community.ts aggregation rules).
// ---------------------------------------------------------------------------
export type ReportStatus =
  | "new"
  | "under_review"
  | "corroborated"
  | "disputed"
  | "confirmed"
  | "rejected"
  | "resolved";

// ---------------------------------------------------------------------------
// ReportMedia — photo-only for prototype.
// No video support yet (avoids upload/preview/validation/storage complexity).
// Photo-only keeps the judge demo focused.
// ---------------------------------------------------------------------------
export interface ReportMedia {
  /** Stable id e.g. "MED-001" */
  id: string;
  /** Photo-only. Literal type makes future extension explicit if added later. */
  kind: "photo";
  /** Full image URL — mock uses picsum.photos; later replaced by CDN URL */
  url: string;
  /** Optional thumbnail for list/map popup */
  thumbnailUrl?: string;
  /** Original file name from <input type=file>, if any */
  fileName?: string;
  /** MIME, e.g. "image/jpeg" */
  mimeType?: string;
  /** Bytes, for validation display (prototype limit ~10 MB) */
  sizeBytes?: number;
  /** Optional caption */
  caption?: string;
  /** ISO timestamp when media was captured/created */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// ReportVerification — corroborate/dispute action on a report.
// Separate from ReportStatus lifecycle; verifications aggregate into
// CommunityReport.confirmations / disputes.
// ---------------------------------------------------------------------------
export type VerificationType = "corroborate" | "dispute";

export interface ReportVerification {
  id: string; // e.g. "VER-001"
  reportId: string; // FK → CommunityReport.id
  type: VerificationType;
  /** Mock user id — localStorage dedup key `pyro:reportVotes` later */
  userId: string;
  /** Optional note */
  note?: string;
  /** ISO timestamp */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// CommunityReport — main entity
// ---------------------------------------------------------------------------
export interface Reporter {
  id: string; // e.g. "user-01"
  displayName: string; // e.g. "Community Observer 1"
  role?: string; // optional, e.g. "volunteer", "field officer"
}

export interface CommunityReport {
  /** Stable id e.g. "REP-001" */
  id: string;

  /**
   * Link to thermal anomaly / hotspot.
   * Spec: "incidentId / hotspotId (nullable)". Uses hotspotId to match
   * ThermalAnomaly.id ("AN-xxx"). Nullable — unlinked reports are candidates
   * for new sources. Alias: incidentId (same field for backend naming).
   */
  hotspotId: string | null;
  /** Alias for hotspotId — keeps both spec names valid. */
  incidentId?: string | null;

  /** H3 cell res 7 nullable — aligns with backend hotspots.h3_cell */
  h3Cell: string | null;

  latitude: number;
  longitude: number;

  observationType: ObservationType;

  /** 10–240 chars in mock validation */
  description: string;

  /** 0..n photos — prototype usually 1 */
  media: ReportMedia[];

  /** ISO — when observed on the ground (may differ from submittedAt) */
  observedAt: string;

  /** ISO — when report was submitted */
  submittedAt: string;

  status: ReportStatus;

  /** Corroborate count — aggregates ReportVerification[type=corroborate] */
  confirmations: number;

  /** Dispute count — aggregates ReportVerification[type=dispute] */
  disputes: number;

  /**
   * Per-report community credibility 0–1.
   * DISTINCT from AI classification confidence (ThermalAnomaly.confidence 0–100)
   * and anomaly/priority score. Computed from confirmations/(confirmations+disputes),
   * photo presence, distanceToIncident etc. See mocks/community.ts heuristic.
   */
  credibilityScore: number;

  /**
   * Distance to linked incident in km, or null if unlinked.
   * Computed via haversine between report coords and linked anomaly coords.
   */
  distanceToIncidentKm: number | null;

  reporter: Reporter;

  /** Optional history — used by detail drawer */
  verifications?: ReportVerification[];
}

// ---------------------------------------------------------------------------
// GroundEvidenceSummary — aggregated per hotspot, DISTINCT from per-report
// credibility. Overall ground evidence across all reports linked to a hotspot.
// ---------------------------------------------------------------------------
export type GroundConsensus = "corroborated" | "disputed" | "conflicting" | "insufficient";

export interface GroundEvidenceSummary {
  hotspotId: string;
  totalReports: number;
  /** Reports counted as corroborating per aggregation rules */
  corroborating: number;
  /** Reports counted as disputing per aggregation rules */
  disputing: number;
  /** True if both corroborating and disputing > 0 */
  conflicting: boolean;
  latestObservedAt: string | null;
  /** Mean credibilityScore across linked reports, null if none */
  avgCredibility: number | null;
  consensus: GroundConsensus;
}
