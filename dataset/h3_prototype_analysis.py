from pathlib import Path
import json

import pandas as pd
import h3
import geopandas as gpd
from shapely.geometry import Polygon


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

# Input files
FIRMS_TYPE2_FILE = PROCESSED_DIR / "firms_type2_candidates.csv"
PROTOTYPE_CASES_FILE = PROCESSED_DIR / "pyroclass_20_prototype_candidates.csv"

# Output files
SITE_H3_OUTPUT = PROCESSED_DIR / "pyroclass_20_sites_h3.csv"
H3_CELLS_OUTPUT = PROCESSED_DIR / "pyroclass_prototype_h3_cells.csv"
SITE_SUMMARY_OUTPUT = PROCESSED_DIR / "pyroclass_site_h3_summary.csv"
GEOJSON_OUTPUT = PROCESSED_DIR / "pyroclass_prototype_h3_cells.geojson"
POINTS_GEOJSON_OUTPUT = PROCESSED_DIR / "pyroclass_prototype_sites.geojson"

# ------------------------------------------------------------
# H3 SETTINGS
# ------------------------------------------------------------

# Start with resolution 7.
#
# Lower resolution  -> larger cells
# Higher resolution -> smaller cells
#
# We can compare resolution 7 vs 8 later.
H3_RESOLUTION = 7

# Number of neighbouring rings around each site's centre.
#
# k_ring = 0 -> only the centre cell
# k_ring = 1 -> centre + immediate neighbours
# k_ring = 2 -> larger surrounding area
#
# For the prototype, use 1 initially.
K_RING = 1


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def h3_boundary_to_polygon(h3_cell: str) -> Polygon:
    """
    Convert an H3 cell into a Shapely polygon.

    h3.cell_to_boundary() returns (lat, lon) pairs.
    Shapely expects (lon, lat).
    """

    boundary = h3.cell_to_boundary(h3_cell)

    coordinates = [
        (lon, lat)
        for lat, lon in boundary
    ]

    # Close polygon
    coordinates.append(coordinates[0])

    return Polygon(coordinates)


def assign_h3(lat: float, lon: float, resolution: int) -> str:
    """Convert latitude/longitude to an H3 cell."""

    return h3.latlng_to_cell(
        lat,
        lon,
        resolution
    )


def get_h3_disk(center_cell: str, k: int) -> set[str]:
    """
    Return the H3 neighbourhood around a centre cell.

    H3 v4 uses grid_disk().
    """

    return set(
        h3.grid_disk(
            center_cell,
            k
        )
    )


def print_separator(title: str):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


# ============================================================
# 1. CHECK FILES
# ============================================================

print_separator("1. CHECKING INPUT FILES")

if not FIRMS_TYPE2_FILE.exists():
    raise FileNotFoundError(
        f"Could not find:\n{FIRMS_TYPE2_FILE}"
    )

if not PROTOTYPE_CASES_FILE.exists():
    raise FileNotFoundError(
        f"Could not find:\n{PROTOTYPE_CASES_FILE}"
    )

print(f"Found FIRMS type-2 data:")
print(FIRMS_TYPE2_FILE)

print(f"\nFound prototype cases:")
print(PROTOTYPE_CASES_FILE)


# ============================================================
# 2. LOAD PROTOTYPE CASES
# ============================================================

print_separator("2. LOADING 20 PROTOTYPE CASES")

sites = pd.read_csv(
    PROTOTYPE_CASES_FILE
)

required_site_columns = [
    "case_id",
    "case_type",
    "latitude",
    "longitude"
]

missing = [
    col
    for col in required_site_columns
    if col not in sites.columns
]

if missing:
    raise ValueError(
        f"Prototype CSV is missing columns: {missing}"
    )

print(
    f"Prototype cases loaded: {len(sites)}"
)

if len(sites) != 20:
    print(
        f"WARNING: Expected 20 cases, "
        f"but found {len(sites)}."
    )


# ============================================================
# 3. VALIDATE COORDINATES
# ============================================================

print_separator("3. VALIDATING PROTOTYPE COORDINATES")

