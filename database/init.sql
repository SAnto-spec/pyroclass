CREATE EXTENSION IF NOT EXISTS postgis;

-- =========================================
-- 1. HOTSPOTS
-- =========================================

CREATE TABLE IF NOT EXISTS hotspots (
    hotspot_id SERIAL PRIMARY KEY,

    case_id VARCHAR(50),
    case_type VARCHAR(50),

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    geometry GEOMETRY(POINT, 4326) NOT NULL,

    timestamp TIMESTAMP NOT NULL,

    frp DOUBLE PRECISION,
    bright_ti4 DOUBLE PRECISION,
    bright_ti5 DOUBLE PRECISION,
    confidence DOUBLE PRECISION,
    firms_type VARCHAR(50),

    h3_cell VARCHAR(20),

    n DOUBLE PRECISION,
    active_days DOUBLE PRECISION,

    mean_frp DOUBLE PRECISION,
    median_frp DOUBLE PRECISION,
    max_frp DOUBLE PRECISION,

    year_2022 DOUBLE PRECISION,
    year_2023 DOUBLE PRECISION,
    year_2024 DOUBLE PRECISION,

    base_monthly DOUBLE PRECISION,
    cur_monthly DOUBLE PRECISION,

    count_ratio DOUBLE PRECISION,
    p95_ratio DOUBLE PRECISION,
    spike_score DOUBLE PRECISION,

    context_type VARCHAR(100),
    context_confidence DOUBLE PRECISION,

    facility_name VARCHAR(255),
    facility_type VARCHAR(100),
    facility_distance_m DOUBLE PRECISION,

    industrial_context_score DOUBLE PRECISION,
    mining_context_score DOUBLE PRECISION,

    industrial_polygon_overlap_osm BOOLEAN,
    mining_polygon_overlap BOOLEAN,
    forest_polygon_overlap BOOLEAN,
    agriculture_polygon_overlap BOOLEAN,

    industrial_features_found INTEGER,
    mining_features_found INTEGER,
    forest_features_found INTEGER,
    agriculture_features_found INTEGER,

    nearest_industrial_name VARCHAR(255),
    nearest_industrial_type VARCHAR(100),
    nearest_industrial_distance_m DOUBLE PRECISION,

    nearest_mining_name VARCHAR(255),
    nearest_mining_distance_m DOUBLE PRECISION,

    vegetation_context VARCHAR(100),
    agriculture_context VARCHAR(100),

    context_evidence_osm TEXT,

    osm_elements INTEGER,
    osm_source_osm VARCHAR(255),

    has_osm_context BOOLEAN,
    specific_facility_identified BOOLEAN,
    historical_data_available BOOLEAN,

    daynight CHAR(1),
    anomaly_flag BOOLEAN,
    likely_source VARCHAR(30),

    geospatial_review_status VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_hotspots_geometry
ON hotspots
USING GIST (geometry);


-- =========================================
-- 2. INDUSTRIAL FACILITIES
-- =========================================

CREATE TABLE IF NOT EXISTS industrial_facilities (
    facility_id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    facility_type VARCHAR(100),

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    geometry GEOMETRY(POINT, 4326) NOT NULL,

    osm_id VARCHAR(100),
    wikidata_id VARCHAR(100),

    operator VARCHAR(255),

    source VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_facilities_geometry
ON industrial_facilities
USING GIST (geometry);


-- =========================================
-- 3. LAND COVER
-- =========================================

CREATE TABLE IF NOT EXISTS land_cover (
    id SERIAL PRIMARY KEY,
    cover_class VARCHAR(50) NOT NULL,
    geom GEOMETRY(Geometry, 4326) NOT NULL,
    source VARCHAR(50) DEFAULT 'OSM',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_land_cover_geom
ON land_cover USING GIST (geom);


-- =========================================
-- 4. CLASSIFICATIONS
-- =========================================

CREATE TABLE IF NOT EXISTS classifications (
    classification_id SERIAL PRIMARY KEY,

    hotspot_id INTEGER NOT NULL,

    predicted_class VARCHAR(100),

    confidence DOUBLE PRECISION,

    anomaly_score DOUBLE PRECISION,

    explanation TEXT,

    model_version VARCHAR(50),

    class_probabilities JSONB,
    priority_level TEXT,
    unknown_reason TEXT,
    feature_version TEXT,
    top_explanatory_features JSONB,

    classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    facility_id INTEGER,

    CONSTRAINT fk_classification_hotspot
        FOREIGN KEY (hotspot_id)
        REFERENCES hotspots(hotspot_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_classification_facility
        FOREIGN KEY (facility_id)
        REFERENCES industrial_facilities(facility_id)
        ON DELETE SET NULL
);
