# PyroClass — Geospatial Data Engineering Documentation

**Project:** PyroClass
**Problem Statement:** SIH26162
**Organization:** National Technical Research Organisation (NTRO)
**Category:** Software
**Theme:** Miscellaneous
**Role:** Geospatial Data Engineer
**Primary Responsibility:** NASA FIRMS data processing, spatial indexing, temporal/geospatial analysis, OSM enrichment, industrial-context generation, and geospatial data handoff.

---

## 1. Role Overview

The Geospatial Data Engineer is responsible for transforming raw satellite-based thermal anomaly observations into structured geographical intelligence that can be consumed by the rest of the PyroClass system.

NASA FIRMS provides thermal hotspot detections and associated information such as latitude, longitude, acquisition time, brightness temperature, confidence, Fire Radiative Power (FRP), satellite and detection type. A raw FIRMS hotspot alone does not identify what is physically present around the detection or whether the observed heat is associated with industrial activity.

The geospatial component therefore provides the geographical context required to interpret those detections.

The overall responsibility is:

```text
Raw NASA FIRMS data
        ↓
Cleaning and validation
        ↓
Candidate thermal-source extraction
        ↓
Spatial organization using H3
        ↓
Historical/temporal analysis
        ↓
Thermal-site identification
        ↓
OpenStreetMap enrichment
        ↓
Industrial / mining / vegetation / agricultural context
        ↓
Facility proximity and geographic evidence
        ↓
Geospatial feature dataset
        ↓
ML / anomaly detection / backend / frontend
```

The role is an upstream data and intelligence layer rather than the final fire-classification layer.

---

# 2. Problem Being Addressed

The PyroClass problem is not simply detecting whether a satellite thermal hotspot exists.

Satellite systems such as NASA FIRMS can already identify thermal anomalies. The difficult part is understanding what those anomalies represent.

A thermal hotspot may correspond to:

* a genuine industrial fire or abnormal industrial event
* a normal recurring industrial heat source
* a gas flare
* mining activity
* agricultural burning
* a vegetation/forest fire
* another static thermal source
* an uncertain or unknown source

For example:

```text
A refinery produces heat regularly
        ↓
Satellite detects hotspot
        ↓
Hotspot alone cannot tell whether this is:
        ↓
normal refinery activity
OR
abnormal industrial event
```

The geospatial component provides information about the physical environment around the hotspot so that the later analytics and ML stages can make a more informed classification.

---

# 3. Source Dataset

The current prototype uses three years of NASA FIRMS VIIRS NOAA-20 data for India.

Input files:

```text
viirs-jpss1_2022_India.csv
viirs-jpss1_2023_India.csv
viirs-jpss1_2024_India.csv
```

All three datasets correspond to NOAA-20 / VIIRS data and contain the same core FIRMS fields.

The combined dataset contains approximately:

```text
2022: 606,855 detections
2023: 591,145 detections
2024: 578,062 detections

Total: approximately 1.78 million detections
```

The raw files are treated as source data and should not be directly modified.

---

# 4. FIRMS Fields Used

The important source fields include:

| Field        | Purpose                                             |
| ------------ | --------------------------------------------------- |
| `latitude`   | Thermal detection latitude                          |
| `longitude`  | Thermal detection longitude                         |
| `bright_ti4` | VIIRS thermal brightness measurement                |
| `bright_ti5` | Secondary thermal/background brightness measurement |
| `scan`       | Scan dimension of the detection pixel               |
| `track`      | Track dimension of the detection pixel              |
| `acq_date`   | Acquisition date                                    |
| `acq_time`   | Acquisition time                                    |
| `satellite`  | Satellite identifier                                |
| `instrument` | Instrument used                                     |
| `confidence` | FIRMS detection confidence                          |
| `version`    | FIRMS dataset/version information                   |
| `frp`        | Fire Radiative Power                                |
| `daynight`   | Day/night observation                               |
| `type`       | FIRMS detection category                            |

These fields are preserved during the cleaning process.

---

# 5. Interpretation of FIRMS `type`

The current dataset contains four type values:

