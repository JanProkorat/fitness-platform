import { useTranslation } from 'react-i18next';
import type { MuscleGroup } from '@/api/exercise-types';
import { cn } from '@/lib/cn';
import { DAY_KEYS, MUSCLE_COLORS, MUSCLE_BG_COLORS } from '@/constants/training';
import type { TrainingWeek } from '@/api/training-plan-types';

interface WeekOverviewGridProps {
  weekViewExpanded: boolean;
  currentWeek: TrainingWeek | undefined;
  selectedDay: number;
  exerciseDetailsMap: Map<string, MuscleGroup[]> | undefined;
}

export function WeekOverviewGrid({
  weekViewExpanded,
  currentWeek,
  selectedDay,
  exerciseDetailsMap,
}: WeekOverviewGridProps) {
  const { t } = useTranslation();

  if (!weekViewExpanded) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 border-b border-border bg-bg"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
    >
      <div className="grid grid-cols-7 gap-0">
        {DAY_KEYS.map((_key, idx) => {
          const dayOfWeek = idx + 1;
          const sessionsArray = currentWeek?.sessions ?? [];
          const sessions = sessionsArray
            .filter((s) => s.dayOfWeek === dayOfWeek)
            .sort((a, b) => a.order - b.order);
          const isSelected = dayOfWeek === selectedDay;

          return (
            <div
              key={dayOfWeek}
              className={cn(
                'flex flex-col border-r border-border last:border-r-0',
                isSelected && 'bg-accent-bg',
              )}
            >
              {/* Session cards */}
              <div className="p-1.5 flex flex-col gap-1.5" style={{ minHeight: 60 }}>
                {sessions.length === 0 && (
                  <div className="text-[10px] text-text4 text-center py-3">
                    {t('training.restDay')}
                  </div>
                )}
                {sessions.map((session) => {
                  const sessionMuscles = new Set<string>();
                  for (const ex of session.exercises) {
                    const groups = exerciseDetailsMap?.get(ex.exerciseExternalId) ?? [];
                    for (const g of groups) sessionMuscles.add(g);
                  }

                  return (
                    <div
                      key={session.sessionId}
                      className={cn(
                        'rounded-md border bg-bg p-2',
                        isSelected ? 'border-border-md' : 'border-border',
                      )}
                    >
                      <div className="text-[12px] font-semibold text-text truncate">
                        {session.name}
                      </div>
                      <div className="text-[10px] text-text3 mt-0.5">
                        {session.exercises.length} {t('training.exercisesCount')}
                      </div>
                      {sessionMuscles.size > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {[...sessionMuscles].map((g) => (
                            <span
                              key={g}
                              className="text-[9px] font-medium rounded-sm px-1 py-[1px]"
                              style={{
                                background: MUSCLE_BG_COLORS[g] ?? 'var(--accent-bg)',
                                color: MUSCLE_COLORS[g] ?? 'var(--accent)',
                              }}
                            >
                              {t(`training.muscle${g}`)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
