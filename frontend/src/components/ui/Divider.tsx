import * as React from "react";

export function Divider({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={`h-px bg-[var(--border)] ${className}`} {...props} />;
}

export function VerticalDivider({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={`w-px bg-[var(--border)] self-stretch ${className}`} {...props} />;
}