```text
0 = presumed vegetation fire
1 = active volcano
2 = other static land source
3 = offshore
```

The most important category for the PyroClass persistent/static-source analysis is:

```text
type = 2
```

This represents:

> Other static land source.

It must **not** be interpreted as:

> Industrial fire.

Instead, it is used as a candidate pool for further analysis.

Correct pipeline:

```text
type = 2
        ↓
Candidate static/non-vegetation thermal source
        ↓
Historical recurrence
        ↓
Spatial grouping
        ↓
OSM geographic context
        ↓
Industrial/mining/other interpretation
```

Type-0 data is retained because it provides a useful population of presumed vegetation-fire observations for comparison.

Type-1 volcano detections are not a target class for the current industrial analysis.

Type-3 offshore detections are excluded from the initial land-based industrial analysis.

---

# 6. Data Cleaning

The first processing stage combines the three annual files and creates a standardized master dataset.

Processing includes:

1. Validating the expected FIRMS columns.
2. Combining the three annual files.
3. Detecting exact duplicate rows.
4. Converting numeric columns to numeric types.
5. Normalizing categorical/string fields.
6. Parsing `acq_date`.
7. Converting `acq_time` into a standardized timestamp.
8. Validating latitude and longitude.
9. Creating temporal fields.
10. Creating human-readable FIRMS type labels.
11. Creating an ordinal confidence encoding.
12. Creating data-quality flags.
13. Removing only structurally invalid rows.
14. Assigning row-level hotspot IDs.
15. Saving the cleaned master dataset.

The cleaning process intentionally does not remove potentially important extreme observations.

---

# 7. Data-Quality Flags

The cleaning pipeline creates quality flags instead of automatically deleting questionable observations.

Important flags include:

```text
frp_zero
frp_extreme
missing_thermal_data
invalid_coordinates
invalid_timestamp
```

These flags are useful for later investigation and analysis.

For example:

```text
frp_extreme = TRUE
```

means the FRP value is unusually large and should be investigated.

It does **not** mean the observation is invalid.

This is important because extreme thermal activity may be exactly what PyroClass is intended to detect.

Similarly:

```text
frp_zero = TRUE
```

is retained as a flag rather than automatically discarded.

---

# 8. Confidence Processing

The original FIRMS confidence field is retained.

The data contains confidence categories such as:

```text
L
N
H
```

An ordinal numerical field is also created:

```text
L → 0
N → 1
H → 2
```

This numerical value should be treated as an ordinal encoding, not as a probability.

The original confidence value must remain available.

---

# 9. Temporal Feature Generation

A unified timestamp is created using the acquisition date and acquisition time.

Additional temporal fields include:

```text
year
month
day
day_of_year
hour
```

These fields allow PyroClass to study:

* yearly behaviour
* monthly patterns
* seasonality
* persistence
* sudden increases
* historical baselines
* changes in thermal activity

---

# 10. Clean Master Dataset

The complete cleaned dataset is stored as:

```text
firms_india_2022_2024_clean.csv
```

It contains the full historical dataset after validation and cleaning.

Important fields include:

```text
hotspot_id
latitude
longitude
timestamp
acq_date
acq_time
year
month
day
day_of_year
hour
frp
bright_ti4
bright_ti5
confidence
confidence_score
daynight
type
type_label
scan
track
satellite
instrument
version
```

This file represents the cleaned source layer.

---

# 11. Type-2 Candidate Dataset

The primary static/non-vegetation candidate subset is:

```text
firms_type2_candidates.csv
```

It is generated using:

```python
df[df["type"] == 2]
```

This dataset contains approximately 214,000 observations from the three-year dataset.

The purpose is to reduce the search population for static/persistent thermal-source analysis.

Important:

```text
type 2 ≠ industrial
```

The type-2 population still contains other types of static thermal activity and requires spatial and geographical interpretation.

---

# 12. Prototype Case Selection

For the internal SIH prototype, a small representative set of cases is used instead of attempting to demonstrate the entire India-wide dataset.

Prototype file:

```text
pyroclass_20_prototype_candidates.csv
```

