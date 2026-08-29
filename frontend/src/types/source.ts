import type { AnomalyClassification } from "./anomaly";

export type PersistenceLevel = "high" | "medium" | "low";
export type SourceStatus = "confirmed" | "under_investigation" | "candidate";

export interface PersistentThermalSource {
  id: string;
  latitude: number;
  longitude: number;
  region: string;
  classification: AnomalyClassification;
  persistenceLevel: PersistenceLevel;
  persistenceScore: number;
  detectionCount: number;
  firstDetected: string;
  lastDetected: string;
  nearbyFacility?: {
    id: string;
    name: string;
    type: string;
    distanceKm: number;
  };
  status: SourceStatus;
  timeline: string[];
}
