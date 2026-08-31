import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Camera, Layers } from "lucide-react";

import type { ThermalAnomaly } from "../../types/anomaly";
import type { PersistentThermalSource } from "../../types/source";
import type { BackendFacility } from "../../types/facility";
import type { CommunityReport } from "../../types/community";
import { anomaliesToGeoJSON, sourcesToGeoJSON } from "../../mocks/geojson";

export interface MapContainerProps {
  anomalies?: ThermalAnomaly[];
  facilities?: BackendFacility[];
  sources?: PersistentThermalSource[];
  communityReports?: CommunityReport[];
  selectedAnomalyId?: string | null;
  selectedFacilityId?: string | null;
  selectedSourceId?: string | null;
  selectedReportId?: string | null;
  onAnomalySelect?: (id: string) => void;
  onFacilitySelect?: (id: string) => void;
  onSourceSelect?: (id: string) => void;
  onReportSelect?: (id: string) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onReportObservationClick?: () => void;
  pickingActive?: boolean;
  pickingCoords?: { lat: number; lng: number } | null;
  showReportButton?: boolean;
  className?: string;
  onMapReady?: (map: maplibregl.Map) => void;
}

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", minzoom: 0, maxzoom: 22 }],
};

const ANOMALY_COLOR: Record<string, string> = {
  industrial_fire: "#f59e0b",
  wildfire: "#ef4444",
  agricultural_burn: "#eab308",
  gas_flare: "#a855f7",
  mining: "#94a3b8",
  non_industrial: "#64748b",
  unknown: "#475569",
  other: "#64748b",
};

const CLASS_LABEL: Record<string, string> = {
  industrial_fire: "Industrial Fire",
  wildfire: "Wildfire",
  agricultural_burn: "Agricultural Burn",
  gas_flare: "Gas Flare",
  mining: "Mining",
  non_industrial: "Non-Industrial",
  unknown: "Unknown",
  other: "Other",
};

const OBS_LABEL: Record<string, string> = {
  fire_visible: "Fire visible",
  smoke_visible: "Smoke visible",
  industrial_activity: "Industrial activity",
  agricultural_burning: "Agricultural burning",
  no_fire_observed: "No fire observed",
  fire_extinguished: "Fire extinguished",
  false_alarm: "False alarm",
  unknown: "Unknown",
};

const STATUS_TERMINOLOGY: Record<string, { label: string; tone: string }> = {
  new: { label: "Unverified", tone: "Ground Observation — awaiting review" },
  under_review: { label: "Unverified", tone: "Under review — not yet corroborated" },
  corroborated: { label: "Corroborated", tone: "Community Evidence — corroborated" },
  disputed: { label: "Disputed", tone: "Community Evidence — disputed" },
  confirmed: { label: "Corroborated", tone: "Community Evidence — corroborated" },
  rejected: { label: "Disputed", tone: "Community Evidence — rejected" },
  resolved: { label: "Corroborated", tone: "Community Evidence — resolved" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function normalizeFacilityType(facilityType: string | null): string {
  const normalized = facilityType?.trim().toLowerCase().replace(/\s+/g, "_");
  return normalized || "unknown";
}

function facilitiesToLiveGeoJSON(facilities: BackendFacility[]) {
  return {
    type: "FeatureCollection",
    features: facilities.map((facility) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [facility.longitude, facility.latitude],
      },
      properties: {
        id: String(facility.facility_id),
        name: facility.name,
        type: normalizeFacilityType(facility.facility_type),
        facility_type: facility.facility_type,
        region: "India",
        status: "active",
        osm_id: facility.osm_id,
        wikidata_id: facility.wikidata_id,
        operator: facility.operator,
        source: facility.source,
      },
    })),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function communityToGeoJSON(reports: CommunityReport[]) {
  return {
    type: "FeatureCollection" as const,
    features: reports.map((r) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [r.longitude, r.latitude] as [number, number] },
      properties: {
        id: r.id,
        observationType: r.observationType,
        status: r.status,
        credibilityScore: r.credibilityScore,
        hotspotId: r.hotspotId ?? "",
        distanceKm: r.distanceToIncidentKm ?? -1,
        observedAt: r.observedAt,
        hasPhoto: r.media.length > 0 ? 1 : 0,
        thumbUrl: r.media[0]?.thumbnailUrl ?? r.media[0]?.url ?? "",
        confirmations: r.confirmations,
        disputes: r.disputes,
      },
    })),
  };
}

