export type FacilityType =
  | "refinery"
  | "power_plant"
  | "steel_plant"
  | "mine"
  | "lng_terminal"
  | "petrochemical"
  | "industrial";

export type FacilityStatus = "high_attention" | "monitoring" | "nominal" | "unknown";

/** Exact response shape returned by GET /facilities/. */
export interface BackendFacility {
  facility_id: number;
  name: string;
  facility_type: string | null;
  latitude: number;
  longitude: number;
  osm_id: string | null;
  wikidata_id: string | null;
  operator: string | null;
  source: string | null;
}

export interface IndustrialFacility {
  id: string;

  name: string;

  type: FacilityType;

  latitude: number;
  longitude: number;

  region: string;
  district?: string;
  status: FacilityStatus;
}