The 20 cases contain examples intended to represent different thermal behaviours, including:

* persistent thermal activity
* potential thermal spikes/anomalies
* presumed vegetation comparison cases
* non-industrial/static cases
* uncertain cases

The 20 cases are intended for prototype demonstration and validation.

They are **not** sufficient as a full training dataset for the final machine learning model.

---

# 13. Spatial Indexing Using H3

H3 is used to convert each latitude/longitude detection into a hierarchical hexagonal spatial cell.

Conceptually:

```text
latitude + longitude
        ↓
H3 cell
```

This provides a consistent spatial unit for analysis.

Instead of analysing millions of individual points independently, PyroClass can study the aggregate behaviour of each H3 region.

For example:

```text
H3 Cell A
    2,800 detections
    450 active days
    median FRP = 6 MW
```

This is more useful than examining thousands of individual points separately.

---

# 14. H3 Prototype Outputs

Prototype H3 assignments are stored in:

```text
pyroclass_20_sites_h3.csv
```

This associates each prototype case with its H3 cell.

Historical site statistics are stored in:

```text
pyroclass_site_h3_summary.csv
```

This provides aggregated statistics such as:

* total detections
* active days
* active months
* average FRP
* median FRP
* maximum FRP
* yearly detection counts

---

# 15. H3 Neighbourhoods

H3 neighbourhood cells can be generated around each prototype site.

For the prototype, a `k=1` neighbourhood is used initially:

```text
       ⬡ ⬡
     ⬡ 🔥 ⬡
       ⬡ ⬡
```

The central cell represents the prototype location.

The surrounding cells represent its immediate geographic neighbourhood.

This allows PyroClass to examine spatial expansion or clustering rather than relying only on one exact coordinate.

For example:

```text
Normal:
       ⬡
       🔥
       ⬡

Potential expansion:
     🔥 🔥
    🔥 🔥 🔥
       🔥
```

Neighbouring-cell activity can later be used as a feature for anomaly analysis.

---

# 16. Thermal Fingerprinting

A key PyroClass concept is the creation of a location-specific thermal fingerprint.

Instead of asking only:

> Is this place hot?

the system asks:

> What does normal thermal behaviour look like at this location?

A thermal fingerprint can contain:

```text
total detections
active days
active months
2022 activity
2023 activity
2024 activity
mean FRP
median FRP
maximum FRP
FRP variability
seasonality
spatial spread
```

Example:

```text
Historical median FRP: 12 MW
Normal range: 8–18 MW
Recurring detections: high

Current event: 76 MW
```

This indicates a large deviation from the site's normal thermal behaviour.

A persistent refinery flare may instead show:

```text
10 MW
12 MW
11 MW
14 MW
13 MW
```

which is consistent with normal recurring activity.

---

# 17. Yearly and Monthly Analysis

For each H3 site, historical thermal behaviour can be summarized by year:

```text
H3 Cell A

2022 → 850 detections
2023 → 910 detections
2024 → 890 detections
```

This suggests persistent behaviour.

Another site may show:

```text
2022 → 20
2023 → 18
2024 → 96
```

which indicates a potential increase in activity.

Monthly analysis is also useful.

For example:

```text
Jan  █
Feb  █
Mar  █
Apr  █
May  █
...
Oct  ███████
Nov  █████████
Dec  ██████
```

Strong seasonal concentration may indicate agricultural or other seasonal behaviour.

By contrast, relatively consistent activity throughout the year can be more consistent with a persistent industrial source, although geography and facility context are still required.

---

# 18. Thermal Anomaly Analysis

A thermal anomaly represents behaviour that differs significantly from the historical baseline of the location.

Example:

```text
Historical median FRP = 12 MW
Current FRP = 76 MW
```

The ratio is:

```text
76 / 12 ≈ 6.3×
```

This is a potentially strong thermal deviation.

The system may also consider:

* number of newly activated H3 cells
* changes in hotspot frequency
* changes in FRP
* changes in spatial distribution
* changes from seasonal expectations

The final anomaly score should be generated by the spatial-analytics/ML component rather than being confused with the geographic context score.

