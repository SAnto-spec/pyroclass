import { apiGet } from "./client";

export interface ArmaanProbabilityBreakdown {
  "Vegetation Fire": number;
  "Industrial Fire": number;
  "Persistent Industrial Heat": number;
  "Other Thermal Anomaly": number;
}

export interface ArmaanAssessment {
  hotspot_id: number;
  case_id: string;
  predicted_class: number;
  predicted_class_name: string;
  confidence: number;
  probability_breakdown: ArmaanProbabilityBreakdown;
  matched_latitude: number;
  matched_longitude: number;
  distance_km: number;
  observation_datetime: string;
  model_source: string;
}

export async function getArmaanAssessment(hotspotId: number): Promise<ArmaanAssessment | null> {
  try {
    return await apiGet<ArmaanAssessment>(`/hotspots/${hotspotId}/ml-assessment`);
  } catch {
    return null;
  }
}
