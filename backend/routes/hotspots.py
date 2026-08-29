from fastapi import APIRouter
from database.connection import get_connection


router = APIRouter(prefix="/hotspots", tags=["Hotspots"])


@router.get("/")
def get_hotspots():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            hotspot_id,
            case_id,
            case_type,
            latitude,
            longitude,
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
        FROM hotspots
        ORDER BY hotspot_id;
        """
    )

    rows = cur.fetchall()

    columns = [
        "hotspot_id",
        "case_id",
        "case_type",
        "latitude",
        "longitude",
        "h3_cell",
        "n",
        "active_days",
        "mean_frp",
        "median_frp",
        "max_frp",
        "year_2022",
        "year_2023",
        "year_2024",
        "base_monthly",
        "cur_monthly",
        "count_ratio",
        "p95_ratio",
        "spike_score",
        "context_type",
        "context_confidence",
        "facility_name",
        "facility_type",
        "facility_distance_m",
        "industrial_context_score",
        "mining_context_score",
        "industrial_polygon_overlap_osm",
        "mining_polygon_overlap",
        "forest_polygon_overlap",
        "agriculture_polygon_overlap",
        "industrial_features_found",
        "mining_features_found",
        "forest_features_found",
        "agriculture_features_found",
        "nearest_industrial_name",
        "nearest_industrial_type",
        "nearest_industrial_distance_m",
        "nearest_mining_name",
        "nearest_mining_distance_m",
        "vegetation_context",
        "agriculture_context",
        "context_evidence_osm",
        "osm_elements",
        "osm_source_osm",
        "has_osm_context",
        "specific_facility_identified",
        "historical_data_available",
        "geospatial_review_status",
    ]

    cur.close()
    conn.close()

    return [
        dict(zip(columns, row))
        for row in rows
    ]
@router.get("/{hotspot_id}")
def get_hotspot(hotspot_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            hotspot_id,
            case_id,
            case_type,
            latitude,
            longitude,
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
        FROM hotspots
        WHERE hotspot_id = %s;
        """,
        (hotspot_id,),
    )

    row = cur.fetchone()

    cur.close()
    conn.close()

    if row is None:
        return {
            "error": "Hotspot not found",
            "hotspot_id": hotspot_id
        }

    columns = [
        "hotspot_id",
        "case_id",
        "case_type",
        "latitude",
        "longitude",
        "h3_cell",
        "n",
        "active_days",
        "mean_frp",
        "median_frp",
        "max_frp",
        "year_2022",
        "year_2023",
        "year_2024",
        "base_monthly",
        "cur_monthly",
        "count_ratio",
        "p95_ratio",
        "spike_score",
        "context_type",
        "context_confidence",
        "facility_name",
        "facility_type",
        "facility_distance_m",
        "industrial_context_score",
        "mining_context_score",
        "industrial_polygon_overlap_osm",
        "mining_polygon_overlap",
        "forest_polygon_overlap",
        "agriculture_polygon_overlap",
        "industrial_features_found",
        "mining_features_found",
        "forest_features_found",
        "agriculture_features_found",
        "nearest_industrial_name",
        "nearest_industrial_type",
        "nearest_industrial_distance_m",
        "nearest_mining_name",
        "nearest_mining_distance_m",
        "vegetation_context",
        "agriculture_context",
        "context_evidence_osm",
        "osm_elements",
        "osm_source_osm",
        "has_osm_context",
        "specific_facility_identified",
        "historical_data_available",
        "geospatial_review_status",
    ]

    return dict(zip(columns, row))
@router.get("/{hotspot_id}/context")
def get_hotspot_context(hotspot_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            case_id,
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
            geospatial_review_status
        FROM hotspots
        WHERE hotspot_id = %s;
        """,
        (hotspot_id,),
    )

    row = cur.fetchone()

    cur.close()
    conn.close()

    if row is None:
        return {
            "error": "Hotspot not found",
            "hotspot_id": hotspot_id
        }

    columns = [
        "case_id",
        "context_type",
        "context_confidence",
        "facility_name",
        "facility_type",
        "facility_distance_m",
        "industrial_context_score",
        "mining_context_score",
        "industrial_polygon_overlap_osm",
        "mining_polygon_overlap",
        "forest_polygon_overlap",
        "agriculture_polygon_overlap",
        "industrial_features_found",
        "mining_features_found",
        "forest_features_found",
        "agriculture_features_found",
        "nearest_industrial_name",
        "nearest_industrial_type",
        "nearest_industrial_distance_m",
        "nearest_mining_name",
        "nearest_mining_distance_m",
        "vegetation_context",
        "agriculture_context",
        "context_evidence_osm",
        "osm_elements",
        "osm_source_osm",
        "has_osm_context",
        "specific_facility_identified",
        "geospatial_review_status",
    ]

    return dict(zip(columns, row))
@router.get("/{hotspot_id}/features")
def get_hotspot_features(hotspot_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            case_id,

            -- Thermal / activity features
            n,
            active_days,
            mean_frp,
            median_frp,
            max_frp,

            -- Historical features
            year_2022,
            year_2023,
            year_2024,
            historical_data_available,

            -- Anomaly features
            base_monthly,
            cur_monthly,
            count_ratio,
            p95_ratio,
            spike_score,

            -- Spatial/context features
            context_type,
            context_confidence,
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

            nearest_industrial_type,
            nearest_industrial_distance_m,
            nearest_mining_distance_m,

            vegetation_context,
            agriculture_context,

            has_osm_context,
            specific_facility_identified,
            geospatial_review_status

        FROM hotspots
        WHERE hotspot_id = %s;
        """,
        (hotspot_id,),
    )

    row = cur.fetchone()

    cur.close()
    conn.close()

    if row is None:
        return {
            "error": "Hotspot not found",
            "hotspot_id": hotspot_id
        }

    columns = [
        "case_id",

        "n",
        "active_days",
        "mean_frp",
        "median_frp",
        "max_frp",

        "year_2022",
        "year_2023",
        "year_2024",
        "historical_data_available",

        "base_monthly",
        "cur_monthly",
        "count_ratio",
        "p95_ratio",
        "spike_score",

        "context_type",
        "context_confidence",
        "facility_type",
        "facility_distance_m",

        "industrial_context_score",
        "mining_context_score",

        "industrial_polygon_overlap_osm",
        "mining_polygon_overlap",
        "forest_polygon_overlap",
        "agriculture_polygon_overlap",

        "industrial_features_found",
        "mining_features_found",
        "forest_features_found",
        "agriculture_features_found",

        "nearest_industrial_type",
        "nearest_industrial_distance_m",
        "nearest_mining_distance_m",

        "vegetation_context",
        "agriculture_context",

        "has_osm_context",
        "specific_facility_identified",
        "geospatial_review_status",
    ]

    return {
        "hotspot_id": hotspot_id,
        "features": dict(zip(columns, row))
    }