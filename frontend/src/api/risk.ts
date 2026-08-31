import { apiGet } from "./client";
import type { RiskAssessment } from "../types/risk";

export function getRisk(hotspotId: number): Promise<RiskAssessment> {
  return apiGet<RiskAssessment>(`/risk/${hotspotId}`);
}
