import * as React from "react";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {Icon && (
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-muted)]">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <p className="text-[13px] font-medium text-[var(--text-primary)]">{title}</p>
      {description && <p className="mt-1 max-w-[32ch] text-xs leading-relaxed text-[var(--text-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
