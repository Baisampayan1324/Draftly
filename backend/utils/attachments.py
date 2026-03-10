import os
import shutil
import tempfile
import pdfplumber
import docx

def get_attachments_dir(thread_id: str) -> str:
    """Get cross-platform temp directory for attachments"""
    base_dir = os.path.join(tempfile.gettempdir(), "draftly_attachments", thread_id)
    return base_dir

def save_attachments(files, thread_id: str):
    base_dir = get_attachments_dir(thread_id)
    os.makedirs(base_dir, exist_ok=True)
    
    saved_files = []
    for file in files:
        filepath = os.path.join(base_dir, file.filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        size_bytes = os.path.getsize(filepath)
        saved_files.append({
            "filename": file.filename,
            "filepath": filepath,
            "mimetype": file.content_type,
            "size_bytes": size_bytes
        })
    return saved_files

def extract_text(filepath: str, mimetype: str) -> str | None:
    if "pdf" in mimetype:
        try:
            text = ""
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() + "\n"
            return text[:3000]
        except Exception:
            return None
    elif "text/plain" in mimetype:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return f.read()[:3000]
        except Exception:
            return None
    elif "document" in mimetype or "docx" in mimetype:
        try:
            doc = docx.Document(filepath)
            text = "\n".join([p.text for p in doc.paragraphs])
            return text[:3000]
        except Exception:
            return None
    return None

def cleanup_attachments(thread_id: str):
    base_dir = get_attachments_dir(thread_id)
    if os.path.exists(base_dir):
        shutil.rmtree(base_dir)
