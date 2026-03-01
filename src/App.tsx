import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import GamePage from "./pages/GamePage";
import GamePage2v2 from "./pages/GamePage2v2";
import SettingsPage from "./pages/SettingsPage";
import RankingPage from "./pages/RankingPage";
import ProfilePage from "./pages/ProfilePage";
import FriendsPage from "./pages/FriendsPage";
import AppLayout from "./components/AppLayout";
import FriendInviteListener from "./components/FriendInviteListener";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-display text-primary animate-pulse text-xl">CARREGANDO...</div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/game/:id" element={
      <ProtectedRoute>
        <AppLayout><GamePage /></AppLayout>
      </ProtectedRoute>
    } />
    <Route path="/game2v2/:id" element={
      <ProtectedRoute>
        <AppLayout><GamePage2v2 /></AppLayout>
      </ProtectedRoute>
    } />
    <Route path="/ranking" element={
      <ProtectedRoute>
        <AppLayout><RankingPage /></AppLayout>
      </ProtectedRoute>
    } />
    <Route path="/settings" element={
      <ProtectedRoute>
        <AppLayout><SettingsPage /></AppLayout>
      </ProtectedRoute>
    } />
    <Route path="/profile/:userId?" element={
      <ProtectedRoute>
        <AppLayout><ProfilePage /></AppLayout>
      </ProtectedRoute>
    } />
    <Route path="/friends" element={
      <ProtectedRoute>
        <AppLayout><FriendsPage /></AppLayout>
      </ProtectedRoute>
    } />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FriendInviteListener />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
