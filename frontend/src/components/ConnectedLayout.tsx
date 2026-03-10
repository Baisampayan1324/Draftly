import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

export function ConnectedLayout() {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 bg-panel-bg overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
