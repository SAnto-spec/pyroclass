# ML Training Dataset Analysis
## For: @Armaan Syed & Backend Team
## From: ML Engineer Role

---

## Executive Summary

**Current Status**: The 20-site prototype dataset is **ENRICHED but NOT LABELED** for 6-class training.

**What's Missing**: Target labels (`target_class`) and the **FULL TRAINING DATASET** with engineered features.

**Action**: We need to decide how to construct labels and generate the full training dataset systematically.

---

## Part 1: Current 20-Site Dataset Analysis

### Raw Attributes You Have (46 columns)

```
case_id, case_type, latitude, longitude, h3_cell, n, active_days, mean_frp, median_frp, max_frp,
2022, 2023, 2024, base_monthly, cur_monthly, count_ratio, p95_ratio, spike_score,
context_type, context_confidence, facility_name, facility_type, facility_distance_m,
industrial_context_score, mining_context_score,
industrial_polygon_overlap_osm, mining_polygon_overlap, forest_polygon_overlap, agriculture_polygon_overlap,
industrial_features_found, mining_features_found, forest_features_found, agriculture_features_found,
nearest_industrial_name, nearest_industrial_type, nearest_industrial_distance_m,
nearest_mining_name, nearest_mining_distance_m, vegetation_context, agriculture_context,
context_evidence_osm, osm_elements, osm_source_osm,
has_osm_context, specific_facility_identified, historical_data_available, geospatial_review_status
```

### What You CAN Use Directly (Good News ✓)

| Attribute | Purpose | ML Use |
|---|---|---|
| `latitude, longitude` | Location | Compute H3 cell, spatial features |
| `h3_cell` | Spatial grouping | Lookup historical baselines |
| `mean_frp, median_frp, max_frp` | Historical thermal baseline | Compute z-score, deviation |
| `n` | Detection frequency | Persistence indicator |
| `active_days` | Days with detections | Distinguish persistent vs transient |
| `2022, 2023, 2024` | Annual detection counts | Temporal pattern |
| `count_ratio` | current/baseline ratio | Anomaly indicator |
| `spike_score` | Pre-computed anomaly score | Already captures deviation |
| `context_type` | OSM classification | Industrial/mining/vegetation/agriculture |
| `industrial_polygon_overlap_osm` | Inside industrial polygon? | Binary feature |
| `mining_polygon_overlap` | Inside mine? | Binary feature |
| `forest_polygon_overlap` | Inside forest? | Binary feature |
| `agriculture_polygon_overlap` | Inside cropland? | Binary feature |
| `facility_type` | Nearest facility type | Categorical feature |
| `facility_distance_m` | Distance to facility | Continuous feature |

### What You're MISSING ❌

| Item | Why You Need It | Severity |
|---|---|---|
| **Target Class Label** | Need to train supervised classifier | **CRITICAL** |
| **Full Raw FIRMS Data** | Only have 20 sites; need thousands for training | **CRITICAL** |
| **H3 Cell Persistence Features** | Need historical baselines for 1.5M+ hotspots | **CRITICAL** |
| **Temporal Features** | Need hour, minute, day_of_year, hour_sin/cos | **HIGH** |
| **Land Cover Raster Lookup** | Need per-pixel land cover at each hotspot | **HIGH** |
| **FRP Anomaly Features** | Need frp_deviation, frp_z_score (not just spike_score) | **HIGH** |
| **Confidence Encoding** | Need confidence (L/N/H) encoded as 0/1/2 | **MEDIUM** |

---

## Part 2: Feature Engineering Requirements

### Features You Need to Generate (37 total)

From **ML_Engineer_Baseline.md § 8**, here's the complete feature schema:

#### GROUP A: Raw Thermal (5 features)
```
bright_ti4              → From raw FIRMS
bright_ti5              → From raw FIRMS
frp                     → From raw FIRMS
confidence_encoded      → From raw FIRMS, convert L→0, N→1, H→2
scan, track             → From raw FIRMS (optional)
```
**Status**: ❌ Not in your 20-site CSV. Need from raw FIRMS.

#### GROUP B: Derived Thermal (2 features)
```
log_frp = log1p(frp)
thermal_difference = bright_ti4 - bright_ti5
```
**Status**: ❌ Not computed yet. Need to compute from raw data.

#### GROUP C: Temporal (8 features)
```
month, day_of_year, day_of_week, hour, minute
is_night (D→0, N→1)
hour_sin = sin(2π * hour / 24)
hour_cos = cos(2π * hour / 24)
```
**Status**: ❌ Not in CSV. Need timestamp from raw FIRMS.

