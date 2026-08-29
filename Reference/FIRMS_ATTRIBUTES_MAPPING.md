================================================================================
NASA FIRMS VIIRS DATA ATTRIBUTES MAPPING FOR ML MODEL TRAINING
================================================================================
Source: https://www.earthdata.nasa.gov/data/tools/firms/active-fire-data-attributes-modis-viirs
Data Type: VIIRS 375m Active Fire Data (NOAA-20 / JPSS-1)
================================================================================

SECTION 1: RAW FIRMS ATTRIBUTES (What NASA provides in CSV)
================================================================================

Column Name          | Type     | Description                        | Example Value
---------------------|----------|------------------------------------|-----------------
latitude             | float    | Center of 375m fire pixel          | 23.77988
longitude            | float    | Center of 375m fire pixel          | 86.38999
bright_ti4           | float    | VIIRS I-4 brightness temp (Kelvin) | 290.5
bright_ti5           | float    | VIIRS I-5 brightness temp (Kelvin) | 288.2
frp                  | float    | Fire Radiative Power (MW)          | 2.9
scan                 | float    | Along-scan pixel size (km)         | 0.375
track                | float    | Along-track pixel size (km)        | 0.375
acq_date             | string   | Acquisition date (YYYY-MM-DD)      | 2024-08-15
acq_time             | string   | Acquisition time (HHMM UTC)        | 1430
satellite            | string   | Satellite identifier               | N20 (NOAA-20)
confidence           | string   | Detection confidence level         | l, n, or h
version              | string   | Collection version                 | 1.0NRT
bright_ti31          | float    | MODIS Channel 31 brightness (Kelvin) | Not in VIIRS (skip)
type                 | int      | Inferred hotspot type             | 0, 1, 2, 3
daynight             | string   | Day or Night detection            | D or N

TOTAL RAW COLUMNS FROM FIRMS: 13
================================================================================

SECTION 2: ML MODEL FEATURE REQUIREMENTS (37 features needed)
================================================================================

GROUP A: RAW THERMAL FEATURES (5 from FIRMS directly)
--------------------------------------------------
Feature Name              | Source Column  | Type   | Range/Values | Status
--------------------------|----------------|--------|--------------|--------
bright_ti4                | bright_ti4     | float  | 280-330 K    | ✓ HAVE
bright_ti5                | bright_ti5     | float  | 280-330 K    | ✓ HAVE
frp                       | frp            | float  | 0-500 MW     | ✓ HAVE
confidence_encoded        | confidence     | int    | 0, 1, 2      | COMPUTE (l→0, n→1, h→2)
scan                      | scan           | float  | 0.1-1.0 km   | ✓ HAVE

GROUP B: DERIVED THERMAL FEATURES (2 computed from GROUP A)
-----------------------------------------------------------
Feature Name              | Formula           | Type   | Status
--------------------------|-------------------|--------|--------
log_frp                   | ln(1 + frp)       | float  | COMPUTE
thermal_difference        | bright_ti4 - bright_ti5 | float | COMPUTE

GROUP C: TEMPORAL FEATURES (8 from acq_date + acq_time)
------------------------------------------------------
Feature Name              | Source Column    | Type   | Range/Values | Status
--------------------------|------------------|--------|--------------|--------
month                     | acq_date         | int    | 1-12         | EXTRACT & COMPUTE
day_of_year               | acq_date         | int    | 1-366        | EXTRACT & COMPUTE
day_of_week               | acq_date         | int    | 0-6 (Mon-Sun)| EXTRACT & COMPUTE
hour                      | acq_time         | int    | 0-23         | PARSE acq_time (HHMM)
minute                    | acq_time         | int    | 0-59         | PARSE acq_time (HHMM)
is_night                  | daynight         | int    | 0 (D), 1 (N) | ENCODE
hour_sin                  | hour             | float  | sin(2π*h/24) | COMPUTE (cyclical)
hour_cos                  | hour             | float  | cos(2π*h/24) | COMPUTE (cyclical)
month_sin                 | month            | float  | sin(2π*(m-1)/12) | COMPUTE (cyclical)
month_cos                 | month            | float  | cos(2π*(m-1)/12) | COMPUTE (cyclical)

