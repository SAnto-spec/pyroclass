import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAlerts, acknowledgeAlert, resolveAlert, escalateAlert } from "../api/alerts";

export function useAlerts() {
  return useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts, staleTime: 30000 });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => resolveAlert(id, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useEscalateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => escalateAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
