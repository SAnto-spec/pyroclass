from pathlib import Path
import json
import math
import time
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

from tqdm import tqdm


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

PROCESSED_DIR = BASE_DIR / "data" / "processed"

INPUT_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_sites_osm_enriched.csv"
)

# Fallback if the enriched file doesn't exist yet
FALLBACK_INPUT_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_prototype_candidates.csv"
)

OUTPUT_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_sites_validated.csv"
)

GEOJSON_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_sites_validated.geojson"
)

REPORT_FILE = (
    PROCESSED_DIR /
    "pyroclass_20_sites_validation_report.txt"
)

CACHE_DIR = (
    PROCESSED_DIR /
    "osm_validation_cache"
)


# ============================================================
# OVERPASS SETTINGS
# ============================================================

OVERPASS_URL = (
    "https://overpass-api.de/api/interpreter"
)

SEARCH_RADIUS_METERS = 1500

REQUEST_DELAY = 2.0

MAX_RETRIES = 4

REQUEST_TIMEOUT = 120


# ============================================================
# OSM TAG GROUPS
# ============================================================

# Strong industrial facility indicators
INDUSTRIAL_TAGS = {
    "power": ["plant"],
    "man_made": ["works"],
}

# Tags indicating mining/quarry activity
MINING_LANDUSE = {
    "quarry",
    "mine",
}

# Natural / vegetation land use
FOREST_TAGS = {
    ("landuse", "forest"),
    ("natural", "wood"),
    ("natural", "scrub"),
}

AGRICULTURE_TAGS = {
    ("landuse", "farmland"),
    ("landuse", "farm"),
    ("landuse", "orchard"),
    ("landuse", "vineyard"),
}


# ============================================================
# HELPERS
# ============================================================

def print_header(title: str) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def haversine_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """
    Great-circle distance in metres.
    """

    R = 6_371_000

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        +
        math.cos(phi1)
        * math.cos(phi2)
        * math.sin(dlambda / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a),
    )

    return R * c


def get_element_center(
    element: Dict[str, Any],
) -> Optional[Tuple[float, float]]:

    if (
        "lat" in element
        and "lon" in element
    ):
        return (
            float(element["lat"]),
            float(element["lon"]),
        )

    center = element.get("center")

    if center:

        if (
            "lat" in center
            and "lon" in center
        ):
            return (
                float(center["lat"]),
                float(center["lon"]),
            )

    return None


def osm_geometry(
    element: Dict[str, Any],
):
    """
    Create approximate Shapely geometry
    from an OSM node/way.
    """

    center = get_element_center(element)

    element_type = element.get("type")

    if element_type == "node":

        if center is None:
            return None

        lat, lon = center

        return Point(
            lon,
            lat,
        )

    geometry = element.get("geometry")

    if not geometry:

        if center is None:
            return None

        lat, lon = center

        return Point(
            lon,
            lat,
        )

    coords = []

    for point in geometry:

        if (
            "lat" in point
            and "lon" in point
        ):
            coords.append(
                (
                    float(point["lon"]),
                    float(point["lat"]),
                )
            )

    if len(coords) < 2:
        return None

    # Polygon if closed
    if (
        len(coords) >= 4
        and coords[0] == coords[-1]
    ):

        try:
            poly = Polygon(coords)

            if poly.is_valid:
                return poly

            fixed = poly.buffer(0)

            if fixed.is_valid:
                return fixed

        except Exception:
            pass

    return LineString(coords)


# ============================================================
# FACILITY CLASSIFICATION
# ============================================================

