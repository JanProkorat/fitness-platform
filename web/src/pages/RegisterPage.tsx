import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import RegisterShell from '@/components/register/RegisterShell';
import RegisterForm from '@/components/entry/RegisterForm';

/**
 * Public full-page registration at "/register". A signed-in visitor goes
 * straight to the portal, like the landing page does.
 */
export default function RegisterPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/clients" replace />;
  }

  return (
    <RegisterShell>
      <RegisterForm />
    </RegisterShell>
  );
}
