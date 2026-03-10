# Draftly — Human-in-the-Loop Email Drafting App

---

## What is Draftly?

Draftly is a **Human-in-the-Loop (HITL)** email drafting application where an AI generates email drafts and a human reviews, approves, or rejects them with feedback. If rejected, the AI redrafts incorporating the feedback. The loop continues until the human approves.

The entire workflow is orchestrated using **LangGraph's `interrupt_before`** — the graph literally pauses mid-execution, waits for a human decision, then resumes exactly where it left off.

---

## Assignment Requirements

| Requirement                    | Status | How                                                      |
| ------------------------------ | ------ | -------------------------------------------------------- |
| HITL app using LangGraph       | ✅     | Full `StateGraph` with `SqliteSaver` checkpointing       |
| AI drafts an email             | ✅     | Groq `llama-3.1-8b-instant` via `langchain-groq`         |
| Human approves or rejects      | ✅     | `POST /review/{thread_id}` with `decision` field         |
| Reject with feedback → redraft | ✅     | `human_feedback` injected into next `draft_email` call   |
| Uses `interrupt_before`        | ✅     | `interrupt_before=["human_review"]` in `graph.compile()` |
| Working app                    | ✅     | FastAPI backend + React/Vite/Lovable frontend            |
| README explaining the graph    | ✅     | This document                                            |

---

## The LangGraph HITL Workflow

### High-Level Flow

