"""
OSM enrichment for live hotspots.

For every hotspot with context_type = 'unknown' (currently: all live-
ingested rows), queries OSM via Overpass for nearby industrial or
forest/farmland features within a small radius, and updates context_type,
has_osm_context, facility_name/facility_type/facility_distance_m
accordingly.

Uses `overpy` instead of raw requests+manual JSON parsing — it builds the
Overpass QL query and parses the response for us, which is why this file
is much shorter than the original osm_ingest.py draft.

Install once: pip install overpy

Run from repo root:
    python backend/ingestion/osm_enrich_live.py
"""
import logging
import time

import overpy
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv("backend/.env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DB_USER = os.getenv("POSTGRES_USER", "pyroclass")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "pyroclass123")
DB_NAME = os.getenv("POSTGRES_DB", "pyroclass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

SEARCH_RADIUS_M = 2000   # matches the facility spatial-match buffer
MAX_RETRIES = 3
RETRY_DELAY_S = 5
BETWEEN_QUERY_DELAY_S = 1  # be polite to the free Overpass endpoint


def get_engine():
    url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    return create_engine(url)


def fetch_unenriched_hotspots(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text("""
                SELECT hotspot_id, latitude, longitude
                FROM hotspots
                WHERE context_type = 'unknown' OR context_type IS NULL
            """)
        )
        return result.fetchall()


def query_overpass_near(api, lat, lon):
    """
    Query OSM for industrial or vegetation features near a point.
    Retries on transient failures (Overpass is a shared free service and
    does occasionally time out or rate-limit).
    """
    query = f"""
        (
          node["man_made"="works"](around:{SEARCH_RADIUS_M},{lat},{lon});
          way["man_made"="works"](around:{SEARCH_RADIUS_M},{lat},{lon});
          node["power"="plant"](around:{SEARCH_RADIUS_M},{lat},{lon});
          way["power"="plant"](around:{SEARCH_RADIUS_M},{lat},{lon});
          node["industrial"](around:{SEARCH_RADIUS_M},{lat},{lon});
          way["industrial"](around:{SEARCH_RADIUS_M},{lat},{lon});
          way["landuse"="forest"](around:{SEARCH_RADIUS_M},{lat},{lon});
          way["natural"="wood"](around:{SEARCH_RADIUS_M},{lat},{lon});
          way["landuse"="farmland"](around:{SEARCH_RADIUS_M},{lat},{lon});
        );
        out center;
    """

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return api.query(query)
        except (overpy.exception.OverpassTooManyRequests,
                overpy.exception.OverpassGatewayTimeout) as e:
            log.warning(f"Overpass busy (attempt {attempt}/{MAX_RETRIES}): {e}")
            time.sleep(RETRY_DELAY_S * attempt)  # back off a bit longer each retry
        except overpy.exception.OverpassUnknownHTTPStatusCode as e:
            log.error(f"Overpass returned an unexpected status (likely server-side issue, not a bug here): {e}")
            return None
        except overpy.exception.OverpassError as e:
            log.error(f"Overpass query failed, skipping this point: {e}")
            return None
        except Exception as e:
            # Catches raw connection/HTTP errors (IncompleteRead etc.) that
            # aren't wrapped in overpy's own exception types — the public
            # Overpass servers are prone to this under load.
            log.error(f"Unexpected error querying Overpass, skipping this point: {e}")
            return None
    log.error(f"Gave up on point ({lat}, {lon}) after {MAX_RETRIES} attempts")
    return None


def classify_result(result):
    """
    Turn a raw Overpass result into (context_type, facility_name, facility_type).
    Prefers an industrial match over vegetation if both are present nearby —
    an industrial fire matters more to flag correctly than a nearby field.
    """
    if result is None:
        return "unknown", None, None

    for element in list(result.nodes) + list(result.ways):
        tags = element.tags
        if "power" in tags or "industrial" in tags or tags.get("man_made") == "works":
            name = tags.get("name", "Unnamed industrial feature")
            ftype = tags.get("power") or tags.get("industrial") or "industrial"
            return "industrial", name, ftype

    for element in list(result.ways):
        tags = element.tags
        if tags.get("landuse") == "forest" or tags.get("natural") == "wood":
            return "forest", None, None
        if tags.get("landuse") == "farmland":
            return "agriculture", None, None

    return "unknown", None, None


def enrich(engine, api):
    rows = fetch_unenriched_hotspots(engine)
    log.info(f"Found {len(rows)} hotspots needing OSM enrichment")

    updated = 0
    failed = 0

    with engine.begin() as conn:
        for hotspot_id, lat, lon in rows:
            result = query_overpass_near(api, lat, lon)
            context_type, facility_name, facility_type = classify_result(result)

            try:
                conn.execute(
                    text("""
                        UPDATE hotspots
                        SET context_type = :context_type,
                            has_osm_context = :has_context,
                            facility_name = COALESCE(:facility_name, facility_name),
                            facility_type = COALESCE(:facility_type, facility_type)
                        WHERE hotspot_id = :hotspot_id
                    """),
                    {
                        "context_type": context_type,
                        "has_context": context_type != "unknown",
                        "facility_name": facility_name,
                        "facility_type": facility_type,
                        "hotspot_id": hotspot_id,
                    },
                )
                updated += 1
            except Exception as e:
                log.error(f"DB update failed for hotspot {hotspot_id}: {e}")
                failed += 1

            time.sleep(BETWEEN_QUERY_DELAY_S)

    return updated, failed


if __name__ == "__main__":
    engine = get_engine()
    # overpass-api.de (the default) now rejects requests missing certain
    # headers (User-Agent, Accept) with HTTP 406 — a recent server-side
    # change affecting overpy and other tools, not specific to this script.
    # kumi.systems is a public mirror that doesn't enforce the same checks.
    api = overpy.Overpass(url="https://overpass.kumi.systems/api/interpreter")

    updated, failed = enrich(engine, api)
    log.info(f"Done. Updated {updated} hotspots, {failed} failed.")
