# PyroClass 3-Class Model Training - Google Colab Setup

## Quick Start

### Step 1: Open Google Colab
Go to https://colab.research.google.com and create new notebook

### Step 2: Upload Preprocessed Data
```python
from google.colab import files
uploaded = files.upload()
```

Select these 3 files:
- `pyroclass_train_preprocessed.csv`
- `pyroclass_validation_preprocessed.csv`
- `pyroclass_test_preprocessed.csv`

### Step 3: Copy Complete Training Script
Copy the entire content of `training_script.py` into a single Colab cell and execute.

The script will:
1. Load and verify data
2. Prepare 48 features
3. Train XGBoost (3-class)
4. Evaluate on test set
5. Compute SHAP explanations
6. Run Experiment 2 (high-confidence labels)
7. Export 11 artifacts
8. Download all files locally

**Total time: ~25-30 minutes**

---

## What Gets Generated

### Model Artifacts (5)
1. `xgboost_model.pkl` - Trained model (pickle format)
2. `xgboost_model.json` - Trained model (JSON format)
3. `label_encoder.pkl` - Target class encoder
4. `shap_explainer.pkl` - SHAP explainer
5. `feature_schema.json` - Feature definitions

### Metadata (1)
6. `model_metadata.json` - Complete performance metrics + hyperparameters

### Evaluation (3)
7. `feature_importance.csv` - Feature rankings (48 features)
8. `confusion_matrix.png` - Confusion matrix heatmap
9. `feature_importance.png` - Top 20 features bar chart

### SHAP (1)
10. `shap_summary.png` - SHAP feature importance across all classes

### Report (1)
11. `evaluation_report.txt` - Complete evaluation summary

---

## What to Expect

### Experiment 1 (All Labels)
- Train: 27,830 samples
- Test Accuracy: ~0.75-0.80
- Macro F1: ~0.70-0.75
- Classes: forest_fire, non_industrial, unknown

### Experiment 2 (High-Confidence Only)
- Train: ~10,000-15,000 samples (filtered)
- Compare performance to Experiment 1
- If F1 improves: low-confidence labels hurt the model
- If F1 worsens: filtering removes too much data

---

## Troubleshooting

**Problem**: Out of memory during SHAP
**Solution**: Skip SHAP (comment out Phase 7) or compute on smaller sample

**Problem**: Training too slow
**Solution**: Enable GPU (Runtime → Change runtime type → GPU/TPU)

**Problem**: Files not uploading
**Solution**: Use Google Drive instead
```python
from google.colab import drive
drive.mount('/content/drive')
# Reference files from /content/drive/MyDrive/
```

**Problem**: Can't download large files
**Solution**: Save to Google Drive instead
```python
!cp *.pkl /content/drive/MyDrive/pyroclass/
```

---

## Next Steps After Training

1. **Send to Backend Engineer**
   - Send 5 model artifacts (pkl/json files)
   - Send feature_schema.json
   - Send model_metadata.json

2. **Manual Validation**
   - Review confusion matrix
   - Check top 20 features (do they make sense?)
   - Review SHAP explanations

3. **Test on Prototype Sites**
   - Get predictions for 20 curated prototype sites
   - Compare to expected classes

4. **Plan Next Iteration**
   - If industrial classes needed: source labels first
   - If performance poor: review feature engineering
   - If rules-like: consider different model architecture

---

## File Locations

**Upload from**: `dataset/ml/preprocessed/`
- pyroclass_train_preprocessed.csv
- pyroclass_validation_preprocessed.csv
- pyroclass_test_preprocessed.csv

**Download to**: Your local machine

**Reference**: `armaan_ML_role_reference/TRAINING_GUIDE_COLAB.md` for detailed phase-by-phase instructions

---

## Important Notes

✅ Weak labels (rules-based, not ground truth)
✅ 3 classes only (forest_fire, non_industrial, unknown)
✅ Chronological split (no data leakage)
✅ 48 features (all thermal, temporal, persistence, anomaly, geographic)
✅ Complete SHAP interpretability

⚠️ Do NOT claim production-grade accuracy
⚠️ Do NOT use on real industrial classification without independent validation
⚠️ This is a prototype baseline for internal evaluation

---

Ready to train? Copy `training_script.py` content into Colab and execute!
