import { useQuery } from "@tanstack/react-query";
import { getArmaanAssessment } from "../api/armaan";

export function useArmaanAssessment(hotspotId: number | null | undefined) {
  return useQuery({
    queryKey: ["armaan-assessment", hotspotId],
    queryFn: () => getArmaanAssessment(Number(hotspotId)),
    enabled: hotspotId !== null && hotspotId !== undefined && Number.isFinite(Number(hotspotId)),
    staleTime: 300000,
    retry: 1,
  });
}
