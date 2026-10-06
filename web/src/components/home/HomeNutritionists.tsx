// Pixel sizes and positions in this file are illustration drawing copied from the board, not layout tokens.
import { useTranslation } from 'react-i18next';
import { Eyebrow, FeatureItem, FloatCard, MacroBar, WindowFrame } from '@/components/home/MockupParts';
import { IconCalendar, IconCheck, IconPeople, IconSliders } from '@/components/home/HomeIcons';

type Verdict = 'ok' | 'over' | 'under';

interface DayTotal {
  kcal: number;
  fill: string;
  tone: 'normal' | 'warn';
}

const DAY_TOTALS: DayTotal[] = [
  { kcal: 2070, fill: 'w-[99%]', tone: 'normal' },
  { kcal: 2290, fill: 'w-full', tone: 'normal' },
  { kcal: 1790, fill: 'w-[85%]', tone: 'warn' },
  { kcal: 2320, fill: 'w-full', tone: 'warn' },
];

const MEAL_ROWS: ReadonlyArray<{
  meal: 'breakfast' | 'lunch' | 'dinner';
  cells: ReadonlyArray<{ kcal: number; verdict: Verdict; delta?: string }>;
}> = [
  {
    meal: 'breakfast',
    cells: [
      { kcal: 420, verdict: 'ok' },
      { kcal: 480, verdict: 'ok' },
      { kcal: 420, verdict: 'ok' },
      { kcal: 690, verdict: 'over', delta: '+22 %' },
    ],
  },
  {
    meal: 'lunch',
    cells: [
      { kcal: 640, verdict: 'ok' },
      { kcal: 590, verdict: 'ok' },
      { kcal: 430, verdict: 'under', delta: '−18 %' },
      { kcal: 640, verdict: 'ok' },
    ],
  },
  {
    meal: 'dinner',
    cells: [
      { kcal: 610, verdict: 'ok' },
      { kcal: 820, verdict: 'over', delta: '+22 %' },
      { kcal: 540, verdict: 'ok' },
      { kcal: 590, verdict: 'ok' },
    ],
  },
];

const VERDICT_STYLE: Record<Verdict, { cell: string; label: string }> = {
  ok: { cell: 'bg-nutrition-soft', label: 'text-nutrition-ink' },
  over: { cell: 'bg-training-soft', label: 'text-training' },
  under: { cell: 'bg-surface', label: 'text-muted-foreground' },
};

const DAYS = ['mon', 'tue', 'wed', 'thu'] as const;

const SHOPPING = [
  { item: 'chickenBreast', amount: '900 g', done: true },
  { item: 'basmatiRice', amount: '500 g', done: true },
  { item: 'greekYogurt', amount: '1.2 kg', done: false },
  { item: 'blueberries', amount: '400 g', done: false },
] as const;

const LEGEND = [
  { dot: 'bg-nutrition', label: '2,100 kcal' },
  { dot: 'bg-macro-protein', label: 'P 150' },
  { dot: 'bg-macro-carbs', label: 'C 220' },
  { dot: 'bg-macro-fat', label: 'F 70' },
  { dot: 'bg-macro-fibre', label: 'Fib 30' },
] as const;