---

# 19. OpenStreetMap Enrichment

OpenStreetMap is used to determine the geographical context surrounding selected thermal sites.

The OSM pipeline queries an area around each prototype location and looks for relevant geographic features.

Examples include:

```text
landuse=industrial
man_made=works
power=plant
landuse=quarry
landuse=mine
man_made=mineshaft
landuse=forest
natural=wood
landuse=farmland
landuse=farm
landuse=orchard
```

The purpose is to identify the physical context in which the thermal signal occurs.

---

# 20. Industrial Facility Identification

Where the OSM data contains sufficient information, facilities may be classified into categories such as:

```text
oil_refinery
power_plant
steel_metal
cement_plant
chemical_plant
gas_lng
industrial_works
industrial_facility
```

The facility identification is based on available OSM tags and textual information.

A generic industrial feature is not assumed to be a specific industry unless the available tags support that interpretation.

---

# 21. Mining/Quarry Context

Mining and quarry activity is explicitly separated from generic industrial context.

This distinction is important because mining activity itself can produce recurring thermal anomalies and is explicitly one of the types of activity that PyroClass needs to distinguish from other thermal sources.

Therefore:

```text
OSM quarry/mine
        ↓
mining_quarry context
```

not automatically:

```text
industrial fire
```

Examples from the current prototype include sites associated with coal-mining/quarry contexts.

This is useful because these cases can become non-industrial comparison examples or separate classes.

---

# 22. Facility Proximity

For each prototype site, the system calculates the distance to nearby facilities.

Example:

```text
Hotspot
   ↓
Nearest facility
   ↓
Oil refinery
   ↓
Distance = 280 m
```

The field:

```text
facility_distance_m
```

stores this distance in metres.

The distance should be treated as contextual evidence rather than proof that a specific facility is burning.

This is particularly important because VIIRS thermal detections are approximately pixel-scale observations and should not be interpreted as exact building-level fire locations.

---

# 23. Pixel-Aware Geospatial Reasoning

PyroClass should not assume that:

```text
latitude/longitude = exact fire location
```

Instead, the spatial footprint and surrounding context should be considered.

A hotspot near a facility does not automatically prove that the facility itself is burning.

For this reason the system uses:

* H3 spatial context
* neighbouring cells
* facility distance
* polygon overlap
* industrial context
* historical behaviour

rather than relying solely on the nearest facility.

This improves the scientific defensibility of the system.

---

# 24. Industrial Context Score

The geospatial pipeline calculates an industrial context score.

This is intended to represent:

> How strongly does the surrounding geography support an association between the hotspot and industrial infrastructure?

Possible evidence includes:

* overlap with an industrial polygon
* proximity to an industrial facility
* identification of a facility type
* OSM industrial tags

Example:

```text
Industrial polygon overlap: YES
Facility within 375 m: YES
Facility type identified: YES

Industrial Context Score: HIGH
```

This score is **not** the final fire-risk score.

It is a geographical/contextual feature for the later analytics and ML stages.

---

# 25. Mining Context Score

A separate mining context score is generated for quarry/mine-related observations.

Example:

```text
Mining polygon overlap: YES
Mining feature nearby: YES

Mining Context Score: HIGH
```

This allows the system to distinguish:

```text
industrial context
```

from:

```text
mining/quarry context
```

rather than merging the two.

---

# 26. Geographic Context Classification

The final geographical context classification can take values such as:

```text
industrial
mining_quarry
vegetation
agriculture
unknown
```

The classification should be evidence-driven.

Example:

```text
Industrial polygon + refinery nearby
        ↓
industrial
```

```text
Quarry polygon overlap
        ↓
mining_quarry
```

```text
Forest polygon overlap
        ↓
vegetation
```

```text
No strong geographic evidence
        ↓
unknown
```

Unknown is a legitimate and important output.

The system should not force uncertain cases into an industrial category.

---

# 27. Geographic Evidence

For every context assignment, the system stores an evidence description.

Example:

```text
Hotspot overlaps an OSM quarry/mine polygon
```

or:

