from fastapi import FastAPI

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