import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

interface Props {
  allowedRoles: string[];
}

export default function RoleGuard({ allowedRoles }: Props) {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasRole = user.roles.some((r) => allowedRoles.includes(r));
  if (!hasRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
