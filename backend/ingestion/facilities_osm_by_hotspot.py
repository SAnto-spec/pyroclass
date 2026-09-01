import os
import requests
import time
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")

DB_USER = os.getenv("POSTGRES_USER", "pyroclass")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "pyroclass123")
DB_NAME = os.getenv("POSTGRES_DB", "pyroclass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def get_engine():
    return create_engine(
        f"postgresql://{DB_USER}:{DB_PASS}@"
        f"{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

def fetch_osm_facilities(lat, lon):
    query = f"""
    [out:json][timeout:90];

    (
      way["landuse"="industrial"](around:30000,{lat},{lon});
      way["landuse"="quarry"](around:30000,{lat},{lon});
      way["man_made"="works"](around:30000,{lat},{lon});
      node["man_made"="works"](around:30000,{lat},{lon});
      way["industrial"](around:30000,{lat},{lon});
      node["industrial"](around:30000,{lat},{lon});
      way["power"="plant"](around:30000,{lat},{lon});
      node["power"="plant"](around:30000,{lat},{lon});
      node["man_made"="mineshaft"](around:30000,{lat},{lon});
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
        timeout=100,
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
    landuse = tags.get("landuse", "").lower()
    man_made = tags.get("man_made", "").lower()

    if industrial == "refinery" or industrial in {"oil", "petrochemical"}:
        return "refinery"
    if industrial == "steelworks" or industrial in {"steel", "metal"}:
        return "steel_plant"
    if industrial == "gas" or "lng" in industrial:
        return "lng_terminal"
    if industrial == "cement":
        return "cement"
    if industrial == "chemical" or "fertilizer" in industrial:
        return "chemical"
    if power == "plant":
        return "power_plant"
    if landuse == "quarry" or man_made == "mineshaft" or "mine" in industrial:
        return "mine"
    return "industrial"

def insert_facilities(elements, engine):
    inserted = 0
    with engine.begin() as conn:
        for element in elements:
            tags = element.get("tags", {})
            name = tags.get("name")
            if not name:
                continue

            latitude, longitude = get_coordinates(element)
            if latitude is None or longitude is None:
                continue

            osm_id = f"{element['type']}/{element['id']}"
            facility_type = classify_facility(tags)

            existing = conn.execute(
                text("SELECT 1 FROM industrial_facilities WHERE osm_id = :osm_id LIMIT 1"),
                {"osm_id": osm_id},
            ).fetchone()

            if existing:
                continue

            conn.execute(
                text("""
                    INSERT INTO industrial_facilities (
                        name, facility_type, latitude, longitude,
                        geometry, osm_id, operator, source
                    )
                    VALUES (
                        :name, :facility_type, :latitude, :longitude,
                        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326),
                        :osm_id, :operator, 'OSM'
                    )
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
                        h2.hotspot_id, f.name, f.facility_type,
                        ST_Distance(h2.geometry::geography, f.geometry::geography) AS distance_m
                    FROM hotspots h2
                    JOIN LATERAL (
                        SELECT f.name, f.facility_type, f.geometry
                        FROM industrial_facilities f
                        WHERE ST_DWithin(
                            h2.geometry::geography, f.geometry::geography,
                            CASE f.facility_type
                                WHEN 'refinery' THEN 5000
                                WHEN 'steel_plant' THEN 4000
                                WHEN 'power_plant' THEN 3000
                                WHEN 'lng_terminal' THEN 1500
                                WHEN 'mine' THEN 3000
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
    engine = get_engine()
    print("Finding clusters of hotspots...")
    
    with engine.connect() as conn:
        # Group hotspots into roughly 50km grid cells (0.5 degrees)
        rows = conn.execute(text("""
            SELECT 
                ROUND(AVG(latitude)::numeric * 2) / 2 as lat,
                ROUND(AVG(longitude)::numeric * 2) / 2 as lon
            FROM hotspots
            GROUP BY ROUND(latitude::numeric * 2), ROUND(longitude::numeric * 2)
        """)).fetchall()

    print(f"Found {len(rows)} distinct hotspot clusters.")
    
    total_elements = []
    for idx, (lat, lon) in enumerate(rows):
        print(f"Fetching cluster {idx+1}/{len(rows)}: ({lat}, {lon})")
        
        for attempt in range(3):
            try:
                elements = fetch_osm_facilities(lat, lon)
                total_elements.extend(elements)
                break
            except Exception as e:
                print(f"Attempt {attempt+1} failed: {e}")
                time.sleep(5)
                
        time.sleep(0.5)
        
    print(f"Received {len(total_elements)} total OSM objects")
    inserted = insert_facilities(total_elements, engine)
    print(f"Inserted {inserted} new OSM facilities")
    matched = rematch_hotspots(engine)
    print(f"Matched {matched} hotspots to facilities")

if __name__ == "__main__":
    main()
