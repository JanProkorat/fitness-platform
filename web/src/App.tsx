import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
import ProtectedRoute from '@/routes/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import EntryPage from '@/pages/EntryPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
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
           * mounting any of the three inside ProtectedRoute re-enters the
           * same guard and infinite-loops instead of rendering.
           */}
          <Route path="/" element={<EntryPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
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
    </QueryClientProvider>
  );
}
