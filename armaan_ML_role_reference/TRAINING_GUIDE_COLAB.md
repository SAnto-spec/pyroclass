# Armaan's ML Training Guide - Google Colab

## Your Role: ML Engineer

You're responsible for training the XGBoost 3-class classifier and producing model artifacts + evaluation metrics.

**Model**: XGBoost 3-class classifier (forest_fire, non_industrial, unknown)
**Platform**: Google Colab (free GPU/TPU)
**Input**: Preprocessed training data (27,830 samples)
**Output**: 5 model artifacts + evaluation report

---

## Phase 1: Upload Data to Google Colab

### Step 1.1: Prepare Files Locally

Gather these 3 preprocessed CSV files:
```
dataset/ml/preprocessed/pyroclass_train_preprocessed.csv        (12.55 MB)
dataset/ml/preprocessed/pyroclass_validation_preprocessed.csv   (3.63 MB)
dataset/ml/preprocessed/pyroclass_test_preprocessed.csv         (2.14 MB)
```

Total: ~18 MB (small enough for Colab upload)

### Step 1.2: Upload to Colab

Open Google Colab: https://colab.research.google.com

Create new notebook: "PyroClass_3Class_Baseline.ipynb"

Upload files:
```python
from google.colab import files
uploaded = files.upload()
# Select the 3 CSV files when prompted
```

OR use Google Drive (recommended for repeated runs):
```python
from google.colab import drive
drive.mount('/content/drive')

# Place CSVs in: /content/drive/MyDrive/pyroclass/
# Then reference them directly without re-uploading
```

### Step 1.3: Verify Upload

```python
import pandas as pd
import os

# Check files
print("Files in working directory:")
print(os.listdir('.'))

# Load and verify
train_df = pd.read_csv('pyroclass_train_preprocessed.csv')
val_df = pd.read_csv('pyroclass_validation_preprocessed.csv')
test_df = pd.read_csv('pyroclass_test_preprocessed.csv')

print(f"\nTrain: {train_df.shape}")
print(f"Val: {val_df.shape}")
print(f"Test: {test_df.shape}")
print(f"\nClasses: {sorted(train_df['target_class'].unique())}")
print(f"Missing values: {train_df.isnull().sum().sum()}")
```

Expected output:
```
Train: (27830, 57)
Val: (8113, 57)
Test: (4637, 57)
Classes: ['forest_fire', 'non_industrial', 'unknown']
Missing values: 0
```

---

## Phase 2: Install Dependencies

```python
# XGBoost (usually pre-installed, but verify)
!pip install xgboost scikit-learn pandas numpy matplotlib seaborn shap

# Verify versions
import xgboost as xgb
import sklearn
import shap

print(f"XGBoost: {xgb.__version__}")
print(f"Scikit-learn: {sklearn.__version__}")
print(f"SHAP: {shap.__version__}")
```

Expected:
```
XGBoost: 2.0.x or higher
Scikit-learn: 1.3.x or higher
SHAP: 0.43.x or higher
```

---

## Phase 3: Feature Engineering & Data Preparation

### Step 3.1: Define Feature Columns

```python
# Columns to DROP (not features)
drop_cols = [
    'hotspot_id',           # Identifier
    'latitude',             # Location (not predictive across India)
    'longitude',            # Location (not predictive across India)
    'timestamp',            # Datetime (already extracted to temporal features)
    'target_class',         # Target variable
    'label_source',         # Metadata
    'label_confidence',     # Metadata (use for filtering only)
    'type',                 # FIRMS type (already used in label construction, avoid leakage)
    'daynight',             # Redundant with is_night
    'h3_cell'               # Spatial identifier (too high cardinality, causes overfitting)
]

# Extract feature columns (everything else)
feature_cols = [col for col in train_df.columns if col not in drop_cols]

print(f"Total features: {len(feature_cols)}")
print("\nFeatures:")
for i, col in enumerate(feature_cols, 1):
    print(f"  {i}. {col}")
```

Expected: 48-49 features

### Step 3.2: Prepare X (features) and y (target)