def classify_facility(
    tags: Dict[str, Any],
) -> str:

    power = str(
        tags.get("power", "")
    ).lower()

    industrial = str(
        tags.get("industrial", "")
    ).lower()

    works = str(
        tags.get("works", "")
    ).lower()

    man_made = str(
        tags.get("man_made", "")
    ).lower()

    landuse = str(
        tags.get("landuse", "")
    ).lower()

    product = str(
        tags.get("product", "")
    ).lower()

    name = str(
        tags.get("name", "")
    ).lower()

    operator = str(
        tags.get("operator", "")
    ).lower()

    text = " ".join([
        industrial,
        works,
        man_made,
        product,
        name,
        operator,
    ])

    # --------------------------------------------------------
    # Power
    # --------------------------------------------------------

    if power == "plant":
        return "power_plant"

    # --------------------------------------------------------
    # Refinery / petrochemical
    # --------------------------------------------------------

    refinery_words = [
        "oil_refinery",
        "refinery",
        "petrochemical",
        "petroleum",
    ]

    if any(
        word in text
        for word in refinery_words
    ):
        return "oil_refinery"

    # --------------------------------------------------------
    # Steel / metal
    # --------------------------------------------------------

    steel_words = [
        "steel",
        "iron",
        "metal",
        "smelter",
        "foundry",
    ]

    if any(
        word in text
        for word in steel_words
    ):
        return "steel_metal"

    # --------------------------------------------------------
    # Cement
    # --------------------------------------------------------

    if "cement" in text:
        return "cement_plant"

    # --------------------------------------------------------
    # Chemical
    # --------------------------------------------------------

    chemical_words = [
        "chemical",
        "fertilizer",
        "pharmaceutical",
    ]

    if any(
        word in text
        for word in chemical_words
    ):
        return "chemical_plant"

    # --------------------------------------------------------
    # Gas / LNG
    # --------------------------------------------------------

    gas_words = [
        "lng",
        "lpg",
        "gas_terminal",
        "gas plant",
        "natural gas",
    ]

    if any(
        word in text
        for word in gas_words
    ):
        return "gas_lng"

    # --------------------------------------------------------
    # Mining
    # --------------------------------------------------------

    if landuse in {
        "quarry",
        "mine",
    }:

        return "mining_quarry"

    mining_words = [
        "mine",
        "mining",
        "quarry",
        "coal",
    ]

    if any(
        word in text
        for word in mining_words
    ):
        return "mining_quarry"

    # --------------------------------------------------------
    # Generic industrial works
    # --------------------------------------------------------

    if man_made == "works":
        return "industrial_works"

    if industrial:
        return "industrial_facility"

    return "unknown"


# ============================================================
# OSM QUERY
# ============================================================

def build_query(
    lat: float,
    lon: float,
    radius: int,
) -> str:

    return f"""
    [out:json][timeout:90];

    (
        /* Industrial land */
        way["landuse"="industrial"]
            (around:{radius},{lat},{lon});

        /* Quarry */
        way["landuse"="quarry"]
            (around:{radius},{lat},{lon});

        /* Mine */
        way["landuse"="mine"]
            (around:{radius},{lat},{lon});

        /* Industrial works */
        way["man_made"="works"]
            (around:{radius},{lat},{lon});

        node["man_made"="works"]
            (around:{radius},{lat},{lon});

        /* Power plants */
        way["power"="plant"]
            (around:{radius},{lat},{lon});

        node["power"="plant"]
            (around:{radius},{lat},{lon});

        /* Industrial tags */
        way["industrial"]
            (around:{radius},{lat},{lon});

        node["industrial"]
            (around:{radius},{lat},{lon});

        /* Mine shafts */
        node["man_made"="mineshaft"]
            (around:{radius},{lat},{lon});

        /* Forest */
        way["landuse"="forest"]
            (around:{radius},{lat},{lon});

        way["natural"="wood"]
            (around:{radius},{lat},{lon});

        /* Agriculture */
        way["landuse"="farmland"]
            (around:{radius},{lat},{lon});

        way["landuse"="farm"]
            (around:{radius},{lat},{lon});

        way["landuse"="orchard"]
            (around:{radius},{lat},{lon});
    );

    out center geom tags;
    """


def query_overpass(
    lat: float,
    lon: float,
) -> Dict[str, Any]:

    query = build_query(
        lat,
        lon,
        SEARCH_RADIUS_METERS,
    )

    last_error = None

    for attempt in range(
        1,
        MAX_RETRIES + 1,
    ):

        try:

            response = requests.post(
                OVERPASS_URL,
                data=query,
                timeout=REQUEST_TIMEOUT,
                headers={
                    "User-Agent":
                        "PyroClass-SIH2026"
                },
            )

            response.raise_for_status()

            return response.json()

        except Exception as exc:

            last_error = exc

            print(
                f"Overpass attempt "
                f"{attempt}/{MAX_RETRIES} failed:"
            )

            print(exc)

            if attempt < MAX_RETRIES:

                time.sleep(
                    attempt * 5
                )

    raise RuntimeError(
        "Overpass request failed: "
        f"{last_error}"
    )


# ============================================================
# CACHE
# ============================================================

