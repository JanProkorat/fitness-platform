import { isClientProfile } from '@/api/profile';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/stores/auth';

export type AuthPhase =
  | 'loggedOut'
  | 'loading'
  | 'error'
  | 'unverified'
  | 'verified'
  | 'onboarding'
  | 'coach'
  | 'home';

/**
 * Where the app belongs right now, derived from the session and the profile.
 * `loading` keeps the logged-out screens mounted while the profile loads;
 * `error` means the profile could not be loaded and the user can retry.
 */
export function useAuthPhase(): { phase: AuthPhase; retry: () => void } {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sawUnverified = useAuthStore((state) => state.sawUnverified);
  const verifiedAcknowledged = useAuthStore((state) => state.verifiedAcknowledged);
  const { data: profile, isError, refetch } = useProfile();
  const retry = () => void refetch();

  if (!isAuthenticated) return { phase: 'loggedOut', retry };
  if (!profile) return { phase: isError ? 'error' : 'loading', retry };
  if (!profile.emailConfirmed) return { phase: 'unverified', retry };
  if (sawUnverified && !verifiedAcknowledged) return { phase: 'verified', retry };
  if (!isClientProfile(profile)) return { phase: 'coach', retry };
  return { phase: profile.isOnboardingComplete ? 'home' : 'onboarding', retry };
}
