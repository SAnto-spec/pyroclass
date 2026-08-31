from fastapi import APIRouter, HTTPException

from database.connection import get_connection
from services.risk_scoring import score_hotspot

router = APIRouter(prefix="/risk", tags=["Risk"])


HOTSPOT_COLUMNS = [
    "hotspot_id",
    "case_id",
    "case_type",
    "mean_frp",
    "max_frp",
    "spike_score",
    "context_type",
    "context_confidence",
    "industrial_context_score",
    "mining_context_score",
    "industrial_polygon_overlap_osm",
    "mining_polygon_overlap",
    "forest_polygon_overlap",
    "agriculture_polygon_overlap",
    "nearest_industrial_distance_m",
    "nearest_mining_distance_m",
    "year_2022",
    "year_2023",
    "year_2024",
]


@router.get("/{hotspot_id}")
def get_risk(hotspot_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            f"SELECT {', '.join(HOTSPOT_COLUMNS)} FROM hotspots WHERE hotspot_id = %s;",
            (hotspot_id,),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Hotspot {hotspot_id} not found")

        hotspot = dict(zip(HOTSPOT_COLUMNS, row))
        cur.execute(
            """
            SELECT predicted_class, confidence, anomaly_score, priority_level
            FROM classifications
            WHERE hotspot_id = %s
            ORDER BY classified_at DESC
            LIMIT 1;
            """,
            (hotspot_id,),
        )
        classification_row = cur.fetchone()
        classification = None
        if classification_row is not None:
            classification = dict(
                zip(
                    ["predicted_class", "confidence", "anomaly_score", "priority_level"],
                    classification_row,
                )
            )

        # Community reports are not persisted in the current backend schema.
        # An empty iterable preserves Dilpreet's zero-report behavior without mock data.
        return score_hotspot(hotspot, classification=classification, reports=())
    finally:
        cur.close()
        conn.close()
