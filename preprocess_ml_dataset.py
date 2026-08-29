"""
PyroClass ML Dataset Preprocessing
==================================

This script performs the corrected preprocessing on raw ML datasets.

IMPORTANT CAVEATS:
1. This model is trained on WEAK LABELS, not ground truth.
2. Labels were partly generated from the same features used as model inputs.
3. Results demonstrate the feature pipeline works, not real-world accuracy.
4. Use macro-F1, confusion matrix, and SHAP for evaluation.

Preprocessing Steps:
1. Drop distance_to_seed_facility_m (100% missing, no signal)
2. Fill history-derived NaNs with 0 (using has_history_* flags to distinguish)
3. Fill days_since_previous_detection with -1 (first observation marker)
4. Do NOT overwrite originals; save to preprocessed/ directory
"""

import pandas as pd
import numpy as np

# Define input and output paths
files = {
    'train': ('dataset/ml/pyroclass_train.csv', 'dataset/ml/preprocessed/pyroclass_train_preprocessed.csv'),
    'validation': ('dataset/ml/pyroclass_validation.csv', 'dataset/ml/preprocessed/pyroclass_validation_preprocessed.csv'),
    'test': ('dataset/ml/pyroclass_test.csv', 'dataset/ml/preprocessed/pyroclass_test_preprocessed.csv'),
}

# Columns to handle
drop_columns = ['distance_to_seed_facility_m']

history_numeric = [
    'mean_frp_7d',
    'mean_frp_30d',
    'mean_frp_90d',
    'median_frp_30d',
    'std_frp_30d',
    'max_frp_30d',
    'max_frp_90d',
    'frp_deviation',
    'frp_ratio_to_baseline',
    'frp_z_score',
]

temporal_delta = ['days_since_previous_detection']

def preprocess(input_path, output_path, dataset_name):
    """Load, preprocess, and save dataset."""
    print(f"\n{'='*60}")
    print(f"Processing: {dataset_name}")
    print(f"{'='*60}")
    
    # Load
    df = pd.read_csv(input_path)
    print(f"✓ Loaded {len(df)} rows, {len(df.columns)} columns")
    
    # Before stats
    print(f"\nBEFORE preprocessing:")
    print(f"  Missing values: {df.isnull().sum().sum()}")
    print(f"  distance_to_seed_facility_m: {df['distance_to_seed_facility_m'].isnull().sum()} NaN")
    for col in history_numeric:
        missing_count = df[col].isnull().sum()
        if missing_count > 0:
            print(f"  {col}: {missing_count} NaN ({100*missing_count/len(df):.1f}%)")
    print(f"  days_since_previous_detection: {df['days_since_previous_detection'].isnull().sum()} NaN")
    
    # STEP 1: Drop 100% missing column
    print(f"\nSTEP 1: Dropping distance_to_seed_facility_m (100% missing)")
    df.drop(columns=['distance_to_seed_facility_m'], inplace=True)
    print(f"✓ Column dropped")
    
    # STEP 2: Fill history-derived NaNs with 0
    print(f"\nSTEP 2: Filling history-derived features with 0")
    print(f"(These represent 'no prior history' in that H3 cell)")
    for col in history_numeric:
        missing_count = df[col].isnull().sum()
        if missing_count > 0:
            df[col].fillna(0, inplace=True)
            print(f"  ✓ {col}: filled {missing_count} → 0")
        else:
            print(f"  ✓ {col}: no NaN")
    
    # STEP 3: Fill temporal delta with -1
    print(f"\nSTEP 3: Filling days_since_previous_detection with -1")
    print(f"(-1 indicates 'first detection in H3 cell', not 0)")
    missing_count = df['days_since_previous_detection'].isnull().sum()
    if missing_count > 0:
        df['days_since_previous_detection'].fillna(-1, inplace=True)
        print(f"✓ Filled {missing_count} → -1")
    else:
        print(f"✓ No NaN")
    
    # After stats
    print(f"\nAFTER preprocessing:")
    print(f"  Total missing values: {df.isnull().sum().sum()}")
    print(f"  Rows retained: {len(df)}")
    print(f"  Columns remaining: {len(df.columns)}")
    
    # CRITICAL: Verify has_history_* flags are still present
    history_flags = ['has_history_7d', 'has_history_30d', 'has_history_90d']
    for flag in history_flags:
        if flag in df.columns:
            print(f"  ✓ {flag} retained (preserves 'no history' semantics)")
        else:
            print(f"  ✗ WARNING: {flag} missing!")
    
    # Save to preprocessed directory
    print(f"\nSaving to: {output_path}")
    df.to_csv(output_path, index=False)
    print(f"✓ Saved")
    
    return df

# Process all three splits
print("\n" + "="*60)
print("PyroClass ML Dataset Preprocessing")
print("="*60)

for dataset_name, (input_path, output_path) in files.items():
    preprocess(input_path, output_path, dataset_name)

print("\n" + "="*60)
print("Preprocessing Complete")
print("="*60)
print("\nFiles created in dataset/ml/preprocessed/:")
print("  - pyroclass_train_preprocessed.csv")
print("  - pyroclass_validation_preprocessed.csv")
print("  - pyroclass_test_preprocessed.csv")

print("\nIMPORTANT CAVEATS:")
print("1. These labels are weak/bootstrapped, not ground truth")
print("2. Label generation used features that will also be model inputs")
print("3. High accuracy may mean reproducing label rules, not real classification")
print("4. Use macro-F1, confusion matrix, SHAP for meaningful evaluation")
print("5. Don't claim production-grade fire classification accuracy")

print("\nNEXT STEPS:")
print("1. Train 3-class baseline: forest_fire, non_industrial, unknown")
print("2. Run second experiment with label_confidence >= 0.70")
print("3. Report macro-F1, confusion matrix, feature importance, SHAP")
print("4. Do NOT use target_class, label_source, candidate_reason as features")
print("5. Use label_confidence only for filtering/weighting, not as predictor")
