# PyroClass — Spatial Analytics Module

**Owner:** Dilpreet — Spatial Analytics Engineer
**Role scope:** Feature engineering, H3 baselines, anomaly & risk scoring, crowdsource (SmokeSignal) integration

This document explains what this module does, what it expects as input,
what it produces, and what's still open — so anyone on the team can pick
it up without re-reading the whole conversation history that produced it.

---

## 1. Where this fits in the pipeline

```
John (FIRMS cleaning + H3 assignment + OSM enrichment/validation)
        │
        ▼
pyroclass_20_sites_geospatial_final.csv   <-- INPUT to this module
        │
        ▼
risk_scoring.py  (this module)
        │
        ▼
pyroclass_20_sites_risk_scored.csv / .json   <-- OUTPUT
        │
        ├──► Armaan (XGBoost model input / benchmark)
        └──► Chris (frontend map, facility report cards, risk badges)
```

This module does **not** re-derive H3 cells, spike_score, or OSM context —
those are John's outputs and are used as-is. This module's job is to
combine them into a final, explainable risk score, and to add the
features John's pipeline doesn't cover (trend, tier, crowdsource,
probability breakdown).

---

## 2. Input contract

**File:** `pyroclass_20_sites_geospatial_final.csv` (20 hand-picked
prototype sites, labeled by `case_type`: `persistent` / `spike` /
`vegetation_comparison`)

Required columns this module reads:

| Column | Meaning |
|---|---|
| `case_id`, `case_type` | Site identifier and ground-truth label (label is for validation only, never used as a model input) |
| `mean_frp`, `max_frp` | Historical Fire Radiative Power stats |
| `spike_score` | John's validated ratio-based anomaly metric (`cur_monthly / base_monthly`, refined) — **not recomputed here, used as-is** |
| `2022`, `2023`, `2024` | Yearly detection counts — used for the trend feature |
| `context_type` | OSM-interpreted context: `mining_quarry` / `unknown` / etc. **`unknown` means missing/uncertain evidence, not "confirmed non-industrial."** |
| `context_confidence` | Confidence in `context_type` |
| `industrial_context_score`, `mining_context_score` | Weighted OSM context scores |
| `industrial_polygon_overlap_osm`, `mining_polygon_overlap` | Independent binary signals — "does the hotspot sit inside an OSM industrial/mining polygon," kept separate from `context_type` per team decision (these answer different questions) |
| `nearest_industrial_distance_m`, `nearest_mining_distance_m` | Facility proximity — **currently empty for all 20 rows in the file we have; flagged to the team, code is written to use them once populated** |

**Schema note:** we use only the *newer* OSM validation-stage columns
(above). The older `osm_enrichment.py`-only columns
(`nearest_facility_distance_m`, `industrial_context_level`, etc.) are
superseded — don't mix them in. This was a deliberate team decision
after finding the two OSM scripts' outputs disagreed on ~5 sites; see
the git history / team chat for the full investigation if curious.

---

## 3. What this module computes (feature-by-feature)

### 3.1 Base risk score (`base_risk_score`, 0–100)
A weighted composite of:
- `spike_score` (35% base weight)
- FRP intensity, normalized (20% base weight)
- OSM context score (20%) — **only applied when `context_type != 'unknown'`**
- Polygon overlap (10%) — binary, contributes regardless of context confidence
- Facility proximity (15%) — only when distance data is available

**Key rule:** when context or proximity data is missing for a row, that
weight is redistributed proportionally back into spike_score + FRP,
rather than penalizing the row for having less data. An `unknown`-context
site is not scored as if "unknown" means "safe."

### 3.2 Year-over-year trend (`trend_ratio`, `trend_label`)
`2024_count / average(2022_count, 2023_count)`. Labeled `increasing`
(>1.15) / `stable` (0.85–1.15) / `decreasing` (<0.85) /
`insufficient_data` (no early-year activity to compare against).
This is a **different signal than `spike_score`** — spike_score catches
a sudden monthly jump; trend catches a slow multi-year ramp that no
single month would flag as anomalous.

