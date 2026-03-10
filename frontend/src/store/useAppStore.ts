import { create } from 'zustand';

export interface GmailUser {
  name: string;
  email: string;
  picture: string;
}

export type DraftStatus = "idle" | "loading" | "awaiting_review" | "approved" | "sent";

interface AppState {
  // Gmail auth state
  gmailConnected: boolean;
  gmailUser: GmailUser | null;
  
  // Current draft session
  currentThreadId: string | null;
  currentDraft: string | null;
  currentIteration: number;
  draftStatus: DraftStatus;
  
  // UI state
  sidebarCollapsed: boolean;

  // Actions
  setGmailConnected: (connected: boolean, user?: GmailUser | null) => void;
  setDraftSession: (threadId: string, draft: string, iteration: number) => void;
  setDraftStatus: (status: DraftStatus) => void;
  clearDraft: () => void;
  disconnect: () => void;
  toggleSidebar: () => void;
}

const loadFromStorage = () => {
  try {
    const connected = localStorage.getItem('gmail_connected');
    const user = localStorage.getItem('gmail_user');
    return {
      gmailConnected: connected === 'true',
      gmailUser: user ? JSON.parse(user) : null,
    };
  } catch {
    return {
      gmailConnected: false,
      gmailUser: null,
    };
  }
};

export const useAppStore = create<AppState>((set) => ({
  ...loadFromStorage(),
  currentThreadId: null,
  currentDraft: null,
  currentIteration: 0,
  draftStatus: "idle",
  sidebarCollapsed: false,

  setGmailConnected: (connected, user = null) => {
    if (connected && user) {
      localStorage.setItem('gmail_connected', 'true');
      localStorage.setItem('gmail_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('gmail_connected');
      localStorage.removeItem('gmail_user');
    }
    set({ gmailConnected: connected, gmailUser: user });
  },

  setDraftSession: (threadId, draft, iteration) => {
    set({
      currentThreadId: threadId,
      currentDraft: draft,
      currentIteration: iteration,
      draftStatus: "awaiting_review",
    });
  },

  setDraftStatus: (status) => {
    set({ draftStatus: status });
  },

  clearDraft: () => {
    set({
      currentThreadId: null,
      currentDraft: null,
      currentIteration: 0,
      draftStatus: "idle",
    });
  },

  disconnect: () => {
    localStorage.removeItem('gmail_connected');
    localStorage.removeItem('gmail_user');
    set({ gmailConnected: false, gmailUser: null });
    window.location.reload();
  },

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
