"""
PyroClass 3-Class XGBoost Training V2 - FINAL
No hyperparameter tuning. Direct training with optimized defaults.
Time: ~5 minutes

Optimizations applied:
1. Temporal features removed (hour, minute bias)
2. Feature engineering added (7 new thermal/geospatial features)
3. Regularization enabled (L1/L2 + subsampling)
4. Sample weighting by label confidence
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
print("PYROCLASS 3-CLASS XGBOOST TRAINING - V2 FINAL (NO TUNING)")
print("="*80)

# ============================================================================
# PHASE 1: LOAD DATA
# ============================================================================
print("\n[PHASE 1] Loading optimized preprocessed data...")

train_df = pd.read_csv('pyroclass_train_preprocessed_v2.csv')
val_df = pd.read_csv('pyroclass_validation_preprocessed_v2.csv')
test_df = pd.read_csv('pyroclass_test_preprocessed_v2.csv')

print(f"✓ Train: {train_df.shape}")
print(f"✓ Val: {val_df.shape}")
print(f"✓ Test: {test_df.shape}")

# ============================================================================
# PHASE 2: PREPARE FEATURES
# ============================================================================
print("\n[PHASE 2] Preparing features and target...")

drop_cols = [
    'hotspot_id', 'latitude', 'longitude', 'timestamp',
    'target_class', 'label_source', 'label_confidence',
    'type', 'daynight', 'h3_cell', 'sample_weight'
]

feature_cols = [col for col in train_df.columns if col not in drop_cols]
print(f"✓ Total features: {len(feature_cols)}")

X_train = train_df[feature_cols]
y_train = train_df['target_class']
sample_weight_train = train_df['sample_weight'].values

X_val = val_df[feature_cols]
y_val = val_df['target_class']

X_test = test_df[feature_cols]
y_test = test_df['target_class']

le = LabelEncoder()
y_train_encoded = le.fit_transform(y_train)
y_val_encoded = le.transform(y_val)
y_test_encoded = le.transform(y_test)

print(f"✓ Label encoding: {dict(zip(le.classes_, range(len(le.classes_))))}")
print(f"✓ Class distribution:")
unique, counts = np.unique(y_train_encoded, return_counts=True)
for cls, count in zip(unique, counts):
    pct = 100 * count / len(y_train_encoded)
    print(f"  {le.classes_[cls]:20s}: {count:5d} ({pct:5.1f}%)")

# ============================================================================
# PHASE 3: TRAIN MODEL (OPTIMIZED DEFAULTS, NO TUNING)
# ============================================================================
print("\n[PHASE 3] Training XGBoost model...")
print("  Using optimized default hyperparameters (no tuning)")

start_time = time.time()

model = xgb.XGBClassifier(
    # Base config
    n_estimators=300,
    max_depth=6,
    learning_rate=0.05,
    objective='multi:softprob',
    num_class=3,
    tree_method='hist',
    random_state=42,
    n_jobs=-1,
    eval_metric='mlogloss',
    early_stopping_rounds=50,
    verbosity=0,
    # Regularization
    reg_alpha=0.1,
    reg_lambda=1.0,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=1
)

model.fit(
    X_train, y_train_encoded,
    sample_weight=sample_weight_train,
    eval_set=[(X_train, y_train_encoded), (X_val, y_val_encoded)],
    verbose=100
)

end_time = time.time()
training_time = end_time - start_time

print(f"\n✓ Training complete in {training_time:.1f} seconds ({training_time/60:.2f} minutes)")
print(f"✓ Best iteration: {model.best_iteration}")
print(f"✓ Best validation score: {model.best_score:.4f}")

# ============================================================================
# PHASE 4: EVALUATE
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

engineered_features = ['bright_ti4_to_ti5_ratio', 'frp_per_pixel', 'thermal_anomaly_strength',
                       'forest_AND_high_frp', 'industrial_AND_active', 'frp_growth_rate', 'frp_consistency']
engineered_importance = importance_df[importance_df['feature'].isin(engineered_features)]
if len(engineered_importance) > 0:
    print(f"\n✓ Engineered Features Importance:")
    print(engineered_importance.to_string(index=False))

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
    "version": "v2-final-no-tuning",
    "optimizations": [
        "Temporal features removed",
        "Feature engineering: 7 new features",
        "Regularization: L1=0.1, L2=1.0, subsample=0.8",
        "Sample weighting by label confidence"
    ],
    "num_features": len(feature_cols),
    "feature_names": feature_cols,
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
    "model_version": "v2.0.0-final",
    "trained_date": str(pd.Timestamp.now()),
    "training_platform": "Google Colab",
    "training_time_seconds": round(training_time, 2),
    "training_time_minutes": round(training_time / 60, 2),
    "hyperparameter_tuning": "SKIPPED - using optimized defaults",
    "rationale_for_no_tuning": "Weak labels (temporal bias) mean tuning optimizes noise, not real patterns. Better to fix label generation.",
    "dataset": {
        "train_samples": len(X_train),
        "validation_samples": len(X_val),
        "test_samples": len(X_test),
        "num_features": len(feature_cols),
        "num_classes": 3,
        "class_names": list(le.classes_)
    },
    "hyperparameters": {
        "n_estimators": 300,
        "max_depth": 6,
        "learning_rate": 0.05,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 1,
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
        "Temporal bias removed but labels still have class-dependent confidence",
        "This is 3-class baseline; industrial classes not included",
        "Do not claim production-grade fire classification accuracy",
        "Recommend fixing label generation before pursuing higher accuracy"
    ],
    "next_steps": [
        "Review label generation logic in data normalization pipeline",
        "Investigate why confidence scores differ by class",
        "Regenerate labels with uniform confidence methodology",
        "Retrain model on corrected labels",
        "Validate improvements on real-world data"
    ]
}

with open('model_metadata.json', 'w') as f:
    json.dump(model_metadata, f, indent=2)
print("✓ Saved: model_metadata.json")

importance_df.to_csv('feature_importance.csv', index=False)
print("✓ Saved: feature_importance.csv")

# ============================================================================
# PHASE 9: GENERATE REPORT
# ============================================================================
print("\n[PHASE 9] Generating evaluation report...")

report = f"""
{'='*80}
PYROCLASS 3-CLASS BASELINE MODEL - V2 FINAL
{'='*80}

