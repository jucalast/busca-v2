from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import growth, search

app = FastAPI(title="Busca V2 Backend API", version="1.0.0")

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(growth.router, prefix="/api/v1/growth", tags=["Growth"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