sites["latitude"] = pd.to_numeric(
    sites["latitude"],
    errors="coerce"
)

sites["longitude"] = pd.to_numeric(
    sites["longitude"],
    errors="coerce"
)

invalid_sites = sites[
    sites["latitude"].isna()
    | sites["longitude"].isna()
    | ~sites["latitude"].between(-90, 90)
    | ~sites["longitude"].between(-180, 180)
]

if len(invalid_sites) > 0:

    print("Invalid prototype coordinates found:")
    print(
        invalid_sites[
            ["case_id", "latitude", "longitude"]
        ]
    )

    raise ValueError(
        "Fix invalid prototype coordinates."
    )

print("All prototype coordinates are valid.")


# ============================================================
# 4. ASSIGN H3 CELL TO EACH PROTOTYPE SITE
# ============================================================

print_separator("4. ASSIGNING H3 CELLS")

sites["h3_cell"] = sites.apply(
    lambda row: assign_h3(
        row["latitude"],
        row["longitude"],
        H3_RESOLUTION
    ),
    axis=1
)

print(
    sites[
        [
            "case_id",
            "case_type",
            "latitude",
            "longitude",
            "h3_cell"
        ]
    ].to_string(index=False)
)


# ============================================================
# 5. CREATE H3 NEIGHBOURHOODS
# ============================================================

print_separator("5. CREATING H3 NEIGHBOURHOODS")

site_cell_records = []

for _, site in sites.iterrows():

    center_cell = site["h3_cell"]

    cells = get_h3_disk(
        center_cell,
        K_RING
    )

    for cell in cells:

        if cell == center_cell:
            relation = "center"
            ring = 0
        else:
            relation = "neighbor"
            ring = 1

        site_cell_records.append(
            {
                "case_id": site["case_id"],
                "case_type": site["case_type"],
                "center_h3_cell": center_cell,
                "h3_cell": cell,
                "relation": relation,
                "ring": ring,
            }
        )

h3_cells = pd.DataFrame(
    site_cell_records
)

print(
    f"Number of site/H3 relationships: "
    f"{len(h3_cells)}"
)

print(
    f"Unique H3 cells across all prototypes: "
    f"{h3_cells['h3_cell'].nunique()}"
)


# ============================================================
# 6. LOAD TYPE-2 FIRMS DATA
# ============================================================

print_separator("6. LOADING TYPE-2 FIRMS DATA")

firms = pd.read_csv(
    FIRMS_TYPE2_FILE,
    low_memory=False
)

print(
    f"FIRMS type-2 rows loaded: "
    f"{len(firms):,}"
)


# ============================================================
# 7. VALIDATE FIRMS COORDINATES
# ============================================================

print_separator("7. VALIDATING FIRMS COORDINATES")

firms["latitude"] = pd.to_numeric(
    firms["latitude"],
    errors="coerce"
)

firms["longitude"] = pd.to_numeric(
    firms["longitude"],
    errors="coerce"
)

firms = firms[
    firms["latitude"].between(-90, 90)
    & firms["longitude"].between(-180, 180)
].copy()

print(
    f"Valid FIRMS rows remaining: "
    f"{len(firms):,}"
)


# ============================================================
# 8. ENSURE TIMESTAMP / TEMPORAL FIELDS EXIST
# ============================================================

print_separator("8. PREPARING TEMPORAL DATA")

if "timestamp" in firms.columns:

    firms["timestamp"] = pd.to_datetime(
        firms["timestamp"],
        errors="coerce"
    )

else:

    if "acq_date" not in firms.columns:
        raise ValueError(
            "FIRMS data needs timestamp or acq_date."
        )

    firms["acq_date"] = pd.to_datetime(
        firms["acq_date"],
        errors="coerce"
    )

    firms["timestamp"] = firms["acq_date"]

# Add temporal fields
firms["year"] = firms["timestamp"].dt.year
firms["month"] = firms["timestamp"].dt.month


# ============================================================
# 9. ASSIGN H3 CELL TO ALL FIRMS TYPE-2 DETECTIONS
# ============================================================

