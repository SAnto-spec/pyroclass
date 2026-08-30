import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";
import type { AnomalyClassification } from "../types/anomaly";

export type InvestigationClassification = AnomalyClassification | "all";
export type InvestigationSeverity = "all" | "critical" | "high" | "medium" | "low";
export type InvestigationFrp = "all" | "low" | "medium" | "high"; // <20, 20-50, >50
export type InvestigationPersist = "all" | "low" | "medium" | "high"; // <0.4, 0.4-0.7, >=0.7
export type InvestigationStatus = "all" | "active" | "review" | "resolved";

export interface InvestigationFilters {
  q: string; // search
  class: InvestigationClassification;
  severity: InvestigationSeverity;
  frp: InvestigationFrp;
  persist: InvestigationPersist;
  status: InvestigationStatus;
}

const defaults: InvestigationFilters = {
  q: "",
  class: "all",
  severity: "all",
  frp: "all",
  persist: "all",
  status: "all",
};

const keys: Record<keyof InvestigationFilters, string> = {
  q: "q",
  class: "class",
  severity: "severity",
  frp: "frp",
  persist: "persist",
  status: "status",
};

export function useInvestigationFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: InvestigationFilters = useMemo(() => {
    const q = searchParams.get(keys.q) ?? defaults.q;
    const cls = searchParams.get(keys.class) as InvestigationClassification | null;
    const sev = searchParams.get(keys.severity) as InvestigationSeverity | null;
    const frp = searchParams.get(keys.frp) as InvestigationFrp | null;
    const persist = searchParams.get(keys.persist) as InvestigationPersist | null;
    const status = searchParams.get(keys.status) as InvestigationStatus | null;

    return {
      q,
      class: cls && ["industrial_fire", "wildfire", "agricultural_burn", "gas_flare", "mining", "other", "all"].includes(cls) ? (cls as InvestigationClassification) : defaults.class,
      severity: sev && ["all", "critical", "high", "medium", "low"].includes(sev) ? sev : defaults.severity,
      frp: frp && ["all", "low", "medium", "high"].includes(frp) ? frp : defaults.frp,
      persist: persist && ["all", "low", "medium", "high"].includes(persist) ? persist : defaults.persist,
      status: status && ["all", "active", "review", "resolved"].includes(status) ? status : defaults.status,
    };
  }, [searchParams]);

  const set = useCallback(
    (patch: Partial<InvestigationFilters>) => {
      const next = new URLSearchParams(searchParams);
      const merged = { ...filters, ...patch };
      // q
      if (!merged.q) next.delete(keys.q);
      else next.set(keys.q, merged.q);
      // class
      if (merged.class === defaults.class) next.delete(keys.class);
      else next.set(keys.class, merged.class);
      if (merged.severity === defaults.severity) next.delete(keys.severity);
      else next.set(keys.severity, merged.severity);
      if (merged.frp === defaults.frp) next.delete(keys.frp);
      else next.set(keys.frp, merged.frp);
      if (merged.persist === defaults.persist) next.delete(keys.persist);
      else next.set(keys.persist, merged.persist);
      if (merged.status === defaults.status) next.delete(keys.status);
      else next.set(keys.status, merged.status);
      setSearchParams(next, { replace: true });
    },
    [filters, searchParams, setSearchParams]
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    (Object.keys(keys) as (keyof InvestigationFilters)[]).forEach((k) => next.delete(keys[k]));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const hasActive = useMemo(() => {
    return (
      filters.q !== defaults.q ||
      filters.class !== defaults.class ||
      filters.severity !== defaults.severity ||
      filters.frp !== defaults.frp ||
      filters.persist !== defaults.persist ||
      filters.status !== defaults.status
    );
  }, [filters]);

  const activeCount = useMemo(() => {
    let c = 0;
    if (filters.q) c++;
    if (filters.class !== "all") c++;
    if (filters.severity !== "all") c++;
    if (filters.frp !== "all") c++;
    if (filters.persist !== "all") c++;
    if (filters.status !== "all") c++;
    return c;
  }, [filters]);

  return { filters, set, clearAll, hasActive, activeCount };
}

// Severity derived from anomaly fields — used for filtering/visualization
export function anomalySeverity(a: { confidence: number; frp: number; persistenceScore: number }): InvestigationSeverity {
  // critical: very high confidence + high FRP or high persistence
  if (a.confidence >= 96 && a.frp >= 50) return "critical";
  if (a.confidence >= 94 && a.persistenceScore >= 0.9) return "critical";
  if (a.confidence >= 95) return "critical";
  if (a.confidence >= 90) return "high";
  if (a.confidence >= 80) return "medium";
  return "low";
}