```
User Input
    │
    │  topic, recipient, tone, context, attachments
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LangGraph Graph                            │
│                                                                 │
│   ┌─────────────┐                                               │
│   │   START      │                                              │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                       │
│   ┌──────────────────────────────────────────────────────┐      │
│   │                   draft_email                        │      │
│   │                                                      │      │
│   │  • Calls Groq llama-3.1-8b-instant                  │      │
│   │  • Injects: tone, style_notes, domain_context        │      │
│   │  • Injects: attachment text (PDF/DOCX/TXT)           │      │
│   │  • On redraft: injects human_feedback                │      │
│   │  • Returns: { draft, iteration }                     │      │
│   └──────────────────────┬───────────────────────────────┘      │
│                          │                                      │
│          ┌───────────────▼──────────────────┐                   │
│          │   interrupt_before fires HERE  │                   │
│          │   Graph PAUSES. State saved to    │                   │
│          │   SQLite checkpoint (draftly.db)  │                   │
│          └───────────────┬──────────────────┘                   │
│                          │                                      │
│          ┌───────────────▼──────────────────┐                   │
│          │         human_review             │                   │
│          │                                  │                   │
│          │  ← HTTP response returns draft   │                   │
│          │  ← Human reads, decides          │                   │
│          │  ← POST /review/{thread_id}      │                   │
│          │  ← graph.update_state() called   │                   │
│          │  ← graph.stream(None) resumes    │                   │
│          └───────────────┬──────────────────┘                   │
│                          │                                      │
│          ┌───────────────▼──────────────────┐                   │
│          │         review_router()           │                   │
│          └───────┬───────────────┬──────────┘                   │
│                  │               │                              │
│          "reject"│               │"approve"                     │
│                  │               │                              │
│   ┌──────────────▼──┐    ┌───────▼──────────────────┐          │
│   │  iteration < 5? │    │     finalize_email        │          │
│   └──────┬──────────┘    │                           │          │
│          │               │  final_email = draft      │          │
│    YES   │   NO          │  ready to send via Gmail  │          │
│    ┌─────▼──┐ ┌──────────▼───┐       │               │          │
│    │  loop  │ │ force finish │       └───────┬───────┘          │
│    │  back  │ └──────────────┘               │                  │
│    └────────┘         (safety cap: 5 iters)  │                  │
│         │                                    │                  │
│         └──── back to draft_email ───────────┘                  │
│                                              │                  │
│                                       ┌──────▼──────┐           │
│                                       │     END     │           │
│                                       └─────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### Sequence Diagram

```
Client              FastAPI             LangGraph            Groq LLM
  │                    │                    │                    │
  │─── POST /start ───►│                    │                    │
  │                    │── graph.stream() ─►│                    │
  │                    │                    │── draft_email() ──►│
  │                    │                    │◄── email draft ────│
  │                    │                    │                    │
  │                    │          interrupt_before fires         │
  │                    │◄── paused (draft) ─│                    │
  │◄── { thread_id,    │                    │                    │
  │      draft,        │                    │                    │
  │      iteration } ──│                    │                    │
  │                    │                    │                    │
  │  [Human Reviews]   │                    │                    │
  │                    │                    │                    │
  │─ POST /review ────►│                    │                    │
  │  { decision:       │                    │                    │
  │    "reject",       │                    │                    │
  │    feedback: "..." }│                   │                    │
  │                    │── update_state() ─►│                    │
  │                    │── stream(None) ───►│                    │
  │                    │                    │── draft_email() ──►│
  │                    │                    │  (with feedback)   │
  │                    │                    │◄── new draft ──────│
  │                    │          interrupt_before fires again   │
  │◄── { draft #2 } ───│◄── paused ─────────│                    │
  │                    │                    │                    │
  │─ POST /review ────►│                    │                    │
  │  { decision:       │                    │                    │
  │    "approve" }     │                    │                    │
  │                    │── update_state() ─►│                    │
  │                    │── stream(None) ───►│                    │
  │                    │                    │── finalize_email() │
  │                    │                    │── END              │
  │◄── { status:       │◄── final_email ────│                    │
  │      "sent" } ─────│                    │                    │
  │                    │── Gmail API send ──────────────────────►│
```

---

## Node Descriptions

### `draft_email`

| Property        | Detail                                                               |
| --------------- | -------------------------------------------------------------------- |
| **Purpose**     | Generates or regenerates the email using an LLM                      |
| **LLM**         | Groq `llama-3.1-8b-instant` (temperature: 0.85)                      |
| **First run**   | Drafts fresh email from topic, recipient, tone, context              |
| **Redraft**     | Prepends `human_feedback` with instruction to erase previous version |
| **Attachments** | Extracts text from PDF/DOCX/TXT files, injects into prompt           |
| **Preferences** | Injects `style_notes`, `domain_context`, `signature` from DB         |
| **Output**      | `Subject: [line]` first, then email body                             |
| **Returns**     | `{ draft: str, iteration: int }`                                     |

### `human_review` ← The HITL Node

| Property            | Detail                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| **Purpose**         | The pause point for human oversight                                     |
| **Node body**       | Empty — execution never reaches it due to `interrupt_before`            |
| **How it pauses**   | `interrupt_before=["human_review"]` stops graph BEFORE this node runs   |
| **State preserved** | `SqliteSaver` checkpoints full `EmailState` to `draftly.db`             |
| **How it resumes**  | `graph.update_state()` injects decision + feedback, then `stream(None)` |
| **Returns**         | `{ decision: str, human_feedback: str }`                                |

### `finalize_email`

| Property    | Detail                                       |
| ----------- | -------------------------------------------- |
| **Purpose** | Stamps the approved draft as the final email |
| **Logic**   | `final_email = state["draft"]`               |
| **Returns** | `{ final_email: str }`                       |

### `review_router()` — Conditional Edge

```python
def review_router(state: EmailState) -> str:
    if state.get("decision") == "approve":
        return "finalize_email"
    elif state.get("decision") == "reject":
        if state.get("iteration", 0) >= 5:   # safety cap
            return "finalize_email"
        return "draft_email"                  # loop back
    return "finalize_email"
```

---

## State Schema

```python
class EmailState(TypedDict, total=False):
    # Input
    topic: str                        # What the email is about
    recipient: Optional[str]          # Who it's addressed to
    tone: str                         # professional / friendly / casual / formal
    context: str                      # Additional context
    attachment_texts: list[str]       # Extracted text from PDF/DOCX/TXT files
    attachment_filenames: list[str]   # All attachment filenames

    # LangGraph loop
    draft: str                        # Current AI-generated draft
    human_feedback: Optional[str]     # Reviewer's rejection reason
    decision: Optional[str]           # "approve" or "reject"
    iteration: int                    # Draft count (capped at 5)
    final_email: Optional[str]        # Set on approval — ready to send

    # Gmail
    gmail_thread_id: Optional[str]    # For threading replies

    # User preferences (fetched from DB, injected into prompt)
    style_notes: str
    domain_context: str
    signature: str
```

---

## How `interrupt_before` Works — Step by Step

```python
# graph.py — the key compilation line
graph = builder.compile(
    checkpointer=SqliteSaver(conn),       # persists state to draftly.db
    interrupt_before=["human_review"]     # ← pauses BEFORE this node
)
```

### Full execution flow:

```
1.  Client calls POST /start
       ↓
2.  graph.stream(initial_state, config={"thread_id": "abc-123"})
       ↓
3.  draft_email node runs → LLM generates draft → state updated
       ↓
4.  LangGraph checks: next node is "human_review"
    interrupt_before=["human_review"] matches → STOP
       ↓
5.  SqliteSaver writes full EmailState to draftly.db
       ↓
6.  graph.stream() returns → POST /start returns { thread_id, draft, iteration }
       ↓
7.  Human reads draft → calls POST /review/{thread_id}
       ↓
8.  graph.update_state(config, { decision, human_feedback }, as_node="human_review")
    → injects human decision into the checkpoint
       ↓
9.  graph.stream(None, config)   ← None means "resume from checkpoint"
       ↓
10. review_router() evaluates decision:
    → "reject"  → draft_email runs again (with feedback) → interrupt again → goto 6
    → "approve" → finalize_email runs → graph reaches END
       ↓
11. final_email is returned → Gmail API sends the email
```

### Why `SqliteSaver` not `MemorySaver`?

|                         | `MemorySaver`  | `SqliteSaver`       |
| ----------------------- | -------------- | ------------------- |
| Storage                 | In-process RAM | SQLite file on disk |
| Survives server restart | ❌             | ✅                  |
| Multiple workers        | ❌             | ✅                  |
| Production ready        | ❌             | ✅                  |
| Used in Draftly         | No             | **Yes**             |

---

## API Reference

| Method   | Endpoint                 | Description                                                              |
| -------- | ------------------------ | ------------------------------------------------------------------------ |
| `POST`   | `/start`                 | Start session — runs graph until interrupt, returns draft                |
| `POST`   | `/review/{thread_id}`    | Resume graph with approve/reject + feedback                              |
| `POST`   | `/auth/gmail/start`      | Get Google OAuth URL                                                     |
| `GET`    | `/auth/gmail/callback`   | Handle OAuth, store token, auto-send pending email, redirect to frontend |
| `POST`   | `/auth/gmail/disconnect` | Disconnect Gmail account                                                 |
| `GET`    | `/inbox`                 | Fetch unread Gmail messages                                              |
| `POST`   | `/schedule/`             | Schedule approved email for future send                                  |
| `GET`    | `/schedule/scheduled`    | List all scheduled emails                                                |
| `DELETE` | `/schedule/{id}`         | Cancel a scheduled send                                                  |
| `GET`    | `/preferences`           | Get user AI preferences                                                  |
| `POST`   | `/preferences`           | Save user AI preferences                                                 |
| `GET`    | `/health`                | Health check                                                             |

### Example — Full HITL flow via curl

```bash
# 1. Start — AI generates first draft
curl -X POST http://localhost:8000/start \
  -F "topic=Request a deadline extension for the Q3 report" \
  -F "recipient=My manager Sarah" \
  -F "tone=professional"

# Response:
# { "thread_id": "abc-123", "draft": "Subject: ...", "iteration": 1 }

# 2. Reject with feedback
curl -X POST http://localhost:8000/review/abc-123 \
  -F "decision=reject" \
  -F "feedback=Too formal. Make it warmer and mention the specific date."

# Response:
# { "status": "awaiting_review", "draft": "Subject: ...", "iteration": 2 }

# 3. Approve
curl -X POST http://localhost:8000/review/abc-123 \
  -F "decision=approve" \
  -F "recipient=sarah@company.com"

# Response:
# { "status": "sent", "final_email": "Subject: ..." }
```

### OAuth Auto-Send Flow (Frontend)

When Gmail is not connected, the frontend stores pending email data in localStorage before OAuth:

```
1. User generates draft → Approves → Enters recipient
2. Clicks "Connect Gmail & Send"
3. Frontend stores { thread_id, recipient } in localStorage
4. Redirects to Google OAuth
5. After OAuth callback, frontend reads localStorage
6. Calls POST /review/{thread_id} with recipient to send
7. Email sent → Redirects to /inbox
```

---

## Project Structure

```
draftly/
├── backend/
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py          # Gmail OAuth routes (start, callback, disconnect)
│   │   ├── draft.py         # /start and /review — core HITL endpoints
│   │   ├── inbox.py         # Gmail inbox reader
│   │   ├── preferences.py   # User preferences CRUD
│   │   └── schedule.py      # Scheduled send management
│   ├── utils/
│   │   ├── __init__.py
│   │   └── attachments.py   # File save, text extract, cleanup (cross-platform)
│   ├── graph.py             # ← LangGraph HITL graph (the core)
│   ├── main.py              # FastAPI app + router registration
│   ├── gmail.py             # Gmail API helpers + OAuth
│   ├── scheduler.py         # APScheduler for timed sends
│   ├── models.py            # SQLAlchemy DB models
│   ├── database.py          # SQLite engine + session
│   ├── draftly.db           # SQLite database (auto-created)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/           # LandingPage, InboxPage, ComposePage, AuthCallbackPage, etc.
    │   ├── components/      # AppLayout, Sidebar, DraftReview, FileUploadZone
    │   ├── lib/api.ts       # All backend API call functions
    │   └── store/           # Zustand global state (gmailConnected, draftSession)
    ├── package.json
    └── vite.config.ts       # Runs on port 8080
```

---

## Setup & Run

### Prerequisites

- Python 3.11+
- Node.js 18+
- A free [Groq API key](https://console.groq.com)
- A Google Cloud project with OAuth 2.0 credentials

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure .env
cp .env.example .env
# Fill in: GROQ_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

uvicorn main:app --reload --port 8000
# API docs at: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs at: http://localhost:8080
```

---

## Environment Variables

| Variable               | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `GROQ_API_KEY`         | Free key from [console.groq.com](https://console.groq.com) |
| `GOOGLE_CLIENT_ID`     | Google Cloud OAuth 2.0 client ID                           |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth 2.0 client secret                       |
| `GOOGLE_REDIRECT_URI`  | `http://localhost:8000/auth/gmail/callback`                |
| `DATABASE_URL`         | `sqlite:///draftly.db` (default)                           |
| `FRONTEND_URL`         | `http://localhost:8080`                                    |

---

## Tech Stack

| Layer         | Technology                  | Why                                            |
| ------------- | --------------------------- | ---------------------------------------------- |
| Graph / HITL  | LangGraph 0.2+              | `interrupt_before` for human pause points      |
| LLM           | Groq `llama-3.1-8b-instant` | Fast, free, high quality                       |
| Checkpointing | `SqliteSaver`               | Persists state across HTTP requests & restarts |
| Backend       | FastAPI + Python 3.11       | Lightweight, async, auto-docs                  |
| Database      | SQLite + SQLAlchemy         | Preferences, scheduled emails, OAuth tokens    |
| Gmail         | Google OAuth2 + Gmail API   | Read inbox, send approved emails               |
| Scheduler     | APScheduler                 | Timed email delivery                           |
| Frontend      | React + Vite + TypeScript   | Fast dev, type-safe                            |
| UI Components | shadcn/ui + Tailwind CSS    | Built with Lovable                             |
| State         | Zustand + React Query       | Global auth state + server data caching        |

---

## Going Beyond the Assignment

The assignment required a simple HITL terminal app. Draftly delivers that at its core and layers on production-ready features:

| Feature                        | Required? | Reason Added                                          |
| ------------------------------ | --------- | ----------------------------------------------------- |
| `interrupt_before` HITL loop   | ✅ Yes    | Core requirement                                      |
| Approve / Reject / Redraft     | ✅ Yes    | Core requirement                                      |
| FastAPI REST layer             | No        | Makes graph usable from any client, not just terminal |
| `SqliteSaver` checkpointing    | No        | State survives server restarts — production essential |
| React frontend (Lovable)       | No        | End-to-end product, better interview demo             |
| Real Gmail send via OAuth      | No        | Live demo — email actually lands in inbox             |
| User preferences in LLM prompt | No        | Every draft is personalised automatically             |
| Attachment text extraction     | No        | LLM uses file content as context                      |
| APScheduler timed sends        | No        | Shows real scheduling architecture                    |
| Iteration safety cap (5)       | No        | Prevents infinite loops in production                 |

---

## Deployment (Render)

Draftly includes a `render.yaml` blueprint for one-click deployment to [Render](https://render.com).

### Prerequisites

1. A Render account
2. Google Cloud OAuth credentials (see `GOOGLE_OAUTH_SETUP.md`)
3. Groq API key from [console.groq.com](https://console.groq.com)

### Deploy Steps

1. **Push to GitHub** and connect the repo to Render
2. **Create a Blueprint** in Render Dashboard → Blueprints → New Blueprint Instance
3. **Select this repo** — Render will detect `render.yaml`
4. **Configure environment variables** in Render dashboard:

   **Backend (`draftly-api`):**
   | Variable | Value |
   |----------|-------|
   | `GROQ_API_KEY` | Your Groq API key |
   | `GOOGLE_CLIENT_ID` | From Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
   | `GOOGLE_REDIRECT_URI` | `https://draftly-api.onrender.com/auth/gmail/callback` |
   | `FRONTEND_URL` | `https://draftly.onrender.com` |

   **Frontend (`draftly`):**
   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://draftly-api.onrender.com` |

5. **Update Google Cloud Console** — add the production redirect URI to your OAuth credentials

### Local Development

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env   # Edit with your keys
python main.py

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env   # Edit with API URL
npm run dev
```

---
