from fastapi import APIRouter, Depends, Form, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Any, cast
import uuid

from database import get_db
from models import UserPreferences, Attachment as AttachmentModel, ScheduledEmail
from graph import graph, EmailState
from utils.attachments import save_attachments, extract_text, cleanup_attachments
from gmail import get_credentials, send_email

router = APIRouter(tags=["draft"])

@router.post("/start")
async def start_draft(
    topic: str = Form(...),
    recipient: Optional[str] = Form(None),
    tone: str = Form("professional"),
    context: Optional[str] = Form(""),
    gmail_thread_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    thread_id = str(uuid.uuid4())
    
    if files and len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 attachments allowed")
        
    attachment_filenames = []
    attachment_texts = []
    
    if files and any(f.filename for f in files):
        allowed_types = [
            "application/pdf", 
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
            "image/png", 
            "image/jpeg", 
            "text/plain"
        ]
        
        valid_files = []
        for f in files:
            if f.filename:
                valid_files.append(f)
                
        saved_files = save_attachments(valid_files, thread_id)
        for f in saved_files:
            if f["size_bytes"] > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail=f"File {f['filename']} exceeds 10MB limit")
                
            db_att = AttachmentModel(
                thread_id=thread_id,
                filename=f["filename"],
                filepath=f["filepath"],
                mimetype=f["mimetype"],
                size_bytes=f["size_bytes"]
            )
            db.add(db_att)
            
            extracted = extract_text(f["filepath"], f["mimetype"])
            attachment_filenames.append(f["filename"])
            if extracted:
                attachment_texts.append(extracted)
        db.commit()

    user_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == "default_user").first()
    
    state: dict[str, Any] = {
        "topic": topic,
        "recipient": recipient or "",
        "tone": tone,
        "context": context or "",
        "attachment_texts": attachment_texts,
        "attachment_filenames": attachment_filenames,
        "gmail_thread_id": gmail_thread_id or "",
        "style_notes": user_prefs.style_notes if user_prefs else "",
        "domain_context": user_prefs.domain_context if user_prefs else "",
        "signature": user_prefs.signature if user_prefs else "",
        "iteration": 0
    }
    
    config: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
    
    # Run graph until interrupt
    for _ in graph.stream(state, config):  # type: ignore[arg-type]
        pass
        
    current_state = graph.get_state(config)  # type: ignore[arg-type]
    vals = current_state.values
    return {
        "thread_id": thread_id,
        "draft": vals.get("draft"),
        "iteration": vals.get("iteration"),
        "status": "awaiting_review"
    }

@router.post("/review/{thread_id}")
async def review_draft(
    thread_id: str,
    decision: str = Form(...),
    feedback: Optional[str] = Form(""),
    recipient: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    if decision not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Decision must be 'approve' or 'reject'")
        
    config: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
    current_state = graph.get_state(config)  # type: ignore[arg-type]
    if not current_state.values:
        raise HTTPException(status_code=404, detail="LangGraph thread_id not found")
    
    # Update recipient if provided
    if recipient:
        graph.update_state(config, {"recipient": recipient})  # type: ignore[arg-type]
        
    if files and any(f.filename for f in files):
        saved_files = save_attachments([f for f in files if f.filename], thread_id)
        for f in saved_files:
            if f["size_bytes"] > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail=f"File {f['filename']} exceeds 10MB limit")
            db_att = AttachmentModel(
                thread_id=thread_id,
                filename=f["filename"],
                filepath=f["filepath"],
                mimetype=f["mimetype"],
                size_bytes=f["size_bytes"]
            )
            db.add(db_att)
        db.commit()

    # Resume graph with decision
    graph.update_state(config, {"decision": decision, "human_feedback": feedback})  # type: ignore[arg-type]
    for _ in graph.stream(None, config):  # type: ignore[arg-type]
        pass
        
    next_state = graph.get_state(config)  # type: ignore[arg-type]
    vals = next_state.values
    is_finished = len(next_state.next) == 0

    if decision == "approve" and is_finished:
        scheduled = db.query(ScheduledEmail).filter(ScheduledEmail.thread_id == thread_id).first()
        if scheduled is not None and str(scheduled.status) == "scheduled":
            scheduled.body = vals.get("final_email", "")  # type: ignore[assignment]
            db.commit()
            return {"status": "scheduled"}
            
        creds = get_credentials(db)
        if not creds:
             return {"status": "approved", "final_email": vals.get("final_email", "")}
        
        recipient_email = vals.get("recipient")
        if not recipient_email:
            return {
                "status": "needs_gmail",
                "final_email": vals.get("final_email", ""),
                "message": "Connect Gmail to send"
            }
             
        attachments = db.query(AttachmentModel).filter(AttachmentModel.thread_id == thread_id).all()
        att_dicts = [{"filepath": a.filepath, "filename": a.filename, "mimetype": a.mimetype} for a in attachments]
        
        final_email = vals.get("final_email", "")
        subject = "Draft Email"
        body = final_email
        lines = final_email.split("\n", 1)
        if lines and lines[0].lower().startswith("subject:"):
            subject = lines[0][8:].strip()
            body = lines[1].strip() if len(lines) > 1 else ""
        
        gmail_thread_id = vals.get("gmail_thread_id", "") or ""
        send_email(
            token=creds,
            to=recipient_email,
            subject=subject,
            body=body,
            attachments=att_dicts,
            reply_to_thread_id=gmail_thread_id if gmail_thread_id else None  # type: ignore[arg-type]
        )
        cleanup_attachments(thread_id)
        return {"status": "sent", "final_email": final_email}
        
    else:
        return {
            "status": "awaiting_review",
            "draft": vals.get("draft"),
            "iteration": vals.get("iteration")
        }
