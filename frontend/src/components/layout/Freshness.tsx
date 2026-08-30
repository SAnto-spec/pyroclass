import { useEffect, useState } from "react";

interface Props {
  source: "mock" | "api" | "unavailable";
  timestamp?: string | null;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function Freshness({ source, timestamp }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (source === "unavailable") {
    return <span className="text-[11px] text-[var(--text-faint)]">Data source unavailable</span>;
  }
  if (source === "mock") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-faint)]" aria-hidden="true" />
        Mock data · {timestamp ? fmt(timestamp) : "no timestamp"}
        <span className="hidden sm:inline text-[var(--text-faint)]">· local dataset</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
      Updated {timestamp ? fmt(timestamp) : "just now"}
    </span>
  );
}
