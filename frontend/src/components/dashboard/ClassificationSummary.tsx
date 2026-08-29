import type { ClassificationBreakdown } from "../../types/dashboard";

interface ClassificationSummaryProps {
  data: ClassificationBreakdown[];
}

export function ClassificationSummary({ data }: ClassificationSummaryProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <section
      aria-labelledby="classification-heading"
      className="rounded-md border border-slate-800 bg-slate-900"
    >
      <div className="border-b border-slate-800 px-4 py-3">
        <h2
          id="classification-heading"
          className="text-xs font-semibold uppercase tracking-widest text-slate-200"
        >
          Classification Summary
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {total.toLocaleString()} classified anomalies · last 30 days
        </p>
      </div>

      <div className="space-y-3 px-4 py-4">
        {data.map((item) => {
          const pct = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-300">
                  {item.label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-slate-400">
                    {item.count.toLocaleString()}
                  </span>
                  <span className="min-w-[36px] text-right text-[11px] tabular-nums text-slate-500">
                    {pct.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
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

      <div className="border-t border-slate-800 px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-slate-500">
          Automated classification pending review. Industrial fire vs wildfire
          requires contextual verification.
        </p>
      </div>
    </section>
  );
}