GROUP D: PERSISTENCE FEATURES (14 from H3 cell history lookups)
--------------------------------------------------------------
Feature Name                   | Type   | Source              | Computation
-------------------------------|--------|---------------------|------------------------------------------
observation_count_7d           | int    | H3 cell query       | COUNT(*) WHERE h3_cell=$cell AND timestamp<$T AND timestamp>=$T-7d
observation_count_30d          | int    | H3 cell query       | COUNT(*) WHERE h3_cell=$cell AND timestamp<$T AND timestamp>=$T-30d
observation_count_90d          | int    | H3 cell query       | COUNT(*) WHERE h3_cell=$cell AND timestamp<$T AND timestamp>=$T-90d
active_days_7d                 | int    | H3 cell query       | COUNT(DISTINCT DATE(timestamp)) WHERE h3_cell=$cell AND <7d window
active_days_30d                | int    | H3 cell query       | COUNT(DISTINCT DATE(timestamp)) WHERE h3_cell=$cell AND <30d window
active_days_90d                | int    | H3 cell query       | COUNT(DISTINCT DATE(timestamp)) WHERE h3_cell=$cell AND <90d window
mean_frp_7d                    | float  | H3 cell query       | AVG(frp) in 7d window
mean_frp_30d                   | float  | H3 cell query       | AVG(frp) in 30d window
mean_frp_90d                   | float  | H3 cell query       | AVG(frp) in 90d window
median_frp_30d                 | float  | H3 cell query       | MEDIAN(frp) in 30d window
std_frp_30d                    | float  | H3 cell query       | STDDEV(frp) in 30d window
max_frp_30d                    | float  | H3 cell query       | MAX(frp) in 30d window
days_since_first_seen          | float  | H3 cell query       | ($T - MIN(timestamp)) / 86400 (seconds to days)
days_since_previous_detection  | float  | H3 cell query       | ($T - MAX(timestamp where timestamp<$T)) / 86400

⚠️ CRITICAL: All queries use temporal cutoff (timestamp < $T) to prevent data leakage

GROUP E: INDUSTRIAL CONTEXT FEATURES (6 from OSM + spatial)
----------------------------------------------------------
Feature Name                       | Type   | Source          | Status
-----------------------------------|--------|-----------------|--------
distance_to_nearest_industry_m     | float  | OSM facilities  | NEED OSM database
inside_industrial_area             | int    | OSM polygons    | NEED OSM polygons
inside_facility_polygon            | int    | OSM polygons    | NEED OSM polygons
industrial_facility_count_2km      | int    | OSM facilities  | NEED OSM database
industrial_facility_count_5km      | int    | OSM facilities  | NEED OSM database
nearest_facility_type_encoded      | int    | OSM tags        | NEED facility type mapping (0-7)

GROUP F: LAND COVER FEATURES (6 from raster or grid lookup)
-----------------------------------------------------------
Feature Name                | Type   | Source              | Status
----------------------------|--------|---------------------|--------
land_cover_class            | int    | ESA WorldCover 2021 | NEED raster sampling
is_tree_cover               | int    | ESA WorldCover 2021 | COMPUTE from land_cover_class
is_cropland                 | int    | ESA WorldCover 2021 | COMPUTE from land_cover_class
is_built_up                 | int    | ESA WorldCover 2021 | COMPUTE from land_cover_class
is_water                    | int    | ESA WorldCover 2021 | COMPUTE from land_cover_class
is_bare_land                | int    | ESA WorldCover 2021 | COMPUTE from land_cover_class

================================================================================
SECTION 3: COMPLETE DATA FLOW PIPELINE
================================================================================

INPUT: Raw FIRMS CSV (from NASA)
Column order as provided:
latitude, longitude, bright_ti4, scan, track, acq_date, acq_time, satellite, 
confidence, version, bright_ti5, frp, daynight, type, instrument

↓

PROCESSING STEP 1: Data Validation & Normalization (clean_firms.py)
- Validate coordinates: latitude [-90,90], longitude [-180,180]
- Parse dates: acq_date → datetime object
- Parse time: acq_time → HHMM (preserve leading zeros)
- Create unified timestamp: datetime(acq_date, acq_time)
- Encode categorical: confidence (L→0, N→1, H→2), daynight (D→0, N→1)
- Create hotspot_id unique identifier

OUTPUT: Cleaned FIRMS table
Columns: hotspot_id, latitude, longitude, timestamp, bright_ti4, bright_ti5, frp, 
confidence_encoded, daynight_encoded, scan, track, satellite, acq_date, acq_time, 
type, instrument, year, month, hour

↓

PROCESSING STEP 2: H3 Cell Assignment (h3_prototype_analysis.py)
- Assign H3 cell (resolution 7) to each hotspot
- Add column: h3_cell

↓

PROCESSING STEP 3: Temporal Feature Extraction
- Extract from timestamp: month, day_of_year, day_of_week, hour, minute
- Compute cyclical encodings: hour_sin, hour_cos, month_sin, month_cos

OUTPUT: Dataset with GROUP A (raw thermal) + GROUP B (derived) + GROUP C (temporal)

↓

PROCESSING STEP 4: Persistence Feature Computation (CRITICAL - temporal cutoff!)
- For each hotspot at time T in h3_cell:
  - Query: SELECT * FROM hotspots WHERE h3_cell=$ AND timestamp < T
  - Compute rolling aggregates: observation_count_7d/30d/90d, active_days_7d/30d/90d
  - Compute FRP statistics: mean_frp_7d/30d/90d, median/std/max_frp_30d
  - Compute temporal deltas: days_since_first_seen, days_since_previous_detection

OUTPUT: Dataset with GROUP D (persistence features added)

↓

PROCESSING STEP 5: OSM Industrial Context Enrichment (osm_enrichment.py)
- Spatial join: nearest_industry_m, inside_industrial_area, facility_count_2km/5km
- Facility type lookup and encoding (0-7)