```text
Hotspot coordinate overlaps an OSM industrial polygon
+
Industrial facility within approximately one VIIRS pixel
+
Specific facility type identified
```

This evidence allows the frontend and downstream components to explain why a geographic association was made.

---

# 28. Final Geospatial Dataset

The primary handoff dataset is:

```text
pyroclass_20_sites_geospatial_final.csv
```

This is the main file to be consumed by the rest of the team.

Important fields include:

### Identity

```text
case_id
case_type
```

### Coordinates

```text
latitude
longitude
h3_cell
```

### Historical thermal features

```text
n
active_days
mean_frp
median_frp
max_frp
2022
2023
2024
base_monthly
cur_monthly
count_ratio
p95_ratio
spike_score
```

### Geographic context

```text
context_type
context_confidence
facility_name
facility_type
facility_distance_m
```

### Context scores

```text
industrial_context_score
mining_context_score
```

### Geographic overlap

```text
industrial_polygon_overlap_osm
mining_polygon_overlap
forest_polygon_overlap
agriculture_polygon_overlap
```

### Feature counts

```text
industrial_features_found
mining_features_found
forest_features_found
agriculture_features_found
```

### Nearest-feature information

```text
nearest_industrial_name
nearest_industrial_type
nearest_industrial_distance_m

nearest_mining_name
nearest_mining_distance_m
```

### Additional context

```text
vegetation_context
agriculture_context
context_evidence_osm
osm_elements
osm_source_osm
```

---

# 29. Frontend GeoJSON

The frontend-ready geographical output is:

```text
pyroclass_20_sites_geospatial_final.geojson
```

This can be loaded into:

* MapLibre
* Deck.gl
* other GIS/map visualization systems

It contains the prototype coordinates and associated metadata needed for map visualization.

The frontend can use this to show:

* hotspot points
* geographical context
* facility information
* H3/spatial information
* contextual scores
* prototype categories

---

# 30. Final Geospatial Pipeline

The completed geospatial flow is:

```text
NASA FIRMS
      ↓
Raw thermal detections
      ↓
Data cleaning
      ↓
Type classification
      ↓
Type-2 candidate extraction
      ↓
Prototype candidate selection
      ↓
H3 spatial indexing
      ↓
H3 neighbourhood generation
      ↓
Historical temporal analysis
      ↓
Thermal fingerprint
      ↓
OSM enrichment
      ↓
Industrial / mining / vegetation / agriculture context
      ↓
Facility matching
      ↓
Distance calculation
      ↓
Context scoring
      ↓
Evidence generation
      ↓
Final geospatial dataset
      ↓
ML / anomaly detection / backend / frontend
```

---

# 31. Relationship With the Machine Learning Component

The geospatial pipeline supplies geographical features that can be combined with thermal and temporal features.

Example features:

```text
industrial_context_score
mining_context_score
facility_distance_m
facility_type
industrial_overlap
mining_overlap
land-use context
h3_cell
neighbourhood activity
```

These can be combined with FIRMS thermal features:

```text
FRP
brightness
confidence
historical FRP
FRP deviation
persistence
seasonality
```

The combined dataset can become input to the XGBoost classifier.

The 20 prototype cases should **not** be treated as the only training data.

They are intended for:

* demonstration
* validation
* testing
* explaining the system to judges

A larger training/weakly-labelled dataset is needed for a meaningful production model.

---

# 32. Relationship With Spatial Analytics

The spatial-analytics component can use:

```text
h3_cell
historical counts
active days
yearly counts
monthly behaviour
FRP statistics
neighbour activity
industrial context
facility proximity
```

to derive:

* persistence score
* thermal baseline
* current-vs-normal deviation
* spatial expansion
* anomaly score
* investigation priority

The geospatial component therefore provides the location framework upon which spatial analytics operates.

---

# 33. Relationship With Backend/PostGIS

The final geospatial data is designed to integrate with the team's PostGIS backend.

Relevant information includes:

