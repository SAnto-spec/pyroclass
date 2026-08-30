import type { ClassificationBreakdown } from "../../types/dashboard";

interface ClassificationSummaryProps {
  data: ClassificationBreakdown[];
}

export function ClassificationSummary({ data }: ClassificationSummaryProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <section
      aria-labelledby="classification-heading"
      className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="border-b border-[var(--border)] px-3 py-2.5">
        <h2
          id="classification-heading"
          className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]"
        >
          Classification mix
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          {total.toLocaleString()} · last 30 days
        </p>
      </div>

      <div className="space-y-2.5 px-3 py-3">
        {data.map((item) => {
          const pct = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-medium text-[var(--text-primary)]">
                  {item.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] tabular-nums font-medium text-[var(--text-primary)] operational-data">
                    {item.count.toLocaleString()}
                  </span>
                  <span className="min-w-[32px] text-right text-[11px] tabular-nums text-[var(--text-muted)]">
                    {pct.toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--text-secondary)] transition-all"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.label} ${pct.toFixed(1)}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2">
        <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
          Automated · verification required for industrial vs wildfire.
        </p>
      </div>
    </section>
  );
}
