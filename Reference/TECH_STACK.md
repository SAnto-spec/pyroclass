# Tech Stack — PyroClass

> AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources — geospatial intelligence platform for India ingesting NASA FIRMS VIIRS thermal anomalies, enriching with OpenStreetMap/land-cover, classifying with XGBoost + SHAP, visualized on MapLibre GIS dashboard.

---

## 1. Overview

| Layer | Key Technologies |
|-------|------------------|
| **Frontend** | React 19 + TypeScript 6 + Vite 8 + Tailwind 4 + MapLibre GL + Deck.gl |
| **Backend** | Python 3.12 + FastAPI 0.109 + Uvicorn 0.27 |
| **Database** | PostgreSQL 16 + PostGIS 3.4 |
| **Cache** | Redis 7-alpine |
| **ML / Data** | pandas, numpy, XGBoost + SHAP (planned), H3 |
| **Infra** | Docker 24+ + Compose v2, Node 24-alpine |

---

## 2. Frontend — `frontend/` (`frontend/package.json:1-41`)

### 2.1 Core

| Package | Version | Purpose | File |
|---------|---------|---------|------|
| `react` | `^19.2.8` | UI library | `frontend/package.json:21` |
| `react-dom` | `^19.2.8` | DOM rendering | `frontend/package.json:22` |
| `react-router-dom` | `^7.18.3` | Client routing (`/dashboard`, `/anomalies`, `/facilities`, `/sources`, `/alerts`) | `frontend/src/App.tsx:1` |
| `typescript` | `~6.0.2` | Type safety (strict, `erasableSyntaxOnly`) | `frontend/tsconfig.app.json:14` |

### 2.2 Build & Tooling

| Package | Version | Purpose | File |
|---------|---------|---------|------|
| `vite` | `^8.2.2` | Dev server + production build | `frontend/package.json:36` |
| `@vitejs/plugin-react` | `^6.1.0` | React Fast Refresh for Vite | `frontend/vite.config.ts:2` |
| `vite.config.ts` | — | `plugins: [react(), tailwindcss()]`, `exclude: ["maplibre-gl"]`, `worker.format: "es"` | `frontend/vite.config.ts:5-12` |
| `oxlint` | `^1.79.0` | Linter (`npm run lint`) | `frontend/package.json:34`, `frontend/.oxlintrc.json:1-8` |
| `@types/node` | `^24.13.3` | Node types | `frontend/package.json:30` |
| `@types/react` | `^19.2.18` | React types | — |
| `@types/react-dom` | `^19.2.4` | React DOM types | — |

Scripts (`frontend/package.json:6-11`):

```json
"dev": "vite",
"build": "tsc -b && vite build",
"lint": "oxlint",
"preview": "vite preview"
```

### 2.3 Styling

| Package | Version | File |
|---------|---------|------|
| `tailwindcss` | `^4.3.3` | `frontend/package.json:26` |
| `@tailwindcss/vite` | `^4.3.3` | `frontend/vite.config.ts:3` |

Entry: `@import "tailwindcss"` in `frontend/src/index.css:1`; dark theme `bg: #020617`, `font: ui-sans-serif`.

### 2.4 Maps & GIS (core domain)

| Package | Version | File |
|---------|---------|------|
| `maplibre-gl` | `^6.6.0` | `frontend/package.json:20` |
| `react-map-gl` | `^8.1.2` | `frontend/package.json:23` — React wrapper for MapLibre |
| `@deck.gl/core` | `^9.3.11` | Deck.gl core (WebGL layers) |
| `@deck.gl/layers` | `^9.3.11` | — |
| `@deck.gl/react` | `^9.3.11` | Deck.gl + React integration |

Basemap: OpenStreetMap raster via MapLibre — no API key (`README.md:36`). H3 cells stored as `h3_cell VARCHAR(20)` (`database/init.sql:20`).

### 2.5 State, Data & UI

| Package | Version | Usage |
|---------|---------|-------|
| `zustand` | `^5.0.15` | Global UI store — `frontend/src/store/uiStore.ts:1` (`sidebarOpen`, `toggleSidebar`) |
| `@tanstack/react-query` | `^5.102.8` | Server state, wrapped in `QueryClientProvider` `frontend/src/main.tsx:4` |
| `axios` | `^1.20.0` | HTTP client (ready for `http://localhost:8000`, currently mock in `frontend/src/api/anomalies.ts:5`) |
| `recharts` | `^3.10.1` | Charts (dashboard analytics) |
| `lucide-react` | `^1.37.0` | Icon library |

App entry: `frontend/src/main.tsx:1-19` — `StrictMode` + `QueryClientProvider` + `BrowserRouter` + `App`; `frontend/src/App.tsx:1-25` — `DashboardLayout` with nested routes + `Navigate` fallback.

