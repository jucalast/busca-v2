from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import sys

from app.core.auth_middleware import get_current_user
from app.services.core.billing import create_checkout_session, handle_webhook_event

router = APIRouter()

class CheckoutRequest(BaseModel):
    domain_url: str

@router.post("/create-checkout-session")
def create_checkout(req: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    """Creates a Stripe Checkout Session for subscription."""
    user_id = current_user.get("id")
    email = current_user.get("email")
    
    if not user_id or not email:
        raise HTTPException(status_code=401, detail="User tracking failed")
        
    result = create_checkout_session(user_id, email, req.domain_url)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
        
    return {"checkoutUrl": result.get("checkout_url")}

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook ingestion endpoint."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing signature")
        
    result = handle_webhook_event(payload, sig_header)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
        
    return JSONResponse(content={"status": "success"})
