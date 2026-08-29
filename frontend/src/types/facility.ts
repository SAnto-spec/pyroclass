export type FacilityType =
  | "refinery"
  | "power_plant"
  | "steel_plant"
  | "mine"
  | "lng_terminal"
  | "petrochemical";

export interface IndustrialFacility {
  id: string;

  name: string;

  type: FacilityType;

  latitude: number;
  longitude: number;
}
