# PyroClass Event-Level Training Dataset

## Purpose

This directory contains an event-level prototype training dataset
for PyroClass.

The dataset is derived from the complete 2022-2024 NASA FIRMS
NOAA-20 India archive.

It combines:

- FIRMS thermal features
- temporal features
- H3 spatial indexing
- 7/30/90-day persistence features
- thermal anomaly features
- OSM-derived prototype geographic context
- weak training labels

## IMPORTANT LABEL DISCLAIMER

The current target classes are WEAK LABELS.

They are not manually verified nationwide ground truth.

Labels are generated from combinations of:

- NASA FIRMS type
- historical thermal behaviour
- OSM context
- prototype geographic seeds

They should therefore be treated as bootstrap labels for an
initial XGBoost experiment.

## Target Classes

- industrial_persistent
- industrial_spike
- non_industrial
- forest_fire
- ag_burning
- unknown

## Prototype Geographic Context

The OSM context currently originates from the selected PyroClass
prototype sites and their H3 neighbourhoods.

It must NOT be assumed that every unlabeled geographic region in
India has been comprehensively checked against OSM.

## Key Features

### Thermal

- bright_ti4
- bright_ti5
- frp
- confidence_encoded
- scan
- track
- log_frp
- thermal_difference

### Temporal

- year
- month
- day_of_year
- day_of_week
- hour
- minute
- is_night
- hour_sin
- hour_cos
- month_sin
- month_cos

### Persistence

- observation_count_7d
- observation_count_30d
- observation_count_90d
- active_days_7d
- active_days_30d
- active_days_90d
- mean_frp_7d
- mean_frp_30d
- mean_frp_90d
- median_frp_30d
- std_frp_30d
- max_frp_30d
- max_frp_90d
- days_since_first_seen
- days_since_previous_detection
- has_history_7d
- has_history_30d
- has_history_90d

### Anomaly

- frp_deviation
- frp_ratio_to_baseline
- frp_z_score

### Geographic

- h3_cell
- industrial_context_score
- mining_context_score
- industrial_polygon_overlap
- mining_polygon_overlap
- forest_polygon_overlap
- agriculture_polygon_overlap
- distance_to_seed_facility_m
- nearest_facility_type_encoded

## Temporal Leakage Protection

Rolling history features use only observations before the
current event date.

The split is chronological:

- Training: 2022-2023
- Validation: January-June 2024
- Test: July-December 2024

## Dataset Sizes

Master: 40,580
Train: 27,830
Validation: 8,113
Test: 4,637

## Intended Use

The train/validation/test files are intended for:

- XGBoost baseline
- feature importance analysis
- SHAP experiments
- internal prototype evaluation

The 20 curated PyroClass prototype sites should be treated as
demonstration/validation examples rather than the sole training set.

## Recommended ML Procedure

1. Inspect class distribution.
2. Start with only high-confidence rows.
3. Train an initial XGBoost baseline.
4. Compare model performance against the weak-label rules.
5. Use SHAP to explain predictions.
6. Evaluate on the chronological test split.
7. Manually review false positives and false negatives.
8. Improve labels iteratively.

## Future Improvements

For a stronger model, add:

- manually verified industrial events
- larger OSM facility coverage
- land-cover raster features
- satellite-image corroboration
- more years of historical data
- verified industrial-fire incident records