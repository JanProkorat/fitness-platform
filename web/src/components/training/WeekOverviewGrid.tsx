import { useTranslation } from 'react-i18next';
import type { MuscleGroup } from '@/api/exercise-types';
import { cn } from '@/lib/cn';
import {
  DAY_KEYS,
  MUSCLE_COLORS,
  MUSCLE_BG_COLORS,
  FORMAT_LABEL_KEYS,
  FORMAT_BG_COLORS,
  FORMAT_COLORS,
} from '@/constants/training';
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
      // `max-h-[calc(100vh-200px)]` + `overflow-y-auto` so a tall week
      // (lots of sessions per day) is internally scrollable instead of
      // spilling below the viewport with no way to reach the bottom.
      // The 200px subtracts the top app chrome (header + plan tabs +
      // week tabs row) so the dropdown is bounded by the visible
      // browser height it actually has access to.
      className="absolute left-0 right-0 top-full z-50 border-b border-border bg-bg max-h-[calc(100vh-200px)] overflow-y-auto"
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
                  const sections = [...session.sections].sort((a, b) => a.order - b.order);
                  return (
                    <div
                      key={session.sessionId}
                      className={cn(
                        'rounded-md border bg-bg p-2',
                        isSelected ? 'border-border-md' : 'border-border',
                      )}
                    >
                      <div className="text-[12px] font-semibold text-text truncate">
                        {session.name || t('training.untitledSession')}
                      </div>
                      {sections.length === 0 ? (
                        <div className="text-[10px] text-text4 mt-1">
                          {t('training.noWorkoutsHint')}
                        </div>
                      ) : (
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          {sections.map((section) => {
                            const fmt = section.format;
                            const sectionMuscles = new Set<string>();
                            for (const ex of section.exercises) {
                              const groups = exerciseDetailsMap?.get(ex.exerciseExternalId) ?? [];
                              for (const g of groups) sectionMuscles.add(g);
                            }
                            return (
                              <div
                                key={section.sectionId}
                                className="rounded-sm bg-bg2 px-1.5 py-1"
                              >
                                {/* Row 1: format chip + name (takes full remaining width) */}
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="inline-flex items-center rounded-full px-1.5 py-[1px] text-[9px] font-semibold whitespace-nowrap shrink-0"
                                    style={{
                                      background: FORMAT_BG_COLORS[fmt],
                                      color: FORMAT_COLORS[fmt],
                                    }}
                                  >
                                    {t(`training.format.${FORMAT_LABEL_KEYS[fmt]}`)}
                                  </span>
                                  <span className="flex-1 min-w-0 text-[11px] font-medium text-text truncate">
                                    {section.name || t('training.untitledWorkout')}
                                  </span>
                                </div>
                                {/* Row 2: muscle chips */}
                                {sectionMuscles.size > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {[...sectionMuscles].map((g) => (
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
                                {/* Row 3: exercise count, dimmed */}
                                <div className="text-[10px] text-text3 tabular-nums mt-0.5">
                                  {section.exercises.length} {t('training.exercisesCount')}
                                </div>
                              </div>
                            );
                          })}
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
