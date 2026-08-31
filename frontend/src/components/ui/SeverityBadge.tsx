import * as React from "react";
import { OctagonAlert, TriangleAlert, CircleAlert, Info, CheckCircle2, MinusCircle } from "lucide-react";
import { Badge } from "./Badge";

export type Severity = "critical" | "high" | "medium" | "low" | "informational" | "success";

const severityConfig: Record<
  Severity,
  { label: string; variant: "critical" | "high" | "medium" | "low" | "info" | "success"; Icon: React.ElementType }
> = {
  critical: { label: "Critical", variant: "critical", Icon: OctagonAlert },
  high: { label: "High", variant: "high", Icon: TriangleAlert },
  medium: { label: "Medium", variant: "medium", Icon: CircleAlert },
  low: { label: "Low", variant: "low", Icon: MinusCircle },
  informational: { label: "Info", variant: "info", Icon: Info },
  success: { label: "Success", variant: "success", Icon: CheckCircle2 },
};

interface SeverityBadgeProps {
  severity: Severity;
  showIcon?: boolean;
}

export function SeverityBadge({ severity, showIcon = true }: SeverityBadgeProps) {
  const cfg = severityConfig[severity];
  const Icon = cfg.Icon;
  return (
    <Badge variant={cfg.variant}>
      {showIcon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      <span>{cfg.label}</span>
    </Badge>
  );
}

export function getSeverityVariant(severity: Severity) {
  return severityConfig[severity].variant;
}

export function SeverityDot({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    critical: "bg-[var(--critical)]",
    high: "bg-[var(--high)]",
    medium: "bg-[var(--medium)]",
    low: "bg-[var(--low)]",
    informational: "bg-[var(--informational)]",
    success: "bg-[var(--success)]",
  };
  return <span className={`h-2 w-2 rounded-full ${map[severity]}`} aria-hidden="true" />;
}
