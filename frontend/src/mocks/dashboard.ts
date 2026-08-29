import type { Alert } from "../types/alert";
import type { ClassificationBreakdown, DashboardStats } from "../types/dashboard";

export const dashboardStats: DashboardStats = {
  totalAnomalies: 1284,
  industrialFires: 142,
  persistentSources: 87,
  activeAlerts: 12,
};

export const recentAlerts: Alert[] = [
  {
    id: "ALT-1042",
    anomalyId: "AN-001",
    severity: "critical",
    title: "High-confidence industrial fire near facility",
    description:
      "VIIRS detection with 94% confidence 1.2 km from Example Refinery. FRP 52.4 MW, brightness 340 K.",
    createdAt: "2026-08-29T08:30:00Z",
    status: "active",
  },
  {
    id: "ALT-1041",
    anomalyId: "AN-087",
    severity: "high",
    title: "Persistent thermal source detected",
    description:
      "Source active for 14 consecutive overpasses. Persistence score 0.91 near steel plant corridor.",
    createdAt: "2026-08-29T06:45:00Z",
    status: "active",
  },
  {
    id: "ALT-1040",
    anomalyId: "AN-002",
    severity: "medium",
    title: "Possible wildfire — under review",
    description:
      "Moderate FRP 18.7 MW in vegetated area. Classification confidence 82% wildfire, no nearby facility.",
    createdAt: "2026-08-29T06:15:00Z",
    status: "active",
  },
  {
    id: "ALT-1039",
    anomalyId: "AN-093",
    severity: "high",
    title: "High FRP anomaly near industrial facility",
    description:
      "FRP 68.1 MW detected 0.8 km from Example Power Station. Requires operator verification.",
    createdAt: "2026-08-29T03:20:00Z",
    status: "active",
  },
];

export const classificationSummary: ClassificationBreakdown[] = [
  { key: "industrial_fire", label: "Industrial Fire", count: 142 },
  { key: "wildfire", label: "Wildfire", count: 318 },
  { key: "agricultural_burn", label: "Agricultural Burn", count: 401 },
  { key: "gas_flare", label: "Gas Flare", count: 215 },
  { key: "mining", label: "Mining", count: 128 },
  { key: "other", label: "Other", count: 80 },
];
