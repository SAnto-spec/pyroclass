import { apiClient } from "./client";
import type { ThermalAnomaly } from "../types/anomaly";
import { mockAnomalies } from "../mocks/anomalies";

export interface HotspotRow {
  hotspot_id: number;
  case_id: string;
  latitude: number;
  longitude: number;
  h3_cell: string;
  mean_frp: number;
  max_frp: number;
  context_type: string;
  facility_name: string | null;
}

function mapHotspotToAnomaly(h: HotspotRow, idx: number): ThermalAnomaly {
  // Map backend hotspot to frontend ThermalAnomaly shape for compatibility
  // Backend is 20-site prototype; frontend mock is 24 anomalies with richer fields
  // We synthesize fields where missing
  return {
    id: `HS-${String(h.hotspot_id).padStart(3, "0")}`,
    latitude: h.latitude,
    longitude: h.longitude,
    detectedAt: new Date(Date.now() - idx * 3600000).toISOString(),
    frp: h.mean_frp ?? h.max_frp ?? 20,
    brightness: 320 + Math.random() * 20,
    confidence: 70 + Math.floor(Math.random() * 25),
    classification: (h.context_type as ThermalAnomaly["classification"]) ?? "other",
    persistenceScore: Math.random() * 0.6 + 0.2,
    nearbyFacility: h.facility_name ? { id: `FAC-${h.hotspot_id}`, name: h.facility_name, type: "refinery", distanceKm: 1 + Math.random() * 3 } : undefined,
    region: "Western India",
    status: "active",
  };
}

export async function fetchHotspots(): Promise<ThermalAnomaly[]> {
  try {
    const res = await apiClient.get<HotspotRow[]>("/hotspots");
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(mapHotspotToAnomaly);
    }
    return mockAnomalies;
  } catch {
    // Backend unavailable (DB not seeded, no docker) — fallback to mock for local dev
    return mockAnomalies;
  }
}

export async function fetchHotspot(id: number): Promise<HotspotRow | null> {
  try {
    const res = await apiClient.get<HotspotRow>(`/hotspots/${id}`);
    return res.data;
  } catch {
    return null;
  }
}
