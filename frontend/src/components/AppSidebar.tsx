import { Inbox, PenSquare, Clock, Settings, LogOut, Send } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Inbox', icon: Inbox, path: '/inbox' },
  { label: 'Sent', icon: Send, path: '/sent' },
  { label: 'Compose', icon: PenSquare, path: '/compose' },
  { label: 'Scheduled', icon: Clock, path: '/scheduled' },
  { label: 'Preferences', icon: Settings, path: '/preferences' },
];

export function AppSidebar() {
  const location = useLocation();
  const { gmailUser, disconnect } = useAppStore();

  return (
    <aside className="w-64 bg-sidebar-bg text-sidebar-foreground flex flex-col h-screen shrink-0 sticky top-0">
      <div className="p-5">
        <h1 className="text-lg font-semibold">Draftly</h1>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              location.pathname === path
                ? 'bg-sidebar-active text-sidebar-foreground'
                : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        {gmailUser && (
          <div className="flex items-center gap-3">
            <img
              src={gmailUser.picture}
              alt={gmailUser.name}
              className="h-8 w-8 rounded-full"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{gmailUser.name}</p>
              <p className="text-xs text-sidebar-muted truncate">{gmailUser.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={disconnect}
          className="flex items-center gap-2 text-xs text-destructive hover:text-destructive/80 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Disconnect
        </button>
      </div>
    </aside>
  );
}
