import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
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

interface RoleCardConfig {
  role: string;
  icon: string;
  name: string;
  description: string;
  iconBg: string;
}

export function RolesSection({ user, onRoleAdded }: RolesSectionProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasTrainer = user.roles.includes('Trainer');
  const hasNutritionist = user.roles.includes('Nutritionist');

  const roleCards: RoleCardConfig[] = [
    {
      role: 'Trainer',
      icon: '🏋️',
      name: t('auth.roleTrainer'),
      description: t('profile.trainerRoleDesc'),
      iconBg: 'rgba(201,168,76,.15)',
    },
    {
      role: 'Nutritionist',
      icon: '🥗',
      name: t('auth.roleNutritionist'),
      description: t('profile.nutritionistRoleDesc'),
      iconBg: 'rgba(52,199,89,.15)',
    },
  ];

  const isActive = (role: string) =>
    role === 'Trainer' ? hasTrainer : hasNutritionist;

  const handleToggle = async (role: string) => {
    if (isActive(role)) {
      // Toggle-off not supported — show informational toast
      addToast(t('profile.roleRemovalNotSupported'), 'error');
      return;
    }

    // Toggle-on — confirm then add role
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
    <div
      style={{
        marginBottom: 20,
        padding: '16px 18px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      {/* Section header */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 4,
        }}
      >
        {t('profile.rolesTitle')}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text2)',
          marginBottom: 14,
        }}
      >
        {t('profile.rolesSubtitle')}
      </div>

      {/* Role cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {roleCards.map((card) => {
          const active = isActive(card.role);
          return (
            <div
              key={card.role}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: card.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  {card.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text2)',
                  }}
                >
                  {card.description}
                </div>
              </div>

              {/* Toggle */}
              <button
                type="button"
                disabled={loading}
                className={`toggle${active ? ' on' : ''}`}
                onClick={() => handleToggle(card.role)}
                aria-pressed={active}
                aria-label={card.name}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {status && (
        <div style={{ marginTop: 12 }}>
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
