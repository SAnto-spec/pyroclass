import { create } from "zustand";
import { load, save } from "../lib/storage";

const KEY = "pyro:watchlist";

interface WatchlistState {
  ids: string[]; // facility IDs
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  isWatched: (id: string) => boolean;
}

function read(): string[] {
  return load<string[]>(KEY, []);
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  ids: typeof window !== "undefined" ? read() : [],
  add: (id) =>
    set((s) => {
      if (s.ids.includes(id)) return s;
      const next = [...s.ids, id];
      save(KEY, next);
      return { ids: next };
    }),
  remove: (id) =>
    set((s) => {
      const next = s.ids.filter((x) => x !== id);
      save(KEY, next);
      return { ids: next };
    }),
  toggle: (id) => {
    const { ids, add, remove } = get();
    if (ids.includes(id)) remove(id);
    else add(id);
  },
  isWatched: (id) => get().ids.includes(id),
}));

// hydrate on load
if (typeof window !== "undefined") {
  const ids = read();
  useWatchlistStore.setState({ ids });
}
