import { useLocation, useNavigate } from "react-router-dom";
import { Bookmark, Trash2, Edit2, Save } from "lucide-react";
import { useSavedViewsStore } from "../../store/savedViewsStore";

export function SavedViewsBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { views, add, remove, rename } = useSavedViewsStore();

  const currentSearch = location.search;

  const handleSave = () => {
    const defaultName = `View ${views.length + 1}`;
    const name = window.prompt("Name this view", defaultName);
    if (name == null) return;
    if (!name.trim()) return;
    add(name.trim(), currentSearch);
  };

  const handleOpen = (search: string) => {
    navigate(`${location.pathname}${search}`);
  };

  const handleRename = (id: string, old: string) => {
    const name = window.prompt("Rename view", old);
    if (name == null) return;
    rename(id, name);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
        <Bookmark className="h-3 w-3" /> Saved views
      </span>
      <span className="hidden sm:inline h-4 w-px bg-[var(--border)]" aria-hidden="true" />
      <button
        type="button"
        onClick={handleSave}
        className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
      >
        <Save className="h-3 w-3" /> Save current
      </button>

      {views.length === 0 ? (
        <span className="text-[11px] text-[var(--text-faint)]">No saved views yet — filters are URL-synced.</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {views.map((v) => (
            <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] pl-2 pr-1 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
              <button type="button" onClick={() => handleOpen(v.search)} className="hover:text-[var(--text-primary)] hover:underline">
                {v.name}
              </button>
              <button type="button" onClick={() => handleRename(v.id, v.name)} aria-label={`Rename ${v.name}`} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-faint)] hover:bg-white">
                <Edit2 className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => remove(v.id)} aria-label={`Delete ${v.name}`} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-faint)] hover:bg-white hover:text-[var(--critical-text)]">
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <span className="ml-auto hidden sm:inline text-[10px] text-[var(--text-faint)]">
        Stores {views.length} views locally · {currentSearch || "no filters"}
      </span>
    </div>
  );
}
