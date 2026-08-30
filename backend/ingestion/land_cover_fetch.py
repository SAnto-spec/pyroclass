"""
Bulk land-cover ingestion.

Unlike osm_enrich_live.py (one Overpass query per hotspot, which proved
unreliable against the flaky public servers), this issues ONE query for
the whole demo region's forest/farmland/urban polygons, stored once.
Far fewer requests = far less exposure to server instability, and the
data doesn't change often so it doesn't need re-fetching per hotspot.

Run from repo root:
    python backend/ingestion/land_cover_fetch.py
"""
import logging
import time
import os

import overpy
from sqlalchemy import create_engine, text
from shapely.geometry import Polygon
from dotenv import load_dotenv

load_dotenv("backend/.env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DB_USER = os.getenv("POSTGRES_USER", "pyroclass")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "pyroclass123")
DB_NAME = os.getenv("POSTGRES_DB", "pyroclass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

# Demo region bbox — India-wide is too large for one Overpass query
# (would likely time out); using a bounding region covering your seeded
# facilities' states (Gujarat, Jharkhand/Odisha steel belt) instead.
# south, west, north, east
REGION_BBOX = "17.0,68.0,26.0,90.0"

MAX_RETRIES = 3
RETRY_DELAY_S = 10


def get_engine():
    url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    return create_engine(url)


def fetch_landcover(api):
    query = f"""
        [out:json][timeout:90];
        (
          way["landuse"="forest"]({REGION_BBOX});
          way["natural"="wood"]({REGION_BBOX});
          way["landuse"="farmland"]({REGION_BBOX});
        );
        out geom;
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            log.info(f"Querying Overpass for land cover (attempt {attempt}/{MAX_RETRIES})...")
            return api.query(query)
        except Exception as e:
            log.warning(f"Attempt {attempt} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_S * attempt)
    log.error("All attempts failed — Overpass unavailable right now.")
    return None


def classify(tags):
    if tags.get("landuse") == "forest" or tags.get("natural") == "wood":
        return "tree_cover"
    if tags.get("landuse") == "farmland":
        return "farmland"
    return None


def way_to_polygon(way):
    """Convert an overpy Way's geometry into a Shapely Polygon."""
    coords = [(float(n.lon), float(n.lat)) for n in way.geometry] if way.geometry else None
    if not coords or len(coords) < 3:
        return None
    return Polygon(coords)


def insert_landcover(result, engine):
    if result is None:
        return 0

    inserted, skipped = 0, 0
    with engine.begin() as conn:
        for way in result.ways:
            cover_class = classify(way.tags)
            if cover_class is None:
                continue

            polygon = way_to_polygon(way)
            if polygon is None or not polygon.is_valid:
                skipped += 1
                continue

            conn.execute(
                text("""
                    INSERT INTO land_cover (cover_class, geom, source)
                    VALUES (:cover_class, ST_SetSRID(ST_GeomFromText(:wkt), 4326), 'OSM')
                """),
                {"cover_class": cover_class, "wkt": polygon.wkt},
            )
            inserted += 1

    log.info(f"Skipped {skipped} invalid/degenerate polygons")
    return inserted


def fetch_landcover_direct():
    """
    Bypasses overpy entirely — uses requests directly with explicit
    headers against the primary Overpass server, since overpy's bare
    requests were being rejected with 406 by overpass-api.de, while a
    normal browser-like request typically isn't.
    """
    import requests

    query = f"""
        [out:json][timeout:90];
        (
          way["landuse"="forest"]({REGION_BBOX});
          way["natural"="wood"]({REGION_BBOX});
          way["landuse"="farmland"]({REGION_BBOX});
        );
        out geom;
    """
    headers = {
        "User-Agent": "PyroclassSIH/1.0 (student hackathon project)",
        "Accept": "application/json",
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            log.info(f"Querying primary Overpass directly (attempt {attempt}/{MAX_RETRIES})...")
            response = requests.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
                headers=headers,
                timeout=90,
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            log.warning(f"Attempt {attempt} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_S * attempt)
    log.error("All direct attempts failed too.")
    return None


def insert_landcover_from_json(data, engine):
    if data is None:
        return 0

    inserted, skipped = 0, 0
    with engine.begin() as conn:
        for element in data.get("elements", []):
            if element.get("type") != "way" or "geometry" not in element:
                continue

            tags = element.get("tags", {})
            cover_class = classify(tags)
            if cover_class is None:
                continue

            coords = [(pt["lon"], pt["lat"]) for pt in element["geometry"]]
            if len(coords) < 3:
                skipped += 1
                continue

            polygon = Polygon(coords)
            if not polygon.is_valid:
                skipped += 1
                continue

            conn.execute(
                text("""
                    INSERT INTO land_cover (cover_class, geom, source)
                    VALUES (:cover_class, ST_SetSRID(ST_GeomFromText(:wkt), 4326), 'OSM')
                """),
                {"cover_class": cover_class, "wkt": polygon.wkt},
            )
            inserted += 1

    log.info(f"Skipped {skipped} invalid/degenerate polygons")
    return inserted


if __name__ == "__main__":
    api = overpy.Overpass(url="https://overpass.kumi.systems/api/interpreter")
    result = fetch_landcover(api)

    if result is not None:
        log.info(f"Fetched {len(result.ways)} raw ways from Overpass (mirror)")
        engine = get_engine()
        count = insert_landcover(result, engine)
        log.info(f"Inserted {count} land-cover polygons")
    else:
        log.info("Mirror failed — trying primary server directly...")
        data = fetch_landcover_direct()
        if data is None:
            log.error("Both mirror and primary failed. Land cover table not updated — try again later.")
        else:
            log.info(f"Fetched {len(data.get('elements', []))} raw elements from primary server")
            engine = get_engine()
            count = insert_landcover_from_json(data, engine)
            log.info(f"Inserted {count} land-cover polygons")
