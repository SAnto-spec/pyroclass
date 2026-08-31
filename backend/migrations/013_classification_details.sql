-- Extend classifications table to match the ML/API contract.
-- Preserves the existing integer IDs used by the prototype.
-- Stores model probabilities, priority, unknown reasoning,
-- feature schema version, and SHAP-based explanations.

-- Rename the legacy field to the canonical ML/API name.
ALTER TABLE classifications
    RENAME COLUMN classification TO predicted_class;

-- Add fields required by the ML/API contract.
ALTER TABLE classifications
    ADD COLUMN IF NOT EXISTS class_probabilities JSONB,
    ADD COLUMN IF NOT EXISTS priority_level TEXT,
    ADD COLUMN IF NOT EXISTS unknown_reason TEXT,
    ADD COLUMN IF NOT EXISTS feature_version TEXT,
    ADD COLUMN IF NOT EXISTS top_explanatory_features JSONB;