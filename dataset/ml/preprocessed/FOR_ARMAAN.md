# For Armaan: ML Training Instructions

## Your Preprocessed Data is Ready ✅

The data is now in `dataset/ml/preprocessed/`:

```
pyroclass_train_preprocessed.csv        (27,830 rows × 57 cols)
pyroclass_validation_preprocessed.csv   (8,113 rows × 57 cols)
pyroclass_test_preprocessed.csv         (4,637 rows × 57 cols)
```

**IMPORTANT: This prototype model trains on 3 classes only:**
- `forest_fire`
- `non_industrial`
- `unknown`

Industrial classes (industrial_persistent, industrial_spike) and ag_burning have 0 training examples and are NOT included in this baseline.

**Original data untouched** in `dataset/ml/` (as requested).

---

## What Was Fixed

1. ✅ Dropped `distance_to_seed_facility_m` (100% NaN, no signal)
2. ✅ Filled history-derived features with 0 (e.g., `frp_z_score`, `mean_frp_30d`)
   - These are NaN for first detections (no prior baseline)
   - Filled with 0 = "no prior baseline"
   - The `has_history_*` flags remain so model can distinguish
3. ✅ Filled `days_since_previous_detection` with -1 (first detection marker)
4. ✅ **Zero missing values**—ready for XGBoost

---

## Important: Weak Labels ⚠️

**These are NOT ground-truth labels.**

Your labels were generated from rules like:
```
IF industrial_context_score > 0.7 AND 
   active_days_90d > 15 AND 
   frp_z_score < 2.0
THEN industrial_persistent
```

And your model will receive:
- `industrial_context_score`
- `active_days_90d`
- `frp_z_score`

**The model can simply learn the same rule.** High accuracy means you reproduced the rules, not that you can classify real fires.

**What to call this:**
- ✅ "Weak-supervision baseline"
- ✅ "Bootstrap XGBoost classifier"
- ❌ "Production fire classifier"
- ❌ "Ground-truth trained model"

---

## Your Features (49 total)

### Use These:

**Thermal** (8): `bright_ti4, bright_ti5, frp, confidence_encoded, scan, track, log_frp, thermal_difference`

**Temporal** (11): `year, month, day_of_year, day_of_week, hour, minute, is_night, hour_sin, hour_cos, month_sin, month_cos`

**Persistence** (18): `observation_count_7d/30d/90d, active_days_7d/30d/90d, mean/median/std/max_frp_7d/30d/90d, days_since_first_seen, days_since_previous_detection, has_history_7d/30d/90d`

**Anomaly** (3): `frp_deviation, frp_ratio_to_baseline, frp_z_score`

**Geographic** (9): `h3_cell, industrial_context_score, mining_context_score, industrial_polygon_overlap, mining_polygon_overlap, forest_polygon_overlap, agriculture_polygon_overlap, nearest_facility_type_encoded, type`

### Do NOT Use:

- `target_class` (target, not feature)
- `label_source` (metadata)
- `label_confidence` (use only for filtering/experiments, not as feature)
- `hotspot_id, latitude, longitude, timestamp` (identifiers)
- `daynight` (redundant with `is_night`)
- Any column that directly encodes the answer

---

## Training Plan

### Experiment 1: All Labels (3-Class Baseline)

**THIS PROTOTYPE TRAINS ON 3 CLASSES ONLY:**
- forest_fire
- non_industrial  
- unknown

```python
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix

# Load
train_df = pd.read_csv('dataset/ml/preprocessed/pyroclass_train_preprocessed.csv')
val_df = pd.read_csv('dataset/ml/preprocessed/pyroclass_validation_preprocessed.csv')
test_df = pd.read_csv('dataset/ml/preprocessed/pyroclass_test_preprocessed.csv')

# Target - 3 classes only
le = LabelEncoder()
y_train = le.fit_transform(train_df['target_class'])  # 3 classes
y_val = le.transform(val_df['target_class'])
y_test = le.transform(test_df['target_class'])

# Features (use the 49 listed above)
feature_cols = [list of 49 features from above]
X_train = train_df[feature_cols]
X_val = val_df[feature_cols]
X_test = test_df[feature_cols]

# Train 3-class model
model = xgb.XGBClassifier(
    n_estimators=500,
    max_depth=6,
    learning_rate=0.05,
    objective='multi:softprob',
    num_class=3,  # ONLY 3 classes in this prototype
    tree_method='hist',
    random_state=42,
    n_jobs=-1
)

model.fit(
    X_train, y_train,
    eval_set=[(X_val, y_val)],
    verbose=100
)

# Evaluate
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred, target_names=le.classes_))
print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))
```

