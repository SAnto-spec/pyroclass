from __future__ import annotations

import json
import math
import pickle
from pathlib import Path
from typing import Any, Dict

import numpy as np
import pandas as pd
import xgboost as xgb


class ArmaanStage4Classifier:
    """Stage-4 XGBoost classifier for historical association checks."""

    def __init__(self) -> None:
        self.model_dir = self._resolve_model_dir()
        self.model_json_path = self.model_dir / "pyroclass_xgboost_model.json"
        self.model_pkl_path = self.model_dir / "pyroclass_xgboost_model.pkl"
        self.model_metadata_path = self.model_dir / "pyroclass_model_metadata.json"
        self.dataset_path = self._resolve_dataset_path()

        self.metadata = self._load_metadata()
        self.class_names = {
            int(key): value
            for key, value in (self.metadata.get("classes") or {}).items()
        }
        self.feature_names = list(self.metadata.get("features") or [])
        if not self.feature_names:
            raise ValueError("Stage-4 model metadata does not contain feature names")

        self.model = self._load_model()
        self.dataset = self._load_dataset()

    @staticmethod
    def _resolve_model_dir() -> Path:
        candidates = [
            Path(__file__).resolve().parents[2] / "model_artifacts" / "armaan_stage4",
            Path(__file__).resolve().parents[1] / "model_artifacts" / "armaan_stage4",
            Path("/app/model_artifacts/armaan_stage4"),
            Path.cwd() / "model_artifacts" / "armaan_stage4",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        raise FileNotFoundError("Stage-4 model directory not found")

    @staticmethod
    def _resolve_dataset_path() -> Path:
        candidates = [
            Path(__file__).resolve().parents[2] / "dataset" / "viirs-jpss1_2024_India_firms_stage4_pseudo_labelled.csv",
            Path(__file__).resolve().parents[1] / "dataset" / "viirs-jpss1_2024_India_firms_stage4_pseudo_labelled.csv",
            Path("/app/dataset/viirs-jpss1_2024_India_firms_stage4_pseudo_labelled.csv"),
            Path.cwd() / "dataset" / "viirs-jpss1_2024_India_firms_stage4_pseudo_labelled.csv",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        raise FileNotFoundError("Stage-4 dataset not found")

    def _load_metadata(self) -> Dict[str, Any]:
        with open(self.model_metadata_path, "r", encoding="utf-8") as fh:
            return json.load(fh)

    def _load_model(self) -> xgb.XGBClassifier:
        model_path = self.model_json_path if self.model_json_path.exists() else self.model_pkl_path
        if not model_path.exists():
            raise FileNotFoundError(f"Model artifact not found: {model_path}")

        model = xgb.XGBClassifier()
        try:
            model.load_model(str(model_path))
            return model
        except Exception:
            if not self.model_pkl_path.exists():
                raise
            with open(self.model_pkl_path, "rb") as fh:
                return pickle.load(fh)

    def _load_dataset(self) -> pd.DataFrame:
        df = pd.read_csv(self.dataset_path, low_memory=False)
        required = ["latitude", "longitude"] + self.feature_names
        missing = [column for column in required if column not in df.columns]
        if missing:
            raise ValueError(f"Stage-4 dataset missing required columns: {missing}")

        extra_columns = [
            column for column in ["case_id", "acq_datetime", "observation_datetime", "timestamp"]
            if column in df.columns
        ]

        subset: list[str] = []
        seen: set[str] = set()
        for column in ["latitude", "longitude", *extra_columns, *self.feature_names]:
            if column not in seen:
                subset.append(column)
                seen.add(column)

        return df[subset].copy()

    @staticmethod
    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius_km = 6371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = (
            math.sin(delta_phi / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        )
        return 2.0 * radius_km * math.asin(math.sqrt(a))

    def _nearest_row(self, latitude: float, longitude: float) -> pd.Series:
        if self.dataset.empty:
            raise LookupError("Stage-4 dataset is empty")

        latitudes = self.dataset["latitude"].to_numpy(dtype=float)
        longitudes = self.dataset["longitude"].to_numpy(dtype=float)
        lat_diff = np.radians(latitudes - latitude)
        lon_diff = np.radians(longitudes - longitude)
        a = (
            np.sin(lat_diff / 2.0) ** 2
            + np.cos(np.radians(latitude))
            * np.cos(np.radians(latitudes))
            * np.sin(lon_diff / 2.0) ** 2
        )
        distances_km = 2.0 * 6371.0 * np.arcsin(np.sqrt(a))
        idx = int(np.nanargmin(distances_km))
        match = self.dataset.iloc[idx]

        match_lat = match["latitude"]
        match_lon = match["longitude"]
        if isinstance(match_lat, pd.Series):
            match_lat = match_lat.iloc[0]
        if isinstance(match_lon, pd.Series):
            match_lon = match_lon.iloc[0]

        if not np.isfinite(float(match_lat)) or not np.isfinite(float(match_lon)):
            raise ValueError("Nearest Stage-4 row contains invalid latitude/longitude")
        return match

    def _build_feature_frame(self, row: pd.Series) -> pd.DataFrame:
        missing_columns = [feature for feature in self.feature_names if feature not in row.index]
        if missing_columns:
            raise ValueError(f"Malformed feature row: missing required features: {missing_columns}")

        values = row[self.feature_names].copy()
        if values.isnull().all():
            raise ValueError("Malformed feature row: all feature values are null")

        return pd.DataFrame([values.to_numpy()], columns=self.feature_names)

    def assess_hotspot(self, hotspot_id: int, latitude: float, longitude: float) -> Dict[str, Any]:
        if self.model is None:
            raise RuntimeError("Armaan Stage-4 model is unavailable")

        match_row = self._nearest_row(float(latitude), float(longitude))
        feature_frame = self._build_feature_frame(match_row)

        probabilities = self.model.predict_proba(feature_frame)[0]
        predicted_class = int(np.argmax(probabilities))
        confidence = float(probabilities[predicted_class] * 100.0)
        class_breakdown = {
            self.class_names.get(index, str(index)): float(probability * 100.0)
            for index, probability in enumerate(probabilities)
        }

        observation_datetime = (
            match_row.get("acq_datetime")
            or match_row.get("observation_datetime")
            or match_row.get("timestamp")
            or "unknown"
        )

        case_id = match_row.get("case_id")
        match_lat = match_row["latitude"]
        match_lon = match_row["longitude"]
        if isinstance(match_lat, pd.Series):
            match_lat = match_lat.iloc[0]
        if isinstance(match_lon, pd.Series):
            match_lon = match_lon.iloc[0]

        distance_km = self._haversine_km(
            float(latitude),
            float(longitude),
            float(match_lat),
            float(match_lon),
        )

        return {
            "hotspot_id": hotspot_id,
            "case_id": str(case_id) if case_id is not None else "UNKNOWN",
            "predicted_class": predicted_class,
            "predicted_class_name": self.class_names.get(predicted_class, str(predicted_class)),
            "confidence": round(confidence, 2),
            "probability_breakdown": {
                key: round(value, 4)
                for key, value in class_breakdown.items()
            },
            "matched_latitude": float(match_lat),
            "matched_longitude": float(match_lon),
            "distance_km": round(distance_km, 6),
            "observation_datetime": str(observation_datetime),
            "model_source": "Armaan Stage-4 XGBoost",
        }


_classifier_singleton: ArmaanStage4Classifier | None = None


def get_armaan_classifier() -> ArmaanStage4Classifier:
    global _classifier_singleton
    if _classifier_singleton is None:
        _classifier_singleton = ArmaanStage4Classifier()
    return _classifier_singleton
