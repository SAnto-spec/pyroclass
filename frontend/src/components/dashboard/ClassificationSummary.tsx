import type { ThermalAnomaly } from "../../types/anomaly";
import type { ClassificationBreakdown } from "../../types/dashboard";

interface ClassificationSummaryProps {
  anomalies?: ThermalAnomaly[];
  data?: ClassificationBreakdown[];
}

const CLASSIFICATIONS = [
  { key: "industrial_fire", label: "Industrial Fire" },
  { key: "wildfire", label: "Wildfire" },
  { key: "agricultural_burn", label: "Agricultural Burn" },
  { key: "gas_flare", label: "Gas Flare" },
  { key: "mining", label: "Mining" },
  { key: "non_industrial", label: "Non-Industrial" },
  { key: "unknown", label: "Unknown" },
  { key: "other", label: "Other" },
] as const;

export function ClassificationSummary({ anomalies, data }: ClassificationSummaryProps) {
  const total = data
    ? data.reduce((sum, item) => sum + item.count, 0)
    : anomalies?.length ?? 0;

  const items = data
    ? data.map((item) => ({
        ...item,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
      }))
    : CLASSIFICATIONS.map((classification) => {
        const count = anomalies
          ? anomalies.filter((anomaly) => anomaly.classification === classification.key).length
          : 0;

        return {
          key: classification.key,
          label: classification.label,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      }).filter((item) => item.count > 0);

  return (
    <section
      aria-labelledby="classification-summary-heading"
      className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="border-b border-[var(--border)] px-3 py-2.5">
        <h2 id="classification-summary-heading" className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
          Classification mix
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
          {total.toLocaleString()} total · last 30 days
        </p>
      </div>

      <div className="space-y-2.5 px-3 py-3">
        {items.map((item) => {
          const percentage = "percentage" in item ? item.percentage : 0;
          return (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-medium text-[var(--text-primary)]">{item.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] tabular-nums font-medium text-[var(--text-primary)] operational-data">
                    {item.count.toLocaleString()}
                  </span>
                  <span className="min-w-[32px] text-right text-[11px] tabular-nums text-[var(--text-muted)]">
                    {percentage}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--text-secondary)] transition-all"
                  style={{ width: `${percentage}%` }}
                  role="progressbar"
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.label} ${percentage}%`}
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