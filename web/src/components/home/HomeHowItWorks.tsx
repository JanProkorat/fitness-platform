// Pixel sizes and positions in this file are illustration drawing copied from the board, not layout tokens.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eyebrow, MacroBar, MealDot } from '@/components/home/MockupParts';
import { IconChevronRight, IconCursor, IconEyeOff } from '@/components/home/HomeIcons';

const TILE =
  'box-border flex h-[54px] flex-col gap-0.75 rounded-tile border border-border bg-surface px-2.25 py-1.75';

function BuildMock() {
  const { t } = useTranslation();
  const tiles = [
    { food: 'oatBowl', kcal: 420 },
    { food: 'eggToast', kcal: 460 },
    { food: 'lentilCurry', kcal: 560 },
  ] as const;

  return (
    <div className="relative mx-auto grid w-[258px] max-w-full grid-cols-2 gap-2">
      {tiles.map((tile) => (
        <div key={tile.food} className={TILE}>
          <span className="text-caption font-semibold text-ink">{t(`home.mock.foods.${tile.food}`)}</span>
          <span className="text-mockup-xs text-muted-foreground">
            {tile.kcal} {t('home.mock.kcal')}
          </span>
        </div>
      ))}
      <div className="h-[54px] rounded-tile border-[1.5px] border-dashed border-nutrition bg-nutrition-soft" />
      <div className="absolute top-[74px] left-[118px] flex w-[140px] -rotate-4 items-center gap-2 rounded-field border border-border bg-surface px-2.5 py-2 shadow-card">
        <span className="size-[26px] rounded-thumb bg-photo-peach" />
        <span className="flex flex-col">
          <span className="text-caption font-bold text-ink">{t('home.mock.foods.chickenBowl')}</span>
          <span className="text-mockup-xs text-muted-foreground">640 {t('home.mock.kcal')}</span>
        </span>
      </div>
      <div className="absolute top-[112px] left-[236px]">
        <IconCursor />
      </div>
    </div>
  );
}

function PublishMock() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3.5">
      <div className="flex grow flex-col gap-2">
        <span className="text-caption text-muted-foreground">{t('home.mock.weekReady')}</span>
        <span className="flex h-10 items-center justify-center rounded-field bg-primary text-body font-bold text-primary-foreground">
          {t('home.mock.publishWeek')}
        </span>
      </div>
      <span className="text-marker">
        <IconChevronRight />
      </span>
      <div className="box-border flex h-[118px] w-[78px] shrink-0 flex-col gap-1.25 rounded-card border-4 border-ink px-1.5 py-2">
        <span className="h-5 rounded-sm bg-marker" />
        <span className="h-2 rounded-xs bg-border" />
        <span className="h-2 w-[70%] rounded-xs bg-border" />
        <span className="h-2 rounded-xs bg-border" />
      </div>
    </div>
  );
}