function communityLinksGeoJSON(reports: CommunityReport[], anomalies: ThermalAnomaly[]) {
  const byId = new Map(anomalies.map((a) => [a.id, a]));
  const features = reports
    .filter((r) => r.hotspotId && byId.has(r.hotspotId))
    .map((r) => {
      const an = byId.get(r.hotspotId!)!;
      return {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: [[r.longitude, r.latitude] as [number, number], [an.longitude, an.latitude] as [number, number]] },
        properties: { reportId: r.id, hotspotId: r.hotspotId },
      };
    });
  return { type: "FeatureCollection" as const, features };
}

export function MapContainer({
  anomalies,
  facilities,
  sources,
  communityReports,
  selectedAnomalyId = null,
  selectedFacilityId = null,
  selectedSourceId = null,
  selectedReportId = null,
  onAnomalySelect,
  onFacilitySelect,
  onSourceSelect,
  onReportSelect,
  onMapClick,
  onReportObservationClick,
  pickingActive = false,
  pickingCoords = null,
  showReportButton = true,
  className,
  onMapReady,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const initializedRef = useRef(false);
  const pickingActiveRef = useRef(pickingActive);
  const onMapClickRef = useRef(onMapClick);

  const [showAnomalies, setShowAnomalies] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [showCommunity, setShowCommunity] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const anomaliesData = anomalies ?? [];
  const facilitiesData = facilities ?? [];
  const sourcesData = sources ?? [];
  const communityData = communityReports ?? [];

  useEffect(() => {
    pickingActiveRef.current = pickingActive;
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = pickingActive ? "crosshair" : "";
    }
  }, [pickingActive]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE as never,
      center: [72.88, 19.07],
      zoom: 6,
      attributionControl: false,
    });
    mapRef.current = map;

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "300px", className: "thermal-popup" });
    popupRef.current = popup;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

    map.on("error", (e) => {
      console.error("[MapLibre error]", e.error);
    });

    map.on("load", () => {
      const anomalyGeo = anomaliesToGeoJSON(anomaliesData);
      map.addSource("thermal-anomalies", { type: "geojson", data: anomalyGeo as never });
      map.addLayer({
        id: "thermal-anomaly-circles",
        type: "circle",
        source: "thermal-anomalies",
        paint: {
          "circle-color": ["match", ["get", "classification"], "industrial_fire", ANOMALY_COLOR.industrial_fire, "wildfire", ANOMALY_COLOR.wildfire, "agricultural_burn", ANOMALY_COLOR.agricultural_burn, "gas_flare", ANOMALY_COLOR.gas_flare, "mining", ANOMALY_COLOR.mining, "non_industrial", ANOMALY_COLOR.non_industrial, "unknown", ANOMALY_COLOR.unknown, ANOMALY_COLOR.other],
          "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 5, 4.5, 70, 12],
          "circle-opacity": 0.88,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.25,
          "circle-stroke-opacity": 1,
        },
      });

      map.addLayer({
        id: "thermal-anomaly-selected",
        type: "circle",
        source: "thermal-anomalies",
        paint: {
          "circle-color": "transparent",
          "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 5, 7, 70, 16],
          "circle-stroke-color": "#fbbf24",
          "circle-stroke-width": 2.5,
          "circle-opacity": 0,
          "circle-stroke-opacity": 1,
        },
        filter: ["==", ["get", "id"], selectedAnomalyId ?? ""],
      });

      map.addSource("industrial-facilities", { type: "geojson", data: facilitiesToLiveGeoJSON(facilitiesData) as never });
      map.addLayer({
        id: "industrial-facility-circles",
        type: "circle",
        source: "industrial-facilities",
        paint: {
          "circle-color": "#334155",
          "circle-radius": 7,
          "circle-stroke-color": "#d97706",
          "circle-stroke-width": 1.4,
          "circle-opacity": 0.94,
        },
      });

      map.addLayer({
        id: "industrial-facility-selected",
        type: "circle",
        source: "industrial-facilities",
        paint: {
          "circle-color": "#f59e0b",
          "circle-radius": 9,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.9,
        },
        filter: ["==", ["get", "id"], selectedFacilityId ?? ""],
      });

      map.addSource("persistent-sources", { type: "geojson", data: sourcesToGeoJSON(sourcesData) as never });
      map.addLayer({
        id: "persistent-source-circles",
        type: "circle",
        source: "persistent-sources",
        paint: {
          "circle-color": ["match", ["get", "classification"], "industrial_fire", ANOMALY_COLOR.industrial_fire, "wildfire", ANOMALY_COLOR.wildfire, "agricultural_burn", ANOMALY_COLOR.agricultural_burn, "gas_flare", ANOMALY_COLOR.gas_flare, "mining", ANOMALY_COLOR.mining, "non_industrial", ANOMALY_COLOR.non_industrial, "unknown", ANOMALY_COLOR.unknown, ANOMALY_COLOR.other],
          "circle-radius": ["interpolate", ["linear"], ["get", "persistenceScore"], 0, 6, 1, 11],
          "circle-opacity": 0.48,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.4,
          "circle-stroke-opacity": 1,
        },
      });

      map.addLayer({
        id: "persistent-source-selected",
        type: "circle",
        source: "persistent-sources",
        paint: {
          "circle-color": "transparent",
          "circle-radius": ["interpolate", ["linear"], ["get", "persistenceScore"], 0, 8, 1, 14],
          "circle-stroke-color": "#38bdf8",
          "circle-stroke-width": 2,
          "circle-opacity": 0,
          "circle-stroke-opacity": 1,
        },
        filter: ["==", ["get", "id"], selectedSourceId ?? ""],
      });

      map.addSource("community-links", { type: "geojson", data: communityLinksGeoJSON(communityData, anomaliesData) as never });
      map.addSource("community-reports", { type: "geojson", data: communityToGeoJSON(communityData) as never });
      map.addLayer({
        id: "community-links-line",
        type: "line",
        source: "community-links",
        paint: { "line-color": "#475569", "line-width": 1, "line-opacity": 0.28, "line-dasharray": [2, 3] },
      });
      map.addLayer({
        id: "community-report-circles",
        type: "circle",
        source: "community-reports",
        paint: {
          "circle-color": ["match", ["get", "status"], "corroborated", "#0f5e59", "confirmed", "#0f5e59", "resolved", "#0f5e59", "disputed", "#92400e", "rejected", "#92400e", "new", "#475569", "under_review", "#475569", "#0f5e59"],
          "circle-radius": 6.5,
          "circle-opacity": 0.92,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.2,
          "circle-stroke-opacity": 1,
        },
      });

      map.addLayer({
        id: "community-report-selected",
        type: "circle",
        source: "community-reports",
        paint: { "circle-color": "transparent", "circle-radius": 10, "circle-stroke-color": "#0f5e59", "circle-stroke-width": 1.8, "circle-opacity": 0, "circle-stroke-opacity": 0.95 },
        filter: ["==", ["get", "id"], selectedReportId ?? ""],
      });

      map.addSource("picking-marker", { type: "geojson", data: { type: "FeatureCollection", features: [] } as never });
      map.addLayer({ id: "picking-marker-circle", type: "circle", source: "picking-marker", paint: { "circle-color": "#ffffff", "circle-radius": 7, "circle-stroke-color": "#0f766e", "circle-stroke-width": 2.5, "circle-opacity": 0.98 } });
      map.addLayer({ id: "picking-marker-pulse", type: "circle", source: "picking-marker", paint: { "circle-color": "#14b8a6", "circle-radius": 14, "circle-opacity": 0.18, "circle-stroke-color": "#14b8a6", "circle-stroke-width": 1, "circle-stroke-opacity": 0.45 } });

      map.on("click", "thermal-anomaly-circles", (e: maplibregl.MapLayerMouseEvent) => {
        if (pickingActiveRef.current) {
          onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
          return;
        }

        const feature = e.features?.[0] as { properties: Record<string, unknown>; geometry: { coordinates: [number, number] } } | undefined;
        if (!feature?.properties) return;

        const props = feature.properties as unknown as {
          id: string;
          classification: string;
          confidence: number;
          frp: number;
          persistenceScore: number;
          detectedAt: string;
          nearbyFacilityId: string | null;
        };

        onAnomalySelect?.(props.id);

        const html = `
          <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height:1.4; color:#0f172a;">
            <div style="font-weight:600; font-size:12px; margin-bottom:2px;">${props.id} · ${CLASS_LABEL[props.classification] ?? props.classification}</div>
            <div style="color:#475569; font-size:11px; margin-bottom:6px;">${fmtDate(props.detectedAt)} · ${props.nearbyFacilityId ? `near ${props.nearbyFacilityId}` : "no facility"}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
              <div><span style="color:#64748b;">Confidence</span><br/><strong>${Number(props.confidence).toFixed(1)}%</strong></div>
              <div><span style="color:#64748b;">FRP</span><br/><strong>${Number(props.frp).toFixed(1)} MW</strong></div>
              <div><span style="color:#64748b;">Persistence</span><br/><strong>${Math.round(Number(props.persistenceScore) * 100)}%</strong></div>
              <div><span style="color:#64748b;">Class</span><br/><strong>${CLASS_LABEL[props.classification] ?? props.classification}</strong></div>
            </div>
          </div>`;

        const lngLat = (e.lngLat as unknown as maplibregl.LngLat) ?? new maplibregl.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
        popup.setLngLat(lngLat).setHTML(html).addTo(map);
        (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
      });

      map.on("click", "industrial-facility-circles", (e: maplibregl.MapLayerMouseEvent) => {
        if (pickingActiveRef.current) {
          onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
          return;
        }

        const feature = e.features?.[0] as { properties: Record<string, unknown>; geometry: { coordinates: [number, number] } } | undefined;
        if (!feature?.properties) return;

        const props = feature.properties as unknown as {
          id: string;
          name: string;
          type: string;
          region: string;
          status: string;
        };

        onFacilitySelect?.(props.id);
        const anomaliesNear = anomaliesData.filter((a) => a.nearbyFacility?.id === `facility-${props.id}`).length;

        const html = `
          <div style="font-family: ui-sans-serif, system-ui; font-size:12px; color:#0f172a;">
            <div style="font-weight:600;">${props.name}</div>
            <div style="color:#475569; font-size:11px; text-transform:capitalize;">${props.type.replace("_", " ")} · ${props.region}</div>
            <div style="margin-top:6px; font-size:11px; color:#334155;">${anomaliesNear} active anomalies · status <strong style="text-transform:capitalize;">${props.status.replace("_", " ")}</strong></div>
          </div>`;

        const lngLat = (e.lngLat as unknown as maplibregl.LngLat) ?? new maplibregl.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
        popup.setLngLat(lngLat).setHTML(html).addTo(map);
        (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
      });

      map.on("click", "persistent-source-circles", (e: maplibregl.MapLayerMouseEvent) => {
        if (pickingActiveRef.current) {
          onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
          return;
        }

        const feature = e.features?.[0] as { properties: Record<string, unknown>; geometry: { coordinates: [number, number] } } | undefined;
        if (!feature?.properties) return;

        const props = feature.properties as unknown as {
          id: string;
          classification: string;
          persistenceScore: number;
          detectionCount: number;
          nearbyFacilityId: string | null;
        };

        onSourceSelect?.(props.id);

        const html = `
          <div style="font-family: ui-sans-serif, system-ui; font-size:12px; color:#0f172a;">
            <div style="font-weight:600;">${props.id} · ${CLASS_LABEL[props.classification] ?? props.classification}</div>
            <div style="color:#475569; font-size:11px; margin-top:2px;">Persistence ${Math.round(Number(props.persistenceScore) * 100)}% · ${props.detectionCount} detections</div>
            <div style="margin-top:4px; font-size:11px; color:#334155;">${props.nearbyFacilityId ? `Near ${props.nearbyFacilityId}` : "No facility"}</div>
          </div>`;

        const lngLat = (e.lngLat as unknown as maplibregl.LngLat) ?? new maplibregl.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
        popup.setLngLat(lngLat).setHTML(html).addTo(map);
        (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
      });

      map.on("click", "community-report-circles", (e: maplibregl.MapLayerMouseEvent) => {
        if (pickingActiveRef.current) {
          onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
          return;
        }

        const feature = e.features?.[0] as { properties: Record<string, unknown>; geometry: { coordinates: [number, number] } } | undefined;
        if (!feature?.properties) return;

        const props = feature.properties as unknown as {
          id: string;
          observationType: string;
          status: string;
          credibilityScore: number;
          hotspotId: string;
          distanceKm: number;
          observedAt: string;
          hasPhoto: number;
          thumbUrl: string;
          confirmations: number;
          disputes: number;
        };

        const term = STATUS_TERMINOLOGY[props.status] ?? { label: escapeHtml(props.status), tone: "Ground Observation" };
        const obsLabel = OBS_LABEL[props.observationType] ?? props.observationType;
        const linkedBadge = props.hotspotId
          ? `<span style="border:1px solid #cbd5e1; background:#f8fafc; color:#334155; border-radius:4px; padding:1px 6px; font-size:11px;">→ ${escapeHtml(props.hotspotId)}${props.distanceKm >= 0 ? ` · ${Number(props.distanceKm).toFixed(1)}km` : ""}</span>`
          : `<span style="border:1px solid #fde68a; background:#fffbeb; color:#92400e; border-radius:4px; padding:1px 6px; font-size:11px;">Unlinked — candidate source</span>`;
        const credPct = Math.round(Number(props.credibilityScore) * 100);

        const html = `
          <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height:1.45; color:#0f172a; min-width:260px; max-width:300px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
              <span style="font-weight:600; font-size:12px; display:inline-flex; align-items:center; gap:6px;"><span style="display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:999px; background:#0f766e; color:white; font-size:10px;">◉</span> Ground Observation · ${escapeHtml(props.id)}</span>
              <span style="border:1px solid #ccfbf1; background:#f0fdfa; color:#0f766e; border-radius:4px; padding:1px 6px; font-size:11px; font-weight:600;">${escapeHtml(term.label)}</span>
            </div>
            <div style="font-size:11px; font-weight:500; color:#334155; margin-bottom:4px;">${escapeHtml(obsLabel)}</div>
            <div style="font-size:11px; color:#64748b; margin-bottom:6px;">${escapeHtml(term.tone)}</div>
            ${props.thumbUrl ? `<div style="margin-bottom:8px; overflow:hidden; border-radius:6px; border:1px solid #e2e8f0;"><img src="${escapeHtml(props.thumbUrl)}" alt="Ground observation thumbnail" style="width:100%; height:92px; object-fit:cover; display:block;" loading="lazy" /></div>` : `<div style="margin-bottom:8px; border:1px dashed #e2e8f0; border-radius:6px; background:#f8fafc; padding:8px; text-align:center; font-size:11px; color:#94a3b8;">No photo — observation unverified</div>`}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px; margin-bottom:6px;">
              <div style="border:1px solid #f1f5f9; border-radius:6px; padding:6px; background:#f8fafc;"><div style="font-size:10px; letter-spacing:0.04em; color:#94a3b8;">OBSERVED</div><div style="font-weight:600; color:#0f172a;">${fmtDate(props.observedAt)}</div></div>
              <div style="border:1px solid #f1f5f9; border-radius:6px; padding:6px; background:#f8fafc;"><div style="font-size:10px; letter-spacing:0.04em; color:#94a3b8;">LINKAGE</div><div style="font-weight:500; color:#334155;">${props.hotspotId ? `${Number(props.distanceKm).toFixed(1)} km to ${escapeHtml(props.hotspotId)}` : "Independent — no FIRMS link"}</div></div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px; align-items:center;">
              ${linkedBadge}
              <span style="display:inline-flex; align-items:center; gap:4px; border:1px solid #e2e8f0; background:#f0fdfa; border-radius:999px; padding:2px 8px; font-size:11px;"><span style="width:6px; height:6px; border-radius:999px; background:#059669;"></span> ${props.confirmations} corroborate</span>
              <span style="display:inline-flex; align-items:center; gap:4px; border:1px solid #e2e8f0; background:#fef2f2; border-radius:999px; padding:2px 8px; font-size:11px;"><span style="width:6px; height:6px; border-radius:999px; background:#dc2626;"></span> ${props.disputes} dispute</span>
              <span style="border:1px solid #e0f2fe; background:#f0f9ff; color:#075985; border-radius:999px; padding:2px 8px; font-size:11px;">Community Evidence ${credPct}%</span>
            </div>
            <div style="font-size:11px; color:#475569; border-top:1px solid #f1f5f9; padding-top:6px; line-height:1.4;">Credibility 0–1 distinct from AI confidence &amp; anomaly score. Not a confirmed fire until corroborated.</div>
          </div>`;

        const lngLat = (e.lngLat as unknown as maplibregl.LngLat) ?? new maplibregl.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
        popup.setLngLat(lngLat).setHTML(html).addTo(map);
        onReportSelect?.(props.id);
        (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
      });

      map.on("click", (e: maplibregl.MapMouseEvent) => {
        const target = e.originalEvent?.target as HTMLElement | null;
        const isControl = target?.closest?.(".maplibregl-ctrl");
        if (isControl) return;

        const features = map.queryRenderedFeatures(e.point, {
          layers: ["thermal-anomaly-circles", "industrial-facility-circles", "persistent-source-circles", "community-report-circles"],
        });

        if (!features.length) {
          popup.remove();
          if (pickingActiveRef.current) {
            onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          }
        }
      });

      const setPointer = (layers: string[]) => {
        for (const layer of layers) {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = pickingActiveRef.current ? "crosshair" : "";
          });
        }
      };

      setPointer(["thermal-anomaly-circles", "industrial-facility-circles", "persistent-source-circles", "community-report-circles"]);
      map.on("mousemove", () => {
        if (pickingActiveRef.current) map.getCanvas().style.cursor = "crosshair";
      });

      onMapReady?.(map);
      setMapReady(true);
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    const ro = new ResizeObserver(() => map.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      ro.disconnect();
      popup.remove();
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("thermal-anomalies") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(anomaliesToGeoJSON(anomaliesData) as never);
  }, [anomaliesData, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("industrial-facilities") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(facilitiesToLiveGeoJSON(facilitiesData) as never);
  }, [facilitiesData, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("persistent-sources") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(sourcesToGeoJSON(sourcesData) as never);
  }, [sourcesData, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("community-reports") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(communityToGeoJSON(communityData) as never);
    const linkSrc = map.getSource("community-links") as maplibregl.GeoJSONSource | undefined;
    if (linkSrc) linkSrc.setData(communityLinksGeoJSON(communityData, anomaliesData) as never);
  }, [communityData, anomaliesData, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("picking-marker") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (pickingCoords) {
      src.setData({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [pickingCoords.lng, pickingCoords.lat] }, properties: {} }] } as never);
    } else {
      src.setData({ type: "FeatureCollection", features: [] } as never);
    }
  }, [pickingCoords, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.getLayer("thermal-anomaly-selected")) map.setFilter("thermal-anomaly-selected", ["==", ["get", "id"], selectedAnomalyId ?? ""] as never);
    if (map.getLayer("industrial-facility-selected")) map.setFilter("industrial-facility-selected", ["==", ["get", "id"], selectedFacilityId ?? ""] as never);
    if (map.getLayer("persistent-source-selected")) map.setFilter("persistent-source-selected", ["==", ["get", "id"], selectedSourceId ?? ""] as never);
    if (map.getLayer("community-report-selected")) map.setFilter("community-report-selected", ["==", ["get", "id"], selectedReportId ?? ""] as never);

    if (selectedAnomalyId) {
      const found = anomaliesData.find((a) => a.id === selectedAnomalyId);
      if (found && mapRef.current) {
        mapRef.current.easeTo({ center: [found.longitude, found.latitude], zoom: Math.max(mapRef.current.getZoom(), 7), duration: 600 });
      }
    } else if (selectedReportId) {
      const found = communityData.find((r) => r.id === selectedReportId);
      if (found && mapRef.current) {
        mapRef.current.easeTo({ center: [found.longitude, found.latitude], zoom: Math.max(mapRef.current.getZoom(), 9), duration: 600 });
      }
    }
  }, [selectedAnomalyId, selectedFacilityId, selectedSourceId, selectedReportId, anomaliesData, communityData, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const setVis = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };

    setVis("thermal-anomaly-circles", showAnomalies);
    setVis("thermal-anomaly-selected", showAnomalies);
    setVis("industrial-facility-circles", showFacilities);
    setVis("industrial-facility-selected", showFacilities);
    setVis("persistent-source-circles", showSources);
    setVis("persistent-source-selected", showSources);
    setVis("community-report-circles", showCommunity);
    setVis("community-report-selected", showCommunity);
    setVis("community-links-line", showCommunity && showAnomalies);
  }, [showAnomalies, showFacilities, showSources, showCommunity, mapReady]);

  return (
    <section role="region" aria-label="Geospatial map" className={className ?? "relative flex h-[380px] flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] sm:h-[440px] lg:h-[560px]"}>
      <div ref={containerRef} className="h-full w-full min-h-0 flex-1" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--map-overlay-bg)] px-3 py-1.5 backdrop-blur-[6px]">
        <div className="flex items-center gap-2">
          <span className="rounded-[4px] border border-[var(--border)] bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-[var(--text-muted)]">VIIRS / SLSTR</span>
          <span className="hidden text-[11px] text-[var(--text-muted)] sm:inline">{anomaliesData.length} · {facilitiesData.length} · {sourcesData.length} persistent · {communityData.length} ground</span>
        </div>
        <div className="flex items-center gap-1.5">
          {pickingActive && <span className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-2 py-0.5 text-[10px] font-medium text-[#0f766e]">Pick location — click map</span>}
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-faint)]" aria-hidden="true" />
          <span className="text-[10px] leading-none text-[var(--text-faint)]">Live API</span>
        </div>
      </div>

      {showReportButton && onReportObservationClick && (
        <button type="button" onClick={onReportObservationClick} className="absolute right-2 top-10 z-[1] inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[#0f766e] bg-[#0f766e] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[var(--shadow-md)] hover:bg-[#0e6b63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <Camera className="h-3.5 w-3.5" /> Report Observation
        </button>
      )}

      <div className="absolute left-2 top-10 z-[1] rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 py-2 text-xs shadow-[var(--shadow-md)]">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]"><Layers className="h-3 w-3" /> Layers</div>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-[var(--text-secondary)]"><input type="checkbox" checked={showAnomalies} onChange={(e) => setShowAnomalies(e.target.checked)} className="h-3 w-3 rounded border-[var(--border-strong)] bg-white text-[var(--accent)] focus:ring-[var(--accent)]" /><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Thermal Anomalies</span></label>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-[var(--text-secondary)]"><input type="checkbox" checked={showFacilities} onChange={(e) => setShowFacilities(e.target.checked)} className="h-3 w-3 rounded border-[var(--border-strong)] bg-white text-[var(--accent)] focus:ring-[var(--accent)]" /><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-[var(--accent)] bg-white" /> Industrial Facilities</span></label>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-[var(--text-secondary)]"><input type="checkbox" checked={showSources} onChange={(e) => setShowSources(e.target.checked)} className="h-3 w-3 rounded border-[var(--border-strong)] bg-white text-sky-600 focus:ring-sky-600" /><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-sky-300 bg-[var(--accent)]/20" /> Persistent Sources</span></label>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-[var(--text-secondary)]"><input type="checkbox" checked={showCommunity} onChange={(e) => setShowCommunity(e.target.checked)} className="h-3 w-3 rounded border-[var(--border-strong)] bg-white text-[#0f766e] focus:ring-[#0f766e]" /><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0f766e] border border-white shadow-sm" /> Ground Observations</span></label>
      </div>
    </section>
  );
}
