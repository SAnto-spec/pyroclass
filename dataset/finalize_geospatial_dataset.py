from pathlib import Path
import pandas as pd
import geopandas as gpd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]
PROCESSED_DIR = BASE_DIR / "data" / "processed"

# Main source produced by the latest OSM validation
VALIDATED_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_sites_validated.csv"
)

# H3 assignment produced earlier
H3_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_sites_h3.csv"
)

# Final outputs
FINAL_CSV = (
    PROCESSED_DIR /
    "pyroclass_20_sites_geospatial_final.csv"
)

FINAL_GEOJSON = (
    PROCESSED_DIR /
    "pyroclass_20_sites_geospatial_final.geojson"
)

FINAL_REPORT = (
    PROCESSED_DIR /
    "pyroclass_20_sites_geospatial_final_report.txt"
)


# ============================================================
# FINAL COLUMN ORDER
# ============================================================

FINAL_COLUMNS = [
    # --------------------------------------------------------
    # Prototype identity
    # --------------------------------------------------------
    "case_id",
    "case_type",

    # --------------------------------------------------------
    # Location
    # --------------------------------------------------------
    "latitude",
    "longitude",
    "h3_cell",

    # --------------------------------------------------------
    # Historical thermal behaviour
    # --------------------------------------------------------
    "n",
    "active_days",
    "mean_frp",
    "median_frp",
    "max_frp",

    "2022",
    "2023",
    "2024",

    "base_monthly",
    "cur_monthly",
    "count_ratio",
    "p95_ratio",
    "spike_score",

    # --------------------------------------------------------
    # OSM / geographic context
    # --------------------------------------------------------
    "context_type",
    "context_confidence",

    "facility_name",
    "facility_type",
    "facility_distance_m",

    "industrial_context_score",
    "mining_context_score",

    "industrial_polygon_overlap_osm",
    "mining_polygon_overlap",
    "forest_polygon_overlap",
    "agriculture_polygon_overlap",

    "industrial_features_found",
    "mining_features_found",
    "forest_features_found",
    "agriculture_features_found",

    "nearest_industrial_name",
    "nearest_industrial_type",
    "nearest_industrial_distance_m",

    "nearest_mining_name",
    "nearest_mining_distance_m",

    "vegetation_context",
    "agriculture_context",

    "context_evidence_osm",

    "osm_elements",
    "osm_source_osm",
]


# ============================================================
# HELPERS
# ============================================================

def clean_string_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize string columns while preserving missing values."""

    string_columns = [
        "case_id",
        "case_type",
        "context_type",
        "facility_name",
        "facility_type",
        "nearest_industrial_name",
        "nearest_industrial_type",
        "nearest_mining_name",
        "vegetation_context",
        "agriculture_context",
        "context_evidence_osm",
        "osm_source_osm",
    ]

    for column in string_columns:
        if column in df.columns:
            df[column] = (
                df[column]
                .astype("string")
                .str.strip()
            )

    return df


def convert_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Convert numeric fields to numeric data types."""

    numeric_columns = [
        "latitude",
        "longitude",
        "n",
        "active_days",
        "mean_frp",
        "median_frp",
        "max_frp",

        "2022",
        "2023",
        "2024",

        "base_monthly",
        "cur_monthly",
        "count_ratio",
        "p95_ratio",
        "spike_score",

        "context_confidence",
        "facility_distance_m",

        "industrial_context_score",
        "mining_context_score",

        "industrial_features_found",
        "mining_features_found",
        "forest_features_found",
        "agriculture_features_found",

        "nearest_industrial_distance_m",
        "nearest_mining_distance_m",

        "osm_elements",
    ]

    for column in numeric_columns:
        if column in df.columns:
            df[column] = pd.to_numeric(
                df[column],
                errors="coerce"
            )

    return df


