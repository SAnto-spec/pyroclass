from pathlib import Path
import pandas as pd


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"

INPUT_FILES = [
    RAW_DIR / "viirs-jpss1_2022_India.csv",
    RAW_DIR / "viirs-jpss1_2023_India.csv",
    RAW_DIR / "viirs-jpss1_2024_India.csv",
]

MASTER_OUTPUT = PROCESSED_DIR / "firms_india_2022_2024_clean.csv"
TYPE2_OUTPUT = PROCESSED_DIR / "firms_type2_candidates.csv"
QUALITY_OUTPUT = PROCESSED_DIR / "data_quality_report.txt"


# Expected columns from your NOAA-20 VIIRS FIRMS files
EXPECTED_COLUMNS = [
    "latitude",
    "longitude",
    "bright_ti4",
    "scan",
    "track",
    "acq_date",
    "acq_time",
    "satellite",
    "instrument",
    "confidence",
    "version",
    "bright_ti5",
    "frp",
    "daynight",
    "type",
]


# NASA FIRMS type meanings
TYPE_LABELS = {
    0: "presumed_vegetation_fire",
    1: "active_volcano",
    2: "other_static_land_source",
    3: "offshore",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def print_section(title: str) -> None:
    """Print a readable section heading."""
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def validate_columns(df: pd.DataFrame, filename: str) -> None:
    """Check whether the file contains the expected FIRMS columns."""

    missing = [
        column
        for column in EXPECTED_COLUMNS
        if column not in df.columns
    ]

    extra = [
        column
        for column in df.columns
        if column not in EXPECTED_COLUMNS
    ]

    if missing:
        raise ValueError(
            f"{filename} is missing expected columns: {missing}"
        )

    if extra:
        print(
            f"WARNING: {filename} contains additional columns: {extra}"
        )


def clean_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Convert numeric FIRMS fields to numeric values."""

    numeric_columns = [
        "latitude",
        "longitude",
        "bright_ti4",
        "scan",
        "track",
        "bright_ti5",
        "frp",
        "type",
        "version",
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        )

    return df


def clean_text_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize text/categorical columns without destroying originals."""

    text_columns = [
        "satellite",
        "instrument",
        "confidence",
        "daynight",
    ]

    for column in text_columns:
        df[column] = (
            df[column]
            .astype("string")
            .str.strip()
        )

    # Normalize confidence and day/night to uppercase
    df["confidence"] = df["confidence"].str.upper()
    df["daynight"] = df["daynight"].str.upper()

    return df


def create_timestamp(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert NASA acquisition date + HHMM acquisition time
    into a single timestamp.
    """

    # Convert date
    df["acq_date"] = pd.to_datetime(
        df["acq_date"],
        errors="coerce"
    )

    # Convert time to 4-character HHMM
    time_string = (
        df["acq_time"]
        .astype("string")
        .str.replace(r"\.0$", "", regex=True)
        .str.zfill(4)
    )

    # Keep only plausible 4-digit times
    valid_time_format = time_string.str.match(r"^\d{4}$")

    combined_datetime = (
        df["acq_date"].dt.strftime("%Y-%m-%d")
        + " "
        + time_string.str[:2]
        + ":"
        + time_string.str[2:]
        + ":00"
    )

    df["timestamp"] = pd.to_datetime(
        combined_datetime.where(valid_time_format),
        errors="coerce"
    )

    return df


def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create useful time-related columns for later analysis."""

    df["year"] = df["timestamp"].dt.year.astype("Int64")
    df["month"] = df["timestamp"].dt.month.astype("Int64")
    df["day"] = df["timestamp"].dt.day.astype("Int64")
    df["day_of_year"] = (
        df["timestamp"]
        .dt.dayofyear
        .astype("Int64")
    )
    df["hour"] = df["timestamp"].dt.hour.astype("Int64")

    return df


def add_type_labels(df: pd.DataFrame) -> pd.DataFrame:
    """Add human-readable labels while preserving NASA's original type."""

    df["type_label"] = (
        df["type"]
        .map(TYPE_LABELS)
        .fillna("unknown_type")
    )

    return df


def add_confidence_score(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add an ordinal encoding of FIRMS confidence.

    This is NOT a probability.
    It is only a convenient numerical representation.
    """

    confidence_map = {
        "L": 0,
        "N": 1,
        "H": 2,
    }

    df["confidence_score"] = (
        df["confidence"]
        .map(confidence_map)
        .astype("Int64")
    )

    return df


def add_quality_flags(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add flags for suspicious/interesting observations.

    IMPORTANT:
    These flags do not delete rows.
    """

    # Coordinate validity
    df["invalid_latitude"] = ~df["latitude"].between(
        -90, 90
    )

    df["invalid_longitude"] = ~df["longitude"].between(
        -180, 180
    )

    df["invalid_coordinates"] = (
        df["invalid_latitude"]
        | df["invalid_longitude"]
    )

    # Time validity
    df["invalid_timestamp"] = df["timestamp"].isna()

    # FRP flags
    df["frp_zero"] = df["frp"].eq(0)

    # Do NOT delete these.
    # They may represent legitimate extreme events.
    df["frp_extreme"] = df["frp"] > 500

    # Thermal values missing
    df["missing_thermal_data"] = (
        df["bright_ti4"].isna()
        | df["bright_ti5"].isna()
        | df["frp"].isna()
    )

    return df


def remove_only_invalid_rows(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remove rows that are structurally unusable.

    We do NOT remove:
    - high FRP
    - zero FRP
    - low confidence
    - type 0
    - type 2
    - type 3

    Those are useful for later analysis.
    """

    before = len(df)

    df = df[
        ~df["invalid_coordinates"]
    ].copy()

    after_coordinates = len(df)

    df = df[
        ~df["invalid_timestamp"]
    ].copy()

    after_timestamp = len(df)

    print(f"Rows before invalid-row filtering: {before:,}")
    print(
        f"Removed invalid coordinates: "
        f"{before - after_coordinates:,}"
    )
    print(
        f"Removed invalid timestamps: "
        f"{after_coordinates - after_timestamp:,}"
    )

    return df


def create_hotspot_id(df: pd.DataFrame) -> pd.DataFrame:
    """Create a stable row-level identifier for the cleaned dataset."""

    df = df.reset_index(drop=True)

    df.insert(
        0,
        "hotspot_id",
        [
            f"HS_{i:07d}"
            for i in range(1, len(df) + 1)
        ]
    )

    return df


def generate_quality_report(
    raw_count: int,
    cleaned_count: int,
    df: pd.DataFrame,
    duplicate_count: int,
) -> str:
    """Create a human-readable quality report."""

    report_lines = []

    report_lines.append(
        "PYROCLASS FIRMS DATA QUALITY REPORT"
    )
    report_lines.append(
        "=" * 60
    )
    report_lines.append("")

    report_lines.append(
        f"Raw combined rows: {raw_count:,}"
    )

    report_lines.append(
        f"Cleaned rows: {cleaned_count:,}"
    )

    report_lines.append(
        f"Rows removed: {raw_count - cleaned_count:,}"
    )

    report_lines.append(
        f"Exact duplicate rows detected: {duplicate_count:,}"
    )

    report_lines.append("")

    report_lines.append(
        "YEAR COUNTS:"
    )

    year_counts = (
        df["year"]
        .value_counts(dropna=False)
        .sort_index()
    )

    for year, count in year_counts.items():
        report_lines.append(
            f"  {year}: {count:,}"
        )

    report_lines.append("")

    report_lines.append(
        "TYPE COUNTS:"
    )

    type_counts = (
        df["type_label"]
        .value_counts(dropna=False)
    )

    for type_name, count in type_counts.items():
        report_lines.append(
            f"  {type_name}: {count:,}"
        )

    report_lines.append("")

    report_lines.append(
        "QUALITY FLAGS:"
    )

    flag_columns = [
        "frp_zero",
        "frp_extreme",
        "missing_thermal_data",
        "invalid_coordinates",
        "invalid_timestamp",
    ]

    for column in flag_columns:
        if column in df.columns:
            report_lines.append(
                f"  {column}: "
                f"{int(df[column].sum()):,}"
            )

    report_lines.append("")

    report_lines.append(
        "SATELLITE / INSTRUMENT:"
    )

    report_lines.append(
        f"  Satellites: "
        f"{df['satellite'].dropna().unique().tolist()}"
    )

    report_lines.append(
        f"  Instruments: "
        f"{df['instrument'].dropna().unique().tolist()}"
    )

    report_lines.append("")

    report_lines.append(
        "FRP STATISTICS:"
    )

    report_lines.append(
        f"  Minimum: {df['frp'].min():.3f}"
    )
    report_lines.append(
        f"  Median: {df['frp'].median():.3f}"
    )
    report_lines.append(
        f"  Mean: {df['frp'].mean():.3f}"
    )
    report_lines.append(
        f"  95th percentile: "
        f"{df['frp'].quantile(0.95):.3f}"
    )
    report_lines.append(
        f"  Maximum: {df['frp'].max():.3f}"
    )

    report_lines.append("")

    return "\n".join(report_lines)


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    print_section("PYROCLASS FIRMS DATA CLEANING")

    # --------------------------------------------------------
    # 1. Check input files
    # --------------------------------------------------------

    print_section("1. CHECKING INPUT FILES")

    for file_path in INPUT_FILES:

        if not file_path.exists():
            raise FileNotFoundError(
                f"File not found:\n{file_path}"
            )

        print(f"Found: {file_path.name}")

    # --------------------------------------------------------
    # 2. Load files
    # --------------------------------------------------------

    print_section("2. LOADING DATA")

    dataframes = []

    for file_path in INPUT_FILES:

        print(f"Reading {file_path.name}...")

        df_year = pd.read_csv(
            file_path,
            low_memory=False
        )

        print(
            f"  Rows: {len(df_year):,}"
        )

        print(
            f"  Columns: {len(df_year.columns)}"
        )

        validate_columns(
            df_year,
            file_path.name
        )

        dataframes.append(df_year)

    # --------------------------------------------------------
    # 3. Combine
    # --------------------------------------------------------

    print_section("3. COMBINING DATASETS")

    combined = pd.concat(
        dataframes,
        ignore_index=True
    )

    raw_count = len(combined)

    print(
        f"Total combined rows: {raw_count:,}"
    )

    # --------------------------------------------------------
    # 4. Check exact duplicate rows
    # --------------------------------------------------------

    print_section("4. CHECKING DUPLICATES")

    duplicate_mask = combined.duplicated(
        keep="first"
    )

    duplicate_count = int(
        duplicate_mask.sum()
    )

    print(
        f"Exact duplicate rows found: "
        f"{duplicate_count:,}"
    )

    # Remove exact duplicates.
    # These are true duplicates of the entire row,
    # so removing them is safe.
    if duplicate_count > 0:
        combined = combined[
            ~duplicate_mask
        ].copy()

    # --------------------------------------------------------
    # 5. Numeric conversions
    # --------------------------------------------------------

    print_section("5. CLEANING NUMERIC COLUMNS")

    combined = clean_numeric_columns(
        combined
    )

    # --------------------------------------------------------
    # 6. Text normalization
    # --------------------------------------------------------

    print_section("6. NORMALIZING TEXT COLUMNS")

    combined = clean_text_columns(
        combined
    )

    # --------------------------------------------------------
    # 7. Timestamp
    # --------------------------------------------------------

    print_section("7. CREATING TIMESTAMP")

    combined = create_timestamp(
        combined
    )

    invalid_timestamps = int(
        combined["timestamp"].isna().sum()
    )

    print(
        f"Invalid timestamps: "
        f"{invalid_timestamps:,}"
    )

    # --------------------------------------------------------
    # 8. Temporal features
    # --------------------------------------------------------

    print_section("8. ADDING TEMPORAL FEATURES")

    combined = add_temporal_features(
        combined
    )

    # --------------------------------------------------------
    # 9. Type labels
    # --------------------------------------------------------

    print_section("9. ADDING NASA TYPE LABELS")

    combined = add_type_labels(
        combined
    )

    print(
        combined["type_label"]
        .value_counts(dropna=False)
    )

    # --------------------------------------------------------
    # 10. Confidence encoding
    # --------------------------------------------------------

    print_section("10. ENCODING CONFIDENCE")

    combined = add_confidence_score(
        combined
    )

    print(
        "Confidence values:"
    )

    print(
        combined["confidence"]
        .value_counts(dropna=False)
    )

    # --------------------------------------------------------
    # 11. Quality flags
    # --------------------------------------------------------

    print_section("11. ADDING QUALITY FLAGS")

    combined = add_quality_flags(
        combined
    )

    for column in [
        "invalid_coordinates",
        "invalid_timestamp",
        "frp_zero",
        "frp_extreme",
        "missing_thermal_data",
    ]:
        print(
            f"{column}: "
            f"{int(combined[column].sum()):,}"
        )

    # --------------------------------------------------------
    # 12. Remove only structurally invalid rows
    # --------------------------------------------------------

    print_section("12. REMOVING STRUCTURALLY INVALID ROWS")

    combined = remove_only_invalid_rows(
        combined
    )

    # --------------------------------------------------------
    # 13. Create IDs
    # --------------------------------------------------------

    print_section("13. CREATING HOTSPOT IDS")

    combined = create_hotspot_id(
        combined
    )

    # --------------------------------------------------------
    # 14. Organize columns
    # --------------------------------------------------------

    print_section("14. ORGANIZING COLUMNS")

    preferred_order = [
        "hotspot_id",

        "latitude",
        "longitude",

        "timestamp",
        "acq_date",
        "acq_time",

        "year",
        "month",
        "day",
        "day_of_year",
        "hour",

        "frp",
        "bright_ti4",
        "bright_ti5",

        "confidence",
        "confidence_score",

        "daynight",

        "type",
        "type_label",

        "scan",
        "track",

        "satellite",
        "instrument",
        "version",

        # Quality flags
        "frp_zero",
        "frp_extreme",
        "missing_thermal_data",
        "invalid_coordinates",
        "invalid_timestamp",
    ]

    # Only keep columns that actually exist
    preferred_order = [
        column
        for column in preferred_order
        if column in combined.columns
    ]

    # Append any unexpected columns at the end
    remaining_columns = [
        column
        for column in combined.columns
        if column not in preferred_order
    ]

    combined = combined[
        preferred_order + remaining_columns
    ]

    # --------------------------------------------------------
    # 15. Sort chronologically
    # --------------------------------------------------------

    print_section("15. SORTING DATA")

    combined = combined.sort_values(
        by=[
            "timestamp",
            "latitude",
            "longitude",
        ],
        kind="stable"
    ).reset_index(drop=True)

    # Rebuild IDs after sorting
    combined["hotspot_id"] = [
        f"HS_{i:07d}"
        for i in range(1, len(combined) + 1)
    ]

    # --------------------------------------------------------
    # 16. Save clean master dataset
    # --------------------------------------------------------

    print_section("16. SAVING CLEAN MASTER DATASET")

    combined.to_csv(
        MASTER_OUTPUT,
        index=False
    )

    print(
        f"Saved:\n{MASTER_OUTPUT}"
    )

    # --------------------------------------------------------
    # 17. Create type=2 candidate subset
    # --------------------------------------------------------

    print_section(
        "17. CREATING TYPE-2 CANDIDATE DATASET"
    )

    type2 = combined[
        combined["type"] == 2
    ].copy()

    type2.to_csv(
        TYPE2_OUTPUT,
        index=False
    )

    print(
        f"Type-2 candidate rows: "
        f"{len(type2):,}"
    )

    print(
        f"Saved:\n{TYPE2_OUTPUT}"
    )

    # --------------------------------------------------------
    # 18. Generate quality report
    # --------------------------------------------------------

    print_section(
        "18. GENERATING QUALITY REPORT"
    )

    report = generate_quality_report(
        raw_count=raw_count,
        cleaned_count=len(combined),
        df=combined,
        duplicate_count=duplicate_count,
    )

    QUALITY_OUTPUT.write_text(
        report,
        encoding="utf-8"
    )

    print(
        f"Saved:\n{QUALITY_OUTPUT}"
    )

    # --------------------------------------------------------
    # 19. Final summary
    # --------------------------------------------------------

    print_section("FINAL SUMMARY")

    print(
        f"Raw rows:             {raw_count:,}"
    )

    print(
        f"Clean rows:           {len(combined):,}"
    )

    print(
        f"Type-2 candidates:    {len(type2):,}"
    )

    print(
        f"Unique H3 cells:      NOT CALCULATED YET"
    )

    print(
        f"OSM enrichment:       NOT CALCULATED YET"
    )

    print(
        f"ML features:          NOT CALCULATED YET"
    )

    print("\nCleaning completed successfully.")


if __name__ == "__main__":
    main()