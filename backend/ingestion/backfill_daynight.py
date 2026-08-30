"""
Backfill daynight for live hotspot rows that predate the daynight column.

Rather than re-fetch from FIRMS (unreliable — that day's data window may
have already rolled past), this computes day/night directly from each
row's stored timestamp + coordinates using the `astral` library, which
calculates real sun position (sunrise/sunset) for a given place and time.

Install once: pip install astral

Run from repo root:
    python backend/ingestion/backfill_daynight.py
"""
import logging
import os

from astral import LocationInfo
from astral.sun import sun
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DB_USER = os.getenv("POSTGRES_USER", "pyroclass")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "pyroclass123")
DB_NAME = os.getenv("POSTGRES_DB", "pyroclass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")


def get_engine():
    url = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    return create_engine(url)


def compute_daynight(lat, lon, timestamp):
    """Returns 'D' or 'N' based on real sunrise/sunset for this place and time."""
    try:
        location = LocationInfo(latitude=lat, longitude=lon)
        s = sun(location.observer, date=timestamp.date())
        return "D" if s["sunrise"] <= timestamp.replace(tzinfo=s["sunrise"].tzinfo) <= s["sunset"] else "N"
    except Exception as e:
        log.warning(f"Could not compute daynight for ({lat}, {lon}, {timestamp}): {e}")
        return None


def backfill(engine):
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT hotspot_id, latitude, longitude, timestamp FROM hotspots WHERE daynight IS NULL AND case_type = 'live'")
        ).fetchall()

    log.info(f"Found {len(rows)} live rows missing daynight")

    updated, failed = 0, 0
    with engine.begin() as conn:
        for hotspot_id, lat, lon, timestamp in rows:
            daynight = compute_daynight(lat, lon, timestamp)
            if daynight is None:
                failed += 1
                continue

            conn.execute(
                text("UPDATE hotspots SET daynight = :daynight WHERE hotspot_id = :id"),
                {"daynight": daynight, "id": hotspot_id},
            )
            updated += 1

    return updated, failed


if __name__ == "__main__":
    engine = get_engine()
    updated, failed = backfill(engine)
    log.info(f"Done. Updated {updated}, failed {failed}.")
