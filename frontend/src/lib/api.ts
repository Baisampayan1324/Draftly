const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Type definitions
export interface StartDraftResponse {
  thread_id: string;
  draft: string;
  iteration: number;
  status: "awaiting_review";
}

export interface ReviewDraftResponse {
  status: "awaiting_review" | "sent" | "scheduled" | "approved";
  draft?: string;
  iteration?: number;
  final_email?: string;
  error?: string;
}

export interface InboxEmail {
  id: string;
  gmail_thread_id: string;
  sender: string;
  subject: string;
  snippet: string;
  body: string;
  timestamp: string;
  is_unread: boolean;
}

export interface SentEmail {
  id: string;
  gmail_thread_id: string;
  recipient: string;
  subject: string;
  snippet: string;
  body: string;
  timestamp: string;
}

export interface ScheduledEmail {
  id: number;
  thread_id: string;
  recipient: string;
  subject: string;
  body: string;
  send_at: string;
  status: "scheduled" | "sent" | "cancelled";
  created_at: string;
}

export interface ScheduleSendResponse {
  schedule_id: number;
  status: "scheduled";
}

export interface Preferences {
  default_tone: string;
  style_notes: string;
  domain_context: string;
  signature: string;
  auto_draft: boolean;
  deadline_reminder: boolean;
}

export interface AuthStartResponse {
  auth_url: string;
}

// Helper function for error handling
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = "Request failed";
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

// API Functions

/**
 * Start a new draft generation
 */
export async function startDraft(
  topic: string,
  recipient: string | undefined,
  tone: string,
  context: string | undefined,
  files: File[]
): Promise<StartDraftResponse> {
  const formData = new FormData();
  formData.append("topic", topic);
  if (recipient) formData.append("recipient", recipient);
  formData.append("tone", tone);
  if (context) formData.append("context", context);
  
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${BASE_URL}/start`, {
    method: "POST",
    body: formData,
  });

  return handleResponse<StartDraftResponse>(response);
}

/**
 * Review a draft (approve or reject)
 */
export async function reviewDraft(
  threadId: string,
  decision: "approve" | "reject",
  feedback?: string,
  recipient?: string,
  files?: File[]
): Promise<ReviewDraftResponse> {
  const formData = new FormData();
  formData.append("decision", decision);
  if (feedback) formData.append("feedback", feedback);
  if (recipient) formData.append("recipient", recipient);
  
  if (files) {
    files.forEach((file) => {
      formData.append("files", file);
    });
  }

  const response = await fetch(`${BASE_URL}/review/${threadId}`, {
    method: "POST",
    body: formData,
  });

  return handleResponse<ReviewDraftResponse>(response);
}

/**
 * Start Gmail OAuth flow
 */
export async function startGmailAuth(threadId?: string): Promise<AuthStartResponse> {
  const response = await fetch(`${BASE_URL}/auth/gmail/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ thread_id: threadId }),
  });

  return handleResponse<AuthStartResponse>(response);
}

/**
 * Get inbox emails
 */
export async function getInbox(): Promise<InboxEmail[]> {
  const response = await fetch(`${BASE_URL}/inbox`, {
    method: "GET",
  });

  return handleResponse<InboxEmail[]>(response);
}

/**
 * Get sent emails
 */
export async function getSent(): Promise<SentEmail[]> {
  const response = await fetch(`${BASE_URL}/inbox/sent`, {
    method: "GET",
  });

  return handleResponse<SentEmail[]>(response);
}

/**
 * Schedule an email to be sent later
 */
export async function scheduleSend(
  threadId: string,
  sendAt: string
): Promise<ScheduleSendResponse> {
  const response = await fetch(`${BASE_URL}/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ thread_id: threadId, send_at: sendAt }),
  });

  return handleResponse<ScheduleSendResponse>(response);
}

/**
 * Get all scheduled emails
 */
export async function getScheduled(): Promise<ScheduledEmail[]> {
  const response = await fetch(`${BASE_URL}/schedule/scheduled`, {
    method: "GET",
  });

  return handleResponse<ScheduledEmail[]>(response);
}

/**
 * Cancel a scheduled email
 */
export async function cancelScheduled(id: number): Promise<{ status: string }> {
  const response = await fetch(`${BASE_URL}/schedule/${id}`, {
    method: "DELETE",
  });

  return handleResponse<{ status: string }>(response);
}

/**
 * Get user preferences
 */
export async function getPreferences(): Promise<Preferences> {
  const response = await fetch(`${BASE_URL}/preferences`, {
    method: "GET",
  });

  return handleResponse<Preferences>(response);
}

/**
 * Save user preferences
 */
export async function savePreferences(prefs: Preferences): Promise<Preferences> {
  const response = await fetch(`${BASE_URL}/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prefs),
  });

  return handleResponse<Preferences>(response);
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${BASE_URL}/health`, {
    method: "GET",
  });

  return handleResponse<{ status: string }>(response);
}