OUTPUT: Dataset with GROUP E (industrial context added)

↓

PROCESSING STEP 6: Land Cover Raster Sampling
- For each (lat, lon): Sample ESA WorldCover 2021 raster
- Extract land_cover_class (0-10)
- Compute binary flags: is_tree_cover, is_cropland, is_built_up, is_water, is_bare_land

OUTPUT: Dataset with 37 features (GROUP A-F all complete)

↓

PROCESSING STEP 7: Target Label Construction (requires manual verification)
- Apply weak supervision rules based on context + thermal patterns
- Manual verify sample (500-1000 hotspots)
- Assign target_class: one of 6 classes (0-5)

OUTPUT: Labeled training dataset with 37 features + target_class

↓

TRAINING: XGBoost Classifier
- Input: Feature matrix (N, 37), target vector (N,)
- Temporal split: Train on 2022-2023, Validate on 2024-Q1-Q3, Test on 2024-Q4
- Output: model.pkl, feature_schema.json, shap_explainer.pkl

================================================================================
SECTION 4: PRACTICAL DOWNLOAD & IMPORT (Google Colab)
================================================================================

Download NASA FIRMS Data:
1. Go to: https://firms.modaps.eosdis.nasa.gov/
2. Select: VIIRS (NOAA-20/JPSS-1)
3. Region: India
4. Date range: 2022-01-01 to 2024-12-31
5. Format: CSV
6. Download: viirs-jpss1_2022_India.csv, viirs-jpss1_2023_India.csv, viirs-jpss1_2024_India.csv

Expected file structure in Google Colab:
```
/content/firms_data/
├── viirs-jpss1_2022_India.csv
├── viirs-jpss1_2023_India.csv
└── viirs-jpss1_2024_India.csv
```

Load in Colab:
```python
import pandas as pd

# Load 2024 data as example
df_2024 = pd.read_csv('/content/firms_data/viirs-jpss1_2024_India.csv')

# Check columns
print(df_2024.columns.tolist())
print(df_2024.shape)
print(df_2024.head())

# Expected columns:
# ['latitude', 'longitude', 'bright_ti4', 'scan', 'track', 'acq_date', 'acq_time', 
#  'satellite', 'confidence', 'version', 'bright_ti5', 'frp', 'daynight', 'type', 'instrument']

# Expected shape: (578062, 15) for 2024
```

================================================================================
SECTION 5: COMPLETE REQUIRED ATTRIBUTES CHECKLIST
================================================================================

DIRECTLY FROM FIRMS CSV (13 columns):
✓ latitude
✓ longitude
✓ bright_ti4
✓ bright_ti5
✓ frp
✓ scan
✓ track
✓ acq_date
✓ acq_time
✓ satellite
✓ confidence
✓ version
✓ daynight
✓ type

NEED TO COMPUTE/ADD (24 additional sources):
✓ H3 cell assignment (need h3-py library)
✓ Historical FIRMS detections in same H3 (rolling window queries)
✓ OSM facility data (Overpass API or pre-downloaded)
✓ Land cover raster (ESA WorldCover 2021)
✓ Manual labels for training (domain expert verification)

TOTAL: 37 model features from 13 FIRMS + 24 computed/external sources

================================================================================
SECTION 6: MISSING COMPONENTS YOU NEED
================================================================================

1. Raw FIRMS Data (1.5M rows, 2022-2024)
   - Download from NASA FIRMS website
   - 3 CSV files (~2GB total)

2. H3 Library
   - pip install h3
   - Used for spatial grouping

3. Full Historical FIRMS Database
   - Load all 1.5M rows into database
   - Index by h3_cell + timestamp
   - Required for persistence feature computation

4. OSM Facility Database
   - Pre-downloaded or Overpass API queries
   - Contains: lat, lon, facility_type, polygons
   - Used for industrial context

5. ESA WorldCover 2021 Raster
   - Download from: https://esa-worldcover.org/
   - File size: ~500GB for global (need India subset)
   - Used for land cover sampling

6. Target Labels
   - Manual labeling of 5K-10K sample hotspots
   - Domain experts or rule-based candidates + verification
   - Required for supervised XGBoost training

================================================================================
SUMMARY FOR COLAB WORKFLOW
================================================================================

Data you must download/obtain:
1. FIRMS CSV (2022-2024): 13 raw columns ✓ HAVE
2. Full FIRMS history: 1.5M rows (for persistence) ✓ GET FROM NASA
3. OSM facility data: Industrial POIs ✓ GET FROM OSM
4. Land cover raster: ESA WorldCover 2021 ✓ DOWNLOAD 500MB

Processing steps in Colab:
1. Load 13 FIRMS columns
2. Compute 2 derived thermal + 8 temporal (from columns)
3. Query H3 cell history for 14 persistence features
4. Add 6 OSM industrial context features
5. Add 6 land cover features from raster
6. Result: 37-feature matrix

Total dataset size: ~1.5M rows × 37 features
Training subset: 5K-10K labeled rows

Ready to code in Colab now!
================================================================================
