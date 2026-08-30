-- Spike score threshold calibration
-- Derived from the 16 labeled cases in this dataset:
--   persistent (normal): range 0.11 - 0.84
--   spike (anomalous):   range 1.34 - 1.70
-- Clean separation in the data with no overlap; threshold set at the
-- midpoint of the gap (~1.09), rounded to 1.1 for a clean, explainable cutoff.
--
-- NOTE: calibrated on a small sample (n=16) — revisit if/when more
-- labeled cases become available. State this caveat if asked.

ALTER TABLE hotspots ADD COLUMN IF NOT EXISTS anomaly_flag BOOLEAN;

UPDATE hotspots
SET anomaly_flag = (spike_score >= 1.1)
WHERE spike_score IS NOT NULL;

-- Sanity check: confirm the threshold correctly separates the known labels
SELECT case_type, anomaly_flag, COUNT(*)
FROM hotspots
WHERE case_type IN ('persistent', 'spike')
GROUP BY case_type, anomaly_flag
ORDER BY case_type;
