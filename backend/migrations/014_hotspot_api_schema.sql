-- Bring existing databases to the bootstrap schema expected by the
-- current hotspots and classifications API paths.

ALTER TABLE hotspots
    ADD COLUMN IF NOT EXISTS frp DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS bright_ti4 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS bright_ti5 DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS firms_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS anomaly_flag BOOLEAN,
    ADD COLUMN IF NOT EXISTS likely_source VARCHAR(30);

CREATE TABLE IF NOT EXISTS land_cover (
    id SERIAL PRIMARY KEY,
    cover_class VARCHAR(50) NOT NULL,
    geom GEOMETRY(Geometry, 4326) NOT NULL,
    source VARCHAR(50) DEFAULT 'OSM',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_land_cover_geom
ON land_cover USING GIST (geom);
