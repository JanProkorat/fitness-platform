import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import ProtectedRoute from '@/routes/ProtectedRoute';
import RoleGuard from '@/routes/RoleGuard';
import { AppShell } from '@/components/layout/AppShell';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import ProfilePage from '@/pages/ProfilePage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import InviteAcceptPage from '@/pages/InviteAcceptPage';
import DownloadAppPage from '@/pages/DownloadAppPage';
import FoodsPage from '@/pages/FoodsPage';
import PlansPage from '@/pages/PlansPage';
import RecipesPage from '@/pages/RecipesPage';
import NutritionPlanPage from '@/pages/NutritionPlanPage';
import ClientNutritionGoalsPage from '@/pages/ClientNutritionGoalsPage';
import ClientNutritionPage from '@/pages/ClientNutritionPage';
import ExercisesPage from '@/pages/ExercisesPage';
import TrainingPlanPage from '@/pages/TrainingPlanPage';
import ClientTrainingPage from '@/pages/ClientTrainingPage';
import MessagesPage from '@/pages/MessagesPage';
import { Toaster } from '@/components/ui/Toast';

function DefaultRedirect() {
  const user = useAuthStore((s) => s.user);
  const isClientOnly = user?.roles.includes('Client') && !user.roles.some((r) => ['Trainer', 'Nutritionist', 'Admin'].includes(r));
  return <Navigate to={isClientOnly ? '/download-app' : '/dashboard'} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

// Refetch all queries when the app language changes so localized data (e.g. food names) updates
window.addEventListener('app:languageChanged', () => {
  queryClient.invalidateQueries();
});

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
      <Toaster />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/accept" element={<InviteAcceptPage />} />
          <Route path="/download-app" element={<DownloadAppPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Trainer/Nutritionist shared */}
              <Route
                element={
                  <RoleGuard allowedRoles={['Trainer', 'Nutritionist', 'Admin']} />
                }
              >
                <Route path="/clients/:id" element={<ClientDetailPage />} />
                <Route path="/clients/:id/nutrition-goals" element={<ClientNutritionGoalsPage />} />
                <Route path="/clients/:id/nutrition" element={<ClientNutritionPage />} />
                <Route path="/clients/:id/training" element={<ClientTrainingPage />} />
              </Route>

              {/* Nutritionist only */}
              <Route
                element={
                  <RoleGuard allowedRoles={['Nutritionist', 'Admin']} />
                }
              >
                <Route path="/foods" element={<FoodsPage />} />
                <Route path="/recipes" element={<RecipesPage />} />
                <Route path="/plans" element={<PlansPage />} />
                <Route path="/clients/:id/plans/:planId" element={<NutritionPlanPage />} />
              </Route>

              {/* Trainer only */}
              <Route
                element={
                  <RoleGuard allowedRoles={['Trainer', 'Admin']} />
                }
              >
                <Route path="/exercises" element={<ExercisesPage />} />
                <Route path="/clients/:id/training-plans/:planId" element={<TrainingPlanPage />} />
              </Route>
            </Route>
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
