import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import SettingsCard from '@/components/settings/SettingsCard';

const EVENTS = [
  { key: 'newMessage', email: true, app: true },
  { key: 'checkIn', email: true, app: true },
  { key: 'joinRequest', email: true, app: true },
  { key: 'photos', email: false, app: true },
  { key: 'workout', email: false, app: false },
] as const;

/** Rendered disabled until the notification-preferences endpoints land. */
export default function NotificationsCard() {
  const { t } = useTranslation();

  return (
    <SettingsCard title={t('settings.notifications.title')} description={t('settings.notifications.description')}>
      <div>
        <div className="flex items-center px-1 pb-2.5 text-label font-semibold tracking-label text-muted-foreground uppercase">
          <span className="flex-1">{t('settings.notifications.event')}</span>
          <span className="flex w-22 shrink-0 justify-center">{t('settings.notifications.email')}</span>
          <span className="flex w-22 shrink-0 justify-center">{t('settings.notifications.app')}</span>
        </div>
        <ul className="border-b border-border">
          {EVENTS.map((event) => (
            <li key={event.key} className="flex items-center border-t border-border px-1 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.75">
                <span className="text-copy font-semibold text-ink">
                  {t(`settings.notifications.events.${event.key}.title`)}
                </span>
                <span className="text-body text-muted-foreground">
                  {t(`settings.notifications.events.${event.key}.description`)}
                </span>
              </div>
              {(['email', 'app'] as const).map((channel) => (
                <span key={channel} className="flex w-22 shrink-0 justify-center">
                  <Switch
                    disabled
                    checked={event[channel]}
                    aria-label={t(`settings.notifications.${channel}Label`, {
                      event: t(`settings.notifications.events.${event.key}.title`),
                    })}
                    className="data-[state=checked]:bg-primary"
                  />
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </SettingsCard>
  );
}
