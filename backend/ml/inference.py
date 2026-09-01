"""
PyroClass inference layer — wraps the final trained XGBoost model.

Model: pyroclass_xgboost_model.pkl  (4-class, 48 features)
Classes:
    0 → Vegetation Fire        (api: forest_fire)
    1 → Industrial Fire        (api: industrial_spike)
    2 → Persistent Industrial  (api: industrial_persistent)
    3 → Other Thermal Anomaly  (api: non_industrial)
"""
from pathlib import Path
import pickle

import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "model_artifacts"

# Ordered exactly as the model was trained (48 features)
FEATURE_NAMES: list[str] = [
    "latitude",
    "longitude",
    "bright_ti4",
    "bright_ti5",
    "scan",
    "track",
    "frp",
    "acq_hour",
    "month",
    "day_of_year",
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
    "farmland_within_5km",
]

# Map model's numeric class index → frontend-compatible API name
CLASS_API_NAMES: dict[int, str] = {
    0: "forest_fire",
    1: "industrial_spike",
    2: "industrial_persistent",
    3: "non_industrial",
}

# Human-readable labels for display / logging
CLASS_DISPLAY_NAMES: dict[int, str] = {
    0: "Vegetation Fire",
    1: "Industrial Fire",
    2: "Persistent Industrial Heat",
    3: "Other Thermal Anomaly",
}


class PyroClassInference:
    def __init__(self) -> None:
        model_path = MODEL_DIR / "pyroclass_xgboost_model.pkl"
        with open(model_path, "rb") as f:
            self.model = pickle.load(f)

        # SHAP explainer — optional, large file
        shap_path = MODEL_DIR / "pyroclass_shap_explainer.pkl"
        self.shap_explainer = None
        if shap_path.exists():
            try:
                import joblib
                self.shap_explainer = joblib.load(shap_path)
            except Exception:
                pass  # non-fatal: SHAP gracefully absent

        self.feature_names = FEATURE_NAMES
        self.metadata = {
            "model_version": "v2.1.0-pyroclass-final",
            "feature_version": "v2-48features",
            "num_classes": 4,
            "classes": CLASS_DISPLAY_NAMES,
        }

    def predict(self, features: dict) -> dict:
        """
        Run XGBoost inference.

        Args:
            features: dict keyed by feature name. Missing keys default to 0.0.

        Returns:
            {predicted_class, confidence, class_probabilities, feature_version}
        """
        row = pd.DataFrame(
            [[float(features.get(name, 0.0)) for name in self.feature_names]],
            columns=self.feature_names,
        )

        probabilities: np.ndarray = self.model.predict_proba(row)[0]
        class_idx = int(np.argmax(probabilities))

        return {
            "predicted_class": CLASS_API_NAMES[class_idx],
            "confidence": float(probabilities[class_idx]),
            "class_probabilities": {
                CLASS_API_NAMES[i]: float(p)
                for i, p in enumerate(probabilities)
            },
            "feature_version": self.metadata["feature_version"],
        }


# Module-level singleton — loaded once at container startup
inference = PyroClassInference()
