"""
PyroClass 3-Class XGBoost Training - Complete Script for Google Colab
FIXED VERSION - Handles missing classes in Experiment 2

This script trains a 3-class XGBoost model on preprocessed PyroClass data.
Classes: forest_fire, non_industrial, unknown

Setup:
1. Upload the 3 preprocessed CSV files to Colab
2. Copy this entire script into a Colab cell
3. Execute the cell

Output: 11 model artifacts ready for deployment
"""

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score, 
    f1_score, precision_recall_fscore_support
)
import shap
import pickle
import json
import time
import os
import matplotlib.pyplot as plt
import seaborn as sns
from google.colab import files
import warnings
warnings.filterwarnings('ignore')

print("="*80)
print("PYROCLASS 3-CLASS XGBOOST TRAINING - FIXED VERSION")
print("="*80)

# ============================================================================
# PHASE 1: LOAD AND VERIFY DATA
# ============================================================================
print("\n[PHASE 1] Loading preprocessed data...")

train_df = pd.read_csv('pyroclass_train_preprocessed.csv')
val_df = pd.read_csv('pyroclass_validation_preprocessed.csv')
test_df = pd.read_csv('pyroclass_test_preprocessed.csv')

print(f"✓ Train: {train_df.shape}")
print(f"✓ Val: {val_df.shape}")
print(f"✓ Test: {test_df.shape}")
print(f"✓ Classes: {sorted(train_df['target_class'].unique())}")
print(f"✓ Missing values: {train_df.isnull().sum().sum()}")

# ============================================================================
# PHASE 2: FEATURE ENGINEERING
# ============================================================================
print("\n[PHASE 2] Preparing features and target...")

drop_cols = [
    'hotspot_id', 'latitude', 'longitude', 'timestamp',
    'target_class', 'label_source', 'label_confidence',
    'type', 'daynight', 'h3_cell'
]

feature_cols = [col for col in train_df.columns if col not in drop_cols]
print(f"✓ Total features: {len(feature_cols)}")

X_train = train_df[feature_cols]
y_train = train_df['target_class']

X_val = val_df[feature_cols]
y_val = val_df['target_class']

X_test = test_df[feature_cols]
y_test = test_df['target_class']

le = LabelEncoder()
y_train_encoded = le.fit_transform(y_train)
y_val_encoded = le.transform(y_val)
y_test_encoded = le.transform(y_test)

print(f"✓ Label encoding:")
for i, class_name in enumerate(le.classes_):
    print(f"  {class_name} → {i}")

print(f"\n✓ Class distribution (training):")
unique, counts = np.unique(y_train_encoded, return_counts=True)
for cls, count in zip(unique, counts):
    pct = 100 * count / len(y_train_encoded)
    print(f"  {le.classes_[cls]:20s}: {count:5d} ({pct:5.1f}%)")

# ============================================================================
# PHASE 3: CONFIGURE AND TRAIN MODEL
# ============================================================================
print("\n[PHASE 3] Training XGBoost model...")

start_time = time.time()

model = xgb.XGBClassifier(
    n_estimators=500,
    max_depth=6,
    learning_rate=0.05,
    objective='multi:softprob',
    num_class=3,
    tree_method='hist',
    random_state=42,
    n_jobs=-1,
    eval_metric='mlogloss',
    early_stopping_rounds=50,
    verbosity=0
)

model.fit(
    X_train, y_train_encoded,
    eval_set=[(X_train, y_train_encoded), (X_val, y_val_encoded)],
    verbose=100
)

end_time = time.time()
training_time = end_time - start_time

print(f"\n✓ Training complete in {training_time/60:.2f} minutes")
print(f"✓ Best iteration: {model.best_iteration}")
print(f"✓ Best validation score: {model.best_score:.4f}")

# ============================================================================
# PHASE 4: EVALUATE ON TEST SET
# ============================================================================
print("\n[PHASE 4] Evaluating on test set...")

