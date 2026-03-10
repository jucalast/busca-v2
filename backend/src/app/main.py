import logging
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
import os
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

from app.api.routers import growth, search
from app.core.database import init_db

# Configurar logging para reduzir ruído
logging.basicConfig(
    level=logging.WARNING,  # Reduzir de INFO para WARNING
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)

# Silenciar loggers específicos que geram muito ruído
logging.getLogger('httpx').setLevel(logging.ERROR)
logging.getLogger('primp').setLevel(logging.ERROR)
logging.getLogger('ddgs').setLevel(logging.ERROR)
logging.getLogger('groq._base_client').setLevel(logging.ERROR)
logging.getLogger('trafilatura').setLevel(logging.CRITICAL)
logging.getLogger('trafilatura.core').setLevel(logging.CRITICAL)
logging.getLogger('trafilatura.downloads').setLevel(logging.CRITICAL)

app = FastAPI(title="Busca V2 Backend API", version="1.0.0")

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routers import growth, search, billing_router

app.include_router(growth.router, prefix="/api/v1/growth", tags=["Growth"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
app.include_router(billing_router.router, prefix="/api/v1/billing", tags=["Billing"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
