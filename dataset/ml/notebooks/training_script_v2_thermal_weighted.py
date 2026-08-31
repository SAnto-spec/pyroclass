"""
PyroClass 3-Class XGBoost Training V2.1 - THERMAL-BIASED FEATURE SAMPLING

Uses XGBoost native feature_weights to bias column sampling toward thermal and
context features while still allowing persistence features to compete.

Important:
- sample_weight is ROW weighting and is not used for feature weighting.
- feature_weights affects feature sampling probability when colsample < 1; it
  does not guarantee that thermal features will become most important.
- Final model quality should be validated with ablation tests and SHAP, not by
  forcing a preferred importance ranking.
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
print("PYROCLASS V2.1 - THERMAL-BIASED FEATURE SAMPLING")
print("="*80)

# ============================================================================
# PHASE 1: LOAD DATA
# ============================================================================
print("\n[PHASE 1] Loading V2 optimized data...")

train_df = pd.read_csv('pyroclass_train_preprocessed_v2.csv')
val_df = pd.read_csv('pyroclass_validation_preprocessed_v2.csv')
test_df = pd.read_csv('pyroclass_test_preprocessed_v2.csv')

print(f"✓ Train: {train_df.shape}")
print(f"✓ Val: {val_df.shape}")
print(f"✓ Test: {test_df.shape}")

# ============================================================================
# PHASE 2: ADDITIONAL THERMAL FEATURE ENGINEERING
# ============================================================================
print("\n[PHASE 2] Creating additional thermal physics features...")

for df, name in [(train_df, 'train'), (val_df, 'val'), (test_df, 'test')]:
    # Open-ended bins avoid NaNs for values outside the original hard limits.
    df['thermal_intensity_category'] = pd.cut(
        df['bright_ti4'],
        bins=[-np.inf, 320, 340, 360, np.inf],
        labels=False
    ).astype('Int64').fillna(-1).astype(int)

    df['frp_intensity_level'] = pd.cut(
        df['frp'],
        bins=[-np.inf, 5, 15, 50, np.inf],
        labels=False
    ).astype('Int64').fillna(-1).astype(int)

    # Raw sensor temperature contrast.
    df['thermal_signature'] = df['bright_ti4'] - df['bright_ti5']

    # Mixed thermal/persistence feature; retained as supporting evidence.
    df['frp_per_active_day'] = df['frp'] / (df['active_days_90d'].clip(lower=0) + 1.0)

    # Like-for-like anomaly against the historical FRP baseline.
    baseline = df['mean_frp_90d'].replace(0, np.nan)
    df['frp_ratio_to_90d_mean'] = (
        df['frp'] / baseline
    ).replace([np.inf, -np.inf], np.nan).fillna(0.0)

    print(f"  {name}: Added 5 engineered features")

print(f"✓ Total features now: {train_df.shape[1]}")

# ============================================================================
# PHASE 3: PREPARE FEATURES WITH WEIGHTING
# ============================================================================
print("\n[PHASE 3] Preparing features with thermal weighting strategy...")

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

# ============================================================================
# DEFINE FEATURE WEIGHTS FOR XGBOOST COLUMN SAMPLING
# ============================================================================
print("\n[PHASE 4] Defining feature sampling weights...")

feature_weights_dict = {
    # Thermal / sensor features: encourage selection, do not force it.
    'bright_ti4': 3.0,
    'bright_ti5': 3.0,
    'frp': 3.0,
    'log_frp': 2.5,
    'thermal_difference': 2.5,
    'bright_ti4_to_ti5_ratio': 2.5,
    'frp_per_pixel': 2.0,
    'thermal_anomaly_strength': 2.0,
    'thermal_intensity_category': 2.5,
    'frp_intensity_level': 2.5,
    'thermal_signature': 2.0,
    'frp_ratio_to_90d_mean': 2.0,

    # Context features are central to the SIH problem statement.
    'industrial_context_score': 2.0,
    'mining_context_score': 2.0,
    'forest_polygon_overlap': 2.0,
    'industrial_polygon_overlap': 2.0,
    'mining_polygon_overlap': 2.0,
    'agriculture_polygon_overlap': 1.5,
    'nearest_facility_type_encoded': 1.5,

    # Persistence: still useful, but reduce its chance of being sampled.
    'active_days_90d': 0.5,
    'active_days_30d': 0.5,
    'active_days_7d': 0.5,
    'observation_count_90d': 0.6,
    'observation_count_30d': 0.6,
    'observation_count_7d': 0.6,
    'has_history_90d': 0.7,
    'has_history_30d': 0.7,
    'has_history_7d': 0.7,
    'days_since_first_seen': 0.7,
    'days_since_previous_detection': 0.7,

    # Historical FRP statistics are useful supporting evidence.
    'mean_frp_90d': 0.9,
    'mean_frp_30d': 0.9,
    'mean_frp_7d': 0.9,
    'median_frp_30d': 0.9,
    'std_frp_30d': 1.0,
    'max_frp_90d': 0.9,
    'max_frp_30d': 0.9,
    'frp_deviation': 1.0,
    'frp_ratio_to_baseline': 1.0,
    'frp_z_score': 1.0,
    'frp_growth_rate': 1.0,
    'frp_consistency': 1.0,
    'frp_per_active_day': 0.8,

    # Temporal features support seasonality but should not dominate.
    'is_night': 1.0,
    'month_sin': 0.8,
    'month_cos': 0.8,
    'month': 0.8,
    'day_of_year': 0.8,
    'day_of_week': 0.8,
    'year': 0.7,

    # Other raw sensor features.
    'confidence_encoded': 1.0,
    'scan': 1.0,
    'track': 1.0
}

# Convert to array matching feature column order
feature_weights = np.array([feature_weights_dict.get(f, 1.0) for f in feature_cols])

print(f"✓ Feature weights defined:")
print(f"  Thermal features: 2-3x sampling preference ({sum(1 for f in feature_cols if feature_weights_dict.get(f, 1.0) >= 5.0)} features)")
print(f"  Persistence features: 0.5-0.7x sampling preference ({sum(1 for f in feature_cols if feature_weights_dict.get(f, 1.0) <= 0.5)} features)")
print(f"  Normal weight: {sum(1 for f in feature_cols if 0.8 <= feature_weights_dict.get(f, 1.0) <= 1.5)} features")

# ============================================================================
# PHASE 5: TRAIN MODEL WITH FEATURE WEIGHTS
# ============================================================================
print("\n[PHASE 5] Training XGBoost with thermal feature weighting...")

start_time = time.time()

model = xgb.XGBClassifier(
    n_estimators=1000,
    max_depth=5,
    learning_rate=0.03,
    objective='multi:softprob',
    num_class=3,
    tree_method='hist',
    random_state=42,
    n_jobs=-1,
    eval_metric='mlogloss',
    early_stopping_rounds=75,
    verbosity=0,
    reg_alpha=0.0,
    reg_lambda=1.0,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=1
)

# sample_weight is per-row. feature_weights is per-column and is passed separately.
# Native feature_weights biases XGBoost's column sampling because colsample_bytree < 1.
model.fit(
    X_train,
    y_train_encoded,
    sample_weight=sample_weight_train,
    eval_set=[(X_val, y_val_encoded)],
    feature_weights=feature_weights,
    verbose=100
)

training_time = time.time() - start_time

print(f"\n✓ Training complete in {training_time:.1f} seconds ({training_time/60:.2f} minutes)")
print(f"✓ Best iteration: {model.best_iteration}")
print(f"✓ Best validation score: {model.best_score:.4f}")

# ============================================================================
# PHASE 6: EVALUATE
# ============================================================================
print("\n[PHASE 6] Evaluating on test set...")

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
# PHASE 7: FEATURE IMPORTANCE ANALYSIS
# ============================================================================
print("\n[PHASE 7] Analyzing feature importance (thermal-weighted)...")

feature_importance = model.feature_importances_
importance_df = pd.DataFrame({
    'feature': feature_cols,
    'importance': feature_importance,
    'weight_applied': [feature_weights_dict.get(f, 1.0) for f in feature_cols]
}).sort_values('importance', ascending=False)

print(f"\n✓ Top 20 Features (Thermal-Weighted Model):")
print(importance_df.head(20).to_string(index=False))

# Categorize features
thermal_features = [
    f for f in feature_cols
    if ('bright' in f or 'thermal' in f or f in {
        'frp', 'log_frp', 'frp_per_pixel', 'frp_intensity_level',
        'frp_ratio_to_90d_mean'
    })
]
# Do not count mixed features such as frp_per_active_day as purely thermal.
persistence_features = [
    f for f in feature_cols
    if ('active_days' in f or 'observation_count' in f or
        'has_history' in f or 'days_since' in f)
]

thermal_importance = importance_df[importance_df['feature'].isin(thermal_features)]['importance'].sum()
persistence_importance = importance_df[importance_df['feature'].isin(persistence_features)]['importance'].sum()

print(f"\n✓ Category Importance:")
print(f"  Thermal features: {thermal_importance:.4f} ({100*thermal_importance:.1f}%)")
print(f"  Persistence features: {persistence_importance:.4f} ({100*persistence_importance:.1f}%)")
ratio = thermal_importance / persistence_importance if persistence_importance > 0 else np.inf
print(f"  Ratio (Thermal/Persistence): {ratio:.2f}x")

print(f"\n✓ Top Thermal Features:")
thermal_top = importance_df[importance_df['feature'].isin(thermal_features)].head(10)
print(thermal_top.to_string(index=False))

# ============================================================================
# PHASE 8: VISUALIZATIONS
# ============================================================================
print("\n[PHASE 8] Creating visualizations...")

plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=le.classes_, yticklabels=le.classes_)
plt.title('Confusion Matrix (Thermal-Weighted Model)')
plt.ylabel('Actual')
plt.xlabel('Predicted')
plt.tight_layout()
plt.savefig('confusion_matrix_thermal_weighted.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ Saved: confusion_matrix_thermal_weighted.png")

plt.figure(figsize=(10, 8))
importance_df.head(20).plot(x='feature', y='importance', kind='barh', figsize=(10, 8))
plt.title('Top 20 Feature Importances (Thermal-Weighted)')
plt.xlabel('Importance')
plt.tight_layout()
plt.savefig('feature_importance_thermal_weighted.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ Saved: feature_importance_thermal_weighted.png")

# ============================================================================
# PHASE 9: SHAP EXPLANATIONS
# ============================================================================
print("\n[PHASE 9] Computing SHAP explanations (2-3 minutes)...")

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)
shap.summary_plot(shap_values, X_test, feature_names=feature_cols,
                  class_names=le.classes_, show=False)
plt.tight_layout()
plt.savefig('shap_summary_thermal_weighted.png', dpi=150, bbox_inches='tight')
plt.close()
print("✓ Saved: shap_summary_thermal_weighted.png")

# ============================================================================
# PHASE 10: EXPORT ARTIFACTS
# ============================================================================
print("\n[PHASE 10] Exporting thermal-weighted model artifacts...")

model.save_model('xgboost_model_thermal_weighted.json')
with open('xgboost_model_thermal_weighted.pkl', 'wb') as f:
    pickle.dump(model, f)
print("✓ Saved: xgboost_model_thermal_weighted.pkl")

with open('label_encoder_thermal_weighted.pkl', 'wb') as f:
    pickle.dump(le, f)
print("✓ Saved: label_encoder_thermal_weighted.pkl")

with open('shap_explainer_thermal_weighted.pkl', 'wb') as f:
    pickle.dump(explainer, f)
print("✓ Saved: shap_explainer_thermal_weighted.pkl")

metadata = {
    "model_version": "v2.1.0-thermal-biased-sampling",
    "trained_date": str(pd.Timestamp.now()),
    "training_time_seconds": round(training_time, 2),
    "weighting_strategy": "Native XGBoost feature sampling weights: thermal/context preferred, persistence down-weighted",
    "dataset": {
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "num_features": len(feature_cols)
    },
    "performance": {
        "test_accuracy": float(accuracy),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "thermal_importance_pct": float(thermal_importance * 100),
        "persistence_importance_pct": float(persistence_importance * 100)
    },
    "feature_weights": feature_weights_dict
}

with open('model_metadata_thermal_weighted.json', 'w') as f:
    json.dump(metadata, f, indent=2)
print("✓ Saved: model_metadata_thermal_weighted.json")

importance_df.to_csv('feature_importance_thermal_weighted.csv', index=False)
print("✓ Saved: feature_importance_thermal_weighted.csv")

# ============================================================================
# PHASE 11: COMPARISON REPORT
# ============================================================================
print("\n[PHASE 11] Generating comparison report...")

report = f"""
{'='*80}
PYROCLASS V2 THERMAL-WEIGHTED MODEL - COMPARISON REPORT
{'='*80}

