import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInbox, startDraft, reviewDraft, getPreferences, type InboxEmail } from '@/lib/api';
import { DraftReview } from '@/components/DraftReview';
import { FileUploadZone } from '@/components/FileUploadZone';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, Reply, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadedFile {
  file: File;
  id: string;
}

function timeAgo(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Parse subject from draft (backend includes "Subject: ..." line)
function parseDraft(draft: string): { subject: string; body: string } {
  const lines = draft.split('\n');
  let subject = '';
  let bodyStartIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().startsWith('subject:')) {
      subject = line.substring(8).trim();
      bodyStartIndex = i + 1;
      if (lines[bodyStartIndex]?.trim() === '') {
        bodyStartIndex++;
      }
      break;
    }
  }
  
  const body = lines.slice(bodyStartIndex).join('\n').trim();
  return { subject: subject || 'No Subject', body: body || draft };
}

export default function InboxPage() {
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [draftingEmailId, setDraftingEmailId] = useState<string | null>(null);
  
  // Store drafts per email ID so they persist when switching between emails
  const [emailDrafts, setEmailDrafts] = useState<Map<string, {
    threadId: string;
    subject: string;
    body: string;
    iteration: number;
  }>>(new Map());
  
  // Get current email's draft state
  const currentDraft = selectedEmail ? emailDrafts.get(selectedEmail.id) : null;
  const isCreatingDraft = selectedEmail && draftingEmailId === selectedEmail.id && loading;

  const { data: emails, isLoading: isLoadingEmails, error } = useQuery({
    queryKey: ['inbox'],
    queryFn: getInbox,
  });

  const { data: preferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: getPreferences,
  });

  const handleDraftReply = async () => {
    if (!selectedEmail) return;
    setDraftingEmailId(selectedEmail.id);
    setLoading(true);
    setFiles([]);

    try {
      const response = await startDraft(
        selectedEmail.body,
        selectedEmail.sender,
        preferences?.default_tone || 'Professional',
        selectedEmail.subject,
        []
      );

      // Store draft for this specific email
      setEmailDrafts(prev => new Map(prev).set(selectedEmail.id, {
        threadId: response.thread_id,
        subject: parseDraft(response.draft).subject,
        body: parseDraft(response.draft).body,
        iteration: response.iteration,
      }));
    } catch (err) {
      toast.error(`Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setDraftingEmailId(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedEmail || !currentDraft) return;
    setLoading(true);

    try {
      const response = await reviewDraft(currentDraft.threadId, 'approve', undefined, selectedEmail.sender);
      
      if (response.status === 'sent') {
        toast.success('Reply sent! ✓');
      } else {
        toast.success('Email approved! ✓');
      }
      
      // Remove draft for this email after sending
      setEmailDrafts(prev => {
        const newMap = new Map(prev);
        newMap.delete(selectedEmail.id);
        return newMap;
      });
      setFiles([]);
    } catch (err) {
      toast.error(`Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (feedback: string) => {
    if (!selectedEmail || !currentDraft) return;
    setLoading(true);

    try {
      const response = await reviewDraft(currentDraft.threadId, 'reject', feedback, undefined, files.map(f => f.file));
      
      if (response.draft) {
        const parsed = parseDraft(response.draft);
        // Update draft for this email
        setEmailDrafts(prev => new Map(prev).set(selectedEmail.id, {
          ...currentDraft,
          subject: parsed.subject,
          body: parsed.body,
          iteration: response.iteration || currentDraft.iteration + 1,
        }));
      }
    } catch (err) {
      toast.error(`Something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <p className="text-destructive">Failed to load inbox</p>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Email list */}
      <div className={cn(
        'w-full md:w-96 border-r border-border bg-background overflow-y-auto',
        selectedEmail ? 'hidden md:block' : ''
      )}>
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-semibold">Inbox</h1>
        </div>
        
        {isLoadingEmails ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : emails && emails.length > 0 ? (
          emails.map((email) => (
            <button
              key={email.id}
              onClick={() => { setSelectedEmail(email); setFiles([]); }}
              className={cn(
                'w-full text-left p-4 border-b border-border hover:bg-accent/50 transition-colors',
                selectedEmail?.id === email.id && 'bg-accent'
              )}
            >
              <div className="flex items-start gap-3">
                {email.is_unread && <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
                <div className={cn('min-w-0 flex-1', !email.is_unread && 'ml-5')}>
                  <div className="flex justify-between items-baseline">
                    <span className={cn('text-sm truncate', email.is_unread && 'font-semibold')}>
                      {email.sender}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {timeAgo(email.timestamp)}
                    </span>
                  </div>
                  <p className={cn('text-sm truncate', email.is_unread && 'font-medium')}>
                    {email.subject}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {email.snippet}
                  </p>
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-3 opacity-40" />
            <p>Your inbox is empty</p>
          </div>
        )}
      </div>

      {/* Email detail */}
      <div className={cn(
        'flex-1 overflow-y-auto',
        !selectedEmail ? 'hidden md:flex md:items-center md:justify-center' : ''
      )}>
        {!selectedEmail ? (
          <p className="text-muted-foreground">Select an email to read</p>
        ) : (
          <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
            <button
              onClick={() => setSelectedEmail(null)}
              className="md:hidden flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h2 className="text-xl font-semibold">{selectedEmail.subject}</h2>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{selectedEmail.sender}</span>
                <span>·</span>
                <span>{timeAgo(selectedEmail.timestamp)}</span>
              </div>
            </div>
            <div className="bg-card rounded-xl border p-6 whitespace-pre-wrap leading-relaxed">
              {selectedEmail.body}
            </div>

            {!currentDraft && !isCreatingDraft && (
              <Button onClick={handleDraftReply} variant="outline" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Reply className="h-4 w-4 mr-2" />
                )}
                Draft Reply
              </Button>
            )}

            {isCreatingDraft && (
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}

            {currentDraft && (
              <div className="space-y-4">
                <DraftReview
                  subject={currentDraft.subject}
                  body={currentDraft.body}
                  iteration={currentDraft.iteration}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isLoading={loading}
                />
                <div className="bg-card rounded-xl border p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Attach files for context</p>
                  <FileUploadZone files={files} onFilesChange={setFiles} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
