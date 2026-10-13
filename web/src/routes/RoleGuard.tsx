import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useActiveRoles } from '@/hooks/useActiveRoles';

interface Props {
  allowedRoles: string[];
}

/** Renders the child routes only when the viewer holds one of the allowed ACTIVE roles; fails closed on error. */
export default function RoleGuard({ allowedRoles }: Props) {
  const user = useAuthStore((s) => s.user);
  const { hasRole, isLoading, isError } = useActiveRoles();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return null;
  }

  if (isError || !allowedRoles.some(hasRole)) {
    return <Navigate to="/clients" replace />;
  }

  return <Outlet />;
}