```python
from sklearn.preprocessing import LabelEncoder

# Separate features and target
X_train = train_df[feature_cols]
y_train = train_df['target_class']

X_val = val_df[feature_cols]
y_val = val_df['target_class']

X_test = test_df[feature_cols]
y_test = test_df['target_class']

# Encode target (string → integer)
le = LabelEncoder()
y_train_encoded = le.fit_transform(y_train)
y_val_encoded = le.transform(y_val)
y_test_encoded = le.transform(y_test)

print("Label encoding:")
for i, class_name in enumerate(le.classes_):
    print(f"  {class_name} → {i}")

print(f"\nClass distribution (train):")
unique, counts = np.unique(y_train_encoded, return_counts=True)
for cls, count in zip(unique, counts):
    print(f"  {le.classes_[cls]}: {count} ({100*count/len(y_train_encoded):.1f}%)")
```

---

## Phase 4: Train XGBoost Model

### Step 4.1: Configure Model

```python
import xgboost as xgb

# XGBoost 3-class classifier
model = xgb.XGBClassifier(
    n_estimators=500,         # Number of boosting rounds
    max_depth=6,              # Tree depth (controls overfitting)
    learning_rate=0.05,       # Step size shrinkage (0.01-0.1)
    objective='multi:softprob',  # Multi-class classification with probabilities
    num_class=3,              # 3 classes: forest_fire, non_industrial, unknown
    tree_method='hist',       # Fast histogram-based algorithm
    random_state=42,          # Reproducibility
    n_jobs=-1,                # Use all CPU cores
    eval_metric='mlogloss',   # Multi-class log loss
    early_stopping_rounds=50  # Stop if val loss doesn't improve for 50 rounds
)

print("Model configured:")
print(model)
```

### Step 4.2: Train Model

```python
import time

start_time = time.time()

# Train with validation set for early stopping
model.fit(
    X_train, y_train_encoded,
    eval_set=[(X_train, y_train_encoded), (X_val, y_val_encoded)],
    verbose=100  # Print progress every 100 rounds
)

end_time = time.time()
training_time = end_time - start_time

print(f"\n✅ Training complete in {training_time/60:.2f} minutes")
print(f"Best iteration: {model.best_iteration}")
print(f"Best validation score: {model.best_score:.4f}")
```

Expected: 3-5 minutes on Colab CPU, 1-2 minutes on Colab GPU

---

## Phase 5: Evaluate Model

### Step 5.1: Predictions

```python
# Predict on test set
y_pred = model.predict(X_test)
y_pred_proba = model.predict_proba(X_test)

print("Test set predictions:")
print(f"  Shape: {y_pred.shape}")
print(f"  Unique predicted classes: {np.unique(y_pred)}")
```

### Step 5.2: Classification Report

```python
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# Accuracy
accuracy = accuracy_score(y_test_encoded, y_pred)
print(f"\n=== ACCURACY ===")
print(f"Test Accuracy: {accuracy:.4f}")

# Classification report (precision, recall, F1)
print(f"\n=== CLASSIFICATION REPORT ===")
print(classification_report(y_test_encoded, y_pred, target_names=le.classes_))
```

### Step 5.3: Confusion Matrix

```python
import seaborn as sns
import matplotlib.pyplot as plt

# Compute confusion matrix
cm = confusion_matrix(y_test_encoded, y_pred)

# Plot
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=le.classes_, yticklabels=le.classes_)
plt.title('Confusion Matrix (Test Set)')
plt.ylabel('Actual')
plt.xlabel('Predicted')
plt.tight_layout()
plt.savefig('confusion_matrix.png', dpi=150)
plt.show()

print("\n=== CONFUSION MATRIX ===")
print(cm)
```

### Step 5.4: Feature Importance

```python
# XGBoost feature importance
feature_importance = model.feature_importances_
importance_df = pd.DataFrame({
    'feature': feature_cols,
    'importance': feature_importance
}).sort_values('importance', ascending=False)

print("\n=== TOP 20 FEATURES ===")
print(importance_df.head(20))

# Plot
plt.figure(figsize=(10, 8))
importance_df.head(20).plot(x='feature', y='importance', kind='barh', figsize=(10, 8))
plt.title('Top 20 Feature Importances')
plt.xlabel('Importance')
plt.tight_layout()
plt.savefig('feature_importance.png', dpi=150)
plt.show()

# Save to CSV
importance_df.to_csv('feature_importance.csv', index=False)
```

---

## Phase 6: SHAP Explanations

### Step 6.1: Train SHAP Explainer

```python
import shap

# Initialize SHAP explainer (uses tree structure)
explainer = shap.TreeExplainer(model)

# Compute SHAP values for test set (takes 2-3 minutes)
print("Computing SHAP values...")
shap_values = explainer.shap_values(X_test)
print(f"SHAP values shape: {shap_values.shape}")  # (n_samples, n_features, n_classes)
```

