"""
Live FIRMS ingestion, adapted to the current `hotspots` schema.

IMPORTANT CONTEXT: this schema was built for pre-aggregated, multi-year
case data (spike_score, year_2022/2023/2024, etc.) — not raw individual
detections. A single live FIRMS pull has no multi-year history to compute
those aggregates from, so this script inserts live detections with
case_type='live_detection' and leaves the aggregate-only fields NULL
rather than fabricating fake numbers.

Run from repo root:
    python backend/ingestion/firms_live.py
"""
import os
import io
import uuid
import pandas as pd
import requests
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")

MAP_KEY = os.getenv("FIRMS_MAP_KEY")
SENSOR = "VIIRS_SNPP_NRT"
DAY_RANGE = 1
INDIA_BBOX = "68,6,97.5,37.5"

DB_USER = os.getenv("POSTGRES_USER", "pyroclass")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "pyroclass123")
DB_NAME = os.getenv("POSTGRES_DB", "pyroclass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

MATCH_BUFFER_M = 2000  # same buffer as the manual spatial match, for consistency


def fetch_firms_csv():
    if not MAP_KEY:
        raise RuntimeError("FIRMS_MAP_KEY not found in backend/.env")
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SENSOR}/{INDIA_BBOX}/{DAY_RANGE}"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.text


def get_engine():
    url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    return create_engine(url)


def insert_live_hotspots(df, engine):
    inserted = 0
    with engine.begin() as conn:
        for _, row in df.iterrows():
            case_id = f"LIVE_{uuid.uuid4().hex[:8]}"

            conn.execute(
                text("""
                    INSERT INTO hotspots (
                        case_id, case_type, latitude, longitude, geometry,
                        mean_frp, max_frp, historical_data_available,
                        specific_facility_identified
                    ) VALUES (
                        :case_id, 'live_detection', :lat, :lon,
                        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                        :frp, :frp, false, false
                    )
                """),
                {
                    "case_id": case_id,
                    "lat": row["latitude"],
                    "lon": row["longitude"],
                    "frp": row.get("frp"),
                },
            )
            inserted += 1
    return inserted


def match_new_live_hotspots(engine):
    """Run spatial match against industrial_facilities, but only for
    rows we just inserted (case_type = 'live_detection' and not yet matched).
    Same buffer-distance logic as the earlier manual match script."""
    with engine.begin() as conn:
        result = conn.execute(text(f"""
            UPDATE hotspots h
            SET
                facility_name = nearest.name,
                facility_type = nearest.facility_type,
                facility_distance_m = nearest.distance_m,
                specific_facility_identified = true
            FROM (
                SELECT
                    h2.hotspot_id,
                    f.name,
                    f.facility_type,
                    ST_Distance(h2.geometry::geography, f.geometry::geography) AS distance_m
                FROM hotspots h2
                JOIN LATERAL (
                    SELECT f.name, f.facility_type, f.geometry
                    FROM industrial_facilities f
                    WHERE ST_DWithin(h2.geometry::geography, f.geometry::geography, {MATCH_BUFFER_M})
                    ORDER BY h2.geometry <-> f.geometry
                    LIMIT 1
                ) f ON true
                WHERE h2.case_type = 'live_detection'
                  AND h2.specific_facility_identified = false
            ) nearest
            WHERE h.hotspot_id = nearest.hotspot_id;
        """))
        return result.rowcount


if __name__ == "__main__":
    raw_csv = fetch_firms_csv()
    df = pd.read_csv(io.StringIO(raw_csv))
    print(f"Fetched {len(df)} live detections from FIRMS")

    engine = get_engine()
    n_inserted = insert_live_hotspots(df, engine)
    print(f"Inserted {n_inserted} new rows into hotspots (case_type=live_detection)")

    n_matched = match_new_live_hotspots(engine)
    print(f"Matched {n_matched} of them to a nearby facility")
