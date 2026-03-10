import { cn } from '@/lib/utils';
import { Briefcase, Smile, Coffee, GraduationCap, Zap } from 'lucide-react';

const tones = [
  { label: 'Professional', icon: Briefcase },
  { label: 'Friendly', icon: Smile },
  { label: 'Casual', icon: Coffee },
  { label: 'Formal', icon: GraduationCap },
  { label: 'Concise', icon: Zap },
];

interface ToneSelectorProps {
  value: string;
  onChange: (tone: string) => void;
}

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tones.map(({ label, icon: Icon }) => (
        <button
          key={label}
          onClick={() => onChange(label)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
            value === label
              ? 'bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]'
              : 'bg-card text-secondary-foreground border-border hover:border-primary/40 hover:bg-secondary'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
