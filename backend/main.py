from fastapi import FastAPI

from routes.hotspots import router as hotspots_router


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