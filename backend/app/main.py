from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, ipam, search
from app.core.config import settings

app = FastAPI(title="mini-ipam", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(ipam.router, prefix="/api")
app.include_router(search.router, prefix="/api")


@app.on_event("startup")
def startup_tasks() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

