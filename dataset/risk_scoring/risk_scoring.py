"""
PyroClass - Spatial Analytics: Risk Score (v3)
=================================================
Extends v2 (resolved OSM schema, spike_score-based risk score) with:

    1. Year-over-year TREND feature (2022/2023/2024 yearly counts) -
       catches slow-building activity change, independent of the
       monthly spike_score signal.
    2. RISK TIER bucket (Low/Medium/High/Critical) - for Chris's
       frontend to render badges/colors without parsing raw scores.
    3. CROWDSOURCE CORROBORATION (SmokeSignal) - mocked confirmation
       data for the prototype demo. Boosts risk_score when nearby
       users confirm a hotspot; does NOT penalize sites with zero
       reports (absence of a report is not evidence of absence,
       especially at remote sites with few nearby people).
    4. CONFIDENCE PROBABILITY breakdown - expresses each site as a
       probability distribution across {persistent_industrial,
       escalating, unclassified} instead of one flat risk number.

v2's core logic (spike_score, context handling, unknown != negative,
proximity stub) is UNCHANGED below - only additive features on top.
"""

import pandas as pd
import numpy as np


# ============================================================
# v2 core (unchanged) - see risk_scoring_v2.py for full comments
# ============================================================

def load_final_dataset(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {
        "case_id", "case_type", "mean_frp", "max_frp", "spike_score",
        "context_type", "context_confidence",
        "industrial_context_score", "mining_context_score",
        "industrial_polygon_overlap_osm", "mining_polygon_overlap",
        "forest_polygon_overlap", "agriculture_polygon_overlap",
        "nearest_industrial_distance_m", "nearest_mining_distance_m",
        "geospatial_review_status", "2022", "2023", "2024",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Input CSV missing expected columns: {missing}")
    return df


def resolve_proximity(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["resolved_distance_m"] = np.where(
        df["context_type"] == "mining_quarry",
        df["nearest_mining_distance_m"],
        df["nearest_industrial_distance_m"],
    )
    df["has_distance_data"] = df["resolved_distance_m"].notna()
    return df


def compute_base_risk_score(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    spike_component = np.clip(df["spike_score"].fillna(0) * 50, 0, 100)
    frp_component = np.clip((df["mean_frp"] / df["mean_frp"].max()) * 100, 0, 100)

    has_confident_context = df["context_type"] != "unknown"
    context_score_raw = np.where(
        df["context_type"] == "mining_quarry",
        df["mining_context_score"], df["industrial_context_score"],
    )
    context_component = np.where(
        has_confident_context,
        np.clip(pd.Series(context_score_raw, index=df.index).fillna(0) * 100, 0, 100),
        0,
    )
    overlap_component = np.where(
        df["industrial_polygon_overlap_osm"] | df["mining_polygon_overlap"], 100, 0,
    )
    proximity_component = np.where(
        df["has_distance_data"],
        np.clip(100 - (df["resolved_distance_m"].fillna(9999) / 20), 0, 100),
        0,
    )

    weights = pd.DataFrame(index=df.index)
    weights["spike"] = 0.35
    weights["frp"] = 0.20
    weights["context"] = np.where(has_confident_context, 0.20, 0.0)
    weights["overlap"] = 0.10
    weights["proximity"] = np.where(df["has_distance_data"], 0.15, 0.0)
    unused = (0.20 - weights["context"]) + (0.15 - weights["proximity"])
    weights["spike"] += unused * (0.35 / 0.55)
    weights["frp"] += unused * (0.20 / 0.55)

    df["base_risk_score"] = (
        weights["spike"] * spike_component + weights["frp"] * frp_component
        + weights["context"] * context_component + weights["overlap"] * overlap_component
        + weights["proximity"] * proximity_component
    ).round(1)

    df["has_confident_context"] = has_confident_context
    df["_spike_component"] = spike_component  # kept internally for the probability breakdown
    df["_context_component"] = context_component
    return df


# ============================================================
# NEW 1: Year-over-year trend
# ============================================================

def compute_trend(df: pd.DataFrame) -> pd.DataFrame:
    """Simple year-over-year trend from the 2022/2023/2024 yearly
    counts already in the dataset. Distinct signal from spike_score
    (which is monthly, recent-vs-baseline) - this instead catches a
    location that's been *gradually* ramping up over years, which a
    monthly ratio could miss if the ramp is slow enough that no single
    month looks anomalous yet.

    trend_ratio = 2024 count / average(2022, 2023) count
        > 1.15  -> "increasing"
        0.85-1.15 -> "stable"
        < 0.85  -> "decreasing"
    Guards against divide-by-zero for sites with no early-year activity.
    """
    df = df.copy()
    early_avg = (df["2022"] + df["2023"]) / 2
    df["trend_ratio"] = np.where(
        early_avg > 0, df["2024"] / early_avg.replace(0, np.nan), np.nan,
    )

    def label(r):
        if pd.isna(r):
            return "insufficient_data"
        if r > 1.15:
            return "increasing"
        if r < 0.85:
            return "decreasing"
        return "stable"

    df["trend_label"] = df["trend_ratio"].apply(label)
    return df


# ============================================================
# NEW 2: Risk tier bucket
# ============================================================

def compute_risk_tier(risk_score: float) -> str:
    if risk_score >= 80:
        return "Critical"
    if risk_score >= 60:
        return "High"
    if risk_score >= 40:
        return "Medium"
    return "Low"


# ============================================================
# NEW 3: Crowdsource corroboration (SmokeSignal) - MOCKED for demo
# ============================================================

# Simulated nearby-user confirmations for the prototype. In production
# this comes from the SmokeSignal app backend (GPS + optional photo,
# per the verification design discussed earlier) - for this internal
# demo we hardcode a few plausible reports so the risk-score boost is
# visibly demoable without needing live users.
MOCK_CROWDSOURCE_REPORTS = {
    "CASE_14": [
        {"confirmed": True, "distance_km": 1.2, "user_trust": 0.8},
        {"confirmed": True, "distance_km": 3.4, "user_trust": 0.6},
        {"confirmed": True, "distance_km": 0.9, "user_trust": 0.9},
    ],
    "CASE_11": [
        {"confirmed": True, "distance_km": 2.1, "user_trust": 0.5},
    ],
    "CASE_02": [
        {"confirmed": False, "distance_km": 4.5, "user_trust": 0.7},
    ],
    # every other case: no reports yet (real scenario for remote sites)
}


def compute_corroboration_score(case_id: str) -> dict:
    """Returns {score: 0-1, report_count, note}. A single report is
    weak; multiple independent confirmations weighted by trust and
    penalized slightly by distance (farther confirmations are weaker
    evidence) push the score up. Zero reports -> score 0, but this is
    explicitly NOT treated as evidence of "no fire" - see explainability.
    """
    reports = MOCK_CROWDSOURCE_REPORTS.get(case_id, [])
    if not reports:
        return {"score": 0.0, "report_count": 0, "confirmed_count": 0}

    confirmed = [r for r in reports if r["confirmed"]]
    if not confirmed:
        # reports exist but say "no, nothing visible" - this is a real
        # signal too (could indicate false positive), tracked separately
        return {"score": 0.0, "report_count": len(reports), "confirmed_count": 0}

    weighted = sum(r["user_trust"] * max(0.2, 1 - r["distance_km"] / 10) for r in confirmed)
    score = min(1.0, weighted / 2.0)  # 2+ good confirmations saturates near 1.0
    return {"score": round(score, 2), "report_count": len(reports), "confirmed_count": len(confirmed)}


def apply_corroboration(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    corrob = df["case_id"].apply(compute_corroboration_score)
    df["corroboration_score"] = corrob.apply(lambda d: d["score"])
    df["corroboration_report_count"] = corrob.apply(lambda d: d["report_count"])
    df["corroboration_confirmed_count"] = corrob.apply(lambda d: d["confirmed_count"])

    # corroboration boosts risk_score up to +15 points, on top of base_risk_score.
    # It never REDUCES the score for zero reports - absence of a report from a
    # remote/unpopulated area says nothing about whether the hotspot is real.
    df["risk_score"] = np.clip(
        df["base_risk_score"] + df["corroboration_score"] * 15, 0, 100
    ).round(1)
    return df


# ============================================================
# NEW 4: Confidence probability breakdown
# ============================================================

def compute_probability_breakdown(row: pd.Series) -> dict:
    """Expresses the site as a probability distribution across three
    categories instead of one flat score. Heuristic, not a trained
    model - Armaan's XGBoost model is the eventual real version of
    this; this is a transparent, explainable stand-in for the demo.
    """
    escalation = np.clip(row["_spike_component"] / 100, 0, 1)
    industrial = np.clip(row["_context_component"] / 100, 0, 1) * (1 - escalation)
    unclassified = max(0, 1 - escalation - industrial)

    total = escalation + industrial + unclassified
    if total == 0:
        escalation, industrial, unclassified = 0, 0, 1
        total = 1

    return {
        "escalating": round(escalation / total, 2),
        "persistent_industrial": round(industrial / total, 2),
        "unclassified": round(unclassified / total, 2),
    }


# ============================================================
# Explainability (extended with trend + corroboration)
# ============================================================

def build_explainability(row: pd.Series) -> dict:
    factors = {
        "spike_score": round(row["spike_score"], 3) if pd.notna(row["spike_score"]) else None,
        "mean_frp_mw": round(row["mean_frp"], 2),
        "trend": row["trend_label"],
    }

    if row["has_confident_context"]:
        factors["context_type"] = row["context_type"]
        factors["context_confidence"] = round(row["context_confidence"], 2)
    else:
        factors["context_note"] = (
            "No confident OSM context identified within search radius - "
            "treated as missing evidence, not as 'non-industrial'"
        )

    if row["industrial_polygon_overlap_osm"] or row["mining_polygon_overlap"]:
        factors["polygon_overlap_note"] = (
            "Hotspot overlaps an OSM industrial/mining land-use polygon"
        )

    if row["has_distance_data"]:
        factors["nearest_distance_m"] = round(row["resolved_distance_m"], 1)
    else:
        factors["proximity_note"] = "Distance data not yet available (pending fix - flagged to team)"

    if row["corroboration_report_count"] > 0:
        factors["crowdsource_note"] = (
            f"{row['corroboration_confirmed_count']}/{row['corroboration_report_count']} "
            f"nearby reports confirmed activity (corroboration score {row['corroboration_score']})"
        )
    else:
        factors["crowdsource_note"] = "No community reports yet - absence is not evidence of absence"

    factors["probability_breakdown"] = row["probability_breakdown"]
    return factors


# ============================================================
# Orchestration
# ============================================================

def run(input_path: str) -> pd.DataFrame:
    df = load_final_dataset(input_path)
    df = resolve_proximity(df)
    df = compute_base_risk_score(df)
    df = compute_trend(df)
    df = apply_corroboration(df)
    df["risk_tier"] = df["risk_score"].apply(compute_risk_tier)
    df["probability_breakdown"] = df.apply(compute_probability_breakdown, axis=1)
    df["explainability"] = df.apply(build_explainability, axis=1)
    return df


def export_csv(df: pd.DataFrame, path: str) -> None:
    df.to_csv(path, index=False)
    print(f"Saved CSV: {path}")


def export_json(df: pd.DataFrame, path: str) -> None:
    df.to_json(path, orient="records", indent=2)
    print(f"Saved JSON: {path}")


if __name__ == "__main__":
    INPUT_PATH = "/pyroclass_20_sites_geospatial_final.csv"  # <-- change to your local path
    CSV_OUTPUT_PATH = "pyroclass_20_sites_risk_scored.csv"
    JSON_OUTPUT_PATH = "pyroclass_20_sites_risk_scored.json"

    result = run(INPUT_PATH)

    print("=== Risk scores + tier + trend + corroboration (sorted, highest first) ===")
    print(
        result[["case_id", "case_type", "base_risk_score", "corroboration_score",
                 "risk_score", "risk_tier", "trend_label"]]
        .sort_values("risk_score", ascending=False)
        .to_string(index=False)
    )

    print("\n=== Explainability: a site WITH crowdsource confirmation (CASE_14) ===")
    row = result[result["case_id"] == "CASE_14"].iloc[0]
    for k, v in row["explainability"].items():
        print(f"  {k}: {v}")

    print("\n=== Explainability: a site with NO reports (CASE_09) ===")
    row = result[result["case_id"] == "CASE_09"].iloc[0]
    for k, v in row["explainability"].items():
        print(f"  {k}: {v}")

    print()
    export_csv(result, CSV_OUTPUT_PATH)
    export_json(result, JSON_OUTPUT_PATH)