from fastapi import APIRouter
from database.connection import get_connection

router = APIRouter(prefix="/facilities", tags=["Facilities"])

columns = [
    "facility_id", "name", "facility_type", "latitude", "longitude",
    "osm_id", "wikidata_id", "operator", "source",
]

@router.get("/")
def get_facilities():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT {', '.join(columns)} FROM industrial_facilities ORDER BY facility_id;")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(zip(columns, row)) for row in rows]

@router.get("/{facility_id}")
def get_facility(facility_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT {', '.join(columns)} FROM industrial_facilities WHERE facility_id = %s;", (facility_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row is None:
        return {"error": "Facility not found", "facility_id": facility_id}
    return dict(zip(columns, row))
