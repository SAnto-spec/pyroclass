import type { ThermalAnomaly } from "../types/anomaly";
import type { IndustrialFacility } from "../types/facility";
import type { Alert } from "../types/alert";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const lines = rows.map((r) =>
    columns
      .map((c) => {
        const v = r[c];
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export function exportAnomaliesCsv(anomalies: ThermalAnomaly[], filename = "anomalies.csv") {
  const cols = ["id", "classification", "confidence", "frp", "brightness", "persistenceScore", "detectedAt", "latitude", "longitude", "region", "status", "nearbyFacilityId", "nearbyFacilityName", "distanceKm"];
  const rows = anomalies.map((a) => ({
    id: a.id,
    classification: a.classification,
    confidence: a.confidence,
    frp: a.frp,
    brightness: a.brightness,
    persistenceScore: a.persistenceScore,
    detectedAt: a.detectedAt,
    latitude: a.latitude,
    longitude: a.longitude,
    region: a.region,
    status: a.status,
    nearbyFacilityId: a.nearbyFacility?.id ?? "",
    nearbyFacilityName: a.nearbyFacility?.name ?? "",
    distanceKm: a.nearbyFacility?.distanceKm ?? "",
  }));
  download(filename, toCsv(rows, cols), "text/csv;charset=utf-8");
}

export function exportAnomaliesGeoJson(anomalies: ThermalAnomaly[], filename = "anomalies.geojson") {
  const fc = {
    type: "FeatureCollection" as const,
    features: anomalies.map((a) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [a.longitude, a.latitude] },
      properties: {
        id: a.id,
        classification: a.classification,
        confidence: a.confidence,
        frp: a.frp,
        brightness: a.brightness,
        persistenceScore: a.persistenceScore,
        detectedAt: a.detectedAt,
        region: a.region,
        status: a.status,
        nearbyFacility: a.nearbyFacility ?? null,
      },
    })),
  };
  download(filename, JSON.stringify(fc, null, 2), "application/geo+json");
}

export function exportFacilitiesCsv(facilities: (IndustrialFacility & { anomalyCount?: number; maxFrp?: number })[], filename = "facilities.csv") {
  const cols = ["id", "name", "type", "latitude", "longitude", "region", "district", "status", "anomalyCount", "maxFrp"];
  const rows = facilities.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    latitude: f.latitude,
    longitude: f.longitude,
    region: f.region,
    district: f.district ?? "",
    status: f.status,
    anomalyCount: (f as unknown as { anomalyCount?: number }).anomalyCount ?? "",
    maxFrp: (f as unknown as { maxFrp?: number }).maxFrp ?? "",
  }));
  download(filename, toCsv(rows, cols), "text/csv;charset=utf-8");
}

export function exportFacilitiesGeoJson(facilities: IndustrialFacility[], filename = "facilities.geojson") {
  const fc = {
    type: "FeatureCollection" as const,
    features: facilities.map((f) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [f.longitude, f.latitude] },
      properties: {
        id: f.id,
        name: f.name,
        type: f.type,
        region: f.region,
        district: f.district ?? "",
        status: f.status,
      },
    })),
  };
  download(filename, JSON.stringify(fc, null, 2), "application/geo+json");
}

export function exportAlertsCsv(alerts: Alert[], filename = "alerts.csv") {
  const cols = ["id", "anomalyId", "severity", "title", "status", "createdAt"];
  const rows = alerts.map((a) => ({
    id: a.id,
    anomalyId: a.anomalyId,
    severity: a.severity,
    title: a.title,
    status: a.status,
    createdAt: a.createdAt,
  }));
  download(filename, toCsv(rows, cols), "text/csv;charset=utf-8");
}
