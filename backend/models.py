from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from database import Base

class UserPreferences(Base):
    __tablename__ = "user_preferences"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    default_tone = Column(String, default="professional")
    style_notes = Column(String, default="")
    domain_context = Column(String, default="")
    signature = Column(String, default="")
    auto_draft = Column(Boolean, default=False)
    deadline_reminder = Column(Boolean, default=False)

class ScheduledEmail(Base):
    __tablename__ = "scheduled_emails"
    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(String, index=True)
    recipient = Column(String, nullable=True)
    subject = Column(String)
    body = Column(String)
    send_at = Column(DateTime)
    status = Column(String, default="scheduled")
    created_at = Column(DateTime, default=datetime.utcnow)

class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(String, index=True)
    filename = Column(String)
    filepath = Column(String)
    mimetype = Column(String)
    size_bytes = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

class GmailToken(Base):
    __tablename__ = "gmail_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    access_token = Column(String)
    refresh_token = Column(String)
    token_expiry = Column(DateTime)

class OAuthState(Base):
    """Store OAuth state and code verifier to survive server restarts"""
    __tablename__ = "oauth_states"
    id = Column(Integer, primary_key=True, index=True)
    state = Column(String, unique=True, index=True)
    code_verifier = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
