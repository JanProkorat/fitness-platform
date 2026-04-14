import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { ROLES, type Role } from './register-types';

interface RegisterStep1Props {
  selectedRoles: Set<Role>;
  onToggleRole: (role: Role) => void;
  onContinue: () => void;
}

export function RegisterStep1({ selectedRoles, onToggleRole, onContinue }: RegisterStep1Props) {
  return (
    <>
      <div className="auth-title">
        Vytvoření <span>účtu</span>
      </div>
      <div className="auth-sub">
        Kdo jste? Obsah aplikace přizpůsobíme vaší roli.
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
            <div className="auth-role-name">{role.name}</div>
            <div className="auth-role-desc">{role.desc}</div>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, marginTop: -8, textAlign: 'center' }}>
        Můžete vybrat i obě role současně.
      </p>

      <button
        type="button"
        onClick={onContinue}
        disabled={selectedRoles.size === 0}
        className="btn-auth-primary"
        style={{ marginTop: 4 }}
      >
        Pokračovat →
      </button>

      <div className="auth-footer">
        Máte účet?{' '}
        <Link to="/login">Přihlaste se</Link>
      </div>
    </>
  );
}
