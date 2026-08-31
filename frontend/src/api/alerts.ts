import type { Alert, AlertSeverity, AlertStatus } from "../types/alert";

// API abstraction — no backend endpoint yet (only /hotspots exists).
// The backend does not provide /alerts, so the feed is empty rather than
// fabricated. When backend adds /alerts, replace these fns with apiClient
// calls without changing UI.
// All mutations are local with explicit pending/success/error wrapper.

export type AlertMutationResult = { ok: true } | { ok: false; error: string };

export async function fetchAlerts(): Promise<Alert[]> {
  // Future: return (await apiClient.get<Alert[]>("/alerts")).data
  return [];
}

// Local state container — components should use useAlerts() hook instead of calling this directly
let localAlerts: Alert[] = [];

export function getLocalAlerts(): Alert[] {
  return localAlerts;
}

export async function acknowledgeAlert(id: string): Promise<AlertMutationResult> {
  await new Promise((r) => setTimeout(r, 300)); // simulate latency
  const found = localAlerts.find((a) => a.id === id);
  if (!found) return { ok: false, error: "Alert not found" };
  localAlerts = localAlerts.map((a) => (a.id === id ? { ...a, status: "acknowledged" as AlertStatus } : a));
  return { ok: true };
}

export async function resolveAlert(id: string, note: string): Promise<AlertMutationResult> {
  if (!note.trim()) return { ok: false, error: "Resolution note required" };
  await new Promise((r) => setTimeout(r, 400));
  const found = localAlerts.find((a) => a.id === id);
  if (!found) return { ok: false, error: "Alert not found" };
  localAlerts = localAlerts.map((a) => (a.id === id ? { ...a, status: "resolved" as AlertStatus } : a));
  return { ok: true };
}

export async function escalateAlert(id: string): Promise<AlertMutationResult> {
  await new Promise((r) => setTimeout(r, 300));
  const found = localAlerts.find((a) => a.id === id);
  if (!found) return { ok: false, error: "Alert not found" };
  if (found.severity === "critical") return { ok: false, error: "Already critical" };
  const next: AlertSeverity = found.severity === "low" ? "medium" : found.severity === "medium" ? "high" : "critical";
  localAlerts = localAlerts.map((a) => (a.id === id ? { ...a, severity: next } : a));
  return { ok: true };
}
