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
import ForgotPasswordForm from '@/components/entry/ForgotPasswordForm';
import ResetPasswordForm from '@/components/entry/ResetPasswordForm';
import RegisterPage from '@/pages/RegisterPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import DownloadAppPage from '@/pages/DownloadAppPage';
import ClientsPage from '@/pages/ClientsPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import InboxPage from '@/pages/InboxPage';
import IngredientsPage from '@/pages/IngredientsPage';
import RecipesPage from '@/pages/RecipesPage';
import PlanTemplatesPage from '@/pages/PlanTemplatesPage';
import PlanTemplateEditorPage from '@/pages/PlanTemplateEditorPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
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
           * redirects an unauthenticated visitor to "/login", an unconfirmed
           * user to "/verify-email", and a client-only user to "/download-app";
           * mounting any of these inside ProtectedRoute re-enters the same
           * guard and infinite-loops instead of rendering.
           *
           * EntryPage is a pathless layout route: it renders the landing page
           * once plus one sign-in dialog, which is open on every child route
           * except "/" and renders whichever form route is active (via
           * useOutlet(), see that component). Do NOT collapse these into a
           * single `path="/:authMode?"` route — an optional param segment
           * swallows every unmatched path ahead of the catch-all NotFound
           * route.
           */}
          <Route element={<EntryPage />}>
            <Route path="/" element={null} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/forgot-password" element={<ForgotPasswordForm />} />
            <Route path="/auth/reset-password" element={<ResetPasswordForm />} />
          </Route>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/download-app" element={<DownloadAppPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:clientId" element={<ClientDetailPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/ingredients" element={<IngredientsPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/plan-templates" element={<PlanTemplatesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            {/* Full-bleed workspace: icon-rail sidebar, no main padding (PageTemplateEditor). */}
            <Route element={<AppShell variant="editor" />}>
              <Route path="/plan-templates/:templateId" element={<PlanTemplateEditorPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
