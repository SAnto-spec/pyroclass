import type { AnomalyClassification } from "./anomaly";

export interface DashboardStats {
  totalAnomalies: number;
  industrialFires: number;
  persistentSources: number;
  activeAlerts: number;
}

export interface ClassificationBreakdown {
  key: AnomalyClassification;
  label: string;
  count: number;
}
