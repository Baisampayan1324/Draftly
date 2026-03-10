from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from gmail import get_unread_emails, get_sent_emails, get_credentials

router = APIRouter(prefix="/inbox", tags=["inbox"])

@router.get("/")
def get_inbox(db: Session = Depends(get_db)):
    creds = get_credentials(db)
    if not creds:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    emails = get_unread_emails(creds)
    return emails

@router.get("/sent")
def get_sent(db: Session = Depends(get_db)):
    creds = get_credentials(db)
    if not creds:
        raise HTTPException(status_code=401, detail="Gmail not authenticated")
    emails = get_sent_emails(creds)
    return emails
