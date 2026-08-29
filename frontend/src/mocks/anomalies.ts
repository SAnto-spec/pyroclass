import type { ThermalAnomaly } from "../types/anomaly";

export const mockAnomalies: ThermalAnomaly[] = [
  {
    id: "AN-001",

    latitude: 19.076,
    longitude: 72.877,

    detectedAt: "2026-08-29T08:30:00Z",

    frp: 52.4,
    brightness: 340.2,
    confidence: 94,

    classification: "industrial_fire",

    persistenceScore: 0.91,

    nearbyFacility: {
      id: "FAC-001",
      name: "Example Refinery",
      type: "refinery",
      distanceKm: 1.2,
    },
  },

  {
    id: "AN-002",

    latitude: 19.12,
    longitude: 72.91,

    detectedAt: "2026-08-29T06:15:00Z",

    frp: 18.7,
    brightness: 322.8,
    confidence: 82,

    classification: "wildfire",

    persistenceScore: 0.32,
  },
];
