import { useQuery } from "@tanstack/react-query";
import { fetchFacilities } from "../api/facilities";

export function useFacilities() {
  return useQuery({ queryKey: ["facilities"], queryFn: fetchFacilities, staleTime: 60000 });
}
