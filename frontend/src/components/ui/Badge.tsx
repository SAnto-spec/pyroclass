import * as React from "react";

type BadgeVariant = "default" | "secondary" | "accent" | "critical" | "high" | "medium" | "low" | "success" | "info";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border)]",
  secondary: "bg-[var(--surface-subtle)] text-[var(--text-muted)] border-[var(--border)]",
  accent: "bg-[var(--accent-weak)] text-[var(--accent-muted)] border-[var(--accent-border)]",
  critical: "bg-[var(--critical-weak)] text-[var(--critical-text)] border-[var(--critical-border)]",
  high: "bg-[var(--high-weak)] text-[var(--high-text)] border-[var(--high-border)]",
  medium: "bg-[var(--medium-weak)] text-[var(--medium-text)] border-[var(--medium-border)]",
  low: "bg-[var(--low-weak)] text-[var(--low-text)] border-[var(--low-border)]",
  success: "bg-[var(--success-weak)] text-[var(--success-text)] border-[var(--success-border)]",
  info: "bg-[var(--informational-weak)] text-[var(--informational-text)] border-[var(--informational-border)]",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[11px] font-medium leading-none ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
