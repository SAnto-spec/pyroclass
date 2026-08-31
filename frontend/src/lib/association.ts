import type { ThermalAnomaly } from "../types/anomaly";
import type { CommunityReport } from "../types/community";

/**
 * Association between community reports and hotspots.
 * Frontend-side only, prototype. Three cases:
 * 1. explicitly references a hotspot (report.hotspotId === hotspot.id)
 * 2. geographically close — within thresholds but not explicitly linked
 * 3. unrelated (far / no proximity)
 *
 * Do NOT imply proximity proves reference. Use labels:
 * "Linked observation" / "Nearby report" / "Potentially related" / "Unrelated"
 */

export type AssociationKind = "linked" | "nearby" | "potentially_related" | "unrelated";

export interface AssociatedReport {
  report: CommunityReport;
  kind: AssociationKind;
  distanceKm: number | null; // computed haversine, null if cannot compute
}

export const NEARBY_KM = 3; // directly nearby, suitable for "Nearby report"
export const POTENTIALLY_RELATED_KM = 10; // broader geographic relevance

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

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  return Number(haversineKm(a.latitude, a.longitude, b.latitude, b.longitude).toFixed(2));
}

/**
 * Classify a single report vs a single hotspot.
 */
export function classifyReport(
  report: CommunityReport,
  hotspot: ThermalAnomaly,
  opts: { nearbyKm?: number; relatedKm?: number } = {}
): AssociatedReport {
  const nearbyKm = opts.nearbyKm ?? NEARBY_KM;
  const relatedKm = opts.relatedKm ?? POTENTIALLY_RELATED_KM;

  if (report.hotspotId === hotspot.id) {
    const d = report.distanceToIncidentKm ?? distanceKm(report, hotspot);
    return { report, kind: "linked", distanceKm: d };
  }

  const d = distanceKm(report, hotspot);
  if (d <= nearbyKm) return { report, kind: "nearby", distanceKm: d };
  if (d <= relatedKm) return { report, kind: "potentially_related", distanceKm: d };
  return { report, kind: "unrelated", distanceKm: d };
}

/**
 * For a hotspot, return all reports partitioned by association.
 * - linked: explicit reference
 * - nearby: not linked but within NEARBY_KM
 * - potentiallyRelated: within POTENTIALLY_RELATED_KM but outside nearby
 * - unrelated: outside threshold (usually hidden)
 */
export function partitionReports(
  hotspot: ThermalAnomaly,
  reports: CommunityReport[],
  opts: { nearbyKm?: number; relatedKm?: number } = {}
): {
  linked: AssociatedReport[];
  nearby: AssociatedReport[];
  potentiallyRelated: AssociatedReport[];
  unrelated: AssociatedReport[];
} {
  const nearbyKm = opts.nearbyKm ?? NEARBY_KM;
  const relatedKm = opts.relatedKm ?? POTENTIALLY_RELATED_KM;
  const linked: AssociatedReport[] = [];
  const nearby: AssociatedReport[] = [];
  const potentiallyRelated: AssociatedReport[] = [];
  const unrelated: AssociatedReport[] = [];

  for (const r of reports) {
    const cls = classifyReport(r, hotspot, { nearbyKm, relatedKm });
    if (cls.kind === "linked") linked.push(cls);
    else if (cls.kind === "nearby") nearby.push(cls);
    else if (cls.kind === "potentially_related") potentiallyRelated.push(cls);
    else unrelated.push(cls);
  }

  // Sort nearby/related by distance ascending for relevance
  nearby.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  potentiallyRelated.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  return { linked, nearby, potentiallyRelated, unrelated };
}

/**
 * Helper: count corroborating vs disputing among associated reports (using type).
 * Re-uses logic from mocks/community but kept local to avoid circular import.
 */
const DISPUTING_SET = new Set(["no_fire_observed", "false_alarm", "fire_extinguished"]);
const NEUTRAL_SET = new Set(["unknown"]);

export function associationSummary(associated: AssociatedReport[]): { corroborating: number; disputing: number; neutral: number } {
  let corroborating = 0;
  let disputing = 0;
  let neutral = 0;
  for (const a of associated) {
    const t = a.report.observationType;
    if (NEUTRAL_SET.has(t)) neutral++;
    else if (DISPUTING_SET.has(t)) disputing++;
    else corroborating++;
  }
  return { corroborating, disputing, neutral };
}

export const associationLabel: Record<AssociationKind, string> = {
  linked: "Linked observation",
  nearby: "Nearby report",
  potentially_related: "Potentially related",
  unrelated: "Unrelated",
};

export const associationTone: Record<AssociationKind, string> = {
  linked: "Explicitly references this hotspot",
  nearby: "Geographically close — proximity does not prove reference",
  potentially_related: "Within broader area — review context",
  unrelated: "Outside proximity threshold",
};
