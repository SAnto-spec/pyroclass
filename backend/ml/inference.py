from pathlib import Path
import json
import pickle

import numpy as np
import pandas as pd
import xgboost as xgb


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "model_artifacts"


class ThermalWeightedInference:
    def __init__(self):
        self.model = xgb.XGBClassifier()
        self.model.load_model(str(MODEL_DIR / "xgboost_model_thermal_weighted.json"))

        with open(MODEL_DIR / "label_encoder_thermal_weighted.pkl", "rb") as f:
            self.label_encoder = pickle.load(f)

        with open(MODEL_DIR / "model_metadata_thermal_weighted.json", "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        self.feature_names = self.model.get_booster().feature_names

        if not self.feature_names:
            raise RuntimeError("Model does not contain feature names")

        if len(self.feature_names) != 55:
            raise RuntimeError(
                f"Expected 55 model features, got {len(self.feature_names)}"
            )

    def predict(self, features: dict) -> dict:
        missing = [name for name in self.feature_names if name not in features]

        if missing:
            raise ValueError(f"Missing model features: {missing}")

        row = pd.DataFrame(
            [[features[name] for name in self.feature_names]],
            columns=self.feature_names,
        )

        probabilities = self.model.predict_proba(row)[0]
        encoded_class = int(np.argmax(probabilities))
        predicted_class = str(
            self.label_encoder.inverse_transform([encoded_class])[0]
        )

        return {
            "predicted_class": predicted_class,
            "confidence": float(probabilities[encoded_class]),
            "class_probabilities": {
                str(label): float(probability)
                for label, probability in zip(
                    self.label_encoder.classes_, probabilities
                )
            },
            "feature_version": self.metadata.get("feature_version"),
        }


inference = ThermalWeightedInference()
