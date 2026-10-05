import { useTranslation } from 'react-i18next';
import { Eyebrow, FeatureItem, FloatCard, WindowFrame } from '@/components/home/MockupParts';
import {
  IconCopy,
  IconDumbbell,
  IconGrip,
  IconPlay,
  IconPulse,
  IconSearch,
  IconCheck,
} from '@/components/home/HomeIcons';

const LIBRARY = [
  { exercise: 'benchPress', muscle: 'chest', tint: 'bg-photo-tan' },
  { exercise: 'barbellRow', muscle: 'back', tint: 'bg-photo-mist' },
  { exercise: 'facePull', muscle: 'shoulders', tint: 'bg-photo-rose' },
  { exercise: 'pullUp', muscle: 'back', tint: 'bg-photo-sage' },
] as const;

interface BlockRow {
  exercise: 'benchPress' | 'barbellRow' | 'overheadPress' | 'pullUp';
  sets: string;
  load: { kind: 'kg'; value: number } | { kind: 'body' };
  rest: { kind: 'min' | 's'; value: number };
}

const BLOCK_ROWS: BlockRow[] = [
  { exercise: 'benchPress', sets: '4 × 8', load: { kind: 'kg', value: 60 }, rest: { kind: 'min', value: 2 } },
  { exercise: 'barbellRow', sets: '4 × 10', load: { kind: 'kg', value: 50 }, rest: { kind: 's', value: 90 } },
  { exercise: 'overheadPress', sets: '3 × 8', load: { kind: 'kg', value: 35 }, rest: { kind: 's', value: 90 } },
  { exercise: 'pullUp', sets: '3 × max', load: { kind: 'body' }, rest: { kind: 'min', value: 2 } },
];

const ROW_GRID =
  'grid grid-cols-[18px_minmax(0,1fr)_64px_56px_48px] items-center gap-2.5 rounded-field border border-border bg-surface px-3 py-2.5';

function SessionRow({ row }: { row: BlockRow }) {
  const { t } = useTranslation();

  return (
    <div className={ROW_GRID}>
      <span className="text-muted-foreground">
        <IconGrip />
      </span>
      <span className="truncate text-body font-semibold text-ink">
        {t(`home.mock.exercises.${row.exercise}`)}
      </span>
      <span className="text-meta font-semibold text-ink">{row.sets}</span>
      <span className="text-meta text-ink-2">
        {row.load.kind === 'kg' ? `${row.load.value} kg` : t('home.mock.bodyweight')}
      </span>
      <span className="text-caption text-muted-foreground">
        {t(`home.mock.rest.${row.rest.kind}`, { value: row.rest.value })}
      </span>
    </div>
  );
}

function SessionMockup() {
  const { t } = useTranslation();

  return (
    <div aria-hidden="true" className="relative w-[700px] max-w-full">
      <WindowFrame title={t('home.mock.workoutName')} subtitle={t('home.mock.sessionKind')}>
        <div className="relative flex gap-3.5 p-3.5">
          <div className="flex w-[200px] shrink-0 flex-col gap-2">
            <span className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-meta text-muted-foreground">
              <IconSearch />
              {t('home.mock.exerciseLibrary')}
            </span>
            {LIBRARY.map((item) => (
              <div
                key={item.exercise}
                className="flex items-center gap-2.5 rounded-field border border-border bg-surface p-2"
              >
                <span
                  className={`flex h-8 w-10 items-center justify-center rounded-[7px] text-on-dark ${item.tint}`}
                >
                  <IconPlay size={12} />
                </span>
                <span className="flex flex-col">
                  <span className="text-meta font-semibold text-ink">
                    {t(`home.mock.exercises.${item.exercise}`)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t(`home.mock.muscles.${item.muscle}`)}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex min-w-0 grow flex-col gap-2">
            <span className="text-caption font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              {t('home.mock.blockA')}
            </span>
            <SessionRow row={BLOCK_ROWS[0]} />
            <SessionRow row={BLOCK_ROWS[1]} />
            <div className="-my-[3px] h-0.5 rounded-xs bg-marker" />
            <SessionRow row={BLOCK_ROWS[2]} />
            <SessionRow row={BLOCK_ROWS[3]} />
          </div>
          <div className="absolute top-32 left-[330px] flex w-[190px] -rotate-3 items-center gap-2.5 rounded-field border border-border bg-surface p-2 shadow-card">
            <span className="h-8 w-10 rounded-[7px] bg-photo-rose" />
            <span className="flex flex-col">
              <span className="text-meta font-bold text-ink">{t('home.mock.exercises.facePull')}</span>
              <span className="text-[10px] text-muted-foreground">3 × 15</span>
            </span>
          </div>
        </div>
      </WindowFrame>
      <FloatCard className="absolute right-0 -bottom-8.5 flex w-[290px] flex-col gap-1.5 px-3.5 py-3 @min-[820px]:-right-6">
        <span className="flex items-center gap-1.5 text-caption font-bold tracking-[0.08em] text-marker uppercase">
          <span className="size-[7px] rounded-full bg-marker" />
          {t('home.mock.liveTitle')}
        </span>
        <span className="text-body font-semibold text-ink">{t('home.mock.liveSet')}</span>
        <span className="flex items-center gap-2 text-meta text-muted-foreground">
          {t('home.mock.liveReps')}
          <span className="ml-auto flex size-[22px] items-center justify-center rounded-full bg-training text-on-training">
            <IconCheck />
          </span>
        </span>
      </FloatCard>
    </div>
  );
}

/** "For coaches": training-plan builder pitch with a session-template mockup. */
export default function HomeCoaches() {
  const { t } = useTranslation();

  return (
    <section
      id="for-coaches"
      className="@container flex scroll-mt-6 flex-col gap-12 px-4 py-14 sm:px-10 panel:col-start-1 panel:px-16 panel:py-24"
    >
      <div className="flex flex-col gap-12 @min-[1200px]:flex-row @min-[1200px]:items-center @min-[1200px]:gap-16">
        <div className="flex max-w-[420px] shrink-0 flex-col gap-4.5">
          <Eyebrow className="text-training">{t('home.coaches.eyebrow')}</Eyebrow>
          <h2 className="font-display text-[38px] leading-[1.1] font-semibold tracking-[-0.015em] text-ink">
            {t('home.coaches.title')}
          </h2>
          <p className="text-[16px] leading-[1.6] text-ink-2">{t('home.coaches.lead')}</p>
          <div className="flex flex-col gap-4 pt-1.5">
            <FeatureItem
              icon={<IconDumbbell />}
              tone="bg-training-soft text-training"
              title={t('home.coaches.features.sessions.title')}
              description={t('home.coaches.features.sessions.desc')}
            />
            <FeatureItem
              icon={<IconCopy />}
              tone="bg-training-soft text-training"
              title={t('home.coaches.features.templates.title')}
              description={t('home.coaches.features.templates.desc')}
            />
            <FeatureItem
              icon={<IconPulse />}
              tone="bg-error-soft text-marker"
              title={t('home.coaches.features.watch.title')}
              description={t('home.coaches.features.watch.desc')}
            />
          </div>
        </div>
        <div className="hidden min-w-0 grow justify-center pb-8 @min-[640px]:flex">
          <SessionMockup />
        </div>
      </div>
    </section>
  );
}
