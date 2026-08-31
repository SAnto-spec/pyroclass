-- Extend classifications table to match the ML/API contract.
-- Preserves the existing integer IDs used by the prototype.
-- Stores model probabilities, priority, unknown reasoning,
-- feature schema version, and SHAP-based explanations.

-- Rename the legacy field only when an existing database still has it.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'classifications'
          AND column_name = 'classification'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'classifications'
          AND column_name = 'predicted_class'
    ) THEN
        ALTER TABLE classifications
            RENAME COLUMN classification TO predicted_class;
    END IF;
END $$;

-- Add fields required by the ML/API contract.
ALTER TABLE classifications
    ADD COLUMN IF NOT EXISTS class_probabilities JSONB,
    ADD COLUMN IF NOT EXISTS priority_level TEXT,
    ADD COLUMN IF NOT EXISTS unknown_reason TEXT,
    ADD COLUMN IF NOT EXISTS feature_version TEXT,
    ADD COLUMN IF NOT EXISTS top_explanatory_features JSONB;
