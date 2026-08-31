import { Menu, Search, Bell, Command, User } from "lucide-react";
import { useUiStore } from "../../store/uiStore";
import { Button } from "../ui/Button";

interface HeaderProps {
  title: string;
  onOpenPalette?: () => void;
  onOpenNotifications?: () => void;
  notificationsCount?: number;
}

export function Header({ title, onOpenPalette, onOpenNotifications, notificationsCount = 0 }: HeaderProps) {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <header className="flex h-[48px] shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
          className="lg:hidden border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)]"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-[13px] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[14px]">
            {title}
          </h1>
          <p className="hidden text-[11px] leading-none text-[var(--text-muted)] sm:block">
            VIIRS / SLSTR · Western India · Confidence ≥80%
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        {/* Command / Search */}
        <button
          type="button"
          aria-label="Search — open command palette (⌘K)"
          title="Search — ⌘K"
          onClick={onOpenPalette}
          className="hidden sm:flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] hover:bg-white transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs">Search…</span>
          <span className="ml-2 hidden items-center gap-1 rounded border border-[var(--border)] bg-white px-1 py-0.5 text-[10px] font-medium leading-none text-[var(--text-faint)] lg:inline-flex">
            <Command className="h-3 w-3" />
            <span>K</span>
          </span>
        </button>
        <button
          type="button"
          aria-label="Search — open command palette"
          onClick={onOpenPalette}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] sm:hidden"
          title="Search — ⌘K"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label={`Notifications — ${notificationsCount} active alerts`}
          aria-haspopup="dialog"
          aria-expanded={notificationsCount > 0 ? undefined : undefined}
          onClick={onOpenNotifications}
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] transition-colors"
          title={`${notificationsCount} active alerts`}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {notificationsCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--critical)] px-1 text-[10px] font-bold leading-none text-white" aria-live="polite">
              {notificationsCount > 99 ? "99+" : notificationsCount}
            </span>
          )}
        </button>

        <div className="hidden h-6 w-px bg-[var(--border)] sm:block" aria-hidden="true" />

        {/* Operator — light */}
        <div className="flex items-center gap-2.5">
          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium leading-none text-[var(--text-primary)]">Operator</div>
            <div className="text-[11px] leading-none text-[var(--text-muted)]">py-ops@pyroclass</div>
          </div>
          <button
            type="button"
            aria-label="User menu"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-white hover:border-[var(--border-strong)] transition-colors"
            title="User menu — coming soon"
          >
            <span className="hidden sm:inline">CF</span>
            <User className="h-4 w-4 sm:hidden" />
          </button>
        </div>
      </div>
    </header>
  );
}
