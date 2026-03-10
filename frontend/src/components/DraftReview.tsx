import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, RotateCcw, Edit3 } from 'lucide-react';

interface DraftReviewProps {
  subject: string;
  body: string;
  iteration: number;
  onApprove: (subject: string, body: string) => void;
  onReject: (feedback: string) => void;
  isLoading?: boolean;
}

export function DraftReview({ subject, body, iteration, onApprove, onReject, isLoading }: DraftReviewProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const subjectRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleApprove = () => {
    const s = subjectRef.current?.innerText || subject;
    const b = bodyRef.current?.innerText || body;
    onApprove(s, b);
  };

  const handleReject = () => {
    if (!showFeedback) {
      setShowFeedback(true);
      return;
    }
    if (feedback.trim()) {
      onReject(feedback);
      setFeedback('');
      setShowFeedback(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="bg-card rounded-2xl shadow-sm border p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full">
            Draft #{iteration}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Edit3 className="h-3 w-3" /> Click to edit
          </span>
        </div>
        <div
          ref={subjectRef}
          contentEditable
          suppressContentEditableWarning
          className="text-lg font-bold outline-none border-b border-transparent focus:border-primary/30 pb-2 transition-colors"
        >
          {subject}
        </div>
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          className="whitespace-pre-wrap leading-relaxed text-foreground/85 outline-none min-h-[120px] focus:bg-secondary/40 rounded-xl p-3 -m-3 transition-all"
        >
          {body}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={handleApprove}
          className="flex-1 h-11 bg-success hover:bg-success/90 text-success-foreground font-semibold rounded-xl shadow-sm"
          disabled={isLoading}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Approve
        </Button>
        <Button
          onClick={handleReject}
          variant="destructive"
          className="flex-1 h-11 font-semibold rounded-xl shadow-sm"
          disabled={isLoading}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          {showFeedback ? 'Regenerate' : 'Reject & Feedback'}
        </Button>
      </div>

      {showFeedback && (
        <div className="animate-slide-in">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What should be changed?"
            className="min-h-[80px] rounded-xl"
          />
        </div>
      )}
    </div>
  );
}
