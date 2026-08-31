# Database bootstrap and migrations

`database/init.sql` is the bootstrap schema for a new Docker Postgres
volume. Docker runs it only when `postgres_data` is created for the first
time; changing that file does not update an existing database.

The repository does not currently have a general migration runner or a
migration ledger. `backend/scheduler/run_pipeline.py` applies only
`backend/migrations/006_real_spatial_match.sql` as a recurring spatial
matching data operation. Migrations `006` through `012` are data/backfill
operations and are not bootstrap migrations.

## Existing databases

Apply `backend/migrations/013_classification_details.sql` once to an
existing database before using the current classification API. It safely
renames the legacy `classifications.classification` column to
`predicted_class` when needed and adds the ML/API detail columns.

From the repository root, with the Postgres service running:

```sh
docker compose exec -T postgres psql -U pyroclass -d pyroclass \
  -f /dev/stdin < backend/migrations/013_classification_details.sql
```

Migration 013 is idempotent for the classification schema it manages. It
does not run automatically, and the command above does not apply the
data/backfill migrations.

## Fresh Docker databases

For a newly created `postgres_data` volume, `database/init.sql` already
creates the classification schema expected by the current API, including
`predicted_class`, its ML/API detail columns, and `hotspots.daynight`.
