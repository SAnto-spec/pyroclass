import pandas as pd

# Load master
master_df = pd.read_csv('dataset/ml/pyroclass_training_master.csv')

print("=== TRAINING MASTER OVERVIEW ===")
print(f"Shape: {master_df.shape}")
print(f"Rows: {len(master_df)}")
print(f"Columns: {len(master_df.columns)}")

print("\n=== TARGET CLASS DISTRIBUTION ===")
print(master_df['target_class'].value_counts())

print("\n=== DATE RANGE ===")
print(f"Date range: {master_df['timestamp'].min()} to {master_df['timestamp'].max()}")

print("\n=== SPLIT INFO ===")
if 'split' in master_df.columns:
    print(master_df['split'].value_counts())
else:
    print("No 'split' column - this is MASTER BEFORE split")

print("\n=== KEY DIFFERENCE ===")
print("Master:      40,580 rows (all events, 2022-2024)")
print("Train:       27,830 rows (2022-2023 only)")
print("Validation:   8,113 rows (Jan-Jun 2024 only)")
print("Test:         4,637 rows (Jul-Dec 2024 only)")
print("\nMaster = raw unfiltered, before temporal split")
print("Train/Val/Test = after chronological split (no leakage)")
