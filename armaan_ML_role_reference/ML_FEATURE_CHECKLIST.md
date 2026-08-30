# ML Feature Checklist: What You Have vs. What You Need

## Quick Status Dashboard

### Your 20-Site CSV: Coverage Analysis

```
46 Current Attributes
│
├─ ✓ Identity (4)
│  ├─ case_id
│  ├─ latitude
│  ├─ longitude
│  └─ h3_cell
│
├─ ✓ Thermal History Aggregate (8)
│  ├─ n (total detections)
│  ├─ active_days (lifetime)
│  ├─ mean_frp
│  ├─ median_frp
│  ├─ max_frp
│  ├─ 2022, 2023, 2024 (annual counts)
│  └─ case_type (preliminary label - NOT your 6-class target)
│
├─ ✓ Anomaly Indicators (4)
│  ├─ base_monthly
│  ├─ cur_monthly
│  ├─ count_ratio (current / baseline)
│  ├─ p95_ratio
│  └─ spike_score (pre-computed anomaly)
│
├─ ✓ OSM Context Flags (10)
│  ├─ context_type (industrial/mining/vegetation/unknown)
│  ├─ context_confidence (0-1)
│  ├─ facility_name
│  ├─ facility_type (mining_quarry, power_plant, etc.)
│  ├─ facility_distance_m
│  ├─ industrial_context_score
│  ├─ mining_context_score
│  ├─ industrial_polygon_overlap_osm (True/False)
│  ├─ mining_polygon_overlap (True/False)
│  ├─ forest_polygon_overlap (True/False)
│  ├─ agriculture_polygon_overlap (True/False)
│  └─ [6 feature count columns]
│
├─ ✓ Quality & Status Flags (6)
│  ├─ has_osm_context
│  ├─ specific_facility_identified
│  ├─ historical_data_available
│  ├─ geospatial_review_status
│  └─ osm_source, context_evidence
│
└─ ✗ CRITICAL MISSING SECTIONS
   ├─ Temporal Features (8 needed)
   ├─ Persistence Features - Rolling Windows (14 needed)
   ├─ Land Cover Details (6 needed)
   ├─ Derived Thermal Features (2 needed)
   └─ Target Class Label (1 CRITICAL)
```

---

## 37 ML Features: Complete Checklist

### GROUP A: Raw Thermal (5 features)

| # | Feature | From Source | Current Status | Need From |
|---|---|---|---|---|
| 1 | `bright_ti4` | FIRMS Column | ✗ Not in 20-site CSV | Raw FIRMS CSV |
| 2 | `bright_ti5` | FIRMS Column | ✗ Not in 20-site CSV | Raw FIRMS CSV |
| 3 | `frp` | FIRMS Column | ✗ Not in 20-site CSV | Raw FIRMS CSV |
| 4 | `confidence_encoded` | FIRMS Column (L→0, N→1, H→2) | ✗ Not computed | Raw FIRMS CSV |
| 5 | `scan, track` | FIRMS Column (optional) | ✗ Not in 20-site CSV | Raw FIRMS CSV |

**Status**: 0/5 ❌ BLOCKER

**Action**: Extract from raw FIRMS files in clean_firms.py

---

### GROUP B: Derived Thermal (2 features)

| # | Feature | Formula | Current Status | Need Computation |
|---|---|---|---|---|
| 6 | `log_frp` | log1p(frp) | ✗ | Compute from FRP |
| 7 | `thermal_difference` | bright_ti4 - bright_ti5 | ✗ | Compute from raw thermal |

**Status**: 0/2 ❌

**Action**: Compute in feature engineering pipeline

---

### GROUP C: Temporal (8 features)

| # | Feature | Source | Current Status | Note |
|---|---|---|---|---|
| 8 | `month` | timestamp.month | ✗ | Need parsed timestamp |
| 9 | `day_of_year` | timestamp.dayofyear | ✗ | Need parsed timestamp |
| 10 | `day_of_week` | timestamp.dayofweek | ✗ | Need parsed timestamp |
| 11 | `hour` | timestamp.hour | ✗ | Need parsed timestamp |
| 12 | `minute` | timestamp.minute | ✗ | Need parsed timestamp |
| 13 | `is_night` | D→0, N→1 | ✗ | From raw FIRMS daynight |
| 14 | `hour_sin` | sin(2π * hour / 24) | ✗ | Cyclical encoding |
| 15 | `hour_cos` | cos(2π * hour / 24) | ✗ | Cyclical encoding |
| 16 | `month_sin` | sin(2π * (month-1) / 12) | ✗ | Cyclical encoding |
| 17 | `month_cos` | cos(2π * (month-1) / 12) | ✗ | Cyclical encoding |

**Status**: 0/10 ❌ BLOCKER (need raw timestamp)

**Action**: Parse acq_date + acq_time in clean_firms.py → create timestamp

---

