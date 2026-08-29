"""
Live FIRMS ingestion — inserts raw detections into the current `hotspots`
table shape (case_id/case_type/lat/lon + whatever fields a single live
detection can populate). Most of the historical/OSM-context columns will
be NULL for these rows — that enrichment only ran once, offline, on the
original 20 cases. This script proves live ingestion works; it does not
attempt to replicate the full historical/OSM pipeline per-row (out of
scope given the time left).

Run from repo root:
    python backend/ingestion/live_firms_pull.py
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

            # FIRMS gives acq_time as e.g. "707" meaning 07:07 UTC — zero-pad it
            time_str = str(int(row["acq_time"])).zfill(4)
            detected_at = f"{row['acq_date']} {time_str[:2]}:{time_str[2:]}:00"

            conn.execute(
                text("""
                    INSERT INTO hotspots (
                        case_id, case_type, latitude, longitude, geometry,
                        timestamp,
                        mean_frp, max_frp, context_type,
                        has_osm_context, specific_facility_identified,
                        historical_data_available, geospatial_review_status
                    ) VALUES (
                        :case_id, 'live', :lat, :lon,
                        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                        :detected_at,
                        :frp, :frp, 'unknown',
                        false, false,
                        false, 'requires_geospatial_review'
                    )
                """),
                {
                    "case_id": case_id,
                    "lat": row["latitude"],
                    "lon": row["longitude"],
                    "detected_at": detected_at,
                    "frp": row.get("frp"),
                },
            )
            inserted += 1
    return inserted


if __name__ == "__main__":
    raw_csv = fetch_firms_csv()
    df = pd.read_csv(io.StringIO(raw_csv))
    print(f"Fetched {len(df)} live rows from FIRMS")

    engine = get_engine()
    count = insert_live_hotspots(df, engine)
    print(f"Inserted {count} live hotspots (case_type='live', minimal fields)")
