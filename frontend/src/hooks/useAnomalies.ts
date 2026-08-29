import { useQuery } from "@tanstack/react-query";
import { getAnomalies } from "../api/anomalies";

export function useAnomalies() {
  return useQuery({
    queryKey: ["anomalies"],
    queryFn: getAnomalies,
  });
}
