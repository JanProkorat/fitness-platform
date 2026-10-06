// Pixel sizes and positions in this file are illustration drawing copied from the board, not layout tokens.
import { useTranslation } from 'react-i18next';
import { GlassCard, MealDot, PhoneFrame } from '@/components/home/MockupParts';
import { IconArrowUp, IconDumbbell } from '@/components/home/HomeIcons';

interface TodayMeal {
  kind: 'breakfast' | 'snack' | 'lunch' | 'dinner';
  food: 'eggToast' | 'appleAlmonds' | 'chickenBowl' | 'beefStirFry';
  kcal: number;
  done: boolean;
  active?: boolean;
}

const TODAY_MEALS: TodayMeal[] = [
  { kind: 'breakfast', food: 'eggToast', kcal: 460, done: true },
  { kind: 'snack', food: 'appleAlmonds', kcal: 210, done: true },
  { kind: 'lunch', food: 'chickenBowl', kcal: 640, done: false, active: true },
  { kind: 'dinner', food: 'beefStirFry', kcal: 590, done: false },
];

const PHOTO_TINTS = ['bg-photo-sand', 'bg-photo-tan', 'bg-photo-clay'] as const;

/** Client app, home screen: today's meals and the next workout. */
export function TodayPhone({ size = 'standard' }: { size?: 'hero' | 'standard' }) {
  const { t } = useTranslation();

  return (
    <PhoneFrame size={size}>
      <div className="flex flex-col gap-0.5 px-1.5 pt-1.5">
        <span className="text-caption text-muted-foreground">{t('home.mock.date')}</span>
        <span className="font-display text-mockup-greeting font-semibold text-ink">
          {t('home.mock.greeting')}
        </span>
      </div>
      <GlassCard className="flex flex-col gap-0.5 rounded-glass px-1.5 pt-2.5 pb-1.5">
        <span className="flex px-2.5 pb-1.5 text-meta font-bold text-ink">
          {t('home.mock.todaysMeals')}
          <span className="ml-auto font-medium text-muted-foreground">{t('home.mock.mealsProgress')}</span>
        </span>
        {TODAY_MEALS.map((meal) => (
          <div
            key={meal.kind}
            className={`box-border flex h-[46px] items-center gap-2.5 rounded-xl border-2 px-2.5 ${
              meal.active ? 'border-marker' : 'border-transparent'
            }`}
          >
            <MealDot done={meal.done} size={meal.done ? 'size-5' : 'size-[18px]'} />
            <span className="flex min-w-0 flex-col gap-px">
              <span className="text-mockup-xs text-muted-foreground">{t(`home.mock.meals.${meal.kind}`)}</span>
              <span className="text-meta font-semibold whitespace-nowrap text-ink">
                {t(`home.mock.foods.${meal.food}`)}
              </span>
            </span>
            <span className="ml-auto text-caption text-muted-foreground">{meal.kcal}</span>
          </div>
        ))}
      </GlassCard>
      <GlassCard className="flex items-center gap-2.5 rounded-glass px-3.5 py-3">
        <span className="flex size-[34px] items-center justify-center rounded-field bg-training-soft text-training">
          <IconDumbbell />
        </span>
        <span className="flex flex-col">
          <span className="text-meta font-semibold text-ink">{t('home.mock.workoutName')}</span>
          <span className="text-caption text-muted-foreground">{t('home.mock.workoutMeta')}</span>
        </span>
        <span className="ml-auto rounded-full bg-training px-2.5 py-1.5 text-caption font-bold text-on-training">
          {t('home.mock.start')}
        </span>
      </GlassCard>
    </PhoneFrame>
  );
}

/** Client app: the weekly check-in form. */
export function CheckInPhone() {
  const { t } = useTranslation();

  return (
    <PhoneFrame className="mt-12.5">
      <div className="flex flex-col gap-0.5 px-1.5 py-1">
        <span className="text-caption text-muted-foreground">{t('home.mock.checkInWeek')}</span>
        <span className="font-display text-mockup-title font-semibold">{t('home.mock.weeklyCheckIn')}</span>
      </div>
      <GlassCard className="rounded-card px-3.5 py-3">
        <span className="text-caption text-muted-foreground">{t('home.mock.weight')}</span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-stat font-semibold">{t('home.mock.weightValue')}</span>
          <span className="text-meta text-muted-foreground">{t('home.mock.kg')}</span>
          <span className="ml-auto text-caption font-bold text-nutrition">{t('home.mock.weightDeltaShort')}</span>
        </div>
      </GlassCard>
      <GlassCard className="rounded-card px-3.5 py-3">
        <span className="text-caption text-muted-foreground">{t('home.mock.progressPhotos')}</span>
        <div className="flex gap-1.5 pt-1.5">
          {PHOTO_TINTS.map((tint) => (
            <span key={tint} className={`h-16 grow rounded-field ${tint}`} />
          ))}
        </div>
      </GlassCard>
      <GlassCard className="rounded-card px-3.5 py-3">
        <span className="text-caption text-muted-foreground">{t('home.mock.energyThisWeek')}</span>
        <div className="flex gap-1.25 pt-1.5">
          {[1, 2, 3, 4, 5].map((level) => (
            <span
              key={level}
              className={`flex h-[30px] grow items-center justify-center rounded-tile text-meta font-bold ${
                level === 4 ? 'bg-marker text-on-dark' : 'border border-muted-foreground/30'
              }`}
            >
              {level}
            </span>
          ))}
        </div>
      </GlassCard>
      <span className="mt-auto flex h-10 items-center justify-center rounded-full bg-marker text-body font-bold text-on-dark">
        {t('home.mock.sendToCoach')}
      </span>
    </PhoneFrame>
  );
}

