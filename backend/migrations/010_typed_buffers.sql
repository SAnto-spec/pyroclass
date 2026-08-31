-- Facility-type-aware spatial matching.
-- Replaces the flat 2000m buffer with per-type radii, reflecting real
-- physical footprint differences:
--   refinery      5000m  (large multi-unit complexes, e.g. Jamnagar)
--   steel         4000m  (large integrated plants with wide sites)
--   power_plant   3000m  (sizable but more contained than refineries)
--   lng_terminal  1500m  (compact, localized facilities)
--   mining_quarry 3000m  (open-pit sites can be spatially large)
--   default       2000m  (fallback for any other/unknown type)
--
-- Values are reasoned estimates based on typical facility footprints,
-- not independently measured — a reasonable starting calibration, worth
-- refining if real facility boundary data becomes available.

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
        WHERE ST_DWithin(
            h2.geometry::geography,
            f.geometry::geography,
            CASE f.facility_type
                WHEN 'refinery' THEN 5000
                WHEN 'steel' THEN 4000
                WHEN 'power_plant' THEN 3000
                WHEN 'lng_terminal' THEN 1500
                WHEN 'mining_quarry' THEN 3000
                ELSE 2000
            END
        )
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
