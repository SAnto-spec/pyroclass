# PyroClass — AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources

PyroClass is a geospatial intelligence platform for India that ingests NASA FIRMS VIIRS thermal anomalies, enriches them with OpenStreetMap and land-cover context, classifies them with XGBoost + SHAP, and visualizes the result on an interactive MapLibre GIS dashboard.

**Stack:** React 19 + TypeScript + Vite + Tailwind + MapLibre GL + FastAPI + PostGIS (PostgreSQL 16) + Redis

---

## Project Structure

```
pyroclass/
├── frontend/               # React + Vite GIS dashboard (MapLibre)
│   ├── Dockerfile          # Node 24-alpine, exposes 5173
│   ├── docker-compose.yml  # Frontend only
│   └── src/                # Dashboard, Anomalies, Facilities, Sources, Alerts
├── backend/                # FastAPI (Python 3.12)
│   ├── Dockerfile          # uvicorn on :8000
│   ├── main.py
│   ├── routes/hotspots.py
│   ├── database/connection.py
│   └── ingestion/load_dataset.py
├── database/
│   └── init.sql            # PostGIS init
├── dataset/                # Curated 20-point + prototype CSV/GeoJSON
├── docker-compose.yml      # Full stack: postgres + redis + api
└── Reference/              # Canonical baseline & geospatial spec
```

---

## Prerequisites

* Docker `>= 24` and Docker Compose `v2` (`docker compose version`)
* For local (non-Docker) frontend: Node `>= 20`, npm `>= 10`
* No API keys required — basemap is OpenStreetMap raster via MapLibre

---

## Quick Start — Full Stack with Docker (recommended)

From the **project root** (`pyroclass/`):

```bash
# 1. Clone and enter
git clone <repo-url> pyroclass
cd pyroclass

# 2. Start backend + DB + cache (detached)
docker compose up --build -d

# 3. Check services
docker compose ps
docker compose logs -f api          # API logs
curl http://localhost:8000/health   # -> {"status":"healthy"}
curl http://localhost:8000/         # -> {"project":"PyroClass","status":"running"}
```

Services:

| Service | Container | Port | Notes |
|---------|-----------|------|-------|
| `postgres` | `pyroclass-postgres` | `5432:5432` | PostGIS 16-3.4, DB `pyroclass` / user `pyroclass` / pass `pyroclass123` (see `docker-compose.yml`) |
| `redis` | `pyroclass-redis` | `6379:6379` | 7-alpine |
| `api` | `pyroclass-api` | `8000:8000` | FastAPI, mounts `./dataset:/app/dataset` |

Stop:

```bash
docker compose down        # keep volumes
docker compose down -v     # also remove postgres_data
```

---

## Run Frontend with Docker

The frontend is intentionally **decoupled** — it runs with mock GeoJSON and does not require the backend for UI development.

**Option A — frontend only (isolated):**

```bash
cd frontend
docker compose up --build -d
# open http://localhost:5173
docker compose logs -f frontend
docker compose down
```

`frontend/Dockerfile`:

* `node:24-alpine`, `npm ci`, `npm run dev -- --host 0.0.0.0` on `5173`
* Mounts `. :/app` + anonymous `/app/node_modules` for HMR

**Option B — run frontend alongside full stack (two terminals):**

```bash
# terminal 1 — backend
docker compose up --build -d          # from root

# terminal 2 — frontend
cd frontend
docker compose up --build -d          # http://localhost:5173
```

> Frontend talks to `http://localhost:8000` when the API is used (TanStack Query / Axios ready, currently mock data).

---

## Run Frontend without Docker (local)

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173 (Vite HMR)
npm run build      # production build -> dist/
npm run lint       # oxlint
npm run preview    # serve dist
```

Vite config is in `frontend/vite.config.ts` (`@tailwindcss/vite` + `@vitejs/plugin-react`). No `.env` required for the current mock-data prototype.

---

## Run Backend without Docker (local)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# requires local Postgres+PostGIS and Redis if you don't use docker compose
```

---

## Dataset

`dataset/` contains the curated prototype (India, 2024):

* `pyroclass_20_sites_geospatial_final.csv` / `.geojson` / `pyroclass_20_prototype_candidates.csv`
* Enrichment scripts: `clean_firms.py`, `osm_enrichment.py`, `finalize_geospatial_dataset.py`

Mounted into API at `/app/dataset` (see root `docker-compose.yml:29`).

---

## Troubleshooting

* **Port already in use:** `lsof -i :5173` / `:8000` / `:5432` then kill or change `ports:` in `docker-compose.yml`
* **DB not ready:** `docker compose logs postgres`; API `depends_on` waits for container start, not readiness — retry `curl /health` after 5–10s
* **Frontend not hot-reloading:** ensure volume `- /app/node_modules` is present (see `frontend/docker-compose.yml:8`)
* **Rebuild after dep change:** `docker compose up --build` or `docker compose build --no-cache`
* **Clean slate:** `docker compose down -v && docker system prune -f`

---

## API Quick Check

```bash
curl http://localhost:8000/
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/hotspots  # when routes are implemented
```

---

## License / Attribution

* FIRMS: NASA EOSDIS
* Basemap: © OpenStreetMap contributors (MapLibre, no API key)
* Prototype geography: India only (see `Reference/ProjectSummary.md`)
