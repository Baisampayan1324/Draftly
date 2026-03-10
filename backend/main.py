from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from database import engine, Base
from scheduler import scheduler
from routers import auth, inbox, draft, schedule, preferences

logger = logging.getLogger(__name__)

# Create tables at module load time (before workers fork when using --preload)
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning(f"Table creation skipped (may already exist): {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        scheduler.start()
    except Exception as e:
        logger.warning(f"Scheduler start skipped: {e}")
    yield
    try:
        scheduler.shutdown()
    except Exception:
        pass

app = FastAPI(title="Draftly API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(inbox.router)
app.include_router(draft.router)
app.include_router(schedule.router)
app.include_router(preferences.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
