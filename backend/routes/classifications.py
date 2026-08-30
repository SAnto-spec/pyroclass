from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, List
from database.connection import get_connection
import json


router = APIRouter(prefix="/classifications", tags=["Classifications"])


class ExplanatoryFeature(BaseModel):
    feature: str
    value: float
    shap_contribution: float
    direction: str
    human_readable: str


class ClassificationInput(BaseModel):
    hotspot_id: int
    predicted_class: str
    confidence: float
    class_probabilities: Dict[str, float]
    anomaly_score: int
    priority_level: str
    unknown_reason: Optional[str] = None
    model_version: str
    feature_version: str
    top_explanatory_features: List[ExplanatoryFeature]
    facility_id: Optional[int] = None


@router.post("/")
def create_classification(payload: ClassificationInput):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO classifications (
            hotspot_id, classification, confidence, anomaly_score,
            model_version, facility_id, class_probabilities,
            priority_level, unknown_reason, feature_version,
            top_explanatory_features
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING classification_id;
        """,
        (
            payload.hotspot_id,
            payload.predicted_class,
            payload.confidence,
            payload.anomaly_score,
            payload.model_version,
            payload.facility_id,
            json.dumps(payload.class_probabilities),
            payload.priority_level,
            payload.unknown_reason,
            payload.feature_version,
            json.dumps([f.dict() for f in payload.top_explanatory_features]),
        ),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    return {"classification_id": new_id, "status": "created"}


@router.get("/{hotspot_id}")
def get_classification(hotspot_id: int):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT hotspot_id, classification AS predicted_class, confidence,
               class_probabilities, anomaly_score, priority_level,
               unknown_reason, model_version, feature_version,
               top_explanatory_features
        FROM classifications
        WHERE hotspot_id = %s
        ORDER BY classified_at DESC
        LIMIT 1;
        """,
        (hotspot_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row is None:
        return {"error": "No classification found", "hotspot_id": hotspot_id}

    columns = [
        "hotspot_id", "predicted_class", "confidence", "class_probabilities",
        "anomaly_score", "priority_level", "unknown_reason", "model_version",
        "feature_version", "top_explanatory_features",
    ]
    return dict(zip(columns, row))
