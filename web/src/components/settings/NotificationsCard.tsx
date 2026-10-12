import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotificationPreferences, profileKeys, updateNotificationPreferences } from '@/api/profile';
import { NotificationEvent, type NotificationPreferenceDto } from '@/api/generated';
import { showApiError } from '@/lib/api-errors';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import SettingsCard from '@/components/settings/SettingsCard';

const EVENTS = [
  { key: 'newMessage', event: NotificationEvent.NewMessage },
  { key: 'checkIn', event: NotificationEvent.WeeklyCheckInSubmitted },
  { key: 'joinRequest', event: NotificationEvent.JoinRequest },
  { key: 'photos', event: NotificationEvent.ProgressPhotosSubmitted },
  { key: 'workout', event: NotificationEvent.WorkoutFinished },
] as const;

/** API field behind each column: Email -> `email`, Coach app -> `push`. */
const CHANNELS = [
  { channel: 'email', field: 'email' },
  { channel: 'app', field: 'push' },
] as const;

type Field = (typeof CHANNELS)[number]['field'];

interface ToggleVariables {
  event: NotificationEvent;
  field: Field;
  value: boolean;
}

/** Always the full five-event set, in a stable order, as the PUT endpoint requires. */
function toFullSet(preferences: NotificationPreferenceDto[]): NotificationPreferenceDto[] {
  return EVENTS.map(({ event }) => {
    const current = preferences.find((p) => p.event === event);
    return { event, email: current?.email ?? false, push: current?.push ?? false };
  });
}

function withValue(
  preferences: NotificationPreferenceDto[],
  { event, field, value }: ToggleVariables,
): NotificationPreferenceDto[] {
  return toFullSet(preferences).map((p) => (p.event === event ? { ...p, [field]: value } : p));
}

const SAVE_KEY = ['settings', 'notifications'] as const;

export default function NotificationsCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: profileKeys.notificationPreferences,
    queryFn: getNotificationPreferences,
  });

  // Saves run one at a time (shared scope) so each PUT carries the latest cache and none lands out of order.
  const saveMutation = useMutation({
    mutationKey: SAVE_KEY,
    scope: { id: 'settings-notifications' },
    mutationFn: () =>
      updateNotificationPreferences(
        toFullSet(queryClient.getQueryData<NotificationPreferenceDto[]>(profileKeys.notificationPreferences) ?? []),
      ),
    onMutate: async (toggle: ToggleVariables) => {
      await queryClient.cancelQueries({ queryKey: profileKeys.notificationPreferences });
      const previous = toFullSet(
        queryClient.getQueryData<NotificationPreferenceDto[]>(profileKeys.notificationPreferences) ?? [],
      ).find((p) => p.event === toggle.event);
      queryClient.setQueryData<NotificationPreferenceDto[]>(profileKeys.notificationPreferences, (old) =>
        withValue(old ?? [], toggle),
      );
      return { previousValue: previous?.[toggle.field] ?? false };
    },
    onError: (error, toggle, context) => {
      // Roll back only the toggled cell so a concurrent toggle on another cell is not undone.
      queryClient.setQueryData<NotificationPreferenceDto[]>(profileKeys.notificationPreferences, (old) =>
        withValue(old ?? [], { ...toggle, value: context?.previousValue ?? !toggle.value }),
      );
      showApiError(error, 'settings.notifications.saveError');
    },
    onSettled: () => {
      // Refetch only once the last queued save settles, so an earlier response cannot flip a toggle back.
      if (queryClient.isMutating({ mutationKey: SAVE_KEY }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: profileKeys.notificationPreferences });
      }
    },
  });

  const preferences = query.data ? toFullSet(query.data) : [];

  return (
    <SettingsCard title={t('settings.notifications.title')} description={t('settings.notifications.description')}>
      {query.isPending ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : query.isError ? (
        <p role="alert" className="text-body text-error">
          {t('settings.loadError')}
        </p>
      ) : (
        <div>
          <div className="flex items-center px-1 pb-2.5 text-label font-semibold tracking-label text-muted-foreground uppercase">
            <span className="flex-1">{t('settings.notifications.event')}</span>
            <span className="flex w-22 shrink-0 justify-center">{t('settings.notifications.email')}</span>
            <span className="flex w-22 shrink-0 justify-center">{t('settings.notifications.app')}</span>
          </div>
          <ul className="border-b border-border">
            {EVENTS.map(({ key, event }) => {
              const current = preferences.find((p) => p.event === event);
              return (
                <li key={key} className="flex items-center border-t border-border px-1 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.75">
                    <span className="text-copy font-semibold text-ink">
                      {t(`settings.notifications.events.${key}.title`)}
                    </span>
                    <span className="text-body text-muted-foreground">
                      {t(`settings.notifications.events.${key}.description`)}
                    </span>
                  </div>
                  {CHANNELS.map(({ channel, field }) => (
                    <span key={channel} className="flex w-22 shrink-0 justify-center">
                      <Switch
                        checked={current?.[field] ?? false}
                        onCheckedChange={(value) => saveMutation.mutate({ event, field, value })}
                        aria-label={t(`settings.notifications.${channel}Label`, {
                          event: t(`settings.notifications.events.${key}.title`),
                        })}
                        className="data-[state=checked]:bg-primary"
                      />
                    </span>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SettingsCard>
  );
}
