import { apiGet } from "./client";
import type { BackendFacility } from "../types/facility";

export async function fetchFacilities(): Promise<BackendFacility[]> {
  return apiGet<BackendFacility[]>("/facilities/");
}
