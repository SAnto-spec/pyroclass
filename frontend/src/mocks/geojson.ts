import type { ThermalAnomaly } from "../types/anomaly";
import type { IndustrialFacility } from "../types/facility";
import type { PersistentThermalSource } from "../types/source";
import { mockAnomalies } from "./anomalies";
import { mockFacilities } from "./facilities";
import { mockSources } from "./sources";

type GeoPoint = { type: "Point"; coordinates: [number, number] };
type GeoFeature<P> = { type: "Feature"; geometry: GeoPoint; properties: P };
type GeoFeatureCollection<P> = { type: "FeatureCollection"; features: GeoFeature<P>[] };

export interface AnomalyProperties {
  id: string;
  classification: ThermalAnomaly["classification"];
  confidence: number;
  frp: number;
  persistenceScore: number;
  detectedAt: string;
  nearbyFacilityId: string | null;
  region: string;
  brightness: number;
  status: ThermalAnomaly["status"];
}

export interface FacilityProperties {
  id: string;
  name: string;
  type: IndustrialFacility["type"];
  region: string;
  status: IndustrialFacility["status"];
}

export interface SourceProperties {
  id: string;
  classification: PersistentThermalSource["classification"];
  persistenceScore: number;
  detectionCount: number;
  persistenceLevel: PersistentThermalSource["persistenceLevel"];
  status: PersistentThermalSource["status"];
  nearbyFacilityId: string | null;
  region: string;
}

export function anomaliesToGeoJSON(anomalies: ThermalAnomaly[] = mockAnomalies): GeoFeatureCollection<AnomalyProperties> {
  return {
    type: "FeatureCollection",
    features: anomalies.map(
      (a): GeoFeature<AnomalyProperties> => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.longitude, a.latitude] },
        properties: {
          id: a.id,
          classification: a.classification,
          confidence: a.confidence,
          frp: a.frp,
          persistenceScore: a.persistenceScore,
          detectedAt: a.detectedAt,
          nearbyFacilityId: a.nearbyFacility?.id ?? null,
          region: a.region,
          brightness: a.brightness,
          status: a.status,
        },
      })
    ),
  };
}

export function facilitiesToGeoJSON(facilities: IndustrialFacility[] = mockFacilities): GeoFeatureCollection<FacilityProperties> {
  return {
    type: "FeatureCollection",
    features: facilities.map(
      (f): GeoFeature<FacilityProperties> => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.longitude, f.latitude] },
        properties: {
          id: f.id,
          name: f.name,
          type: f.type,
          region: f.region,
          status: f.status,
        },
      })
    ),
  };
}

export function sourcesToGeoJSON(sources: PersistentThermalSource[] = mockSources): GeoFeatureCollection<SourceProperties> {
  return {
    type: "FeatureCollection",
    features: sources.map(
      (s): GeoFeature<SourceProperties> => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
        properties: {
          id: s.id,
          classification: s.classification,
          persistenceScore: s.persistenceScore,
          detectionCount: s.detectionCount,
          persistenceLevel: s.persistenceLevel,
          status: s.status,
          nearbyFacilityId: s.nearbyFacility?.id ?? null,
          region: s.region,
        },
      })
    ),
  };
}
