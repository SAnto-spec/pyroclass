from collections.abc import Iterable, Mapping
from typing import Any

import numpy as np
import pandas as pd


# Faithful single-hotspot adaptation of dataset/risk_scoring/risk_scoring.py.
def _frame_from_hotspot(hotspot: Mapping[str, Any]) -> pd.DataFrame:
    row = {
        "case_id": hotspot.get("case_id") or str(hotspot["hotspot_id"]),
        "case_type": hotspot.get("case_type"),
        "mean_frp": hotspot.get("mean_frp"),
        "max_frp": hotspot.get("max_frp"),
        "spike_score": hotspot.get("spike_score"),
        "context_type": hotspot.get("context_type") or "unknown",
        "context_confidence": hotspot.get("context_confidence"),
        "industrial_context_score": hotspot.get("industrial_context_score"),
        "mining_context_score": hotspot.get("mining_context_score"),
        "industrial_polygon_overlap_osm": bool(hotspot.get("industrial_polygon_overlap_osm")),
        "mining_polygon_overlap": bool(hotspot.get("mining_polygon_overlap")),
        "forest_polygon_overlap": bool(hotspot.get("forest_polygon_overlap")),
        "agriculture_polygon_overlap": bool(hotspot.get("agriculture_polygon_overlap")),
        "nearest_industrial_distance_m": hotspot.get("nearest_industrial_distance_m"),
        "nearest_mining_distance_m": hotspot.get("nearest_mining_distance_m"),
        "2022": hotspot.get("year_2022"),
        "2023": hotspot.get("year_2023"),
        "2024": hotspot.get("year_2024"),
    }
    return pd.DataFrame([row])


