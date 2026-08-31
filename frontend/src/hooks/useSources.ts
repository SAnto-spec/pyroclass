import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "../api/sources";

export function useSources() {
  return useQuery({ queryKey: ["sources"], queryFn: fetchSources, staleTime: 60000 });
}
