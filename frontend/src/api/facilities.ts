import type { IndustrialFacility } from "../types/facility";
import { mockFacilities } from "../mocks/facilities";

// No backend endpoint yet — abstraction ready for future /facilities
export async function fetchFacilities(): Promise<IndustrialFacility[]> {
  return mockFacilities;
}
