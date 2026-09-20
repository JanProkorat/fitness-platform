import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/auth';
import ProtectedRoute from '@/routes/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import EntryPage from '@/pages/EntryPage';
import LoginForm from '@/components/entry/LoginForm';
import RegisterForm from '@/components/entry/RegisterForm';
import ForgotPasswordForm from '@/components/entry/ForgotPasswordForm';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import DownloadAppPage from '@/pages/DownloadAppPage';
import ClientsPage from '@/pages/ClientsPage';
import InboxPage from '@/pages/InboxPage';
import IngredientsPage from '@/pages/IngredientsPage';
import RecipesPage from '@/pages/RecipesPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (!isInitialized) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/*
           * Public routes — MUST stay outside ProtectedRoute. ProtectedRoute
           * redirects an unauthenticated visitor to "/", an unconfirmed user
           * to "/verify-email", and a client-only user to "/download-app";
           * mounting any of these inside ProtectedRoute re-enters the same
           * guard and infinite-loops instead of rendering.
           *
           * EntryPage is a pathless layout route (#1058): it renders the
           * marketing column plus LoginPanel's shell once, and LoginPanel's
           * swap area (via useOutlet(), see that component) renders whichever
           * of the three child routes below is active. Do NOT collapse these
           * into a single `path="/:authMode?"` route — an optional param
           * segment swallows every unmatched path ahead of the catch-all
           * NotFound route.
           */}
          <Route element={<EntryPage />}>
            <Route path="/" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          </Route>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/download-app" element={<DownloadAppPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/ingredients" element={<IngredientsPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