APPROACH
{'='*80}
Strategy: Feature weighting to prioritize thermal/physics over persistence
Thermal features: 2-3x sampling preference (bright_ti4, frp, thermal ratios)
Persistence features: 0.5-0.7x sampling preference (active_days, observation_count)
Goal: Encourage thermal/context evidence without removing useful persistence signals

PERFORMANCE IMPACT
{'='*80}
Test Accuracy:        {accuracy:.4f}
Macro F1:             {macro_f1:.4f}
Weighted F1:          {weighted_f1:.4f}

Confusion Matrix:
{cm}

FEATURE IMPORTANCE SHIFT
{'='*80}
Thermal Features Total:      {thermal_importance:.4f} ({100*thermal_importance:.1f}%)
Persistence Features Total:  {persistence_importance:.4f} ({100*persistence_importance:.1f}%)
Ratio (Thermal/Persist):     {ratio:.2f}x

Top 20 Features:
{importance_df.head(20).to_string(index=False)}

Top 10 Thermal Features:
{thermal_top.to_string(index=False)}

INTERPRETATION
{'='*80}
✓ Feature sampling was biased toward thermal/context features
✓ Persistence features were given lower sampling preference
✓ Verify the final behavior with importance, SHAP and ablation tests before claiming improved physical realism

Expected:
- Thermal/context features should receive more opportunities during column sampling
- Persistence dominance may decrease, but this is not guaranteed
- Compare accuracy, Macro F1, SHAP and ablation tests before selecting a model