#### GROUP D: Persistence Features (14 features) ⭐ MOST IMPORTANT
```
observation_count_7d         → Count detections in same H3 cell, past 7 days
observation_count_30d        → Count detections in same H3 cell, past 30 days
observation_count_90d        → Count detections in same H3 cell, past 90 days

active_days_7d, 30d, 90d     → Distinct days with detections (windows)

days_since_first_seen        → When was first detection in this cell?
days_since_previous_detection → When was prior detection in this cell?

mean_frp_7d, 30d, 90d        → Average FRP in each window
median_frp_30d, std_frp_30d, max_frp_30d  → FRP statistics

has_history_7d, 30d, 90d     → Binary: is there any history?
```
**Status**: ✓ PARTIALLY in CSV:
- `n, active_days, mean_frp, median_frp, max_frp` exist
- But these are **aggregated over all time**, not rolling windows
- Need to compute rolling 7/30/90 day windows from raw FIRMS

#### GROUP E: Industrial Context (6 features)
```
distance_to_nearest_industry_m
inside_industrial_area (0/1)
inside_facility_polygon (0/1)
industrial_facility_count_2km
industrial_facility_count_5km
nearest_facility_type_encoded (0-7 categorical)
```
**Status**: ✓ PARTIALLY in CSV:
- `facility_distance_m` → Use as `distance_to_nearest_industry_m`
- `industrial_polygon_overlap_osm` → Use as `inside_industrial_area`
- `facility_type` → Encode to 0-7
- Missing: `industrial_facility_count_2km/5km`, `industrial_facility_count_5km`

#### GROUP F: Land Cover (6 features)
```
land_cover_class (0-10 encoded)
is_tree_cover (0/1)
is_cropland (0/1)
is_built_up (0/1)
is_water (0/1)
is_bare_land (0/1)
```
**Status**: ❌ MISSING completely. 
- Your CSV has `forest_polygon_overlap, agriculture_polygon_overlap` (True/False)
- But need detailed **per-pixel land cover class** from raster (ESA WorldCover or MODIS)

#### GROUP G: FRP Anomaly Features (3 features) ⭐ KEY FOR SPIKE DETECTION
```
frp_deviation = current_frp - mean_frp_30d
frp_ratio_to_baseline = current_frp / max(mean_frp_30d, epsilon)
frp_z_score = (current_frp - mean_frp_30d) / max(std_frp_30d, epsilon)
```
**Status**: ✓ PARTIALLY in CSV:
- `spike_score` exists but is not the same as `frp_z_score`
- Need actual z-score computation for model

---

## Part 3: Label Construction

### Current Situation

Your 20-site CSV has `case_type`:
- `persistent` (10 sites)
- `spike` (6 sites)
- `vegetation_comparison` (4 sites)

**This is NOT your training target.** You need to map to 6-class taxonomy:

| 6-Class Label | Meaning | How to Identify |
|---|---|---|
| `industrial_persistent` | Industrial heat, baseline behavior | High industrial context + Low anomaly score + High persistence |
| `industrial_spike` | Industrial heat, abnormal spike | High industrial context + HIGH anomaly score + Recent escalation |
| `non_industrial` | Some thermal source, not industrial/forest/agriculture | Low industrial context + Not forest/crop context |
| `forest_fire` | Forest/vegetation fire | High forest_polygon_overlap + Transient behavior |
| `ag_burning` | Agricultural burning | High agriculture_polygon_overlap + Cropland context |
| `unknown` | Insufficient evidence | Low confidence or conflicting context |

### Label Construction Strategy (From Baseline § 10)

```
Raw FIRMS hotspots
    ↓
Apply candidate-generation RULES:
    - If: industrial_context_score > 0.7 AND active_days_90d > 15 AND frp_z_score < 2.0
      → Candidate: industrial_persistent
    - If: industrial_context_score > 0.7 AND frp_z_score > 3.0 AND has_history_30d
      → Candidate: industrial_spike
    - If: forest_polygon_overlap AND low industrial_context_score AND transient
      → Candidate: forest_fire
    - Etc.
    ↓
Manual verification of representative samples
    ↓
Curated labeled training dataset
```

---

## Part 4: What You MUST DO to Train

### TASK 1: Get Full Raw FIRMS Dataset ❌

**Current**: You only have 20 enriched sites.
**Need**: Load all 1.5M+ FIRMS hotspots from raw CSVs:
- viirs-jpss1_2022_India.csv
- viirs-jpss1_2023_India.csv
- viirs-jpss1_2024_India.csv

