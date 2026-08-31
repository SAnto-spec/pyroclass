from fastapi import APIRouter, HTTPException
from typing import Any, Dict
from database.connection import get_connection
from ml.features import build_features
from ml.inference import inference
import json


router = APIRouter(prefix="/classifications", tags=["Classifications"])


def calculate_anomaly_score(result: Dict[str, Any]) -> float:
    """
    Convert model confidence to the existing 0-100 anomaly score.
    """
    return float(result["confidence"] * 100.0)


def calculate_priority(confidence: float, predicted_class: str) -> str:
    """
    Map model confidence to the existing priority field.
    """
    if confidence >= 0.90:
        return "critical"
    if confidence >= 0.75:
        return "high"
    if confidence >= 0.50:
        return "medium"
    return "low"


def get_unknown_reason(predicted_class: str, confidence: float):
    if predicted_class == "unknown":
        return "Model classified hotspot as unknown."

    if confidence < 0.50:
        return "Low model confidence."

    return None


@router.post("/{hotspot_id}")
def create_classification(hotspot_id: int):
    """
    Run the current XGBoost model for a hotspot and store the result.
    """

    conn = get_connection()
    cur = conn.cursor()

    try:
        # ---------------------------------------------------------------
        # 0. Avoid duplicate classifications
        # ---------------------------------------------------------------
        cur.execute(
            """
            SELECT
                classification_id,
                hotspot_id,
                predicted_class,
                confidence,
                class_probabilities,
                anomaly_score,
                priority_level,
                unknown_reason,
                model_version,
                feature_version,
                top_explanatory_features
            FROM classifications
            WHERE hotspot_id = %s
            ORDER BY classified_at DESC
            LIMIT 1;
            """,
            (hotspot_id,),
        )

        existing = cur.fetchone()

        if existing is not None:
            return {
                "classification_id": existing[0],
                "hotspot_id": existing[1],
                "predicted_class": existing[2],
                "confidence": existing[3],
                "class_probabilities": existing[4],
                "anomaly_score": existing[5],
                "priority_level": existing[6],
                "unknown_reason": existing[7],
                "model_version": existing[8],
                "feature_version": existing[9],
                "top_explanatory_features": existing[10],
            }
        # ---------------------------------------------------------------
        # 1. Get hotspot
        # ---------------------------------------------------------------
        cur.execute(
            """
            SELECT
                hotspot_id,
                latitude,
                longitude,
                timestamp,
                frp,
                bright_ti4,
                bright_ti5,
                confidence,
                daynight,
                industrial_context_score,
                mining_context_score,
                industrial_polygon_overlap_osm,
                mining_polygon_overlap,
                forest_polygon_overlap,
                agriculture_polygon_overlap
            FROM hotspots
            WHERE hotspot_id = %s;
            """,
            (hotspot_id,),
        )

        row = cur.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Hotspot {hotspot_id} not found",
            )

        columns = [
            "hotspot_id",
            "latitude",
            "longitude",
            "timestamp",
            "frp",
            "bright_ti4",
            "bright_ti5",
            "confidence",
            "daynight",
            "industrial_context_score",
            "mining_context_score",
            "industrial_polygon_overlap_osm",
            "mining_polygon_overlap",
            "forest_polygon_overlap",
            "agriculture_polygon_overlap",
        ]

        hotspot = dict(zip(columns, row))

        # ---------------------------------------------------------------
        # 2. Build the 55 model features
        # ---------------------------------------------------------------
        features = build_features(hotspot)

        # Safety check before inference
        missing = [
            name
            for name in inference.feature_names
            if name not in features
        ]

        if missing:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Missing model features",
                    "missing": missing,
                },
            )

        # ---------------------------------------------------------------
        # 3. Run XGBoost
        # ---------------------------------------------------------------
        result = inference.predict(features)

        predicted_class = result["predicted_class"]
        confidence = float(result["confidence"])

        class_probabilities = result["class_probabilities"]

        anomaly_score = calculate_anomaly_score(result)

        priority_level = calculate_priority(
            confidence,
            predicted_class,
        )

        unknown_reason = get_unknown_reason(
            predicted_class,
            confidence,
        )

        model_version = inference.metadata.get(
            "model_version",
            "unknown",
        )

        feature_version = result.get(
            "feature_version"
        ) or inference.metadata.get(
            "feature_version",
            "unknown",
        )

        # ---------------------------------------------------------------
        # 4. Store classification
        # ---------------------------------------------------------------
        cur.execute(
            """
            INSERT INTO classifications (
                hotspot_id,
                predicted_class,
                confidence,
                anomaly_score,
                model_version,
                facility_id,
                class_probabilities,
                priority_level,
                unknown_reason,
                feature_version,
                top_explanatory_features
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING classification_id;
            """,
            (
                hotspot_id,
                predicted_class,
                confidence,
                anomaly_score,
                model_version,
                None,
                json.dumps(class_probabilities),
                priority_level,
                unknown_reason,
                feature_version,
                json.dumps([]),
            ),
        )

        classification_id = cur.fetchone()[0]

        conn.commit()

        return {
            "classification_id": classification_id,
            "hotspot_id": hotspot_id,
            "predicted_class": predicted_class,
            "confidence": confidence,
            "class_probabilities": class_probabilities,
            "anomaly_score": anomaly_score,
            "priority_level": priority_level,
            "unknown_reason": unknown_reason,
            "model_version": model_version,
            "feature_version": feature_version,
            "top_explanatory_features": [],
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Classification failed: {exc}",
        )

    finally:
        cur.close()
        conn.close()


@router.get("/{hotspot_id}")
def get_classification(hotspot_id: int):
    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            """
            SELECT
                hotspot_id,
                predicted_class,
                confidence,
                class_probabilities,
                anomaly_score,
                priority_level,
                unknown_reason,
                model_version,
                feature_version,
                top_explanatory_features
            FROM classifications
            WHERE hotspot_id = %s
            ORDER BY classified_at DESC
            LIMIT 1;
            """,
            (hotspot_id,),
        )

        row = cur.fetchone()

        if row is None:
            return {
                "error": "No classification found",
                "hotspot_id": hotspot_id,
            }

        columns = [
            "hotspot_id",
            "predicted_class",
            "confidence",
            "class_probabilities",
            "anomaly_score",
            "priority_level",
            "unknown_reason",
            "model_version",
            "feature_version",
            "top_explanatory_features",
        ]

        return dict(zip(columns, row))

    finally:
        cur.close()
        conn.close()