### GROUP D: Persistence Features (14 features) ⭐ MOST CRITICAL

#### Sub-group D1: Observation Counts (Rolling Windows)

| # | Feature | Window | Current Status | Computation |
|---|---|---|---|---|
| 18 | `observation_count_7d` | 7 days before event | ✗ | H3 cell history lookup |
| 19 | `observation_count_30d` | 30 days before event | ✗ | H3 cell history lookup |
| 20 | `observation_count_90d` | 90 days before event | ✗ | H3 cell history lookup |
| 21 | `has_history_7d` | Binary (count > 0) | ✗ | Derived from count_7d |
| 22 | `has_history_30d` | Binary (count > 0) | ✗ | Derived from count_30d |
| 23 | `has_history_90d` | Binary (count > 0) | ✗ | Derived from count_90d |

**Note**: Your CSV has `n` (total detections) and `active_days` (lifetime), NOT rolling windows. DIFFERENT MEANING.

#### Sub-group D2: Active Days (Rolling Windows)

| # | Feature | Window | Current Status | Computation |
|---|---|---|---|---|
| 24 | `active_days_7d` | Distinct days in 7d | ✗ | H3 cell history lookup |
| 25 | `active_days_30d` | Distinct days in 30d | ✗ | H3 cell history lookup |
| 26 | `active_days_90d` | Distinct days in 90d | ✗ | H3 cell history lookup |

#### Sub-group D3: FRP Statistics (Rolling Windows)

| # | Feature | Window | Current Status | Computation |
|---|---|---|---|---|
| 27 | `mean_frp_7d` | Mean FRP in 7d | ✗ | H3 cell history lookup |
| 28 | `mean_frp_30d` | Mean FRP in 30d | ✗ | H3 cell history lookup |
| 29 | `mean_frp_90d` | Mean FRP in 90d | ✗ | H3 cell history lookup |
| 30 | `median_frp_30d` | Median FRP in 30d | ✗ | H3 cell history lookup |
| 31 | `std_frp_30d` | Std dev FRP in 30d | ✗ | H3 cell history lookup |
| 32 | `max_frp_30d` | Max FRP in 30d | ✗ | H3 cell history lookup |

#### Sub-group D4: Temporal Metrics

| # | Feature | Meaning | Current Status | Computation |
|---|---|---|---|---|
| 33 | `days_since_first_seen` | Days since first detection in H3 cell | ✗ | H3 cell history lookup |
| 34 | `days_since_previous_detection` | Days since prior detection in H3 cell | ✗ | H3 cell history lookup |

**Status**: 0/17 ❌❌ CRITICAL BLOCKER

**Why**: These are THE MOST IMPORTANT features for distinguishing persistent industrial from transient fires. Your CSV has aggregates over all time, not rolling windows.

**Action**: Compute from firms_india_2022_2024_clean.csv by H3 cell with temporal cutoff (T - window)

---

### GROUP E: Industrial Context (6 features)

| # | Feature | Purpose | Current Status | In CSV As | Available |
|---|---|---|---|---|---|
| 35 | `distance_to_nearest_industry_m` | Distance to nearest facility | ✓ USABLE | `facility_distance_m` | ✓ YES |
| 36 | `inside_industrial_area` | Boolean: in industrial polygon | ✓ USABLE | `industrial_polygon_overlap_osm` | ✓ YES |
| 37 | `inside_facility_polygon` | Boolean: in facility boundary | ✓ USABLE | (approx. by mining_polygon_overlap) | ✓ PARTIALLY |
| 38 | `industrial_facility_count_2km` | Count of facilities within 2km | ✗ | NOT IN CSV | ✗ NO |
| 39 | `industrial_facility_count_5km` | Count of facilities within 5km | ✗ | NOT IN CSV | ✗ NO |
| 40 | `nearest_facility_type_encoded` | Facility type (0-7) | ✓ USABLE | `facility_type` | ✓ YES (needs encoding) |

**Status**: 4/6 ✓ (mostly available, 2 missing)