function NutritionMockup() {
  const { t, i18n } = useTranslation();

  return (
    <div aria-hidden="true" className="relative w-[640px] max-w-full">
      <WindowFrame title={t('home.mock.planTitle')} subtitle={t('home.mock.nutritionView')}>
        <div className="grid grid-cols-[70px_repeat(4,minmax(0,1fr))] gap-2 px-4 pt-3.5 pb-4">
          <span />
          {DAYS.map((day) => (
            <span key={day} className="text-center text-caption font-semibold text-muted-foreground">
              {t(`home.mock.days.${day}`)}
            </span>
          ))}
          <span className="self-center text-caption font-semibold text-muted-foreground">
            {t('home.mock.day')}
          </span>
          {DAY_TOTALS.map((day) => (
            <div
              key={day.kcal}
              className="flex flex-col gap-1 rounded-tile border border-border bg-surface px-2 py-1.75"
            >
              <span
                className={`text-meta font-bold ${day.tone === 'warn' ? 'text-training' : 'text-ink'}`}
              >
                {day.kcal.toLocaleString(i18n.language)} {t('home.mock.kcal')}
              </span>
              <div className="h-1 rounded-xs bg-border">
                <div
                  className={`h-1 rounded-xs ${day.fill} ${day.tone === 'warn' ? 'bg-training' : 'bg-nutrition'}`}
                />
              </div>
            </div>
          ))}
          {MEAL_ROWS.map((row) => (
            <MealRow key={row.meal} meal={t(`home.mock.meals.${row.meal}`)} cells={row.cells} />
          ))}
        </div>
      </WindowFrame>

      <FloatCard className="absolute top-[calc(100%-34px)] -left-9 flex w-[250px] flex-col px-3.5 py-3">
        <span className="pb-1.5 text-body font-bold text-ink">{t('home.mock.shoppingList')}</span>
        {SHOPPING.map((entry) => (
          <div key={entry.item} className="flex items-center gap-2.25 border-t border-border py-1.5">
            {entry.done ? (
              <span className="flex size-4 items-center justify-center rounded-xs bg-nutrition text-on-nutrition">
                <IconCheck size={10} strokeWidth={2.8} />
              </span>
            ) : (
              <span className="size-3.5 rounded-xs border-[1.5px] border-muted-foreground" />
            )}
            <span
              className={`text-meta ${entry.done ? 'text-muted-foreground line-through' : 'text-ink'}`}
            >
              {t(`home.mock.shopping.${entry.item}`)}
            </span>
            <span className="ml-auto text-caption text-muted-foreground">{entry.amount}</span>
          </div>
        ))}
      </FloatCard>

      <div className="absolute -top-[26px] -right-5 hidden gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-2 text-caption font-semibold text-ink shadow-popover @min-[760px]:flex">
        {LEGEND.map((entry) => (
          <span key={entry.label} className="inline-flex items-center gap-1.25">
            <span className={`size-[7px] rounded-full ${entry.dot}`} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MealRow({
  meal,
  cells,
}: {
  meal: string;
  cells: ReadonlyArray<{ kcal: number; verdict: Verdict; delta?: string }>;
}) {
  const { t } = useTranslation();

  return (
    <>
      <span className="self-center text-caption font-semibold text-muted-foreground">{meal}</span>
      {cells.map((cell, index) => (
        <div
          key={index}
          className={`box-border flex h-[66px] flex-col gap-0.5 rounded-field border border-border p-2 ${VERDICT_STYLE[cell.verdict].cell}`}
        >
          <span className="flex items-baseline gap-0.75">
            <span className="text-mockup-figure font-semibold text-ink">{cell.kcal}</span>
            <span className="text-mockup-xs text-muted-foreground">{t('home.mock.kcal')}</span>
          </span>
          <span className={`text-mockup-xs font-bold ${VERDICT_STYLE[cell.verdict].label}`}>
            {cell.delta ?? t('home.mock.onTarget')}
          </span>
          <span className="mt-auto">
            <MacroBar />
          </span>
        </div>
      ))}
    </>
  );
}

/** "For nutritionists": meal-plan pitch with a nutrition-view mockup and shopping list. */
export default function HomeNutritionists() {
  const { t } = useTranslation();

  return (
    <section
      id="for-nutritionists"
      className="@container flex scroll-mt-6 flex-col bg-surface px-4 pt-14 pb-24 sm:px-10 panel:col-start-1 panel:px-16 panel:pt-24 panel:pb-48"
    >
      <div className="flex flex-col gap-12 @min-[1200px]:flex-row-reverse @min-[1200px]:items-center @min-[1200px]:gap-16">
        <div className="flex max-w-[420px] shrink-0 flex-col gap-4.5">
          <Eyebrow className="text-nutrition">{t('home.nutritionists.eyebrow')}</Eyebrow>
          <h2 className="font-display text-home-heading font-semibold tracking-heading text-ink">
            {t('home.nutritionists.title')}
          </h2>
          <p className="text-home-lead text-ink-2">{t('home.nutritionists.lead')}</p>
          <div className="flex flex-col gap-4 pt-1.5">
            <FeatureItem
              icon={<IconCalendar />}
              tone="bg-nutrition-soft text-nutrition-ink"
              title={t('home.nutritionists.features.plans.title')}
              description={t('home.nutritionists.features.plans.desc')}
            />
            <FeatureItem
              icon={<IconSliders />}
              tone="bg-nutrition-soft text-nutrition-ink"
              title={t('home.nutritionists.features.macros.title')}
              description={t('home.nutritionists.features.macros.desc')}
            />
            <FeatureItem
              icon={<IconPeople />}
              tone="bg-nutrition-soft text-nutrition-ink"
              title={t('home.nutritionists.features.alongside.title')}
              description={t('home.nutritionists.features.alongside.desc')}
            />
          </div>
        </div>
        <div className="hidden min-w-0 grow justify-center pb-10 @min-[640px]:flex">
          <NutritionMockup />
        </div>
      </div>
    </section>
  );
}
