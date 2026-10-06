import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { getMyProfile, getTrainerProfile, profileKeys } from '@/api/profile';
import { getErrorStatus } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import ProfileForm from '@/components/profile/ProfileForm';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';

// Fresh on every visit: the form is seeded from these once, so a stale cache entry would seed it with old values.
const FRESH = { staleTime: 0, gcTime: 0 } as const;

function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 403 || status === 404) return false;
  return failureCount < 1;
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const meQuery = useQuery({ queryKey: profileKeys.me, queryFn: getMyProfile, ...FRESH, retry: shouldRetry });
  const trainerQuery = useQuery({
    queryKey: profileKeys.trainer,
    queryFn: getTrainerProfile,
    ...FRESH,
    retry: shouldRetry,
  });

  // A failed background refetch must not replace a form the user is already editing.
  if ((trainerQuery.isError && !trainerQuery.data) || (meQuery.isError && !meQuery.data)) {
    const status = getErrorStatus(trainerQuery.error);
    const messageKey =
      trainerQuery.isError && status === 403
        ? 'profile.page.error.forbidden'
        : trainerQuery.isError && status === 404
          ? 'profile.page.error.notFound'
          : 'profile.page.error.generic';
    return (
      <div className="flex w-full max-w-6xl flex-col gap-5">
        <ProfileHeader />
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-6"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-error-soft text-error">
            <TriangleAlert className="size-4" aria-hidden="true" />
          </span>
          <p className="text-copy text-ink">{t(messageKey)}</p>
          {messageKey === 'profile.page.error.generic' && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-3.5 font-semibold"
              onClick={() => {
                void meQuery.refetch();
                void trainerQuery.refetch();
              }}
            >
              {t('profile.page.error.retry')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!meQuery.data || !trainerQuery.data) {
    return (
      <div className="flex w-full max-w-6xl flex-col gap-5">
        <ProfileHeader />
        <ProfileSkeleton />
      </div>
    );
  }

  return <ProfileForm me={meQuery.data} trainer={trainerQuery.data} />;
}
