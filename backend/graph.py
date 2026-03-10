import sqlite3
from typing import TypedDict, Optional, List, Dict, Any
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

class EmailState(TypedDict, total=False):
    topic: str
    recipient: Optional[str]
    tone: str
    context: str
    attachment_texts: list[str]      # extracted text from PDF/TXT attachments
    attachment_filenames: list[str]  # all attachment filenames for reference
    draft: str
    human_feedback: Optional[str]
    decision: Optional[str]
    iteration: int
    final_email: Optional[str]
    gmail_thread_id: Optional[str]   # for threading replies
    
    style_notes: str
    domain_context: str
    signature: str

def draft_email(state: EmailState) -> Dict[str, Any]:
    style_notes = state.get("style_notes", "")
    domain_context = state.get("domain_context", "")
    signature = state.get("signature", "")
    
    # Build signature instruction
    signature_instruction = ""
    if signature and signature.strip():
        signature_instruction = f"Sign off with this signature:\n{signature}"
    else:
        signature_instruction = "Sign off with an appropriate closing (e.g., 'Best regards,' followed by the sender's name if known, or just 'Best regards')."
    
    # Forceful ID awareness: Who is the user?
    system_prompt = f"""You are a skilled email writer. Write clear, well-formatted emails.

CONTEXT:
- Domain/Industry: {domain_context if domain_context else 'General'}
- Writing style notes: {style_notes if style_notes else 'Professional and clear'}

CRITICAL FORMATTING RULES:
1. Return ONLY the email text - no explanations or meta-commentary.
2. First line MUST be 'Subject: ' followed by a concise subject line.
3. Leave a blank line after the subject, then write the email body.
4. Use proper paragraph breaks (blank lines) between different points.
5. {signature_instruction}
6. NEVER use placeholder text like [Name], [Your Name], [Company], [Phone], [Address], etc.
   - If you don't know specific information, simply omit it.
   - Write a complete, ready-to-send email.
7. If feedback is provided, write a completely new version addressing the feedback.
8. Keep emails concise and to the point."""

    user_instructions = []
    user_instructions.append(f"Write a {state.get('tone', 'professional')} email about: {state.get('topic', '')}")
    if state.get("recipient"):
         user_instructions.append(f"The recipient is: {state.get('recipient')}")
    if state.get("context"):
         user_instructions.append(f"Context/Contextual clues: {state.get('context')}")

    attachment_texts = state.get("attachment_texts", [])
    attachment_filenames = state.get("attachment_filenames", [])
    if attachment_texts and attachment_filenames:
         user_instructions.append("Information from attached files to include:")
         for filename, ext_text in zip(attachment_filenames, attachment_texts):
             user_instructions.append(f"[{filename}]: {ext_text}")

    if state.get("human_feedback"):
         user_instructions.append(f"--- FEEDBACK TO INCORPORATE (ERASE PREVIOUS ATTEMPT) ---\n{state.get('human_feedback')}")

    llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.85)
    messages = [
         SystemMessage(content=system_prompt),
         HumanMessage(content="\n".join(user_instructions))
    ]
    
    response = llm.invoke(messages)
    
    iteration = state.get("iteration", 0) + 1
    return {"draft": response.content, "iteration": iteration}

def human_review(state: EmailState) -> Dict[str, Any]:
    # HITL: The interrupt_before pattern in LangGraph pauses the execution of the graph 
    # before running this node, returning control to the client/caller.
    # We will resume the graph externally using update_state() with the decision/feedback.
    return {}

def finalize_email(state: EmailState) -> Dict[str, Any]:
    return {"final_email": state.get("draft")}

def review_router(state: EmailState) -> str:
    decision = state.get("decision")
    if decision == "approve":
        return "finalize_email"
    elif decision == "reject":
        if state.get("iteration", 0) >= 5:
            return "finalize_email"
        return "draft_email"
    return "finalize_email"

builder = StateGraph(EmailState)

builder.add_node("draft_email", draft_email)
builder.add_node("human_review", human_review)
builder.add_node("finalize_email", finalize_email)

builder.add_edge(START, "draft_email")
builder.add_edge("draft_email", "human_review")
builder.add_conditional_edges("human_review", review_router, ["draft_email", "finalize_email"])
builder.add_edge("finalize_email", END)

# SqliteSaver handles checkpointer
conn = sqlite3.connect("draftly.db", check_same_thread=False)

# Compile with interrupt_before:
# When 'human_review' is the next node, execution stops and yields control to the human.
graph = builder.compile(
    checkpointer=SqliteSaver(conn),
    interrupt_before=["human_review"]
)