### Step 6.2: SHAP Summary Plot

```python
# Summary plot (overall feature importance across all classes)
shap.summary_plot(shap_values, X_test, feature_names=feature_cols, class_names=le.classes_)
plt.savefig('shap_summary.png', dpi=150, bbox_inches='tight')
plt.show()
```

### Step 6.3: SHAP Explanation for Individual Samples

```python
# Example: Explain first test sample
sample_idx = 0
prediction = model.predict([X_test.iloc[sample_idx]])[0]
predicted_class = le.classes_[prediction]
probabilities = model.predict_proba([X_test.iloc[sample_idx]])[0]

print(f"\n=== SAMPLE {sample_idx} EXPLANATION ===")
print(f"Predicted class: {predicted_class}")
print(f"Probabilities: {dict(zip(le.classes_, probabilities))}")

# SHAP force plot
shap.force_plot(
    explainer.expected_value[prediction], 
    shap_values[sample_idx, :, prediction],
    X_test.iloc[sample_idx],
    feature_names=feature_cols,
    matplotlib=True
)
plt.savefig(f'shap_sample_{sample_idx}.png', dpi=150, bbox_inches='tight')
plt.show()

# Top 5 contributing features
sample_shap = shap_values[sample_idx, :, prediction]
top_features_idx = np.argsort(np.abs(sample_shap))[-5:][::-1]

print("\nTop 5 Contributing Features:")
for i, feat_idx in enumerate(top_features_idx, 1):
    feat_name = feature_cols[feat_idx]
    feat_value = X_test.iloc[sample_idx, feat_idx]
    shap_val = sample_shap[feat_idx]
    direction = "→ increases" if shap_val > 0 else "→ decreases"
    print(f"  {i}. {feat_name:30s} = {feat_value:10.3f}  (SHAP: {shap_val:+.3f} {direction} {predicted_class})")
```

---

## Phase 7: Export Model Artifacts

### Step 7.1: Save Model

```python
import pickle

# Save XGBoost model
model.save_model('xgboost_model.json')
print("✅ Saved: xgboost_model.json")

# Alternative: Save as pickle (smaller file)
with open('xgboost_model.pkl', 'wb') as f:
    pickle.dump(model, f)
print("✅ Saved: xgboost_model.pkl")
```

### Step 7.2: Save Label Encoder

```python
# Save label encoder
with open('label_encoder.pkl', 'wb') as f:
    pickle.dump(le, f)
print("✅ Saved: label_encoder.pkl")
```

### Step 7.3: Save SHAP Explainer

```python
# Save SHAP explainer
with open('shap_explainer.pkl', 'wb') as f:
    pickle.dump(explainer, f)
print("✅ Saved: shap_explainer.pkl")
```

### Step 7.4: Save Feature Schema

```python
import json

feature_schema = {
    "version": "prototype-baseline-v1",
    "num_features": len(feature_cols),
    "feature_names": feature_cols,
    "feature_types": {col: str(X_train[col].dtype) for col in feature_cols},
    "dropped_columns": drop_cols,
    "encoding": {
        "target_variable": "target_class",
        "label_mapping": {name: int(idx) for idx, name in enumerate(le.classes_)}
    }
}

with open('feature_schema.json', 'w') as f:
    json.dump(feature_schema, f, indent=2)
print("✅ Saved: feature_schema.json")
```

### Step 7.5: Save Model Metadata

