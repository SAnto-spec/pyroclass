# Industrial facility seed data placeholder

No industrial facility records are seeded by this repository at present.
In particular, the six facility records described in earlier project
history are unavailable in version-controlled sources and must not be
reconstructed from hotspot data or frontend mock data.

When an authoritative, reviewed source is available, add the records in a
versioned seed or migration at this location. Each record must provide:

- `name`
- `facility_type`
- `latitude`
- `longitude`
- `osm_id` (when available)
- `wikidata_id` (when available)
- `operator` (when available)
- `source`

The source provenance and review date should be recorded with the seed.
Do not use `frontend/src/mocks/facilities.ts` as backend seed data unless
that data is separately verified and explicitly approved.