function FollowMock() {
  const { t } = useTranslation();
  const rows = [
    { kind: 'breakfast', food: 'eggToast', kcal: 460, done: true },
    { kind: 'lunch', food: 'chickenBowl', kcal: 640, done: true },
    { kind: 'dinner', food: 'beefStirFry', kcal: 590, done: false },
  ] as const;

  return (
    <div className="flex flex-col">
      {rows.map((row) => (
        <div key={row.kind} className="flex items-center gap-2.25 border-t border-border py-1.75">
          <MealDot done={row.done} size={row.done ? 'size-[18px]' : 'size-4'} />
          <span className="flex flex-col">
            <span className="text-mockup-xs text-muted-foreground">{t(`home.mock.meals.${row.kind}`)}</span>
            <span className="text-meta font-semibold text-ink">{t(`home.mock.foods.${row.food}`)}</span>
          </span>
          <span className="ml-auto text-caption text-muted-foreground">{row.kcal}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2 text-caption text-muted-foreground">
        <span className="grow">
          <MacroBar height="h-1" />
        </span>
        {t('home.mock.dayProgress')}
      </div>
    </div>
  );
}

function SeeMock() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-stat font-semibold text-ink">{t('home.mock.weightValue')}</span>
        <span className="text-meta text-muted-foreground">{t('home.mock.kg')}</span>
        <span className="ml-auto rounded-sm bg-nutrition-soft px-2 py-0.75 text-caption font-bold text-nutrition-ink">
          {t('home.mock.weightDelta')}
        </span>
      </div>
      <div className="flex gap-1.5">
        <span className="h-[58px] grow rounded-lg bg-photo-sand" />
        <span className="h-[58px] grow rounded-lg bg-photo-tan" />
        <span className="h-[58px] grow rounded-lg bg-photo-clay" />
      </div>
      <span className="text-caption text-muted-foreground">{t('home.mock.checkinNote')}</span>
    </div>
  );
}

function StepCard({ index, stepKey, children }: { index: number; stepKey: string; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div
        aria-hidden="true"
        className="box-border flex h-[196px] flex-col justify-center rounded-card border border-border bg-surface p-5 lg:home-zoom-card lg:[--mz:0.65] lg:@min-[960px]:[--mz:0.72] lg:@min-[1040px]:[--mz:0.79] lg:@min-[1120px]:[--mz:0.85] lg:@min-[1200px]:[--mz:0.92] lg:@min-[1290px]:[--mz:1] lg:@min-[1340px]:[--mz:1.03] lg:@min-[1472px]:[--mz:1.1] lg:@min-[1592px]:[--mz:1.2] lg:@min-[1760px]:[--mz:1.3] lg:@min-[1940px]:[--mz:1.45]"
      >
        {children}
      </div>
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-home-subhead font-semibold text-marker">{index}</span>
        <h3 className="font-display text-home-step-title font-semibold text-ink">{t(`home.steps.${stepKey}.title`)}</h3>
      </div>
      <p className="text-home-copy text-muted-foreground">{t(`home.how.steps.${stepKey}`)}</p>
    </div>
  );
}

function PhoneNotification({ kind }: { kind: 'ready' | 'workout' | 'checkin' }) {
  const { t } = useTranslation();

  return (
    <div className="box-border flex items-start gap-2.5 rounded-2xl bg-notif px-3 py-2.5 text-on-dark shadow-popover">
      <span className="flex size-[26px] shrink-0 items-center justify-center rounded-thumb border border-on-dark/20 bg-scrim font-display text-mockup-badge font-semibold text-marker-bright">
        {t('home.mock.notifBadge')}
      </span>
      <span className="flex grow flex-col gap-0.5 text-mockup-notif">
        <span className="flex font-bold">
          {t(`home.how.phone.${kind}.title`)}
          <span className="ml-auto font-normal opacity-60">{t('home.mock.notifNow')}</span>
        </span>
        <span>{t(`home.how.phone.${kind}.body`)}</span>
      </span>
    </div>
  );
}

/** What the client's phone shows for the four moments: nothing while drafting, then three notifications. */
function ClientPhoneRow() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3.5 border-t border-border pt-8">
      <span className="text-home-meta font-bold tracking-eyebrow text-muted-foreground uppercase">
        {t('home.how.phone.label')}
      </span>
      <div className="grid grid-cols-1 items-center gap-5.5 max-lg:@min-[560px]:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-border px-3 py-2.5 text-mockup-notif text-muted-foreground">
          <span className="shrink-0">
            <IconEyeOff />
          </span>
          <span>{t('home.how.phone.empty')}</span>
        </div>
        <PhoneNotification kind="ready" />
        <PhoneNotification kind="workout" />
        <PhoneNotification kind="checkin" />
      </div>
    </div>
  );
}

/** "How it works": one client week in four moments, each with a small product vignette. */
export default function HomeHowItWorks() {
  const { t } = useTranslation();

  return (
    <section
      id="how-it-works"
      tabIndex={-1}
      className="flex flex-col justify-center px-4 py-14 outline-none sm:px-10 lg:home-section-pad lg:min-h-svh lg:px-16"
    >
      <div className="@container home-tier mx-auto flex w-full max-w-home flex-col gap-9">
        <div className="flex flex-col gap-2.5">
          <Eyebrow className="text-muted-foreground">{t('home.how.eyebrow')}</Eyebrow>
          <h2 className="font-display text-home-heading font-semibold tracking-heading text-ink">
            {t('home.how.title')}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5.5 max-lg:@min-[560px]:grid-cols-2 lg:grid-cols-4">
          <StepCard index={1} stepKey="build">
            <BuildMock />
          </StepCard>
          <StepCard index={2} stepKey="publish">
            <PublishMock />
          </StepCard>
          <StepCard index={3} stepKey="follow">
            <FollowMock />
          </StepCard>
          <StepCard index={4} stepKey="see">
            <SeeMock />
          </StepCard>
        </div>
        <ClientPhoneRow />
      </div>
    </section>
  );
}
