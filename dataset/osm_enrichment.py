from pathlib import Path
import json
import time
import math
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import requests
import geopandas as gpd

from shapely.geometry import (
    Point,
    Polygon,
    MultiPolygon,
    LineString,
)
from shapely.ops import transform
from pyproj import Transformer
from tqdm import tqdm


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

INPUT_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_prototype_candidates.csv"
)

OUTPUT_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_sites_osm_enriched.csv"
)

GEOJSON_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_sites_osm_enriched.geojson"
)

CACHE_DIR = (
    PROCESSED_DIR /
    "osm_cache"
)

REPORT_FILE = (
    PROCESSED_DIR /
    "osm_enrichment_report.txt"
)


# ------------------------------------------------------------
# SEARCH SETTINGS
# ------------------------------------------------------------

# Search radius around each prototype coordinate.
SEARCH_RADIUS_METERS = 1500

# Overpass endpoint.
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Delay between requests.
# Keep this reasonably conservative.
REQUEST_DELAY_SECONDS = 2.0

# Number of retry attempts if Overpass fails.
MAX_RETRIES = 4

# HTTP timeout for an individual request.
REQUEST_TIMEOUT_SECONDS = 120


# ------------------------------------------------------------
# DATA SOURCES
# ------------------------------------------------------------

OSM_SOURCE_NAME = "OpenStreetMap via Overpass API"


# ------------------------------------------------------------
# FACILITY TYPE MAPPING
# ------------------------------------------------------------

def classify_facility(tags: Dict[str, Any]) -> str:
    """
    Convert raw OSM tags into a simplified facility category.

    This is deliberately conservative. If we cannot identify
    the facility, return 'industrial_unknown'.
    """

    # Normalize values
    industrial = str(
        tags.get("industrial", "")
    ).lower()

    works = str(
        tags.get("works", "")
    ).lower()

    power = str(
        tags.get("power", "")
    ).lower()

    landuse = str(
        tags.get("landuse", "")
    ).lower()

    man_made = str(
        tags.get("man_made", "")
    ).lower()

    name = str(
        tags.get("name", "")
    ).lower()

    # --------------------------------------------------------
    # Power
    # --------------------------------------------------------

    if power == "plant":
        return "power_plant"

    # --------------------------------------------------------
    # Refinery / petrochemical
    # --------------------------------------------------------

    refinery_keywords = [
        "oil_refinery",
        "refinery",
        "petrochemical",
        "petroleum",
    ]

    combined = " ".join(
        [
            industrial,
            works,
            name,
            str(tags.get("product", "")).lower(),
        ]
    )

    if any(
        keyword in combined
        for keyword in refinery_keywords
    ):
        return "oil_refinery"

    # --------------------------------------------------------
    # Steel / metal
    # --------------------------------------------------------

    steel_keywords = [
        "steel",
        "iron",
        "metal",
        "smelter",
        "foundry",
    ]

    if any(
        keyword in combined
        for keyword in steel_keywords
    ):
        return "steel_metal"

    # --------------------------------------------------------
    # Cement
    # --------------------------------------------------------

    if "cement" in combined:
        return "cement_plant"

    # --------------------------------------------------------
    # Chemical
    # --------------------------------------------------------

    chemical_keywords = [
        "chemical",
        "fertilizer",
        "pharmaceutical",
    ]

    if any(
        keyword in combined
        for keyword in chemical_keywords
    ):
        return "chemical_plant"

    # --------------------------------------------------------
    # Mining / quarry
    # --------------------------------------------------------

    if landuse == "quarry":
        return "quarry_mining"

    if (
        "mine" in combined
        or "mining" in combined
        or man_made == "mineshaft"
    ):
        return "mining"

    # --------------------------------------------------------
    # LNG / gas
    # --------------------------------------------------------

    gas_keywords = [
        "lng",
        "lpg",
        "natural_gas",
        "gas_terminal",
        "gas plant",
    ]

    if any(
        keyword in combined
        for keyword in gas_keywords
    ):
        return "gas_lng"

    # --------------------------------------------------------
    # Generic works / industrial
    # --------------------------------------------------------

    if man_made == "works":
        return "industrial_works"

    if industrial:
        return "industrial_facility"

    return "industrial_unknown"


# ============================================================
# GEOMETRY UTILITIES
# ============================================================

