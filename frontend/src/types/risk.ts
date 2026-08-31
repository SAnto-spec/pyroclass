export interface RiskAssessment {
  hotspot_id: number;
  risk_score: number;
  risk_tier: "Low" | "Medium" | "High" | "Critical";
  probability_breakdown: {
    escalating: number;
    persistent_industrial: number;
    unclassified: number;
  };
  risk_factors: Record<string, unknown>;
  explanation: Record<string, unknown>;
}
