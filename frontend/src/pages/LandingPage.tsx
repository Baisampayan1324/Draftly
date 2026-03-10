import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToneSelector } from '@/components/ToneSelector';
import { FileUploadZone } from '@/components/FileUploadZone';
import { DraftReview } from '@/components/DraftReview';
import { startDraft, reviewDraft, startGmailAuth } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { Loader2, Sparkles, Mail, Send, Copy, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface UploadedFile {
  file: File;
  id: string;
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
      // Skip empty line after subject if present
      if (lines[bodyStartIndex]?.trim() === '') {
        bodyStartIndex++;
      }
      break;
    }
  }
  
  const body = lines.slice(bodyStartIndex).join('\n').trim();
  return { subject: subject || 'No Subject', body: body || draft };
}

export default function LandingPage() {
  const [topic, setTopic] = useState('');
  const [recipient, setRecipient] = useState('');
  const [tone, setTone] = useState('Professional');
  const [context, setContext] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string; iteration: number } | null>(null);
  const [finalEmail, setFinalEmail] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const setDraftSession = useAppStore((s) => s.setDraftSession);
  const clearDraftStore = useAppStore((s) => s.clearDraft);
  const gmailConnected = useAppStore((s) => s.gmailConnected);
  const gmailUser = useAppStore((s) => s.gmailUser);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);

    try {
      const response = await startDraft(
        topic,
        recipient || undefined,
        tone,
        context || undefined,
        files.map((f) => f.file)
      );

      setThreadId(response.thread_id);
      const parsed = parseDraft(response.draft);
      setDraft({
        subject: parsed.subject,
        body: parsed.body,
        iteration: response.iteration,
      });
      setDraftSession(response.thread_id, response.draft, response.iteration);
    } catch (error) {
      toast.error(`Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async (feedback: string) => {
    if (!threadId || !draft) return;
    setIsGenerating(true);

    try {
      const response = await reviewDraft(threadId, 'reject', feedback);

      if (response.draft) {
        const parsed = parseDraft(response.draft);
        setDraft({
          subject: parsed.subject,
          body: parsed.body,
          iteration: response.iteration || draft.iteration + 1,
        });
      }
    } catch (error) {
      toast.error(`Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = (subject: string, body: string) => {
    // Store the edited draft
    setDraft((prev) => prev ? { ...prev, subject, body } : null);
    setFinalEmail(`Subject: ${subject}\n\n${body}`);
    setShowApproveModal(true);
  };

  const handleSendViaGmail = async () => {
    if (!threadId) return;
    
    // Require recipient for sending
    if (!recipient.trim()) {
      toast.error('Please enter a recipient email address before sending');
      return;
    }
    
    setIsSending(true);

    try {
      // First approve the draft on the backend, passing the recipient
      const response = await reviewDraft(threadId, 'approve', undefined, recipient.trim());
      
      if (response.error) {
        toast.error(response.error);
        setIsSending(false);
        return;
      }
      
      if (response.status === 'sent') {
        toast.success('Email sent successfully!');
        resetFormCompletely();
        return;
      }
      
      // Should not reach here if gmailConnected is true, but fallback to OAuth
      const authResponse = await startGmailAuth(threadId);
      window.location.href = authResponse.auth_url;
    } catch (error) {
      toast.error(`Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSending(false);
    }
  };

  const handleConnectGmail = async () => {
    // Require recipient before OAuth
    if (!recipient.trim()) {
      toast.error('Please enter a recipient email address');
      return;
    }
    
    setIsSending(true);

    try {
      // Store pending send data in localStorage so AuthCallbackPage can send after OAuth
      localStorage.setItem('pending_send', JSON.stringify({
        thread_id: threadId,
        recipient: recipient.trim(),
        finalEmail: finalEmail,
      }));
      
      // Start Gmail OAuth with thread_id
      const authResponse = await startGmailAuth(threadId || undefined);
      
      // Redirect to Google OAuth
      window.location.href = authResponse.auth_url;
    } catch (error) {
      localStorage.removeItem('pending_send');
      toast.error(`Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSending(false);
    }
  };

  const resetFormCompletely = () => {
    setShowApproveModal(false);
    setDraft(null);
    setThreadId(null);
    setFinalEmail(null);
    setTopic('');
    setRecipient('');
    setContext('');
    setFiles([]);
    clearDraftStore();
  };

  const handleCopyAndClose = async () => {
    if (finalEmail) {
      try {
        await navigator.clipboard.writeText(finalEmail);
        toast.success('Email copied to clipboard!');
      } catch {
        toast.error('Failed to copy to clipboard');
      }
    }
    resetFormCompletely();
  };

  const resetForm = () => {
    setDraft(null);
    setThreadId(null);
    setFinalEmail(null);
    clearDraftStore();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="relative z-10 p-6 flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold tracking-tight">Draftly</h2>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl space-y-8 animate-fade-in">
          {!draft ? (
            <>
              <div className="space-y-3 text-center">
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                  What would you like to{' '}
                  <span className="gradient-text">email</span> about?
                </h1>
                <p className="text-muted-foreground text-base max-w-md mx-auto">
                  Describe your email and we'll craft the perfect draft for you.
                </p>
              </div>

              <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-6">
                <Textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Follow up with my manager about project deadline..."
                  className="min-h-[140px] text-base resize-none rounded-xl border-muted bg-secondary/30 focus:bg-background transition-colors"
                />

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Choose a tone</Label>
                  <ToneSelector value={tone} onChange={setTone} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Recipient (optional)</Label>
                  <Input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Recipient name or email"
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Additional context (optional)</Label>
                  <Textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Any additional context for the AI..."
                    className="min-h-[80px] resize-none rounded-xl border-muted bg-secondary/30 focus:bg-background transition-colors"
                  />
                </div>

                <FileUploadZone files={files} onFilesChange={setFiles} />

                <Button
                  onClick={handleGenerate}
                  className="w-full h-12 text-base rounded-xl font-semibold shadow-md hover:shadow-lg transition-shadow"
                  disabled={!topic.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Drafting your email...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Draft
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Start over
              </Button>
              <DraftReview
                subject={draft.subject}
                body={draft.body}
                iteration={draft.iteration}
                onApprove={handleApprove}
                onReject={handleRegenerate}
                isLoading={isGenerating}
              />
            </div>
          )}
        </div>
      </main>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-success" />
            </div>
            <DialogTitle className="text-xl">Your email is ready!</DialogTitle>
            <DialogDescription>
              {gmailConnected 
                ? 'Enter recipient and send your email'
                : 'Connect your Gmail account to send emails'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            {gmailConnected ? (
              <>
                {/* Gmail is connected - show recipient input and send button */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Recipient email</Label>
                  <Input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="recipient@example.com"
                    type="email"
                    className="rounded-lg"
                  />
                </div>
                {gmailUser && (
                  <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                    <img 
                      src={gmailUser.picture} 
                      alt={gmailUser.name} 
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{gmailUser.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{gmailUser.email}</p>
                    </div>
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                  </div>
                )}
                <Button
                  onClick={handleSendViaGmail}
                  className="w-full h-12 text-base font-medium"
                  disabled={isSending || !recipient.trim()}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send via Gmail
                </Button>
              </>
            ) : (
              <>
                {/* Gmail NOT connected - need recipient and connect */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Recipient email</Label>
                  <Input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="recipient@example.com"
                    type="email"
                    className="rounded-lg"
                  />
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                    Connect Gmail to send your email automatically
                  </p>
                </div>
                <Button
                  onClick={handleConnectGmail}
                  className="w-full h-12 text-base font-medium bg-[#4285f4] hover:bg-[#3367d6]"
                  disabled={isSending || !recipient.trim()}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Connect Gmail & Send
                </Button>
              </>
            )}
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            
            <Button
              onClick={handleCopyAndClose}
              variant="outline"
              className="w-full h-12 text-base font-medium"
              disabled={isSending}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy & Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
