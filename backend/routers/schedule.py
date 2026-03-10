from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import ScheduledEmail
from scheduler import scheduler, send_scheduled_email
from graph import graph

router = APIRouter(prefix="/schedule", tags=["schedule"])

class ScheduleRequest(BaseModel):
    thread_id: str
    send_at: datetime

@router.post("/")
def create_schedule(req: ScheduleRequest, db: Session = Depends(get_db)):
    config = {"configurable": {"thread_id": req.thread_id}}
    state = graph.get_state(config)
    if not state.values:
        raise HTTPException(status_code=404, detail="LangGraph thread_id not found")
        
    vals = state.values
    recipient = vals.get("recipient")
    
    draft = vals.get("draft", "")
    subject = "Scheduled Email"
    body = draft
    lines = draft.split("\n", 1)
    if lines and lines[0].lower().startswith("subject:"):
        subject = lines[0][8:].strip()
        body = lines[1].strip() if len(lines) > 1 else ""

    scheduled = ScheduledEmail(
        thread_id=req.thread_id,
        recipient=recipient,
        subject=subject,
        body=body,
        send_at=req.send_at,
        status="scheduled"
    )
    db.add(scheduled)
    db.commit()
    db.refresh(scheduled)
    
    scheduler.add_job(
        send_scheduled_email,
        trigger="date",
        run_date=req.send_at,
        args=[scheduled.id],
        id=str(scheduled.id)
    )
    
    return {"status": "scheduled", "id": scheduled.id}
    
@router.get("/scheduled")
def list_scheduled(db: Session = Depends(get_db)):
    return db.query(ScheduledEmail).all()

@router.delete("/{id}")
def delete_scheduled(id: int, db: Session = Depends(get_db)):
    scheduled = db.query(ScheduledEmail).filter(ScheduledEmail.id == id).first()
    if not scheduled:
        raise HTTPException(status_code=404, detail="Not found")
        
    scheduled.status = "cancelled"
    db.commit()
    
    try:
        scheduler.remove_job(str(id))
    except Exception:
        pass
        
    return {"status": "cancelled"}
