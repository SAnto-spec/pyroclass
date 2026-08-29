# PyroClass Frontend — Geospatial Thermal Anomaly Dashboard

React 19 + TypeScript + Vite + Tailwind CSS 4 + MapLibre GL GIS dashboard for the PyroClass platform (India, NASA FIRMS + OSM).

This is the **frontend** package inside the `pyroclass/` monorepo. The root `docker-compose.yml` runs Postgres/Redis/API; this folder can run standalone with Docker or locally.

---

## Prerequisites

* Docker + Docker Compose v2 **or** Node >= 20 / npm >= 10
* No API key — basemap is OpenStreetMap raster via MapLibre

---

## Run with Docker (recommended)

From this folder (`pyroclass/frontend/`):

```bash
docker compose up --build -d
# open http://localhost:5173
docker compose logs -f frontend
docker compose down
```

`Dockerfile` (`node:24-alpine`):
```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm","run","dev","--","--host","0.0.0.0"]
```

`docker-compose.yml` mounts source for HMR:
```yaml
services:
  frontend:
    build: .
    ports: ["5173:5173"]
    volumes: [".:/app", "/app/node_modules"]
```

To run alongside the full stack:

```bash
# root
docker compose up --build -d        # postgres:5432, redis:6379, api:8000
# frontend
cd frontend && docker compose up --build -d   # :5173
```

---

## Run without Docker

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serve dist
npm run lint       # oxlint
```

---

## Routes

All navigation is mock-data driven (no backend required for UI):

* `/` → `/dashboard`
* `/dashboard` — Operational overview + MapLibre map (24 anomalies / 12 facilities / 12 persistent sources)
* `/anomalies` — Filters (search/classification/confidence/date/FRP/region) + table + detail + map
* `/facilities` — Facility list + detail + map
* `/sources` — Persistent sources + timeline + map
* `/alerts` — Alert list with local acknowledge/resolve

---

## Tech Notes

* **Map:** `maplibre-gl@6` + OSM raster (`a/b/c.tile.openstreetmap.org`), `vite.config.ts` excludes `maplibre-gl` from dep optimization for worker (`dist/maplibre-gl-worker.mjs`)
* **State:** Zustand (`src/store/uiStore.ts`) for sidebar; TanStack Query ready for future FastAPI
* **Styling:** Tailwind 4 via `@tailwindcss/vite`, dark slate operational theme
* **Ports:** Vite `5173` (see `vite.config.ts`)

---

## Troubleshooting

* Port conflict: `lsof -i :5173`
* HMR not updating: keep `volumes: - /app/node_modules`
* After `package.json` change: `docker compose up --build`