```python
# Compute macro-F1 and per-class metrics
from sklearn.metrics import f1_score, precision_recall_fscore_support

macro_f1 = f1_score(y_test_encoded, y_pred, average='macro')
weighted_f1 = f1_score(y_test_encoded, y_pred, average='weighted')
precision, recall, f1, support = precision_recall_fscore_support(y_test_encoded, y_pred)

per_class_metrics = {}
for i, class_name in enumerate(le.classes_):
    per_class_metrics[class_name] = {
        "precision": float(precision[i]),
        "recall": float(recall[i]),
        "f1_score": float(f1[i]),
        "support": int(support[i])
    }

model_metadata = {
    "model_version": "v1.0.0-prototype-3class",
    "trained_date": str(pd.Timestamp.now()),
    "training_platform": "Google Colab",
    "training_time_minutes": round(training_time / 60, 2),
    "dataset": {
        "train_samples": len(X_train),
        "validation_samples": len(X_val),
        "test_samples": len(X_test),
        "num_features": len(feature_cols),
        "num_classes": 3,
        "class_names": list(le.classes_),
        "train_date_range": "2022-2023",
        "val_date_range": "Jan-Jun 2024",
        "test_date_range": "Jul-Dec 2024"
    },
    "hyperparameters": {
        "n_estimators": model.n_estimators,
        "max_depth": model.max_depth,
        "learning_rate": model.learning_rate,
        "objective": model.objective,
        "tree_method": model.tree_method,
        "random_state": model.random_state
    },
    "performance": {
        "test_accuracy": float(accuracy),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "per_class_metrics": per_class_metrics,
        "best_iteration": int(model.best_iteration),
        "best_validation_score": float(model.best_score)
    },
    "caveats": [
        "Model trained on weak/bootstrapped labels, not ground truth",
        "Label generation used features that are also model inputs",
        "High accuracy may reflect rule reproduction, not independent classification",
        "This is a 3-class baseline; industrial classes not included",
        "Do not claim production-grade fire classification accuracy"
    ]
}

with open('model_metadata.json', 'w') as f:
    json.dump(model_metadata, f, indent=2)
print("✅ Saved: model_metadata.json")
```

### Step 7.6: Download Artifacts

```python
# Download all artifacts to local machine
from google.colab import files

artifacts = [
    'xgboost_model.pkl',
    'label_encoder.pkl',
    'shap_explainer.pkl',
    'feature_schema.json',
    'model_metadata.json',
    'feature_importance.csv',
    'confusion_matrix.png',
    'feature_importance.png',
    'shap_summary.png'
]

print("Downloading artifacts...")
for artifact in artifacts:
    if os.path.exists(artifact):
        files.download(artifact)
        print(f"  ✅ {artifact}")
    else:
        print(f"  ❌ {artifact} not found")

print("\n✅ All artifacts downloaded!")
```

---

## Phase 8: Experiment 2 - High-Confidence Labels Only

```python
# Filter to high-confidence labels (>= 0.70)
train_hc = train_df[train_df['label_confidence'] >= 0.70]
val_hc = val_df[val_df['label_confidence'] >= 0.70]
test_hc = test_df[test_df['label_confidence'] >= 0.70]

print(f"High-confidence samples:")
print(f"  Train: {len(train_hc)} ({100*len(train_hc)/len(train_df):.1f}%)")
print(f"  Val: {len(val_hc)} ({100*len(val_hc)/len(val_df):.1f}%)")
print(f"  Test: {len(test_hc)} ({100*len(test_hc)/len(test_df):.1f}%)")

# Prepare data
X_train_hc = train_hc[feature_cols]
y_train_hc = le.transform(train_hc['target_class'])

X_val_hc = val_hc[feature_cols]
y_val_hc = le.transform(val_hc['target_class'])

X_test_hc = test_hc[feature_cols]
y_test_hc = le.transform(test_hc['target_class'])

# Train second model
model_hc = xgb.XGBClassifier(
    n_estimators=500, max_depth=6, learning_rate=0.05,
    objective='multi:softprob', num_class=3, tree_method='hist',
    random_state=42, n_jobs=-1, early_stopping_rounds=50
)

model_hc.fit(
    X_train_hc, y_train_hc,
    eval_set=[(X_val_hc, y_val_hc)],
    verbose=100
)

# Evaluate
y_pred_hc = model_hc.predict(X_test_hc)
accuracy_hc = accuracy_score(y_test_hc, y_pred_hc)
macro_f1_hc = f1_score(y_test_hc, y_pred_hc, average='macro')

print(f"\n=== EXPERIMENT 2: HIGH-CONFIDENCE LABELS ===")
print(f"Test Accuracy: {accuracy_hc:.4f} (vs Exp1: {accuracy:.4f})")
print(f"Macro F1: {macro_f1_hc:.4f} (vs Exp1: {macro_f1:.4f})")

if macro_f1_hc > macro_f1:
    print("\n✅ Filtering to high-confidence labels IMPROVED performance")
else:
    print("\n⚠️ Filtering to high-confidence labels did NOT improve performance")
```

---

## Phase 9: Create Evaluation Report

