from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session
import os
import urllib.parse
import uuid

from database import get_db
from models import GmailToken, OAuthState
from gmail import SCOPES

router = APIRouter(prefix="/auth/gmail", tags=["auth"])

class AuthStartRequest(BaseModel):
    thread_id: str | None = None

@router.post("/start")
def start_auth(req: AuthStartRequest = None, db: Session = Depends(get_db)):
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")]
        }
    }
    base_state = req.thread_id if req and req.thread_id else "nostate"
    state_str = f"{base_state}::{uuid.uuid4().hex}"
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"))
    auth_url, state = flow.authorization_url(prompt='consent', access_type='offline', state=state_str)
    
    # Store PKCE code verifier in database so it survives server restarts
    if hasattr(flow, 'code_verifier') and flow.code_verifier:
        oauth_state = OAuthState(state=state, code_verifier=flow.code_verifier)
        db.add(oauth_state)
        db.commit()
        
    return {"auth_url": auth_url}

@router.post("/disconnect")
def disconnect_auth(db: Session = Depends(get_db)):
    db.query(GmailToken).filter(GmailToken.user_id == "default_user").delete()
    db.commit()
    return {"status": "disconnected"}

@router.get("/callback")
def auth_callback(code: str, state: str = None, db: Session = Depends(get_db)):
    client_config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI")]
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES, redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"))
    
    # Retrieve stored code verifier from database
    oauth_state = db.query(OAuthState).filter(OAuthState.state == state).first()
    if oauth_state:
        flow.code_verifier = oauth_state.code_verifier
        db.delete(oauth_state)
        db.commit()
        
    flow.fetch_token(code=code)
    credentials = flow.credentials
    
    user_id = "default_user"
    token_db = db.query(GmailToken).filter(GmailToken.user_id == user_id).first()
    if not token_db:
        token_db = GmailToken(user_id=user_id)
        db.add(token_db)
    
    token_db.access_token = credentials.token
    token_db.refresh_token = credentials.refresh_token
    token_db.token_expiry = credentials.expiry
    
    db.commit()
    
    # Fetch user profile information
    user_name = ""
    user_email = ""
    user_picture = ""
    try:
        service = build('oauth2', 'v2', credentials=credentials)
        profile = service.userinfo().get().execute()
        user_name = profile.get('name', '')
        user_email = profile.get('email', '')
        user_picture = profile.get('picture', '')
    except Exception:
        pass  # Continue even if profile fetch fails
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    
    # Build redirect URL with user info
    params = {
        "connected": "true",
        "user_name": urllib.parse.quote(user_name, safe=''),
        "user_email": urllib.parse.quote(user_email, safe=''),
        "user_picture": urllib.parse.quote(user_picture, safe=''),
    }
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    
    return RedirectResponse(url=f"{frontend_url}/auth/callback?{query_string}")
