# PyroClass ML Preprocessed Dataset

## Overview

This directory contains preprocessed versions of the raw training, validation, and test datasets.

**Source**: `dataset/ml/`
- `pyroclass_train.csv` → `pyroclass_train_preprocessed.csv`
- `pyroclass_validation.csv` → `pyroclass_validation_preprocessed.csv`
- `pyroclass_test.csv` → `pyroclass_test_preprocessed.csv`

**Original data is preserved**. Preprocessed files have `_preprocessed` suffix.

---

## What Was Done

### Preprocessing Steps

1. **Dropped `distance_to_seed_facility_m`**
   - Column was 100% missing (27,830 NaN values)
   - No predictive signal
   - Removed to avoid fake zero-filling

2. **Filled history-derived features with 0**
   - Columns: `mean_frp_7d`, `mean_frp_30d`, `mean_frp_90d`, `median_frp_30d`, `std_frp_30d`, `max_frp_30d`, `max_frp_90d`, `frp_deviation`, `frp_ratio_to_baseline`, `frp_z_score`
   - These were NaN when an event had no prior history in its H3 cell (first detection)
   - Filled with 0 to represent "no prior baseline"
   - **CRITICAL**: The corresponding `has_history_7d`, `has_history_30d`, `has_history_90d` flags remain in the data
   - This allows the model to distinguish:
     - `mean_frp_30d = 0, has_history_30d = 0` → no history
     - `mean_frp_30d = 0, has_history_30d = 1` → history exists but mean was actually zero

3. **Filled `days_since_previous_detection` with -1**
   - Was NaN for first-time detections in H3 cells
   - Filled with -1 to encode "no prior detection"
   - Distinguishes from 0 (which would mean "detected today")
   - Model can learn that -1 is a special "first observation" state

---

## Dataset Stats

### Training Set
- **Rows**: 27,830
- **Columns**: 57 (was 58, dropped 1)
- **Missing values**: 0 (was 109,619)
- **Classes**: 3 (PROTOTYPE BASELINE ONLY)
  - forest_fire: 10,081
  - non_industrial: 9,925
  - unknown: 7,824
  - industrial_persistent: 0 (NOT IN PROTOTYPE)
  - industrial_spike: 0 (NOT IN PROTOTYPE)
  - ag_burning: 0 (NOT IN PROTOTYPE)

### Validation Set
- **Rows**: 8,113
- **Columns**: 57
- **Missing values**: 0 (was 36,013)

### Test Set
- **Rows**: 4,637
- **Columns**: 57
- **Missing values**: 0 (was 15,421)

---

## Important Caveats

### ⚠️ Weak Labels, Not Ground Truth

1. **Labels are bootstrapped/rule-based**, not manually verified ground truth
2. **Label generation used geospatial/thermal rules** that overlap with model features
3. **The model may reproduce those rules** rather than learning independent classification

Example:
- Label rule: `IF industrial_context_score > 0.7 AND active_days_90d > 15 AND frp_z_score < 2.0 THEN industrial_persistent`
- Model receives: `industrial_context_score`, `active_days_90d`, `frp_z_score` as features
- Model can learn this same rule
- Result: High accuracy ≠ Real-world industrial fire classification accuracy

### 🔴 Do NOT claim:

- "Production-grade fire classification model"
- "Ground-truth industrial/forest fire classifier"
- "Validated real-world accuracy"

### ✅ DO claim:

- "Weak-supervision baseline model"
- "Bootstrap XGBoost classifier trained on rule-based labels"
- "Demonstrates that feature pipeline supports learning"

---

## What Remains in the Data (Still Usable)

These columns provide genuine geospatial context:

| Column | Value | Meaning |
|---|---|---|
| `industrial_context_score` | 0.0-1.0 | Proximity/overlap with industrial areas (OSM) |
| `mining_context_score` | 0.0-1.0 | Proximity/overlap with mining areas |
| `industrial_polygon_overlap` | 0/1 | Inside industrial polygon? |
| `mining_polygon_overlap` | 0/1 | Inside mine? |
| `forest_polygon_overlap` | 0/1 | Inside forest polygon? |
| `agriculture_polygon_overlap` | 0/1 | Inside agriculture polygon? |
| `nearest_facility_type_encoded` | 0-N | Type of nearest facility (encoded) |

