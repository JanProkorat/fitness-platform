import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { addRole } from '@/api/roles';

interface User {
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  emailConfirmed: boolean;
}

interface RolesSectionProps {
  user: User;
  onRoleAdded: (updatedUser: User) => void;
}

export function RolesSection({ user, onRoleAdded }: RolesSectionProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasTrainer = user.roles.includes('Trainer');
  const hasNutritionist = user.roles.includes('Nutritionist');
  const canAddRole = !hasTrainer || !hasNutritionist;

  const handleAddRole = async (role: string) => {
    if (!window.confirm(t('profile.addRoleConfirm'))) return;

    setStatus(null);
    setLoading(true);
    try {
      const data = await addRole(role);
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);

      const { data: profile } = await api.get('/users/me');
      const updatedUser: User = {
        publicId: profile.userId,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        roles: profile.roles ?? [],
        emailConfirmed: profile.emailConfirmed ?? true,
      };

      onRoleAdded(updatedUser);
      setStatus(t('profile.roleAdded'));
    } catch {
      setStatus(t('profile.addRoleError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>
        {t('profile.rolesTitle')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: canAddRole ? 10 : 0 }}>
        {user.roles.map((role) => (
          <span key={role} className="cert-chip" style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-br)', color: 'var(--accent)', fontWeight: 500 }}>
            {t(`auth.role${role}`)}
          </span>
        ))}
      </div>
      {canAddRole && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleAddRole(hasTrainer ? 'Nutritionist' : 'Trainer')}
          className="rounded-md bg-text px-4 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? t('common.saving')
            : hasTrainer
              ? t('profile.addNutritionistRole')
              : t('profile.addTrainerRole')}
        </button>
      )}
      {status && (
        <div style={{ marginTop: 10 }}>
          <StatusMessage status={status} errorKey={t('profile.addRoleError')} />
        </div>
      )}
    </div>
  );
}

function StatusMessage({
  status,
  errorKey,
}: {
  status: string | null;
  errorKey: string;
}) {
  if (!status) return null;
  return (
    <div
      className={`mb-4 rounded-sm border px-4 py-2.5 text-sm ${
        status === errorKey
          ? 'border-red bg-red-bg text-red'
          : 'border-green bg-green-bg text-green'
      }`}
    >
      {status}
    </div>
  );
}
