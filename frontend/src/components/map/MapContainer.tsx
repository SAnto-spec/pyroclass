import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers } from "lucide-react";

import type { ThermalAnomaly } from "../../types/anomaly";
import type { PersistentThermalSource } from "../../types/source";
import type { BackendFacility } from "../../types/facility";

import { mockAnomalies } from "../../mocks/anomalies";

import {
  anomaliesToGeoJSON,
  sourcesToGeoJSON,
} from "../../mocks/geojson";

export interface MapContainerProps {
  anomalies?: ThermalAnomaly[];
  facilities?: BackendFacility[];
  sources?: PersistentThermalSource[];
  selectedAnomalyId?: string | null;
  selectedFacilityId?: string | null;
  selectedSourceId?: string | null;
  onAnomalySelect?: (id: string) => void;
  onFacilitySelect?: (id: string) => void;
  onSourceSelect?: (id: string) => void;
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
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },

  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/*
 * Convert the real backend facility response into GeoJSON.
 *
 * We intentionally do this here instead of pretending that the
 * backend facility is an IndustrialFacility mock object.
 */
function facilitiesToLiveGeoJSON(facilities: BackendFacility[]) {
  return {
    type: "FeatureCollection",
    features: facilities.map((facility) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          facility.longitude,
          facility.latitude,
        ],
      },
      properties: {
        id: String(facility.facility_id),
        name: facility.name,
        type: facility.facility_type,
        region: "India",
        status: "active",
      },
    })),
  };
}