MODEL INFORMATION
{'='*80}
Model Type:           XGBoost Multi-Class Classifier
Version:              v2.0.0-final (no tuning)
Trained:              {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}
Training Time:        {training_time:.1f} seconds ({training_time/60:.2f} minutes)
Hyperparameter Tuning: SKIPPED

WHY NO TUNING?
{'='*80}
Rationale:
- Your data has weak labels with temporal bias
- Tuning weak labels = optimizing for noise, not real patterns
- Expected improvement: 1-2% accuracy (not worth 2 hours)
- Better ROI: Fix label generation in normalization pipeline

Next phase:
- Review label_generation logic
- Regenerate with uniform confidence scoring
- Retrain model
- Validate improvements

DATASET & FEATURES
{'='*80}
Training Samples:     {len(X_train):,}
Validation Samples:   {len(X_val):,}
Test Samples:         {len(X_test):,}
Total Features:       {len(feature_cols)}

Optimizations Applied:
1. Temporal features removed: hour, minute, hour_sin, hour_cos
2. Engineered features added: 7 new (thermal ratios, interactions)
3. Regularization enabled: L1=0.1, L2=1.0, subsample=0.8
4. Sample weighting: By label_confidence (0.2-0.8)

PERFORMANCE
{'='*80}
Test Accuracy:        {accuracy:.4f}
Macro F1:             {macro_f1:.4f}
Weighted F1:          {weighted_f1:.4f}
Best Iteration:       {model.best_iteration}

Per-Class Metrics:
{classification_report(y_test_encoded, y_pred, target_names=le.classes_)}

Confusion Matrix:
{cm}

TOP 20 FEATURES
{'='*80}
{importance_df.head(20).to_string(index=False)}

ENGINEERED FEATURES IMPORTANCE
{'='*80}
{engineered_importance.to_string(index=False) if len(engineered_importance) > 0 else '(None in top 20)'}

ARTIFACTS GENERATED
{'='*80}
1. xgboost_model.pkl          - Trained model
2. xgboost_model.json         - Model JSON format
3. label_encoder.pkl          - Target encoder (class name ↔ number)
4. shap_explainer.pkl         - SHAP explainer
5. feature_schema.json        - Feature definitions
6. model_metadata.json        - Training metadata + next steps
7. feature_importance.csv     - Feature rankings
8. confusion_matrix.png       - Confusion matrix visualization
9. feature_importance.png     - Feature importance plot
10. shap_summary.png          - SHAP summary plot
11. evaluation_report.txt     - This report

IMPORTANT CAVEATS
{'='*80}
⚠️  Model trained on WEAK LABELS, not ground truth
⚠️  Temporal bias removed but class-dependent confidence remains
⚠️  This is 3-class baseline; industrial classes NOT included (0 samples)
⚠️  Do NOT claim production-grade fire classification accuracy
⚠️  Recommend fixing label generation for real improvements

DEPLOYMENT READINESS
{'='*80}
✓ Model is ready for backend integration
✓ Model is ready for API testing
✗ Model is NOT ready for production (weak labels)

Use for:
- Backend/API testing
- Proof of concept demo
- Feature pipeline validation

Do not use for:
- Production fire classification
- Real-world deployment
- Claims of accuracy on independent data

{'='*80}
END OF REPORT
{'='*80}
"""

with open('evaluation_report.txt', 'w') as f:
    f.write(report)

print(report)

# ============================================================================
# PHASE 10: DOWNLOAD ARTIFACTS
# ============================================================================
print("\n[PHASE 10] Downloading all artifacts...")

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
print(f"  Training Time: {training_time/60:.2f} minutes")
print(f"  Test Accuracy: {accuracy:.4f}")
print(f"  Macro F1: {macro_f1:.4f}")
print(f"  Artifacts: {len(artifacts)} files")
print(f"  Tuning: Skipped (using optimized defaults)")
print(f"\nNext: Review model_metadata.json for label generation fixes")
print(f"      Send artifacts to backend engineer for integration")
