import { Link } from 'react-router-dom';

interface RegisterStep4Props {
  email: string;
}

export function RegisterStep4({ email }: RegisterStep4Props) {
  return (
    <div className="auth-success">
      {/* Success icon */}
      <div className="auth-success-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="auth-success-title">
        Účet byl vytvořen!
      </div>
      <div className="auth-success-text">
        Poslali jsme vám ověřovací email. Klikněte na odkaz v emailu
        pro aktivaci účtu.
      </div>

      {/* Email confirmation box */}
      <div style={{ marginTop: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg2)', padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Email odeslán na:</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{email}</div>
      </div>

      {/* Go to login */}
      <Link
        to="/login"
        className="btn-auth-primary"
        style={{ marginTop: 16, textDecoration: 'none' }}
      >
        Přejít na přihlášení
      </Link>

      <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)' }}>
        Email nedorazil?{' '}
        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, color: 'var(--blue)', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
          Odeslat znovu
        </button>
      </div>
    </div>
  );
}