**Output**: `firms_india_2022_2024_clean.csv` with columns:
```
hotspot_id, latitude, longitude, timestamp, acq_date, acq_time,
bright_ti4, bright_ti5, frp, confidence, daynight, scan, track, 
satellite, instrument, version, firms_type,
year, month, day, hour, minute, day_of_year,
hour_sin, hour_cos, month_sin, month_cos,
confidence_encoded, is_night
```

**Use existing script**: `dataset/clean_firms.py` already does this!

### TASK 2: Compute H3 Cells & Persistence Features ❌

**Current**: You have H3 cells for only 20 sites.
**Need**: Compute H3 + persistence features for all 1.5M hotspots.

**For each hotspot at time T:**
```
h3_cell = assign_h3(latitude, longitude, resolution=7)

# Look back in time ONLY (no future data)
history_before_T = all_hotspots_in_same_h3_cell[timestamp < T]

observation_count_7d = len(history_before_T[T - 7days : T])
observation_count_30d = len(history_before_T[T - 30days : T])
observation_count_90d = len(history_before_T[T - 90days : T])

mean_frp_30d = history_before_T[T - 30days : T]['frp'].mean()
std_frp_30d = history_before_T[T - 30days : T]['frp'].std()
max_frp_30d = history_before_T[T - 30days : T]['frp'].max()

frp_z_score = (current_frp - mean_frp_30d) / max(std_frp_30d, epsilon=1e-6)
```

**Use existing script**: `dataset/h3_prototype_analysis.py` as a template, adapt for full dataset.

### TASK 3: Add OSM Context for All 1.5M ❌

**Current**: You have OSM enrichment for only 20 sites.
**Need**: OSM context for all 1.5M hotspots (or representative sample for training).

**Options:**
1. Query Overpass API for all 1.5M (SLOW, rate-limited, expensive)
2. Pre-compute OSM context on a grid, then do spatial join with hotspots (FAST)
3. For training: sample 10K-50K hotspots randomly, enrich those, train on sample

**Recommended**: Option 3 (fastest for MVP).

**Use existing script**: `dataset/osm_enrichment.py` as template.

### TASK 4: Add Land Cover Data ❌

**Current**: You have `forest_polygon_overlap` (True/False).
**Need**: Detailed land cover class at each hotspot (0-10 encoded).

**Options:**
1. ESA WorldCover 2021 (10m resolution, 11 classes)
2. MODIS Land Cover (500m resolution)
3. Copernicus Global Land Cover (100m)

**Recommended**: ESA WorldCover 2021 (best balance of resolution + accuracy).

**Implementation**:
```python
import rasterio

# For each hotspot (lat, lon):
land_cover_raster = rasterio.open('ESA_WorldCover_2021.tif')
pixel_value = land_cover_raster.sample([(lon, lat)])[0]
land_cover_class = pixel_value  # 0-10

is_tree_cover = land_cover_class in [10, 20]  # ESA classes for trees
is_cropland = land_cover_class in [40]
is_built_up = land_cover_class in [50]
is_water = land_cover_class in [80]
is_bare_land = land_cover_class in [60, 90, 100]
```

### TASK 5: Label the Training Dataset ❌

**Current**: 20 sites are not labeled.
**Need**: Labels for 10K-100K training hotspots.

**Strategy:**
```
1. Apply rule-based candidate generation to all training hotspots
2. Manually verify representative samples (500-1000 hotspots)
3. Use verified labels to refine rules
4. Apply refined rules to entire dataset
5. For ambiguous cases, assign unknown
```

**Create**: `labeled_firms_training.csv` with columns:
```
hotspot_id, latitude, longitude, timestamp, h3_cell,
[36 engineered features from groups A-G],
target_class,  ← THE CRITICAL LABEL
label_source, label_confidence, verification_status
```

### TASK 6: Split Train/Val/Test (Temporal) ❌

**Recommended split:**
```
Train:      2022-01-01 to 2023-12-31 (2 years)
Validation: 2024-01-01 to 2024-09-30 (9 months)
Test:       2024-10-01 to 2024-12-31 (3 months, NEVER seen during training)
Prototype:  20 curated sites (separate, for demo only)
```

---

## Part 5: Answer to @Armaan Syed

### Can you train from the raw 20-site data?

**NO.** Here's why:

