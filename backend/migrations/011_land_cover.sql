-- Land cover polygons — used to classify hotspots as likely industrial,
-- forest fire, or agricultural burning, per PS 26162 deliverable:
-- "Classification and segregation of industrial fires from forest fires
-- and other natural fires."

CREATE TABLE land_cover (
    id SERIAL PRIMARY KEY,
    cover_class VARCHAR(50) NOT NULL,   -- 'tree_cover', 'farmland', 'urban'
    geom GEOMETRY(Geometry, 4326) NOT NULL,  -- polygons come as Polygon or MultiPolygon
    source VARCHAR(50) DEFAULT 'OSM',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_land_cover_geom ON land_cover USING GIST (geom);
