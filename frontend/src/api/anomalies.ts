import type { ThermalAnomaly } from "../types/anomaly";
import type { BackendFacility } from "../types/facility";

import { apiGet, apiPost } from "./client";

interface BackendHotspot {
  hotspot_id: number;
  latitude: number;
  longitude: number;
  timestamp: string;

  frp: number | null;
  mean_frp: number | null;
  bright_ti4: number | null;
  confidence: number | null;

  case_type: string | null;
  active_days: number | null;

  facility_name: string | null;
  facility_type: string | null;
  facility_distance_m: number | null;

  context_confidence: number | null;
}

export type { BackendFacility } from "../types/facility";

interface BackendClassification {
  hotspot_id: number;
  predicted_class: string;
  confidence: number;
  anomaly_score: number;
  priority_level: string;
  unknown_reason: string | null;
  model_version: string;
  feature_version: string;
}

function mapClassification(
  value?: string | null
): ThermalAnomaly["classification"] {
  switch (value) {
    case "industrial_spike":
    case "industrial_persistent":
      return "industrial_fire";

    case "forest_fire":
      return "wildfire";

    case "ag_burning":
      return "agricultural_burn";

    case "mining":
      return "mining";

    case "gas_flare":
      return "gas_flare";

    case "non_industrial":
      return "non_industrial";

    case "unknown":
      return "unknown";

    default:
      return "other";
  }
}

function mapPersistence(activeDays?: number | null): number {
  if (!activeDays || activeDays <= 0) {
    return 0;
  }

  // active_days is a count, not a percentage.
  // The UI contract is a 0–1 normalized score (display = score × 100),
  // so saturate at 100 days (= 100%) and normalize into [0, 1].
  // This keeps the real backend active_days value; e.g. 52 days → 0.52 → "52% persist".
  return Math.min(100, activeDays) / 100;
}

async function getClassification(
  hotspotId: number
): Promise<BackendClassification | null> {
  try {
    const existing = await apiGet<
      BackendClassification | {
        error: string;
        hotspot_id: number;
      }
    >(`/classifications/${hotspotId}`);

    if (!("error" in existing)) {
      return existing;
    }

    // No classification exists — run the ML model.
    await apiPost(`/classifications/${hotspotId}`);

    // Retrieve the newly stored result.
    const created = await apiGet<
      BackendClassification | {
        error: string;
        hotspot_id: number;
      }
    >(`/classifications/${hotspotId}`);

    if ("error" in created) {
      return null;
    }

    return created;
  } catch {
    return null;
  }
}

/*
 * Get real industrial facilities from PostgreSQL
 * through the FastAPI /facilities/ endpoint.
 *
 * This provides backend facility data for the map.
 */
export async function getFacilities(): Promise<BackendFacility[]> {
  return apiGet<BackendFacility[]>("/facilities/");
}

export async function getAnomalies(): Promise<ThermalAnomaly[]> {
  const hotspots = await apiGet<BackendHotspot[]>("/hotspots/");

  return hotspots.map((hotspot) => {
    return {
      id: String(hotspot.hotspot_id),

      latitude: hotspot.latitude,
      longitude: hotspot.longitude,

      detectedAt: hotspot.timestamp,

      // Raw FRP is NULL in the database,
      // so use the real aggregate mean_frp.
      frp: hotspot.frp ?? hotspot.mean_frp ?? 0,

      brightness: hotspot.bright_ti4 ?? 0,

      confidence: hotspot.confidence != null 
          ? (hotspot.confidence <= 1 ? hotspot.confidence * 100 : hotspot.confidence) 
          : 0,

      classification: mapClassification(
        hotspot.case_type
      ),

      persistenceScore: mapPersistence(
        hotspot.active_days
      ),

      nearbyFacility:
        hotspot.facility_name
          ? {
              id: `facility-${hotspot.hotspot_id}`,
              name: hotspot.facility_name,
              type: hotspot.facility_type ?? "unknown",
              distanceKm:
                hotspot.facility_distance_m != null
                  ? hotspot.facility_distance_m / 1000
                  : 0,
            }
          : undefined,

      region: "India",

      status:
        (hotspot as any).priority_level === "critical"
          ? "active"
          : (hotspot as any).priority_level === "high"
            ? "active"
            : "review",
    };
  });
}