| Issue | Impact | Severity |
|---|---|---|
| Only 20 samples | XGBoost needs at least 1000-5000 labeled examples | **BLOCKER** |
| No target labels | Can't train supervised classifier without labels | **BLOCKER** |
| Missing raw FIRMS columns | Don't have bright_ti4, bright_ti5, confidence, timestamp | **BLOCKER** |
| Missing temporal features | Don't have hour, minute, cyclical encodings | **BLOCKER** |
| Missing land cover | Don't have per-pixel land cover class | **BLOCKER** |
| Rolling windows not computed | Have aggregate stats, not 7/30/90 day windows | **BLOCKER** |

### Exactly what attributes do you need?

**37 features organized in 7 groups:**

```
GROUP A: Raw Thermal (5)
├─ bright_ti4 ✓ In raw FIRMS
├─ bright_ti5 ✓ In raw FIRMS
├─ frp ✓ In raw FIRMS
├─ confidence_encoded ✗ Need to compute from raw FIRMS
└─ scan, track ✓ In raw FIRMS (optional)

GROUP B: Derived Thermal (2)
├─ log_frp ✗ Need to compute
└─ thermal_difference ✗ Need to compute

GROUP C: Temporal (8)
├─ month, day_of_year, day_of_week, hour, minute ✗ Need to parse timestamp
├─ is_night ✗ Need from raw FIRMS daynight column
├─ hour_sin, hour_cos ✗ Need to compute

GROUP D: Persistence (14) ⭐ CRITICAL
├─ observation_count_7d/30d/90d ✗ Need rolling windows
├─ active_days_7d/30d/90d ✗ Need rolling windows
├─ days_since_first_seen ✗ Need computation
├─ days_since_previous_detection ✗ Need computation
├─ mean/median/std/max_frp_7d/30d/90d ✗ Need rolling windows (only totals in CSV)
└─ has_history_7d/30d/90d ✗ Need binary flags

GROUP E: Industrial Context (6)
├─ distance_to_nearest_industry_m ✓ In CSV as facility_distance_m
├─ inside_industrial_area ✓ In CSV as industrial_polygon_overlap_osm
├─ inside_facility_polygon ✓ In CSV as mining_polygon_overlap
├─ industrial_facility_count_2km ✗ Not in CSV
├─ industrial_facility_count_5km ✗ Not in CSV
└─ nearest_facility_type_encoded ✓ In CSV as facility_type

GROUP F: Land Cover (6)
├─ land_cover_class ✗ Need from raster
├─ is_tree_cover ✓ Approximated by forest_polygon_overlap
├─ is_cropland ✓ Approximated by agriculture_polygon_overlap
├─ is_built_up ✗ Not in CSV
├─ is_water ✗ Not in CSV
└─ is_bare_land ✗ Not in CSV

GROUP G: FRP Anomaly (3)
├─ frp_deviation ✗ Need to compute
├─ frp_ratio_to_baseline ✗ Need to compute
└─ frp_z_score ✗ Need actual z-score (spike_score is different)

TARGET LABEL (1)
└─ target_class ✗ MISSING - Need to label manually
```

**Legend:** ✓ Available, ✗ Missing or needs computation

---

## Part 6: Implementation Roadmap

### Phase 1: Extract & Clean Full FIRMS Dataset (Geoprocessing Team)
**Deliverable**: `firms_india_2022_2024_clean.csv` (1.5M rows)
- Load 3 yearly FIRMS CSVs
- Validate coordinates
- Parse timestamps
- Create temporal features (month, hour, etc.)
- Encode categorical columns (confidence, daynight)
- Output: hotspot_id, lat, lon, timestamp, bright_ti4, bright_ti5, frp, confidence_encoded, daynight, scan, track, year, month, hour, ...

**Script**: Use/enhance `dataset/clean_firms.py`

---

### Phase 2: Compute H3 + Persistence Features (Data Pipeline Team)
**Input**: firms_india_2022_2024_clean.csv
**Deliverable**: firms_with_persistence.csv (1.5M rows + persistence features)
- Assign H3 cells (resolution 7)
- **FOR EACH HOTSPOT**, compute rolling features from PRIOR detections only:
  - observation_count_7d/30d/90d
  - active_days_7d/30d/90d
  - mean/std/max_frp_7d/30d/90d
  - frp_z_score, frp_deviation, frp_ratio
  - days_since_first_seen, days_since_previous_detection

**Critical**: MUST use temporal cutoff (T - window) to prevent leakage

**Script**: Adapt `dataset/h3_prototype_analysis.py` for full dataset

---

### Phase 3: Add Geospatial Context (Geoprocessing Team)
**Input**: firms_with_persistence.csv
**Deliverable**: firms_with_geo_context.csv

