import { Map as MapIcon, Layers } from "lucide-react";

export function MapContainer() {
  return (
    <section
      role="region"
      aria-label="Map placeholder"
      className="flex h-[360px] flex-col overflow-hidden rounded-md border border-dashed border-slate-700 bg-slate-900 sm:h-[420px] lg:h-[480px]"
    >
      {/* Top bar – mimics future map controls */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-800 text-slate-400">
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="text-xs font-medium text-slate-300">
            Geospatial View
          </span>
          <span className="hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:inline">
            Mock extent
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-500 sm:inline-flex">
            <Layers className="h-3 w-3" aria-hidden="true" /> Layers
          </span>
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="text-[11px] text-slate-500">Live</span>
        </div>
      </div>

      {/* Placeholder body */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_center,theme(colors.slate.800)_1px,transparent_1px)] bg-[length:20px_20px] px-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-400">
          <MapIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-sm font-semibold text-slate-100">
          Interactive Geospatial Map
        </h2>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
          MapLibre / Deck.gl will be integrated here
        </p>
        <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-slate-500">
          Placeholder preserves layout for future map layer · No mock geometry
          rendered
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400">
            Center: 19.07°N 72.87°E
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400">
            Zoom: 6.2
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400">
            VIIRS
          </span>
        </div>
      </div>

      {/* Bottom attribution bar */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-3 py-1.5">
        <span className="text-[10px] tracking-wide text-slate-500">
          © OpenStreetMap · Satellite detections do not imply verification
        </span>
        <span className="hidden text-[10px] text-slate-600 sm:inline">
          1,284 anomalies in viewport
        </span>
      </div>
    </section>
  );
}