```text
Hotspot
    ├── latitude
    ├── longitude
    ├── geometry
    ├── timestamp
    ├── thermal attributes
    └── H3 cell

Industrial Facility
    ├── facility name
    ├── facility type
    ├── coordinates
    └── geometry

Geospatial Context
    ├── context type
    ├── facility association
    ├── distance
    └── evidence
```

These should integrate with the team's core tables:

```text
hotspots
industrial_facilities
classifications
```

The geospatial component primarily provides upstream data for `hotspots` and `industrial_facilities` and contextual features consumed by `classifications`.

---

# 34. Relationship With Frontend

The frontend should use:

```text
pyroclass_20_sites_geospatial_final.geojson
```

for prototype map visualization.

A useful map interaction is:

```text
Click hotspot
      ↓
Show FIRMS information
      ↓
Show H3 region
      ↓
Show surrounding context
      ↓
Show nearby facility
      ↓
Show distance
      ↓
Show context evidence
      ↓
Show final classification
```

This allows the geospatial work to be visible during the SIH demonstration rather than remaining hidden in preprocessing.

---

# 35. Recommended Prototype Presentation

For the internal round, the geospatial component should support at least three representative cases:

## Case A — Persistent Industrial Candidate

```text
Recurring hotspot
+
industrial context
+
stable thermal behaviour
```

Potential interpretation:

> Persistent industrial thermal source.

## Case B — Abnormal Industrial Candidate

```text
Industrial context
+
large thermal deviation
+
spatial expansion
```

Potential interpretation:

> Possible abnormal industrial thermal event.

## Case C — Non-Industrial Comparison

```text
Hotspot
+
forest/agriculture/mining context
+
weak industrial association
```

Potential interpretation:

> Non-industrial thermal activity.

The purpose is to demonstrate that PyroClass does not simply classify every thermal hotspot as an industrial fire.

---

# 36. Important Methodological Constraints

The following rules should be maintained throughout development.

### Rule 1

`type = 2` is a candidate static/non-vegetation category, not an industrial ground-truth label.

### Rule 2

OSM provides geographical context, not absolute confirmation of what caused a thermal event.

### Rule 3

A nearby facility is not automatically the source of the hotspot.

### Rule 4

A large FRP value should not automatically be classified as a dangerous industrial fire.

### Rule 5

Historical thermal behaviour is essential for distinguishing persistent normal activity from abnormal behaviour.

### Rule 6

Unknown/uncertain should remain a valid classification.

### Rule 7

The 20 prototype cases should not be presented as a statistically representative nationwide dataset.

### Rule 8

Extreme observations should generally be investigated or flagged rather than blindly deleted.

---

# 37. Current Repository Files

The geospatial component currently contains the following processing scripts:

```text
clean_firms.py
h3_prototype_analysis.py
osm_enrichment.py
validate_osm_context.py
finalize_geospatial_dataset.py
```

Core prototype outputs:

```text
pyroclass_20_prototype_candidates.csv
pyroclass_20_sites_h3.csv
pyroclass_site_h3_summary.csv
pyroclass_20_sites_geospatial_final.csv
pyroclass_20_sites_geospatial_final.geojson
```

Raw FIRMS files:

```text
viirs-jpss1_2022_India.csv
viirs-jpss1_2023_India.csv
viirs-jpss1_2024_India.csv
```

The raw files are large and should generally remain outside the main Git repository.

---

# 38. Script Responsibilities

## `clean_firms.py`

Purpose:

```text
Raw annual FIRMS CSVs
        ↓
Clean and standardized master dataset
```

Output:

```text
firms_india_2022_2024_clean.csv
firms_type2_candidates.csv
```

---

## `h3_prototype_analysis.py`

Purpose:

```text
20 prototype candidates
        +
type-2 historical FIRMS data
        ↓
H3 indexing
        ↓
H3 neighbourhoods
        ↓
historical thermal statistics
```

Outputs:

```text
pyroclass_20_sites_h3.csv
pyroclass_prototype_h3_cells.geojson
pyroclass_site_h3_summary.csv
pyroclass_prototype_sites.geojson
```

---

## `osm_enrichment.py`

Purpose:

```text
Prototype coordinates
        ↓
Overpass / OSM
        ↓
Nearby geographic/industrial features
        ↓
facility and context information
```