TypeScript config: project references `tsconfig.app.json` (target `es2023`, `bundler` resolution, `react-jsx`) and `tsconfig.node.json` (target `es2023`, `nodenext` for `vite.config.ts`) (`frontend/tsconfig.json:1-7`).

### 2.6 Frontend Structure

```
frontend/src/
├── api/anomalies.ts      # mock -> axios to FastAPI (TODO)
├── components/{layout,map,dashboard,anomalies,facilities,sources,alerts,ui}
├── pages/{Dashboard,Anomalies,Facilities,Sources,Alerts}.tsx
├── hooks/  store/uiStore.ts  types/  mocks/  lib/
├── App.tsx  main.tsx  index.css
```

---

## 3. Backend — `backend/` (`backend/requirements.txt:1-3`, `backend/Dockerfile:1-16`)

### 3.1 Runtime

| Technology | Version | File |
|------------|---------|------|
| `python` | `3.12-slim` | `backend/Dockerfile:1` |
| `fastapi` | `==0.109.2` | `backend/requirements.txt:1` |
| `uvicorn[standard]` | `==0.27.1` | `backend/requirements.txt:2`, `CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8000"]` |
| `psycopg2-binary` | `==2.9.9` | `backend/requirements.txt:3` — sync DB driver |

Additional runtime deps used in scripts (stdlib + `pandas`, `numpy` via `preprocess_ml_dataset.py:20-21`, `check_master.py:1` — not pinned in `requirements.txt`):

```python
import pandas, numpy, csv, psycopg2
```

### 3.2 API — `backend/main.py:1-27`

```python
app = FastAPI(title="PyroClass API", version="0.1.0")
GET /       -> {"project":"PyroClass","status":"running"}
GET /health -> {"status":"healthy"}
include_router(hotspots_router)  # prefix /hotspots
```

