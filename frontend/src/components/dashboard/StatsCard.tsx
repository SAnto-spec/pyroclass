import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
}

export function StatsCard({ label, value, subtext, icon: Icon }: StatsCardProps) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </p>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-950 text-slate-400">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-100">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subtext ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtext}</p>
      ) : null}
    </div>
  );
}