### 3.3 Crowdsource corroboration (`corroboration_score`, `risk_score`)
**Mocked for this prototype** — see `MOCK_CROWDSOURCE_REPORTS` in the
code, hardcoded confirmations for 3 example case IDs (`CASE_14`,
`CASE_11`, `CASE_02`) to demonstrate the mechanism. In production this
comes from the SmokeSignal app (nearby users confirming a hotspot via
GPS + optional photo).
- Confirmations boost `risk_score` up to +15 points on top of
  `base_risk_score`, weighted by number of confirmations, user trust,
  and inversely by distance.
- **Zero reports never lowers the score.** Absence of a report from a
  remote/unpopulated site is not evidence the hotspot is fake.
- `risk_score` (used everywhere downstream) = `base_risk_score` +
  corroboration boost. `base_risk_score` is kept in the output too, so
  you can see the "before crowdsourcing" number separately if needed.

**⚠️ When presenting/demoing:** be explicit that these specific 3
confirmations are simulated data for demonstration, not real user
reports — say so directly if asked.

### 3.4 Risk tier (`risk_tier`)
Simple bucket for the frontend: `Critical` (≥80) / `High` (≥60) /
`Medium` (≥40) / `Low` (<40). Meant for badge/color rendering — use
`risk_score` directly for anything needing the actual number (sorting,
charts).

### 3.5 Probability breakdown (`probability_breakdown`)
A dict per site: `{escalating, persistent_industrial, unclassified}`,
summing to 1.0. A heuristic derived from the spike and context
components — **not a trained model.** This is a transparent stand-in;
Armaan's XGBoost classifier is the eventual real version of this output,
and can be benchmarked against this heuristic.

### 3.6 Explainability (`explainability`)
A human-readable dict per site, combining all of the above into "why
this score" — required for the problem statement's explainability
requirement. Includes spike_score, trend, context (or a note that
context is missing/uncertain), polygon overlap, proximity (or a note
that it's pending), and the crowdsource note.

---

## 4. Output files

- `pyroclass_20_sites_risk_scored.csv` — all original input columns +
  every feature above. `explainability` and `probability_breakdown`
  appear as **stringified dicts** in this format (fine for spreadsheet
  viewing / model input, not ideal for direct parsing).
- `pyroclass_20_sites_risk_scored.json` — same data, but nested fields
  are **real JSON objects**, not strings. **Chris's frontend should
  consume this file, not the CSV.**

---

## 5. Known limitations / open items (as of this version)

| Item | Status |
|---|---|
| Facility proximity (`nearest_*_distance_m`) | Columns exist but are empty for all 20 rows — flagged to team, code ready to use them once populated |
| Diurnal / flare-vs-fire steadiness feature | Not built — needs hour-of-day (`acq_time`) detail not present in the current aggregated CSVs |
| Generalizing beyond the 20 prototype sites | Not done — `spike_score` and this module's features currently only run on the hand-picked 20-case dataset. Turning this into a live pipeline for arbitrary new hotspots is future work, intentionally out of scope for this internal prototype |
| Crowdsource data | Fully mocked (3 hardcoded example cases) — no real SmokeSignal app/backend yet |
| Weights (0.35/0.20/0.20/0.10/0.15 base; +15pt corroboration boost) | Project-defined heuristics, not tuned/validated against a larger dataset — revisit once more data or labeled ground truth is available |

---

## 6. How to run

```bash
pip install pandas numpy
python3 risk_scoring.py
```

Edit `INPUT_PATH` at the bottom of the script to point at your local
copy of `pyroclass_20_sites_geospatial_final.csv` first.

Produces console output (sorted risk table + two explainability
examples) plus the two output files listed above, in the directory
you ran the script from.