def cache_path(
    case_id: str,
) -> Path:

    safe_id = (
        str(case_id)
        .replace("/", "_")
        .replace("\\", "_")
    )

    return (
        CACHE_DIR /
        f"{safe_id}.json"
    )


def get_cached_osm(
    case_id: str,
    lat: float,
    lon: float,
) -> Dict[str, Any]:

    CACHE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = cache_path(
        case_id
    )

    if path.exists():

        with open(
            path,
            "r",
            encoding="utf-8",
        ) as f:

            return json.load(f)

    data = query_overpass(
        lat,
        lon,
    )

    with open(
        path,
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            data,
            f,
            indent=2,
        )

    time.sleep(
        REQUEST_DELAY
    )

    return data


# ============================================================
# CONTEXT ANALYSIS
# ============================================================

def analyze_context(
    case_id: str,
    lat: float,
    lon: float,
    osm_data: Dict[str, Any],
) -> Dict[str, Any]:

    hotspot = Point(
        lon,
        lat,
    )

    elements = osm_data.get(
        "elements",
        []
    )

    industrial_features = []
    mining_features = []
    forest_features = []
    agricultural_features = []

    industrial_polygons = []
    mining_polygons = []
    forest_polygons = []
    agricultural_polygons = []

    # --------------------------------------------------------
    # Process OSM elements
    # --------------------------------------------------------

    for element in elements:

        tags = element.get(
            "tags",
            {}
        )

        geometry = osm_geometry(
            element
        )

        center = get_element_center(
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
            or "Unnamed feature"
        )

        element_id = (
            f"{element.get('type', 'unknown')}/"
            f"{element.get('id', 'unknown')}"
        )

        # ====================================================
        # INDUSTRIAL
        # ====================================================

        is_power = (
            tags.get("power") == "plant"
        )

        is_works = (
            tags.get("man_made") == "works"
        )

        is_industrial_tag = (
            "industrial" in tags
        )

        is_industrial_land = (
            tags.get("landuse")
            == "industrial"
        )

        # A quarry is NOT counted as generic industrial.
        is_quarry = (
            tags.get("landuse")
            in {
                "quarry",
                "mine",
            }
        )

        if (
            is_power
            or is_works
            or is_industrial_tag
            or is_industrial_land
        ) and not is_quarry:

            if center is not None:

                f_lat, f_lon = center

                distance = haversine_distance(
                    lat,
                    lon,
                    f_lat,
                    f_lon,
                )

                industrial_features.append(
                    {
                        "element_id": element_id,
                        "name": name,
                        "facility_type":
                            facility_type,
                        "latitude": f_lat,
                        "longitude": f_lon,
                        "distance_m":
                            distance,
                        "tags": tags,
                    }
                )

            if geometry is not None:

                if isinstance(
                    geometry,
                    (Polygon, MultiPolygon),
                ):

                    industrial_polygons.append(
                        {
                            "element_id":
                                element_id,
                            "name": name,
                            "facility_type":
                                facility_type,
                            "geometry":
                                geometry,
                            "tags": tags,
                        }
                    )

        # ====================================================
        # MINING
        # ====================================================

        is_mining = (
            tags.get("landuse")
            in {"quarry", "mine"}
            or tags.get("man_made")
            == "mineshaft"
            or facility_type
            == "mining_quarry"
        )

        if is_mining:

            if center is not None:

                f_lat, f_lon = center

                distance = haversine_distance(
                    lat,
                    lon,
                    f_lat,
                    f_lon,
                )

                mining_features.append(
                    {
                        "element_id":
                            element_id,

                        "name":
                            name,

                        "facility_type":
                            "mining_quarry",

                        "latitude":
                            f_lat,

                        "longitude":
                            f_lon,

                        "distance_m":
                            distance,

                        "tags":
                            tags,
                    }
                )

            if geometry is not None:

                if isinstance(
                    geometry,
                    (Polygon, MultiPolygon),
                ):

                    mining_polygons.append(
                        {
                            "element_id":
                                element_id,

                            "name":
                                name,

                            "geometry":
                                geometry,

                            "tags":
                                tags,
                        }
                    )

        # ====================================================
        # FOREST
        # ====================================================

        is_forest = (
            (
                tags.get("landuse"),
                tags.get("natural"),
            )
            in FOREST_TAGS
        )

        if (
            tags.get("landuse")
            == "forest"
            or tags.get("natural")
            in {"wood", "scrub"}
        ):

            if center is not None:

                f_lat, f_lon = center

                distance = haversine_distance(
                    lat,
                    lon,
                    f_lat,
                    f_lon,
                )

                forest_features.append(
                    {
                        "element_id":
                            element_id,

                        "name":
                            name,

                        "latitude":
                            f_lat,

                        "longitude":
                            f_lon,

                        "distance_m":
                            distance,
                    }
                )

            if geometry is not None:

                if isinstance(
                    geometry,
                    (Polygon, MultiPolygon),
                ):

                    forest_polygons.append(
                        geometry
                    )

        # ====================================================
        # AGRICULTURE
        # ====================================================

        if (
            tags.get("landuse")
            in {
                "farmland",
                "farm",
                "orchard",
                "vineyard",
            }
        ):

            if center is not None:

                f_lat, f_lon = center

                distance = haversine_distance(
                    lat,
                    lon,
                    f_lat,
                    f_lon,
                )

                agricultural_features.append(
                    {
                        "element_id":
                            element_id,

                        "name":
                            name,

                        "latitude":
                            f_lat,

                        "longitude":
                            f_lon,

                        "distance_m":
                            distance,
                    }
                )

            if geometry is not None:

                if isinstance(
                    geometry,
                    (Polygon, MultiPolygon),
                ):

                    agricultural_polygons.append(
                        geometry
                    )

    # ========================================================
    # POLYGON OVERLAPS
    # ========================================================

    industrial_overlap = False

    for item in industrial_polygons:

        try:

            if (
                item["geometry"].contains(
                    hotspot
                )
                or item["geometry"].intersects(
                    hotspot
                )
            ):

                industrial_overlap = True
                break

        except Exception:
            continue

    mining_overlap = False

    for item in mining_polygons:

        try:

            if (
                item["geometry"].contains(
                    hotspot
                )
                or item["geometry"].intersects(
                    hotspot
                )
            ):

                mining_overlap = True
                break

        except Exception:
            continue

    forest_overlap = False

    for polygon in forest_polygons:

        try:

            if (
                polygon.contains(
                    hotspot
                )
                or polygon.intersects(
                    hotspot
                )
            ):

                forest_overlap = True
                break

        except Exception:
            continue

    agricultural_overlap = False

    for polygon in agricultural_polygons:

        try:

            if (
                polygon.contains(
                    hotspot
                )
                or polygon.intersects(
                    hotspot
                )
            ):

                agricultural_overlap = True
                break

        except Exception:
            continue

    # ========================================================
    # SORT BY DISTANCE
    # ========================================================

    industrial_features.sort(
        key=lambda x:
            x["distance_m"]
    )

    mining_features.sort(
        key=lambda x:
            x["distance_m"]
    )

    forest_features.sort(
        key=lambda x:
            x["distance_m"]
    )

    agricultural_features.sort(
        key=lambda x:
            x["distance_m"]
    )

    nearest_industrial = (
        industrial_features[0]
        if industrial_features
        else None
    )

    nearest_mining = (
        mining_features[0]
        if mining_features
        else None
    )

    nearest_forest = (
        forest_features[0]
        if forest_features
        else None
    )

    nearest_agriculture = (
        agricultural_features[0]
        if agricultural_features
        else None
    )

    # ========================================================
    # INDUSTRIAL CONFIDENCE
    # ========================================================

    industrial_score = 0.0

    industrial_evidence = []

    if industrial_overlap:

        industrial_score += 0.50

        industrial_evidence.append(
            "Hotspot coordinate overlaps "
            "an OSM industrial polygon"
        )

    if nearest_industrial is not None:

        distance = (
            nearest_industrial[
                "distance_m"
            ]
        )

        facility_type = (
            nearest_industrial[
                "facility_type"
            ]
        )

        if distance <= 375:

            industrial_score += 0.35

            industrial_evidence.append(
                "Specific industrial facility "
                "within approximately one VIIRS "
                "pixel"
            )

        elif distance <= 750:

            industrial_score += 0.25

            industrial_evidence.append(
                "Industrial facility within 750 m"
            )

        elif distance <= 1500:

            industrial_score += 0.10

            industrial_evidence.append(
                "Industrial facility within 1.5 km"
            )

        if facility_type != "industrial_unknown":

            industrial_score += 0.15

            industrial_evidence.append(
                "Specific facility type identified"
            )

    industrial_score = min(
        industrial_score,
        1.0
    )

    # ========================================================
    # MINING CONFIDENCE
    # ========================================================

    mining_score = 0.0

    mining_evidence = []

    if mining_overlap:

        mining_score += 0.60

        mining_evidence.append(
            "Hotspot overlaps an OSM "
            "quarry/mine polygon"
        )

    if nearest_mining is not None:

        distance = (
            nearest_mining[
                "distance_m"
            ]
        )

        if distance <= 375:

            mining_score += 0.30

            mining_evidence.append(
                "Mining/quarry feature within "
                "approximately one VIIRS pixel"
            )

        elif distance <= 750:

            mining_score += 0.20

            mining_evidence.append(
                "Mining/quarry feature within 750 m"
            )

        elif distance <= 1500:

            mining_score += 0.10

            mining_evidence.append(
                "Mining/quarry feature within 1.5 km"
            )

    mining_score = min(
        mining_score,
        1.0
    )

    # ========================================================
    # NATURAL / AGRICULTURAL CONTEXT
    # ========================================================

    if forest_overlap:

        vegetation_context = "forest"

    elif (
        nearest_forest is not None
        and nearest_forest["distance_m"]
        <= 750
    ):

        vegetation_context = "forest_nearby"

    else:

        vegetation_context = "none"

    if agricultural_overlap:

        agriculture_context = "agriculture"

    elif (
        nearest_agriculture is not None
        and nearest_agriculture[
            "distance_m"
        ] <= 750
    ):

        agriculture_context = (
            "agriculture_nearby"
        )

    else:

        agriculture_context = "none"

    # ========================================================
    # FINAL CONTEXT DECISION
    # ========================================================

    # Priority rules:
    #
    # Strong industrial evidence
    #       ↓
    # industrial
    #
    # Strong mining evidence
    #       ↓
    # mining/quarry
    #
    # Strong forest/agriculture
    #       ↓
    # vegetation/agriculture
    #
    # otherwise
    #       ↓
    # unknown
    #
    # We also retain both scores so that mixed cases
    # are not lost.

    if (
        industrial_score >= 0.60
        and industrial_score >
        mining_score
    ):

        if (
            nearest_industrial
            is not None
        ):

            context_type = (
                "industrial"
            )

            facility_type = (
                nearest_industrial[
                    "facility_type"
                ]
            )

            facility_name = (
                nearest_industrial[
                    "name"
                ]
            )

            facility_distance = (
                nearest_industrial[
                    "distance_m"
                ]
            )

        else:

            context_type = (
                "industrial"
            )

            facility_type = (
                "industrial_area"
            )

            facility_name = (
                "Industrial area"
            )

            facility_distance = None

    elif mining_score >= 0.60:

        context_type = (
            "mining_quarry"
        )

        if nearest_mining:

            facility_type = (
                "mining_quarry"
            )

            facility_name = (
                nearest_mining[
                    "name"
                ]
            )

            facility_distance = (
                nearest_mining[
                    "distance_m"
                ]
            )

        else:

            facility_type = (
                "mining_quarry"
            )

            facility_name = (
                "Mining/quarry area"
            )

            facility_distance = None

    elif vegetation_context != "none":

        context_type = (
            "vegetation"
        )

        facility_type = None
        facility_name = None

        facility_distance = (
            nearest_forest[
                "distance_m"
            ]
            if nearest_forest
            else None
        )

    elif agriculture_context != "none":

        context_type = (
            "agriculture"
        )

        facility_type = None
        facility_name = None

        facility_distance = (
            nearest_agriculture[
                "distance_m"
            ]
            if nearest_agriculture
            else None
        )

    else:

        context_type = "unknown"

        facility_type = None
        facility_name = None
        facility_distance = None

    # ========================================================
    # CONTEXT CONFIDENCE
    # ========================================================

    if context_type == "industrial":

        context_confidence = industrial_score

    elif context_type == "mining_quarry":

        context_confidence = mining_score

    elif context_type == "vegetation":

        context_confidence = (
            0.85
            if forest_overlap
            else 0.55
        )

    elif context_type == "agriculture":

        context_confidence = (
            0.85
            if agricultural_overlap
            else 0.55
        )

    else:

        context_confidence = 0.0

    # ========================================================
    # FINAL EVIDENCE
    # ========================================================

    evidence = []

    if industrial_evidence:

        evidence.extend(
            industrial_evidence
        )

    if mining_evidence:

        evidence.extend(
            mining_evidence
        )

    if forest_overlap:

        evidence.append(
            "Hotspot overlaps an OSM "
            "forest/wood polygon"
        )

    if agricultural_overlap:

        evidence.append(
            "Hotspot overlaps an OSM "
            "agricultural polygon"
        )

    if not evidence:

        evidence.append(
            "No strong OSM geographic "
            "context found within search radius"
        )

    return {

        "case_id":
            case_id,

        "osm_elements":
            len(elements),

        "industrial_features_found":
            len(industrial_features),

        "mining_features_found":
            len(mining_features),

        "forest_features_found":
            len(forest_features),

        "agriculture_features_found":
            len(agricultural_features),

        "industrial_polygon_overlap":
            industrial_overlap,

        "mining_polygon_overlap":
            mining_overlap,

        "forest_polygon_overlap":
            forest_overlap,

        "agriculture_polygon_overlap":
            agricultural_overlap,

        "industrial_context_score":
            round(
                industrial_score,
                3
            ),

        "mining_context_score":
            round(
                mining_score,
                3
            ),

        "context_type":
            context_type,

        "context_confidence":
            round(
                context_confidence,
                3
            ),

        "facility_type":
            facility_type,

        "facility_name":
            facility_name,

        "facility_distance_m":
            (
                round(
                    facility_distance,
                    2
                )
                if facility_distance
                is not None
                else None
            ),

        "nearest_industrial_name":
            (
                nearest_industrial[
                    "name"
                ]
                if nearest_industrial
                else None
            ),

        "nearest_industrial_type":
            (
                nearest_industrial[
                    "facility_type"
                ]
                if nearest_industrial
                else None
            ),

        "nearest_industrial_distance_m":
            (
                round(
                    nearest_industrial[
                        "distance_m"
                    ],
                    2
                )
                if nearest_industrial
                else None
            ),

        "nearest_mining_name":
            (
                nearest_mining[
                    "name"
                ]
                if nearest_mining
                else None
            ),

        "nearest_mining_distance_m":
            (
                round(
                    nearest_mining[
                        "distance_m"
                    ],
                    2
                )
                if nearest_mining
                else None
            ),

        "vegetation_context":
            vegetation_context,

        "agriculture_context":
            agriculture_context,

        "context_evidence":
            " | ".join(evidence),

        "osm_source":
            "OpenStreetMap via Overpass API",
    }


