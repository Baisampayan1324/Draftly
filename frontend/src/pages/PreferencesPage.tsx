import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPreferences, savePreferences, type Preferences } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';

const tones = ['Professional', 'Friendly', 'Casual', 'Formal', 'Concise'];

const defaultPreferences: Preferences = {
  default_tone: 'Professional',
  style_notes: '',
  domain_context: '',
  signature: '',
  auto_draft: false,
  deadline_reminder: false,
};

export default function PreferencesPage() {
  const queryClient = useQueryClient();
  const { gmailUser, disconnect } = useAppStore();
  
  const { data: serverPrefs, isLoading, error } = useQuery({
    queryKey: ['preferences'],
    queryFn: getPreferences,
  });

  const [local, setLocal] = useState<Preferences>(defaultPreferences);

  // Sync local state with server data
  useEffect(() => {
    if (serverPrefs) {
      setLocal(serverPrefs);
    }
  }, [serverPrefs]);

  const saveMutation = useMutation({
    mutationFn: savePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      toast.success('Preferences saved! ✓');
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleSave = () => {
    saveMutation.mutate(local);
  };

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-8 animate-fade-in">
        <h1 className="text-xl font-semibold">Preferences</h1>
        <div className="text-center py-10">
          <p className="text-destructive">Failed to load preferences</p>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8 animate-fade-in pb-24">
      <h1 className="text-xl font-semibold">Preferences</h1>

      {isLoading ? (
        <div className="space-y-8">
          <section className="space-y-5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </section>
        </div>
      ) : (
        <>
          {/* AI Preferences */}
          <section className="space-y-5">
            <h2 className="text-lg font-medium">AI Preferences</h2>

            <div className="space-y-2">
              <Label>Default Tone</Label>
              <Select value={local.default_tone} onValueChange={(v) => setLocal((p) => ({ ...p, default_tone: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tones.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Writing Style Notes</Label>
              <Textarea
                value={local.style_notes}
                onChange={(e) => setLocal((p) => ({ ...p, style_notes: e.target.value }))}
                placeholder="e.g. Always sign off with Best regards, Baisampayan"
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Domain Context</Label>
              <Textarea
                value={local.domain_context}
                onChange={(e) => setLocal((p) => ({ ...p, domain_context: e.target.value }))}
                placeholder="e.g. I work in anti-gravity research — use relevant terminology"
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
              <Label>Auto-draft replies</Label>
              <Switch
                checked={local.auto_draft}
                onCheckedChange={(v) => setLocal((p) => ({ ...p, auto_draft: v }))}
              />
            </div>
          </section>

          {/* Email Rules */}
          <section className="space-y-5">
            <h2 className="text-lg font-medium">Email Rules</h2>

            <div className="space-y-2">
              <Label>Email Signature</Label>
              <Textarea
                value={local.signature}
                onChange={(e) => setLocal((p) => ({ ...p, signature: e.target.value }))}
                placeholder="Your email signature..."
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
              <Label>Deadline reminder (1 day before)</Label>
              <Switch
                checked={local.deadline_reminder}
                onCheckedChange={(v) => setLocal((p) => ({ ...p, deadline_reminder: v }))}
              />
            </div>
          </section>

          {/* Account */}
          <section className="space-y-5">
            <h2 className="text-lg font-medium">Account</h2>

            {gmailUser && (
              <div className="flex items-center gap-4 p-4 bg-card rounded-xl border">
                <img src={gmailUser.picture} alt={gmailUser.name} className="h-12 w-12 rounded-full" />
                <div>
                  <p className="font-medium">{gmailUser.name}</p>
                  <p className="text-sm text-muted-foreground">{gmailUser.email}</p>
                </div>
              </div>
            )}

            <Button variant="destructive" onClick={disconnect}>
              Disconnect Gmail
            </Button>
          </section>
        </>
      )}

      {/* Save button */}
      <div className="fixed bottom-0 left-64 right-0 p-4 bg-background/80 backdrop-blur-sm border-t">
        <div className="max-w-2xl mx-auto">
          <Button 
            onClick={handleSave} 
            className="w-full"
            disabled={isLoading || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