Routes (`backend/routes/hotspots.py:1-471`):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/hotspots/` | GET | List all hotspots `ORDER BY hotspot_id` (59 columns) |
| `/hotspots/{hotspot_id}` | GET | Single hotspot by PK |
| `/hotspots/{hotspot_id}/context` | GET | OSM/industrial/mining/forest context subset |
| `/hotspots/{hotspot_id}/features` | GET | ML feature subset (`n`, `active_days`, `mean/median/max_frp`, `year_2022-2024`, `count_ratio`, `spike_score`, overlaps, scores) |

DB access: `backend/database/connection.py:5-14` — `psycopg2.connect(**DB_CONFIG)` with env `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` (defaults `postgres:5432/pyroclass`).

Ingestion: `backend/ingestion/load_dataset.py:1-262` — reads `CSV_FILE=/app/dataset/pyroclass_20_sites_geospatial_final.csv`, casts via `to_float`/`to_int`/`to_bool`, inserts with `ST_SetSRID(ST_MakePoint(lon,lat),4326)` + `CURRENT_TIMESTAMP`.

---

## 4. Database & Cache — `docker-compose.yml:1-36`, `database/init.sql:1-148`

### 4.1 PostgreSQL + PostGIS

| Item | Value |
|------|-------|
| Image | `postgis/postgis:16-3.4` |
| Container | `pyroclass-postgres` `5432:5432` |
| DB / User / Pass | `pyroclass` / `pyroclass` / `pyroclass123` |
| Volume | `postgres_data:/var/lib/postgresql/data` + `./database/init.sql:/docker-entrypoint-initdb.d/init.sql` |
| Extension | `CREATE EXTENSION IF NOT EXISTS postgis` |

**Tables:**

1. **`hotspots`** (`database/init.sql:7-84`) — 50+ columns: `hotspot_id SERIAL PK`, `case_id`, `case_type`, `latitude/longitude`, `geometry GEOMETRY(POINT,4326)`, `timestamp`, `h3_cell VARCHAR(20)`, `n`, `active_days`, `mean/median/max_frp`, `year_2022/2023/2024`, `base/cur_monthly`, `count_ratio`, `p95_ratio`, `spike_score`, `context_type/confidence`, `facility_name/type/distance`, `industrial/mining_context_score`, overlaps (`industrial_polygon_overlap_osm` etc. `BOOLEAN`), `*_features_found INTEGER`, `nearest_*`, `vegetation/agriculture_context`, `context_evidence_osm TEXT`, `osm_elements`, `has_osm_context` etc., `geospatial_review_status`; `GIST (geometry)` index.

2. **`industrial_facilities`** (`database/init.sql:91-113`) — `facility_id`, `name`, `facility_type`, `lat/lon`, `geometry POINT 4326`, `osm_id`, `wikidata_id`, `operator`, `source`; GIST index.

3. **`classifications`** (`database/init.sql:120-148`) — `classification_id`, `hotspot_id FK->hotspots CASCADE`, `classification`, `confidence`, `anomaly_score`, `explanation TEXT`, `model_version`, `classified_at TIMESTAMP`, `facility_id FK->facilities SET NULL`.

### 4.2 Redis

| Item | Value |
|------|-------|
| Image | `redis:7-alpine` |
| Container | `pyroclass-redis` `6379:6379` |

API `depends_on: [postgres, redis]` (`docker-compose.yml:31-33`).

---

## 5. ML & Data Pipeline

### 5.1 Intended Stack (from `README.md:3` + `armaan_ML_role_reference/`)

| Component | Technology | Status |
|-----------|------------|--------|
| Classifier | XGBoost + SHAP | Planned / referenced, not yet in `requirements.txt` |
| Features | 37 features in 7 groups (raw thermal, derived thermal, temporal, persistence 14, industrial context 6, land-cover 6, FRP anomaly 3) | Spec in `ML_REQUIREMENTS_FOR_TEAM.md:70-158` |
| Weak-label caveat | Labels partly generated from same features as inputs — evaluate via macro-F1/confusion/SHAP, not accuracy | `preprocess_ml_dataset.py:6-11` |

### 5.2 Datasets — `dataset/` + `dataset/ml/`

```
dataset/
├── pyroclass_20_sites_geospatial_final.{csv,geojson}  # 20-point prototype (India, 2024)
├── pyroclass_20_prototype_candidates.csv
├── ml/
│   ├── pyroclass_training_master.csv   # 40,580 rows (2022-2024, all events)
│   ├── pyroclass_train.csv             # 27,830 rows (2022-2023)
│   ├── pyroclass_validation.csv        # 8,113 rows (Jan-Jun 2024)
│   ├── pyroclass_test.csv              # 4,637 rows (Jul-Dec 2024)
│   ├── preprocessed/                   # after preprocess_ml_dataset.py
│   ├── pyroclass_six_class_candidates.csv
│   └── TRAINING_DATASET_README.md
├── clean_firms.py, osm_enrichment.py, finalize_geospatial_dataset.py, h3_prototype_analysis.py
└── risk_scoring/ validate_osm_context.py
```

Temporal split (no leakage): Train 2022-01-01 → 2023-12-31, Val 2024-01-01 → 09-30, Test 2024-10-01 → 12-31 (`ML_REQUIREMENTS_FOR_TEAM.md:315-320`).

### 5.3 Preprocessing — `preprocess_ml_dataset.py:1-143`

- Drop `distance_to_seed_facility_m` (100% missing)
- Fill `mean/median/std/max_frp_*`, `frp_deviation`, `frp_ratio_to_baseline`, `frp_z_score` NaNs → `0` (no prior history)
- Fill `days_since_previous_detection` NaNs → `-1` (first detection)
- Preserve `has_history_7d/30d/90d` flags; output to `dataset/ml/preprocessed/`

Helpers: `check_master.py:1-29` + `check_training_data.py:1-47` (pandas profiling of shape, target distribution, missing values, feature counts).

---

## 6. Geospatial

| Technology | Usage |
|------------|-------|
| **PostGIS** | `GEOMETRY(POINT,4326)`, `ST_MakePoint`, `ST_SetSRID`, GIST indexes |
| **H3** | `h3_cell` (resolution 7) — spatial grouping & persistence windows (7/30/90 days) |
| **OpenStreetMap** | Enrichment via `osm_enrichment.py`, Overpass API — `industrial/mining/forest/agriculture_polygon_overlap`, `industrial_features_found` etc. |
| **MapLibre GL** | Frontend raster OSM basemap (no API key), Deck.gl overlay |
| **FIRMS** | NASA EOSDIS VIIRS thermal anomalies (`bright_ti4`, `bright_ti5`, `frp`, `confidence`, `scan`, `track`, `daynight`, `acq_date/time`) — `dataset/clean_firms.py` |
| **Land Cover (planned)** | ESA WorldCover 2021 (10m, 11 classes) / MODIS / Copernicus via `rasterio` |

---

## 7. DevOps & Infrastructure

| Component | Detail |
|-----------|--------|
| **Docker** | `>=24` + Compose v2 required (`README.md:34`) |
| **Root compose** | `docker-compose.yml` — `postgres`, `redis`, `api` (build `./backend`, mount `./dataset:/app/dataset`, `./backend/ingestion:/app/ingestion`) |
| **Frontend compose** | `frontend/docker-compose.yml:1-8` — `frontend` build `.`, `5173:5173`, `- .:/app`, `- /app/node_modules` (HMR) |
| **Frontend Dockerfile** | `FROM node:24-alpine`, `npm ci`, `COPY .`, `EXPOSE 5173`, `CMD ["npm","run","dev","--","--host","0.0.0.0"]` |
| **Backend Dockerfile** | `FROM python:3.12-slim`, `pip install -r requirements.txt`, `COPY main.py database routes ingestion`, `EXPOSE 8000` |
| **Local frontend** | `npm ci && npm run dev` → `http://localhost:5173`, `npm run build` → `dist/`, `npm run preview` |
| **Local backend** | `pip install -r requirements.txt && uvicorn main:app --reload --host 0.0.0.0 --port 8000` (needs local Postgres+PostGIS+Redis if not via compose) |
| **Health** | `curl http://localhost:8000/health` → `{"status":"healthy"}`, `curl /` → `{"project":"PyroClass","status":"running"}` |