export function MapContainer({
  anomalies,
  facilities,
  sources,
  selectedAnomalyId = null,
  selectedFacilityId = null,
  selectedSourceId = null,
  onAnomalySelect,
  onFacilitySelect,
  onSourceSelect,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const initializedRef = useRef(false);

  const [showAnomalies, setShowAnomalies] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  /*
   * Live anomaly data is supplied by Dashboard.
   *
   * Mock anomalies remain only as a fallback for other places
   * that may render MapContainer without passing anomalies.
   */
  const anomaliesData = anomalies ?? mockAnomalies;

  /*
   * Facilities now come directly from the real backend.
   *
   * There is deliberately NO mock facility fallback.
   */
  const facilitiesData = facilities ?? [];

  /*
   * Persistent sources remain empty unless supplied.
   *
   * This prevents mock persistent-source markers from appearing.
   */
  const sourcesData = sources ?? [];

  const handleAnomalySelect = useCallback(
    (id: string) => {
      onAnomalySelect?.(id);
    },
    [onAnomalySelect]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;
    if (initializedRef.current) return;

    initializedRef.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE as never,
      center: [72.88, 19.07],
      zoom: 6,
      attributionControl: false,
    });

    mapRef.current = map;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "280px",
      className: "thermal-popup",
    });

    popupRef.current = popup;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left"
    );

    map.on("error", (e) => {
      // eslint-disable-next-line no-console
      console.error("[MapLibre error]", e.error);
    });

    map.on("load", () => {
      // ---------------------------------------------------------------
      // Thermal anomalies
      // ---------------------------------------------------------------

      const anomalyGeo = anomaliesToGeoJSON(anomaliesData);

      map.addSource("thermal-anomalies", {
        type: "geojson",
        data: anomalyGeo as never,
      });

      map.addLayer({
        id: "thermal-anomaly-circles",
        type: "circle",
        source: "thermal-anomalies",

        paint: {
          "circle-color": [
            "match",
            ["get", "classification"],
            "industrial_fire",
            ANOMALY_COLOR.industrial_fire,
            "wildfire",
            ANOMALY_COLOR.wildfire,
            "agricultural_burn",
            ANOMALY_COLOR.agricultural_burn,
            "gas_flare",
            ANOMALY_COLOR.gas_flare,
            "mining",
            ANOMALY_COLOR.mining,
            "non_industrial",
            ANOMALY_COLOR.non_industrial,
            "unknown",
            ANOMALY_COLOR.unknown,
            ANOMALY_COLOR.other,
          ],

          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "frp"],
            5,
            5,
            70,
            14,
          ],

          "circle-opacity": 0.95,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 1,
        },
      });

      // Selected anomaly
      map.addLayer({
        id: "thermal-anomaly-selected",
        type: "circle",
        source: "thermal-anomalies",

        paint: {
          "circle-color": "transparent",

          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "frp"],
            5,
            7,
            70,
            16,
          ],

          "circle-stroke-color": "#fbbf24",
          "circle-stroke-width": 2.5,
          "circle-opacity": 0,
          "circle-stroke-opacity": 1,
        },

        filter: [
          "==",
          ["get", "id"],
          selectedAnomalyId ?? "",
        ],
      });

      // ---------------------------------------------------------------
      // REAL Industrial facilities
      // ---------------------------------------------------------------

      map.addSource("industrial-facilities", {
        type: "geojson",
        data: facilitiesToLiveGeoJSON(facilitiesData) as never,
      });

      map.addLayer({
        id: "industrial-facility-circles",
        type: "circle",
        source: "industrial-facilities",

        paint: {
          "circle-color": "#334155",
          "circle-radius": 8,
          "circle-stroke-color": "#f59e0b",
          "circle-stroke-width": 2,
          "circle-opacity": 0.98,
        },
      });

      // Selected facility
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

        filter: [
          "==",
          ["get", "id"],
          selectedFacilityId ?? "",
        ],
      });

      // ---------------------------------------------------------------
      // Persistent sources
      // ---------------------------------------------------------------

      map.addSource("persistent-sources", {
        type: "geojson",
        data: sourcesToGeoJSON(sourcesData) as never,
      });

      map.addLayer({
        id: "persistent-source-circles",
        type: "circle",
        source: "persistent-sources",

        paint: {
          "circle-color": [
            "match",
            ["get", "classification"],
            "industrial_fire",
            ANOMALY_COLOR.industrial_fire,
            "wildfire",
            ANOMALY_COLOR.wildfire,
            "agricultural_burn",
            ANOMALY_COLOR.agricultural_burn,
            "gas_flare",
            ANOMALY_COLOR.gas_flare,
            "mining",
            ANOMALY_COLOR.mining,
            "non_industrial",
            ANOMALY_COLOR.non_industrial,
            "unknown",
            ANOMALY_COLOR.unknown,
            ANOMALY_COLOR.other,
          ],

          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "persistenceScore"],
            0,
            7,
            1,
            13,
          ],

          "circle-opacity": 0.55,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 1,
        },
      });

      map.addLayer({
        id: "persistent-source-selected",
        type: "circle",
        source: "persistent-sources",

        paint: {
          "circle-color": "transparent",

          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "persistenceScore"],
            0,
            8,
            1,
            14,
          ],

          "circle-stroke-color": "#38bdf8",
          "circle-stroke-width": 2.5,
        },

        filter: [
          "==",
          ["get", "id"],
          selectedSourceId ?? "",
        ],
      });

      // ---------------------------------------------------------------
      // Interaction: anomalies
      // ---------------------------------------------------------------

      map.on(
        "click",
        "thermal-anomaly-circles",
        (e: maplibregl.MapLayerMouseEvent) => {
          const feature = e.features?.[0] as unknown as
            | {
                properties: Record<string, unknown>;
                geometry: { coordinates: [number, number] };
              }
            | undefined;

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

          handleAnomalySelect(props.id);

          const html = `
            <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height:1.4; color:#0f172a;">
              <div style="font-weight:600; font-size:12px; margin-bottom:2px;">
                ${props.id} · ${CLASS_LABEL[props.classification] ?? props.classification}
              </div>

              <div style="color:#475569; font-size:11px; margin-bottom:6px;">
                ${fmtDate(props.detectedAt)} ·
                ${
                  props.nearbyFacilityId
                    ? `near ${props.nearbyFacilityId}`
                    : "no facility"
                }
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
                <div>
                  <span style="color:#64748b;">Confidence</span><br/>
                  <strong>${Number(props.confidence).toFixed(1)}%</strong>
                </div>

                <div>
                  <span style="color:#64748b;">FRP</span><br/>
                  <strong>${Number(props.frp).toFixed(1)} MW</strong>
                </div>

                <div>
                  <span style="color:#64748b;">Persistence</span><br/>
                  <strong>${Math.round(Number(props.persistenceScore))}%</strong>
                </div>

                <div>
                  <span style="color:#64748b;">Class</span><br/>
                  <strong>${CLASS_LABEL[props.classification] ?? props.classification}</strong>
                </div>
              </div>
            </div>
          `;

          const lngLat =
            (e.lngLat as unknown as maplibregl.LngLat) ??
            new maplibregl.LngLat(
              feature.geometry.coordinates[0],
              feature.geometry.coordinates[1]
            );

          popup.setLngLat(lngLat).setHTML(html).addTo(map);

          (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
        }
      );

      // ---------------------------------------------------------------
      // Interaction: facilities
      // ---------------------------------------------------------------

      map.on(
        "click",
        "industrial-facility-circles",
        (e: maplibregl.MapLayerMouseEvent) => {
          const feature = e.features?.[0] as unknown as
            | {
                properties: Record<string, unknown>;
                geometry: { coordinates: [number, number] };
              }
            | undefined;

          if (!feature?.properties) return;

          const props = feature.properties as unknown as {
            id: string;
            name: string;
            type: string;
            region: string;
            status: string;
          };

          onFacilitySelect?.(props.id);

          const anomaliesNear = anomaliesData.filter(
            (a) =>
              a.nearbyFacility?.id ===
              `facility-${props.id}`
          ).length;

          const html = `
            <div style="font-family: ui-sans-serif, system-ui; font-size:12px; color:#0f172a;">
              <div style="font-weight:600;">
                ${props.name}
              </div>

              <div style="color:#475569; font-size:11px; text-transform:capitalize;">
                ${props.type.replace("_", " ")} · ${props.region}
              </div>

              <div style="margin-top:6px; font-size:11px; color:#334155;">
                ${anomaliesNear} active anomalies · status
                <strong style="text-transform:capitalize;">
                  ${props.status.replace("_", " ")}
                </strong>
              </div>
            </div>
          `;

          const lngLat =
            (e.lngLat as unknown as maplibregl.LngLat) ??
            new maplibregl.LngLat(
              feature.geometry.coordinates[0],
              feature.geometry.coordinates[1]
            );

          popup.setLngLat(lngLat).setHTML(html).addTo(map);

          (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
        }
      );

      // ---------------------------------------------------------------
      // Interaction: persistent sources
      // ---------------------------------------------------------------

      map.on(
        "click",
        "persistent-source-circles",
        (e: maplibregl.MapLayerMouseEvent) => {
          const feature = e.features?.[0] as unknown as
            | {
                properties: Record<string, unknown>;
                geometry: { coordinates: [number, number] };
              }
            | undefined;

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
              <div style="font-weight:600;">
                ${props.id} · ${CLASS_LABEL[props.classification] ?? props.classification}
              </div>

              <div style="color:#475569; font-size:11px; margin-top:2px;">
                Persistence ${Math.round(Number(props.persistenceScore))}% ·
                ${props.detectionCount} detections
              </div>

              <div style="margin-top:4px; font-size:11px; color:#334155;">
                ${
                  props.nearbyFacilityId
                    ? `Near ${props.nearbyFacilityId}`
                    : "No facility"
                }
              </div>
            </div>
          `;

          const lngLat =
            (e.lngLat as unknown as maplibregl.LngLat) ??
            new maplibregl.LngLat(
              feature.geometry.coordinates[0],
              feature.geometry.coordinates[1]
            );

          popup.setLngLat(lngLat).setHTML(html).addTo(map);

          (e.originalEvent as MouseEvent | undefined)?.stopPropagation();
        }
      );

      // ---------------------------------------------------------------
      // Map click
      // ---------------------------------------------------------------

      map.on("click", (e: maplibregl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: [
            "thermal-anomaly-circles",
            "industrial-facility-circles",
            "persistent-source-circles",
          ],
        });

        if (!features.length) {
          popup.remove();
        }
      });

      // ---------------------------------------------------------------
      // Hover cursors
      // ---------------------------------------------------------------

      const setPointer = (layers: string[]) => {
        for (const layer of layers) {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }
      };

      setPointer([
        "thermal-anomaly-circles",
        "industrial-facility-circles",
        "persistent-source-circles",
      ]);

      setMapReady(true);
    });

    const handleResize = () => {
      map.resize();
    };

    window.addEventListener("resize", handleResize);

    const ro = new ResizeObserver(() => map.resize());

    if (containerRef.current) {
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      ro.disconnect();
      popup.remove();
      map.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------
  // Sync anomaly data
  // ---------------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) return;

    const src = map.getSource(
      "thermal-anomalies"
    ) as maplibregl.GeoJSONSource | undefined;

    if (src) {
      src.setData(
        anomaliesToGeoJSON(anomaliesData) as never
      );
    }
  }, [anomaliesData, mapReady]);

  // ---------------------------------------------------------------
  // Sync REAL facility data
  // ---------------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) return;

    const src = map.getSource(
      "industrial-facilities"
    ) as maplibregl.GeoJSONSource | undefined;

    if (src) {
      src.setData(
        facilitiesToLiveGeoJSON(facilitiesData) as never
      );
    }
  }, [facilitiesData, mapReady]);

  // ---------------------------------------------------------------
  // Sync persistent source data
  // ---------------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) return;

    const src = map.getSource(
      "persistent-sources"
    ) as maplibregl.GeoJSONSource | undefined;

    if (src) {
      src.setData(
        sourcesToGeoJSON(sourcesData) as never
      );
    }
  }, [sourcesData, mapReady]);

  // ---------------------------------------------------------------
  // Sync selection filters
  // ---------------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) return;

    if (map.getLayer("thermal-anomaly-selected")) {
      map.setFilter(
        "thermal-anomaly-selected",
        [
          "==",
          ["get", "id"],
          selectedAnomalyId ?? "",
        ] as never
      );
    }

    if (map.getLayer("industrial-facility-selected")) {
      map.setFilter(
        "industrial-facility-selected",
        [
          "==",
          ["get", "id"],
          selectedFacilityId ?? "",
        ] as never
      );
    }

    if (map.getLayer("persistent-source-selected")) {
      map.setFilter(
        "persistent-source-selected",
        [
          "==",
          ["get", "id"],
          selectedSourceId ?? "",
        ] as never
      );
    }

    if (selectedAnomalyId) {
      const found = anomaliesData.find(
        (a) => a.id === selectedAnomalyId
      );

      if (found && mapRef.current) {
        mapRef.current.easeTo({
          center: [
            found.longitude,
            found.latitude,
          ],
          zoom: Math.max(
            mapRef.current.getZoom(),
            7
          ),
          duration: 600,
        });
      }
    }
  }, [
    selectedAnomalyId,
    selectedFacilityId,
    selectedSourceId,
    anomaliesData,
    mapReady,
  ]);

  // ---------------------------------------------------------------
  // Layer visibility toggles
  // ---------------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) return;

    const setVis = (
      id: string,
      visible: boolean
    ) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(
          id,
          "visibility",
          visible ? "visible" : "none"
        );
      }
    };

    setVis(
      "thermal-anomaly-circles",
      showAnomalies
    );

    setVis(
      "thermal-anomaly-selected",
      showAnomalies
    );

    setVis(
      "industrial-facility-circles",
      showFacilities
    );

    setVis(
      "industrial-facility-selected",
      showFacilities
    );

    setVis(
      "persistent-source-circles",
      showSources
    );

    setVis(
      "persistent-source-selected",
      showSources
    );
  }, [
    showAnomalies,
    showFacilities,
    showSources,
    mapReady,
  ]);

  return (
    <section
      role="region"
      aria-label="Geospatial map"
      className="relative flex h-[360px] flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-900 sm:h-[420px] lg:h-[480px]"
    >
      <div
        ref={containerRef}
        className="h-full w-full min-h-0 flex-1"
      />

      {/* Top overlay: geospatial header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 backdrop-blur-[2px]">
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            VIIRS / SLSTR
          </span>

          <span className="hidden text-[11px] text-slate-500 sm:inline">
            {anomaliesData.length} anomalies ·{" "}
            {facilitiesData.length} facilities ·{" "}
            {sourcesData.length} persistent
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full bg-emerald-500"
            aria-hidden="true"
          />

          <span className="text-[11px] text-slate-400">
            Live ML
          </span>
        </div>
      </div>

      {/* Layer control */}
      <div className="absolute left-2 top-10 z-[1] rounded-md border border-slate-700 bg-slate-900/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
          <Layers className="h-3 w-3" />
          Layers
        </div>

        <label className="flex cursor-pointer items-center gap-2 py-1 text-slate-300">
          <input
            type="checkbox"
            checked={showAnomalies}
            onChange={(e) =>
              setShowAnomalies(
                e.target.checked
              )
            }
            className="h-3 w-3 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
          />

          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Thermal Anomalies
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-2 py-1 text-slate-300">
          <input
            type="checkbox"
            checked={showFacilities}
            onChange={(e) =>
              setShowFacilities(
                e.target.checked
              )
            }
            className="h-3 w-3 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
          />

          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-amber-500 bg-slate-800" />
            Industrial Facilities
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-2 py-1 text-slate-300">
          <input
            type="checkbox"
            checked={showSources}
            onChange={(e) =>
              setShowSources(
                e.target.checked
              )
            }
            className="h-3 w-3 rounded border-slate-600 bg-slate-800 text-sky-400 focus:ring-sky-400"
          />

          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-sky-300 bg-amber-500/30" />
            Persistent Sources
          </span>
        </label>
      </div>
    </section>
  );
}
