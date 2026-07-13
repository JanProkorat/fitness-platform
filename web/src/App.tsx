import { useEffect, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth';
import ProtectedRoute from '@/routes/ProtectedRoute';
import RoleGuard from '@/routes/RoleGuard';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui';

// Eagerly loaded (small, on critical auth path)
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import InviteAcceptPage from '@/pages/InviteAcceptPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import DownloadAppPage from '@/pages/DownloadAppPage';

// Lazy-loaded (heavy feature pages, loaded on demand)
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const MessagesPage = lazy(() => import('@/pages/MessagesPage'));
const ClientDetailPage = lazy(() => import('@/pages/ClientDetailPage'));
const ClientNutritionGoalsPage = lazy(() => import('@/pages/ClientNutritionGoalsPage'));
const ClientNutritionPage = lazy(() => import('@/pages/ClientNutritionPage'));
const ClientTrainingPage = lazy(() => import('@/pages/ClientTrainingPage'));
const FoodsPage = lazy(() => import('@/pages/FoodsPage'));
const RecipesPage = lazy(() => import('@/pages/RecipesPage'));
const NutritionPlanPage = lazy(() => import('@/pages/NutritionPlanPage'));
const ExercisesPage = lazy(() => import('@/pages/ExercisesPage'));
const SectionTemplatesPage = lazy(() => import('@/pages/SectionTemplatesPage'));
const TrainingPlanPage = lazy(() => import('@/pages/TrainingPlanPage'));

function DefaultRedirect() {
  const user = useAuthStore((s) => s.user);
  const isClientOnly = user?.roles.includes('Client') && !user.roles.some((r) => ['Trainer', 'Nutritionist', 'Admin'].includes(r));
  return <Navigate to={isClientOnly ? '/download-app' : '/dashboard'} replace />;
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
      <Toaster />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/accept" element={<InviteAcceptPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
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
              </Route>

              {/* Nutritionist only */}
              <Route
                element={
                  <RoleGuard allowedRoles={['Nutritionist', 'Admin']} />
                }
              >
                <Route path="/foods" element={<FoodsPage />} />
                <Route path="/recipes" element={<RecipesPage />} />
                <Route path="/clients/:id/plans/:planId" element={<NutritionPlanPage />} />
              </Route>

              {/* Trainer only */}
              <Route
                element={
                  <RoleGuard allowedRoles={['Trainer', 'Admin']} />
                }
              >
                <Route path="/exercises" element={<ExercisesPage />} />
                <Route path="/section-templates" element={<SectionTemplatesPage />} />
                <Route path="/clients/:id/training" element={<ClientTrainingPage />} />
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
