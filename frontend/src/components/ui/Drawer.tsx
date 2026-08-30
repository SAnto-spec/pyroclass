import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  width?: string;
}

export function Drawer({ open, onClose, title, description, children, side = "right", width = "w-[420px]" }: DrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={title ?? "Drawer"}>
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-[#0f172a]/20 backdrop-blur-[1px]"
      />
      <div
        className={`relative ml-auto flex h-full max-w-[min(100vw,420px)] flex-col bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] border-l border-[var(--border)] ${width} ${side === "left" ? "mr-auto ml-0 border-l-0 border-r" : ""}`}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div className="min-w-0">
              {title && <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