def normalize_boolean_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize boolean fields."""

    boolean_columns = [
        "industrial_polygon_overlap_osm",
        "mining_polygon_overlap",
        "forest_polygon_overlap",
        "agriculture_polygon_overlap",
    ]

    for column in boolean_columns:

        if column not in df.columns:
            continue

        # Handle actual booleans
        if df[column].dtype == bool:
            continue

        # Convert TRUE/FALSE strings safely
        df[column] = (
            df[column]
            .astype("string")
            .str.upper()
            .map(
                {
                    "TRUE": True,
                    "FALSE": False,
                }
            )
        )

    return df


# ============================================================
# LOAD DATA
# ============================================================

def load_data():
    print("=" * 80)
    print("PYROCLASS FINAL GEOSPATIAL DATASET BUILDER")
    print("=" * 80)

    if not VALIDATED_FILE.exists():
        raise FileNotFoundError(
            f"Validated OSM file not found:\n{VALIDATED_FILE}"
        )

    if not H3_FILE.exists():
        raise FileNotFoundError(
            f"H3 file not found:\n{H3_FILE}"
        )

    print("\nLoading validated OSM data...")
    validated = pd.read_csv(
        VALIDATED_FILE,
        low_memory=False
    )

    print(
        f"Validated rows: {len(validated)}"
    )
    print(
        f"Validated columns: {len(validated.columns)}"
    )

    print("\nLoading H3 data...")
    h3 = pd.read_csv(
        H3_FILE,
        low_memory=False
    )

    print(
        f"H3 rows: {len(h3)}"
    )

    return validated, h3


# ============================================================
# MERGE H3
# ============================================================

def attach_h3(
    validated: pd.DataFrame,
    h3: pd.DataFrame
) -> pd.DataFrame:

    required_h3 = [
        "case_id",
        "h3_cell",
    ]

    missing = [
        column
        for column in required_h3
        if column not in h3.columns
    ]

    if missing:
        raise ValueError(
            f"H3 file is missing columns: {missing}"
        )

    # Keep only one H3 assignment per case.
    # Duplicate case IDs are not expected, but this prevents
    # accidental row multiplication.
    h3_lookup = (
        h3[
            [
                "case_id",
                "h3_cell",
            ]
        ]
        .drop_duplicates(
            subset=["case_id"]
        )
    )

    # Remove old h3_cell if somehow present
    if "h3_cell" in validated.columns:
        validated = validated.drop(
            columns=["h3_cell"]
        )

    merged = validated.merge(
        h3_lookup,
        on="case_id",
        how="left",
        validate="one_to_one"
    )

    missing_h3 = merged["h3_cell"].isna().sum()

    if missing_h3:
        print(
            f"WARNING: {missing_h3} cases "
            f"have no H3 cell."
        )

    return merged


# ============================================================
# SELECT FINAL OSM FIELDS
# ============================================================

def prepare_final_dataset(
    df: pd.DataFrame
) -> pd.DataFrame:

    # --------------------------------------------------------
    # We explicitly choose the NEW OSM validation fields.
    #
    # The older fields such as:
    #   industrial_context_score
    #   industrial_context_level
    #   context_evidence
    #
    # are intentionally not used as the final source.
    # --------------------------------------------------------

    # Make sure every final column exists.
    for column in FINAL_COLUMNS:
        if column not in df.columns:
            df[column] = pd.NA

    final = df[
        FINAL_COLUMNS
    ].copy()

    final = clean_string_columns(
        final
    )

    final = convert_numeric_columns(
        final
    )

    final = normalize_boolean_columns(
        final
    )

    # --------------------------------------------------------
    # Ensure one row per prototype case
    # --------------------------------------------------------

    duplicate_cases = (
        final["case_id"]
        .duplicated(keep=False)
    )

    if duplicate_cases.any():

        print(
            "WARNING: Duplicate case IDs found:"
        )

        print(
            final.loc[
                duplicate_cases,
                "case_id"
            ].tolist()
        )

        # Keep first only.
        final = final.drop_duplicates(
            subset=["case_id"],
            keep="first"
        )

    # --------------------------------------------------------
    # Sort by case number
    # --------------------------------------------------------

    final = final.sort_values(
        by="case_id"
    ).reset_index(
        drop=True
    )

    return final


# ============================================================
# DERIVED QUALITY FIELDS
# ============================================================

def add_final_quality_fields(
    df: pd.DataFrame
) -> pd.DataFrame:

    # --------------------------------------------------------
    # Flag whether OSM gave any geographic evidence
    # --------------------------------------------------------

    df["has_osm_context"] = (
        (
            df["context_type"]
            .notna()
        )
        &
        (
            df["context_type"]
            != "unknown"
        )
        &
        (
            df["context_type"]
            != "osm_error"
        )
    )

    # --------------------------------------------------------
    # Flag whether a specific facility was identified
    # --------------------------------------------------------

    df["specific_facility_identified"] = (
        df["facility_name"]
        .notna()
        &
        (
            df["facility_name"]
            .str.strip()
            .ne("")
        )
    )

    # --------------------------------------------------------
    # Thermal history available?
    # --------------------------------------------------------

    df["historical_data_available"] = (
        pd.to_numeric(
            df["n"],
            errors="coerce"
        )
        > 0
    )

    # --------------------------------------------------------
    # Useful prototype interpretation
    #
    # This does NOT override context_type.
    # It is only a high-level review flag.
    # --------------------------------------------------------

    def review_flag(row):

        context = row["context_type"]

        if context == "industrial":
            return "industrial_candidate"

        if context == "mining_quarry":
            return "mining_quarry_candidate"

        if context == "vegetation":
            return "vegetation_candidate"

        if context == "agriculture":
            return "agriculture_candidate"

        return "requires_geospatial_review"

    df["geospatial_review_status"] = (
        df.apply(
            review_flag,
            axis=1
        )
    )

    return df


# ============================================================
# SAVE CSV
# ============================================================

def save_csv(df: pd.DataFrame):

    df.to_csv(
        FINAL_CSV,
        index=False
    )

    print(
        f"\nFinal CSV saved:\n{FINAL_CSV}"
    )


# ============================================================
# SAVE GEOJSON
# ============================================================

def save_geojson(df: pd.DataFrame):

    # Check coordinates
    valid = df[
        df["latitude"].notna()
        &
        df["longitude"].notna()
    ].copy()

    geometry = gpd.points_from_xy(
        valid["longitude"],
        valid["latitude"]
    )

    gdf = gpd.GeoDataFrame(
        valid,
        geometry=geometry,
        crs="EPSG:4326"
    )

    gdf.to_file(
        FINAL_GEOJSON,
        driver="GeoJSON"
    )

    print(
        f"Final GeoJSON saved:\n{FINAL_GEOJSON}"
    )


# ============================================================
# REPORT
# ============================================================

def create_report(df: pd.DataFrame):

    lines = []

    lines.append(
        "PYROCLASS FINAL GEOSPATIAL DATASET REPORT"
    )

    lines.append(
        "=" * 80
    )

    lines.append(
        f"Prototype cases: {len(df)}"
    )

    lines.append("")

    lines.append(
        "CONTEXT TYPE DISTRIBUTION"
    )

    lines.append(
        "-" * 40
    )

    context_counts = (
        df["context_type"]
        .value_counts(
            dropna=False
        )
    )

    for context, count in context_counts.items():

        lines.append(
            f"{context}: {count}"
        )

    lines.append("")

    lines.append(
        "FACILITY TYPE DISTRIBUTION"
    )

    lines.append(
        "-" * 40
    )

    facility_counts = (
        df["facility_type"]
        .value_counts(
            dropna=False
        )
    )

    for facility, count in facility_counts.items():

        lines.append(
            f"{facility}: {count}"
        )

    lines.append("")

    lines.append(
        "GEOSPATIAL REVIEW STATUS"
    )

    lines.append(
        "-" * 40
    )

    review_counts = (
        df["geospatial_review_status"]
        .value_counts(
            dropna=False
        )
    )

    for status, count in review_counts.items():

        lines.append(
            f"{status}: {count}"
        )

    lines.append("")

    lines.append(
        "SITE SUMMARY"
    )

    lines.append(
        "-" * 40
    )

    report_columns = [
        "case_id",
        "case_type",
        "h3_cell",
        "context_type",
        "context_confidence",
        "facility_name",
        "facility_type",
        "facility_distance_m",
        "industrial_context_score",
        "mining_context_score",
        "spike_score",
        "geospatial_review_status",
    ]

    report_columns = [
        column
        for column in report_columns
        if column in df.columns
    ]

    lines.append(
        df[
            report_columns
        ].to_string(
            index=False
        )
    )

    FINAL_REPORT.write_text(
        "\n".join(lines),
        encoding="utf-8"
    )

    print(
        f"Final report saved:\n{FINAL_REPORT}"
    )


# ============================================================
# VALIDATION
# ============================================================

def validate_final_dataset(
    df: pd.DataFrame
):

    print("\n" + "=" * 80)
    print("FINAL VALIDATION")
    print("=" * 80)

    # Number of rows
    print(
        f"Rows: {len(df)}"
    )

    if len(df) != 20:

        print(
            "WARNING: Expected 20 prototype cases."
        )

    # Duplicate cases
    duplicate_count = (
        df["case_id"]
        .duplicated()
        .sum()
    )

    print(
        f"Duplicate case IDs: "
        f"{duplicate_count}"
    )

    # Missing coordinates
    coordinate_missing = (
        df["latitude"].isna()
        |
        df["longitude"].isna()
    ).sum()

    print(
        f"Missing coordinates: "
        f"{coordinate_missing}"
    )

    # Missing H3
    missing_h3 = (
        df["h3_cell"]
        .isna()
        .sum()
    )

    print(
        f"Missing H3 cells: "
        f"{missing_h3}"
    )

    # OSM context
    print(
        "\nContext types:"
    )

    print(
        df["context_type"]
        .value_counts(
            dropna=False
        )
    )

    # Facility identification
    print(
        "\nSpecific facilities identified:"
    )

    print(
        int(
            df[
                "specific_facility_identified"
            ].sum()
        )
    )

    # H3 uniqueness
    print(
        "\nUnique H3 cells:"
    )

    print(
        df["h3_cell"]
        .nunique()
    )


# ============================================================
# MAIN
# ============================================================

def main():

    validated, h3 = load_data()

    print("\nAttaching H3 cells...")
    
    merged = attach_h3(
        validated,
        h3
    )

    print(
        f"Rows after H3 merge: "
        f"{len(merged)}"
    )

    print(
        "\nPreparing final dataset..."
    )

    final = prepare_final_dataset(
        merged
    )

    print(
        "\nAdding final review fields..."
    )

    final = add_final_quality_fields(
        final
    )

    validate_final_dataset(
        final
    )

    save_csv(
        final
    )

    save_geojson(
        final
    )

    create_report(
        final
    )

    print("\n" + "=" * 80)
    print("DONE")
    print("=" * 80)

    print(
        "\nYour final geospatial dataset is:"
    )

    print(
        FINAL_CSV
    )


if __name__ == "__main__":
    main()