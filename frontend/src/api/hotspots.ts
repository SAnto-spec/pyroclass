import { apiClient } from "./client";
import type { ThermalAnomaly } from "../types/anomaly";
import { getAnomalies } from "./anomalies";

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

export async function fetchHotspots(): Promise<ThermalAnomaly[]> {
  return getAnomalies();
}

export async function fetchHotspot(id: number): Promise<HotspotRow | null> {
  try {
    const res = await apiClient.get<HotspotRow>(`/hotspots/${id}`);
    return res.data;
  } catch {
    return null;
  }
}
