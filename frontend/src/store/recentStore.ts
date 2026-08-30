import { create } from "zustand";
import { load, save } from "../lib/storage";

const KEY_ANOMALY = "pyro:recent:anomalies";
const KEY_FACILITY = "pyro:recent:facilities";
const KEY_ALERT = "pyro:recent:alerts";
const MAX = 8;

function read(key: string): string[] {
  return load<string[]>(key, []);
}

function push(key: string, id: string) {
  const cur = read(key).filter((x) => x !== id);
  cur.unshift(id);
  if (cur.length > MAX) cur.pop();
  save(key, cur);
  return cur;
}

interface RecentState {
  anomalies: string[];
  facilities: string[];
  alerts: string[];
  pushAnomaly: (id: string) => void;
  pushFacility: (id: string) => void;
  pushAlert: (id: string) => void;
}

export const useRecentStore = create<RecentState>((set) => ({
  anomalies: typeof window !== "undefined" ? read(KEY_ANOMALY) : [],
  facilities: typeof window !== "undefined" ? read(KEY_FACILITY) : [],
  alerts: typeof window !== "undefined" ? read(KEY_ALERT) : [],
  pushAnomaly: (id) => set({ anomalies: push(KEY_ANOMALY, id) }),
  pushFacility: (id) => set({ facilities: push(KEY_FACILITY, id) }),
  pushAlert: (id) => set({ alerts: push(KEY_ALERT, id) }),
}));
