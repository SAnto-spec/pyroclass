from fastapi import FastAPI

from routes.hotspots import router as hotspots_router
from routes.classifications import router as classifications_router
from routes.facilities import router as facilities_router


app = FastAPI(
    title="PyroClass API",
    version="0.1.0"
)


@app.get("/")
def root():
    return {
        "project": "PyroClass",
        "status": "running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


app.include_router(hotspots_router)
app.include_router(classifications_router)
app.include_router(facilities_router)