Sub-task 3a: Add OSM Context
- Query Overpass or pre-computed grid for industrial facilities, mines, vegetation polygons
- Compute: distance_to_nearest_industry_m, industrial_facility_count_2km, etc.
- Script: Adapt `dataset/osm_enrichment.py`

Sub-task 3b: Add Land Cover
- Download ESA WorldCover 2021 raster for India
- For each hotspot, sample raster → land_cover_class
- Compute binary flags: is_tree_cover, is_cropland, etc.
- Script: New Python script using rasterio

---

### Phase 4: Label Training Dataset (ML Team + Manual Review)
**Input**: firms_with_geo_context.csv
**Deliverable**: labeled_firms_training.csv (10K-100K labeled rows)

Sub-task 4a: Apply Candidate Generation Rules
```python
for idx, row in df.iterrows():
    if (row['industrial_context_score'] > 0.7 and 
        row['active_days_90d'] > 15 and 
        row['frp_z_score'] < 2.0):
        candidate_class = 'industrial_persistent'
    elif (row['industrial_context_score'] > 0.7 and 
          row['frp_z_score'] > 3.0):
        candidate_class = 'industrial_spike'
    elif row['is_forest_cover'] and row['industrial_context_score'] < 0.3:
        candidate_class = 'forest_fire'
    # ... more rules
    else:
        candidate_class = 'unknown'
```

Sub-task 4b: Manual Verification
- Sample 500-1000 hotspots with assigned classes
- Domain experts verify each classification
- Flag incorrect rules for refinement

Sub-task 4c: Label Entire Dataset
- Apply refined rules to all hotspots
- Output: labeled_firms_training.csv with target_class column

---

### Phase 5: Train Model (ML Team)
**Input**: labeled_firms_training.csv
**Output**: model.pkl, feature_schema.json, metrics.json

Steps:
1. Temporal split: train/val/test (no overlap)
2. Handle class imbalance (sample weights)
3. Train XGBoost (n_estimators=500, max_depth=6, ...)
4. Evaluate macro-F1, per-class metrics
5. SHAP analysis
6. Version model and feature schema

---

### Phase 6: Prototype Demo (ML Team)
**Input**: pyroclass_20_sites_geospatial_final.csv + trained model
**Output**: demo_results.json (20 sites with predictions + SHAP)

Steps:
1. Manually label 20 sites with target_class (expected_demo_category)
2. Compute features for each of 20 sites using full dataset baseline
3. Run model.predict_proba() → class probabilities
4. Apply post-processing (unknown handling)
5. Compute SHAP values → top 3 explanation factors
6. Compute priority/anomaly score
7. Output JSON with all explanations for dashboard

---

## Part 7: Recommended Next Steps

### For Geoprocessing Team (Immediate)

1. **Run `clean_firms.py`** on full 2022-2024 FIRMS CSVs
   - Output: firms_india_2022_2024_clean.csv
   - Verify row counts

2. **Run `h3_prototype_analysis.py`** adapted for full dataset
   - Compute H3 + persistence features for all 1.5M rows
   - Output: firms_with_persistence.csv

### For ML Team (Next)

1. **Wait for phases 1-3 to complete**

2. **Then**:
   - Extract sample of 10K hotspots for label construction
   - Apply candidate-generation rules
   - Manually label 500 samples for verification
   - Train initial model to test feature pipeline

3. **In Parallel**:
   - Design label-construction rules (IF-THEN)
   - Prepare SHAP explanation templates
   - Design backend inference API contract

### Key Decision: Training Dataset Size

**Question**: Do you have capacity to label 10K hotspots manually?

- **Option A**: Label 1K-2K hotspots manually (faster, smaller model)
- **Option B**: Label 5K-10K hotspots (better, more representative)
- **Option C**: Use weak supervision (rules only, no manual verification) - RISKY

**Recommendation**: Option B (5K hotspots) with phased manual verification.

---

## Conclusion

**In short**:
- ❌ **Can't train from 20-site dataset alone** (too small, missing labels)
- ✓ **Existing scripts are good foundation** (clean_firms.py, h3 analysis, osm_enrichment)
- 🔄 **Need to scale pipeline to 1.5M hotspots** with persistence features + land cover + labels
- 📋 **Need 37 features**, not 46 attributes in your current CSV

**Timeline**: 4-6 weeks if teams work in parallel (phase 1-3: 2-3 weeks, phase 4: 1-2 weeks, phase 5-6: 1 week)

---

**Questions? I'm ready to build the ML pipeline once you have the full labeled dataset.**
