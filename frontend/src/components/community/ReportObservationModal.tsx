import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Clock3, ImagePlus, Loader2, MapPin, ShieldAlert, Trash2, X } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { Badge } from "../ui/Badge";
import type { ObservationType } from "../../types/community";
import type { CreateReportInput } from "../../api/community";
import { useCommunityStore } from "../../store/communityStore";
import { mockAnomalies } from "../../mocks/anomalies";

type Props = {
  open: boolean;
  onClose: () => void;
  initialLat: number | null;
  initialLng: number | null;
  initialHotspotId: string | null;
  onPickLocationRequest: () => void;
  pickingActive: boolean;
  onSubmitted?: (reportId: string) => void;
};

const OBSERVATION_OPTIONS: { value: ObservationType; label: string; hint: string }[] = [
  { value: "fire_visible", label: "Fire visible", hint: "Active flame at surface" },
  { value: "smoke_visible", label: "Smoke visible", hint: "Plume, haze, or residual smoke" },
  { value: "industrial_activity", label: "Industrial activity", hint: "Flare, stack, or operational heat" },
  { value: "agricultural_burning", label: "Agricultural burning", hint: "Field / residue burn" },
  { value: "no_fire_observed", label: "No fire observed", hint: "Visited, no evidence of fire" },
  { value: "fire_extinguished", label: "Fire extinguished", hint: "Recent burn, now inactive" },
  { value: "false_alarm", label: "False alarm", hint: "FIRMS false positive, non-fire heat" },
  { value: "unknown", label: "Unknown / unclear", hint: "Insufficient evidence" },
];

const STATUS_META: Record<ObservationType, { tone: string; note: string }> = {
  fire_visible: { tone: "Corroborating — supports FIRMS detection", note: "Counts toward corroborating evidence" },
  smoke_visible: { tone: "Corroborating — supports thermal anomaly", note: "Aligns with smoke/heat signature" },
  industrial_activity: { tone: "Corroborating — consistent with industrial source", note: "Supports industrial attribution" },
  agricultural_burning: { tone: "Contextual — land-use evidence", note: "Helps separate ag burn from industrial" },
  no_fire_observed: { tone: "Disputing — no evidence on ground", note: "Counts toward disputing evidence" },
  fire_extinguished: { tone: "Disputing — no longer active", note: "Temporal mismatch with detection" },
  false_alarm: { tone: "Disputing — likely false positive", note: "Challenges FIRMS classification" },
  unknown: { tone: "Neutral — insufficient evidence", note: "No corroborate/dispute weight" },
};

function formatIsoLocalForInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoFromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type PhotoItem = { file: File; url: string; id: string };

function validateDraft(draft: {
  observationType: ObservationType | "";
  latText: string;
  lngText: string;
  description: string;
  observedAtLocal: string;
  photos: PhotoItem[];
}): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!draft.observationType) errs.observationType = "Select observation type";
  const lat = Number(draft.latText);
  const lng = Number(draft.lngText);
  if (draft.latText.trim() === "" || !Number.isFinite(lat) || lat < -90 || lat > 90) errs.latitude = "Latitude -90 to 90";
  if (draft.lngText.trim() === "" || !Number.isFinite(lng) || lng < -180 || lng > 180) errs.longitude = "Longitude -180 to 180";
  if (!draft.description.trim() || draft.description.trim().length < 10) errs.description = "At least 10 characters";
  if (draft.description.trim().length > 600) errs.description = "Max 600 characters";
  if (!draft.observedAtLocal) errs.observedAt = "Observed time required";
  else {
    const iso = toIsoFromLocalInput(draft.observedAtLocal);
    if (!iso) errs.observedAt = "Invalid date/time";
    else if (new Date(iso).getTime() > Date.now() + 60_000) errs.observedAt = "Cannot be in the future";
  }
  if (draft.photos.length > 3) errs.media = "Maximum 3 photos";
  for (const p of draft.photos) {
    if (p.file.size > 10 * 1024 * 1024) {
      errs.media = `"${p.file.name}" exceeds 10 MB`;
      break;
    }
    if (!p.file.type.startsWith("image/")) {
      errs.media = `"${p.file.name}" is not an image`;
      break;
    }
  }
  return errs;
}

