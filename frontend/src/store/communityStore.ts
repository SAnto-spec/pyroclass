import { create } from "zustand";
import type { CommunityReport, VerificationType } from "../types/community";
import {
  createCommunityReport,
  type CreateReportInput,
  getCommunityReports,
  getCommunityReportsSync,
  getCommunityReport,
  getCommunityReportSync,
  getLocalCommunityReports,
  verifyCommunityReport,
  getUserVerificationType,
  getIncidentGroundEvidence,
  getIncidentGroundEvidenceSync,
} from "../api/community";
import type { GroundEvidenceSummary } from "../types/community";

interface CommunityState {
  reports: CommunityReport[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  fetch: () => Promise<void>;
  addReport: (input: CreateReportInput) => Promise<{ ok: true; report: CommunityReport } | { ok: false; error: string; field?: string }>;
  verifyReport: (
    reportId: string,
    type: VerificationType,
    opts?: { note?: string }
  ) => Promise<{ ok: true; report: CommunityReport } | { ok: false; error: string }>;
  getUserVerification: (reportId: string) => VerificationType | null;
  hydrateFromLocal: () => void;
  // Service-backed selectors — UI should use these instead of importing mocks
  getReport: (id: string) => CommunityReport | null;
  getGroundEvidence: (hotspotId: string) => GroundEvidenceSummary | null;
  fetchReport: (id: string) => Promise<CommunityReport | null>;
  fetchGroundEvidence: (hotspotId: string) => Promise<GroundEvidenceSummary | null>;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  // Initialized from service (mock-backed for now) — UI does not import mocks directly
  reports: getCommunityReportsSync(),
  isLoading: false,
  error: null,
  initialized: true,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const reports = await getCommunityReports();
      set({ reports, initialized: true, isLoading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load reports", isLoading: false });
    }
  },

  hydrateFromLocal: () => {
    set({ reports: [...getLocalCommunityReports()] });
  },

  addReport: async (input: CreateReportInput) => {
    set({ isLoading: true, error: null });
    const res = await createCommunityReport(input);
    if (!res.ok) {
      set({ isLoading: false, error: res.error });
      return res;
    }
    // sync from local mock source so ordering & id counter stay consistent
    const reports = getLocalCommunityReports();
    set({ reports: [...reports], isLoading: false, error: null, initialized: true });
    return res;
  },

  verifyReport: async (reportId, type, opts) => {
    set({ isLoading: true, error: null });
    const res = await verifyCommunityReport(reportId, type, opts);
    if (!res.ok) {
      set({ isLoading: false, error: res.error });
      return res;
    }
    const reports = getLocalCommunityReports();
    set({ reports: [...reports], isLoading: false, error: null });
    return res;
  },

  getUserVerification: (reportId) => {
    return getUserVerificationType(reportId);
  },

  getReport: (id) => {
    return getCommunityReportSync(id);
  },

  getGroundEvidence: (hotspotId) => {
    return getIncidentGroundEvidenceSync(hotspotId);
  },

  fetchReport: async (id) => {
    return getCommunityReport(id);
  },

  fetchGroundEvidence: async (hotspotId) => {
    return getIncidentGroundEvidence(hotspotId);
  },
}));
