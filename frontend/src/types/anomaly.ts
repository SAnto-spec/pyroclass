export type AnomalyClassification =
  | "industrial_fire"
  | "wildfire"
  | "agricultural_burn"
  | "gas_flare"
  | "mining"
  | "non_industrial"
  | "unknown"
  | "other";

export interface NearbyFacility {
  id: string;
  name: string;
  type: string;
  distanceKm: number;
}

export type AnomalyStatus = "active" | "review" | "resolved";

export interface ThermalAnomaly {
  id: string;

  latitude: number;
  longitude: number;

  detectedAt: string;

  frp: number;
  brightness: number;
  confidence: number;

  classification: AnomalyClassification;

  persistenceScore: number;

  nearbyFacility?: NearbyFacility;

  region: string;
  status: AnomalyStatus;
}
