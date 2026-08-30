import pandas as pd
import numpy as np

# Load training data
df = pd.read_csv('dataset/ml/pyroclass_train.csv')

print("=== DATASET OVERVIEW ===")
print(f"Shape: {df.shape}")
print(f"Total columns: {len(df.columns)}")
print(f"Total rows: {len(df)}")

print("\n=== TARGET CLASS DISTRIBUTION ===")
print(df['target_class'].value_counts())

print("\n=== MISSING VALUES (Top 20) ===")
missing = df.isnull().sum()
missing_sorted = missing[missing > 0].sort_values(ascending=False)
if len(missing_sorted) > 0:
    print(missing_sorted.head(20))
    print(f"Total columns with missing values: {len(missing_sorted)}")
else:
    print("No missing values!")

print("\n=== DATA TYPES ===")
print(df.dtypes.value_counts())

print("\n=== FEATURE COLUMNS (excluding metadata) ===")
feature_cols = [col for col in df.columns 
                if col not in ['hotspot_id', 'latitude', 'longitude', 'timestamp', 
                               'target_class', 'label_source', 'label_confidence', 'type', 'daynight']]
print(f"Total ML features: {len(feature_cols)}")
print("Features:", feature_cols[:15])

print("\n=== READY TO TRAIN? ===")
print(f"✓ Training samples: {len(df)}")
print(f"✓ Features: {len(feature_cols)}")
print(f"✓ Classes: {df['target_class'].nunique()}")
print(f"✓ Class labels: {sorted(df['target_class'].unique())}")

if len(missing_sorted) > 0:
    print(f"⚠️  Columns with missing values: {len(missing_sorted)}")
    print("   Need to handle: fill with 0, drop rows, or impute")
else:
    print("✓ No missing values")

print("\n=== SAMPLE ROWS ===")
print(df.head(2))
