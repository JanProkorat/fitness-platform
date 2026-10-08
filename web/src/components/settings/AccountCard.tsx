import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SettingsCard from '@/components/settings/SettingsCard';

interface Props {
  email: string;
  timeZone: string;
  saving: boolean;
  onTimeZoneChange: (timeZone: string) => void;
}

function offsetLabel(zone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((entry) => entry.type === 'timeZoneName');
    return part ? part.value.replace('GMT', 'UTC') : '';
  } catch {
    return '';
  }
}

function buildZoneOptions(current: string): { id: string; label: string }[] {
  const all = new Set<string>(Intl.supportedValuesOf('timeZone'));
  if (current) all.add(current);
  return [...all].sort().map((id) => {
    const offset = offsetLabel(id);
    return { id, label: offset ? `${id} (${offset})` : id };
  });
}

export default function AccountCard({ email, timeZone, saving, onTimeZoneChange }: Props) {
  const { t } = useTranslation();
  const zones = useMemo(() => buildZoneOptions(timeZone), [timeZone]);

  return (
    <SettingsCard title={t('settings.account.title')} description={t('settings.account.description')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.75">
          <Label htmlFor="settings-email">{t('settings.account.email')}</Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="settings-email"
              type="email"
              value={email}
              readOnly
              aria-describedby="settings-email-hint"
              className="h-10 pl-9.5 text-muted-foreground"
            />
          </div>
          <p id="settings-email-hint" className="text-meta text-muted-foreground">
            {t('settings.account.emailHint')}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-1.75">
          <Label htmlFor="settings-time-zone">{t('settings.account.timeZone')}</Label>
          <div className="relative">
            <select
              id="settings-time-zone"
              value={timeZone}
              disabled={saving}
              aria-describedby="settings-time-zone-hint"
              onChange={(event) => onTimeZoneChange(event.target.value)}
              className="h-10 w-full appearance-none rounded-field border border-input bg-background pr-9 pl-3 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <p id="settings-time-zone-hint" className="text-meta text-muted-foreground">
            {t('settings.account.timeZoneHint')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-border pt-4.5">
        <div className="flex min-w-0 flex-col gap-0.75">
          <h3 className="text-copy font-semibold text-ink">{t('settings.account.password')}</h3>
          <p className="text-body text-muted-foreground">{t('settings.account.passwordHint')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled
          title={t('shell.comingSoon')}
          className="ml-auto h-9 shrink-0 rounded-field px-3.5 font-semibold"
        >
          {t('settings.account.changePassword')}
        </Button>
      </div>
    </SettingsCard>
  );
}
