import csv
import psycopg2


CSV_FILE = "/app/dataset/pyroclass_20_sites_geospatial_final.csv"

DB_CONFIG = {
    "host": "postgres",
    "port": 5432,
    "database": "pyroclass",
    "user": "pyroclass",
    "password": "pyroclass123",
}


def to_float(value):
    return float(value) if value not in ("", None) else None


def to_int(value):
    return int(float(value)) if value not in ("", None) else None


def to_bool(value):
    if value in ("", None):
        return None
    return value.strip().lower() == "true"


def main():
    print(f"Loading dataset: {CSV_FILE}")

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    with open(CSV_FILE, "r", encoding="utf-8") as file:
        reader = csv.DictReader(file)

        count = 0

        for row in reader:
            data = {
                "case_id": row["case_id"],
                "case_type": row["case_type"],
                "latitude": to_float(row["latitude"]),
                "longitude": to_float(row["longitude"]),
                "h3_cell": row["h3_cell"],

                "n": to_float(row["n"]),
                "active_days": to_float(row["active_days"]),

                "mean_frp": to_float(row["mean_frp"]),
                "median_frp": to_float(row["median_frp"]),
                "max_frp": to_float(row["max_frp"]),

                "year_2022": to_float(row["2022"]),
                "year_2023": to_float(row["2023"]),
                "year_2024": to_float(row["2024"]),

                "base_monthly": to_float(row["base_monthly"]),
                "cur_monthly": to_float(row["cur_monthly"]),

                "count_ratio": to_float(row["count_ratio"]),
                "p95_ratio": to_float(row["p95_ratio"]),
                "spike_score": to_float(row["spike_score"]),

                "context_type": row["context_type"],
                "context_confidence": to_float(row["context_confidence"]),

                "facility_name": row["facility_name"],
                "facility_type": row["facility_type"],
                "facility_distance_m": to_float(row["facility_distance_m"]),

                "industrial_context_score": to_float(
                    row["industrial_context_score"]
                ),
                "mining_context_score": to_float(
                    row["mining_context_score"]
                ),

                "industrial_polygon_overlap_osm": to_bool(
                    row["industrial_polygon_overlap_osm"]
                ),
                "mining_polygon_overlap": to_bool(
                    row["mining_polygon_overlap"]
                ),
                "forest_polygon_overlap": to_bool(
                    row["forest_polygon_overlap"]
                ),
                "agriculture_polygon_overlap": to_bool(
                    row["agriculture_polygon_overlap"]
                ),

                "industrial_features_found": to_int(
                    row["industrial_features_found"]
                ),
                "mining_features_found": to_int(
                    row["mining_features_found"]
                ),
                "forest_features_found": to_int(
                    row["forest_features_found"]
                ),
                "agriculture_features_found": to_int(
                    row["agriculture_features_found"]
                ),

                "nearest_industrial_name": row["nearest_industrial_name"],
                "nearest_industrial_type": row["nearest_industrial_type"],
                "nearest_industrial_distance_m": to_float(
                    row["nearest_industrial_distance_m"]
                ),

                "nearest_mining_name": row["nearest_mining_name"],
                "nearest_mining_distance_m": to_float(
                    row["nearest_mining_distance_m"]
                ),

                "vegetation_context": row["vegetation_context"],
                "agriculture_context": row["agriculture_context"],

                "context_evidence_osm": row["context_evidence_osm"],

                "osm_elements": to_int(row["osm_elements"]),
                "osm_source_osm": row["osm_source_osm"],

                "has_osm_context": to_bool(row["has_osm_context"]),
                "specific_facility_identified": to_bool(
                    row["specific_facility_identified"]
                ),
                "historical_data_available": to_bool(
                    row["historical_data_available"]
                ),

                "geospatial_review_status": row["geospatial_review_status"],
            }

            cur.execute(
                """
                INSERT INTO hotspots (
                    case_id,
                    case_type,
                    latitude,
                    longitude,
                    geometry,
                    timestamp,
                    h3_cell,
                    n,
                    active_days,
                    mean_frp,
                    median_frp,
                    max_frp,
                    year_2022,
                    year_2023,
                    year_2024,
                    base_monthly,
                    cur_monthly,
                    count_ratio,
                    p95_ratio,
                    spike_score,
                    context_type,
                    context_confidence,
                    facility_name,
                    facility_type,
                    facility_distance_m,
                    industrial_context_score,
                    mining_context_score,
                    industrial_polygon_overlap_osm,
                    mining_polygon_overlap,
                    forest_polygon_overlap,
                    agriculture_polygon_overlap,
                    industrial_features_found,
                    mining_features_found,
                    forest_features_found,
                    agriculture_features_found,
                    nearest_industrial_name,
                    nearest_industrial_type,
                    nearest_industrial_distance_m,
                    nearest_mining_name,
                    nearest_mining_distance_m,
                    vegetation_context,
                    agriculture_context,
                    context_evidence_osm,
                    osm_elements,
                    osm_source_osm,
                    has_osm_context,
                    specific_facility_identified,
                    historical_data_available,
                    geospatial_review_status
                )
                VALUES (
                    %(case_id)s,
                    %(case_type)s,
                    %(latitude)s,
                    %(longitude)s,
                    ST_SetSRID(
                        ST_MakePoint(
                            %(longitude)s,
                            %(latitude)s
                        ),
                        4326
                    ),
                    CURRENT_TIMESTAMP,
                    %(h3_cell)s,
                    %(n)s,
                    %(active_days)s,
                    %(mean_frp)s,
                    %(median_frp)s,
                    %(max_frp)s,
                    %(year_2022)s,
                    %(year_2023)s,
                    %(year_2024)s,
                    %(base_monthly)s,
                    %(cur_monthly)s,
                    %(count_ratio)s,
                    %(p95_ratio)s,
                    %(spike_score)s,
                    %(context_type)s,
                    %(context_confidence)s,
                    %(facility_name)s,
                    %(facility_type)s,
                    %(facility_distance_m)s,
                    %(industrial_context_score)s,
                    %(mining_context_score)s,
                    %(industrial_polygon_overlap_osm)s,
                    %(mining_polygon_overlap)s,
                    %(forest_polygon_overlap)s,
                    %(agriculture_polygon_overlap)s,
                    %(industrial_features_found)s,
                    %(mining_features_found)s,
                    %(forest_features_found)s,
                    %(agriculture_features_found)s,
                    %(nearest_industrial_name)s,
                    %(nearest_industrial_type)s,
                    %(nearest_industrial_distance_m)s,
                    %(nearest_mining_name)s,
                    %(nearest_mining_distance_m)s,
                    %(vegetation_context)s,
                    %(agriculture_context)s,
                    %(context_evidence_osm)s,
                    %(osm_elements)s,
                    %(osm_source_osm)s,
                    %(has_osm_context)s,
                    %(specific_facility_identified)s,
                    %(historical_data_available)s,
                    %(geospatial_review_status)s
                )
                """,
                data,
            )

            count += 1

    conn.commit()

    cur.close()
    conn.close()

    print(f"Successfully loaded {count} hotspot records.")


if __name__ == "__main__":
    main()