from fastapi import APIRouter, HTTPException
from typing import Any, Dict
from database.connection import get_connection
from ml.features import build_features
from ml.inference import inference, CLASS_API_NAMES
import json


router = APIRouter(prefix="/classifications", tags=["Classifications"])


def calculate_anomaly_score(result: Dict[str, Any]) -> float:
    """
    Convert model confidence to the existing 0-100 anomaly score.
    """
    return float(result["confidence"] * 100.0)


def calculate_priority(confidence: float, predicted_class: str) -> str:
    """
    Map model confidence and class to priority.
    non_industrial should never be critical.
    """
    if predicted_class == "non_industrial":
        return "low"
        
    if predicted_class == "forest_fire":
        if confidence >= 0.90:
            return "critical"
        if confidence >= 0.75:
            return "high"
        return "medium"

    # Industrial anomalies
    if confidence >= 0.90:
        return "high"
    if confidence >= 0.75:
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
                bright_ti4,
                bright_ti5,
                scan,
                track,
                frp,
                acq_hour,
                thermal_difference,
                thermal_ratio,
                pixel_area,
                frp_per_pixel_area,
                detections_7d,
                detections_30d,
                active_days_90d,
                active_day_ratio_90d,
                frp_mean_90d,
                frp_ratio_to_90d_mean,
                time_since_previous_detection,
                distance_to_refinery,
                refinery_within_1km,
                refinery_within_5km,
                distance_to_power_plant,
                power_plant_within_1km,
                power_plant_within_5km,
                distance_to_industrial_works,
                industrial_works_within_1km,
                industrial_works_within_5km,
                distance_to_industrial_area,
                industrial_area_within_1km,
                industrial_area_within_5km,
                distance_to_quarry,
                quarry_within_1km,
                quarry_within_5km,
                distance_to_mine,
                mine_within_1km,
                mine_within_5km,
                distance_to_nearest_industrial,
                industrial_within_1km,
                industrial_within_5km,
                distance_to_forest,
                forest_within_1km,
                forest_within_5km,
                distance_to_farmland,
                farmland_within_1km,
                farmland_within_5km
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
            "bright_ti4",
            "bright_ti5",
            "scan",
            "track",
            "frp",
            "acq_hour",
            "thermal_difference",
            "thermal_ratio",
            "pixel_area",
            "frp_per_pixel_area",
            "detections_7d",
            "detections_30d",
            "active_days_90d",
            "active_day_ratio_90d",
            "frp_mean_90d",
            "frp_ratio_to_90d_mean",
            "time_since_previous_detection",
            "distance_to_refinery",
            "refinery_within_1km",
            "refinery_within_5km",
            "distance_to_power_plant",
            "power_plant_within_1km",
            "power_plant_within_5km",
            "distance_to_industrial_works",
            "industrial_works_within_1km",
            "industrial_works_within_5km",
            "distance_to_industrial_area",
            "industrial_area_within_1km",
            "industrial_area_within_5km",
            "distance_to_quarry",
            "quarry_within_1km",
            "quarry_within_5km",
            "distance_to_mine",
            "mine_within_1km",
            "mine_within_5km",
            "distance_to_nearest_industrial",
            "industrial_within_1km",
            "industrial_within_5km",
            "distance_to_forest",
            "forest_within_1km",
            "forest_within_5km",
            "distance_to_farmland",
            "farmland_within_1km",
            "farmland_within_5km"
        ]

        hotspot = dict(zip(columns, row))

        # ---------------------------------------------------------------
        # 2. Build the 48 model features
        # ---------------------------------------------------------------
        features = build_features(hotspot)

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

        # Get SHAP explanations if available
        top_explanatory_features = []
        if hasattr(inference, 'shap_explainer') and inference.shap_explainer:
            import pandas as pd
            import numpy as np
            row_df = pd.DataFrame(
                [[float(features.get(name, 0.0)) for name in inference.feature_names]],
                columns=inference.feature_names
            )
            shap_values = inference.shap_explainer(row_df)
            
            # Use the values for the predicted class
            predicted_idx = list(CLASS_API_NAMES.values()).index(predicted_class) if predicted_class in CLASS_API_NAMES.values() else 0
            # Depending on SHAP version, shap_values might be a list (per class) or a 3D array
            if isinstance(shap_values.values, list):
                class_shap = shap_values.values[predicted_idx][0]
            elif len(shap_values.values.shape) == 3:
                class_shap = shap_values.values[0, :, predicted_idx]
            else:
                class_shap = shap_values.values[0]

            feature_importance = [
                {"feature": fname, "importance": float(val), "value": float(row_df[fname].iloc[0])}
                for fname, val in zip(inference.feature_names, class_shap)
            ]
            feature_importance.sort(key=lambda x: abs(x["importance"]), reverse=True)
            top_explanatory_features = feature_importance[:5]

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
                json.dumps(top_explanatory_features),
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
            "top_explanatory_features": top_explanatory_features,
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