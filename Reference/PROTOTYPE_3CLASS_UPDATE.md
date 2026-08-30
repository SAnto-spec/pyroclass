# PyroClass Prototype: 6-Class to 3-Class Update

## Status Change

The PyroClass prototype model has been **updated from a 6-class to a 3-class classifier** due to available labeled training data.

**Date**: August 29, 2026
**Reason**: Insufficient labeled examples for industrial_persistent, industrial_spike, and ag_burning classes

---

## What Changed

### Original 6-Class Taxonomy (Long-Term Goal)
```
0. industrial_persistent
1. industrial_spike
2. forest_fire
3. ag_burning
4. non_industrial
5. unknown
```

### Current 3-Class Prototype (Active)
```
0. forest_fire        (10,081 training samples)
1. non_industrial     (9,925 training samples)
2. unknown            (7,824 training samples)
```

### Classes NOT Included in Prototype
```
❌ industrial_persistent  (0 training samples)
❌ industrial_spike       (0 training samples)
❌ ag_burning            (0 training samples)
```

---

## Why This Change?

### Data Availability
The normalized training dataset contains:
- forest_fire: 15,000 candidate examples
- non_industrial: 14,283 candidate examples
- unknown: 9,346 candidate examples
- **industrial_persistent: 0 in training split** (1,806 candidates exist but not in chronological train/val/test split)
- **industrial_spike: 0 in training split** (145 candidates exist but not in chronological train/val/test split)
- **ag_burning: 0 candidates available**

### Architecture Decision
Rather than:
- ❌ Artificially duplicating the 20 prototype sites across India (introduces spatial leakage)
- ❌ Training 6 classes with 3 having zero examples (produces zero probability classes)
- ❌ Merging industrial candidates unsystematically into splits (breaks chronological integrity)

We chose:
- ✅ Train 3-class baseline on available data (forest_fire, non_industrial, unknown)
- ✅ Preserve 1,806 industrial_persistent + 145 industrial_spike candidates for future work
- ✅ Maintain chronological train/val/test split integrity (no data leakage)
- ✅ Establish working feature pipeline that can support 6 classes when labels are available

---

## Impact on Training

### XGBoost Model Configuration

**Old (6-class):**
```python
model = xgb.XGBClassifier(
    num_class=6,
    objective='multi:softprob',
    ...
)
```

**New (3-class):**
```python
model = xgb.XGBClassifier(
    num_class=3,  # UPDATED
    objective='multi:softprob',
    ...
)
```

### Output Format

**Target Variable**: `target_class` column (3 values instead of 6)
```
forest_fire    → 0
non_industrial → 1
unknown        → 2
```

**Model Predictions**: Returns probabilities for 3 classes only
```json
{
  "classification": "forest_fire",
  "confidence": 0.92,
  "class_probabilities": {
    "forest_fire": 0.92,
    "non_industrial": 0.06,
    "unknown": 0.02
  }
}
```

---

## What Stays the Same

✅ **Feature Engineering**: All 37 features remain unchanged
- Thermal, temporal, persistence, anomaly, geographic features all computed and available

✅ **Feature Pipeline**: Completely functional
- Can support 3 classes now
- Can scale to 6 classes when industrial labels are acquired

✅ **Model Architecture**: XGBoost baseline remains viable
- Same hyperparameters apply
- Feature importance/SHAP explanations work identically
- Performance metrics (accuracy, F1, confusion matrix) directly comparable

✅ **Backend Contract**: Minimal changes
- Same input: 37 features
- Same output: classification + confidence + anomaly_score + SHAP
- Just 3 classes instead of 6 in prediction enum

---

## Path to 6-Class Model

Once industrial_persistent and ag_burning labels are acquired:

1. **Merge industrial candidates** into train/val/test chronologically
2. **Source ag_burning samples** from agricultural context dataset
3. **Retrain XGBoost** with 6 classes using updated label set
4. **Evaluate performance** on each class including industrial
5. **Update backend** to expose all 6 classes

Current 3-class prototype serves as baseline for future comparison.

---

## Files Updated

### Reference Folder
- `Reference/ML_Engineer_Baseline.md` - Updated Section 3 (Classification Taxonomy)
- `Reference/FIRMS_ATTRIBUTES_MAPPING.md` - No change (feature level, not class level)

### Dataset/ML Folder
- `dataset/ml/TRAINING_DATASET_README.md` - Updated Target Classes section
- `dataset/ml/preprocessed/PREPROCESSING_README.md` - Updated training set description
- `dataset/ml/preprocessed/FOR_ARMAAN.md` - Updated all training instructions

### ML Role Reference
- No changes required (feature engineering unchanged)

---

## Quick Reference Table

| Aspect | Old (Goal) | New (Prototype) |
|---|---|---|
| **Classes** | 6 | 3 |
| **Training Samples** | Unavailable for all 6 | 27,830 (forest_fire, non_industrial, unknown) |
| **Model Ready** | ❌ (missing labels) | ✅ (ready to train) |
| **Features** | 37 (all) | 37 (all) |
| **XGBoost num_class** | 6 | 3 |
| **Timeline** | Long-term | Current prototype |

---

## Messages for Team

### For Armaan (ML Engineer)
"Train your 3-class baseline on forest_fire, non_industrial, unknown. The feature pipeline is complete; we just don't have labels for industrial classes yet. Once we acquire those, we'll retrain with 6 classes."

### For Santo (Backend Engineer)
"The model will output 3 classes for now. The same input/output structure scales to 6 classes later without major refactoring."

### For Data Pipeline Team
"The industrial candidates (1,806 persistent + 145 spike) are still in the audit data. We'll incorporate them once we verify the chronological split logic for adding late-arriving labels."

---

## When Will This Change Back to 6-Class?

**Trigger**: When we have verified labeled examples for:
1. industrial_persistent (need ~5K samples, currently 1,806 candidates)
2. industrial_spike (need ~500 samples, currently 145 candidates)
3. ag_burning (need ~500 samples, currently 0 candidates)

**Estimated Timeline**: 4-6 weeks after industrial candidate review + ag_burning sourcing

**Process**:
1. Audit 1,806 industrial_persistent candidates → verify labels → add to training
2. Source ag_burning from agricultural context data → label → add to training
3. Regenerate chronological train/val/test split with 6 classes
4. Retrain XGBoost model
5. Evaluate performance improvement
6. Deploy 6-class model to production

---

## Technical Verification

✅ **No Data Loss**: All 40,580 events preserved; 3 classes fully represented in splits
✅ **No Feature Loss**: All 37 features available for 3-class training
✅ **No Architecture Change**: XGBoost parameters minimal adjustments
✅ **Reproducible**: Preprocessing script, training script, evaluation metrics all documented

This is a **temporary scoping decision**, not a permanent architecture limitation.
