import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/useAppStore";
import LandingPage from "./pages/LandingPage";
import { ConnectedLayout } from "./components/ConnectedLayout";
import InboxPage from "./pages/InboxPage";
// import SentPage from "./pages/SentPage";
import ComposePage from "./pages/ComposePage";
import ScheduledPage from "./pages/ScheduledPage";
import PreferencesPage from "./pages/PreferencesPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const gmailConnected = useAppStore((s) => s.gmailConnected);

  // Auth callback route is always accessible
  return (
    <Routes>
      {/* Auth callback - always accessible */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      
      {!gmailConnected ? (
        <>
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route element={<ConnectedLayout />}>
            <Route path="/inbox" element={<InboxPage />} />
            {/* <Route path="/sent" element={<SentPage />} /> */}
            <Route path="/compose" element={<ComposePage />} />
            <Route path="/scheduled" element={<ScheduledPage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/inbox" replace />} />
          <Route path="*" element={<NotFound />} />
        </>
      )}
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
