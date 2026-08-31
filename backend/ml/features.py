from datetime import datetime, timedelta
from math import log1p, sin, cos, pi
from typing import Any, Dict, Optional

import numpy as np


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default

    try:
        value = float(value)
        if not np.isfinite(value):
            return default
        return value
    except (TypeError, ValueError):
        return default


def _safe_bool(value: Any) -> int:
    if value is None:
        return 0

    if isinstance(value, bool):
        return int(value)

    if isinstance(value, str):
        return int(value.lower() in {"true", "t", "1", "yes"})

    return int(bool(value))


def _parse_timestamp(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value

    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0

    value = numerator / denominator

    if not np.isfinite(value):
        return 0.0

    return float(value)


def _thermal_intensity_category(bright_ti4: Optional[float]) -> int:
    """
    Armaan's training-time definition:

        < 320       -> 0
        320-339.99  -> 1
        340-359.99  -> 2
        >= 360      -> 3
        NaN         -> -1
    """

    if bright_ti4 is None:
        return -1

    value = _safe_float(bright_ti4, np.nan)

    if not np.isfinite(value):
        return -1

    if value < 320:
        return 0
    if value < 340:
        return 1
    if value < 360:
        return 2

    return 3


def _frp_intensity_level(frp: Optional[float]) -> int:
    """
    Armaan's training-time definition:

        < 5        -> 0
        5-14.99    -> 1
        15-49.99   -> 2
        >= 50      -> 3
        NaN         -> -1
    """

    if frp is None:
        return -1

    value = _safe_float(frp, np.nan)

    if not np.isfinite(value):
        return -1

    if value < 5:
        return 0
    if value < 15:
        return 1
    if value < 50:
        return 2

    return 3


def calculate_missing_engineered_features(
    bright_ti4: Optional[float],
    bright_ti5: Optional[float],
    frp: Optional[float],
    active_days_90d: float,
    mean_frp_90d: float,
) -> Dict[str, float]:
    """
    Exact five engineered features supplied by Armaan.
    """

    ti4 = _safe_float(bright_ti4, np.nan)
    ti5 = _safe_float(bright_ti5, np.nan)
    current_frp = _safe_float(frp, np.nan)

    # 1. thermal_intensity_category
    thermal_intensity_category = _thermal_intensity_category(bright_ti4)

    # 2. frp_intensity_level
    frp_intensity_level = _frp_intensity_level(frp)

    # 3. thermal_signature = bright_ti4 - bright_ti5
    if np.isfinite(ti4) and np.isfinite(ti5):
        thermal_signature = float(ti4 - ti5)
    else:
        thermal_signature = 0.0

    # 4. frp_per_active_day
    active_days = max(_safe_float(active_days_90d), 0.0)
    if np.isfinite(current_frp):
        frp_per_active_day = float(current_frp / (active_days + 1.0))
    else:
        frp_per_active_day = 0.0

    # 5. frp_ratio_to_90d_mean
    baseline = _safe_float(mean_frp_90d)

    if baseline == 0 or not np.isfinite(current_frp):
        frp_ratio_to_90d_mean = 0.0
    else:
        frp_ratio_to_90d_mean = _safe_ratio(current_frp, baseline)

    return {
        "thermal_intensity_category": float(thermal_intensity_category),
        "frp_intensity_level": float(frp_intensity_level),
        "thermal_signature": thermal_signature,
        "frp_per_active_day": frp_per_active_day,
        "frp_ratio_to_90d_mean": frp_ratio_to_90d_mean,
    }


def build_features(
    hotspot: Dict[str, Any],
    history: Optional[Dict[str, Any]] = None,
) -> Dict[str, float]:
    """
    Build the complete feature dictionary expected by the current
    55-feature XGBoost model.

    `hotspot` contains the current hotspot/database values.

    `history` may contain precomputed H3 historical statistics.
    Missing historical values are represented using the same
    conventions used by the preprocessing pipeline.
    """

    history = history or {}

    timestamp = _parse_timestamp(hotspot["timestamp"])

    year = timestamp.year
    month = timestamp.month
    day_of_year = timestamp.timetuple().tm_yday
    day_of_week = timestamp.weekday()

    bright_ti4 = hotspot.get("bright_ti4")
    bright_ti5 = hotspot.get("bright_ti5")
    frp = hotspot.get("frp")

    ti4 = _safe_float(bright_ti4)
    ti5 = _safe_float(bright_ti5)
    current_frp = _safe_float(frp)

    # ------------------------------------------------------------------
    # Historical values
    # ------------------------------------------------------------------

    observation_count_7d = _safe_float(history.get("observation_count_7d"))
    observation_count_30d = _safe_float(history.get("observation_count_30d"))
    observation_count_90d = _safe_float(history.get("observation_count_90d"))

    active_days_7d = _safe_float(history.get("active_days_7d"))
    active_days_30d = _safe_float(history.get("active_days_30d"))
    active_days_90d = _safe_float(history.get("active_days_90d"))

    mean_frp_7d = _safe_float(history.get("mean_frp_7d"))
    mean_frp_30d = _safe_float(history.get("mean_frp_30d"))
    mean_frp_90d = _safe_float(history.get("mean_frp_90d"))

    median_frp_30d = _safe_float(history.get("median_frp_30d"))
    std_frp_30d = _safe_float(history.get("std_frp_30d"))
    max_frp_30d = _safe_float(history.get("max_frp_30d"))
    max_frp_90d = _safe_float(history.get("max_frp_90d"))

    days_since_first_seen = _safe_float(
        history.get("days_since_first_seen")
    )

    days_since_previous_detection = _safe_float(
        history.get("days_since_previous_detection"),
        -1.0,
    )

    has_history_7d = _safe_float(
        history.get("has_history_7d"),
        int(observation_count_7d > 0),
    )

    has_history_30d = _safe_float(
        history.get("has_history_30d"),
        int(observation_count_30d > 0),
    )

    has_history_90d = _safe_float(
        history.get("has_history_90d"),
        int(observation_count_90d > 0),
    )

    frp_deviation = _safe_float(history.get("frp_deviation"))
    frp_ratio_to_baseline = _safe_float(
        history.get("frp_ratio_to_baseline")
    )
    frp_z_score = _safe_float(history.get("frp_z_score"))

    # ------------------------------------------------------------------
    # Existing engineered features
    # ------------------------------------------------------------------

    bright_ratio = _safe_ratio(ti4, ti5) if ti5 != 0 else 0.0

    frp_per_pixel = _safe_ratio(
        current_frp,
        max(_safe_float(hotspot.get("scan"), 1.0), 1.0)
        * max(_safe_float(hotspot.get("track"), 1.0), 1.0),
    )

    thermal_anomaly_strength = abs(ti4 - ti5)

    forest_overlap = _safe_bool(
        hotspot.get("forest_polygon_overlap")
    )

    industrial_overlap = _safe_bool(
        hotspot.get("industrial_polygon_overlap_osm")
    )

    industrial_active = (
        industrial_overlap
        * int(active_days_90d > 0)
    )

    high_frp = int(current_frp >= 15)

    forest_and_high_frp = forest_overlap * high_frp

    previous_mean = mean_frp_90d

    if previous_mean > 0:
        frp_growth_rate = _safe_ratio(
            current_frp - previous_mean,
            previous_mean,
        )
    else:
        frp_growth_rate = 0.0

    if mean_frp_30d > 0:
        frp_consistency = _safe_ratio(
            median_frp_30d,
            mean_frp_30d,
        )
    else:
        frp_consistency = 0.0

    # ------------------------------------------------------------------
    # Exact five features from Armaan
    # ------------------------------------------------------------------

    missing_features = calculate_missing_engineered_features(
        bright_ti4=bright_ti4,
        bright_ti5=bright_ti5,
        frp=frp,
        active_days_90d=active_days_90d,
        mean_frp_90d=mean_frp_90d,
    )

    # ------------------------------------------------------------------
    # Complete model feature dictionary
    # ------------------------------------------------------------------

    features = {
        "year": float(year),
        "month": float(month),
        "day_of_year": float(day_of_year),
        "day_of_week": float(day_of_week),
        "is_night": float(
            _safe_bool(hotspot.get("is_night", hotspot.get("daynight") == "N"))
        ),
        "month_sin": float(sin(2 * pi * month / 12)),
        "month_cos": float(cos(2 * pi * month / 12)),

        "bright_ti4": ti4,
        "bright_ti5": ti5,
        "frp": current_frp,
        "confidence_encoded": _safe_float(
            hotspot.get("confidence_encoded"),
            _safe_float(hotspot.get("confidence")),
        ),
        "scan": _safe_float(hotspot.get("scan")),
        "track": _safe_float(hotspot.get("track")),
        "log_frp": float(log1p(max(current_frp, 0.0))),
        "thermal_difference": ti4 - ti5,

        "observation_count_7d": observation_count_7d,
        "observation_count_30d": observation_count_30d,
        "observation_count_90d": observation_count_90d,

        "active_days_7d": active_days_7d,
        "active_days_30d": active_days_30d,
        "active_days_90d": active_days_90d,

        "mean_frp_7d": mean_frp_7d,
        "mean_frp_30d": mean_frp_30d,
        "mean_frp_90d": mean_frp_90d,

        "median_frp_30d": median_frp_30d,
        "std_frp_30d": std_frp_30d,
        "max_frp_30d": max_frp_30d,
        "max_frp_90d": max_frp_90d,

        "days_since_first_seen": days_since_first_seen,
        "days_since_previous_detection": days_since_previous_detection,

        "has_history_7d": has_history_7d,
        "has_history_30d": has_history_30d,
        "has_history_90d": has_history_90d,

        "frp_deviation": frp_deviation,
        "frp_ratio_to_baseline": frp_ratio_to_baseline,
        "frp_z_score": frp_z_score,

        "industrial_context_score": _safe_float(
            hotspot.get("industrial_context_score")
        ),
        "mining_context_score": _safe_float(
            hotspot.get("mining_context_score")
        ),

        "industrial_polygon_overlap": float(
            industrial_overlap
        ),
        "mining_polygon_overlap": float(
            _safe_bool(hotspot.get("mining_polygon_overlap"))
        ),
        "forest_polygon_overlap": float(
            forest_overlap
        ),
        "agriculture_polygon_overlap": float(
            _safe_bool(hotspot.get("agriculture_polygon_overlap"))
        ),

        "nearest_facility_type_encoded": _safe_float(
            hotspot.get("nearest_facility_type_encoded")
        ),

        "bright_ti4_to_ti5_ratio": bright_ratio,
        "frp_per_pixel": frp_per_pixel,
        "thermal_anomaly_strength": thermal_anomaly_strength,
        "forest_AND_high_frp": float(forest_and_high_frp),
        "industrial_AND_active": float(industrial_active),
        "frp_growth_rate": float(frp_growth_rate),
        "frp_consistency": float(frp_consistency),

        **missing_features,
    }

    return features