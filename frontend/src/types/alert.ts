export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface Alert {
  id: string;

  anomalyId: string;

  severity: AlertSeverity;

  title: string;
  description: string;

  createdAt: string;

  status: AlertStatus;
}
