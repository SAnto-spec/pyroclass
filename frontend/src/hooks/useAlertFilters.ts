import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";
import type { AlertSeverity, AlertStatus } from "../types/alert";
import type { AnomalyClassification } from "../types/anomaly";

export type AlertSeverityFilter = AlertSeverity | "all";
export type AlertStatusFilter = AlertStatus | "all";
export type AlertClassificationFilter = AnomalyClassification | "all";

export interface AlertFilters {
  q: string;
  severity: AlertSeverityFilter;
  status: AlertStatusFilter;
  class: AlertClassificationFilter;
}

const defaults: AlertFilters = {
  q: "",
  severity: "all",
  status: "all",
  class: "all",
};

export function useAlertFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: AlertFilters = useMemo(() => {
    const q = searchParams.get("q") ?? defaults.q;
    const severity = searchParams.get("severity") as AlertSeverityFilter | null;
    const status = searchParams.get("status") as AlertStatusFilter | null;
    const cls = searchParams.get("class") as AlertClassificationFilter | null;
    return {
      q,
      severity: severity && ["critical", "high", "medium", "low", "all"].includes(severity) ? severity : defaults.severity,
      status: status && ["active", "acknowledged", "resolved", "all"].includes(status) ? status : defaults.status,
      class: cls && ["industrial_fire", "wildfire", "agricultural_burn", "gas_flare", "mining", "other", "all"].includes(cls) ? cls : defaults.class,
    };
  }, [searchParams]);

  const set = useCallback(
    (patch: Partial<AlertFilters>) => {
      const next = new URLSearchParams(searchParams);
      const merged = { ...filters, ...patch };
      if (!merged.q) next.delete("q");
      else next.set("q", merged.q);
      if (merged.severity === defaults.severity) next.delete("severity");
      else next.set("severity", merged.severity);
      if (merged.status === defaults.status) next.delete("status");
      else next.set("status", merged.status);
      if (merged.class === defaults.class) next.delete("class");
      else next.set("class", merged.class);
      setSearchParams(next, { replace: true });
    },
    [filters, searchParams, setSearchParams]
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    next.delete("severity");
    next.delete("status");
    next.delete("class");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const activeCount = useMemo(() => {
    let c = 0;
    if (filters.q) c++;
    if (filters.severity !== "all") c++;
    if (filters.status !== "all") c++;
    if (filters.class !== "all") c++;
    return c;
  }, [filters]);

  const hasActive = activeCount > 0;

  return { filters, set, clearAll, hasActive, activeCount };
}