**Action**: 
- Use existing columns for #35, #36, #37, #40
- Need to compute facility counts (#38, #39) from OSM data

---

### GROUP F: Land Cover (6 features)

| # | Feature | Purpose | Current Status | In CSV As | Source Needed |
|---|---|---|---|---|---|
| 41 | `land_cover_class` | Integer land cover class (0-10) | ✗ | NOT IN CSV | ESA WorldCover raster |
| 42 | `is_tree_cover` | Boolean: tree/forest cover | ✓ USABLE | `forest_polygon_overlap` | ✓ APPROXIMATE |
| 43 | `is_cropland` | Boolean: cropland cover | ✓ USABLE | `agriculture_polygon_overlap` | ✓ APPROXIMATE |
| 44 | `is_built_up` | Boolean: urban/built-up | ✗ | NOT IN CSV | ESA WorldCover raster |
| 45 | `is_water` | Boolean: water body | ✗ | NOT IN CSV | ESA WorldCover raster |
| 46 | `is_bare_land` | Boolean: bare/sparse land | ✗ | NOT IN CSV | ESA WorldCover raster |

**Status**: 2/6 ✓ (approximated), 4/6 ✗ (need raster)

**Action**: 
- Download ESA WorldCover 2021 raster for India
- Sample raster for each hotspot location
- Compute all 6 land cover features

---

### TARGET: Class Label (1 feature) ⭐⭐⭐ CRITICAL

| Feature | Options | Current Status | How to Get |
|---|---|---|---|
| `target_class` | industrial_persistent, industrial_spike, non_industrial, forest_fire, ag_burning, unknown | ✗ MISSING | Manual labeling + weak supervision rules |

**Status**: 0/1 ❌❌❌ IMPOSSIBLE TO TRAIN WITHOUT THIS

---

## SUMMARY TABLE

| Group | Features | Have | Need | Status |
|---|---|---|---|---|
| A: Raw Thermal | 5 | 0 | 5 | ❌ Get from raw FIRMS |
| B: Derived Thermal | 2 | 0 | 2 | ❌ Compute |
| C: Temporal | 10 | 0 | 10 | ❌ Parse timestamp |
| D: Persistence | 17 | 0 | 17 | ❌❌ CRITICAL - H3 rolling |
| E: Industrial Context | 6 | 4 | 2 | ✓ MOSTLY OK (2 gaps) |
| F: Land Cover | 6 | 2 | 4 | ⚠️ Partially - need raster |
| **TARGET** | 1 | 0 | 1 | ❌❌❌ BLOCKER |
| **TOTAL** | **47** | **6** | **41** | **87% MISSING** |

---

## Action Items by Team

### ⚠️ BLOCKERS (Can't train without these)

1. **Get Raw FIRMS Files** (Geoprocessing)
   - [ ] Locate viirs-jpss1_2022_India.csv
   - [ ] Locate viirs-jpss1_2023_India.csv
   - [ ] Locate viirs-jpss1_2024_India.csv
   - [ ] Run clean_firms.py to output firms_india_2022_2024_clean.csv

2. **Compute Persistence Features** (Data Pipeline)
   - [ ] Design algorithm for rolling window computation per H3 cell
   - [ ] Ensure temporal cutoff (no future data) in every computation
   - [ ] Output: firms_with_persistence.csv (1.5M rows + 17 features)

3. **Create Training Labels** (ML + Domain Experts)
   - [ ] Define label construction rules
   - [ ] Sample 10K hotspots from full dataset
   - [ ] Manually label 500-1000 samples for verification
   - [ ] Output: labeled_firms_training.csv with target_class

### HIGH PRIORITY (Need soon)

4. **Add Land Cover** (Geoprocessing)
   - [ ] Download ESA WorldCover 2021 for India
   - [ ] Sample raster for each hotspot
   - [ ] Output: land_cover features

5. **OSM Facility Counts** (Data Pipeline)
   - [ ] Compute industrial_facility_count_2km for all hotspots
   - [ ] Compute industrial_facility_count_5km for all hotspots

### NICE-TO-HAVE (Can start model with 35 features)

6. **Facility Type Encoding** (ML)
   - [ ] Create mapping: facility_type → 0-7 numeric
   - [ ] Standardize encoding across dataset

---

## Timeline Impact

If starting TODAY:

| Task | Duration | Dependency | Owner |
|---|---|---|---|
| Get raw FIRMS files | 1 day | None | Geoprocessing |
| Run clean_firms.py | 2-3 days | Raw files | Data Pipeline |
| Design persistence algorithm | 2-3 days | Clean FIRMS | Data Pipeline |
| Compute rolling features | 5-7 days | Algorithm design | Data Pipeline |
| Add land cover | 3-5 days | ESA raster download | Geoprocessing |
| Add OSM facility counts | 2-3 days | Depends on approach | Data Pipeline |
| **Create training labels** | **7-10 days** | **All above** | **ML + Domain Experts** |
| Train model | 3-5 days | Labeled dataset | ML |
| **Total** | **~4-6 weeks** | | |

---

## Conclusion: What to Tell @Armaan Syed

**"We CANNOT train from your 20-site CSV. We're missing 87% of required features and have no labels. But we have a clear path forward:**

1. **Get the full raw FIRMS dataset** (1.5M rows)
2. **Compute 17 persistence features** using rolling H3 cell windows
3. **Add land cover from satellite raster**
4. **Manually label 10K hotspots** to create training dataset
5. **Train XGBoost** on labeled data
6. **Evaluate on 20-site prototype**

**Timeline: 4-6 weeks if teams work in parallel. Your 20-site dataset will be our prototype/test set."**

---

**Want me to build the persistence feature computation script once you have the raw FIRMS data?**