y_pred = model.predict(X_test)
y_pred_proba = model.predict_proba(X_test)

accuracy = accuracy_score(y_test_encoded, y_pred)
macro_f1 = f1_score(y_test_encoded, y_pred, average='macro')
weighted_f1 = f1_score(y_test_encoded, y_pred, average='weighted')
precision, recall, f1, support = precision_recall_fscore_support(y_test_encoded, y_pred)

print(f"\n✓ Test Accuracy: {accuracy:.4f}")
print(f"✓ Macro F1: {macro_f1:.4f}")
print(f"✓ Weighted F1: {weighted_f1:.4f}")

print(f"\n✓ Classification Report:")
print(classification_report(y_test_encoded, y_pred, target_names=le.classes_))

cm = confusion_matrix(y_test_encoded, y_pred)
print(f"✓ Confusion Matrix:")
print(cm)

# ============================================================================
# PHASE 5: FEATURE IMPORTANCE
# ============================================================================
print("\n[PHASE 5] Computing feature importance...")

feature_importance = model.feature_importances_
importance_df = pd.DataFrame({
    'feature': feature_cols,
    'importance': feature_importance
}).sort_values('importance', ascending=False)

print(f"\n✓ Top 20 Features:")
print(importance_df.head(20).to_string(index=False))

# ============================================================================
# PHASE 6: VISUALIZATIONS
# ============================================================================
print("\n[PHASE 6] Creating visualizations...")

plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=le.classes_, yticklabels=le.classes_)
plt.title('Confusion Matrix (Test Set)')
plt.ylabel('Actual')
plt.xlabel('Predicted')
plt.tight_layout()
plt.savefig('confusion_matrix.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ Saved: confusion_matrix.png")

plt.figure(figsize=(10, 8))
importance_df.head(20).plot(x='feature', y='importance', kind='barh', figsize=(10, 8))
plt.title('Top 20 Feature Importances')
plt.xlabel('Importance')
plt.tight_layout()
plt.savefig('feature_importance.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ Saved: feature_importance.png")

# ============================================================================
# PHASE 7: SHAP EXPLANATIONS
# ============================================================================
print("\n[PHASE 7] Computing SHAP explanations...")
print("  (This may take 2-3 minutes...)")

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

print("✓ SHAP values computed")

shap.summary_plot(shap_values, X_test, feature_names=feature_cols, 
                  class_names=le.classes_, show=False)
plt.tight_layout()
plt.savefig('shap_summary.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ Saved: shap_summary.png")

# ============================================================================
# PHASE 8: EXPORT ARTIFACTS
# ============================================================================
print("\n[PHASE 8] Exporting model artifacts...")

model.save_model('xgboost_model.json')
with open('xgboost_model.pkl', 'wb') as f:
    pickle.dump(model, f)
print("✓ Saved: xgboost_model.pkl, xgboost_model.json")

with open('label_encoder.pkl', 'wb') as f:
    pickle.dump(le, f)
print("✓ Saved: label_encoder.pkl")

with open('shap_explainer.pkl', 'wb') as f:
    pickle.dump(explainer, f)
print("✓ Saved: shap_explainer.pkl")

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
print("✓ Saved: feature_schema.json")

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
        "class_names": list(le.classes_)
    },
    "hyperparameters": {
        "n_estimators": model.n_estimators,
        "max_depth": model.max_depth,
        "learning_rate": model.learning_rate,
        "objective": model.objective,
        "tree_method": model.tree_method,
        "random_state": model.random_state,
        "early_stopping_rounds": 50
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
print("✓ Saved: model_metadata.json")

importance_df.to_csv('feature_importance.csv', index=False)
print("✓ Saved: feature_importance.csv")

# ============================================================================
# PHASE 9: EXPERIMENT 2 - HIGH-CONFIDENCE LABELS (WITH CLASS CHECK)
# ============================================================================
print("\n[PHASE 9] Running Experiment 2 (high-confidence labels >= 0.70)...")

train_hc = train_df[train_df['label_confidence'] >= 0.70]
val_hc = val_df[val_df['label_confidence'] >= 0.70]
test_hc = test_df[test_df['label_confidence'] >= 0.70]

print(f"High-confidence samples:")
print(f"  Train: {len(train_hc)} ({100*len(train_hc)/len(train_df):.1f}%)")
print(f"  Val: {len(val_hc)} ({100*len(val_hc)/len(val_df):.1f}%)")
print(f"  Test: {len(test_hc)} ({100*len(test_hc)/len(test_df):.1f}%)")

classes_train_hc = set(train_hc['target_class'].unique())
classes_test_hc = set(test_hc['target_class'].unique())
expected_classes = set(le.classes_)

accuracy_hc = None
macro_f1_hc = None
exp2_status = "SKIPPED"

if classes_train_hc == expected_classes and classes_test_hc == expected_classes:
    print("\n✓ All classes present in filtered data, proceeding with training...")
    
    X_train_hc = train_hc[feature_cols]
    y_train_hc = le.transform(train_hc['target_class'])

    X_val_hc = val_hc[feature_cols]
    y_val_hc = le.transform(val_hc['target_class'])

    X_test_hc = test_hc[feature_cols]
    y_test_hc = le.transform(test_hc['target_class'])

    model_hc = xgb.XGBClassifier(
        n_estimators=500, max_depth=6, learning_rate=0.05,
        objective='multi:softprob', num_class=3, tree_method='hist',
        random_state=42, n_jobs=-1, early_stopping_rounds=50, verbosity=0
    )

    model_hc.fit(
        X_train_hc, y_train_hc,
        eval_set=[(X_val_hc, y_val_hc)],
        verbose=50
    )

    y_pred_hc = model_hc.predict(X_test_hc)
    accuracy_hc = accuracy_score(y_test_hc, y_pred_hc)
    macro_f1_hc = f1_score(y_test_hc, y_pred_hc, average='macro')
    exp2_status = "COMPLETED"

    print(f"\n✓ Experiment 2 Results:")
    print(f"  Test Accuracy: {accuracy_hc:.4f} (vs Exp1: {accuracy:.4f})")
    print(f"  Macro F1: {macro_f1_hc:.4f} (vs Exp1: {macro_f1:.4f})")

    if macro_f1_hc > macro_f1:
        print(f"\n✅ Filtering to high-confidence labels IMPROVED performance")
    else:
        print(f"\n⚠️ Filtering to high-confidence labels did NOT improve performance")
else:
    print(f"\n⚠️ SKIPPING Experiment 2: Missing classes after filtering")
    print(f"  Expected: {expected_classes}")
    print(f"  Train has: {classes_train_hc}")
    print(f"  Test has: {classes_test_hc}")
    print(f"  (This is OK - confidence filter is too strict)")

# ============================================================================
# PHASE 10: GENERATE REPORT
# ============================================================================
print("\n[PHASE 10] Generating evaluation report...")

report_exp2 = ""
if accuracy_hc is not None:
    report_exp2 = f"""
EXPERIMENT 2: HIGH-CONFIDENCE LABELS (confidence >= 0.70)
{'='*80}
Training Samples:     {len(train_hc):,} ({100*len(train_hc)/len(train_df):.1f}%)
Test Accuracy:        {accuracy_hc:.4f} ({'+' if accuracy_hc > accuracy else ''}{accuracy_hc - accuracy:.4f})
Macro F1:             {macro_f1_hc:.4f} ({'+' if macro_f1_hc > macro_f1 else ''}{macro_f1_hc - macro_f1:.4f})
Result:               {'IMPROVED' if macro_f1_hc > macro_f1 else 'WORSENED'}
"""
else:
    report_exp2 = f"""
EXPERIMENT 2: HIGH-CONFIDENCE LABELS (confidence >= 0.70)
{'='*80}
Status:               SKIPPED
Reason:               Missing classes after filtering (threshold too strict)
Train classes:        {classes_train_hc}
Test classes:         {classes_test_hc}
Expected:             {expected_classes}

Try lower confidence threshold (0.50) for future experiments.
"""

report = f"""
{'='*80}
PYROCLASS 3-CLASS BASELINE MODEL - EVALUATION REPORT
{'='*80}

MODEL INFORMATION
{'='*80}
Model Type:           XGBoost Multi-Class Classifier
Version:              v1.0.0-prototype-3class
Trained:              {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}
Training Time:        {training_time/60:.2f} minutes

DATASET
{'='*80}
Training Samples:     {len(X_train):,} (2022-2023)
Validation Samples:   {len(X_val):,} (Jan-Jun 2024)
Test Samples:         {len(X_test):,} (Jul-Dec 2024)
Total Features:       {len(feature_cols)}
Total Classes:        3

EXPERIMENT 1: ALL LABELS
{'='*80}
Test Accuracy:        {accuracy:.4f}
Macro F1:             {macro_f1:.4f}
Weighted F1:          {weighted_f1:.4f}
Best Iteration:       {model.best_iteration}

Per-Class Metrics:
{classification_report(y_test_encoded, y_pred, target_names=le.classes_)}

Confusion Matrix:
{cm}

{report_exp2}

TOP 20 FEATURES
{'='*80}
{importance_df.head(20).to_string(index=False)}

IMPORTANT CAVEATS
{'='*80}
⚠️  Model trained on WEAK LABELS, not ground truth
⚠️  Label generation used features that are also model inputs
⚠️  High accuracy may reflect rule reproduction, not independent classification
⚠️  This is 3-class baseline; industrial classes NOT included (0 training examples)
⚠️  Do NOT claim production-grade fire classification accuracy

ARTIFACTS GENERATED
{'='*80}
1. xgboost_model.pkl          - Trained model
2. xgboost_model.json         - Model JSON format
3. label_encoder.pkl          - Target encoder
4. shap_explainer.pkl         - SHAP explainer
5. feature_schema.json        - Feature definitions
6. model_metadata.json        - Training metadata
7. feature_importance.csv     - Feature rankings
8. confusion_matrix.png       - Confusion matrix
9. feature_importance.png     - Feature importance plot
10. shap_summary.png          - SHAP plot
11. evaluation_report.txt     - This report

{'='*80}
END OF REPORT
{'='*80}
"""

with open('evaluation_report.txt', 'w') as f:
    f.write(report)

print(report)

# ============================================================================
# PHASE 11: DOWNLOAD ARTIFACTS
# ============================================================================
print("\n[PHASE 11] Downloading all artifacts...")

artifacts = [
    'xgboost_model.pkl',
    'xgboost_model.json',
    'label_encoder.pkl',
    'shap_explainer.pkl',
    'feature_schema.json',
    'model_metadata.json',
    'feature_importance.csv',
    'confusion_matrix.png',
    'feature_importance.png',
    'shap_summary.png',
    'evaluation_report.txt'
]

for artifact in artifacts:
    if os.path.exists(artifact):
        files.download(artifact)
        print(f"✓ {artifact}")

print("\n" + "="*80)
print("✅ TRAINING COMPLETE - ALL ARTIFACTS DOWNLOADED")
print("="*80)
print(f"\nSummary:")
print(f"  Model Accuracy: {accuracy:.4f}")
print(f"  Macro F1: {macro_f1:.4f}")
print(f"  Training Time: {training_time/60:.2f} minutes")
print(f"  Experiment 2: {exp2_status}")
print(f"  Artifacts: {len(artifacts)} files")
print(f"\nNext: Send artifacts to backend engineer for integration")
