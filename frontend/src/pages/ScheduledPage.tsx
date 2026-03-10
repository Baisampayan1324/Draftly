import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getScheduled, cancelScheduled } from '@/lib/api';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CalendarOff, Loader2 } from 'lucide-react';
import { useState } from 'react';

const statusColors: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary',
  sent: 'bg-success/10 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function ScheduledPage() {
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const { data: emails, isLoading, error } = useQuery({
    queryKey: ['scheduled'],
    queryFn: getScheduled,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelScheduled,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled'] });
      toast.success('Scheduled email cancelled');
      setCancellingId(null);
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCancellingId(null);
    },
  });

  const handleCancel = (id: number) => {
    setCancellingId(id);
    cancelMutation.mutate(id);
  };

  if (error) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <h1 className="text-xl font-semibold">Scheduled</h1>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-destructive">Failed to load scheduled emails</p>
          <p className="text-sm">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold">Scheduled</h1>

      {isLoading ? (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : emails && emails.length > 0 ? (
        <div className="bg-card rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Scheduled Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="font-medium">{email.recipient}</TableCell>
                  <TableCell>{email.subject}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(email.send_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium capitalize', statusColors[email.status])}>
                      {email.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {email.status === 'scheduled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(email.id)}
                        className="text-destructive hover:text-destructive"
                        disabled={cancellingId === email.id}
                      >
                        {cancellingId === email.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Cancel'
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CalendarOff className="h-12 w-12 mb-3 opacity-40" />
          <p>No scheduled emails yet</p>
        </div>
      )}
    </div>
  );
}