def _resolve_proximity(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    result["resolved_distance_m"] = np.where(
        result["context_type"] == "mining_quarry",
        result["nearest_mining_distance_m"],
        result["nearest_industrial_distance_m"],
    )
    result["has_distance_data"] = result["resolved_distance_m"].notna()
    return result


def _compute_base_risk_score(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    spike_component = np.clip(result["spike_score"].fillna(0) * 50, 0, 100)
    mean_frp = result["mean_frp"].fillna(0)
    frp_max = mean_frp.max()
    frp_component = np.clip((mean_frp / frp_max) * 100, 0, 100) if frp_max else mean_frp * 0

    has_confident_context = result["context_type"] != "unknown"
    context_score_raw = np.where(
        result["context_type"] == "mining_quarry",
        result["mining_context_score"],
        result["industrial_context_score"],
    )
    context_component = np.where(
        has_confident_context,
        np.clip(pd.Series(context_score_raw, index=result.index).fillna(0) * 100, 0, 100),
        0,
    )
    overlap_component = np.where(
        result["industrial_polygon_overlap_osm"] | result["mining_polygon_overlap"],
        100,
        0,
    )
    proximity_component = np.where(
        result["has_distance_data"],
        np.clip(100 - (result["resolved_distance_m"].fillna(9999) / 20), 0, 100),
        0,
    )

    weights = pd.DataFrame(index=result.index)
    weights["spike"] = 0.35
    weights["frp"] = 0.20
    weights["context"] = np.where(has_confident_context, 0.20, 0.0)
    weights["overlap"] = 0.10
    weights["proximity"] = np.where(result["has_distance_data"], 0.15, 0.0)
    unused = (0.20 - weights["context"]) + (0.15 - weights["proximity"])
    weights["spike"] += unused * (0.35 / 0.55)
    weights["frp"] += unused * (0.20 / 0.55)

    result["base_risk_score"] = (
        weights["spike"] * spike_component
        + weights["frp"] * frp_component
        + weights["context"] * context_component
        + weights["overlap"] * overlap_component
        + weights["proximity"] * proximity_component
    ).round(1)
    result["has_confident_context"] = has_confident_context
    result["_spike_component"] = spike_component
    result["_context_component"] = context_component
    return result


def _compute_trend(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    early_avg = (result["2022"] + result["2023"]) / 2
    result["trend_ratio"] = np.where(
        early_avg > 0,
        result["2024"] / early_avg.replace(0, np.nan),
        np.nan,
    )

    def label(value: Any) -> str:
        if pd.isna(value):
            return "insufficient_data"
        if value > 1.15:
            return "increasing"
        if value < 0.85:
            return "decreasing"
        return "stable"

    result["trend_label"] = result["trend_ratio"].apply(label)
    return result


def _compute_corroboration(reports: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    reports = list(reports)
    confirmed = [report for report in reports if report.get("confirmed")]
    if not confirmed:
        return {"score": 0.0, "report_count": len(reports), "confirmed_count": 0}

    weighted = sum(
        float(report.get("user_trust", 0.0))
        * max(0.2, 1 - float(report.get("distance_km", 0.0)) / 10)
        for report in confirmed
    )
    score = min(1.0, weighted / 2.0)
    return {
        "score": round(score, 2),
        "report_count": len(reports),
        "confirmed_count": len(confirmed),
    }


def _risk_tier(risk_score: float) -> str:
    if risk_score >= 80:
        return "Critical"
    if risk_score >= 60:
        return "High"
    if risk_score >= 40:
        return "Medium"
    return "Low"


def _probability_breakdown(row: pd.Series) -> dict[str, float]:
    escalation = np.clip(row["_spike_component"] / 100, 0, 1)
    industrial = np.clip(row["_context_component"] / 100, 0, 1) * (1 - escalation)
    unclassified = max(0, 1 - escalation - industrial)
    total = escalation + industrial + unclassified
    if total == 0:
        escalation, industrial, unclassified, total = 0, 0, 1, 1
    return {
        "escalating": round(float(escalation / total), 2),
        "persistent_industrial": round(float(industrial / total), 2),
        "unclassified": round(float(unclassified / total), 2),
    }


def _explain(row: pd.Series, classification: Mapping[str, Any] | None) -> dict[str, Any]:
    factors: dict[str, Any] = {
        "spike_score": round(float(row["spike_score"]), 3) if pd.notna(row["spike_score"]) else None,
        "mean_frp_mw": round(float(row["mean_frp"]), 2) if pd.notna(row["mean_frp"]) else 0.0,
        "trend": row["trend_label"],
    }
    if row["has_confident_context"]:
        factors["context_type"] = row["context_type"]
        factors["context_confidence"] = round(float(row["context_confidence"] or 0), 2)
    else:
        factors["context_note"] = "No confident OSM context identified within search radius - treated as missing evidence, not as 'non-industrial'"
    if row["industrial_polygon_overlap_osm"] or row["mining_polygon_overlap"]:
        factors["polygon_overlap_note"] = "Hotspot overlaps an OSM industrial/mining land-use polygon"
    if row["has_distance_data"]:
        factors["nearest_distance_m"] = round(float(row["resolved_distance_m"]), 1)
    else:
        factors["proximity_note"] = "Distance data not yet available (pending fix - flagged to team)"
    factors["crowdsource_note"] = "No community reports yet - absence is not evidence of absence"
    if classification:
        factors["model_classification"] = classification.get("predicted_class")
        factors["model_confidence"] = classification.get("confidence")
        factors["model_priority"] = classification.get("priority_level")
        factors["model_anomaly_score"] = classification.get("anomaly_score")
    factors["probability_breakdown"] = _probability_breakdown(row)
    return factors


def score_hotspot(
    hotspot: Mapping[str, Any],
    classification: Mapping[str, Any] | None = None,
    reports: Iterable[Mapping[str, Any]] = (),
) -> dict[str, Any]:
    frame = _compute_trend(_compute_base_risk_score(_resolve_proximity(_frame_from_hotspot(hotspot))))
    corroboration = _compute_corroboration(reports)
    risk_score = float(np.clip(frame.iloc[0]["base_risk_score"] + corroboration["score"] * 15, 0, 100).round(1))
    row = frame.iloc[0]
    probability = _probability_breakdown(row)
    explanation = _explain(row, classification)
    explanation["crowdsource_report_count"] = corroboration["report_count"]
    explanation["crowdsource_confirmed_count"] = corroboration["confirmed_count"]
    return {
        "hotspot_id": int(hotspot["hotspot_id"]),
        "risk_score": risk_score,
        "risk_tier": _risk_tier(risk_score),
        "probability_breakdown": probability,
        "risk_factors": explanation,
        "explanation": explanation,
    }
