import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eyebrow, StoreLinks } from '@/components/home/MockupParts';
import {
  CheckInPhone,
  CoachCheckInPhone,
  CoachClientsPhone,
  TodayPhone,
} from '@/components/home/HomePhones';

function PhoneGroup({
  badge,
  badgeTone,
  caption,
  children,
}: {
  badge: string;
  badgeTone: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4.5">
      <div className="flex flex-col items-center gap-1">
        <span
          className={`rounded-full px-3 py-1.25 text-meta font-bold tracking-badge uppercase ${badgeTone}`}
        >
          {badge}
        </span>
        <span className="text-body text-muted-foreground">{caption}</span>
      </div>
      <div className="flex flex-wrap items-start justify-center gap-6.5">{children}</div>
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
      className="@container flex scroll-mt-6 outline-none flex-col items-center gap-12 px-4 pt-14 pb-16 sm:px-10 lg:px-16 lg:pt-24 lg:pb-22.5"
    >
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
      <div className="flex flex-col items-center gap-14 @min-[1240px]:flex-row @min-[1240px]:items-start">
        <PhoneGroup
          badge={t('home.app.clients.badge')}
          badgeTone="bg-primary text-primary-foreground"
          caption={t('home.app.clients.caption')}
        >
          <TodayPhone />
          <CheckInPhone />
        </PhoneGroup>
        <span className="hidden w-px self-stretch bg-border @min-[1240px]:block" />
        <PhoneGroup
          badge={t('home.app.you.badge')}
          badgeTone="bg-marker text-on-dark"
          caption={t('home.app.you.caption')}
        >
          <CoachClientsPhone />
          <CoachCheckInPhone />
        </PhoneGroup>
      </div>
    </section>
  );
}
