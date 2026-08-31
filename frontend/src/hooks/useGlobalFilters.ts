import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

export type TimeRange = "7d" | "14d" | "30d" | "all";
export type Region = "all" | "Western India" | "Central India" | "Eastern India";
export type Confidence = "all" | "80" | "90";

export interface GlobalFilters {
  range: TimeRange;
  region: Region;
  conf: Confidence;
}

const defaults: GlobalFilters = {
  range: "30d",
  region: "all",
  conf: "80",
};

export function useGlobalFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: GlobalFilters = useMemo(() => {
    const r = searchParams.get("range") as TimeRange | null;
    const region = searchParams.get("region") as Region | null;
    const conf = searchParams.get("conf") as Confidence | null;
    return {
      range: r && ["7d", "14d", "30d", "all"].includes(r) ? r : defaults.range,
      region: region && ["all", "Western India", "Central India", "Eastern India"].includes(region) ? region : defaults.region,
      conf: conf && ["all", "80", "90"].includes(conf) ? conf : defaults.conf,
    };
  }, [searchParams]);

  const set = useCallback(
    (patch: Partial<GlobalFilters>) => {
      const next = new URLSearchParams(searchParams);
      const merged = { ...filters, ...patch };
      if (merged.range === defaults.range) next.delete("range");
      else next.set("range", merged.range);
      if (merged.region === defaults.region) next.delete("region");
      else next.set("region", merged.region);
      if (merged.conf === defaults.conf) next.delete("conf");
      else next.set("conf", merged.conf);
      setSearchParams(next, { replace: true });
    },
    [filters, searchParams, setSearchParams]
  );

  const refreshKey = searchParams.get("refresh") ?? "0";
  const refresh = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set("refresh", String(Date.now()));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { filters, set, refresh, refreshKey };
}
