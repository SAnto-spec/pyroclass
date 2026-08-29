# Answer to @Armaan Syed's Question
## "Can you train from the raw dataset or do you need specific attributes?"

---

## TL;DR

**NO, you CANNOT train from the 20-site finalized CSV.**

**You ARE missing 41 out of 47 attributes needed (87%), including:**
- **Target class labels** (BLOCKER - can't train supervised model without labels)
- **Full raw FIRMS data** (only have 20 sites, need 1.5M+ for training)
- **Temporal features** (hour, minute, day_of_week, cyclical encodings)
- **Persistence features** (17 rolling window features - THE MOST IMPORTANT)
- **Land cover details** (need per-pixel raster, not just polygon overlap flags)

---

## What You HAVE vs. What You NEED

### ✓ What's Available (6/47)

Your 20-site CSV provides:
1. `latitude, longitude` — Location ✓
2. `h3_cell` — Spatial grouping ✓
3. `facility_distance_m` → Use as distance_to_nearest_industry_m ✓
4. `industrial_polygon_overlap_osm` → Use as inside_industrial_area ✓
5. `facility_type` → Encode as nearest_facility_type_encoded ✓
6. `mining_polygon_overlap, forest_polygon_overlap` → Approximate is_tree_cover, is_cropland ✓

### ❌ What's MISSING (41/47)

#### CATEGORY 1: Raw FIRMS Thermal Data (5 missing)
```
bright_ti4, bright_ti5, frp, confidence_encoded, scan, track
↳ Source: Raw FIRMS CSV files (not in your 20-site dataset)
```

#### CATEGORY 2: Temporal Features (10 missing)
```
month, day_of_year, day_of_week, hour, minute, is_night,
hour_sin, hour_cos, month_sin, month_cos
↳ Reason: Need timestamp, which requires parsing acq_date + acq_time
```

#### CATEGORY 3: Persistence Features - Rolling Windows (17 missing) ⭐ CRITICAL
```
observation_count_7d, observation_count_30d, observation_count_90d,
active_days_7d, active_days_30d, active_days_90d,
mean_frp_7d, mean_frp_30d, mean_frp_90d,
median_frp_30d, std_frp_30d, max_frp_30d,
days_since_first_seen, days_since_previous_detection,
has_history_7d, has_history_30d, has_history_90d

↳ Why missing: Your CSV has AGGREGATE stats (lifetime).
   Need ROLLING WINDOWS computed from ALL 1.5M hotspots
   for each H3 cell over 7/30/90 day periods.
   
↳ Why CRITICAL: These distinguish "persistent industrial" from "transient fire"
   - Persistent: High observation_count_90d, high active_days_90d, LOW frp_z_score
   - Spike/Anomaly: HIGH frp_z_score, history exists, recent escalation
   - Transient fire: LOW observation counts, LOW active_days
```

#### CATEGORY 4: Derived Thermal Features (2 missing)
```
log_frp = log1p(frp)
thermal_difference = bright_ti4 - bright_ti5
↳ Need to compute from raw FIRMS data
```

#### CATEGORY 5: Land Cover Details (4 missing)
```
land_cover_class, is_built_up, is_water, is_bare_land
↳ Your CSV has: forest_polygon_overlap, agriculture_polygon_overlap (polygon flags only)
↳ Need: Per-pixel land cover raster (ESA WorldCover 2021 or MODIS)
```

#### CATEGORY 6: OSM Facility Counts (2 missing)
```
industrial_facility_count_2km, industrial_facility_count_5km
↳ Not computed in your current enrichment pipeline
```

#### CATEGORY 7: Target Class Label (1 MISSING - THE BLOCKER) ❌❌❌
```
target_class = one of:
  - normal_persistent_industrial
  - industrial_spike_anomaly
  - non_industrial_thermal_activity
  - forest_vegetation_fire
  - agricultural_burning
  - unknown_ambiguous

↳ Your CSV has: case_type (persistent/spike/vegetation_comparison)
↳ Problem: case_type is PRELIMINARY and does NOT map 1:1 to 6-class taxonomy
↳ Impact: CANNOT TRAIN SUPERVISED CLASSIFIER WITHOUT REAL LABELS
```

---

## The Problem Explained Simply

```
Your 20-site CSV = Enriched PROTOTYPE dataset
                   Good for: Demonstrating model on curated examples
                   Bad for: Training XGBoost (too small, no labels, incomplete features)

Training requirement: 10,000 - 100,000 labeled examples
                      with 47 engineered features
                      temporal split (no data leakage)
                      balanced across 6 classes

You have: 20 examples
          6 of 47 features
          no labels
          no temporal features
          no persistence features (rolling windows)
```

---

## Exactly Which Attributes You Need

### For Training (in order of importance):

#### MUST-HAVE (Can't proceed without):

| # | Attribute | Type | Why | Source |
|---|---|---|---|---|
| 1 | `target_class` | Categorical (6 classes) | CANNOT TRAIN WITHOUT LABELS | Manual labeling + rules |
| 2-17 | Persistence features (17 total) | Float/Int | Distinguish persistent vs transient | Compute from 1.5M FIRMS data |
| 18-22 | Temporal features (hour, minute, cyclic) | Float/Int | Capture time-of-day patterns | Parse timestamp from FIRMS |
| 23-27 | Raw thermal (bright_ti4/5, frp, confidence) | Float | Core model input | Raw FIRMS CSV |
| 28-29 | Land cover raster samples | Float/Int | Contextual information | ESA WorldCover 2021 |

#### SHOULD-HAVE (Won't break model, but helpful):

| Attribute | Type | Why | Source |
|---|---|---|---|
| Derived thermal (log_frp, thermal_diff) | Float | Normalize scale, capture relationships | Compute from raw thermal |
| OSM facility counts (2km, 5km) | Int | Count-based industrial context | OSM query results |
| Cyclical month encoding | Float | Capture seasonality | Compute from month |

#### NICE-TO-HAVE (Optional):

- scan, track (detection geometry)
- Full SHAP interpretation templates

---

## Specific Feature Requirements

### For 37-Feature Baseline Model:

```
GROUP A: Raw Thermal (5)
├─ bright_ti4 ✗ NEED
├─ bright_ti5 ✗ NEED
├─ frp ✗ NEED
├─ confidence_encoded ✗ NEED
└─ scan, track ✗ NEED

GROUP B: Derived Thermal (2)
├─ log_frp ✗ NEED (compute from frp)
└─ thermal_difference ✗ NEED (compute from bright_ti4/5)

GROUP C: Temporal (8)
├─ month, day_of_year, hour, minute ✗ NEED
├─ is_night ✗ NEED
└─ hour_sin, hour_cos, month_sin, month_cos ✗ NEED

GROUP D: Persistence (14) ⭐⭐⭐ CRITICAL
├─ observation_count_7d, 30d, 90d ✗ NEED
├─ active_days_7d, 30d, 90d ✗ NEED
├─ mean/std/max_frp_7d/30d/90d ✗ NEED
└─ has_history_7d/30d/90d ✗ NEED

GROUP E: Industrial Context (6)
├─ distance_to_nearest_industry_m ✓ HAVE (facility_distance_m)
├─ inside_industrial_area ✓ HAVE (industrial_polygon_overlap_osm)
├─ inside_facility_polygon ✓ HAVE (mining_polygon_overlap approx.)
├─ industrial_facility_count_2km ✗ NEED
├─ industrial_facility_count_5km ✗ NEED
└─ nearest_facility_type_encoded ✓ HAVE (facility_type + encoding)

GROUP F: Land Cover (6)
├─ land_cover_class ✗ NEED
├─ is_tree_cover ✓ HAVE (forest_polygon_overlap approx.)
├─ is_cropland ✓ HAVE (agriculture_polygon_overlap approx.)
├─ is_built_up ✗ NEED
├─ is_water ✗ NEED
└─ is_bare_land ✗ NEED

GROUP G: FRP Anomaly (3)
├─ frp_deviation ✗ NEED (compute)
├─ frp_ratio_to_baseline ✗ NEED (compute)
└─ frp_z_score ✗ NEED (compute)

TARGET (1)
└─ target_class ✗ NEED (CRITICAL!)

TOTAL: 41/47 MISSING (87%)
```

---

## How to Generate Them Consistently

### Step 1: Get Full Raw FIRMS Dataset
**Action**: Load 3 yearly FIRMS CSVs (2022, 2023, 2024)
**Output**: firms_india_2022_2024_clean.csv (1.5M rows)
**Use**: `dataset/clean_firms.py` (already exists)

### Step 2: Compute Persistence Features
**Action**: For each H3 cell, compute rolling statistics from prior detections
**Pseudocode**:
```python
for event in all_events_sorted_by_timestamp:
    h3_cell = assign_h3(event.latitude, event.longitude)
    
    # Look ONLY at prior events (temporal cutoff!)
    history = all_events_in_same_cell[timestamp < event.timestamp]
    
    # 7-day window
    history_7d = history[timestamp >= event.timestamp - 7days]
    observation_count_7d = len(history_7d)
    mean_frp_7d = history_7d['frp'].mean()
    # ... repeat for 30d, 90d windows
    
    # Compute anomaly
    frp_z_score = (event.frp - mean_frp_30d) / std_frp_30d
```
**Output**: firms_with_persistence.csv (1.5M rows + 17 features)

### Step 3: Add Land Cover
**Action**: Sample ESA WorldCover 2021 raster at each hotspot
**Pseudocode**:
```python
with rasterio.open('ESA_WorldCover_2021.tif') as src:
    for hotspot in df:
        pixel = src.sample([(hotspot.lon, hotspot.lat)])[0]
        land_cover_class = pixel[0]
        is_tree_cover = land_cover_class in [10, 20]
        is_cropland = land_cover_class in [40]
        # ... etc
```
**Output**: firms_with_landcover.csv

### Step 4: Create Labels
**Action**: Apply rule-based candidate generation + manual verification
**Pseudocode**:
```python
for hotspot in df:
    if (hotspot.industrial_context_score > 0.7 and 
        hotspot.active_days_90d > 15 and 
        hotspot.frp_z_score < 2.0):
        candidate_class = 'normal_persistent_industrial'
    elif (hotspot.industrial_context_score > 0.7 and 
          hotspot.frp_z_score > 3.0):
        candidate_class = 'industrial_spike_anomaly'
    # ... more rules
    else:
        candidate_class = 'unknown_ambiguous'

# Manually verify 500-1000 samples
# Refine rules
# Apply to entire dataset
```
**Output**: labeled_firms_training.csv (with target_class column)

---

## Timeline to Get Training-Ready Dataset

| Phase | Task | Duration | Dependencies | Owner |
|---|---|---|---|---|
| 1 | Extract + clean raw FIRMS | 2-3 days | Raw files accessible | Geoprocessing |
| 2 | Compute persistence features | 5-7 days | Clean FIRMS output | Data Pipeline |
| 3 | Add land cover from raster | 3-5 days | ESA WorldCover download | Geoprocessing |
| 4 | Create training labels | 7-10 days | All above + domain experts | ML + Experts |
| 5 | Split train/val/test | 1 day | Labeled dataset | ML |
| **Total** | | **~4 weeks** | | |

---

## What You Tell @Armaan Syed

```
"Hi Armaan,

We can't train from the 20-site CSV as-is. Here's why:

❌ BLOCKERS:
   1. No target class labels (have case_type, but not 6-class labels)
   2. Only 20 samples (need 10K-100K for supervised learning)
   3. Missing 17 persistence features (most important for distinguishing industrial from transient)
   4. Missing temporal features (hour, minute, day_of_week, cyclical encodings)
   5. Missing land cover raster data (only have polygon overlap flags)

✓ GOOD NEWS:
   - We have 6 of the 47 attributes you need
   - Existing scripts (clean_firms.py, h3 analysis, OSM enrichment) are good foundation
   - We know EXACTLY which attributes to generate

NEXT STEPS:
   1. Get full raw FIRMS files (1.5M rows from 2022-2024)
   2. Compute persistence features for all hotspots (rolling windows by H3 cell)
   3. Sample land cover raster for each location
   4. Create training labels (rules + manual verification)
   5. Train XGBoost

TIMELINE: 4 weeks if we work in parallel

Your 20-site dataset will become our PROTOTYPE/TEST SET (not training set).
We'll train on 10K-100K labeled hotspots from the full dataset.

Ready to proceed?"
```

---

## Summary Table for Your Team

| Question | Answer |
|---|---|
| Can you train from 20-site CSV? | ❌ NO |
| Why not? | Too small (need 10K+), no labels, 87% features missing |
| Which features do you HAVE? | 6: location, H3, some OSM context |
| Which features do you NEED? | 41: raw thermal, temporal, persistence (17!), land cover, labels |
| What's BLOCKING training? | LABELS (target_class) + persistence features |
| Can you generate them consistently? | YES - clear algorithm, existing scripts as foundation |
| How long will it take? | 4 weeks if teams work in parallel |
| Use for 20-site CSV? | Prototype/test set (NOT training) |

---

**Ready to build the feature engineering pipeline once you have the raw FIRMS data.**