def haversine_distance_m(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate great-circle distance in metres.
    """

    earth_radius = 6_371_000

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    delta_phi = math.radians(
        lat2 - lat1
    )

    delta_lambda = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(delta_phi / 2) ** 2
        +
        math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

    return earth_radius * c


def element_center(
    element: Dict[str, Any]
) -> Optional[Tuple[float, float]]:
    """
    Get the center coordinate of an OSM element.

    Returns:
        (latitude, longitude)
    """

    if "lat" in element and "lon" in element:
        return (
            float(element["lat"]),
            float(element["lon"])
        )

    if "center" in element:
        center = element["center"]

        if (
            "lat" in center
            and "lon" in center
        ):
            return (
                float(center["lat"]),
                float(center["lon"])
            )

    return None


def element_geometry(
    element: Dict[str, Any]
):
    """
    Convert OSM geometry to a Shapely geometry.

    Currently handles:
        node
        way
    """

    element_type = element.get("type")

    # Node
    if element_type == "node":

        center = element_center(element)

        if center is None:
            return None

        lat, lon = center

        return Point(lon, lat)

    # Way
    if element_type == "way":

        geometry = element.get(
            "geometry"
        )

        if not geometry:
            center = element_center(element)

            if center is None:
                return None

            lat, lon = center

            return Point(lon, lat)

        coords = [
            (
                float(point["lon"]),
                float(point["lat"])
            )
            for point in geometry
            if "lat" in point
            and "lon" in point
        ]

        if len(coords) < 2:
            return None

        # Closed polygon
        if len(coords) >= 4 and coords[0] == coords[-1]:

            try:
                polygon = Polygon(coords)

                if polygon.is_valid:
                    return polygon

                fixed = polygon.buffer(0)

                if fixed.is_valid:
                    return fixed

            except Exception:
                pass

        # Otherwise treat as line
        return LineString(coords)

    return None


# ============================================================
# OVERPASS QUERY
# ============================================================

def build_overpass_query(
    lat: float,
    lon: float,
    radius: int
) -> str:
    """
    Build an Overpass query for industrial context.
    """

    query = f"""
    [out:json][timeout:90];

    (
      /* Industrial land-use polygons */
      way
        ["landuse"="industrial"]
        (around:{radius},{lat},{lon});

      /* Quarries / mining areas */
      way
        ["landuse"="quarry"]
        (around:{radius},{lat},{lon});

      /* Industrial works */
      way
        ["man_made"="works"]
        (around:{radius},{lat},{lon});

      node
        ["man_made"="works"]
        (around:{radius},{lat},{lon});

      /* Industrial-tagged features */
      way
        ["industrial"]
        (around:{radius},{lat},{lon});

      node
        ["industrial"]
        (around:{radius},{lat},{lon});

      /* Power plants */
      way
        ["power"="plant"]
        (around:{radius},{lat},{lon});

      node
        ["power"="plant"]
        (around:{radius},{lat},{lon});

      /* Mining shafts */
      node
        ["man_made"="mineshaft"]
        (around:{radius},{lat},{lon});
    );

    out geom tags center;
    """

    return query


# ============================================================
# OVERPASS REQUEST
# ============================================================

def query_overpass(
    lat: float,
    lon: float,
    radius: int
) -> Dict[str, Any]:

    query = build_overpass_query(
        lat,
        lon,
        radius
    )

    last_error = None

    for attempt in range(
        1,
        MAX_RETRIES + 1
    ):

        try:

            response = requests.post(
                OVERPASS_URL,
                data=query,
                timeout=REQUEST_TIMEOUT_SECONDS,
                headers={
                    "User-Agent":
                        "PyroClass-SIH2026/1.0"
                }
            )

            response.raise_for_status()

            return response.json()

        except Exception as exc:

            last_error = exc

            wait_time = (
                attempt * 5
            )

            print(
                f"Overpass attempt "
                f"{attempt}/{MAX_RETRIES} failed: "
                f"{exc}"
            )

            if attempt < MAX_RETRIES:

                print(
                    f"Waiting {wait_time}s..."
                )

                time.sleep(
                    wait_time
                )

    raise RuntimeError(
        "Overpass request failed after "
        f"{MAX_RETRIES} attempts: "
        f"{last_error}"
    )


# ============================================================
# CACHED OVERPASS DATA
# ============================================================

def cache_filename(case_id: str) -> Path:
    """Return the cache file path for one case."""

    safe_case = (
        str(case_id)
        .replace("/", "_")
        .replace("\\", "_")
        .replace(" ", "_")
    )

    return (
        CACHE_DIR /
        f"{safe_case}.json"
    )


def get_osm_data(
    case_id: str,
    lat: float,
    lon: float
) -> Dict[str, Any]:

    CACHE_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    cache_file = cache_filename(
        case_id
    )

    # --------------------------------------------------------
    # Use cached result when available
    # --------------------------------------------------------

    if cache_file.exists():

        print(
            f"Using cached OSM data for "
            f"{case_id}"
        )

        with open(
            cache_file,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    # --------------------------------------------------------
    # Query Overpass
    # --------------------------------------------------------

    print(
        f"Querying OSM for {case_id}..."
    )

    data = query_overpass(
        lat,
        lon,
        SEARCH_RADIUS_METERS
    )

    # Save response
    with open(
        cache_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            data,
            file,
            indent=2
        )

    time.sleep(
        REQUEST_DELAY_SECONDS
    )

    return data


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def extract_osm_features(
    case_id: str,
    case_lat: float,
    case_lon: float,
    osm_data: Dict[str, Any]
) -> Dict[str, Any]:

    elements = osm_data.get(
        "elements",
        []
    )

    hotspot_point = Point(
        case_lon,
        case_lat
    )

    facilities = []
    industrial_polygons = []

    for element in elements:

        tags = element.get(
            "tags",
            {}
        )

        geometry = element_geometry(
            element
        )

        center = element_center(
            element
        )

        if not tags:
            continue

        facility_type = classify_facility(
            tags
        )

        name = (
            tags.get("name")
            or tags.get("official_name")
            or tags.get("short_name")
            or "Unnamed facility"
        )

        element_id = (
            f"{element.get('type', 'unknown')}/"
            f"{element.get('id', 'unknown')}"
        )

        # ----------------------------------------------------
        # Industrial polygon
        # ----------------------------------------------------

        if (
            element.get("type") == "way"
            and tags.get("landuse") in [
                "industrial",
                "quarry"
            ]
        ):

            if geometry is not None:

                if isinstance(
                    geometry,
                    (Polygon, MultiPolygon)
                ):

                    industrial_polygons.append(
                        {
                            "element_id":
                                element_id,

                            "name":
                                name,

                            "facility_type":
                                facility_type,

                            "geometry":
                                geometry,

                            "tags":
                                tags,
                        }
                    )

        # ----------------------------------------------------
        # Facility / industrial point
        # ----------------------------------------------------

        is_facility = (
            tags.get("power") == "plant"
            or tags.get("man_made") == "works"
            or "industrial" in tags
            or tags.get("landuse") == "quarry"
            or tags.get("man_made") == "mineshaft"
        )

        if is_facility:

            if center is not None:

                facility_lat, facility_lon = center

                distance = haversine_distance_m(
                    case_lat,
                    case_lon,
                    facility_lat,
                    facility_lon
                )

                facilities.append(
                    {
                        "element_id":
                            element_id,

                        "name":
                            name,

                        "facility_type":
                            facility_type,

                        "latitude":
                            facility_lat,

                        "longitude":
                            facility_lon,

                        "distance_m":
                            distance,

                        "tags":
                            tags,
                    }
                )

    # --------------------------------------------------------
    # Check polygon overlap
    # --------------------------------------------------------

    polygon_overlap = False
    overlap_facilities = []

    for item in industrial_polygons:

        polygon = item["geometry"]

        try:

            if (
                polygon.contains(
                    hotspot_point
                )
                or
                polygon.touches(
                    hotspot_point
                )
            ):

                polygon_overlap = True

                overlap_facilities.append(
                    item
                )

        except Exception:
            continue

    # --------------------------------------------------------
    # Sort facilities by distance
    # --------------------------------------------------------

    facilities.sort(
        key=lambda x:
            x["distance_m"]
    )

    nearest = (
        facilities[0]
        if facilities
        else None
    )

    # --------------------------------------------------------
    # Build context score
    # --------------------------------------------------------

    score = 0.0
    evidence = []

    # Polygon overlap is strong evidence
    if polygon_overlap:

        score += 0.45

        evidence.append(
            "Hotspot lies within "
            "or touches an OSM industrial/quarry polygon"
        )

    # Facility proximity
    if nearest is not None:

        distance = nearest[
            "distance_m"
        ]

        if distance <= 375:

            score += 0.30

            evidence.append(
                "Industrial facility within "
                "approximately one VIIRS pixel"
            )

        elif distance <= 750:

            score += 0.20

            evidence.append(
                "Industrial facility within 750 m"
            )

        elif distance <= 1500:

            score += 0.10

            evidence.append(
                "Industrial facility within 1.5 km"
            )

    # Facility identification
    if nearest is not None:

        if nearest["facility_type"] != (
            "industrial_unknown"
        ):

            score += 0.15

            evidence.append(
                "Specific industrial facility "
                "type identified"
            )

    score = min(
        score,
        1.0
    )

    # --------------------------------------------------------
    # Determine context label
    # --------------------------------------------------------

    if score >= 0.75:
        context_level = "high"

    elif score >= 0.45:
        context_level = "medium"

    elif score >= 0.20:
        context_level = "low"

    else:
        context_level = "none"

    # --------------------------------------------------------
    # Return flattened record
    # --------------------------------------------------------

    result = {

        "case_id":
            case_id,

        "osm_elements_found":
            len(elements),

        "industrial_polygons_found":
            len(industrial_polygons),

        "industrial_polygon_overlap":
            polygon_overlap,

        "nearby_facilities_found":
            len(facilities),

        "nearest_facility":
            (
                nearest["name"]
                if nearest
                else None
            ),

        "nearest_facility_type":
            (
                nearest["facility_type"]
                if nearest
                else None
            ),

        "nearest_facility_latitude":
            (
                nearest["latitude"]
                if nearest
                else None
            ),

        "nearest_facility_longitude":
            (
                nearest["longitude"]
                if nearest
                else None
            ),

        "nearest_facility_distance_m":
            (
                round(
                    nearest["distance_m"],
                    2
                )
                if nearest
                else None
            ),

        "industrial_context_score":
            round(
                score,
                3
            ),

        "industrial_context_level":
            context_level,

        "context_evidence":
            " | ".join(
                evidence
            )
            if evidence
            else "No strong industrial evidence found",

        "osm_source":
            OSM_SOURCE_NAME,
    }

    return result


# ============================================================
# CREATE ENRICHED DATASET
# ============================================================

def enrich_sites(
    sites: pd.DataFrame
) -> pd.DataFrame:

    enriched_records = []

    for _, site in tqdm(
        sites.iterrows(),
        total=len(sites),
        desc="OSM enrichment"
    ):

        case_id = site["case_id"]

        lat = float(
            site["latitude"]
        )

        lon = float(
            site["longitude"]
        )

        try:

            osm_data = get_osm_data(
                case_id,
                lat,
                lon
            )

            features = extract_osm_features(
                case_id,
                lat,
                lon,
                osm_data
            )

            enriched_records.append(
                features
            )

        except Exception as exc:

            print(
                f"\nFAILED: {case_id}"
            )

            print(exc)

            enriched_records.append(
                {
                    "case_id":
                        case_id,

                    "osm_elements_found":
                        None,

                    "industrial_polygons_found":
                        None,

                    "industrial_polygon_overlap":
                        None,

                    "nearby_facilities_found":
                        None,

                    "nearest_facility":
                        None,

                    "nearest_facility_type":
                        None,

                    "nearest_facility_latitude":
                        None,

                    "nearest_facility_longitude":
                        None,

                    "nearest_facility_distance_m":
                        None,

                    "industrial_context_score":
                        None,

                    "industrial_context_level":
                        "osm_error",

                    "context_evidence":
                        f"OSM query failed: {exc}",

                    "osm_source":
                        OSM_SOURCE_NAME,
                }
            )

    enriched = pd.DataFrame(
        enriched_records
    )

    # Join to original prototype information
    enriched = sites.merge(
        enriched,
        on="case_id",
        how="left"
    )

    return enriched


# ============================================================
# GEOJSON OUTPUT
# ============================================================

def create_geojson(
    enriched: pd.DataFrame
) -> None:

    point_geometry = gpd.points_from_xy(
        enriched["longitude"],
        enriched["latitude"]
    )

    gdf = gpd.GeoDataFrame(
        enriched.copy(),
        geometry=point_geometry,
        crs="EPSG:4326"
    )

    # GeoJSON doesn't need every intermediate column.
    # Keep useful frontend fields.
    preferred_columns = [
        "case_id",
        "case_type",
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

        "count_ratio",
        "p95_ratio",
        "spike_score",

        "industrial_polygon_overlap",

        "nearest_facility",
        "nearest_facility_type",

        "nearest_facility_distance_m",

        "industrial_context_score",
        "industrial_context_level",

        "context_evidence",

        "geometry",
    ]

    available = [
        col
        for col in preferred_columns
        if col in gdf.columns
    ]

    gdf[available].to_file(
        GEOJSON_FILE,
        driver="GeoJSON"
    )


# ============================================================
# REPORT
# ============================================================

def create_report(
    enriched: pd.DataFrame
) -> None:

    lines = []

    lines.append(
        "PYROCLASS OSM ENRICHMENT REPORT"
    )

    lines.append(
        "=" * 70
    )

    lines.append("")

    lines.append(
        f"Prototype sites: {len(enriched)}"
    )

    lines.append(
        f"Search radius: "
        f"{SEARCH_RADIUS_METERS} metres"
    )

    lines.append("")

    if (
        "industrial_polygon_overlap"
        in enriched.columns
    ):

        overlap_count = int(
            enriched[
                "industrial_polygon_overlap"
            ]
            .fillna(False)
            .sum()
        )

        lines.append(
            f"Sites overlapping industrial/quarry "
            f"polygons: {overlap_count}"
        )

    if (
        "nearest_facility"
        in enriched.columns
    ):

        facility_count = int(
            enriched[
                "nearest_facility"
            ]
            .notna()
            .sum()
        )

        lines.append(
            f"Sites with nearby facilities: "
            f"{facility_count}"
        )

    if (
        "industrial_context_level"
        in enriched.columns
    ):

        lines.append("")
        lines.append(
            "CONTEXT LEVELS:"
        )

        counts = (
            enriched[
                "industrial_context_level"
            ]
            .value_counts(
                dropna=False
            )
        )

        for level, count in counts.items():

            lines.append(
                f"  {level}: {count}"
            )

    lines.append("")

    lines.append(
        "SITE RESULTS:"
    )

    display_columns = [
        "case_id",
        "case_type",
        "nearest_facility",
        "nearest_facility_type",
        "nearest_facility_distance_m",
        "industrial_polygon_overlap",
        "industrial_context_score",
        "industrial_context_level",
    ]

    display_columns = [
        c
        for c in display_columns
        if c in enriched.columns
    ]

    lines.append(
        enriched[
            display_columns
        ].to_string(
            index=False
        )
    )

    REPORT_FILE.write_text(
        "\n".join(lines),
        encoding="utf-8"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print(
        "\n=============================================="
    )
    print(
        "PYROCLASS OSM INDUSTRIAL ENRICHMENT"
    )
    print(
        "==============================================\n"
    )

    # --------------------------------------------------------
    # Check input
    # --------------------------------------------------------

    if not INPUT_FILE.exists():

        raise FileNotFoundError(
            f"Input file not found:\n{INPUT_FILE}"
        )

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    CACHE_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Load sites
    # --------------------------------------------------------

    print(
        f"Reading:\n{INPUT_FILE}\n"
    )

    sites = pd.read_csv(
        INPUT_FILE
    )

    required_columns = [
        "case_id",
        "latitude",
        "longitude",
    ]

    missing = [
        col
        for col in required_columns
        if col not in sites.columns
    ]

    if missing:

        raise ValueError(
            f"Missing required columns: {missing}"
        )

    print(
        f"Loaded {len(sites)} prototype sites."
    )

    # --------------------------------------------------------
    # Validate coordinates
    # --------------------------------------------------------

    sites["latitude"] = pd.to_numeric(
        sites["latitude"],
        errors="coerce"
    )

    sites["longitude"] = pd.to_numeric(
        sites["longitude"],
        errors="coerce"
    )

    invalid = sites[
        sites["latitude"].isna()
        |
        sites["longitude"].isna()
        |
        ~sites["latitude"].between(
            -90,
            90
        )
        |
        ~sites["longitude"].between(
            -180,
            180
        )
    ]

    if len(invalid) > 0:

        print(
            "Invalid coordinates:"
        )

        print(
            invalid[
                [
                    "case_id",
                    "latitude",
                    "longitude"
                ]
            ]
        )

        raise ValueError(
            "Fix invalid coordinates before "
            "running OSM enrichment."
        )

    # --------------------------------------------------------
    # Enrich
    # --------------------------------------------------------

    enriched = enrich_sites(
        sites
    )

    # --------------------------------------------------------
    # Save CSV
    # --------------------------------------------------------

    enriched.to_csv(
        OUTPUT_FILE,
        index=False
    )

    print(
        f"\nSaved enriched CSV:\n"
        f"{OUTPUT_FILE}"
    )

    # --------------------------------------------------------
    # Save GeoJSON
    # --------------------------------------------------------

    create_geojson(
        enriched
    )

    print(
        f"Saved GeoJSON:\n"
        f"{GEOJSON_FILE}"
    )

    # --------------------------------------------------------
    # Report
    # --------------------------------------------------------

    create_report(
        enriched
    )

    print(
        f"Saved report:\n"
        f"{REPORT_FILE}"
    )

    print(
        "\n=============================================="
    )

    print(
        "OSM ENRICHMENT COMPLETE"
    )

    print(
        "==============================================\n"
    )


if __name__ == "__main__":
    main()