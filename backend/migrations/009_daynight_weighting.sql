-- Day/night weighting on the anomaly flag.
-- Daytime VIIRS detections are noisier (sun-heated surfaces can trigger
-- false anomalies), so a daytime detection needs a higher spike_score to
-- be flagged with the same confidence as a nighttime one at the base
-- threshold (1.1, from the earlier calibration).
--
-- Concretely: raise the effective threshold by 20% for daytime rows.
-- This only affects rows that actually have a daynight value (live rows
-- going forward) — historical aggregate cases are untouched, since they
-- have no single day/night value and were already correctly flagged
-- using the base threshold.

UPDATE hotspots
SET anomaly_flag = CASE
    WHEN daynight = 'D' THEN spike_score >= 1.1 * 1.2  -- daytime: stricter, effectively 1.32
    WHEN daynight = 'N' THEN spike_score >= 1.1          -- nighttime: base threshold, more trustworthy
    ELSE spike_score >= 1.1                                -- no daynight info: fall back to base threshold
END
WHERE spike_score IS NOT NULL;

-- Sanity check: confirm historical labeled cases are unaffected
SELECT case_type, anomaly_flag, COUNT(*)
FROM hotspots
WHERE case_type IN ('persistent', 'spike')
GROUP BY case_type, anomaly_flag
ORDER BY case_type;