```python
report = f"""
# PyroClass 3-Class Baseline Model - Evaluation Report

## Model Information
- **Model Type**: XGBoost Multi-Class Classifier
- **Version**: v1.0.0-prototype-3class
- **Trained**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}
- **Platform**: Google Colab
- **Training Time**: {training_time/60:.2f} minutes

## Dataset
- **Training**: {len(X_train)} samples (2022-2023)
- **Validation**: {len(X_val)} samples (Jan-Jun 2024)
- **Test**: {len(X_test)} samples (Jul-Dec 2024)
- **Features**: {len(feature_cols)}
- **Classes**: 3 (forest_fire, non_industrial, unknown)

## Performance (Test Set)
- **Accuracy**: {accuracy:.4f}
- **Macro F1**: {macro_f1:.4f}
- **Weighted F1**: {weighted_f1:.4f}

### Per-Class Metrics:
{classification_report(y_test_encoded, y_pred, target_names=le.classes_)}

## Confusion Matrix
{cm}

## Top 10 Features:
{importance_df.head(10).to_string(index=False)}

## Experiment 2: High-Confidence Labels
- **Test Accuracy**: {accuracy_hc:.4f}
- **Macro F1**: {macro_f1_hc:.4f}
- **Improvement**: {'+' if macro_f1_hc > macro_f1 else ''}{(macro_f1_hc - macro_f1):.4f}

## Important Caveats
⚠️ This model is trained on WEAK LABELS, not ground truth.
⚠️ Labels were generated from rules using some of the same features as model inputs.
⚠️ High accuracy may reflect rule reproduction, not independent classification.
⚠️ This is a 3-class baseline; industrial classes not included.
⚠️ Do not claim production-grade fire classification accuracy without independent validation.

## Artifacts Generated
1. xgboost_model.pkl - Trained model
2. label_encoder.pkl - Target class encoder
3. shap_explainer.pkl - SHAP explainer for interpretability
4. feature_schema.json - Feature definitions
5. model_metadata.json - Training metadata and performance metrics
6. feature_importance.csv - Feature importance rankings
7. confusion_matrix.png - Visual confusion matrix
8. feature_importance.png - Visual feature importance
9. shap_summary.png - SHAP summary plot

## Next Steps
1. Send artifacts to backend engineer for integration
2. Test predictions on 20 prototype sites
3. Manual review of false positives/negatives
4. Iterative label improvement based on errors
5. Acquire industrial_persistent and ag_burning labels for 6-class model
"""

with open('evaluation_report.txt', 'w') as f:
    f.write(report)

print(report)
files.download('evaluation_report.txt')
```

---

## Summary Checklist

After completing all phases, you should have:

### Artifacts (9 files):
- [ ] `xgboost_model.pkl` - Trained XGBoost model
- [ ] `label_encoder.pkl` - Target encoder
- [ ] `shap_explainer.pkl` - SHAP explainer
- [ ] `feature_schema.json` - Feature definitions
- [ ] `model_metadata.json` - Performance metrics + metadata
- [ ] `feature_importance.csv` - Feature rankings
- [ ] `confusion_matrix.png` - Confusion matrix visualization
- [ ] `feature_importance.png` - Feature importance plot
- [ ] `shap_summary.png` - SHAP summary plot

### Metrics Documented:
- [ ] Test accuracy
- [ ] Macro F1 score
- [ ] Per-class precision, recall, F1
- [ ] Confusion matrix
- [ ] Top 20 feature importances
- [ ] SHAP explanations for sample predictions
- [ ] Experiment 2 comparison (high-confidence labels)

### Deliverables to Team:
- [ ] Send 9 artifacts to backend engineer
- [ ] Share evaluation report
- [ ] Document training time and resource usage
- [ ] Note any issues or observations during training

---

## Troubleshooting

**Issue**: Out of memory during SHAP computation
**Fix**: Compute SHAP on subset of test data (e.g., first 1000 samples)

**Issue**: Training takes too long
**Fix**: Reduce `n_estimators` to 300 or enable GPU runtime (Runtime → Change runtime type → GPU)

**Issue**: Model predicts only 1-2 classes
**Fix**: Check class imbalance, use `scale_pos_weight` parameter

**Issue**: Can't download large files from Colab
**Fix**: Use Google Drive mounting and save artifacts there instead

---

## Time Estimate

| Phase | Duration |
|---|---|
| Upload data | 2-3 min |
| Install dependencies | 1 min |
| Feature prep | 2 min |
| Train model | 3-5 min |
| Evaluate | 2 min |
| SHAP | 3-5 min |
| Export artifacts | 2 min |
| Experiment 2 | 5 min |
| Report | 2 min |
| **Total** | **~25-30 min** |

Good luck! 🚀