print_separator(
    "9. ASSIGNING H3 CELLS TO FIRMS OBSERVATIONS"
)

print(
    "This may take some time for ~214K rows..."
)

firms["h3_cell"] = [
    assign_h3(
        lat,
        lon,
        H3_RESOLUTION
    )
    for lat, lon in zip(
        firms["latitude"],
        firms["longitude"]
    )
]

print("H3 assignment completed.")

print(
    f"Unique H3 cells in type-2 data: "
    f"{firms['h3_cell'].nunique():,}"
)


# ============================================================
# 10. FIND HISTORICAL OBSERVATIONS INSIDE PROTOTYPE CELLS
# ============================================================

print_separator(
    "10. MATCHING HISTORICAL FIRMS DATA TO PROTOTYPE H3 GROUPS"
)

# Map every H3 cell to one or more prototype cases.
#
# Multiple cases can theoretically share a cell.

cell_to_cases = {}

for _, row in h3_cells.iterrows():

    cell_to_cases.setdefault(
        row["h3_cell"],
        []
    ).append(
        row["case_id"]
    )

# Only keep FIRMS observations whose H3 cell belongs
# to one of the prototype site neighbourhoods.

prototype_h3_set = set(
    h3_cells["h3_cell"]
)

matched_firms = firms[
    firms["h3_cell"].isin(
        prototype_h3_set
    )
].copy()

print(
    f"Matched FIRMS observations: "
    f"{len(matched_firms):,}"
)


# ============================================================
# 11. ATTACH CASE IDS
# ============================================================

print_separator(
    "11. ATTACHING PROTOTYPE CASE IDS"
)

case_map_rows = []

for _, row in h3_cells.iterrows():

    case_map_rows.append(
        {
            "case_id": row["case_id"],
            "h3_cell": row["h3_cell"],
            "relation": row["relation"],
            "ring": row["ring"],
        }
    )

case_map = pd.DataFrame(
    case_map_rows
)

matched_firms = matched_firms.merge(
    case_map,
    on="h3_cell",
    how="inner"
)

print(
    f"Matched case-observation rows: "
    f"{len(matched_firms):,}"
)


# ============================================================
# 12. CALCULATE SITE-LEVEL HISTORICAL STATISTICS
# ============================================================

print_separator(
    "12. CALCULATING THERMAL STATISTICS"
)

# Make sure FRP is numeric
matched_firms["frp"] = pd.to_numeric(
    matched_firms["frp"],
    errors="coerce"
)

site_summary = (
    matched_firms
    .groupby(
        ["case_id", "h3_cell", "relation", "ring"],
        as_index=False
    )
    .agg(
        total_detections=(
            "h3_cell",
            "size"
        ),

        active_days=(
            "acq_date",
            "nunique"
        ),

        active_months=(
            "month",
            "nunique"
        ),

        avg_frp=(
            "frp",
            "mean"
        ),

        median_frp=(
            "frp",
            "median"
        ),

        max_frp=(
            "frp",
            "max"
        ),

        p95_frp=(
            "frp",
            lambda x: x.quantile(0.95)
        ),
    )
)

# ============================================================
# 13. YEAR-WISE COUNTS
# ============================================================

year_counts = (
    matched_firms
    .pivot_table(
        index=[
            "case_id",
            "h3_cell",
            "relation",
            "ring"
        ],
        columns="year",
        values="frp",
        aggfunc="size",
        fill_value=0
    )
    .reset_index()
)

# Rename year columns
year_columns = []

for column in year_counts.columns:

    if isinstance(column, int):

        new_name = f"detections_{column}"

        year_counts = year_counts.rename(
            columns={
                column: new_name
            }
        )

        year_columns.append(
            new_name
        )

# Merge
site_summary = site_summary.merge(
    year_counts,
    on=[
        "case_id",
        "h3_cell",
        "relation",
        "ring"
    ],
    how="left"
)


# ============================================================
# 14. ADD PROTOTYPE METADATA
# ============================================================

site_summary = site_summary.merge(
    sites[
        [
            "case_id",
            "case_type",
            "latitude",
            "longitude"
        ]
    ],
    on="case_id",
    how="left"
)


