import { create } from "zustand";
import { load, save } from "../lib/storage";

export interface SavedView {
  id: string;
  name: string;
  search: string; // full search string including ? e.g. "?range=7d&severity=high"
  createdAt: string;
}

const KEY = "pyro:savedViews";

function read(): SavedView[] {
  return load<SavedView[]>(KEY, []);
}

interface SavedViewsState {
  views: SavedView[];
  add: (name: string, search: string) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

export const useSavedViewsStore = create<SavedViewsState>((set, get) => ({
  views: typeof window !== "undefined" ? read() : [],
  add: (name, search) => {
    const v: SavedView = { id: `sv-${Date.now()}`, name: name.trim() || "Untitled view", search, createdAt: new Date().toISOString() };
    const next = [v, ...get().views];
    save(KEY, next);
    set({ views: next });
  },
  remove: (id) => {
    const next = get().views.filter((v) => v.id !== id);
    save(KEY, next);
    set({ views: next });
  },
  rename: (id, name) => {
    const next = get().views.map((v) => (v.id === id ? { ...v, name: name.trim() || v.name } : v));
    save(KEY, next);
    set({ views: next });
  },
}));

if (typeof window !== "undefined") {
  useSavedViewsStore.setState({ views: read() });
}
