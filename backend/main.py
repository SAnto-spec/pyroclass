from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.hotspots import router as hotspots_router
from routes.classifications import router as classifications_router
from routes.facilities import router as facilities_router
from routes.risk import router as risk_router


app = FastAPI(
    title="PyroClass API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(risk_router)
