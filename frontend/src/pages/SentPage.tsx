import { useState } from 'react'; // SentPage
import { useQuery } from '@tanstack/react-query';
import { getSent, type SentEmail } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

function timeAgo(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SentPage() {
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);

  const { data: emails, isLoading, error } = useQuery({
    queryKey: ['sent'],
    queryFn: getSent,
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <p className="text-destructive">Failed to load sent emails</p>
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
          <h1 className="text-xl font-semibold">Sent</h1>
        </div>
        
        {isLoading ? (
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
              onClick={() => setSelectedEmail(email)}
              className={cn(
                'w-full text-left p-4 border-b border-border hover:bg-accent/50 transition-colors',
                selectedEmail?.id === email.id && 'bg-accent'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium truncate">
                      To: {email.recipient}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {timeAgo(email.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm truncate">
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
            <Send className="h-12 w-12 mb-3 opacity-40" />
            <p>No sent emails</p>
          </div>
        )}
      </div>

      {/* Email detail */}
      <div className={cn(
        'flex-1 overflow-y-auto',
        !selectedEmail ? 'hidden md:flex md:items-center md:justify-center' : ''
      )}>
        {!selectedEmail ? (
          <p className="text-muted-foreground">Select an email to view</p>
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
                <span>To: <span className="font-medium text-foreground">{selectedEmail.recipient}</span></span>
                <span>·</span>
                <span>{timeAgo(selectedEmail.timestamp)}</span>
              </div>
            </div>
            <div 
              className="bg-card rounded-xl border p-6 leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
