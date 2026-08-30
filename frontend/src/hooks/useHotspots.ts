import { useQuery } from "@tanstack/react-query";
import { fetchHotspots } from "../api/hotspots";

export function useHotspots() {
  return useQuery({ queryKey: ["hotspots"], queryFn: fetchHotspots, staleTime: 30000, retry: 1 });
}
