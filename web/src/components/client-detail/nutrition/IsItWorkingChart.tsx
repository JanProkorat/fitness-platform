import { useTranslation } from 'react-i18next';
import { PROGRESS_WEEK_COUNT, type ProgressModel } from '@/components/client-detail/nutrition/nutritionProgress';

const CHART_WIDTH = 400;
const CHART_HEIGHT = 176;
const X_MIN = 8;
const X_MAX = 392;
const WEIGHT_TOP = 26;
const WEIGHT_BOTTOM = 104;
const BAR_BASE = 146;
const BAR_MAX_HEIGHT = 52;
const BAR_MIN_HEIGHT = 4;
const BAR_FLOOR_RATIO = 0.75;
const WEIGHT_PADDING_KG = 0.5;
const MARKER_TOP = 14;

const SLOT_WIDTH = (X_MAX - X_MIN) / PROGRESS_WEEK_COUNT;
const BAR_WIDTH = SLOT_WIDTH * 0.46;

interface Props {
  model: ProgressModel;
  ariaLabel: string;
}

function slotCenter(index: number): number {
  return X_MIN + SLOT_WIDTH * (index + 0.5);
}

const xPct = (x: number) => `${(x / CHART_WIDTH) * 100}%`;
const yPct = (y: number) => `${(y / CHART_HEIGHT) * 100}%`;

/**
 * Combo chart: weekly weigh-in line over planned-kcal bars, with a dashed marker where the plan changes.
 * Shapes live in a stretched SVG; text and dots are HTML so they keep a constant size at any width.
 */
export default function IsItWorkingChart({ model, ariaLabel }: Props) {
  const { t } = useTranslation();

  const weightPoints = model.weeks
    .map((week, index) => ({ index, weightKg: week.weightKg }))
    .filter((point): point is { index: number; weightKg: number } => point.weightKg !== undefined);
  const weights = weightPoints.map((point) => point.weightKg);
  const weightMin = Math.min(...weights) - WEIGHT_PADDING_KG;
  const weightMax = Math.max(...weights) + WEIGHT_PADDING_KG;
  const weightY = (value: number) =>
    WEIGHT_TOP + ((weightMax - value) / (weightMax - weightMin)) * (WEIGHT_BOTTOM - WEIGHT_TOP);
  const polyline = weightPoints.map((point) => `${slotCenter(point.index)},${weightY(point.weightKg)}`).join(' ');

  const kcalValues = model.weeks
    .map((week) => week.plannedKcal)
    .filter((value): value is number => value !== undefined);
  const kcalMax = Math.max(...kcalValues);
  const kcalFloor = Math.min(...kcalValues) * BAR_FLOOR_RATIO;
  const barHeight = (value: number) =>
    kcalMax === kcalFloor
      ? BAR_MAX_HEIGHT
      : BAR_MIN_HEIGHT + ((value - kcalFloor) / (kcalMax - kcalFloor)) * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);

  return (
    <div role="img" aria-label={ariaLabel} className="relative h-44 w-full">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
      >
        {model.weeks.map((week, index) =>
          week.plannedKcal !== undefined ? (
            <rect
              key={`bar-${week.number}`}
              data-testid="progress-bar"
              x={slotCenter(index) - BAR_WIDTH / 2}
              y={BAR_BASE - barHeight(week.plannedKcal)}
              width={BAR_WIDTH}
              height={barHeight(week.plannedKcal)}
              className="fill-nutrition-soft"
            />
          ) : null,
        )}

        {model.planChanges.map((index) => {
          const x = X_MIN + SLOT_WIDTH * index;
          return (
            <line
              key={`change-${index}`}
              data-testid="progress-plan-change"
              x1={x}
              x2={x}
              y1={MARKER_TOP}
              y2={BAR_BASE}
              className="stroke-error"
              strokeWidth={1.2}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {weightPoints.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            className="stroke-ink"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {model.planChanges.map((index) => {
        const x = X_MIN + SLOT_WIDTH * index;
        const anchorEnd = index >= PROGRESS_WEEK_COUNT - 2;
        return (
          <span
            key={`change-label-${index}`}
            className={`absolute top-0 whitespace-nowrap text-caption font-semibold text-error ${
              anchorEnd ? '-translate-x-full pr-1' : 'pl-1'
            }`}
            style={{ left: xPct(x) }}
          >
            {t('clientDetail.nutrition.isItWorking.newPlan')}
          </span>
        );
      })}

      {weightPoints.map((point) => (
        <span
          key={`point-${point.index}`}
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-card"
          style={{ left: xPct(slotCenter(point.index)), top: yPct(weightY(point.weightKg)) }}
        />
      ))}

      {model.weeks.map((week, index) => (
        <span
          key={`label-${week.number}`}
          className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-caption text-muted-foreground"
          style={{ left: xPct(slotCenter(index)) }}
        >
          {t('clientDetail.nutrition.isItWorking.weekLabel', { n: week.number })}
        </span>
      ))}
    </div>
  );
}
