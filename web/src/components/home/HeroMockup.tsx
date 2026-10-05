import { useTranslation } from 'react-i18next';
import { FloatCard, MacroBar, WindowFrame } from '@/components/home/MockupParts';
import { TodayPhone } from '@/components/home/HomePhones';
import { IconPulse } from '@/components/home/HomeIcons';

type FoodKey =
  | 'oatBowl'
  | 'yogurtBowl'
  | 'eggToast'
  | 'appleAlmonds'
  | 'proteinShake'
  | 'yogurtHoney'
  | 'lentilCurry'
  | 'tunaSalad'
  | 'chickenBowl'
  | 'salmonPotatoes'
  | 'beefStirFry'
  | 'tofuNoodles';

interface PlanCell {
  food: FoodKey;
  kcal: number;
  highlighted?: boolean;
}

const PLAN_ROWS: ReadonlyArray<{
  meal: 'breakfast' | 'snack' | 'lunch' | 'dinner';
  cells: PlanCell[];
}> = [
  {
    meal: 'breakfast',
    cells: [
      { food: 'oatBowl', kcal: 420 },
      { food: 'yogurtBowl', kcal: 380 },
      { food: 'oatBowl', kcal: 420 },
      { food: 'eggToast', kcal: 460 },
    ],
  },
  {
    meal: 'snack',
    cells: [
      { food: 'appleAlmonds', kcal: 210 },
      { food: 'proteinShake', kcal: 160 },
      { food: 'yogurtHoney', kcal: 160 },
      { food: 'appleAlmonds', kcal: 210 },
    ],
  },
  {
    meal: 'lunch',
    cells: [
      { food: 'lentilCurry', kcal: 560 },
      { food: 'tunaSalad', kcal: 590 },
      { food: 'lentilCurry', kcal: 560 },
      { food: 'chickenBowl', kcal: 640, highlighted: true },
    ],
  },
  {
    meal: 'dinner',
    cells: [
      { food: 'salmonPotatoes', kcal: 610 },
      { food: 'beefStirFry', kcal: 590 },
      { food: 'tofuNoodles', kcal: 540 },
      { food: 'beefStirFry', kcal: 590 },
    ],
  },
];

const DAYS = ['mon', 'tue', 'wed', 'thu'] as const;

/** Hero collage: weekly plan window, the client's phone, a push notification and a check-in toast. */
export default function HeroMockup() {
  const { t } = useTranslation();

  return (
    <div aria-hidden="true" className="h-[494px] w-[768px]">
      <div className="relative h-[560px] w-[872px] origin-top-left scale-[0.88]">
        <WindowFrame
          title={t('home.mock.planTitle')}
          subtitle={t('home.mock.planWeek')}
          className="absolute top-[54px] left-0 w-[560px]"
        >
          <div className="grid grid-cols-[70px_repeat(4,minmax(0,1fr))] gap-2 px-4 pt-3.5 pb-4">
            <span />
            {DAYS.map((day) => (
              <span key={day} className="text-center text-caption font-semibold text-muted-foreground">
                {t(`home.mock.days.${day}`)}
              </span>
            ))}
            {PLAN_ROWS.map((row) => (
              <PlanRow key={row.meal} meal={t(`home.mock.meals.${row.meal}`)} cells={row.cells} />
            ))}
          </div>
          <span className="absolute top-[11px] right-4 rounded-sm bg-nutrition-soft px-2 py-[3px] text-[10px] font-bold tracking-[0.06em] text-nutrition-ink">
            {t('home.mock.published')}
          </span>
        </WindowFrame>

        <div className="absolute top-0 left-[600px]">
          <TodayPhone size="hero" />
        </div>

        <svg
          width="872"
          height="600"
          className="pointer-events-none absolute top-0 left-0"
          aria-hidden="true"
        >
          <path
            d="M552 316C580 316 588 300 618 300"
            fill="none"
            strokeWidth="2"
            strokeDasharray="4 4"
            className="stroke-marker"
          />
          <circle cx="552" cy="316" r="4" className="fill-marker" />
        </svg>

        <div className="absolute top-[52px] left-[612px] flex w-[246px] items-start gap-2.5 rounded-2xl bg-notif px-3 py-2.5 text-on-dark shadow-popover">
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] border border-on-dark/20 bg-scrim font-display text-[9px] font-semibold text-marker">
            {t('home.mock.notifBadge')}
          </span>
          <span className="flex flex-col gap-0.5 text-caption leading-[1.35]">
            <span className="flex font-bold">
              {t('home.mock.notifApp')}
              <span className="ml-auto font-normal opacity-60">{t('home.mock.notifNow')}</span>
            </span>
            <span>{t('home.mock.notifBody')}</span>
          </span>
        </div>

        <FloatCard className="absolute top-[470px] left-6 flex w-[330px] items-center gap-3 px-3.5 py-3">
          <span className="flex size-[34px] items-center justify-center rounded-full bg-marker text-on-dark">
            <IconPulse size={17} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-bold text-ink">{t('home.mock.checkinSent')}</span>
            <span className="text-caption text-muted-foreground">{t('home.mock.checkinSummary')}</span>
          </span>
          <span className="ml-auto flex gap-1">
            <span className="h-[34px] w-[26px] rounded-sm bg-photo-sand" />
            <span className="h-[34px] w-[26px] rounded-sm bg-photo-tan" />
            <span className="h-[34px] w-[26px] rounded-sm bg-photo-clay" />
          </span>
        </FloatCard>
      </div>
    </div>
  );
}

function PlanRow({ meal, cells }: { meal: string; cells: PlanCell[] }) {
  const { t } = useTranslation();

  return (
    <>
      <span className="self-center text-caption font-semibold text-muted-foreground">{meal}</span>
      {cells.map((cell, index) => (
        <div
          key={`${cell.food}-${index}`}
          className={`box-border flex h-16 flex-col gap-[3px] rounded-field bg-surface p-2 ${
            cell.highlighted
              ? 'border-2 border-marker shadow-popover'
              : 'border border-border'
          }`}
        >
          <span className="truncate text-caption font-semibold text-ink">
            {t(`home.mock.foods.${cell.food}`)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {cell.kcal} {t('home.mock.kcal')}
          </span>
          <span className="mt-auto">
            <MacroBar />
          </span>
        </div>
      ))}
    </>
  );
}
