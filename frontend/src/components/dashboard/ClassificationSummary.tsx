import type { ThermalAnomaly } from "../../types/anomaly";

interface ClassificationSummaryProps {
  anomalies: ThermalAnomaly[];
}

const CLASSIFICATIONS = [
  {
    key: "industrial_fire",
    label: "Industrial Fire",
  },
  {
    key: "wildfire",
    label: "Wildfire",
  },
  {
    key: "agricultural_burn",
    label: "Agricultural Burn",
  },
  {
    key: "gas_flare",
    label: "Gas Flare",
  },
  {
    key: "mining",
    label: "Mining",
  },
  {
    key: "non_industrial",
    label: "Non-Industrial",
  },
  {
    key: "unknown",
    label: "Unknown",
  },
  {
    key: "other",
    label: "Other",
  },
] as const;

export function ClassificationSummary({
  anomalies,
}: ClassificationSummaryProps) {
  const total = anomalies.length;

  return (
    <section
      aria-labelledby="classification-summary-heading"
      className="rounded-md border border-slate-800 bg-slate-900"
    >
      <div className="border-b border-slate-800 px-4 py-3">
        <h2
          id="classification-summary-heading"
          className="text-xs font-semibold uppercase tracking-widest text-slate-200"
        >
          Classification Summary
        </h2>
      </div>

      <div className="space-y-3 px-4 py-4">
        {CLASSIFICATIONS.map((classification) => {
          const count = anomalies.filter(
            (anomaly) => anomaly.classification === classification.key
          ).length;

          const percentage =
            total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={classification.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  {classification.label}
                </span>

                <span className="tabular-nums text-slate-500">
                  {count} · {percentage}%
                </span>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}