import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
import ProtectedRoute from '@/routes/ProtectedRoute';

/**
 * Placeholder for the redesigned trainer portal (feature/ui-redesign). All
 * route pages and UI components were stripped for a clean-slate rebuild —
 * this route exists only so the provider stack (QueryClient, auth, router)
 * has something to render while the new design system is built.
 */
function PlaceholderPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <p>{t('common.redesignPlaceholder')}</p>
    </div>
  );
}

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
          <Route element={<ProtectedRoute />}>
            <Route path="*" element={<PlaceholderPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
