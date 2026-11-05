import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellIcon, BellOffIcon, InfoIcon, Link2OffIcon, TriangleAlertIcon } from 'lucide-react';
import { getErrorCode, getErrorStatus } from '@/lib/api-errors';
import { NotificationEvent, turnOffEmail, turnOnEmail } from '@/api/email-links';
import type { EmailLinkTurnOffResponse } from '@/api/email-links';
import { profileKeys } from '@/api/profile';
import { Button } from '@/components/ui/button';
import Wordmark from '@/components/brand/Wordmark';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';

/** Same labels as Settings > Notifications (`settings.notifications.events.<key>.title`). */
const EVENT_LABEL_KEY: Record<NotificationEvent, string> = {
  [NotificationEvent.NewMessage]: 'newMessage',
  [NotificationEvent.WeeklyCheckInSubmitted]: 'checkIn',
  [NotificationEvent.JoinRequest]: 'joinRequest',
  [NotificationEvent.ProgressPhotosSubmitted]: 'photos',
  [NotificationEvent.WorkoutFinished]: 'workout',
};

/**
 * "/email-off" — the page behind the "Turn off these emails" link in notification emails. It turns the
 * email off once on load (the action is idempotent and reversible with "Turn back on"), reads the token
 * once into state and removes it from the address bar. Works signed out; lives outside ProtectedRoute and
 * EntryPage, next to "/bank-account/undo".
 */
export default function EmailTurnOffPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  // Read once, verbatim: URLSearchParams already decodes, so a second decode would corrupt the token.
  const [token] = useState(() => searchParams.get('token'));
  const hasToken = token !== null && token !== '';

  // Keep the token out of the address bar, the history entry and anything that copies the URL.
  useEffect(() => {
    if (token !== null) {
      navigate(pathname, { replace: true });
    }
  }, [token, navigate, pathname]);

  const refreshPreferences = () => {
    void queryClient.invalidateQueries({ queryKey: profileKeys.notificationPreferences });
  };

  // A query, not a mutation fired from an effect: under StrictMode the discarded first mount's mutation
  // observer is gone when the request settles, so the surviving mount never sees the result. The query
  // cache lives outside the mount, so both mounts share one entry and exactly one request goes out.
  const turnOffQuery = useQuery({
    queryKey: ['email-off', token],
    queryFn: async () => {
      // Non-null: this only runs when `enabled` (below) is true.
      const data = await turnOffEmail(token as string);
      refreshPreferences();
      return data;
    },
    enabled: hasToken,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const turnOnMutation = useMutation({
    mutationFn: (value: string) => turnOnEmail(value),
    onSuccess: refreshPreferences,
  });

  const shell = (children: ReactNode) => (
    <div className="email-page-wash flex min-h-screen flex-col bg-background">
      <header className="flex h-19 shrink-0 items-center px-4 sm:px-10 lg:px-16">
        <Wordmark to="/" />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-19">
        <Card data-testid="email-turn-off">{children}</Card>
      </main>
      <footer className="flex h-14 shrink-0 items-center justify-center text-caption text-muted-foreground">
        {t('emailOff.footer')}
      </footer>
    </div>
  );

  const note = (text: string) => (
    <div className="flex w-full items-start gap-2.5 rounded-xl bg-sunken px-3.5 py-3 text-left text-meta leading-relaxed text-muted-foreground">
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );

  const details = (data: EmailLinkTurnOffResponse) => (
    <dl className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-left text-meta">
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-muted-foreground">{t('emailOff.account')}</dt>
        <dd className="truncate font-semibold text-ink">{data.email}</dd>
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 text-right">
        <dt className="text-muted-foreground">{t('emailOff.emailLabel')}</dt>
        <dd className="font-semibold text-ink">
          {data.event ? t(`settings.notifications.events.${EVENT_LABEL_KEY[data.event]}.title`) : null}
        </dd>
      </div>
    </dl>
  );

  const settingsButton = (
    <Button type="button" className="w-full" onClick={() => navigate('/settings')}>
      {t('emailOff.settings')}
    </Button>
  );

  const invalidCard = () =>
    shell(
      <>
        <div className="flex size-11.5 items-center justify-center rounded-xl bg-caution-soft text-caution-ink">
          <Link2OffIcon className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>{t('emailOff.invalid.title')}</CardTitle>
        <CardDescription role="alert">{t('emailOff.invalid.body')}</CardDescription>
        <CardContent>
          {note(t('emailOff.invalid.note'))}
          <Button type="button" className="w-full" onClick={() => navigate('/login')}>
            {t('emailOff.invalid.signIn')}
          </Button>
        </CardContent>
      </>,
    );

  // Only the backend's uniform invalid-link answer (400, EMAIL_LINK_INVALID) means the link is broken.
  // The NSwag client throws the parsed 400 body itself (no status), so check the code as well as the status.
  const linkIsInvalid =
    turnOffQuery.isError &&
    (getErrorStatus(turnOffQuery.error) === 400 || getErrorCode(turnOffQuery.error) === 'EMAIL_LINK_INVALID');

  if (!hasToken || linkIsInvalid) {
    return invalidCard();
  }

  // Rate limit (429), server or network failure: the link may be fine, so offer one manual retry.
  if (turnOffQuery.isError) {
    return shell(
      <>
        <div className="flex size-11.5 items-center justify-center rounded-xl bg-caution-soft text-caution-ink">
          <TriangleAlertIcon className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>{t('emailOff.failed.title')}</CardTitle>
        <CardDescription role="alert">{t('emailOff.failed.body')}</CardDescription>
        <CardContent>
          <Button
            type="button"
            className="w-full"
            disabled={turnOffQuery.isFetching}
            onClick={() => void turnOffQuery.refetch()}
          >
            {t('emailOff.failed.retry')}
          </Button>
        </CardContent>
      </>,
    );
  }

  if (turnOffQuery.isSuccess) {
    const data = turnOnMutation.isSuccess ? turnOnMutation.data : turnOffQuery.data;
    const isOn = turnOnMutation.isSuccess;
    const label = data.event ? t(`settings.notifications.events.${EVENT_LABEL_KEY[data.event]}.title`) : '';
    return shell(
      <>
        <div className="flex size-11.5 items-center justify-center rounded-xl bg-success-soft text-success-ink">
          {isOn ? (
            <BellIcon className="size-5" aria-hidden="true" />
          ) : (
            <BellOffIcon className="size-5" aria-hidden="true" />
          )}
        </div>
        <CardTitle>{t(isOn ? 'emailOff.on.title' : 'emailOff.off.title')}</CardTitle>
        <CardDescription role="status">
          {t(isOn ? 'emailOff.on.body' : 'emailOff.off.body', { event: label })}
        </CardDescription>
        <CardContent>
          {details(data)}
          {note(t(isOn ? 'emailOff.on.note' : 'emailOff.off.note'))}
          {settingsButton}
          {isOn ? null : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={turnOnMutation.isPending}
              onClick={() => turnOnMutation.mutate(token)}
            >
              {turnOnMutation.isPending ? t('emailOff.off.working') : t('emailOff.off.turnOn')}
            </Button>
          )}
          {turnOnMutation.isError ? (
            <p role="alert" className="text-meta text-error">
              {t('emailOff.off.turnOnFailed')}{' '}
              <Link to="/settings" className="underline underline-offset-4">
                {t('emailOff.settings')}
              </Link>
            </p>
          ) : null}
        </CardContent>
      </>,
    );
  }

  return shell(
    <CardDescription role="status" data-testid="email-turn-off-loading">
      {t('emailOff.loading')}
    </CardDescription>,
  );
}
