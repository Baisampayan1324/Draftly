import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToneSelector } from '@/components/ToneSelector';
import { FileUploadZone } from '@/components/FileUploadZone';
import { DraftReview } from '@/components/DraftReview';
import { startDraft, reviewDraft, scheduleSend } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Sparkles, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
      if (lines[bodyStartIndex]?.trim() === '') {
        bodyStartIndex++;
      }
      break;
    }
  }
  
  const body = lines.slice(bodyStartIndex).join('\n').trim();
  return { subject: subject || 'No Subject', body: body || draft };
}

export default function ComposePage() {
  const [to, setTo] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState('Professional');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string; iteration: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [isSending, setIsSending] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);

    try {
      const recipient = recipientName || to || undefined;
      const response = await startDraft(
        topic,
        recipient,
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
    } catch (error) {
      toast.error(`Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!threadId) return;
    setIsSending(true);

    try {
      if (scheduleEnabled && scheduleDate) {
        // Combine date and time for scheduling
        const [hours, minutes] = scheduleTime.split(':').map(Number);
        const scheduledDateTime = new Date(scheduleDate);
        scheduledDateTime.setHours(hours, minutes, 0, 0);
        
        // First approve the draft with recipient
        await reviewDraft(threadId, 'approve', undefined, to || undefined);
        
        // Then schedule it
        await scheduleSend(threadId, scheduledDateTime.toISOString());
        toast.success(`Email scheduled for ${format(scheduleDate, 'PPP')} at ${scheduleTime}`);
      } else {
        // Send immediately with recipient
        const response = await reviewDraft(threadId, 'approve', undefined, to || undefined);
        
        if (response.status === 'sent') {
          toast.success('Email sent! ✓');
        } else {
          toast.success('Email approved! ✓');
        }
      }

      // Reset form
      setDraft(null);
      setThreadId(null);
      setTopic('');
      setTo('');
      setRecipientName('');
      setContext('');
      setFiles([]);
      setScheduleEnabled(false);
      setScheduleDate(undefined);
    } catch (error) {
      toast.error(`Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleReject = async (feedback: string) => {
    if (!draft || !threadId) return;
    setIsGenerating(true);

    try {
      const response = await reviewDraft(threadId, 'reject', feedback, undefined, files.map(f => f.file));
      
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

  const resetForm = () => {
    setDraft(null);
    setThreadId(null);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Compose</h1>

      {!draft ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>To (email) *</Label>
              <Input 
                value={to} 
                onChange={(e) => setTo(e.target.value)} 
                placeholder="recipient@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient name</Label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="John Doe" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Topic *</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Follow up with my manager about project deadline..."
              className="min-h-[120px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Additional context (optional)</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Any additional context for the AI..."
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <ToneSelector value={tone} onChange={setTone} />
          </div>

          <FileUploadZone files={files} onFilesChange={setFiles} />

          <div className="flex items-center gap-3 p-4 bg-card rounded-xl border">
            <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            <Label>Schedule Send</Label>
          </div>

          {scheduleEnabled && (
            <div className="flex gap-3 animate-slide-in">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-[200px] justify-start text-left', !scheduleDate && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleDate ? format(scheduleDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-[140px]"
              />
            </div>
          )}

          <Button
            onClick={handleGenerate}
            className="w-full h-12 text-base rounded-xl"
            disabled={!topic.trim() || !to.trim() || isGenerating}
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Drafting your email...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Generate Draft</>
            )}
          </Button>
        </div>
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
            onReject={handleReject}
            isLoading={isGenerating || isSending}
          />

          {scheduleEnabled && scheduleDate && (
            <div className="bg-primary/10 text-primary text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Will be scheduled for {format(scheduleDate, 'PPP')} at {scheduleTime}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