interface ClientRow {
  name: string;
  note: 'checkinWaiting' | 'missedMeals' | 'workoutDone' | 'allMeals';
  noteTone: string;
  tint: string;
}

const NEEDS_YOU: ClientRow[] = [
  { name: 'Petra N.', note: 'checkinWaiting', noteTone: 'text-marker', tint: 'bg-photo-tan' },
  { name: 'Tomáš K.', note: 'missedMeals', noteTone: 'text-training', tint: 'bg-photo-mist' },
];

const ON_TRACK: ClientRow[] = [
  { name: 'Eva M.', note: 'workoutDone', noteTone: 'text-nutrition', tint: 'bg-photo-sage' },
  { name: 'Lukáš P.', note: 'allMeals', noteTone: 'text-nutrition', tint: 'bg-photo-rose' },
];

function ClientList({ rows }: { rows: ClientRow[] }) {
  const { t } = useTranslation();

  return rows.map((row) => (
    <div
      key={row.name}
      className="flex items-center gap-2.5 border-t border-muted-foreground/20 px-1 py-2.25"
    >
      <span className={`size-8 rounded-full ${row.tint}`} />
      <span className="flex flex-col gap-px">
        <span className="text-body font-semibold">{row.name}</span>
        <span className={`text-caption ${row.noteTone}`}>{t(`home.mock.clientNotes.${row.note}`)}</span>
      </span>
    </div>
  ));
}

/** Coach app: client list sorted by who needs attention. */
export function CoachClientsPhone() {
  const { t } = useTranslation();

  return (
    <PhoneFrame>
      <div className="flex flex-col gap-0.5 px-1.5 py-1">
        <span className="text-caption text-muted-foreground">{t('home.mock.coachClients')}</span>
        <span className="font-display text-mockup-title font-semibold">{t('home.mock.clientsTitle')}</span>
      </div>
      <GlassCard className="rounded-card px-3 py-2.5">
        <span className="text-caption font-bold tracking-caps text-marker uppercase">
          {t('home.mock.needsYou')}
        </span>
        <ClientList rows={NEEDS_YOU} />
      </GlassCard>
      <GlassCard className="rounded-card px-3 py-2.5">
        <span className="text-caption font-bold tracking-caps text-muted-foreground uppercase">
          {t('home.mock.onTrack')}
        </span>
        <ClientList rows={ON_TRACK} />
      </GlassCard>
    </PhoneFrame>
  );
}

const TREND_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 40],
  [34, 34],
  [68, 30],
  [102, 26],
  [136, 20],
  [170, 14],
];

/** Coach app: reviewing one client's check-in. */
export function CoachCheckInPhone() {
  const { t } = useTranslation();

  return (
    <PhoneFrame className="mt-12.5">
      <div className="flex flex-col gap-0.5 px-1.5 py-1">
        <span className="text-caption text-muted-foreground">{t('home.mock.reviewSubtitle')}</span>
        <span className="font-display text-mockup-title font-semibold">{t('home.mock.reviewTitle')}</span>
      </div>
      <GlassCard className="rounded-card px-3 py-2.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-mockup-weight font-semibold">{t('home.mock.weightValue')}</span>
          <span className="text-meta text-muted-foreground">{t('home.mock.kg')}</span>
          <span className="ml-auto text-caption font-bold text-nutrition">{t('home.mock.trendDelta')}</span>
        </div>
        <svg width="190" height="48" viewBox="0 0 190 48" aria-hidden="true">
          <polyline
            points={TREND_POINTS.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="stroke-nutrition"
          />
          {TREND_POINTS.map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="2.6" className="fill-nutrition" />
          ))}
        </svg>
      </GlassCard>
      <GlassCard className="rounded-card px-3 py-2.5">
        <div className="flex gap-1.5">
          {PHOTO_TINTS.map((tint) => (
            <span key={tint} className={`h-[54px] grow rounded-tile ${tint}`} />
          ))}
        </div>
        <span className="block pt-2 text-caption text-muted-foreground">{t('home.mock.reviewQuote')}</span>
      </GlassCard>
      <div className="mt-auto flex gap-2">
        <span className="flex h-10 grow items-center rounded-full border border-muted-foreground/30 px-3.5 text-meta text-muted-foreground">
          {t('home.mock.replyPlaceholder')}
        </span>
        <span className="flex size-10 items-center justify-center rounded-full bg-marker text-on-dark">
          <IconArrowUp />
        </span>
      </div>
    </PhoneFrame>
  );
}
