import {
  CalendarIcon,
  CheckIcon,
  MessageSquareIcon,
  SearchIcon,
  SmartphoneIcon,
  UsersIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useChanged } from '@/hooks/useChanged';
import StoreButtons from '@/components/register/StoreButtons';
import { SOME_STORE_MISSING } from '@/components/register/storeLinks';

export type RegisterAsideVariant = 'coach' | 'client';

const STEPS: Record<RegisterAsideVariant, { id: string; icon: LucideIcon }[]> = {
  coach: [
    { id: 'account', icon: CheckIcon },
    { id: 'profile', icon: UsersIcon },
    { id: 'invite', icon: MessageSquareIcon },
    { id: 'week', icon: CalendarIcon },
  ],
  client: [
    { id: 'account', icon: CheckIcon },
    { id: 'app', icon: SmartphoneIcon },
    { id: 'coach', icon: SearchIcon },
    { id: 'plan', icon: CalendarIcon },
  ],
};

/** Right-hand explainer of the register page; copy follows the selected role. */
export default function RegisterAside({ variant }: { variant: RegisterAsideVariant }) {
  const { t } = useTranslation();
  const steps = STEPS[variant];
  const base = `entry.register.aside.${variant}`;
  const swapped = useChanged(variant);

  return (
    <aside
      key={variant}
      className={cn(
        'flex flex-col gap-6 lg:pt-7 short:gap-4 short:pt-3',
        swapped && 'animate-content-in motion-reduce:animate-none'
      )}
    >
      <p className="text-meta font-semibold tracking-eyebrow text-muted-foreground uppercase">
        {t(`${base}.eyebrow`)}
      </p>
      <h2 className="font-display text-home-banner font-semibold tracking-heading text-ink short:text-card-title">
        {t(`${base}.titleLead`)} <span className="text-marker">{t(`${base}.titleAccent`)}</span>
      </h2>
      <ol className="flex flex-col gap-5.5 short:gap-3.5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const first = index === 0;
          return (
            <li key={step.id} className="relative flex gap-3.5">
              <span
                className={cn(
                  'box-border flex size-9 shrink-0 items-center justify-center rounded-full bg-surface',
                  first
                    ? 'border-2 border-marker text-marker'
                    : 'border-[1.5px] border-border text-muted-foreground'
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-10 -bottom-4.5 left-4.25 w-0.5 bg-line"
                />
              )}
              <span className="flex flex-col gap-0.75 pt-0.5">
                <span className={cn('text-subhead font-bold', first ? 'text-ink' : 'text-ink-2')}>
                  {t(`${base}.steps.${step.id}.title`)}
                </span>
                <span className="text-body leading-normal text-muted-foreground">
                  {t(`${base}.steps.${step.id}.body`)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {variant === 'coach' && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-4">
          <span
            aria-hidden="true"
            className="flex size-15 shrink-0 items-center justify-center rounded-xl bg-phone-bezel font-display text-subhead font-semibold text-on-dark"
          >
            {t('home.brand.form').charAt(0)}
            <span className="text-marker">{t('home.brand.up').charAt(0)}</span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-subhead font-bold text-ink">{t(`${base}.app.title`)}</span>
            <span className="text-body leading-normal text-muted-foreground">
              {t(`${base}.app.body`)}
            </span>
            {SOME_STORE_MISSING && (
              <span className="text-caption font-medium text-muted-foreground">
                {t('entry.register.stores.comingSoon')}
              </span>
            )}
          </span>
          <StoreButtons className="shrink-0" />
        </div>
      )}
    </aside>
  );
}
