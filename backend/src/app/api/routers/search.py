from fastapi import APIRouter
from app.schemas.requests import SearchRequest
from app.services.search_service import search_simple, search_business

router = APIRouter()

@router.post("/simple")
def do_simple_search(req: SearchRequest):
    # Pass dict representation
    return search_simple(req.dict())

@router.post("/business")
def do_business_search(req: SearchRequest):
    return search_business(req.dict())
