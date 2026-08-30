import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md";
  elevated?: boolean;
}

export function Card({ className = "", padding = "md", elevated = false, children, ...props }: CardProps) {
  const pad = padding === "none" ? "" : padding === "sm" ? "p-3" : "p-4";
  const shadow = elevated ? "shadow-[var(--shadow-md)]" : "shadow-[var(--shadow-sm)]";
  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] ${shadow} ${pad} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-4 py-3 ${className}`} {...props}>
      {children}
    </div>
  );
}
