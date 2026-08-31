import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  href?: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
}

export function StatsCard({ label, value, subtext, icon: Icon, href, delta, deltaTone = "neutral" }: StatsCardProps) {
  const content = (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-muted)]">
          {label}
        </span>
        <Icon className="h-3 w-3 shrink-0 text-[var(--text-faint)]" aria-hidden="true" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-none tracking-tight text-[var(--text-primary)] operational-data">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {delta && (
          <span
            className={[
              "text-[11px] font-medium leading-none",
              deltaTone === "up"
                ? "text-[var(--critical-text)]"
                : deltaTone === "down"
                  ? "text-[var(--success-text)]"
                  : "text-[var(--text-muted)]",
            ].join(" ")}
          >
            {delta}
          </span>
        )}
      </div>
      {subtext ? <span className="text-[11px] leading-none text-[var(--text-muted)]">{subtext}</span> : null}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block rounded-[var(--radius-md)] border border-transparent px-3 py-2 hover:bg-[var(--surface-subtle)] hover:border-[var(--border)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="px-3 py-2">
      {content}
    </div>
  );
}