export function ReportObservationModal({ open, onClose, initialLat, initialLng, initialHotspotId, onPickLocationRequest, pickingActive, onSubmitted }: Props) {

  const [observationType, setObservationType] = useState<ObservationType | "">("");
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [hotspotId, setHotspotId] = useState<string | null>(initialHotspotId);
  const [description, setDescription] = useState("");
  const [observedAtLocal, setObservedAtLocal] = useState(() => formatIsoLocalForInput(new Date().toISOString()));
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [step, setStep] = useState<"form" | "preview">("form");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // hydrate from map when modal opens
  useEffect(() => {
    if (!open) return;
    if (initialLat != null) setLatText(initialLat.toFixed(5));
    if (initialLng != null) setLngText(initialLng.toFixed(5));
    setHotspotId(initialHotspotId);
  }, [open, initialLat, initialLng, initialHotspotId]);

  // keep lat/lng in sync if user picks new location while open
  useEffect(() => {
    if (!open) return;
    if (initialLat == null || initialLng == null) return;
    // While picking, parent updates initial coords on each map click; adopt immediately
    // Respects manual edits only when not in picking flow — picking coords always win
    setLatText(initialLat.toFixed(5));
    setLngText(initialLng.toFixed(5));
    if (initialHotspotId !== undefined) setHotspotId(initialHotspotId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLng, initialHotspotId, open, pickingActive]);

  const linkedAnomaly = useMemo(() => (hotspotId ? mockAnomalies.find((a) => a.id === hotspotId) ?? null : null), [hotspotId]);

  const handleClose = () => {
    if (submitting) return;
    // revoke object URLs to free memory
    for (const p of photos) URL.revokeObjectURL(p.url);
    setObservationType("");
    setLatText(initialLat != null ? initialLat.toFixed(5) : "");
    setLngText(initialLng != null ? initialLng.toFixed(5) : "");
    setHotspotId(initialHotspotId);
    setDescription("");
    setObservedAtLocal(formatIsoLocalForInput(new Date().toISOString()));
    setPhotos([]);
    setStep("form");
    setSuccessId(null);
    setFieldErrors({});
    setSubmitError(null);
    setUploadProgress(0);
    setSubmitting(false);
    onClose();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const next: PhotoItem[] = [];
    for (const f of incoming) {
      if (photos.length + next.length >= 3) break;
      next.push({ file: f, url: URL.createObjectURL(f), id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (id: string) => {
    const found = photos.find((p) => p.id === id);
    if (found) URL.revokeObjectURL(found.url);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePreview = () => {
    const errs = validateDraft({ observationType, latText, lngText, description, observedAtLocal, photos });
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitError(null);
    setStep("preview");
  };

  const handleSubmit = async () => {
    const errs = validateDraft({ observationType, latText, lngText, description, observedAtLocal, photos });
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setStep("form");
      return;
    }
    const lat = Number(latText);
    const lng = Number(lngText);
    const observedIso = toIsoFromLocalInput(observedAtLocal)!;

    setSubmitting(true);
    setSubmitError(null);
    setUploadProgress(8);

    // simulate staged upload progress (mock)
    const timers: number[] = [];
    const progSteps = [18, 38, 62, 84];
    progSteps.forEach((v, i) => {
      const t = window.setTimeout(() => setUploadProgress(v), 120 * (i + 1));
      timers.push(t);
    });

    const input: CreateReportInput = {
      hotspotId,
      h3Cell: null,
      latitude: lat,
      longitude: lng,
      observationType: observationType as ObservationType,
      description,
      observedAt: observedIso,
      mediaFiles: photos.map((p) => p.file),
    };

    try {
      const res = await useCommunityStore.getState().addReport(input);
      for (const t of timers) window.clearTimeout(t);
      setUploadProgress(100);
      if (!res.ok) {
        setSubmitting(false);
        setSubmitError(res.error);
        if (res.field) setFieldErrors((prev) => ({ ...prev, [res.field!]: res.error }));
        setStep("form");
        return;
      }
      setSuccessId(res.report.id);
      // small delay to show 100% before success state
      setTimeout(() => setSubmitting(false), 250);
    } catch (e) {
      for (const t of timers) window.clearTimeout(t);
      setSubmitting(false);
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
      setStep("form");
    }
  };

  const hotspotOptions = useMemo(() => mockAnomalies.slice(0, 12), []);

  if (!open) return null;

  const meta = observationType ? STATUS_META[observationType as ObservationType] : null;
  const disableSubmit = submitting;

  return (
    <Modal open={open} onClose={handleClose} title="Report Ground Observation" width="max-w-[640px]">
      {/* Success state */}
      {successId ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-weak)] px-3 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white">
              <Check className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--success-text)]">Observation submitted</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                Report <span className="font-mono font-medium text-[var(--text-primary)]">{successId}</span> added to ground verification. It appears on the map immediately (mock). Replace with <span className="font-mono text-[11px]">POST /reports</span> when backend is ready.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="success">credibility {(() => { const r = useCommunityStore.getState().reports.find((x) => x.id === successId); return r ? `${Math.round(r.credibilityScore * 100)}%` : "—"; })()}</Badge>
                {hotspotId ? <Badge variant="info">{hotspotId} linked</Badge> : <Badge variant="secondary">unlinked — candidate source</Badge>}
                <Badge variant="default">{observationType.replace("_", " ")}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const id = successId;
                handleClose();
                if (id) onSubmitted?.(id);
              }}
            >
              View on map
            </Button>
          </div>
        </div>
      ) : step === "preview" ? (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
            <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-muted)]">PREVIEW — VERIFY BEFORE SUBMIT</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">Operational review: check location, type, time, and photos. AI confidence and ground credibility remain separate concepts.</p>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
            <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-[var(--border)] text-[12px]">
              <div className="px-3 py-2.5">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">OBSERVATION TYPE</p>
                <p className="mt-1 font-medium text-[var(--text-primary)]">{OBSERVATION_OPTIONS.find((o) => o.value === observationType)?.label}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{meta?.tone}</p>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">OBSERVED AT</p>
                <p className="mt-1 flex items-center gap-1 font-medium tabular-nums text-[var(--text-primary)]">
                  <Clock3 className="h-3 w-3 text-[var(--text-faint)]" /> {new Date(toIsoFromLocalInput(observedAtLocal)!).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">Submitted now · local time</p>
              </div>
              <div className="px-3 py-2.5 col-span-2">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">LOCATION (WGS84)</p>
                <p className="mt-1 flex items-center gap-1 font-mono text-[12px] font-medium tabular-nums text-[var(--text-primary)]">
                  <MapPin className="h-3 w-3 text-[var(--text-faint)]" /> {Number(latText).toFixed(5)}°, {Number(lngText).toFixed(5)}°
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {hotspotId ? (
                    <>
                      Linked to <span className="font-medium text-[var(--text-primary)]">{hotspotId}</span> {linkedAnomaly ? `· ${linkedAnomaly.classification.replace("_", " ")} · ${linkedAnomaly.confidence}% AI confidence` : ""} · {(() => { const la = linkedAnomaly; if (!la) return ""; const d = Math.round(((Math.abs(Number(latText)-la.latitude)+Math.abs(Number(lngText)-la.longitude))*111*100)/100); return `${d} km approx`; })()}
                    </>
                  ) : (
                    "Unlinked — candidate new thermal source"
                  )}
                </p>
              </div>
              <div className="px-3 py-2.5 col-span-2">
                <p className="text-[10px] tracking-[0.04em] text-[var(--text-faint)]">DESCRIPTION</p>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
              </div>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
                  <img src={p.url} alt={p.file.name} className="h-[96px] w-full object-cover" />
                  <p className="truncate px-2 py-1 text-[10px] text-[var(--text-muted)]">{p.file.name}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
            <span>
              Distinct scoring: AI confidence ≠ anomaly severity ≠ credibility ({(() => { const prox = hotspotId && linkedAnomaly ? Math.abs(Number(latText)-linkedAnomaly.latitude) : null; void prox; return "per-report 0–1"; })()}) ≠ ground consensus. This preview shows ground evidence only.
            </span>
          </div>

          {submitError && (
            <div className="rounded-[var(--radius-md)] border border-[var(--critical-border)] bg-[var(--critical-weak)] px-3 py-2 text-[12px] text-[var(--critical-text)]">{submitError}</div>
          )}

          {submitting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading {photos.length ? `${photos.length} photo(s)` : "report"}… {uploadProgress}%
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div className="h-full bg-[var(--accent)] transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-[11px] text-[var(--text-faint)]">Simulated local upload via object URLs — no cloud storage (prototype).</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <Button variant="secondary" onClick={() => setStep("form")} disabled={submitting}>
              Back to edit
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={disableSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                "Confirm & submit"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Observation type */}
          <div>
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Observation type *</label>
            <Select value={observationType} onChange={(e) => setObservationType(e.target.value as ObservationType)} className={fieldErrors.observationType ? "border-[var(--critical-border)]" : ""}>
              <option value="">Select type…</option>
              {OBSERVATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.hint}
                </option>
              ))}
            </Select>
            {fieldErrors.observationType && <p className="mt-1 text-[11px] text-[var(--critical-text)]">{fieldErrors.observationType}</p>}
            {meta && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{meta.tone} · {meta.note}</p>}
          </div>

          {/* Location */}
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">Location (WGS84) *</p>
              <Badge variant={pickingActive ? "accent" : "secondary"} className="gap-1">
                <MapPin className="h-3 w-3" /> {pickingActive ? "Click map to set" : "Map-linked"}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">Prefer map click or center. Do not create a second map — reuse current map instance.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-faint)]">LATITUDE</label>
                <Input value={latText} onChange={(e) => setLatText(e.target.value)} placeholder="19.07600" inputMode="decimal" className={fieldErrors.latitude ? "border-[var(--critical-border)]" : ""} />
                {fieldErrors.latitude && <p className="mt-1 text-[11px] text-[var(--critical-text)]">{fieldErrors.latitude}</p>}
              </div>
              <div>
                <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-faint)]">LONGITUDE</label>
                <Input value={lngText} onChange={(e) => setLngText(e.target.value)} placeholder="72.87700" inputMode="decimal" className={fieldErrors.longitude ? "border-[var(--critical-border)]" : ""} />
                {fieldErrors.longitude && <p className="mt-1 text-[11px] text-[var(--critical-text)]">{fieldErrors.longitude}</p>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onPickLocationRequest}>
                <MapPin className="h-3 w-3" /> {pickingActive ? "Picking… click map" : "Pick on map"}
              </Button>
              <span className="self-center text-[11px] text-[var(--text-faint)]">or click map directly when picking</span>
            </div>
            <div className="mt-2">
              <label className="text-[10px] font-medium tracking-[0.04em] text-[var(--text-faint)]">LINKED FIRMS INCIDENT (optional)</label>
              <Select value={hotspotId ?? ""} onChange={(e) => setHotspotId(e.target.value || null)}>
                <option value="">Unlinked — candidate new source</option>
                {hotspotOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.classification.replace("_", " ")} · {a.region}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Links appearance on map to existing FIRMS/AI incidents (dashed connector when mapped).</p>
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Photos — 1 to 3 (optional for prototype, 1 recommended)</label>
            <div
              className={`mt-1 rounded-[var(--radius-md)] border-2 border-dashed bg-[var(--surface-subtle)] px-3 py-4 text-center ${fieldErrors.media ? "border-[var(--critical-border)] bg-[var(--critical-weak)]" : "border-[var(--border)]"}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
            >
              <ImagePlus className="mx-auto h-5 w-5 text-[var(--text-faint)]" />
              <p className="mt-1 text-[12px] font-medium text-[var(--text-primary)]">Drop photos or click to browse</p>
              <p className="text-[11px] text-[var(--text-muted)]">PNG, JPG, WEBP · max 10 MB each · 3 max · simulated via object URLs</p>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                <Camera className="h-3 w-3" /> Browse
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </div>
            {fieldErrors.media && <p className="mt-1 text-[11px] text-[var(--critical-text)]">{fieldErrors.media}</p>}
            {photos.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="group relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
                    <img src={p.url} alt={p.file.name} className="h-[92px] w-full object-cover" />
                    <div className="flex items-center justify-between gap-1 px-2 py-1">
                      <span className="min-w-0 truncate text-[10px] text-[var(--text-muted)]">{p.file.name}</span>
                      <button type="button" onClick={() => removePhoto(p.id)} className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--text-faint)] hover:bg-[var(--surface-subtle)] hover:text-[var(--critical-text)]" aria-label={`Remove ${p.file.name}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-[var(--text-faint)]">{photos.length}/3 photos · object URLs, revoked on close.</p>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Description *</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you observe? Include context, distance to incident, weather, operational notes…"
              rows={3}
              maxLength={600}
              className={fieldErrors.description ? "border-[var(--critical-border)]" : ""}
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-faint)]">{fieldErrors.description ? <span className="text-[var(--critical-text)]">{fieldErrors.description}</span> : `${description.trim().length}/600 · at least 10 characters`}</span>
              <span className="text-[11px] tabular-nums text-[var(--text-faint)]">{600 - description.length} left</span>
            </div>
          </div>

          {/* Observed at */}
          <div>
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Observed at (local) *</label>
            <Input type="datetime-local" value={observedAtLocal} onChange={(e) => setObservedAtLocal(e.target.value)} className={fieldErrors.observedAt ? "border-[var(--critical-border)]" : ""} />
            {fieldErrors.observedAt ? <p className="mt-1 text-[11px] text-[var(--critical-text)]">{fieldErrors.observedAt}</p> : <p className="mt-1 text-[11px] text-[var(--text-muted)]">When on the ground (not submitted time). Future times blocked.</p>}
          </div>

          {submitError && <div className="rounded-[var(--radius-md)] border border-[var(--critical-border)] bg-[var(--critical-weak)] px-3 py-2 text-[12px] text-[var(--critical-text)]">{submitError}</div>}

          {submitting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading… {uploadProgress}%
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
                <div className="h-full bg-[var(--accent)] transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={handlePreview} disabled={submitting}>
                Preview
              </Button>
              <Button type="button" variant="primary" onClick={handlePreview} disabled={submitting}>
                Preview & submit
              </Button>
            </div>
          </div>
          <p className="text-center text-[11px] leading-relaxed text-[var(--text-faint)]">Structured for <span className="font-mono">POST /reports</span> (multipart) — mock adds to local state; no cloud storage in prototype.</p>
        </div>
      )}
    </Modal>
  );
}
