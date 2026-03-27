import { DragOverlay, useDragOperation } from '@dnd-kit/react';
import { useTranslation } from 'react-i18next';
import type { DragData } from './dnd-types';
import { useTrainingPlanStore } from '@/stores/trainingPlan';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/// Floating overlay that follows the pointer during drag, surviving DOM re-renders
/// (e.g. when the displayed week switches mid-drag).
export default function TrainingDragOverlay() {
  const { t } = useTranslation();
  const { source } = useDragOperation();
  const plan = useTrainingPlanStore((s) => s.plan);

  if (!source) return null;

  const data = source.data as DragData | undefined;
  if (!data) return null;

  return (
    <DragOverlay dropAnimation={null}>
      {data.type === 'exercise' && (
        <div className="rounded-sm border border-accent-br bg-bg p-2 shadow-lg shadow-black/40 max-w-[300px]">
          <span className="text-[11px] font-semibold text-text2">{data.exercise.exerciseName}</span>
          <span className="ml-2 text-[9px] text-text3">{data.exercise.sets.length}s</span>
        </div>
      )}

      {data.type === 'session' && (
        <SessionOverlay sessionId={data.sessionId} weekNumber={data.weekNumber} plan={plan} t={t} />
      )}

      {data.type === 'day' && (
        <div className="rounded-sm border border-accent-br bg-bg2 px-3 py-2 shadow-lg shadow-black/40">
          <span className="text-xs font-bold uppercase tracking-wide text-accent">
            {t(`nutrition.${DAY_KEYS[data.dayOfWeek - 1]}`)}
          </span>
        </div>
      )}
    </DragOverlay>
  );
}

/// Renders a compact preview of a session being dragged.
function SessionOverlay({
  sessionId,
  weekNumber,
  plan,
  t,
}: {
  sessionId: string;
  weekNumber: number;
  plan: ReturnType<typeof useTrainingPlanStore.getState>['plan'];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const week = plan?.weeks.find((w) => w.weekNumber === weekNumber);
  const session = week?.sessions.find((s) => s.sessionId === sessionId);

  return (
    <div className="rounded-sm border border-accent-br bg-bg2 shadow-lg shadow-black/40 max-w-[300px]">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm font-semibold text-text truncate">
          {session?.name ?? 'Session'}
        </span>
        <span className="text-[9px] text-text3">
          {session?.exercises.length ?? 0} {t('training.exercisesCount')}
        </span>
      </div>
    </div>
  );
}
