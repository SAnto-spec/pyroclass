import type { IndustrialFacility } from "../types/facility";

export const mockFacilities: IndustrialFacility[] = [
  {
    id: "FAC-001",
    name: "Example Refinery",
    type: "refinery",
    latitude: 19.082,
    longitude: 72.885,
  },

  {
    id: "FAC-002",
    name: "Example Power Station",
    type: "power_plant",
    latitude: 19.11,
    longitude: 72.92,
  },
];
