"""
Feature builder for the PyroClass final XGBoost model (48 features).

Maps hotspot DB columns directly to the model features, as the DB
now contains the exact columns needed (pre-computed).
"""

from __future__ import annotations

def _f(value: Any, default: float = 0.0) -> float:
    """Safely coerce value to float; return default for None / NaN / inf."""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

def build_features(hotspot: dict) -> dict:
    """
    Build the full 48-feature dict for a hotspot row from the DB.
    Because the DB schema now matches the ML features 1:1, we just extract them.
    """
    
    # 48 ordered feature names matching the XGBoost model
    feature_names = [
        "latitude", "longitude", "bright_ti4", "bright_ti5", "scan", "track", 
        "frp", "acq_hour", "month", "day_of_year", "thermal_difference", 
        "thermal_ratio", "pixel_area", "frp_per_pixel_area", "detections_7d", 
        "detections_30d", "active_days_90d", "active_day_ratio_90d", "frp_mean_90d", 
        "frp_ratio_to_90d_mean", "time_since_previous_detection", "distance_to_refinery", 
        "refinery_within_1km", "refinery_within_5km", "distance_to_power_plant", 
        "power_plant_within_1km", "power_plant_within_5km", "distance_to_industrial_works", 
        "industrial_works_within_1km", "industrial_works_within_5km", "distance_to_industrial_area", 
        "industrial_area_within_1km", "industrial_area_within_5km", "distance_to_quarry", 
        "quarry_within_1km", "quarry_within_5km", "distance_to_mine", "mine_within_1km", 
        "mine_within_5km", "distance_to_nearest_industrial", "industrial_within_1km", 
        "industrial_within_5km", "distance_to_forest", "forest_within_1km", 
        "forest_within_5km", "distance_to_farmland", "farmland_within_1km", 
        "farmland_within_5km"
    ]
    
    features = {}
    
    # Handle month/day_of_year which might not be explicitly passed but can be derived from timestamp
    if "month" not in hotspot and "timestamp" in hotspot:
        dt = hotspot["timestamp"]
        hotspot["month"] = dt.month
        hotspot["day_of_year"] = dt.timetuple().tm_yday
        
    for name in feature_names:
        features[name] = _f(hotspot.get(name))
        
    return features