DEPLOYMENT RECOMMENDATION
{'='*80}
Use this model if:
- You want physics-based fire classification
- You expect fires with different persistence patterns
- You need better generalization to new regions

Use V2 final if:
- You want maximum accuracy on current test set
- Your deployment has similar persistence patterns
- You're okay with temporal/persistence bias

{'='*80}
"""

with open('evaluation_report_thermal_weighted.txt', 'w') as f:
    f.write(report)

print(report)

# ============================================================================
# PHASE 12: DOWNLOAD ARTIFACTS
# ============================================================================
print("\n[PHASE 12] Downloading all artifacts...")

artifacts = [
    'xgboost_model_thermal_weighted.pkl',
    'xgboost_model_thermal_weighted.json',
    'label_encoder_thermal_weighted.pkl',
    'shap_explainer_thermal_weighted.pkl',
    'model_metadata_thermal_weighted.json',
    'feature_importance_thermal_weighted.csv',
    'confusion_matrix_thermal_weighted.png',
    'feature_importance_thermal_weighted.png',
    'shap_summary_thermal_weighted.png',
    'evaluation_report_thermal_weighted.txt'
]

for artifact in artifacts:
    if os.path.exists(artifact):
        files.download(artifact)
        print(f"✓ {artifact}")

print("\n" + "="*80)
print("✅ THERMAL-WEIGHTED TRAINING COMPLETE")
print("="*80)
print(f"\nSummary:")
print(f"  Training Time: {training_time/60:.2f} minutes")
print(f"  Test Accuracy: {accuracy:.4f}")
print(f"  Macro F1: {macro_f1:.4f}")
print(f"  Thermal Importance: {100*thermal_importance:.1f}%")
print(f"  Persistence Importance: {100*persistence_importance:.1f}%")
print(f"  Thermal/Persistence Ratio: {ratio:.2f}x")
print(f"  Artifacts: {len(artifacts)} files")
print(f"\nComparison: V2 Final vs V2 Thermal-Weighted")
print(f"  V2 Final: active_days_90d #1 (30.6%), accuracy 90.19%")
print(f"  V2 Thermal: thermal features prioritized, accuracy {accuracy:.4f}")