# ============================================================
# PROCESS ALL SITES
# ============================================================

def main():

    print_header(
        "PYROCLASS GEOGRAPHICAL CONTEXT VALIDATION"
    )

    # --------------------------------------------------------
    # Find input
    # --------------------------------------------------------

    if INPUT_FILE.exists():

        input_file = INPUT_FILE

    elif FALLBACK_INPUT_FILE.exists():

        print(
            "WARNING:"
        )

        print(
            "OSM-enriched file not found."
        )

        print(
            "Using prototype candidates instead."
        )

        input_file = FALLBACK_INPUT_FILE

    else:

        raise FileNotFoundError(
            "Could not find either:\n"
            f"{INPUT_FILE}\n"
            f"{FALLBACK_INPUT_FILE}"
        )

    print(
        f"Input:\n{input_file}"
    )

    sites = pd.read_csv(
        input_file
    )

    required = [
        "case_id",
        "latitude",
        "longitude",
    ]

    missing = [
        c
        for c in required
        if c not in sites.columns
    ]

    if missing:

        raise ValueError(
            f"Missing columns: {missing}"
        )

    print(
        f"Loaded {len(sites)} sites."
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

    bad = sites[
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

    if len(bad) > 0:

        print(
            "Invalid coordinates:"
        )

        print(
            bad[
                [
                    "case_id",
                    "latitude",
                    "longitude",
                ]
            ]
        )

        raise ValueError(
            "Fix invalid coordinates."
        )

    # --------------------------------------------------------
    # Process sites
    # --------------------------------------------------------

    results = []

    for _, site in tqdm(
        sites.iterrows(),
        total=len(sites),
        desc="Validating OSM context",
    ):

        case_id = str(
            site["case_id"]
        )

        lat = float(
            site["latitude"]
        )

        lon = float(
            site["longitude"]
        )

        try:

            osm = get_cached_osm(
                case_id,
                lat,
                lon,
            )

            result = analyze_context(
                case_id,
                lat,
                lon,
                osm,
            )

            results.append(
                result
            )

        except Exception as exc:

            print(
                f"\nERROR for {case_id}:"
            )

            print(exc)

            results.append(
                {
                    "case_id": case_id,

                    "osm_elements":
                        None,

                    "industrial_features_found":
                        None,

                    "mining_features_found":
                        None,

                    "forest_features_found":
                        None,

                    "agriculture_features_found":
                        None,

                    "industrial_polygon_overlap":
                        None,

                    "mining_polygon_overlap":
                        None,

                    "forest_polygon_overlap":
                        None,

                    "agriculture_polygon_overlap":
                        None,

                    "industrial_context_score":
                        None,

                    "mining_context_score":
                        None,

                    "context_type":
                        "osm_error",

                    "context_confidence":
                        None,

                    "facility_type":
                        None,

                    "facility_name":
                        None,

                    "facility_distance_m":
                        None,

                    "nearest_industrial_name":
                        None,

                    "nearest_industrial_type":
                        None,

                    "nearest_industrial_distance_m":
                        None,

                    "nearest_mining_name":
                        None,

                    "nearest_mining_distance_m":
                        None,

                    "vegetation_context":
                        None,

                    "agriculture_context":
                        None,

                    "context_evidence":
                        str(exc),

                    "osm_source":
                        "OpenStreetMap via Overpass API",
                }
            )

    result_df = pd.DataFrame(
        results
    )

    # --------------------------------------------------------
    # Merge original site data
    # --------------------------------------------------------

    final = sites.merge(
        result_df,
        on="case_id",
        how="left",
        suffixes=("", "_osm"),
    )

    # --------------------------------------------------------
    # Sort
    # --------------------------------------------------------

    final = final.sort_values(
        by="case_id"
    ).reset_index(
        drop=True
    )

    # --------------------------------------------------------
    # Save CSV
    # --------------------------------------------------------

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    final.to_csv(
        OUTPUT_FILE,
        index=False,
    )

    # --------------------------------------------------------
    # Create GeoJSON
    # --------------------------------------------------------

    geometry = gpd.points_from_xy(
        final["longitude"],
        final["latitude"],
    )

    geo = gpd.GeoDataFrame(
        final.copy(),
        geometry=geometry,
        crs="EPSG:4326",
    )

    geo.to_file(
        GEOJSON_FILE,
        driver="GeoJSON",
    )

    # --------------------------------------------------------
    # Report
    # --------------------------------------------------------

    lines = []

    lines.append(
        "PYROCLASS OSM CONTEXT VALIDATION REPORT"
    )

    lines.append(
        "=" * 80
    )

    lines.append(
        f"Sites processed: {len(final)}"
    )

    lines.append(
        f"OSM search radius: "
        f"{SEARCH_RADIUS_METERS} m"
    )

    lines.append("")

    lines.append(
        "FINAL CONTEXT COUNTS:"
    )

    counts = (
        final[
            "context_type"
        ]
        .value_counts(
            dropna=False
        )
    )

    for label, count in counts.items():

        lines.append(
            f"  {label}: {count}"
        )

    lines.append("")

    lines.append(
        "SITE RESULTS:"
    )

    columns = [
        "case_id",
        "case_type",
        "context_type",
        "context_confidence",
        "facility_name",
        "facility_type",
        "facility_distance_m",
        "industrial_context_score",
        "mining_context_score",
        "industrial_polygon_overlap",
        "mining_polygon_overlap",
        "context_evidence",
    ]

    columns = [
        c
        for c in columns
        if c in final.columns
    ]

    lines.append(
        final[columns]
        .to_string(
            index=False
        )
    )

    REPORT_FILE.write_text(
        "\n".join(lines),
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # Print final table
    # --------------------------------------------------------

    print_header(
        "FINAL CONTEXT CLASSIFICATION"
    )

    print(
        final[
            [
                "case_id",
                "case_type",
                "context_type",
                "context_confidence",
                "facility_name",
                "facility_type",
                "facility_distance_m",
            ]
        ]
        .to_string(
            index=False
        )
    )

    print_header(
        "FILES CREATED"
    )

    print(
        f"CSV:\n{OUTPUT_FILE}"
    )

    print(
        f"\nGeoJSON:\n{GEOJSON_FILE}"
    )

    print(
        f"\nReport:\n{REPORT_FILE}"
    )

    print(
        f"\nOSM cache:\n{CACHE_DIR}"
    )

    print(
        "\nValidation complete."
    )


if __name__ == "__main__":
    main()