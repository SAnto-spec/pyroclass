-- Classifies each hotspot as likely industrial, forest fire, agricultural
-- burning, or uncertain — per PS 26162 deliverable (i): "Classification
-- and segregation of industrial fires from forest fires and other
-- natural fires."
--
-- Priority: an existing facility match (already computed) takes
-- precedence over land cover, since a confirmed nearby facility is
-- stronger evidence than land cover alone. Land cover is the fallback
-- for anything not already matched to a facility.

ALTER TABLE hotspots ADD COLUMN IF NOT EXISTS likely_source VARCHAR(30);

UPDATE hotspots h
SET likely_source = CASE
    WHEN h.specific_facility_identified = true THEN 'industrial'
    WHEN matched.cover_class = 'tree_cover' THEN 'forest_fire'
    WHEN matched.cover_class = 'farmland' THEN 'agricultural_burning'
    ELSE 'uncertain'
END
FROM (
    SELECT h2.hotspot_id, lc.cover_class
    FROM hotspots h2
    LEFT JOIN LATERAL (
        SELECT cover_class
        FROM land_cover lc
        WHERE ST_DWithin(lc.geom::geography, h2.geometry::geography, 3000)
        ORDER BY lc.geom <-> h2.geometry
        LIMIT 1
    ) lc ON true
) AS matched(hotspot_id, cover_class)
WHERE h.hotspot_id = matched.hotspot_id;

-- Also handle hotspots with no land_cover row at all (LEFT JOIN above only
-- covers matched rows; this catches any remaining NULLs)
UPDATE hotspots
SET likely_source = CASE
    WHEN specific_facility_identified = true THEN 'industrial'
    ELSE 'uncertain'
END
WHERE likely_source IS NULL;

-- Report
SELECT likely_source, COUNT(*) FROM hotspots GROUP BY likely_source ORDER BY COUNT(*) DESC;
