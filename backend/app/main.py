"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import init_db
from .routers import (
    family_members,
    caregivers,
    medications,
    assignments,
    administrations,
    inventory,
    export
)

# Initialize database
init_db()

# Create FastAPI app
app = FastAPI(title="Home Medication Tracker API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(family_members.router)
app.include_router(caregivers.router)
app.include_router(medications.router)
app.include_router(assignments.router)
app.include_router(administrations.router)
app.include_router(inventory.router)
app.include_router(export.router)

# Serve static files (frontend)
# In Docker, frontend is mounted at /app/static
static_dir = "/app/static"
if os.path.exists(static_dir):
    # Mount static files with proper configuration
    # html=False prevents serving index.html for missing files
    app.mount("/static", StaticFiles(directory=static_dir, html=False), name="static")
    
@app.get("/")
def read_root():
    """Serve the main frontend page."""
    static_dir = "/app/static"
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return {"message": "Frontend not found"}


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

