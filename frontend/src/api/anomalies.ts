import type { ThermalAnomaly } from "../types/anomaly";
import { mockAnomalies } from "../mocks/anomalies";

// edit later to fetch the apis using axios from the fastapi server
export async function getAnomalies(): Promise<ThermalAnomaly[]> {
  return mockAnomalies;
}
