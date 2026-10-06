import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eyebrow, StoreLinks } from '@/components/home/MockupParts';
import {
  CheckInPhone,
  CoachCheckInPhone,
  CoachClientsPhone,
  TodayPhone,
} from '@/components/home/HomePhones';

// Scales only the aria-hidden phone pair so the badge and caption keep their type-scale size.
// Row = 2 x (2 x 250 + 26) x zoom + 113 = 1052 x zoom + 113; every step keeps at least 16px spare.
// The width ladder sets --mz; home-zoom-phones caps it by window height (see index.css).
const PHONES_ZOOM =
  'lg:home-zoom-phones lg:[--mz:0.71] lg:@min-[960px]:[--mz:0.78] lg:@min-[1040px]:[--mz:0.86] lg:@min-[1120px]:[--mz:0.93] lg:@min-[1182px]:[--mz:1] lg:@min-[1340px]:[--mz:1.03] lg:@min-[1472px]:[--mz:1.1] lg:@min-[1592px]:[--mz:1.2] lg:@min-[1760px]:[--mz:1.3] lg:@min-[1940px]:[--mz:1.45]';

function PhoneGroup({
  badge,
  badgeTone,
  caption,
  phonesClassName,
  children,
}: {
  badge: string;
  badgeTone: string;
  caption: string;
  phonesClassName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4.5">
      <div className="flex flex-col items-center gap-1">
        <span
          className={`rounded-full px-3 py-1.25 text-home-meta font-bold tracking-badge uppercase ${badgeTone}`}
        >
          {badge}
        </span>
        <span className="text-home-body text-muted-foreground">{caption}</span>
      </div>
      <div className={`flex flex-wrap items-start justify-center gap-6.5 ${phonesClassName}`}>
        {children}
      </div>
    </div>
  );
}

/** "The mobile app": one app, a client view and a coach view, shown as four phones. */
export default function HomeMobileApp() {
  const { t } = useTranslation();

  return (
    <section
      id="mobile-app"
      tabIndex={-1}
      className="flex flex-col justify-center px-4 pt-14 pb-16 outline-none sm:px-10 lg:home-section-pad lg:min-h-svh lg:px-16"
    >
      <div className="@container home-tier-phones mx-auto flex w-full max-w-home flex-col items-center gap-12 lg:gap-[clamp(1.5rem,4svh,3rem)]">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <Eyebrow className="text-marker">{t('home.app.eyebrow')}</Eyebrow>
          <h2 className="font-display text-home-heading font-semibold tracking-heading text-ink">
            {t('home.app.title')}
          </h2>
          <p className="max-w-170 text-home-lead text-ink-2">{t('home.app.lead')}</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <StoreLinks appStore={t('home.app.appStore')} googlePlay={t('home.app.googlePlay')} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-14 lg:flex-row lg:items-start">
          <PhoneGroup
            badge={t('home.app.clients.badge')}
            badgeTone="bg-primary text-primary-foreground"
            caption={t('home.app.clients.caption')}
            phonesClassName={PHONES_ZOOM}
          >
            <TodayPhone />
            <CheckInPhone />
          </PhoneGroup>
          <span className="hidden w-px self-stretch bg-border lg:block" />
          <PhoneGroup
            badge={t('home.app.you.badge')}
            badgeTone="bg-marker-solid text-on-dark"
            caption={t('home.app.you.caption')}
            phonesClassName={PHONES_ZOOM}
          >
            <CoachClientsPhone />
            <CoachCheckInPhone />
          </PhoneGroup>
        </div>
      </div>
    </section>
  );
}