---

## `validate_osm_context.py`

Purpose:

Refine and interpret OSM results into distinct geographical contexts:

```text
industrial
mining_quarry
vegetation
agriculture
unknown
```

and calculate:

```text
context_confidence
industrial_context_score
mining_context_score
facility distance
```

---

## `finalize_geospatial_dataset.py`

Purpose:

Combine the final H3/thermal/OSM information into one authoritative handoff dataset.

Main output:

```text
pyroclass_20_sites_geospatial_final.csv
```

Frontend output:

```text
pyroclass_20_sites_geospatial_final.geojson
```

---

# 39. Definition of Done — Geospatial MVP

The geospatial MVP is considered complete when the following are available:

* [x] Historical FIRMS data collected.
* [x] 2022–2024 data combined.
* [x] Data cleaned and validated.
* [x] FIRMS type values interpreted.
* [x] Type-2 candidate dataset extracted.
* [x] 20 prototype cases selected.
* [x] H3 spatial indexing implemented.
* [x] H3 neighbourhoods generated.
* [x] Historical thermal statistics calculated.
* [x] Temporal patterns available.
* [x] Thermal-fingerprint features available.
* [x] OSM enrichment performed.
* [x] Industrial context identified where evidence exists.
* [x] Mining/quarry context separated.
* [x] Vegetation/agricultural context retained.
* [x] Facility proximity calculated.
* [x] Context evidence stored.
* [x] Final CSV created.
* [x] Final GeoJSON created.
* [x] Data ready for ML, analytics, backend and frontend integration.

---

# 40. Main Geospatial USPs

## Pixel-Aware Geospatial Context

The system does not blindly treat a FIRMS latitude/longitude as an exact building-level fire location. It considers the surrounding spatial context and H3 neighbourhood.

## Facility-Aware Context

The system attempts to identify the type of industrial facility associated with a thermal location rather than using only a binary industrial/non-industrial flag.

## Thermal + Geographic Fusion

Thermal observations are combined with geographic infrastructure and historical behaviour.

## Thermal Fingerprinting

PyroClass learns the normal thermal behaviour of a location and uses deviations from that behaviour to identify unusual activity.

## Traceable Geospatial Evidence

The system stores the OSM evidence behind an industrial or mining association instead of producing an unsupported black-box geographic label.

## Spatial Uncertainty Awareness

The system acknowledges the spatial limitations of satellite thermal detections and avoids claiming building-level certainty that the data cannot support.

---

# 41. Handoff to the Team

The main geospatial handoff file is:

```text
pyroclass_20_sites_geospatial_final.csv
```

The frontend handoff file is:

```text
pyroclass_20_sites_geospatial_final.geojson
```

### For Spatial Analytics

Use:

```text
h3_cell
historical counts
active days
annual counts
monthly behaviour
FRP statistics
neighbour activity
```

### For Machine Learning

Use:

```text
FRP
brightness
confidence
industrial context
mining context
facility distance
facility type
historical behaviour
FRP deviation
spatial features
```

### For Backend

Use:

```text
hotspot location
geometry
H3 cell
facility information
context
distance
evidence
```

### For Frontend

Use:

```text
GeoJSON
hotspot coordinates
H3/geographic information
facility information
context metadata
```

---

# 42. Geospatial Engineer — Final Summary

The role can be summarized as:

> **Convert raw satellite thermal detections into geographically meaningful, evidence-backed thermal sites that the rest of PyroClass can interpret.**

The core transformation is:

```text
"NASA detected something hot here."

                ↓

"What is around that location?"

                ↓

"Is it industrial, mining, vegetation,
 agricultural, or unknown?"

                ↓

"Has this area shown thermal activity before?"

                ↓

"What is the normal thermal behaviour?"

                ↓

"How does the current observation differ?"

                ↓

"Provide the evidence and geospatial
features to the AI/analytics pipeline."
```

The geospatial component therefore provides the **location intelligence layer** of PyroClass and forms the bridge between raw satellite observations and explainable thermal-event classification.
