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
-- 3. CLASSIFICATIONS
-- =========================================

CREATE TABLE IF NOT EXISTS classifications (
    classification_id SERIAL PRIMARY KEY,

    hotspot_id INTEGER NOT NULL,

    classification VARCHAR(100),

    confidence DOUBLE PRECISION,

    anomaly_score DOUBLE PRECISION,

    explanation TEXT,

    model_version VARCHAR(50),

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