-- Spatial match: link hotspots to the nearest real industrial facility
-- within 2000m (wider buffer than the 500m used earlier, since we only
-- have 26 facility points covering a few regions, not dense national
-- coverage — a tighter buffer would just return zero matches everywhere).
--
-- Writes into hotspots' existing facility_name/facility_type/
-- facility_distance_m/specific_facility_identified columns directly,
-- since that's the schema already in place.

UPDATE hotspots h
SET
    facility_name = nearest.name,
    facility_type = nearest.facility_type,
    facility_distance_m = nearest.distance_m,
    specific_facility_identified = true
FROM (
    SELECT
        h2.hotspot_id,
        f.name,
        f.facility_type,
        ST_Distance(h2.geometry::geography, f.geometry::geography) AS distance_m
    FROM hotspots h2
    JOIN LATERAL (
        SELECT f.name, f.facility_type, f.geometry
        FROM industrial_facilities f
        WHERE ST_DWithin(h2.geometry::geography, f.geometry::geography, 2000)
        ORDER BY h2.geometry <-> f.geometry
        LIMIT 1
    ) f ON true
) nearest
WHERE h.hotspot_id = nearest.hotspot_id;

SELECT
    COUNT(*) FILTER (WHERE specific_facility_identified = true) AS matched,
    COUNT(*) FILTER (WHERE specific_facility_identified IS NOT TRUE) AS unmatched,
    COUNT(*) AS total
FROM hotspots;
