import os
import requests
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")

DB_USER = os.getenv("POSTGRES_USER", "pyroclass")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "pyroclass123")
DB_NAME = os.getenv("POSTGRES_DB", "pyroclass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"

# Western India:
# south, west, north, east
BBOX = "15,68,28.5,78"


def get_engine():
    return create_engine(
        f"postgresql://{DB_USER}:{DB_PASS}@"
        f"{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )


def fetch_osm_facilities():
    query = f"""
    [out:json][timeout:60];

    (
      nwr["industrial"="refinery"]({BBOX});
      nwr["industrial"="steelworks"]({BBOX});
      nwr["industrial"="chemical"]({BBOX});
      nwr["industrial"="cement"]({BBOX});
      nwr["industrial"="oil"]({BBOX});
      nwr["industrial"="gas"]({BBOX});

      nwr["power"="plant"]({BBOX});
    );

    out center tags;
    """

    headers = {
        "User-Agent": "PyroClass/1.0",
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    response = requests.post(
        OVERPASS_URL,
        data={"data": query},
        headers=headers,
        timeout=90,
    )

    response.raise_for_status()

    return response.json()["elements"]


def get_coordinates(element):
    if element["type"] == "node":
        return element.get("lat"), element.get("lon")

    center = element.get("center")

    if center:
        return center.get("lat"), center.get("lon")

    return None, None


def classify_facility(tags):
    industrial = tags.get("industrial", "").lower()
    power = tags.get("power", "").lower()

    if industrial == "refinery":
        return "refinery"

    if industrial == "steelworks":
        return "steel"

    if industrial in {"oil", "gas"}:
        return "lng_terminal"

    if industrial == "cement":
        return "cement"

    if industrial == "chemical":
        return "chemical"

    if power == "plant":
        return "power_plant"

    return "industrial"


def insert_facilities(elements, engine):
    inserted = 0

    with engine.begin() as conn:
        for element in elements:
            tags = element.get("tags", {})

            name = tags.get("name")

            # Ignore unnamed OSM objects.
            if not name:
                continue

            latitude, longitude = get_coordinates(element)

            if latitude is None or longitude is None:
                continue

            osm_id = f"{element['type']}/{element['id']}"
            facility_type = classify_facility(tags)

            existing = conn.execute(
                text("""
                    SELECT 1
                    FROM industrial_facilities
                    WHERE osm_id = :osm_id
                    LIMIT 1;
                """),
                {"osm_id": osm_id},
            ).fetchone()

            if existing:
                continue

            conn.execute(
                text("""
                    INSERT INTO industrial_facilities (
                        name,
                        facility_type,
                        latitude,
                        longitude,
                        geometry,
                        osm_id,
                        operator,
                        source
                    )
                    VALUES (
                        :name,
                        :facility_type,
                        :latitude,
                        :longitude,
                        ST_SetSRID(
                            ST_MakePoint(
                                :longitude,
                                :latitude
                            ),
                            4326
                        ),
                        :osm_id,
                        :operator,
                        'OSM'
                    );
                """),
                {
                    "name": name,
                    "facility_type": facility_type,
                    "latitude": latitude,
                    "longitude": longitude,
                    "osm_id": osm_id,
                    "operator": tags.get("operator"),
                },
            )

            inserted += 1

    return inserted


def rematch_hotspots(engine):
    with engine.begin() as conn:
        result = conn.execute(
            text("""
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
                        ST_Distance(
                            h2.geometry::geography,
                            f.geometry::geography
                        ) AS distance_m
                    FROM hotspots h2
                    JOIN LATERAL (
                        SELECT
                            f.name,
                            f.facility_type,
                            f.geometry
                        FROM industrial_facilities f
                        WHERE ST_DWithin(
                            h2.geometry::geography,
                            f.geometry::geography,
                            CASE f.facility_type
                                WHEN 'refinery' THEN 5000
                                WHEN 'steel' THEN 4000
                                WHEN 'power_plant' THEN 3000
                                WHEN 'lng_terminal' THEN 1500
                                WHEN 'mining_quarry' THEN 3000
                                ELSE 2000
                            END
                        )
                        ORDER BY h2.geometry <-> f.geometry
                        LIMIT 1
                    ) f ON true
                ) nearest
                WHERE h.hotspot_id = nearest.hotspot_id;
            """)
        )

        return result.rowcount


def main():
    print("Fetching real OSM facilities for Western India...")

    elements = fetch_osm_facilities()

    print(f"Received {len(elements)} OSM objects")

    engine = get_engine()

    inserted = insert_facilities(
        elements,
        engine,
    )

    print(f"Inserted {inserted} new OSM facilities")

    matched = rematch_hotspots(engine)

    print(f"Matched {matched} hotspots to facilities")

    with engine.connect() as conn:
        count = conn.execute(
            text("""
                SELECT COUNT(*)
                FROM industrial_facilities;
            """)
        ).scalar()

    print(f"Total facilities in database: {count}")


if __name__ == "__main__":
    main()