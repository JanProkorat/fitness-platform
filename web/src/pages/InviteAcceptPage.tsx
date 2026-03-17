import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const INVITE_TOKEN_KEY = 'pendingInviteToken';

/**
 * Stores the invitation token from the email link and redirects
 * to login (or register). After the user authenticates, the token
 * is picked up automatically and the invitation is accepted.
 */
export default function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem(INVITE_TOKEN_KEY, token);
    }
    navigate('/login', { replace: true, state: { fromInvite: true } });
  }, [searchParams, navigate]);

  return null;
}

export { INVITE_TOKEN_KEY };
