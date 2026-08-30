-- Day/night flag — only meaningful for live, per-detection rows.
-- Historical persistent/spike cases are multi-year aggregates and have
-- no single day/night value, so this stays NULL for those (expected,
-- not a bug).

ALTER TABLE hotspots ADD COLUMN IF NOT EXISTS daynight CHAR(1);
