import os
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import GmailToken

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify"
]

def get_credentials(db: Session, user_id: str = "default_user"):
    token_record = db.query(GmailToken).filter(GmailToken.user_id == user_id).first()
    if not token_record:
        return None

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    creds = Credentials(
        token=token_record.access_token,
        refresh_token=token_record.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_record.access_token = creds.token
        token_record.token_expiry = creds.expiry
        db.commit()

    return creds

def get_unread_emails(token: Credentials):
    service = build('gmail', 'v1', credentials=token)
    results = service.users().messages().list(userId='me', q='is:unread').execute()
    messages = results.get('messages', [])
    
    unread_emails = []
    for msg in messages:
        try:
            message = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
            payload = message.get('payload', {})
            headers = payload.get('headers', [])
            
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
            date_sent = next((h['value'] for h in headers if h['name'] == 'Date'), '')

            snippet = message.get('snippet', '')
            
            body = ''
            if 'parts' in payload:
                for part in payload['parts']:
                    if part['mimeType'] == 'text/plain' and 'data' in part['body']:
                        body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                        break
            elif 'body' in payload and 'data' in payload['body']:
                body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')

            unread_emails.append({
                "id": message['id'],
                "gmail_thread_id": message['threadId'],
                "sender": sender,
                "subject": subject,
                "snippet": snippet,
                "body": body,
                "timestamp": date_sent,
                "is_unread": True
            })
        except Exception as e:
            print(f"Error fetching message {msg['id']}: {e}")

    return unread_emails

def send_email(token: Credentials, to: str, subject: str, body: str, attachments: list[dict] = None, reply_to_thread_id: str = None):
    service = build('gmail', 'v1', credentials=token)
    
    msg = MIMEMultipart("mixed")
    if to:
        msg['To'] = to
    msg['Subject'] = subject
    
    # Convert plain text newlines to HTML line breaks for proper formatting
    html_body = body.replace('\n', '<br>\n')
    msg.attach(MIMEText(html_body, 'html'))

    if attachments:
        for att in attachments:
            filepath = att.get("filepath")
            filename = att.get("filename")
            mimetype = att.get("mimetype", "application/octet-stream")
            if os.path.exists(filepath):
                with open(filepath, "rb") as f:
                    part = MIMEBase(*mimetype.split('/', 1))
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
                    msg.attach(part)

    if reply_to_thread_id:
        msg['In-Reply-To'] = reply_to_thread_id
        msg['References'] = reply_to_thread_id
        
    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
    send_body = {'raw': raw_message}
    if reply_to_thread_id:
        send_body['threadId'] = reply_to_thread_id

    sent_message = service.users().messages().send(userId='me', body=send_body).execute()
    
    if reply_to_thread_id:
        try:
            service.users().threads().modify(
                userId='me', 
                id=reply_to_thread_id, 
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
        except Exception:
            pass

    return sent_message

def get_sent_emails(token: Credentials, max_results: int = 20):
    """Fetch sent emails from Gmail"""
    service = build('gmail', 'v1', credentials=token)
    results = service.users().messages().list(userId='me', q='in:sent', maxResults=max_results).execute()
    messages = results.get('messages', [])
    
    sent_emails = []
    for msg in messages:
        try:
            message = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
            payload = message.get('payload', {})
            headers = payload.get('headers', [])
            
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
            to = next((h['value'] for h in headers if h['name'] == 'To'), 'Unknown Recipient')
            date_sent = next((h['value'] for h in headers if h['name'] == 'Date'), '')

            snippet = message.get('snippet', '')
            
            body = ''
            if 'parts' in payload:
                for part in payload['parts']:
                    if part['mimeType'] == 'text/plain' and 'data' in part['body']:
                        body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                        break
                    elif part['mimeType'] == 'text/html' and 'data' in part['body']:
                        body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
            elif 'body' in payload and 'data' in payload['body']:
                body = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')

            sent_emails.append({
                "id": message['id'],
                "gmail_thread_id": message['threadId'],
                "recipient": to,
                "subject": subject,
                "snippet": snippet,
                "body": body,
                "timestamp": date_sent,
            })
        except Exception as e:
            print(f"Error fetching sent message {msg['id']}: {e}")

    return sent_emails