### Experiment 2: High-Confidence Labels Only

```python
# Filter to high-confidence labels
train_hc = train_df[train_df['label_confidence'] >= 0.70]
val_hc = val_df[val_df['label_confidence'] >= 0.70]
test_hc = test_df[test_df['label_confidence'] >= 0.70]

# Repeat training on filtered data
# Compare metrics to Experiment 1
# Does removing low-confidence labels improve performance?
```

---

## What to Report

### Metrics to Calculate:

1. **Accuracy**: Overall correct predictions (but be cautious, class imbalance!)
2. **Macro-F1**: Average F1 across classes (respects imbalance)
3. **Per-Class F1, Precision, Recall**: How well does each class perform?
4. **Confusion Matrix**: Which classes get confused?
5. **Feature Importance**: Top 10 features driving predictions
6. **SHAP**: Explain individual predictions

### Example Output Format:

```
Experiment 1: 3-Class Baseline (27,830 samples)
===========================================
Classes: forest_fire, non_industrial, unknown

Accuracy:  0.82
Macro-F1:  0.75
  forest_fire:     Precision=0.80, Recall=0.85, F1=0.82
  non_industrial:  Precision=0.70, Recall=0.68, F1=0.69
  unknown:         Precision=0.68, Recall=0.72, F1=0.70

Confusion Matrix:
                Predicted
                Forest  NonInd  Unknown
Actual Forest     8500    800    781
       NonInd      600   6700   2625
       Unknown     400   1200   6224

Top 5 Features:
  1. frp_z_score              0.18
  2. mean_frp_30d             0.15
  3. active_days_90d          0.12
  4. frp_ratio_to_baseline    0.10
  5. forest_polygon_overlap   0.09

Experiment 2: High-Confidence Labels Only (X samples)
=====================================================
[Repeat above]
[Compare: Did Experiment 2 improve over Experiment 1?]

NOTE: This prototype does NOT include industrial_persistent, industrial_spike, or ag_burning (0 training examples available).
```

---

## SHAP Explanation Example

```python
import shap

# Train explainer
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# Example: First test sample
sample_idx = 0
prediction = model.predict([X_test.iloc[sample_idx]])[0]
class_name = le.classes_[prediction]

print(f"Prediction: {class_name}")
print("Top 5 Contributing Features:")
sample_shap = shap_values[prediction][sample_idx]
top_features_idx = np.argsort(np.abs(sample_shap))[-5:]
for i, feat_idx in enumerate(top_features_idx[::-1], 1):
    feat_name = feature_cols[feat_idx]
    feat_value = X_test.iloc[sample_idx, feat_idx]
    shap_val = sample_shap[feat_idx]
    direction = "↑" if shap_val > 0 else "↓"
    print(f"  {i}. {feat_name:30s} = {feat_value:10.3f}  {direction}")
```

---

## Files You're Working With

| File | Rows | Purpose |
|---|---|---|
| `pyroclass_train_preprocessed.csv` | 27,830 | Train XGBoost here |
| `pyroclass_validation_preprocessed.csv` | 8,113 | Validate during training |
| `pyroclass_test_preprocessed.csv` | 4,637 | Final evaluation only |

**Do NOT train on test data. Do NOT use test data to tune hyperparameters.**

---

## Critical Reminders

1. ✅ **Use macro-F1**, not accuracy (class imbalance)
2. ✅ **Show confusion matrix** (where does model struggle?)
3. ✅ **Explain with SHAP** (which features matter?)
4. ✅ **Report two experiments** (all labels + high-confidence)
5. ⚠️ **Call it weak-supervision baseline**, not production classifier
6. ⚠️ **High accuracy ≠ Real-world accuracy** (labels are rules-based)
7. ⚠️ **Don't use target_class or label_source as features**

---

## Deliverables

Once training is done, send:

1. `train_model.py` — Reproducible training script
2. `model_results.json` — Metrics from both experiments
3. `confusion_matrix_experiment1.csv` — Confusion matrix
4. `feature_importance.csv` — Top 20 features
5. `shap_sample_explanations.json` — SHAP for 10-20 random test samples
6. `model_evaluation_report.md` — Summary + caveats

---

## Questions?

Check:
- `dataset/ml/preprocessed/PREPROCESSING_README.md` — Full technical details
- `dataset/ml/TRAINING_DATASET_README.md` — Original dataset overview
- `preprocess_ml_dataset.py` — Reproducible preprocessing code

Good luck! 🚀