# ============================================================
# 15. CALCULATE SIMPLE NORMALIZED METRICS
# ============================================================

print_separator(
    "13. CALCULATING NORMALIZED METRICS"
)

site_summary["detections_per_active_day"] = (
    site_summary["total_detections"]
    /
    site_summary["active_days"].replace(
        0,
        pd.NA
    )
)

site_summary["frp_range"] = (
    site_summary["max_frp"]
    -
    site_summary["median_frp"]
)


# ============================================================
# 16. SAVE SITE SUMMARY
# ============================================================

site_summary = site_summary.sort_values(
    by=[
        "case_id",
        "relation"
    ]
)

site_summary.to_csv(
    SITE_SUMMARY_OUTPUT,
    index=False
)

print(
    f"Saved site summary:\n"
    f"{SITE_SUMMARY_OUTPUT}"
)


# ============================================================
# 17. SAVE SITE H3 CENTRES
# ============================================================

sites.to_csv(
    SITE_H3_OUTPUT,
    index=False
)

print(
    f"Saved site H3 assignments:\n"
    f"{SITE_H3_OUTPUT}"
)


# ============================================================
# 18. CREATE H3 GEOJSON FOR MAP VISUALIZATION
# ============================================================

print_separator(
    "14. CREATING H3 GEOJSON"
)

# Remove duplicate case/cell combinations first
geo_rows = []

for _, row in h3_cells.drop_duplicates(
    subset=[
        "case_id",
        "h3_cell"
    ]
).iterrows():

    polygon = h3_boundary_to_polygon(
        row["h3_cell"]
    )

    geo_rows.append(
        {
            "case_id": row["case_id"],
            "case_type": row["case_type"],
            "center_h3_cell": row[
                "center_h3_cell"
            ],
            "h3_cell": row["h3_cell"],
            "relation": row["relation"],
            "ring": row["ring"],
            "geometry": polygon
        }
    )

h3_geo = gpd.GeoDataFrame(
    geo_rows,
    geometry="geometry",
    crs="EPSG:4326"
)

h3_geo.to_file(
    GEOJSON_OUTPUT,
    driver="GeoJSON"
)

print(
    f"Saved H3 GeoJSON:\n"
    f"{GEOJSON_OUTPUT}"
)


# ============================================================
# 19. CREATE PROTOTYPE POINT GEOJSON
# ============================================================

print_separator(
    "15. CREATING PROTOTYPE POINT GEOJSON"
)

point_geometry = gpd.points_from_xy(
    sites["longitude"],
    sites["latitude"]
)

sites_geo = gpd.GeoDataFrame(
    sites.copy(),
    geometry=point_geometry,
    crs="EPSG:4326"
)

sites_geo.to_file(
    POINTS_GEOJSON_OUTPUT,
    driver="GeoJSON"
)

print(
    f"Saved prototype point GeoJSON:\n"
    f"{POINTS_GEOJSON_OUTPUT}"
)


# ============================================================
# 20. PRINT FINAL RESULTS
# ============================================================

print_separator(
    "16. FINAL PROTOTYPE RESULTS"
)

print(
    f"Prototype sites: "
    f"{len(sites):,}"
)

print(
    f"H3 resolution: "
    f"{H3_RESOLUTION}"
)

print(
    f"H3 neighbourhood ring: "
    f"{K_RING}"
)

print(
    f"Unique prototype H3 cells: "
    f"{h3_cells['h3_cell'].nunique():,}"
)

print(
    f"Matched historical FIRMS observations: "
    f"{len(matched_firms):,}"
)

print("\nTop prototype site statistics:")

display_columns = [
    "case_id",
    "case_type",
    "total_detections",
    "active_days",
    "avg_frp",
    "median_frp",
    "max_frp",
]

print(
    site_summary[
        [
            col
            for col in display_columns
            if col in site_summary.columns
        ]
    ]
    .drop_duplicates(
        subset=["case_id"]
    )
    .to_string(index=False)
)


print("\nCompleted successfully.")