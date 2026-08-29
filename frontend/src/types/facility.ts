export type FacilityType =
  | "refinery"
  | "power_plant"
  | "steel_plant"
  | "mine"
  | "lng_terminal"
  | "petrochemical";

export type FacilityStatus = "high_attention" | "monitoring" | "nominal";

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