These are independent OSM/geospatial queries and are not circular with labels.

---

## Features Available for Training

### DO USE these 49 features:

#### Thermal (8)
- `bright_ti4`, `bright_ti5`, `frp`, `confidence_encoded`, `scan`, `track`, `log_frp`, `thermal_difference`

#### Temporal (11)
- `year`, `month`, `day_of_year`, `day_of_week`, `hour`, `minute`, `is_night`
- `hour_sin`, `hour_cos`, `month_sin`, `month_cos`

#### Persistence (18)
- `observation_count_7d`, `observation_count_30d`, `observation_count_90d`
- `active_days_7d`, `active_days_30d`, `active_days_90d`
- `mean_frp_7d`, `mean_frp_30d`, `mean_frp_90d`
- `median_frp_30d`, `std_frp_30d`, `max_frp_30d`, `max_frp_90d`
- `days_since_first_seen`, `days_since_previous_detection`
- `has_history_7d`, `has_history_30d`, `has_history_90d`

#### Anomaly (3)
- `frp_deviation`, `frp_ratio_to_baseline`, `frp_z_score`

#### Geographic (9)
- `industrial_context_score`, `mining_context_score`
- `industrial_polygon_overlap`, `mining_polygon_overlap`, `forest_polygon_overlap`, `agriculture_polygon_overlap`
- `h3_cell` (if needed for stratification)
- `nearest_facility_type_encoded`
- `type` (FIRMS type, if useful)

### DO NOT USE as features:

- `target_class` (target variable, not feature)
- `label_source` (metadata, not predictive)
- `label_confidence` (metadata; use for filtering/weighting experiments only)
- `hotspot_id`, `latitude`, `longitude`, `timestamp` (identifiers)
- `daynight` (redundant with `is_night`)
- Any column that directly encodes the target

---

## Recommended Training Approach

### Experiment 1: All Labels
- Use all 27,830 training samples
- Train 3-class model: forest_fire, non_industrial, unknown
- Report: accuracy, macro-F1, per-class precision/recall/F1, confusion matrix

### Experiment 2: High-Confidence Labels Only
- Filter: `label_confidence >= 0.70`
- Train second model on remaining samples
- Compare: Does removing low-confidence labels improve performance?
- If yes: evidence that weak labels hurt model

### Metrics to Report
- **Macro-F1** (average across classes, respects imbalance)
- **Confusion matrix** (shows where model confuses classes)
- **Per-class F1** (which classes does the model understand well?)
- **Feature importance** (which features drive predictions?)
- **SHAP values** (for individual prediction explanations)

### Do NOT report
- Accuracy alone (masked by class imbalance)
- Claims about real-world industrial fire detection accuracy
- Benchmarks against production systems

---

## File Sizes

```
pyroclass_train_preprocessed.csv        12.55 MB
pyroclass_validation_preprocessed.csv    3.63 MB
pyroclass_test_preprocessed.csv          2.14 MB
Total                                   18.32 MB
```

All fit comfortably in memory and can be loaded into Google Colab.

---

## Next Steps for Armaan (ML Engineer)

1. Load preprocessed train/val/test CSVs
2. Extract 49 feature columns (listed above)
3. Encode target_class to integers (0, 1, 2 for 3 classes)
4. Train XGBoost with proper hyperparameters
5. Evaluate on test set using macro-F1 + confusion matrix
6. Generate SHAP explanations
7. Run Experiment 2 with label_confidence >= 0.70
8. Document results with caveats about weak labels

---

## Important Reminder

**High accuracy on weak labels ≠ Real-world accuracy on independent validation data.**

The model demonstrates that:
✅ The feature pipeline works
✅ Features have predictive power for rule-based labels
✅ XGBoost can learn patterns in the data

But it does NOT prove:
❌ The model will correctly classify independent real-world fires
❌ Industrial fires are truly distinguishable from vegetation fires
❌ This is production-ready

For production readiness, you need:
- Independent manual labeling of test/holdout set
- Evaluation against real domain expert classifications
- Iterative refinement based on real errors

---

## Questions?

Check the companion files:
- `dataset/ml/TRAINING_DATASET_README.md` - Original dataset overview
- `dataset/ml/pyroclass_class_distribution.csv` - Class balance statistics
- `preprocess_ml_dataset.py` - The preprocessing script (reproducible)