---

## 8. Project Structure

```
pyroclass/
├── frontend/               # React + Vite GIS dashboard (MapLibre)
│   ├── Dockerfile          # Node 24-alpine, exposes 5173
│   ├── docker-compose.yml  # Frontend only
│   ├── vite.config.ts      # @tailwindcss/vite + @vitejs/plugin-react
│   ├── tsconfig*.json      # es2023, bundler, strict
│   ├── index.html
│   └── src/                # Dashboard, Anomalies, Facilities, Sources, Alerts
├── backend/                # FastAPI (Python 3.12)
│   ├── Dockerfile          # uvicorn on :8000
│   ├── main.py
│   ├── routes/hotspots.py
│   ├── database/connection.py
│   └── ingestion/load_dataset.py
├── database/init.sql       # PostGIS init (3 tables)
├── dataset/                # 20-point + ML splits + enrichment scripts
├── docker-compose.yml      # Full stack: postgres + redis + api
├── Reference/              # Baseline & geospatial specs (FIRMS mapping, ML baseline, ProjectSummary)
├── armaan_ML_role_reference/ # ML role docs (checklists, training guide)
├── check_master.py  check_training_data.py  preprocess_ml_dataset.py
└── TECH_STACK.md           # this file
```

---

## 9. Version Matrix

| Category | Dependency | Version | Lock |
|----------|------------|---------|------|
| Frontend | `react` | `19.2.8` | `frontend/package-lock.json` |
| | `react-dom` | `19.2.8` | — |
| | `react-router-dom` | `7.18.3` | — |
| | `react-map-gl` | `8.1.2` | — |
| | `maplibre-gl` | `6.6.0` | — |
| | `@deck.gl/*` | `9.3.11` | — |
| | `zustand` | `5.0.15` | — |
| | `@tanstack/react-query` | `5.102.8` | — |
| | `axios` | `1.20.0` | — |
| | `recharts` | `3.10.1` | — |
| | `lucide-react` | `1.37.0` | — |
| | `tailwindcss` | `4.3.3` | — |
| | `@tailwindcss/vite` | `4.3.3` | — |
| | `vite` | `8.2.2` | — |
| | `@vitejs/plugin-react` | `6.1.0` | — |
| | `typescript` | `6.0.2` | — |
| | `oxlint` | `1.79.0` | — |
| Backend | `fastapi` | `0.109.2` | `backend/requirements.txt` |
| | `uvicorn[standard]` | `0.27.1` | — |
| | `psycopg2-binary` | `2.9.9` | — |
| | `pandas` / `numpy` | unpinned (scripts) | — |
| DB | `postgis/postgis` | `16-3.4` | `docker-compose.yml:4` |
| | `postgres` | `16` | — |
| Cache | `redis` | `7-alpine` | `docker-compose.yml:17` |
| Runtime | `python` | `3.12-slim` | `backend/Dockerfile:1` |
| | `node` | `24-alpine` (local `>=20`, `npm>=10`) | `frontend/Dockerfile:1` |

---

## 10. Data Sources & Attribution

- **FIRMS**: NASA EOSDIS (VIIRS)
- **Basemap**: © OpenStreetMap contributors (MapLibre, no API key)
- **Prototype geography**: India only (`Reference/ProjectSummary.md`)

---

## 11. Not Yet Wired / Planned

- XGBoost + SHAP model artifacts (`models/*.pkl` gitignored) — `Reference/ML_Engineer_Baseline.md`
- Per-pixel land-cover (ESA WorldCover) sampling via `rasterio`
- Full OSM + H3 persistence pipeline scaled from 20 sites → 1.5M hotspots (`ML_REQUIREMENTS_FOR_TEAM.md:204-330`)
- Frontend `axios` fetch from `http://localhost:8000/api/v1/hotspots` (currently `mockAnomalies` in `frontend/src/api/anomalies.ts:6`)

---

*Generated from repository inspection — see cited `file:line` refs for truth.*
