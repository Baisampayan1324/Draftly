from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from sqlalchemy.orm import Session
import os

from database import SessionLocal, get_db
from models import ScheduledEmail, Attachment
from gmail import send_email, get_credentials
from utils.attachments import cleanup_attachments

jobstores = {
    'default': SQLAlchemyJobStore(url=os.getenv("DATABASE_URL", "sqlite:///draftly.db"))
}

scheduler = AsyncIOScheduler(jobstores=jobstores)

def send_scheduled_email(schedule_id: int):
    db = SessionLocal()
    try:
        scheduled_db = db.query(ScheduledEmail).filter(ScheduledEmail.id == schedule_id).first()
        if not scheduled_db or scheduled_db.status != "scheduled":
            return

        creds = get_credentials(db)
        if not creds:
            print("No credentials to send scheduled email")
            return

        attachments = db.query(Attachment).filter(Attachment.thread_id == scheduled_db.thread_id).all()
        att_dicts = [
            {
                "filepath": a.filepath,
                "filename": a.filename,
                "mimetype": a.mimetype
            }
            for a in attachments
        ]

        send_email(
            token=creds,
            to=scheduled_db.recipient,
            subject=scheduled_db.subject,
            body=scheduled_db.body,
            attachments=att_dicts,
            reply_to_thread_id=None
        )

        scheduled_db.status = "sent"
        db.commit()

        cleanup_attachments(scheduled_db.thread_id)
    except Exception as e:
        print(f"Error sending scheduled email: {e}")
    finally:
        db.close()
