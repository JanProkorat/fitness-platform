import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { ROLES, type Role } from './register-types';

interface RegisterStep1Props {
  selectedRoles: Set<Role>;
  onToggleRole: (role: Role) => void;
  onContinue: () => void;
}

export function RegisterStep1({ selectedRoles, onToggleRole, onContinue }: RegisterStep1Props) {
  const { t } = useTranslation();
  return (
    <>
      <div className="auth-title">
        {t('auth.registerHeroTitle')} <span>{t('auth.registerHeroTitleHighlight')}</span>
      </div>
      <div className="auth-sub">
        {t('auth.registerStep1Subtitle')}
      </div>

      <div className="auth-role-grid">
        {ROLES.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => onToggleRole(role.value)}
            className={cn(
              'auth-role-card',
              selectedRoles.has(role.value) && 'selected',
            )}
          >
            <div className="auth-role-icon">{role.icon}</div>
            <div className="auth-role-name">{t(role.nameKey)}</div>
            <div className="auth-role-desc">{t(role.descKey)}</div>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, marginTop: -8, textAlign: 'center' }}>
        {t('auth.registerStep1MultiRoleHint')}
      </p>

      <button
        type="button"
        onClick={onContinue}
        disabled={selectedRoles.size === 0}
        className="btn-auth-primary"
        style={{ marginTop: 4 }}
      >
        {t('auth.continueButton')}
      </button>

      <div className="auth-footer">
        {t('auth.hasAccountRegister')}{' '}
        <Link to="/login">{t('auth.loginLinkText')}</Link>
      </div>
    </>
  );
}
