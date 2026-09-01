from fastapi import APIRouter, HTTPException
from database.connection import get_connection


router = APIRouter(prefix="/hotspots", tags=["Hotspots"])


@router.get("/")
def get_hotspots():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            h.hotspot_id,
            h.case_id,
            COALESCE(c.predicted_class, h.case_type) AS case_type,
            h.latitude,
            h.longitude,
            h.timestamp,
            h.frp,
            h.bright_ti4,
            h.bright_ti5,
            COALESCE(c.confidence, h.confidence) AS confidence,
            h.firms_type,
            h.h3_cell,
            h.n,
            h.active_days,
            h.mean_frp,
            h.median_frp,
            h.max_frp,
            h.year_2022,
            h.year_2023,
            h.year_2024,
            h.base_monthly,
            h.cur_monthly,
            h.count_ratio,
            h.p95_ratio,
            h.spike_score,
            h.context_type,
            h.context_confidence,
            h.facility_name,
            h.facility_type,
            h.facility_distance_m,
            h.industrial_context_score,
            h.mining_context_score,
            h.industrial_polygon_overlap_osm,
            h.mining_polygon_overlap,
            h.forest_polygon_overlap,
            h.agriculture_polygon_overlap,
            h.industrial_features_found,
            h.mining_features_found,
            h.forest_features_found,
            h.agriculture_features_found,
            h.nearest_industrial_name,
            h.nearest_industrial_type,
            h.nearest_industrial_distance_m,
            h.nearest_mining_name,
            h.nearest_mining_distance_m,
            h.vegetation_context,
            h.agriculture_context,
            h.context_evidence_osm,
            h.osm_elements,
            h.osm_source_osm,
            h.has_osm_context,
            h.specific_facility_identified,
            h.historical_data_available,
            h.geospatial_review_status,
            c.priority_level
        FROM hotspots h
        LEFT JOIN (
            SELECT DISTINCT ON (hotspot_id) hotspot_id, predicted_class, confidence, priority_level
            FROM classifications
            ORDER BY hotspot_id, classified_at DESC
        ) c ON h.hotspot_id = c.hotspot_id
        ORDER BY h.hotspot_id;
        """
    )

    rows = cur.fetchall()

    columns = [
        "hotspot_id",
        "case_id",
        "case_type",
        "latitude",
        "longitude",
        "timestamp",
        "frp",
        "bright_ti4",
        "bright_ti5",
        "confidence",
        "firms_type",
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
        "priority_level",
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
            timestamp,
            frp,
            bright_ti4,
            bright_ti5,
            confidence,
            firms_type,
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
        raise HTTPException(
            status_code=404,
            detail=f"Hotspot {hotspot_id} not found"
        )

    columns = [
        "hotspot_id",
        "case_id",
        "case_type",
        "latitude",
        "longitude",
        "timestamp",
        "frp",
        "bright_ti4",
        "bright_ti5",
        "confidence",
        "firms_type",
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
            timestamp,
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
        raise HTTPException(
            status_code=404,
            detail=f"Hotspot {hotspot_id} not found"
        )

    columns = [
        "timestamp",
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
            timestamp,
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
        raise HTTPException(
            status_code=404,
            detail=f"Hotspot {hotspot_id} not found"
        )

    columns = [
        "timestamp",
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
        "features": dict(zip(columns, row)),
    }