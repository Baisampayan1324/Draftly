from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import UserPreferences

router = APIRouter(prefix="/preferences", tags=["preferences"])

class PreferencesUpdate(BaseModel):
    default_tone: str
    style_notes: str
    domain_context: str
    signature: str
    auto_draft: bool
    deadline_reminder: bool

@router.get("/")
def get_preferences(db: Session = Depends(get_db)):
    user_id = "default_user"
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    if not prefs:
        prefs = UserPreferences(user_id=user_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs

@router.post("/")
def update_preferences(prefs: PreferencesUpdate, db: Session = Depends(get_db)):
    user_id = "default_user"
    db_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    if not db_prefs:
        db_prefs = UserPreferences(user_id=user_id)
        db.add(db_prefs)
    
    db_prefs.default_tone = prefs.default_tone
    db_prefs.style_notes = prefs.style_notes
    db_prefs.domain_context = prefs.domain_context
    db_prefs.signature = prefs.signature
    db_prefs.auto_draft = prefs.auto_draft
    db_prefs.deadline_reminder = prefs.deadline_reminder
    
    db.commit()
    db.refresh(db_prefs)
    return db_prefs
