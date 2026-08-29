# SIH26162 PyroClass — Machine Learning Engineer Role Baseline & Execution Blueprint

**Document status:** Canonical ML role baseline for implementation and AI-assisted coding
**Project:** SIH26162 — PyroClass
**Role:** Machine Learning Engineer
**Prototype geography:** India only
**Primary model:** XGBoost multi-class classifier
**Explainability:** SHAP TreeExplainer
**Training environment:** Google Colab
**Inference environment:** FastAPI backend (project repository)
**Source of truth:** `Reference/ProjectSummary.md` (project canonical baseline)

> **CRITICAL:** This document is derived from the project's canonical baseline. Future coding agents must treat the sections titled **PROJECT REQUIREMENT**, **IMPLEMENTATION REQUIREMENT**, **RECOMMENDATION**, and **OPEN DECISION** as constraints with their respective binding levels. Do not silently replace the architecture, taxonomy, or feature engineering strategy.

---

# Table of Contentsd


1. [Role Definition and Scope](#1-role-definition-and-scope)
2. [Core Problem Statement](#2-core-problem-statement)
3. [Classification Taxonomy](#3-classification-taxonomy)
4. [Dataset Context](#4-dataset-context)
5. [FIRMS `type` vs PyroClass Target Label](#5-firms-type-vs-pyroclass-target-label)
6. [Training Data vs Validation/Test Data vs 20-Point Prototype](#6-training-data-vs-validationtest-data-vs-20-point-prototype)
7. [Why XGBoost](#7-why-xgboost)
8. [Feature Engineering](#8-feature-engineering)
9. [Data Leakage Prevention](#9-data-leakage-prevention)
10. [Label Construction Strategy](#10-label-construction-strategy)
11. [Train / Validation / Test Split Strategy](#11-train--validation--test-split-strategy)
12. [Model Training Blueprint](#12-model-training-blueprint)
13. [Evaluation Metrics](#13-evaluation-metrics)
14. [Unknown / Ambiguous Handling](#14-unknown--ambiguous-handling)
15. [Classification vs Confidence vs Priority Score](#15-classification-vs-confidence-vs-priority-score)
16. [SHAP Explainability](#16-shap-explainability)
17. [Google Colab Training Workflow](#17-google-colab-training-workflow)
18. [Model Export Requirements](#18-model-export-requirements)
19. [Feature Parity Requirement](#19-feature-parity-requirement)
20. [FastAPI / Backend Integration Contract](#20-fastapi--backend-integration-contract)
21. [Database / PostGIS Coordination](#21-database--postgis-coordination)
22. [Repository Structure](#22-repository-structure)
23. [Execution Roadmap](#23-execution-roadmap)
24. [ML Engineer Deliverables](#24-ml-engineer-deliverables)
25. [Definition of Done](#25-definition-of-done)
26. [Critical Failure Modes](#26-critical-failure-modes)

---

# 1. Role Definition and Scope

## 1.1 ML Engineer responsibilities

**PROJECT REQUIREMENT** (from canonical baseline §21):

The ML Engineer owns the classification intelligence. Primary responsibilities:

1. Inspect and validate the FIRMS dataset
2. Build preprocessing
3. Define the feature schema
4. Implement persistence features
5. Implement thermal baseline and anomaly features
6. Assist with label construction
7. Train and evaluate XGBoost
8. Handle class imbalance
9. Prevent temporal and target leakage
10. Integrate SHAP
11. Version models and feature schemas
12. Provide a stable inference interface to the backend

### Canonical ML role statement

> Develop the XGBoost-based, context-aware thermal hotspot classification engine using satellite thermal features, historical persistence, geospatial industrial context and land-cover features, with SHAP-based explanations for transparent predictions.

## 1.2 What this role does NOT own

- Frontend / dashboard implementation
- PostGIS schema design (but must coordinate on classification storage)
- OSM data collection scripts (but must consume the enriched output)
- Land-cover raster procurement (but must define required output schema)
- Satellite imagery computer vision (explicitly a Non-Goal for MVP)
- Real-time streaming infrastructure

## 1.3 Dependencies on other team members

| Dependency | Provider | What the ML Engineer needs |
|---|---|---|
| Raw FIRMS CSV files | Data / team member | `viirs-jpss1_2022_India.csv`, `viirs-jpss1_2023_India.csv`, `viirs-jpss1_2024_India.csv` |
| Industrial facility data | GIS / OSM enrichment scripts | Normalized facility locations with `facility_type`, geometry, and tags for India |
| Land-cover data | GIS / team member | Per-hotspot land-cover class lookup (tree, cropland, built-up, water, bare) |
| PostGIS tables | Backend engineer | Schema for `hotspot_features`, `classifications`, `explanations` |
| FastAPI integration | Backend engineer | Routes that call the ML inference function with correct feature inputs |
| 20-point prototype coordinates | Team / already exists | `pyroclass_20_sites_geospatial_final.csv` (exists in `dataset/`) |

---

# 2. Core Problem Statement

## 2.1 What the ML system must answer

**PROJECT REQUIREMENT:**

The ML system is NOT simply a fire detector. It must answer five questions for every thermal hotspot:

| # | Question | Output |
|---|---|---|
| 1 | What type of thermal event is this? | `predicted_class` (one of six categories) |
| 2 | Is an industrial-associated thermal event normal or abnormal? | Distinction between `normal_persistent_industrial` and `industrial_spike_anomaly` |
| 3 | How confident is the model? | `confidence` (float 0–1) + `class_probabilities` (dict) |
| 4 | Why did the model make this prediction? | SHAP-based `top_explanatory_features` |
| 5 | When should the system refuse to classify? | `unknown_ambiguous` assignment via post-processing rules |

## 2.2 What the ML system must NOT do

- Treat every satellite detection as a new fire
- Classify based only on raw FIRMS columns
- Ignore historical persistence
- Force every prediction into a confident known class
- Claim facility-level certainty beyond sensor resolution
- Conflate classification with priority/anomaly score

---

# 3. Classification Taxonomy

## 3.1 Canonical six-class prototype taxonomy

**PROJECT REQUIREMENT** (from canonical baseline §3.3, §32):

| ID | Machine Label | Display Name | Meaning |
|---|---|---|---|
| 0 | `normal_persistent_industrial` | Normal Persistent Industrial | Known or strongly inferred persistent industrial thermal source operating near its historical baseline |
| 1 | `industrial_spike_anomaly` | Industrial Spike / Anomaly | Industrial-associated hotspot showing significant abnormal deviation from its historical thermal baseline |
| 2 | `non_industrial_thermal_activity` | Non-Industrial Thermal Activity | Thermal activity not confidently attributable to industrial persistence, forest/vegetation fire, or agricultural burning |
| 3 | `forest_vegetation_fire` | Forest / Vegetation Fire | Thermal event consistent with vegetation/forest context and transient fire behavior |
| 4 | `agricultural_burning` | Agricultural Burning | Thermal event consistent with cropland/agricultural context and seasonal/transient burning behavior |
| 5 | `unknown_ambiguous` | Unknown / Ambiguous | Insufficient or conflicting evidence for a confident semantic class |

### 3.1.1 The most critical distinction

```text
normal_persistent_industrial  ≠  industrial_spike_anomaly
```

A persistent industrial thermal source operating near its expected baseline should NOT be flagged as an emergency or anomaly. The system must use historical behavior, FRP deviation, and contextual information to separate normal from abnormal industrial thermal activity.

### 3.1.2 Classification hierarchy (conceptual)

```text
Satellite Thermal Hotspot
        |
        +-- Industrial context?
        |       |
        |       +-- Yes
        |       |     |
        |       |     +-- Normal historical pattern?
        |       |             |
        |       |             +-- Yes -> Normal Persistent Industrial
        |       |             |
        |       |             +-- No  -> Industrial Spike / Anomaly
        |       |
        |       +-- No / weak evidence
        |               |
        |               +-- Forest / vegetation context -> Forest / Vegetation Fire
        |               |
        |               +-- Cropland context -> Agricultural Burning
        |               |
        |               +-- Other evidence -> Non-Industrial Thermal Activity
        |               |
        |               +-- Insufficient evidence -> Unknown / Ambiguous
```

This is a conceptual framework. The actual implementation uses a direct multiclass XGBoost classifier, but its features and post-processing must preserve this logic.

## 3.2 Mandatory taxonomy rules

**PROJECT REQUIREMENT** (from canonical baseline §32):

1. Keep these six categories consistent across training, label mapping, backend APIs, database values, and frontend display.
2. Do NOT collapse `normal_persistent_industrial` and `industrial_spike_anomaly` into one class; their distinction is central to the prototype.
3. Do NOT force low-confidence predictions into a specific category.
4. Keep `classification`, `confidence`, and `priority/anomaly score` as separate outputs.
5. Version the taxonomy and label mapping if class definitions change.

## 3.3 Canonical label mapping file

The label mapping must be stored in a single versioned file, never hard-coded in multiple places.

```json
{
  "version": "taxonomy-v1",
  "classes": {
    "normal_persistent_industrial": 0,
    "industrial_spike_anomaly": 1,
    "non_industrial_thermal_activity": 2,
    "forest_vegetation_fire": 3,
    "agricultural_burning": 4,
    "unknown_ambiguous": 5
  },
  "display_names": {
    "normal_persistent_industrial": "Normal Persistent Industrial",
    "industrial_spike_anomaly": "Industrial Spike / Anomaly",
    "non_industrial_thermal_activity": "Non-Industrial Thermal Activity",
    "forest_vegetation_fire": "Forest / Vegetation Fire",
    "agricultural_burning": "Agricultural Burning",
    "unknown_ambiguous": "Unknown / Ambiguous"
  },
  "num_classes": 6
}
```

---

# 4. Dataset Context

## 4.1 Primary thermal dataset

**PROJECT REQUIREMENT** (from canonical baseline §3.2):

The primary thermal data source is NASA FIRMS VIIRS data for India. The existing data pipeline (in `dataset/clean_firms.py`) already loads three yearly files:

| File | Year | Source |
|---|---|---|
| `viirs-jpss1_2022_India.csv` | 2022 | VIIRS / NOAA-20 (JPSS-1) |
| `viirs-jpss1_2023_India.csv` | 2023 | VIIRS / NOAA-20 (JPSS-1) |
| `viirs-jpss1_2024_India.csv` | 2024 | VIIRS / NOAA-20 (JPSS-1) |

The canonical baseline mentions approximately **578,062 rows** for the 2024 file alone. Combined 2022–2024 will be significantly larger.

**IMPLEMENTATION REQUIREMENT:** The exact row count must be revalidated by code during ingestion. Do not hard-code the row count.

## 4.2 Raw FIRMS columns

**PROJECT REQUIREMENT** (from canonical baseline §7):

| Column | Type | ML Relevance | Notes |
|---|---|---|---|
| `latitude` | float | Spatial joins, H3 assignment, nearest-facility calculations | Keep |
| `longitude` | float | Same as latitude | Keep |
| `bright_ti4` | float | **Core thermal feature** — VIIRS thermal brightness | Keep |
| `bright_ti5` | float | **Core thermal feature** — must be used with `bright_ti4` | Keep |
| `frp` | float | **Core feature** — Fire Radiative Power, primary intensity measure | Keep |
| `confidence` | str | Detection quality/context feature (`l`/`n`/`h`) | Encode to numeric |
| `acq_date` | str/date | Must be parsed as a date | Derive temporal features |
| `acq_time` | str | Four-character HHMM time; preserve leading zeros | Derive hour/minute |
| `daynight` | str | `D` or `N` | Encode to binary |
| `scan` | float | Secondary detection geometry | Keep for experiments |
| `track` | float | Secondary detection geometry | Keep for experiments |
| `satellite` | str | May be constant in single-source dataset | Drop from features if zero variance |
| `instrument` | str | May be constant in single-source dataset | Drop from features if zero variance |
| `version` | str | May be constant in single-source dataset | Drop from features if zero variance |
| `type` | int | **NOT the final target** — see §5 | May use as weak signal |

## 4.3 Existing processed data

The project already has several processed files in `dataset/`:

| File | Description |
|---|---|
| `clean_firms.py` | Loads 2022–2024 FIRMS CSVs, validates, cleans, creates timestamps and temporal features |
| `h3_prototype_analysis.py` | H3 resolution 7 cell assignment, k-ring=1 neighbourhood analysis |
| `osm_enrichment.py` | OSM-based facility/mining/forest/agriculture polygon overlap checks |
| `validate_osm_context.py` | Validates OSM context results |
| `finalize_geospatial_dataset.py` | Produces final geospatial dataset with all context |
| `pyroclass_20_prototype_candidates.csv` | 20 candidate sites with case_type `persistent`/`spike`/`vegetation_comparison` |
| `pyroclass_20_sites_geospatial_final.csv` | 20 sites enriched with OSM context, H3 cells, facility info |
| `pyroclass_20_sites_h3.csv` | H3 cell assignments for prototype sites |
| `pyroclass_site_h3_summary.csv` | Per-site H3 neighbourhood FIRMS detection summaries |

**IMPORTANT:** The existing prototype candidate `case_type` values (`persistent`, `spike`, `vegetation_comparison`) are preliminary labels used for site selection and analysis — they do NOT directly map 1:1 to the six-class taxonomy. The mapping from site selection types to the final six-class labels requires label construction (see §10).

---

# 5. FIRMS `type` vs PyroClass Target Label

## 5.1 Why they are different

**PROJECT REQUIREMENT** (from canonical baseline §7.12, §26):

```text
RAW FIRMS `type`  ≠  PYROCLASS SIX-CLASS TARGET LABEL
```

The NASA FIRMS `type` field is a source-provided detection category with these values:

| FIRMS `type` | NASA meaning |
|---|---|
| 0 | Presumed vegetation fire |
| 1 | Active volcano |
| 2 | Other static land source |
| 3 | Offshore |

The PyroClass target taxonomy has **six categories** that require contextual evidence (industrial proximity, land cover, historical persistence) which the raw FIRMS `type` does not encode.

## 5.2 Permitted uses of FIRMS `type`

The FIRMS `type` column may be used as:

- A weak signal / candidate-generation input
- Data quality analysis (filtering offshore detections, for example)
- One component of label construction rules
- Exploratory analysis

It must **NOT** be:

- Renamed and used directly as the six-class ground truth
- Used as a feature that causes target leakage
- The sole basis for label assignment

## 5.3 How target labels should be constructed

See §10 (Label Construction Strategy) for the full approach.

---

# 6. Training Data vs Validation/Test Data vs 20-Point Prototype

## 6.1 The three distinct datasets

**PROJECT REQUIREMENT** (from canonical baseline §4.1):

```text
┌─────────────────────────────────────────────────────────────────┐
│                      TRAINING DATA                              │
│                                                                 │
│  Large / curated labelled subset of India FIRMS data            │
│  enriched with spatial and temporal context.                    │
│  Used to train and tune the XGBoost model.                      │
│                                                                 │
│  Expected size: Thousands to tens of thousands of               │
│  labelled examples (subset of ~1.5M+ raw India records)         │
│                                                                 │
│  Split temporally into TRAIN and VALIDATION sets.               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION / TEST DATA                        │
│                                                                 │
│  Held-out temporal partition of the labelled dataset.           │
│  Used for hyperparameter tuning (validation) and final          │
│  metric reporting (test).                                       │
│                                                                 │
│  Must have NO temporal overlap with training data.              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              20-POINT PROTOTYPE DEMONSTRATION SET               │
│                                                                 │
│  Curated showcase points, NOT the training set.                 │
│  Used for final demo validation and judge presentation.         │
│                                                                 │
│  Composition:                                                   │
│    4 Normal Persistent Industrial                               │
│    4 Industrial Spike / Anomaly                                 │
│    4 Non-Industrial Thermal Activity                            │
│    3 Forest / Vegetation Fire                                   │
│    3 Agricultural Burning                                       │
│    2 Unknown / Ambiguous                                        │
│                                                                 │
│  Total: 20                                                      │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 Critical rule

**PROJECT REQUIREMENT** (from canonical baseline §4.1, §26):

> **The 20 curated prototype points are NOT the complete training dataset.**

Training the model only on the 20 demo points would create a weak, overfit demonstration. The correct architecture is:

```text
Historical India data + spatial context
                |
                v
Large / curated labelled training dataset
                |
                v
Train and validate model
                |
                v
Freeze model version
                |
                v
Run curated 20-point prototype evaluation/demo
```

## 6.3 What every prototype point should show

**PROJECT REQUIREMENT** (from canonical baseline §4.2):

Each of the 20 demo points must have:

```text
prototype_id
latitude
longitude
timestamp
expected_demo_category
predicted_category
confidence
class_probabilities
anomaly_score
priority_level
nearest_industrial_context
land_cover_context
persistence_summary
current_frp
historical_frp_baseline
frp_z_score
top_explanation_factors
shap_values or SHAP summary
data_sources_used
```

---

# 7. Why XGBoost

## 7.1 Model selection rationale

**PROJECT REQUIREMENT** (from canonical baseline §11.1):

Primary model: **XGBoost Classifier** with `objective="multi:softprob"`, `num_class=6`.

### Reasons XGBoost is suitable for this project

| Reason | Explanation |
|---|---|
| **Tabular data** | The feature set is structured/tabular (thermal measurements, distances, counts, encodings). XGBoost is consistently strong on tabular data. |
| **Probability output** | `multi:softprob` provides per-class probabilities needed for confidence estimation and ambiguity detection. |
| **No GPU required** | PROJECT REQUIREMENT — the model must work without requiring a GPU at inference time. XGBoost CPU inference is fast. |
| **SHAP compatibility** | SHAP `TreeExplainer` provides exact, fast explanations for tree-based models. |
| **Handles mixed features** | Handles numeric, encoded categorical, and missing values natively. |
| **Interpretable feature importance** | Built-in feature importance + SHAP gives both global and local explanations. |
| **Mature ecosystem** | Well-documented, widely deployed, battle-tested library. |

### What XGBoost does NOT solve

- It does not automatically determine what the correct features are.
- It does not prevent temporal leakage — that is the engineer's responsibility.
- High accuracy on imbalanced classes requires deliberate handling (class weights, sampling).
- Probability outputs from `softprob` are not automatically well-calibrated — calibration should be evaluated.
- It does not replace the need for contextual feature engineering — the model is only as good as its input features.

## 7.2 Conceptual configuration

```python
from xgboost import XGBClassifier

model = XGBClassifier(
    objective="multi:softprob",
    num_class=6,
    eval_metric="mlogloss",
    random_state=42,
    # Additional hyperparameters to be tuned:
    # n_estimators, max_depth, learning_rate,
    # subsample, colsample_bytree, min_child_weight,
    # reg_alpha, reg_lambda
)
```

The final hyperparameters must be stored in a versioned configuration file (`configs/training_config.yaml`), not hard-coded.

## 7.3 Required model capabilities

The trained model must support:

| Method | Purpose |
|---|---|
| `model.predict(X)` | Returns predicted class IDs |
| `model.predict_proba(X)` | Returns `(n_samples, 6)` probability matrix |
| `model.get_booster()` | Access to booster for SHAP TreeExplainer |

---

# 8. Feature Engineering

**PROJECT REQUIREMENT** (from canonical baseline §9):

> Feature engineering is the core of the solution. The model should not be framed as `FIRMS row -> XGBoost -> label`. The intended pipeline is: `FIRMS row + historical behavior + industrial proximity + land-cover context + temporal pattern -> context-aware feature vector -> XGBoost`.

## 8.1 Feature Group A — Raw Thermal Features

These come directly from FIRMS data after validation and type casting.

| Feature | Source | Meaning | Data Type | Formula / Transformation | Missing Value | Available Training | Available Inference |
|---|---|---|---|---|---|---|---|
| `bright_ti4` | FIRMS | VIIRS band I4 brightness temperature (Kelvin) | float64 | Raw value, validated > 0 | Impute with median or flag; reject if critical | Yes | Yes |
| `bright_ti5` | FIRMS | VIIRS band I5 brightness temperature (Kelvin) | float64 | Raw value, validated > 0 | Impute with median or flag; reject if critical | Yes | Yes |
| `frp` | FIRMS | Fire Radiative Power (MW) | float64 | Raw value, validated >= 0 | 0.0 or NaN flag — document choice | Yes | Yes |
| `confidence_encoded` | FIRMS `confidence` | Detection confidence | int | Categorical encoding: `l`→0, `n`→1, `h`→2 (case-insensitive) | Map unknown values to -1 or mode | Yes | Yes |
| `scan` | FIRMS | Along-scan pixel size | float64 | Raw value | Median imputation | Yes | Yes |
| `track` | FIRMS | Along-track pixel size | float64 | Raw value | Median imputation | Yes | Yes |

**Note on `confidence` encoding:** The existing `clean_firms.py` normalizes confidence to uppercase. The canonical baseline (§7.6) specifies lowercase mapping (`l`→0, `n`→1, `h`→2). Ensure consistency. The encoding must be case-insensitive.

## 8.2 Feature Group B — Derived Thermal Features

| Feature | Source | Meaning | Data Type | Formula | Missing Value | Available Training | Available Inference |
|---|---|---|---|---|---|---|---|
| `log_frp` | FIRMS `frp` | Log-transformed FRP to reduce skew | float64 | `log1p(frp)` i.e. `ln(1 + frp)` | `log1p(0) = 0` if frp is 0 | Yes | Yes |
| `thermal_difference` | FIRMS `bright_ti4`, `bright_ti5` | Temperature difference between bands | float64 | `bright_ti4 - bright_ti5` | NaN if either input is missing | Yes | Yes |

**RECOMMENDATION — Optional experiments:**

| Feature | Formula | Purpose |
|---|---|---|
| `thermal_ratio` | `bright_ti4 / max(bright_ti5, epsilon)` | Ratio-based thermal signature |
| `frp_per_scan_area` | `frp / (scan * track)` | FRP intensity normalized by pixel area |

If used, these must be documented in model metadata.

### Formulas (explicit)

```python
import numpy as np

def compute_derived_thermal(bright_ti4, bright_ti5, frp, scan, track, epsilon=1e-6):
    log_frp = np.log1p(frp)
    thermal_difference = bright_ti4 - bright_ti5
    # Optional:
    # thermal_ratio = bright_ti4 / np.maximum(bright_ti5, epsilon)
    # frp_per_scan_area = frp / np.maximum(scan * track, epsilon)
    return log_frp, thermal_difference
```

## 8.3 Feature Group C — Temporal Features

Derived from `acq_date` and `acq_time` after timestamp construction.

| Feature | Source | Meaning | Data Type | Formula | Missing Value | Available Training | Available Inference |
|---|---|---|---|---|---|---|---|
| `month` | `timestamp_utc` | Month of year (1–12) | int | `timestamp.month` | NaN if timestamp missing | Yes | Yes |
| `day_of_year` | `timestamp_utc` | Day of year (1–366) | int | `timestamp.dayofyear` | NaN if timestamp missing | Yes | Yes |
| `day_of_week` | `timestamp_utc` | Day of week (0=Mon–6=Sun) | int | `timestamp.dayofweek` | NaN if timestamp missing | Yes | Yes |
| `hour` | `timestamp_utc` | Hour (0–23) | int | `timestamp.hour` | NaN if timestamp missing | Yes | Yes |
| `minute` | `timestamp_utc` | Minute (0–59) | int | `timestamp.minute` | NaN if timestamp missing | Yes | Yes |
| `is_night` | FIRMS `daynight` | Binary night flag | int | `D`→0, `N`→1 | Mode or -1 | Yes | Yes |
| `hour_sin` | `hour` | Cyclical hour encoding (sine) | float64 | `sin(2 * π * hour / 24)` | NaN if hour missing | Yes | Yes |
| `hour_cos` | `hour` | Cyclical hour encoding (cosine) | float64 | `cos(2 * π * hour / 24)` | NaN if hour missing | Yes | Yes |
| `month_sin` | `month` | Cyclical month encoding (sine) | float64 | `sin(2 * π * (month - 1) / 12)` | NaN if month missing | Yes | Yes |
| `month_cos` | `month` | Cyclical month encoding (cosine) | float64 | `cos(2 * π * (month - 1) / 12)` | NaN if month missing | Yes | Yes |

### Why cyclical encoding?

Hour 23 and hour 0 are one hour apart, but numerically they are 23 units apart. Sine/cosine encoding maps cyclical values onto a circle so that the model correctly perceives proximity:

```python
import numpy as np

hour_sin = np.sin(2 * np.pi * hour / 24)
hour_cos = np.cos(2 * np.pi * hour / 24)

month_sin = np.sin(2 * np.pi * (month - 1) / 12)
month_cos = np.cos(2 * np.pi * (month - 1) / 12)
```

Both sine and cosine must be used together; using only one creates ambiguity (e.g., `sin(6am) == sin(6pm)`).

## 8.4 Feature Group D — Persistence / Historical Features

**PROJECT REQUIREMENT** (from canonical baseline §9.3, §9.4):

> This is one of the most important components for distinguishing persistent industrial heat from transient events.

### 8.4.1 Spatial grouping

Use **H3 cells** (hexagonal hierarchical spatial index) for deterministic spatial grouping. The existing `h3_prototype_analysis.py` uses **resolution 7** with **k_ring=1**.

**RECOMMENDATION:** Use H3 resolution 7 for the persistence engine. Each hotspot is assigned to an H3 cell, and all historical detections in the same cell (or k-ring neighbourhood) form the baseline.

### 8.4.2 Temporal leakage rule

**PROJECT REQUIREMENT** (from canonical baseline §9.3):

> For each hotspot, compute historical features using only observations **before the current event timestamp**. This rule is critical to prevent temporal leakage.

For an event at time `T`:
- Only observations where `timestamp_utc < T` may be used
- Rolling windows look backward from `T`: `[T - window, T)`

### 8.4.3 Persistence features

| Feature | Source | Meaning | Data Type | Window | Formula | Missing Value | Available Training | Available Inference |
|---|---|---|---|---|---|---|---|---|
| `observation_count_7d` | FIRMS history in same H3 cell | Number of detections in preceding 7 days | int | 7 days | Count of hotspots in same cell with `timestamp ∈ [T-7d, T)` | 0 | Yes | Yes |
| `observation_count_30d` | Same | Detections in preceding 30 days | int | 30 days | Count | 0 | Yes | Yes |
| `observation_count_90d` | Same | Detections in preceding 90 days | int | 90 days | Count | 0 | Yes | Yes |
| `active_days_7d` | Same | Distinct days with at least one detection in 7d | int | 7 days | Count of unique dates | 0 | Yes | Yes |
| `active_days_30d` | Same | Distinct active days in 30d | int | 30 days | Count of unique dates | 0 | Yes | Yes |
| `active_days_90d` | Same | Distinct active days in 90d | int | 90 days | Count of unique dates | 0 | Yes | Yes |
| `days_since_first_seen` | Same | Days between first-ever detection in cell and current event | float | All history | `(T - min(timestamp_in_cell)).days` | NaN → 0, with `has_any_history` flag | Yes | Yes |
| `days_since_previous_detection` | Same | Days since most recent detection in cell before T | float | All history | `(T - max(timestamp_in_cell where timestamp < T)).days` | NaN → large sentinel or flag | Yes | Yes |
| `mean_frp_7d` | Same | Mean FRP in preceding 7 days | float64 | 7 days | `mean(frp)` of detections in window | NaN | Yes | Yes |
| `mean_frp_30d` | Same | Mean FRP in preceding 30 days | float64 | 30 days | `mean(frp)` | NaN | Yes | Yes |
| `mean_frp_90d` | Same | Mean FRP in preceding 90 days | float64 | 90 days | `mean(frp)` | NaN | Yes | Yes |
| `median_frp_30d` | Same | Median FRP in preceding 30 days | float64 | 30 days | `median(frp)` | NaN | Yes | Yes |
| `std_frp_30d` | Same | Std. dev. of FRP in preceding 30 days | float64 | 30 days | `std(frp)` | NaN | Yes | Yes |
| `max_frp_30d` | Same | Maximum FRP in preceding 30 days | float64 | 30 days | `max(frp)` | NaN | Yes | Yes |
| `has_history_7d` | Derived | Whether any prior detection exists in 7d window | bool/int | 7 days | `1 if observation_count_7d > 0 else 0` | 0 | Yes | Yes |
| `has_history_30d` | Derived | Whether any prior detection exists in 30d window | bool/int | 30 days | `1 if observation_count_30d > 0 else 0` | 0 | Yes | Yes |
| `has_history_90d` | Derived | Whether any prior detection exists in 90d window | bool/int | 90 days | `1 if observation_count_90d > 0 else 0` | 0 | Yes | Yes |

**IMPLEMENTATION REQUIREMENT:** Do not silently replace "no history" with a normal baseline. Explicit missing indicators (`has_history_*`) must be present.

### 8.4.4 FRP anomaly features

**PROJECT REQUIREMENT** (from canonical baseline §9.4):

| Feature | Formula | Purpose | Missing Value |
|---|---|---|---|
| `frp_deviation` | `current_frp - mean_frp_30d` | Absolute deviation from historical mean | NaN if no history |
| `frp_ratio_to_baseline` | `current_frp / max(mean_frp_30d, epsilon)` | Multiplicative deviation | NaN if no history; use `epsilon = 1e-6` |
| `frp_z_score` | `(current_frp - mean_frp_30d) / max(std_frp_30d, epsilon)` | Standardized deviation | NaN if no history or zero std; use `epsilon = 1e-6` |

```python
epsilon = 1e-6  # Configurable, stored in config

frp_deviation = current_frp - mean_frp_30d
frp_ratio_to_baseline = current_frp / max(mean_frp_30d, epsilon)
frp_z_score = (current_frp - mean_frp_30d) / max(std_frp_30d, epsilon)
```

**Example interpretation:**
```text
Current FRP   = 420 MW
Historical mean = 110 MW
Historical std  =  60 MW

frp_deviation        = 420 - 110 = 310
frp_ratio_to_baseline = 420 / 110 = 3.82
frp_z_score          = (420 - 110) / 60 = 5.17
```

A large positive z-score is evidence of abnormal escalation, but it is NOT by itself proof of an industrial fire. The model combines this with industrial context and land cover to make the final determination.

### 8.4.5 How persistence features help the model

```text
Normal Persistent Industrial:
    high observation_count_30d
    high active_days_30d
    LOW frp_z_score (stable)
    close to industrial facility

Industrial Spike / Anomaly:
    may have high observation_count_30d
    HIGH frp_z_score (deviation)
    close to industrial facility

Forest / Vegetation Fire:
    LOW observation_count_30d (transient)
    LOW active_days_30d
    tree/vegetation land cover

Agricultural Burning:
    LOW observation_count_30d (transient)
    cropland land cover
    seasonal temporal pattern
```

## 8.5 Feature Group E — Industrial Context Features

**PROJECT REQUIREMENT** (from canonical baseline §9.5):

These are computed by spatial join between hotspot coordinates and industrial facility data (from OSM or other sources).

| Feature | Source | Meaning | Data Type | Formula / Method | Missing Value | Available Training | Available Inference |
|---|---|---|---|---|---|---|---|
| `distance_to_nearest_industry_m` | OSM facilities | Meters to nearest industrial facility | float64 | Haversine or geodesic distance | Large sentinel value (e.g., 999999) | Yes | Yes |
| `distance_to_nearest_refinery_m` | OSM refineries | Meters to nearest refinery | float64 | Geodesic distance | Large sentinel or NaN | Yes | Yes |
| `distance_to_nearest_power_plant_m` | OSM power plants | Meters to nearest power plant | float64 | Geodesic distance | Large sentinel or NaN | Yes | Yes |
| `distance_to_nearest_mine_m` | OSM mines | Meters to nearest mine/quarry | float64 | Geodesic distance | Large sentinel or NaN | Yes | Yes |
| `inside_industrial_area` | OSM polygons | Whether the hotspot falls inside an industrial landuse polygon | int (0/1) | Point-in-polygon test | 0 (assume not inside) | Yes | Yes |
| `inside_facility_polygon` | OSM facility polygons | Whether the hotspot falls inside a specific facility boundary | int (0/1) | Point-in-polygon test | 0 | Yes | Yes |
| `industrial_facility_count_2km` | OSM facilities | Count of industrial facilities within 2 km | int | Radius count query | 0 | Yes | Yes |
| `industrial_facility_count_5km` | OSM facilities | Count of industrial facilities within 5 km | int | Radius count query | 0 | Yes | Yes |
| `nearest_facility_type_encoded` | OSM facilities | Type of nearest facility, categorically encoded | int | Categorical encoding of normalized type | -1 or "unknown" category | Yes | Yes |

### Facility type normalization

**PROJECT REQUIREMENT** (from canonical baseline §9.5):

Facility types must be normalized into stable categories:

```text
refinery          -> 0
power_plant       -> 1
steel             -> 2
petrochemical     -> 3
mine              -> 4
lng_terminal      -> 5
industrial_other  -> 6
unknown           -> 7
```

**Note from existing data:** The prototype geospatial data (`pyroclass_20_sites_geospatial_final.csv`) already contains `mining_quarry` as a `facility_type`, `industrial_polygon_overlap_osm`, and `mining_polygon_overlap` columns. The ML pipeline must normalize these into the canonical feature schema.

## 8.6 Feature Group F — Land-Cover / Environmental Context

**PROJECT REQUIREMENT** (from canonical baseline §9.6):

| Feature | Source | Meaning | Data Type | Method | Missing Value | Available Training | Available Inference |
|---|---|---|---|---|---|---|---|
| `land_cover_class` | Land-cover raster/dataset | Primary land-cover category at hotspot location | int (encoded) | Spatial lookup / point query | -1 or "unclassified" | Yes | Yes |
| `is_tree_cover` | Derived from `land_cover_class` | Binary: does the location have tree/forest cover? | int (0/1) | Lookup from class | 0 | Yes | Yes |
| `is_cropland` | Derived from `land_cover_class` | Binary: is the location cropland? | int (0/1) | Lookup from class | 0 | Yes | Yes |
| `is_built_up` | Derived from `land_cover_class` | Binary: is the location built-up/urban? | int (0/1) | Lookup from class | 0 | Yes | Yes |
| `is_water` | Derived from `land_cover_class` | Binary: is the location over water? | int (0/1) | Lookup from class | 0 | Yes | Yes |
| `is_bare_land` | Derived from `land_cover_class` | Binary: is the location bare/sparse? | int (0/1) | Lookup from class | 0 | Yes | Yes |

**OPEN DECISION:** The specific land-cover data provider is not yet locked down in the project. Recommended options:

| Provider | Resolution | Notes |
|---|---|---|
| ESA WorldCover 2021 | 10m | Global, free, recent, well-documented classes |
| Copernicus Global Land Cover | 100m | Suitable resolution for VIIRS hotspots |
| MODIS Land Cover (MCD12Q1) | 500m | Widely used, annual, coarser |

**RECOMMENDATION:** Use ESA WorldCover 2021 for its 10m resolution and clear class definitions. However, the ML pipeline must treat land-cover data through a normalized interface so the source can be swapped.

## 8.7 Feature Group G — Spatial Clustering Features (Optional)

**PROJECT REQUIREMENT** (from canonical baseline §9.7): Optional but valuable.

| Feature | Formula | Purpose |
|---|---|---|
| `neighbor_hotspot_count_1km_24h` | Count of hotspots within 1km and 24h of current event | Distinguishes clusters from isolated events |
| `neighbor_hotspot_count_5km_24h` | Count within 5km, 24h | Broader cluster signal |
| `cluster_size` | Connected component size | Fire spread pattern |
| `cluster_growth_rate` | Change in cluster over time | Active spreading indicator |

These are optional for the initial baseline model. If included, they must use only historical/concurrent data (not future observations).

## 8.8 Complete feature vector summary

The full model feature schema (for the baseline model) must be versioned. A candidate ordered list:

```text
# Group A — Raw Thermal
bright_ti4
bright_ti5
frp
confidence_encoded
scan
track

# Group B — Derived Thermal
log_frp
thermal_difference

# Group C — Temporal
month
day_of_year
hour
is_night
hour_sin
hour_cos
month_sin
month_cos

# Group D — Persistence
observation_count_7d
observation_count_30d
observation_count_90d
active_days_30d
active_days_90d
days_since_first_seen
days_since_previous_detection
mean_frp_30d
std_frp_30d
max_frp_30d
frp_deviation
frp_ratio_to_baseline
frp_z_score
has_history_7d
has_history_30d
has_history_90d

# Group E — Industrial Context
distance_to_nearest_industry_m
inside_industrial_area
inside_facility_polygon
industrial_facility_count_2km
industrial_facility_count_5km
nearest_facility_type_encoded

# Group F — Land Cover
land_cover_class
is_tree_cover
is_cropland
is_built_up
is_water
is_bare_land
```

**Total baseline features: ~37** (exact count depends on optional features included).

The exact first model can use fewer features, but the feature schema must be versioned.

---

# 9. Data Leakage Prevention

## 9.1 Temporal leakage in rolling features

**PROJECT REQUIREMENT** (from canonical baseline §11.4):

For a prediction at time `T`:
- Rolling baselines may only use records where `timestamp_utc < T`
- Future observations must NOT influence persistence features
- Labels or rules used to create labels must NOT appear as direct predictive inputs

### Implementation approach

```python
def compute_persistence_features(current_event, all_events_in_cell):
    """
    current_event: dict with at least 'timestamp_utc', 'frp', 'h3_cell'
    all_events_in_cell: DataFrame of all events in the same H3 cell,
                        sorted by timestamp_utc ascending

    CRITICAL: Filter to only events BEFORE current event's timestamp.
    """
    T = current_event['timestamp_utc']
    history = all_events_in_cell[
        all_events_in_cell['timestamp_utc'] < T
    ]

    # Now compute counts, means, z-scores from 'history' only
    ...
```

### Batch computation strategy

When computing features for the entire training set:

1. Sort all events by `timestamp_utc` ascending
2. For each event at index `i`, the "history" is events `[0, i)` in the same H3 cell
3. Use cumulative/rolling window operations that respect the temporal boundary
4. Never use `DataFrame.rolling()` with `center=True`

```text
Event timeline:
    E1    E2    E3    E4    E5    E6
    |     |     |     |     |     |
    v     v     v     v     v     v
  Jan1  Jan5  Feb2  Mar1  Mar15 Apr2

When computing features for E4 (Mar1):
  History = {E1, E2, E3}  ← only prior events
  30d window = {E3}       ← events in [Feb1, Mar1)
  90d window = {E1, E2, E3} ← events in [Dec1, Mar1)
```

## 9.2 Train/test split leakage

**PROJECT REQUIREMENT** (from canonical baseline §11.4):

> Avoid a naive random split when repeated observations from the same location can appear in both train and test sets.

### Why random row-level splitting is dangerous

A single industrial facility or fire may generate dozens or hundreds of detections over days or weeks. If these detections are randomly distributed between train and test:

- The model memorizes location-specific patterns
- Test performance is inflated because the model has "seen" the same location during training
- The model may fail on genuinely unseen locations

### Recommended split strategies

**RECOMMENDATION (preferred):** Temporal split

```text
2022 Jan–Sep → Train
2022 Oct–Dec → Validation
2023 Jan–Sep → Train (can combine)
2023 Oct–Dec → Validation
2024 Jan–Sep → Additional Train
2024 Oct–Dec → Test (held out, never used for tuning)
```

**RECOMMENDATION (stronger):** Grouped spatial-temporal split

- Assign each labelled example to an H3 cell
- Split by H3 cell groups so that no cell appears in both train and test
- Within each split, maintain temporal ordering

This prevents both temporal and spatial leakage.

## 9.3 Target leakage

- The FIRMS `type` column must NOT be used as a feature if it was used to construct labels (circular dependency)
- If FIRMS `type` is used as one signal during label construction, document this clearly and consider excluding it from the feature matrix

---

# 10. Label Construction Strategy

## 10.1 The core problem

**PROJECT REQUIREMENT** (from canonical baseline §10.1):

> The raw FIRMS dataset does not provide ground-truth labels matching the six prototype classes. Therefore, a supervised model requires a deliberate label-construction process.

## 10.2 Canonical approach: hybrid weak supervision + human verification

**PROJECT REQUIREMENT** (from canonical baseline §10.2):

```text
Raw FIRMS observations
        |
        v
Rule-based candidate generation
        |
        v
Spatial / temporal evidence enrichment
        |
        v
Candidate class assignments
        |
        v
Manual verification of representative samples
        |
        v
Curated labelled training dataset
        |
        v
XGBoost training
```

## 10.3 Candidate generation rules

The following rules are for **candidate generation** — they produce preliminary labels that must be verified. They are NOT the final classifier.

### Normal Persistent Industrial

```text
Candidate evidence:
    distance_to_nearest_industry_m < INDUSTRIAL_DISTANCE_THRESHOLD
    AND active_days_90d >= PERSISTENCE_THRESHOLD
    AND abs(frp_z_score) < STABILITY_THRESHOLD

Example thresholds (configurable):
    INDUSTRIAL_DISTANCE_THRESHOLD = 2000 m
    PERSISTENCE_THRESHOLD = 15 active days
    STABILITY_THRESHOLD = 2.0
```

### Industrial Spike / Anomaly

```text
Candidate evidence:
    distance_to_nearest_industry_m < INDUSTRIAL_DISTANCE_THRESHOLD
    AND has_history_30d = true
    AND frp_z_score > ANOMALY_Z_THRESHOLD

Example thresholds (configurable):
    ANOMALY_Z_THRESHOLD = 3.0
```

### Forest / Vegetation Fire

```text
Candidate evidence:
    is_tree_cover = 1  OR  land_cover is vegetation
    AND distance_to_nearest_industry_m > INDUSTRIAL_DISTANCE_THRESHOLD
    AND observation_count_30d is low (transient behavior)
    AND optional: spatial cluster evidence
```

### Agricultural Burning

```text
Candidate evidence:
    is_cropland = 1
    AND distance_to_nearest_industry_m > INDUSTRIAL_DISTANCE_THRESHOLD
    AND seasonal / transient behavior
```

Seasonality is supporting evidence, not an absolute rule.

### Non-Industrial Thermal Activity

```text
Candidate when:
    NOT strongly industrial
    AND NOT strongly forest/vegetation
    AND NOT strongly cropland
    AND evidence supports a real thermal source
```

This class must NOT become an uncontrolled catch-all. Its examples must be curated.

### Unknown / Ambiguous

```text
Use when:
    spatial evidence conflicts
    OR historical evidence is insufficient
    OR no class has adequate support
    OR model confidence is low
    OR data is outside the validated feature distribution
```

## 10.4 Label record schema

**PROJECT REQUIREMENT** (from canonical baseline §10.9):

Each labelled record must store:

```json
{
  "event_id": "string — unique identifier for the labelled event",
  "h3_cell": "string — H3 cell containing this event",
  "latitude": 0.0,
  "longitude": 0.0,
  "timestamp_utc": "ISO 8601 datetime",
  "target_class": "string — one of six canonical labels",
  "target_class_id": 0,
  "label_source": "string — manual | weak_rule | external_reference | hybrid",
  "label_method": "string — description of how the label was assigned",
  "label_confidence": "string — high | medium | low",
  "evidence": "string — summary of evidence supporting the label",
  "verification_status": "string — verified | unverified | disputed",
  "verified_by": "string — identifier of verifier (human or process)",
  "verification_timestamp": "ISO 8601 datetime or null",
  "notes": "string — additional context"
}
```

### Label source definitions

| Source | Meaning | Reliability |
|---|---|---|
| `manual` | Assigned by a human after inspecting coordinates, imagery, and context | Highest |
| `weak_rule` | Assigned by candidate-generation heuristics without human verification | Low — useful for bootstrapping, NOT for final model |
| `external_reference` | Assigned based on external data (news reports, fire databases, facility records) | Medium-High |
| `hybrid` | Rule-generated and then manually reviewed | High |

### Quality principle

**PROJECT REQUIREMENT** (from canonical baseline §10.9):

> A smaller set of well-verified examples is preferable to a large set of blindly generated pseudo-labels.

## 10.5 Label versioning

All label datasets must be versioned:

```text
labels-v1: Initial candidate rules, unverified
labels-v2: Candidate rules + manual verification round 1
labels-v3: Expanded set with additional data sources
```

Store the label version in model metadata.

---

# 11. Train / Validation / Test Split Strategy

## 11.1 Recommended split

**PROJECT REQUIREMENT** (from canonical baseline §11.4):

```text
Preferred first split:
    Train:      earlier period
    Validation: later period
    Test:       latest held-out period
```

### Concrete split for 2022–2024 data

| Set | Period | Purpose |
|---|---|---|
| **Train** | 2022-01-01 to 2024-06-30 | Model fitting |
| **Validation** | 2024-07-01 to 2024-09-30 | Hyperparameter tuning, threshold selection |
| **Test** | 2024-10-01 to 2024-12-31 | Final metric reporting — NEVER used for tuning |
| **20-point Prototype** | Curated selection | Demo validation — separate from above |

**OPEN DECISION:** The exact date boundaries should be adjusted based on:
- Label availability across time periods
- Class distribution across seasons
- Sufficient representation of all six classes in each split

### Stronger future split

**RECOMMENDATION:** Also group by H3 cell to prevent spatial leakage. Assign each H3 cell to a single split so no cell appears in both train and test.

## 11.2 Split validation checklist

Before training, verify:

- [ ] No temporal overlap between train and test
- [ ] No H3 cell appears in both train and test (if using grouped split)
- [ ] All six classes are represented in train, validation, and test
- [ ] Class distribution is documented for each split
- [ ] Persistence features for test events are computed using only pre-event data

---

# 12. Model Training Blueprint

## 12.1 Conceptual configuration

**PROJECT REQUIREMENT** (from canonical baseline §11.1):

```python
from xgboost import XGBClassifier

model = XGBClassifier(
    objective="multi:softprob",
    num_class=6,
    eval_metric="mlogloss",
    random_state=42,
    use_label_encoder=False,
    # --- Hyperparameters to tune ---
    n_estimators=500,           # Starting point
    max_depth=6,                # Starting point
    learning_rate=0.1,          # Starting point
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=5,
    reg_alpha=0.1,
    reg_lambda=1.0,
)
```

All hyperparameters must be stored in `configs/training_config.yaml`:

```yaml
model:
  type: "XGBClassifier"
  objective: "multi:softprob"
  num_class: 6
  eval_metric: "mlogloss"
  random_state: 42

hyperparameters:
  n_estimators: 500
  max_depth: 6
  learning_rate: 0.1
  subsample: 0.8
  colsample_bytree: 0.8
  min_child_weight: 5
  reg_alpha: 0.1
  reg_lambda: 1.0

early_stopping:
  rounds: 50
  metric: "mlogloss"
```

## 12.2 Class imbalance handling

**PROJECT REQUIREMENT** (from canonical baseline §11.3):

> Class imbalance is expected. Do not optimize only for overall accuracy.

Possible methods (in priority order):

1. **Balanced sample construction:** Ensure reasonable representation of all six classes in training data through targeted label collection
2. **Per-class sample weights:** Use `sample_weight` parameter in XGBoost `.fit()` to upweight minority classes
3. **Targeted data collection:** Collect additional verified labels for underrepresented classes
4. **Conservative use of oversampling:** SMOTE or similar, but only if other methods are insufficient

```python
from sklearn.utils.class_weight import compute_sample_weight

sample_weights = compute_sample_weight("balanced", y_train)

model.fit(
    X_train, y_train,
    sample_weight=sample_weights,
    eval_set=[(X_val, y_val)],
    verbose=50
)
```

## 12.3 Training procedure

```text
Step 1: Load labelled dataset with all features computed
Step 2: Apply temporal split → train, validation, test
Step 3: Verify no leakage (temporal, spatial, target)
Step 4: Compute sample weights for class balancing
Step 5: Fit XGBoost with early stopping on validation set
Step 6: Record hyperparameters, feature list, training metrics
Step 7: Evaluate on validation set → tune thresholds
Step 8: Final evaluation on test set → report metrics
Step 9: Error analysis on confusion matrix
Step 10: Freeze model version
```

---

# 13. Evaluation Metrics

## 13.1 Required metrics

**PROJECT REQUIREMENT** (from canonical baseline §11.5):

| Metric | Scope | Why |
|---|---|---|
| `accuracy` | Overall | Basic correctness (but can be misleading with imbalance) |
| `macro_precision` | Overall | Average precision across all classes, equal weight |
| `macro_recall` | Overall | Average recall across all classes, equal weight |
| `macro_f1` | Overall | **Primary metric** — harmonic mean of macro precision and recall |
| `per_class_precision` | Per class | Which classes are predicted reliably |
| `per_class_recall` | Per class | Which classes are detected reliably |
| `per_class_f1` | Per class | Per-class balanced measure |
| `confusion_matrix` | Full | Reveals systematic misclassification patterns |

**PROJECT REQUIREMENT** (from canonical baseline §11.5):

> Macro F1 is particularly important because a model can obtain deceptively high accuracy by favoring majority classes.

## 13.2 Metrics output format

```json
{
  "metrics_version": "v1",
  "dataset": "test",
  "dataset_period": "2024-10-01 to 2024-12-31",
  "n_samples": 0,
  "accuracy": 0.0,
  "macro_precision": 0.0,
  "macro_recall": 0.0,
  "macro_f1": 0.0,
  "per_class": {
    "normal_persistent_industrial": {
      "precision": 0.0,
      "recall": 0.0,
      "f1": 0.0,
      "support": 0
    },
    "industrial_spike_anomaly": {
      "precision": 0.0,
      "recall": 0.0,
      "f1": 0.0,
      "support": 0
    },
    "non_industrial_thermal_activity": {
      "precision": 0.0,
      "recall": 0.0,
      "f1": 0.0,
      "support": 0
    },
    "forest_vegetation_fire": {
      "precision": 0.0,
      "recall": 0.0,
      "f1": 0.0,
      "support": 0
    },
    "agricultural_burning": {
      "precision": 0.0,
      "recall": 0.0,
      "f1": 0.0,
      "support": 0
    },
    "unknown_ambiguous": {
      "precision": 0.0,
      "recall": 0.0,
      "f1": 0.0,
      "support": 0
    }
  },
  "confusion_matrix": [[]]
}
```

**CRITICAL:** Do not report fabricated or invented evaluation metrics. All values must come from actual experiments.

## 13.3 Error analysis priorities

**PROJECT REQUIREMENT** (from canonical baseline §22 Phase 8):

Inspect confusion between:

- `industrial_spike_anomaly` vs `normal_persistent_industrial` (most critical distinction)
- `forest_vegetation_fire` vs `agricultural_burning`
- `non_industrial_thermal_activity` vs `unknown_ambiguous`

Do NOT jump directly into hyperparameter tuning before understanding errors.

---

# 14. Unknown / Ambiguous Handling

## 14.1 Why this is mandatory

**PROJECT REQUIREMENT** (from canonical baseline §12):

> The prototype must not force every event into a confident known class.

The system must be allowed to say: "The available evidence is insufficient to classify this hotspot confidently."

## 14.2 Post-processing strategy

The `unknown_ambiguous` class is assigned through a combination of:

1. **Model prediction** — XGBoost may directly predict `unknown_ambiguous` as the top class
2. **Post-processing rules** — override model prediction when confidence is too low

### Post-processing logic

```python
# CONFIGURABLE THRESHOLDS — must be experimentally validated
CONFIDENCE_THRESHOLD = 0.50    # Minimum max probability
AMBIGUITY_MARGIN = 0.10        # Minimum gap between top two probabilities

def apply_uncertainty_logic(probabilities, class_names):
    """
    probabilities: np.array of shape (6,) — per-class probabilities
    class_names: list of 6 class label strings

    Returns: (final_class, confidence, unknown_reason)
    """
    sorted_indices = np.argsort(probabilities)[::-1]
    top_prob = probabilities[sorted_indices[0]]
    second_prob = probabilities[sorted_indices[1]]
    top_class = class_names[sorted_indices[0]]

    unknown_reason = None

    if top_prob < CONFIDENCE_THRESHOLD:
        final_class = "unknown_ambiguous"
        confidence = top_prob
        unknown_reason = f"max_probability ({top_prob:.3f}) below threshold ({CONFIDENCE_THRESHOLD})"

    elif (top_prob - second_prob) < AMBIGUITY_MARGIN:
        final_class = "unknown_ambiguous"
        confidence = top_prob
        second_class = class_names[sorted_indices[1]]
        unknown_reason = (
            f"ambiguous: {top_class} ({top_prob:.3f}) vs "
            f"{second_class} ({second_prob:.3f}), "
            f"margin ({top_prob - second_prob:.3f}) below threshold ({AMBIGUITY_MARGIN})"
        )

    else:
        final_class = top_class
        confidence = top_prob
        unknown_reason = None

    return final_class, confidence, unknown_reason
```

## 14.3 Additional uncertainty signals (optional)

**RECOMMENDATION:**

| Signal | Description | Complexity |
|---|---|---|
| **Missing critical context** | If `distance_to_nearest_industry_m` is missing or land cover is unknown | Low |
| **Out-of-distribution warning** | Feature values outside training distribution (e.g., FRP far above any training example) | Medium |
| **Entropy-based** | High entropy of probability distribution indicates spread across classes | Low |

```python
def compute_prediction_entropy(probabilities):
    """Shannon entropy of class probability distribution."""
    return -np.sum(probabilities * np.log(np.clip(probabilities, 1e-10, 1.0)))

# High entropy → uncertain prediction
```

## 14.4 Threshold validation

**IMPLEMENTATION REQUIREMENT:**

The thresholds `CONFIDENCE_THRESHOLD` and `AMBIGUITY_MARGIN` must NOT be arbitrarily invented. They must be:

1. Selected using the validation set
2. Evaluated for their impact on:
   - How many predictions are reclassified as `unknown_ambiguous`
   - Whether genuinely ambiguous cases are caught
   - Whether confident correct predictions are not unnecessarily overridden
3. Stored in configuration (`configs/training_config.yaml`)

---

# 15. Classification vs Confidence vs Priority Score

## 15.1 The three separate outputs

**PROJECT REQUIREMENT** (from canonical baseline §14, §32):

These are **NOT the same thing** and must remain separate outputs.

```text
┌──────────────────────────────────────────┐
│  CLASSIFICATION                          │
│  "What type of thermal event is this?"   │
│                                          │
│  Output: predicted_class                 │
│  Example: industrial_spike_anomaly       │
│  Source: XGBoost + post-processing       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  CONFIDENCE                              │
│  "How certain is the model?"             │
│                                          │
│  Output: confidence (0.0 – 1.0)          │
│  Example: 0.91                           │
│  Source: XGBoost predict_proba max        │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  PRIORITY / ANOMALY SCORE                │
│  "How unusual or important is this?"     │
│                                          │
│  Output: anomaly_score (0 – 100)         │
│  Example: 88                             │
│  Source: Weighted combination of          │
│          deviation, persistence,         │
│          industrial proximity            │
└──────────────────────────────────────────┘
```

### Example to illustrate the difference

```text
Event A:
  Classification: normal_persistent_industrial
  Confidence: 0.95
  Priority Score: 12/100
  → Known industrial source, confidently classified, low priority

Event B:
  Classification: industrial_spike_anomaly
  Confidence: 0.91
  Priority Score: 88/100
  → Industrial anomaly, confidently classified, HIGH priority

Event C:
  Classification: unknown_ambiguous
  Confidence: 0.38
  Priority Score: 45/100
  → Uncertain classification, model unsure, medium priority
```

## 15.2 Anomaly / Priority Score (APS)

**PROJECT REQUIREMENT** (from canonical baseline §14):

Conceptual formula:

```text
APS = w1 * normalized_frp_deviation
    + w2 * persistence_anomaly
    + w3 * industrial_proximity_factor
    + w4 * spatial_spread
    + w5 * temporal_anomaly
    + w6 * classification_confidence
```

Normalized to 0–100.

| Score Range | Priority Level |
|---|---|
| > 75 | High |
| 50–75 | Medium |
| < 50 | Low |

**IMPLEMENTATION REQUIREMENT:** Weights must be stored in configuration, NOT embedded as unexplained constants.

```yaml
anomaly_priority:
  weights:
    frp_deviation: 0.30
    persistence_anomaly: 0.20
    industrial_proximity: 0.15
    spatial_spread: 0.10
    temporal_anomaly: 0.10
    confidence: 0.15
  thresholds:
    high: 75
    medium: 50
```

## 15.3 ML Engineer's role in priority scoring

The ML Engineer provides:
- The classification and confidence
- Feature values that feed into the anomaly score (frp_z_score, persistence metrics, etc.)
- The SHAP explanations

The actual APS formula may be implemented collaboratively with the backend engineer, but the ML Engineer must ensure the required input features are available and documented.

---

# 16. SHAP Explainability

## 16.1 Purpose

**PROJECT REQUIREMENT** (from canonical baseline §13):

SHAP is used to answer: "Why did the model classify this hotspot this way?"

## 16.2 SHAP TreeExplainer

```python
import shap

# Create explainer from trained model
explainer = shap.TreeExplainer(model)

# Compute SHAP values for a single prediction
shap_values = explainer.shap_values(X_single)
# Returns: list of 6 arrays (one per class), each of shape (n_features,)

# Or for a batch
shap_values = explainer.shap_values(X_batch)
# Returns: list of 6 arrays, each of shape (n_samples, n_features)
```

## 16.3 Required outputs

### 16.3.1 Global explainability (training time)

Generated once after training. Stored in the model bundle.

- **Global feature importance:** Mean absolute SHAP value per feature across all predictions
- **Per-class feature importance:** Mean absolute SHAP value per feature for each class
- **SHAP summary plot data:** For model analysis and debugging

### 16.3.2 Local explainability (inference time)

Generated for every individual prediction. Returned in the API response.

For each prediction, compute:
- Top N positive contributors (features pushing toward the predicted class)
- Top N negative contributors (features pushing against the predicted class)
- Human-readable explanation text

### 16.3.3 Example output

```text
Prediction: Industrial Spike / Anomaly
Confidence: 92%

Main reasons:
  + FRP is 3.8× above the 30-day baseline          (frp_ratio_to_baseline: SHAP +0.34)
  + Hotspot is 180 m from an industrial facility    (distance_to_nearest_industry_m: SHAP +0.28)
  + FRP z-score is high                             (frp_z_score: SHAP +0.22)
  + Persistent historical detections exist          (active_days_30d: SHAP +0.15)
  - Land-cover context does not support vegetation  (is_tree_cover: SHAP -0.08)
```

## 16.4 Human-readable conversion

**PROJECT REQUIREMENT** (from canonical baseline §13.4):

> Do not expose only raw SHAP values. The UI should convert the main contributions into understandable text.

The conversion must be generated from **actual feature values and SHAP contributions**, NOT from hard-coded template text.

```python
FEATURE_DESCRIPTIONS = {
    "frp_z_score": "FRP z-score relative to historical baseline",
    "frp_ratio_to_baseline": "FRP ratio to 30-day baseline",
    "distance_to_nearest_industry_m": "Distance to nearest industrial facility",
    "active_days_30d": "Active detection days in past 30 days",
    "observation_count_30d": "Detection count in past 30 days",
    "is_tree_cover": "Tree/forest land cover",
    "is_cropland": "Cropland land cover",
    "inside_industrial_area": "Inside industrial area",
    # ... complete for all features
}

def generate_explanation_text(feature_name, shap_value, feature_value):
    """
    Generate human-readable explanation from SHAP contribution.
    Must use actual feature values, NOT hard-coded text.
    """
    description = FEATURE_DESCRIPTIONS.get(feature_name, feature_name)
    direction = "+" if shap_value > 0 else "-"

    if feature_name == "distance_to_nearest_industry_m":
        return f"{direction} Hotspot is {feature_value:.0f} m from nearest industrial facility"
    elif feature_name == "frp_z_score":
        return f"{direction} FRP z-score is {feature_value:.1f} (deviation from baseline)"
    elif feature_name == "frp_ratio_to_baseline":
        return f"{direction} FRP is {feature_value:.1f}× above the 30-day baseline"
    # ... etc
    else:
        return f"{direction} {description}: {feature_value}"
```

## 16.5 SHAP computation at inference time

**IMPLEMENTATION REQUIREMENT:**

SHAP TreeExplainer for XGBoost is fast enough for per-prediction computation. However:

- Pre-compute the `TreeExplainer` object once at model load time
- Store it alongside the model in the backend
- Compute SHAP values per request (or batch)
- Do NOT generate fake/hard-coded SHAP explanations

---

# 17. Google Colab Training Workflow

## 17.1 Why Colab

**IMPLEMENTATION REQUIREMENT:** The developer's local machine does not have sufficient computational power for model training. Google Colab provides:

- Free GPU/TPU access (not required for XGBoost, but helpful for large data processing)
- Sufficient RAM for the dataset (~1.5M+ rows)
- Pre-installed scientific Python libraries
- Easy GitHub integration

## 17.2 Environment separation

```text
┌─────────────────────────────────────────┐
│       TRAINING ENVIRONMENT              │
│       Google Colab                      │
│                                         │
│  - Load raw FIRMS data                  │
│  - Run preprocessing pipeline           │
│  - Compute all features                 │
│  - Train XGBoost                        │
│  - Evaluate metrics                     │
│  - Generate SHAP analysis              │
│  - Export model bundle                  │
│                                         │
│  Output: xgb_pyroclass_v1/ bundle       │
└─────────────────────────────────────────┘
                    │
                    │  Model bundle transferred
                    │  (GitHub, Google Drive, or manual download)
                    │
                    v
┌─────────────────────────────────────────┐
│       INFERENCE ENVIRONMENT             │
│       FastAPI Backend                   │
│                                         │
│  - Load frozen model bundle             │
│  - Receive hotspot + context data       │
│  - Compute features using SAME pipeline │
│  - Run model.predict_proba()            │
│  - Apply uncertainty logic              │
│  - Generate SHAP explanations           │
│  - Return classification response       │
│                                         │
│  Does NOT retrain the model             │
└─────────────────────────────────────────┘
```

**CRITICAL:** The model is NOT retrained on every API request. The backend loads a frozen model bundle and performs inference only.

## 17.3 Detailed Colab execution plan

### Step 1: Local development

Write reusable ML code in `ml/src/` on local machine:
- `config.py`, `data_validation.py`, `preprocess.py`, `features.py`, `labels.py`, `splits.py`, `train.py`, `evaluate.py`, `explain.py`, `predict.py`

### Step 2: Push to GitHub

```bash
git add ml/
git commit -m "ML pipeline: preprocessing, features, training"
git push origin main
```

### Step 3: Open training notebook in Colab

Create `ml/notebooks/train_model.ipynb` and open it in Google Colab.

### Step 4: Install dependencies and clone repo

```python
# In Colab cell
!pip install xgboost shap scikit-learn pandas numpy h3 geopandas joblib pyyaml

# Clone the repository
!git clone https://github.com/<your-org>/pyroclass.git
%cd pyroclass
```

### Step 5: Load dataset

```python
# Mount Google Drive (for large data files)
from google.colab import drive
drive.mount('/content/drive')

# Or download directly from FIRMS
# Or load from the repository's data/ directory
import pandas as pd
firms_data = pd.read_csv('path/to/firms_india_2022_2024_clean.csv')
```

### Step 6: Run validation

```python
from ml.src.data_validation import validate_firms_data
validation_report = validate_firms_data(firms_data)
print(validation_report)
```

### Step 7: Generate features

```python
from ml.src.features import build_all_features
featured_data = build_all_features(firms_data, industrial_data, landcover_data)
```

### Step 8: Train XGBoost

```python
from ml.src.train import train_model
from ml.src.splits import create_temporal_split

X_train, X_val, X_test, y_train, y_val, y_test = create_temporal_split(featured_data)
model, training_history = train_model(X_train, y_train, X_val, y_val)
```

### Step 9: Evaluate

```python
from ml.src.evaluate import evaluate_model
metrics = evaluate_model(model, X_test, y_test)
```

### Step 10: Generate SHAP outputs

```python
from ml.src.explain import generate_shap_analysis
shap_analysis = generate_shap_analysis(model, X_test, feature_names)
```

### Step 11: Export model bundle

```python
from ml.src.train import export_model_bundle
export_model_bundle(
    model=model,
    feature_names=feature_names,
    metrics=metrics,
    output_dir='ml/models/xgb_pyroclass_v1/'
)
```

### Step 12: Transfer artifacts

```python
# Option A: Push to GitHub (if model bundle is small enough)
!git add ml/models/xgb_pyroclass_v1/
!git commit -m "Trained model bundle v1"
!git push

# Option B: Copy to Google Drive
!cp -r ml/models/xgb_pyroclass_v1/ /content/drive/MyDrive/pyroclass/models/

# Option C: Download directly from Colab
from google.colab import files
!zip -r model_bundle.zip ml/models/xgb_pyroclass_v1/
files.download('model_bundle.zip')
```

### Step 13: Use in backend

On local machine / deployment server:
```bash
git pull  # or manually copy model bundle
# The backend loads the model from ml/models/xgb_pyroclass_v1/
```

---

# 18. Model Export Requirements

## 18.1 Why saving only `model.joblib` is NOT sufficient

A model file without its feature schema, preprocessing configuration, and label mapping is incomplete and dangerous:

- The backend cannot validate input features
- Preprocessing mismatches silently corrupt predictions
- Label decoding may break
- Reproducibility is impossible

## 18.2 Required model bundle structure

```text
xgb_pyroclass_v1/
├── model.joblib                    # Serialized XGBoost model
├── feature_schema.json             # Ordered feature list with types
├── preprocessing_config.json       # Encoding maps, imputation rules, epsilon values
├── label_mapping.json              # Class name ↔ integer mapping
├── model_metadata.json             # Version, seed, data period, library versions
├── metrics.json                    # Evaluation results (actual, not fabricated)
└── shap_global_importance.json     # Global feature importance from SHAP (optional)
```

## 18.3 File specifications

### `model.joblib`

```python
import joblib
joblib.dump(model, 'xgb_pyroclass_v1/model.joblib')
```

### `feature_schema.json`

```json
{
  "version": "features-v1",
  "feature_count": 37,
  "features": [
    {
      "name": "bright_ti4",
      "group": "raw_thermal",
      "dtype": "float64",
      "nullable": false,
      "description": "VIIRS band I4 brightness temperature"
    },
    {
      "name": "bright_ti5",
      "group": "raw_thermal",
      "dtype": "float64",
      "nullable": false,
      "description": "VIIRS band I5 brightness temperature"
    },
    {
      "name": "frp",
      "group": "raw_thermal",
      "dtype": "float64",
      "nullable": true,
      "description": "Fire Radiative Power (MW)"
    }
  ],
  "feature_order": [
    "bright_ti4",
    "bright_ti5",
    "frp",
    "confidence_encoded",
    "scan",
    "track",
    "log_frp",
    "thermal_difference",
    "month",
    "day_of_year",
    "hour",
    "is_night",
    "hour_sin",
    "hour_cos",
    "month_sin",
    "month_cos",
    "observation_count_7d",
    "observation_count_30d",
    "observation_count_90d",
    "active_days_30d",
    "active_days_90d",
    "days_since_first_seen",
    "days_since_previous_detection",
    "mean_frp_30d",
    "std_frp_30d",
    "max_frp_30d",
    "frp_deviation",
    "frp_ratio_to_baseline",
    "frp_z_score",
    "has_history_7d",
    "has_history_30d",
    "has_history_90d",
    "distance_to_nearest_industry_m",
    "inside_industrial_area",
    "inside_facility_polygon",
    "industrial_facility_count_2km",
    "industrial_facility_count_5km",
    "nearest_facility_type_encoded",
    "land_cover_class",
    "is_tree_cover",
    "is_cropland",
    "is_built_up",
    "is_water",
    "is_bare_land"
  ]
}
```

### `preprocessing_config.json`

```json
{
  "version": "preprocess-v1",
  "confidence_encoding": {
    "l": 0, "n": 1, "h": 2,
    "L": 0, "N": 1, "H": 2
  },
  "daynight_encoding": {
    "D": 0, "N": 1
  },
  "facility_type_encoding": {
    "refinery": 0,
    "power_plant": 1,
    "steel": 2,
    "petrochemical": 3,
    "mine": 4,
    "lng_terminal": 5,
    "industrial_other": 6,
    "unknown": 7
  },
  "epsilon": 1e-6,
  "missing_value_policy": {
    "frp": "zero_fill",
    "bright_ti4": "reject_if_missing",
    "bright_ti5": "reject_if_missing",
    "distance_to_nearest_industry_m": "fill_999999",
    "persistence_features": "fill_zero_with_has_history_flag"
  },
  "cyclical_encoding": {
    "hour": {"period": 24},
    "month": {"period": 12, "offset": 1}
  }
}
```

### `label_mapping.json`

```json
{
  "version": "taxonomy-v1",
  "class_to_id": {
    "normal_persistent_industrial": 0,
    "industrial_spike_anomaly": 1,
    "non_industrial_thermal_activity": 2,
    "forest_vegetation_fire": 3,
    "agricultural_burning": 4,
    "unknown_ambiguous": 5
  },
  "id_to_class": {
    "0": "normal_persistent_industrial",
    "1": "industrial_spike_anomaly",
    "2": "non_industrial_thermal_activity",
    "3": "forest_vegetation_fire",
    "4": "agricultural_burning",
    "5": "unknown_ambiguous"
  },
  "display_names": {
    "normal_persistent_industrial": "Normal Persistent Industrial",
    "industrial_spike_anomaly": "Industrial Spike / Anomaly",
    "non_industrial_thermal_activity": "Non-Industrial Thermal Activity",
    "forest_vegetation_fire": "Forest / Vegetation Fire",
    "agricultural_burning": "Agricultural Burning",
    "unknown_ambiguous": "Unknown / Ambiguous"
  }
}
```

### `model_metadata.json`

```json
{
  "model_version": "xgb-v1",
  "feature_version": "features-v1",
  "preprocessing_version": "preprocess-v1",
  "label_version": "taxonomy-v1",
  "dataset_version": "india-2022-2024-v1",
  "training_data_period": "2022-01-01 to 2024-06-30",
  "test_data_period": "2024-10-01 to 2024-12-31",
  "random_seed": 42,
  "num_classes": 6,
  "class_names": [
    "normal_persistent_industrial",
    "industrial_spike_anomaly",
    "non_industrial_thermal_activity",
    "forest_vegetation_fire",
    "agricultural_burning",
    "unknown_ambiguous"
  ],
  "hyperparameters": {
    "n_estimators": 500,
    "max_depth": 6,
    "learning_rate": 0.1,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 5,
    "reg_alpha": 0.1,
    "reg_lambda": 1.0
  },
  "library_versions": {
    "xgboost": "2.0.0",
    "scikit-learn": "1.4.0",
    "shap": "0.44.0",
    "pandas": "2.1.0",
    "numpy": "1.26.0"
  },
  "training_timestamp": "ISO 8601",
  "evaluation_summary": {
    "test_macro_f1": null,
    "test_accuracy": null
  },
  "notes": "Baseline prototype model for SIH26162 PyroClass India demo"
}
```

### `metrics.json`

See §13.2 for format. Must contain ACTUAL metrics from experiments.

---

# 19. Feature Parity Requirement

## 19.1 The critical rule

**IMPLEMENTATION REQUIREMENT:**

```text
Training feature pipeline  ==  Inference feature pipeline
```

The backend must use **exactly the same**:
- Feature names
- Feature definitions
- Transformations
- Units
- Encodings
- Missing-value handling
- Feature order

## 19.2 How to enforce parity

**RECOMMENDATION:** Use shared Python code for feature computation.

```python
# ml/src/features.py — used by BOTH Colab training AND FastAPI inference

def build_features(raw_event, historical_context, spatial_context):
    """
    Build the complete feature vector for a single hotspot event.

    This function MUST be used identically in:
    1. Training pipeline (Google Colab)
    2. Inference pipeline (FastAPI backend)

    Args:
        raw_event: dict with FIRMS fields (bright_ti4, bright_ti5, frp, ...)
        historical_context: dict with persistence features from H3 cell history
        spatial_context: dict with industrial proximity and land-cover features

    Returns:
        dict of feature_name -> feature_value, in canonical order
    """
    features = {}

    # Group A — Raw thermal
    features['bright_ti4'] = raw_event['bright_ti4']
    features['bright_ti5'] = raw_event['bright_ti5']
    features['frp'] = raw_event.get('frp', 0.0)
    features['confidence_encoded'] = encode_confidence(raw_event.get('confidence'))
    features['scan'] = raw_event.get('scan', np.nan)
    features['track'] = raw_event.get('track', np.nan)

    # Group B — Derived thermal
    features['log_frp'] = np.log1p(features['frp'])
    features['thermal_difference'] = features['bright_ti4'] - features['bright_ti5']

    # Group C — Temporal
    ts = raw_event['timestamp_utc']
    features['month'] = ts.month
    features['day_of_year'] = ts.timetuple().tm_yday
    features['hour'] = ts.hour
    features['is_night'] = 1 if raw_event.get('daynight', 'D').upper() == 'N' else 0
    features['hour_sin'] = np.sin(2 * np.pi * features['hour'] / 24)
    features['hour_cos'] = np.cos(2 * np.pi * features['hour'] / 24)
    features['month_sin'] = np.sin(2 * np.pi * (features['month'] - 1) / 12)
    features['month_cos'] = np.cos(2 * np.pi * (features['month'] - 1) / 12)

    # Group D — Persistence (from historical_context)
    features['observation_count_7d'] = historical_context.get('observation_count_7d', 0)
    # ... etc

    # Group E — Industrial context (from spatial_context)
    features['distance_to_nearest_industry_m'] = spatial_context.get(
        'distance_to_nearest_industry_m', 999999
    )
    # ... etc

    # Group F — Land cover (from spatial_context)
    features['is_tree_cover'] = spatial_context.get('is_tree_cover', 0)
    # ... etc

    return features
```

## 19.3 What happens if parity is broken

Inconsistent Colab and backend preprocessing **silently invalidates predictions**:

- Features in wrong order → model interprets FRP as temperature
- Different encoding → "high" confidence becomes wrong numeric value
- Different missing-value handling → NaN in one pipeline, 0 in another
- Different transformations → `log1p` in training, raw value at inference

**The model will produce outputs that look plausible but are wrong.**

## 19.4 How to validate parity

1. Create a small test set of raw inputs
2. Run through training pipeline → record feature vectors
3. Run through inference pipeline → record feature vectors
4. Assert exact equality (within floating-point tolerance)

```python
def test_feature_parity():
    test_event = {...}  # Known raw event
    training_features = training_pipeline.build_features(test_event, ...)
    inference_features = inference_pipeline.build_features(test_event, ...)
    for key in training_features:
        assert abs(training_features[key] - inference_features[key]) < 1e-10, \
            f"Feature parity violation: {key}"
```

---

# 20. FastAPI / Backend Integration Contract

## 20.1 Classification response schema

**IMPLEMENTATION REQUIREMENT:**

The ML inference endpoint must return:

```json
{
  "hotspot_id": "string — UUID",
  "predicted_class": "string — one of six canonical labels",
  "confidence": 0.91,
  "class_probabilities": {
    "normal_persistent_industrial": 0.03,
    "industrial_spike_anomaly": 0.91,
    "non_industrial_thermal_activity": 0.02,
    "forest_vegetation_fire": 0.01,
    "agricultural_burning": 0.01,
    "unknown_ambiguous": 0.02
  },
  "anomaly_score": 88,
  "priority_level": "high",
  "unknown_reason": null,
  "model_version": "xgb-v1",
  "feature_version": "features-v1",
  "top_explanatory_features": [
    {
      "feature": "frp_ratio_to_baseline",
      "value": 3.82,
      "shap_contribution": 0.34,
      "direction": "positive",
      "human_readable": "FRP is 3.8× above the 30-day baseline"
    },
    {
      "feature": "distance_to_nearest_industry_m",
      "value": 180.0,
      "shap_contribution": 0.28,
      "direction": "positive",
      "human_readable": "Hotspot is 180 m from an industrial facility"
    }
  ]
}
```

### Field specifications

| Field | Type | Mandatory | Description |
|---|---|---|---|
| `hotspot_id` | string | Yes | Unique identifier for the hotspot |
| `predicted_class` | string | Yes | Final class after post-processing (may differ from raw XGBoost prediction due to uncertainty logic) |
| `confidence` | float | Yes | Maximum class probability (0–1) |
| `class_probabilities` | dict | Yes | All six class probabilities, must sum to ~1.0 |
| `anomaly_score` | int | Yes | Priority score 0–100 |
| `priority_level` | string | Yes | "high" / "medium" / "low" |
| `unknown_reason` | string or null | Yes | Explanation if classified as unknown_ambiguous, null otherwise |
| `model_version` | string | Yes | From model_metadata.json |
| `feature_version` | string | Yes | From feature_schema.json |
| `top_explanatory_features` | list | Yes | Top N SHAP-based explanation factors |

## 20.2 Backend validation requirements

The backend must validate before running inference:

| Check | Error Behavior |
|---|---|
| Model bundle exists and is loadable | Fail with clear error message |
| Feature schema version matches loaded model | Fail — do not run mismatched model and features |
| All required features are present in input | Fail with list of missing features |
| Missing-value policy is applied correctly | Apply policy or fail |
| Probability output sums to ~1.0 | Log warning if sum deviates by > 0.01 |
| Model and feature versions are compatible | Fail if versions mismatch |

## 20.3 Inference function signature

```python
# ml/src/predict.py

def classify_hotspot(
    raw_event: dict,
    historical_context: dict,
    spatial_context: dict,
    model_bundle_path: str = "ml/models/xgb_pyroclass_v1/"
) -> dict:
    """
    Classify a single thermal hotspot event.

    Returns the full classification response dict
    (see §20.1 for schema).

    This function:
    1. Loads the model bundle (cached after first load)
    2. Builds features using the shared pipeline
    3. Runs XGBoost predict_proba
    4. Applies uncertainty post-processing
    5. Computes SHAP explanations
    6. Formats the response

    Does NOT retrain the model.
    """
    ...
```

---

# 21. Database / PostGIS Coordination

## 21.1 Conceptual data to persist

**RECOMMENDATION** (aligned with canonical baseline §15):

The following records should be persisted for reproducibility. The exact schema is owned by the backend engineer, but the ML Engineer must define the data contract.

### Feature record

```text
hotspot_features:
    hotspot_id              UUID      FK → hotspots.id
    feature_version         TEXT      e.g. "features-v1"
    bright_ti4              FLOAT
    bright_ti5              FLOAT
    frp                     FLOAT
    log_frp                 FLOAT
    thermal_difference      FLOAT
    confidence_encoded      INT
    month                   INT
    hour                    INT
    is_night                INT
    hour_sin                FLOAT
    hour_cos                FLOAT
    observation_count_30d   INT
    active_days_30d         INT
    mean_frp_30d            FLOAT
    std_frp_30d             FLOAT
    frp_z_score             FLOAT
    frp_deviation           FLOAT
    distance_to_nearest_industry_m  FLOAT
    inside_industrial_area  BOOLEAN
    industrial_facility_count_2km   INT
    nearest_facility_type_encoded   INT
    land_cover_class        INT
    is_tree_cover           BOOLEAN
    is_cropland             BOOLEAN
    is_built_up             BOOLEAN
    created_at              TIMESTAMP
```

### Classification record

```text
classifications:
    id                      UUID      PK
    hotspot_id              UUID      FK → hotspots.id
    model_version           TEXT      e.g. "xgb-v1"
    predicted_class         TEXT      canonical label
    confidence              FLOAT     0–1
    class_probabilities     JSONB     all six probabilities
    anomaly_score           INT       0–100
    priority_level          TEXT      high/medium/low
    unknown_reason          TEXT      nullable
    created_at              TIMESTAMP
```

### Explanation record

```text
explanations:
    id                      UUID      PK
    classification_id       UUID      FK → classifications.id
    method                  TEXT      "shap_tree_explainer"
    top_features            JSONB     list of {feature, value, shap_contribution, direction, text}
    shap_values             JSONB     full SHAP values (optional, may be large)
    human_readable_summary  TEXT      combined explanation text
    created_at              TIMESTAMP
```

---

# 22. Repository Structure

## 22.1 Recommended ML folder structure

**RECOMMENDATION** (aligned with canonical baseline §16.2):

```text
ml/
├── README.md                          # ML component documentation
├── notebooks/
│   └── train_model.ipynb              # Google Colab training notebook
├── src/
│   ├── __init__.py
│   ├── config.py                      # Load YAML configs, path management
│   ├── data_validation.py             # Validate raw FIRMS data
│   ├── preprocess.py                  # Clean, normalize, parse timestamps
│   ├── features.py                    # Feature engineering (shared with backend)
│   ├── persistence.py                 # H3 assignment, rolling historical features
│   ├── labels.py                      # Label construction and management
│   ├── splits.py                      # Temporal / grouped data splitting
│   ├── train.py                       # XGBoost training and model export
│   ├── evaluate.py                    # Metrics computation and reporting
│   ├── explain.py                     # SHAP explainability
│   └── predict.py                     # Inference function (used by backend)
├── configs/
│   ├── training_config.yaml           # Hyperparameters, thresholds, random seed
│   ├── feature_config.yaml            # Feature list, groups, missing-value policy
│   └── taxonomy.yaml                  # Class definitions, label mapping
├── models/
│   └── xgb_pyroclass_v1/             # Versioned model bundle (see §18)
│       ├── model.joblib
│       ├── feature_schema.json
│       ├── preprocessing_config.json
│       ├── label_mapping.json
│       ├── model_metadata.json
│       └── metrics.json
├── data/
│   ├── raw/                           # Raw FIRMS CSVs (gitignored, large)
│   ├── external/                      # Industrial facilities, land cover
│   ├── processed/                     # Cleaned, feature-engineered data
│   └── labelled/                      # Labelled training data with metadata
├── reports/
│   ├── data_validation_report.md
│   ├── evaluation_report.md
│   └── error_analysis.md
└── tests/
    ├── test_features.py               # Feature computation tests
    ├── test_preprocessing.py          # Preprocessing correctness
    ├── test_predict.py                # Inference contract tests
    └── test_feature_parity.py         # Training vs inference feature parity
```

## 22.2 File responsibilities

| File | Responsibility |
|---|---|
| `config.py` | Load YAML configs, define paths, provide global constants |
| `data_validation.py` | Validate column names, types, ranges, missing values; produce quality report |
| `preprocess.py` | Parse timestamps, encode categoricals, clean numerics, create `timestamp_utc` |
| `features.py` | **Core shared code** — `build_features()` function used by both training and inference |
| `persistence.py` | H3 cell assignment, rolling window feature computation with leakage protection |
| `labels.py` | Candidate label generation rules, label loading, label versioning |
| `splits.py` | Temporal split, grouped spatial split, split validation |
| `train.py` | XGBoost training, early stopping, model export, model bundle creation |
| `evaluate.py` | Compute all metrics, confusion matrix, per-class reports |
| `explain.py` | SHAP TreeExplainer setup, global/local explanations, human-readable conversion |
| `predict.py` | Load model bundle, validate features, run inference, apply uncertainty logic, return response |

---

# 23. Execution Roadmap

## Phase 1 — Understand and Validate the Dataset

| Item | Detail |
|---|---|
| **Objective** | Confirm FIRMS data integrity, understand distributions, document data quality |
| **Tasks** | 1. Load all three FIRMS CSVs (2022, 2023, 2024) 2. Validate column presence and types 3. Check for missing values 4. Validate coordinate ranges 5. Compute FRP distribution statistics 6. Compute confidence distribution 7. Compute FIRMS `type` distribution 8. Verify timestamp parsing 9. Document zero-variance columns (`satellite`, `instrument`, `version`) 10. Produce data quality report |
| **Input** | `viirs-jpss1_2022_India.csv`, `viirs-jpss1_2023_India.csv`, `viirs-jpss1_2024_India.csv` |
| **Output** | Data quality report (`reports/data_validation_report.md`) |
| **Files created** | `ml/src/data_validation.py`, `ml/reports/data_validation_report.md` |
| **Validation** | Report reviewed, no critical data issues unresolved |
| **Dependencies** | Raw FIRMS CSVs available |
| **Definition of done** | Data quality report completed with row counts, missing values, distributions documented |

## Phase 2 — Freeze Taxonomy and Label Definitions

| Item | Detail |
|---|---|
| **Objective** | Lock down the six-class taxonomy and label definitions |
| **Tasks** | 1. Review canonical taxonomy from ProjectSummary.md 2. Create `configs/taxonomy.yaml` with all six classes 3. Create `label_mapping.json` with class ↔ ID mapping 4. Document each class definition and decision boundaries 5. Confirm with team that taxonomy is final |
| **Input** | ProjectSummary.md §3.3 |
| **Output** | `configs/taxonomy.yaml`, `label_mapping.json` |
| **Files created** | `ml/configs/taxonomy.yaml` |
| **Validation** | All six classes present, IDs are 0–5, display names consistent with project spec |
| **Dependencies** | None |
| **Definition of done** | Taxonomy YAML committed, team-reviewed |

## Phase 3 — Build Baseline Preprocessing

| Item | Detail |
|---|---|
| **Objective** | Create reproducible data cleaning and normalization pipeline |
| **Tasks** | 1. Validate and clean numeric columns 2. Normalize text columns (confidence, daynight) 3. Parse acq_date and acq_time into `timestamp_utc` (with leading-zero-safe time handling) 4. Encode confidence: l→0, n→1, h→2 5. Encode daynight: D→0, N→1 6. Create `preprocessing_config.json` 7. Preserve raw data separately from processed data |
| **Input** | Raw FIRMS CSVs |
| **Output** | Cleaned DataFrame, `preprocessing_config.json` |
| **Files created** | `ml/src/preprocess.py`, `ml/src/config.py` |
| **Validation** | Zero NaN in `timestamp_utc`, confidence values correctly encoded, leading zeros preserved |
| **Dependencies** | Phase 1 completed |
| **Definition of done** | `preprocess.py` can load all three years, produce clean output with timestamps |

## Phase 4 — Build Thermal and Temporal Features

| Item | Detail |
|---|---|
| **Objective** | Compute Group A, B, and C features |
| **Tasks** | 1. Compute `log_frp = log1p(frp)` 2. Compute `thermal_difference = bright_ti4 - bright_ti5` 3. Extract month, day_of_year, day_of_week, hour, minute 4. Compute `is_night` from daynight 5. Compute cyclical encodings: hour_sin, hour_cos, month_sin, month_cos 6. Define missing-value policy for each feature |
| **Input** | Preprocessed FIRMS data |
| **Output** | Feature-enriched DataFrame |
| **Files created/modified** | `ml/src/features.py` |
| **Validation** | Spot-check feature values against manual calculation |
| **Dependencies** | Phase 3 completed |
| **Definition of done** | All Group A/B/C features computed, formulas documented in code |

## Phase 5 — Build Persistence / History Features

| Item | Detail |
|---|---|
| **Objective** | Compute Group D features using leakage-safe rolling windows |
| **Tasks** | 1. Assign H3 cells (resolution 7) to all hotspots 2. Sort by timestamp within each H3 cell 3. Compute rolling counts: observation_count_7d, _30d, _90d 4. Compute active_days_7d, _30d, _90d 5. Compute days_since_first_seen, days_since_previous_detection 6. Compute rolling FRP stats: mean_frp_30d, std_frp_30d, max_frp_30d 7. Compute FRP anomaly features: frp_deviation, frp_ratio_to_baseline, frp_z_score 8. Compute has_history flags 9. **Verify temporal leakage protection** — unit tests confirming no future data used |
| **Input** | Preprocessed FIRMS data with timestamps |
| **Output** | Feature-enriched DataFrame with persistence features |
| **Files created** | `ml/src/persistence.py`, `ml/tests/test_features.py` |
| **Validation** | Unit test: for random sample events, verify historical features use only prior data |
| **Dependencies** | Phase 4 completed, `h3` library available |
| **Definition of done** | Persistence features computed, leakage test passes, features documented |

## Phase 6 — Add Industrial and Land-Cover Context

| Item | Detail |
|---|---|
| **Objective** | Compute Group E and F features |
| **Tasks** | 1. Load industrial facility dataset for India (from OSM enrichment) 2. Compute nearest-facility distances 3. Compute inside_industrial_area, inside_facility_polygon 4. Compute facility counts within 2km, 5km 5. Encode nearest_facility_type 6. Load land-cover data for India 7. Compute land_cover_class, is_tree_cover, is_cropland, is_built_up, is_water, is_bare_land 8. Define missing-value sentinels |
| **Input** | Industrial facility data (from OSM), land-cover raster/lookup, hotspot coordinates |
| **Output** | Fully enriched feature DataFrame |
| **Files created/modified** | `ml/src/features.py` (extend) |
| **Validation** | Spot-check industrial distances against known facility locations |
| **Dependencies** | OSM enrichment pipeline complete (other team member), land-cover data procured |
| **Definition of done** | All Group E/F features computed for available data |

## Phase 7 — Construct and Validate Labels

| Item | Detail |
|---|---|
| **Objective** | Create labelled training dataset using hybrid weak supervision + manual verification |
| **Tasks** | 1. Implement candidate generation rules from §10.3 2. Apply rules to enriched dataset 3. Review candidate distribution across six classes 4. Manually verify a representative subset 5. Create label records with full metadata (source, method, confidence) 6. Version the label set 7. Document label distribution |
| **Input** | Fully enriched feature DataFrame |
| **Output** | Labelled dataset (`data/labelled/labels_v1.csv`) |
| **Files created** | `ml/src/labels.py`, `ml/data/labelled/labels_v1.csv` |
| **Validation** | All six classes represented, verified examples documented, label sources recorded |
| **Dependencies** | Phase 6 completed |
| **Definition of done** | Labelled dataset created with metadata, reviewed for quality |

## Phase 8 — Create Leakage-Safe Train/Validation/Test Splits

| Item | Detail |
|---|---|
| **Objective** | Split labelled data with no temporal or spatial leakage |
| **Tasks** | 1. Apply temporal split (see §11.1) 2. Optionally apply grouped spatial split by H3 cell 3. Verify no temporal overlap 4. Verify class distribution in each split 5. Document split statistics |
| **Input** | Labelled dataset |
| **Output** | Train, validation, test DataFrames |
| **Files created** | `ml/src/splits.py` |
| **Validation** | Split validation checklist (§11.2) all passed |
| **Dependencies** | Phase 7 completed |
| **Definition of done** | Clean splits with no leakage, documented |

## Phase 9 — Train Baseline XGBoost Model

| Item | Detail |
|---|---|
| **Objective** | Train the first working XGBoost multiclass classifier |
| **Tasks** | 1. Load training config from YAML 2. Create sample weights for class balancing 3. Fit XGBoost with early stopping on validation loss 4. Record hyperparameters and training curves 5. Save model checkpoint |
| **Input** | Train/validation splits, training_config.yaml |
| **Output** | Trained model, training log |
| **Files created** | `ml/src/train.py`, `ml/notebooks/train_model.ipynb` |
| **Validation** | Model trains without errors, validation loss decreasing |
| **Dependencies** | Phase 8 completed, Google Colab available |
| **Definition of done** | Model trained, checkpoint saved, training curves recorded |

## Phase 10 — Evaluate and Perform Error Analysis

| Item | Detail |
|---|---|
| **Objective** | Compute all metrics and understand model errors |
| **Tasks** | 1. Compute all required metrics on test set (§13) 2. Generate confusion matrix 3. Analyze errors: industrial anomaly vs normal, forest vs agricultural, non-industrial vs unknown 4. Identify systematic failure patterns 5. Write evaluation report |
| **Input** | Trained model, test split |
| **Output** | `metrics.json`, `reports/evaluation_report.md`, `reports/error_analysis.md` |
| **Files created** | `ml/src/evaluate.py`, `ml/reports/evaluation_report.md` |
| **Validation** | Metrics are plausible, error analysis identifies actionable improvements |
| **Dependencies** | Phase 9 completed |
| **Definition of done** | Evaluation report with actual (not fabricated) metrics, error analysis document |

## Phase 11 — Improve / Tune Model

| Item | Detail |
|---|---|
| **Objective** | Improve model based on error analysis |
| **Tasks** | 1. Address findings from error analysis (feature additions, label corrections, threshold adjustments) 2. Hyperparameter tuning (grid or random search) 3. Re-evaluate on validation set 4. Compare against baseline metrics 5. Select best model |
| **Input** | Error analysis report, validation split |
| **Output** | Improved model |
| **Files created/modified** | `ml/configs/training_config.yaml` (updated) |
| **Validation** | Improved macro F1, no regression on critical class pairs |
| **Dependencies** | Phase 10 completed |
| **Definition of done** | Model improvement documented, best model selected |

## Phase 12 — Implement Confidence and Ambiguity Logic

| Item | Detail |
|---|---|
| **Objective** | Implement post-processing uncertainty handling |
| **Tasks** | 1. Implement `apply_uncertainty_logic()` function (§14.2) 2. Select CONFIDENCE_THRESHOLD using validation set 3. Select AMBIGUITY_MARGIN using validation set 4. Test on validation examples 5. Store thresholds in config |
| **Input** | Model probabilities on validation set |
| **Output** | Uncertainty logic function, calibrated thresholds |
| **Files created/modified** | `ml/src/predict.py` |
| **Validation** | Ambiguous cases are caught, confident predictions are not unnecessarily overridden |
| **Dependencies** | Phase 11 completed |
| **Definition of done** | Thresholds selected, uncertainty logic tested, stored in config |

## Phase 13 — Generate SHAP Explanations

| Item | Detail |
|---|---|
| **Objective** | Implement global and local SHAP explainability |
| **Tasks** | 1. Create SHAP TreeExplainer 2. Compute global feature importance 3. Compute per-class feature importance 4. Implement per-prediction SHAP explanation 5. Implement human-readable conversion 6. Export global importance to model bundle |
| **Input** | Trained model, test data |
| **Output** | SHAP analysis, global importance JSON, explanation function |
| **Files created** | `ml/src/explain.py` |
| **Validation** | Explanations match model behavior, human-readable text is coherent |
| **Dependencies** | Phase 11 completed |
| **Definition of done** | SHAP explanations generated from actual feature values and model contributions |

## Phase 14 — Freeze and Version Final Model

| Item | Detail |
|---|---|
| **Objective** | Lock down model version for prototype |
| **Tasks** | 1. Assign model_version, feature_version, label_version 2. Record all metadata 3. Run final test-set evaluation 4. Confirm no further training changes |
| **Input** | Best model from Phase 11 |
| **Output** | Frozen model with version identifiers |
| **Files created/modified** | `model_metadata.json` |
| **Validation** | All versions documented, metadata complete |
| **Dependencies** | Phase 12, 13 completed |
| **Definition of done** | Model frozen, metadata file populated with actual values |

## Phase 15 — Export Model Bundle

| Item | Detail |
|---|---|
| **Objective** | Create complete versioned model bundle |
| **Tasks** | 1. Export `model.joblib` 2. Export `feature_schema.json` 3. Export `preprocessing_config.json` 4. Export `label_mapping.json` 5. Export `model_metadata.json` 6. Export `metrics.json` with actual metrics 7. Export `shap_global_importance.json` 8. Verify all files present and internally consistent |
| **Input** | Frozen model, all configs |
| **Output** | `ml/models/xgb_pyroclass_v1/` directory |
| **Files created** | Complete model bundle (see §18.2) |
| **Validation** | All 6+ files present, JSON parseable, versions consistent |
| **Dependencies** | Phase 14 completed |
| **Definition of done** | Model bundle passes integrity check |

## Phase 16 — Integrate with FastAPI / Backend

| Item | Detail |
|---|---|
| **Objective** | Provide working inference function for the backend |
| **Tasks** | 1. Implement `classify_hotspot()` function in `predict.py` 2. Implement model loading with caching 3. Implement feature validation 4. Implement full response formatting (§20.1) 5. Test feature parity between training and inference 6. Coordinate with backend engineer on API routes |
| **Input** | Model bundle, feature pipeline |
| **Output** | Working `predict.py` that backend can import |
| **Files created/modified** | `ml/src/predict.py`, `ml/tests/test_predict.py`, `ml/tests/test_feature_parity.py` |
| **Validation** | Feature parity test passes, response matches contract schema |
| **Dependencies** | Phase 15 completed, backend engineer available for coordination |
| **Definition of done** | Backend can call `classify_hotspot()` and receive valid response |

## Phase 17 — Test Against Curated 20-Point Prototype Dataset

| Item | Detail |
|---|---|
| **Objective** | Validate model on the 20 curated demo points |
| **Tasks** | 1. Load 20-point prototype data 2. Compute features for each point 3. Run model inference 4. Compare predicted_class vs expected_demo_category 5. Review confidence and explanations for each point 6. Document discrepancies 7. Verify all required output fields are present |
| **Input** | `pyroclass_20_sites_geospatial_final.csv`, trained model |
| **Output** | 20-point evaluation report |
| **Files created** | `ml/reports/prototype_20_evaluation.md` |
| **Validation** | All 20 points produce valid outputs, SHAP explanations are coherent |
| **Dependencies** | Phase 16 completed, 20-point prototype data finalized |
| **Definition of done** | All 20 points classified with actual model outputs, report completed |

## Phase 18 — Final Demo Validation

| Item | Detail |
|---|---|
| **Objective** | Confirm end-to-end demo readiness |
| **Tasks** | 1. Run full pipeline: raw event → features → classification → explanation 2. Verify backend API returns correct response format 3. Verify dashboard correctly displays classification, confidence, priority, and explanations 4. Walk through all six categories using prototype points 5. Verify unknown_ambiguous behavior works 6. Record actual model outputs (do not fabricate) |
| **Input** | Complete integrated system |
| **Output** | Demo-ready system |
| **Files created** | Final `walkthrough.md` if changes needed |
| **Validation** | The canonical "Definition of Done" sequence (§30 of ProjectSummary) can be completed |
| **Dependencies** | All prior phases, frontend, backend integration |
| **Definition of done** | A judge can perform the full demonstration sequence described in ProjectSummary §30 |

---

# 24. ML Engineer Deliverables

| # | Deliverable | Description | Location |
|---|---|---|---|
| 1 | **Dataset validation report** | Row counts, distributions, missing values, quality issues | `ml/reports/data_validation_report.md` |
| 2 | **Feature specification** | Complete feature list with sources, formulas, types, missing-value policies | `ml/models/xgb_pyroclass_v1/feature_schema.json` + `ml/configs/feature_config.yaml` |
| 3 | **Label specification** | Class definitions, label construction rules, verified label metadata | `ml/configs/taxonomy.yaml` + `ml/data/labelled/` |
| 4 | **Reproducible preprocessing pipeline** | Clean, normalize, parse timestamps, encode categoricals | `ml/src/preprocess.py` + `preprocessing_config.json` |
| 5 | **Reproducible training pipeline** | Feature computation, split, training, early stopping | `ml/src/*.py` + `ml/notebooks/train_model.ipynb` |
| 6 | **XGBoost model** | Trained, versioned, frozen model | `ml/models/xgb_pyroclass_v1/model.joblib` |
| 7 | **Evaluation report** | Actual metrics (macro F1, per-class, confusion matrix) | `ml/reports/evaluation_report.md` + `metrics.json` |
| 8 | **Error analysis** | Systematic misclassification patterns, improvement recommendations | `ml/reports/error_analysis.md` |
| 9 | **SHAP explainability pipeline** | Global importance, per-prediction explanations, human-readable text | `ml/src/explain.py` + `shap_global_importance.json` |
| 10 | **Versioned model bundle** | Complete bundle with all artifacts (see §18.2) | `ml/models/xgb_pyroclass_v1/` |
| 11 | **Backend inference contract** | `classify_hotspot()` function + response schema | `ml/src/predict.py` |
| 12 | **Prototype evaluation results** | Actual model outputs on 20 curated demo points | `ml/reports/prototype_20_evaluation.md` |
| 13 | **ML README / handover documentation** | How to retrain, evaluate, deploy, and maintain the ML component | `ml/README.md` |

---

# 25. Definition of Done

## 25.1 Complete checklist

### DATA
- [ ] India FIRMS data (2022–2024) loads reproducibly
- [ ] Acquisition dates/times are parsed correctly (leading zeros preserved)
- [ ] Timestamps are in UTC
- [ ] Data quality report is produced
- [ ] Zero-variance columns identified and excluded from features

### TAXONOMY
- [ ] Six-class taxonomy is defined and versioned
- [ ] `label_mapping.json` exists with class ↔ ID mapping
- [ ] Display names are consistent across all components
- [ ] Taxonomy version is stored in model metadata

### LABELS
- [ ] Training dataset contains documented labels
- [ ] Each label has: label_source, label_method, verification_status
- [ ] Multiple label sources are distinguished
- [ ] Label version is tracked

### FEATURES
- [ ] All Group A–F features are computed
- [ ] Feature formulas are documented in code
- [ ] Feature schema is versioned
- [ ] Missing-value policy is defined for every feature
- [ ] Feature order is deterministic and documented

### LEAKAGE PREVENTION
- [ ] Historical features use only data before event timestamp
- [ ] Unit test confirms no temporal leakage
- [ ] Train/test split has no temporal overlap
- [ ] No H3 cell appears in both train and test (if grouped split used)
- [ ] FIRMS `type` is not used as a direct feature if used for label construction

### TRAINING
- [ ] XGBoost trains reproducibly (random_state=42)
- [ ] Class imbalance is handled
- [ ] Early stopping is used
- [ ] Hyperparameters are stored in config
- [ ] Training is performed on Google Colab

### VALIDATION
- [ ] Metrics are computed on held-out test set
- [ ] Macro F1 is reported
- [ ] Per-class precision/recall/F1 are reported
- [ ] Confusion matrix is produced
- [ ] Error analysis is completed
- [ ] All reported metrics are from actual experiments

### UNCERTAINTY
- [ ] `unknown_ambiguous` class exists and works
- [ ] Confidence threshold is experimentally selected
- [ ] Ambiguity margin is experimentally selected
- [ ] Post-processing logic is implemented and tested
- [ ] Thresholds are stored in config

### SHAP
- [ ] SHAP TreeExplainer is integrated
- [ ] Global feature importance is computed and saved
- [ ] Per-prediction explanations are generated
- [ ] Human-readable explanation text is derived from actual SHAP values
- [ ] Explanations are NOT hard-coded or fabricated

### MODEL EXPORT
- [ ] `model.joblib` exists
- [ ] `feature_schema.json` exists
- [ ] `preprocessing_config.json` exists
- [ ] `label_mapping.json` exists
- [ ] `model_metadata.json` exists
- [ ] `metrics.json` exists with actual values
- [ ] All versions are consistent across files

### BACKEND INTEGRATION
- [ ] `classify_hotspot()` function exists and works
- [ ] Response schema matches §20.1 contract
- [ ] Feature parity test passes (training == inference)
- [ ] Model loading is cached (not reloaded per request)
- [ ] Model is NOT retrained on every API request

### PROTOTYPE TESTING
- [ ] 4 normal persistent industrial points are evaluated
- [ ] 4 industrial spike/anomaly points are evaluated
- [ ] 4 non-industrial thermal points are evaluated
- [ ] 3 forest/vegetation fire points are evaluated
- [ ] 3 agricultural burning points are evaluated
- [ ] 2 unknown/ambiguous points are evaluated
- [ ] Actual model outputs are recorded (not fabricated)
- [ ] SHAP explanations are generated for all 20 points

---

# 26. Critical Failure Modes

## Failures that must be avoided

| # | Failure | Why it's dangerous | How to prevent |
|---|---|---|---|
| 1 | **Training on only the 20 prototype points** | Creates a weak, overfit model that cannot generalize | Use a large labelled training set; 20 points are demo/evaluation only |
| 2 | **Treating FIRMS `type` as the six-class ground truth** | FIRMS `type` is a 4-value detection category, not the 6-class semantic taxonomy | Use deliberate label construction process (§10) |
| 3 | **Training using only raw FIRMS columns** | Misses the central value: industrial context, land cover, persistence | Implement all feature groups A–F |
| 4 | **Future data leakage in rolling historical features** | Inflates training metrics, model fails on real data | Filter history to `timestamp < T` only; unit test this |
| 5 | **Random row-level split leakage** | Same location in train and test → memorization | Use temporal split and/or grouped spatial split |
| 6 | **Saving only `model.joblib` without schema/config** | Backend cannot validate inputs, silent corruption | Export complete model bundle (§18.2) |
| 7 | **Inconsistent training and inference preprocessing** | Model produces plausible but wrong predictions | Use shared `features.py` code, run parity tests |
| 8 | **Forcing low-confidence predictions into a confident class** | Hides model uncertainty, erodes trust | Implement `unknown_ambiguous` post-processing (§14) |
| 9 | **Confusing classification with priority/anomaly score** | They answer different questions; mixing them corrupts both | Keep as three separate outputs (§15) |
| 10 | **Hard-coding label mappings in multiple places** | Changes break silently when one copy is updated | Single `label_mapping.json` as source of truth |
| 11 | **Reporting fabricated or invented evaluation metrics** | Creates false confidence, misleads stakeholders | Report only actual experiment results in `metrics.json` |
| 12 | **Generating fake/hard-coded SHAP explanations** | Explanations don't match model behavior, misleads users | Generate from actual SHAP TreeExplainer output |

---

# Appendix A — Configuration File Templates

## A.1 `configs/training_config.yaml`

```yaml
# PyroClass ML Training Configuration
# Version: training-config-v1

model:
  type: "XGBClassifier"
  objective: "multi:softprob"
  num_class: 6
  eval_metric: "mlogloss"
  random_state: 42

hyperparameters:
  n_estimators: 500
  max_depth: 6
  learning_rate: 0.1
  subsample: 0.8
  colsample_bytree: 0.8
  min_child_weight: 5
  reg_alpha: 0.1
  reg_lambda: 1.0

early_stopping:
  rounds: 50
  metric: "mlogloss"

class_balancing:
  method: "sample_weight"  # or "balanced_sampling"

uncertainty:
  confidence_threshold: 0.50
  ambiguity_margin: 0.10

anomaly_priority:
  weights:
    frp_deviation: 0.30
    persistence_anomaly: 0.20
    industrial_proximity: 0.15
    spatial_spread: 0.10
    temporal_anomaly: 0.10
    confidence: 0.15
  thresholds:
    high: 75
    medium: 50
```

## A.2 `configs/feature_config.yaml`

```yaml
# PyroClass Feature Configuration
# Version: features-v1

persistence:
  spatial_index: "h3"
  h3_resolution: 7
  windows_days: [7, 30, 90]
  epsilon: 1.0e-6

candidate_rules:
  industrial_distance_m: 2000
  anomaly_z_score: 3.0
  persistence_active_days_threshold: 15
  stability_z_score_threshold: 2.0

deduplication:
  spatial_radius_m: 1000
  temporal_window_minutes: 30

split:
  method: "temporal"
  train_end: "2024-06-30"
  validation_end: "2024-09-30"
  test_end: "2024-12-31"
```

## A.3 `configs/taxonomy.yaml`

```yaml
# PyroClass Classification Taxonomy
# Version: taxonomy-v1

version: "taxonomy-v1"
num_classes: 6

classes:
  - id: 0
    label: "normal_persistent_industrial"
    display_name: "Normal Persistent Industrial"
    description: >
      Known or strongly inferred persistent industrial thermal source
      operating near its historical baseline.

  - id: 1
    label: "industrial_spike_anomaly"
    display_name: "Industrial Spike / Anomaly"
    description: >
      Industrial-associated hotspot showing significant abnormal deviation
      from its historical thermal baseline.

  - id: 2
    label: "non_industrial_thermal_activity"
    display_name: "Non-Industrial Thermal Activity"
    description: >
      Thermal activity not confidently attributable to industrial
      persistence, forest/vegetation fire, or agricultural burning.

  - id: 3
    label: "forest_vegetation_fire"
    display_name: "Forest / Vegetation Fire"
    description: >
      Thermal event consistent with vegetation/forest context and
      transient fire behavior.

  - id: 4
    label: "agricultural_burning"
    display_name: "Agricultural Burning"
    description: >
      Thermal event consistent with cropland/agricultural context and
      seasonal/transient burning behavior.

  - id: 5
    label: "unknown_ambiguous"
    display_name: "Unknown / Ambiguous"
    description: >
      Insufficient or conflicting evidence for a confident semantic class.
```

---

# Appendix B — Key Formulas Quick Reference

```text
# Derived thermal
log_frp             = ln(1 + frp)
thermal_difference  = bright_ti4 - bright_ti5

# Cyclical encoding
hour_sin  = sin(2π × hour / 24)
hour_cos  = cos(2π × hour / 24)
month_sin = sin(2π × (month - 1) / 12)
month_cos = cos(2π × (month - 1) / 12)

# FRP anomaly (30-day window, ε = 1e-6)
frp_deviation        = current_frp - mean_frp_30d
frp_ratio_to_baseline = current_frp / max(mean_frp_30d, ε)
frp_z_score          = (current_frp - mean_frp_30d) / max(std_frp_30d, ε)

# Uncertainty post-processing
if max_prob < CONFIDENCE_THRESHOLD:
    class = unknown_ambiguous
elif max_prob - second_prob < AMBIGUITY_MARGIN:
    class = unknown_ambiguous
else:
    class = argmax(probabilities)
```

---

**END OF DOCUMENT**

*This document is the canonical ML engineering baseline for SIH26162 PyroClass until superseded by an explicitly versioned update. Future coding AIs must treat this as the primary implementation context for the ML component.*




PyroClass — ML Engineer Backend Handoff
Purpose
This document describes the backend interface currently available to the ML engineer for building and integrating the PyroClass classification model. The backend provides cleaned hotspot data, geospatial context, and a standardized feature endpoint. The ML model itself is outside this backend component.
1. Current Architecture
Final cleaned dataset → ingestion layer → PostgreSQL/PostGIS → FastAPI → ML feature endpoint → ML classification model
2. Backend Endpoints
•	GET /hotspots/ — Returns all ingested hotspot records with the full cleaned dataset fields exposed by the API.
•	GET /hotspots/{hotspot_id} — Returns the complete record for one hotspot.
•	GET /hotspots/{hotspot_id}/context — Returns geospatial/context evidence for one hotspot.
•	GET /hotspots/{hotspot_id}/features — Returns the standardized feature vector intended as ML model input.
3. ML Feature Contract
The /features endpoint currently exposes these backend-provided feature groups. The ML engineer determines model-specific preprocessing, feature selection, encoding, and algorithm.
•	Thermal / activity
n, active_days, mean_frp, median_frp, max_frp
•	Historical
year_2022, year_2023, year_2024, historical_data_available
•	Anomaly
base_monthly, cur_monthly, count_ratio, p95_ratio, spike_score
•	Spatial / context
context_type, context_confidence, facility_type, facility_distance_m, industrial_context_score, mining_context_score, industrial_polygon_overlap_osm, mining_polygon_overlap, forest_polygon_overlap, agriculture_polygon_overlap, industrial_features_found, mining_features_found, forest_features_found, agriculture_features_found, nearest_industrial_type, nearest_industrial_distance_m, nearest_mining_distance_m, vegetation_context, agriculture_context, has_osm_context, specific_facility_identified, geospatial_review_status
4. Example Feature Request
GET http://localhost:8000/hotspots/1/features
The response contains hotspot_id and a features object containing the fields listed above.
5. Verified Spatial Example
CASE_01 was verified through the backend as mining/quarry context, with mining_polygon_overlap = true and geospatial_review_status = mining_quarry_candidate. This is geospatial evidence from the cleaned dataset, not an ML prediction.
6. Expected ML Output
The existing PostgreSQL classifications table is designed to store model results with:
•	classification
•	confidence
•	anomaly_score
•	explanation
•	model_version
•	classified_at
•	facility_id
The backend currently does not claim these values are produced by an ML model; they are the planned storage fields for classification results.
7. Integration Boundary
Backend/System Architect: provide reliable hotspot data, geospatial context, and the feature API. ML Engineer: build/train/evaluate the classifier, determine preprocessing and feature usage, and produce the prediction output.
8. Important Notes
•	The final cleaned CSV is the source dataset used for ingestion.
•	20 hotspot records have been successfully loaded into PostgreSQL/PostGIS.
•	The backend uses the Docker PostgreSQL service name 'postgres' for container-to-container access.
•	The /features endpoint is a data handoff interface, not the ML model.
•	Do not treat CASE_01 values as model predictions.
•	If additional ML features are required, coordinate with the backend/system architect before changing the API contract.
9. Repository / Handoff Status
The backend integration has been committed and pushed to the shared main branch. It includes the database connection layer, dataset ingestion, hotspot routes, PostGIS schema, and Docker integration.
Handoff status: READY FOR ML ENGINEER INTEGRATION

