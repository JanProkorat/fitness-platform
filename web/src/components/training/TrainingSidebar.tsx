import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getExercise } from '@/api/exercises';
import type { MuscleGroup } from '@/api/exercise-types';
import type { TrainingSession } from '@/api/training-plan-types';
import { cn } from '@/lib/cn';
import {
  estimatedSectionDurationSeconds,
  formatDurationCompact,
} from '@/lib/training-plan-format';

export interface TrainingSidebarProps {
  sessions: TrainingSession[];
}

const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  Chest: 'bg-blue',
  Back: 'bg-green',
  Shoulders: 'bg-orange',
  Biceps: 'bg-purple',
  Triceps: 'bg-purple',
  Forearms: 'bg-purple',
  Quadriceps: 'bg-blue',
  Hamstrings: 'bg-blue',
  Glutes: 'bg-green',
  Calves: 'bg-green',
  Abs: 'bg-orange',
  Obliques: 'bg-orange',
  LowerBack: 'bg-orange',
  Traps: 'bg-green',
  FullBody: 'bg-accent',
};

const MUSCLE_GROUP_KEYS: Record<MuscleGroup, string> = {
  Chest: 'training.muscleChest',
  Back: 'training.muscleBack',
  Shoulders: 'training.muscleShoulders',
  Biceps: 'training.muscleBiceps',
  Triceps: 'training.muscleTriceps',
  Forearms: 'training.muscleForearms',
  Quadriceps: 'training.muscleQuadriceps',
  Hamstrings: 'training.muscleHamstrings',
  Glutes: 'training.muscleGlutes',
  Calves: 'training.muscleCalves',
  Abs: 'training.muscleAbs',
  Obliques: 'training.muscleObliques',
  LowerBack: 'training.muscleLowerBack',
  Traps: 'training.muscleTraps',
  FullBody: 'training.muscleFullBody',
};

export function TrainingSidebar({ sessions }: TrainingSidebarProps) {
  const { t, i18n } = useTranslation();

  // Collect all workouts and exercises across every session on the day so
  // we can summarise the day rather than just one session. `allExercises`
  // is the backend-computed union of a session's standalone exercises plus
  // every workout's nested exercises — using it directly (rather than
  // re-flattening `workouts` by hand) also picks up standalone exercises
  // that live outside any workout block.
  const allWorkouts = useMemo(
    () => sessions.flatMap((s) => s.workouts ?? []),
    [sessions],
  );
  const allExercises = useMemo(
    () => sessions.flatMap((s) => s.allExercises ?? []),
    [sessions],
  );

  // Day-level stats — sessions / workouts / exercises / sets / volume /
  // estimated timed duration. Volume only counts loaded sets (reps × kg);
  // estimated duration only counts non-Standard workouts whose format
  // config carries a meaningful time prescription.
  const stats = useMemo(() => {
    let totalSets = 0;
    let totalVolume = 0;
    for (const ex of allExercises) {
      for (const s of ex.sets) {
        totalSets++;
        if (s.reps && s.weightKg) {
          totalVolume += s.reps * s.weightKg;
        }
      }
    }
    let totalDurationSeconds = 0;
    for (const sec of allWorkouts) {
      const d = estimatedSectionDurationSeconds(sec.format, sec.formatConfig);
      if (d != null) totalDurationSeconds += d;
    }
    return {
      sessionCount: sessions.length,
      workoutCount: allWorkouts.length,
      exerciseCount: allExercises.length,
      totalSets,
      totalVolume,
      totalDurationSeconds,
    };
  }, [sessions, allWorkouts, allExercises]);

  // Fetch muscle groups for unique exercise IDs
  const uniqueExerciseIds = useMemo(
    () => [...new Set(allExercises.map((e) => e.exerciseExternalId))],
    [allExercises],
  );

  const { data: exerciseDetails } = useQuery({
    queryKey: ['exercise-details-sidebar', uniqueExerciseIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        uniqueExerciseIds.map((id) => getExercise(id)),
      );
      const map = new Map<string, MuscleGroup[]>();
      for (const r of results) {
        if (r.status === 'fulfilled') {
          map.set(r.value.exerciseId, r.value.muscleGroups);
        }
      }
      return map;
    },
    enabled: uniqueExerciseIds.length > 0,
    staleTime: 5 * 60_000,
  });

  // Muscle group breakdown: count sets per muscle group
  const muscleBreakdown = useMemo(() => {
    if (!exerciseDetails) return [];
    const counts = new Map<MuscleGroup, number>();
    for (const ex of allExercises) {
      const groups = exerciseDetails.get(ex.exerciseExternalId) ?? [];
      const setCount = ex.sets.length;
      for (const g of groups) {
        counts.set(g, (counts.get(g) ?? 0) + setCount);
      }
    }
    // Sort by set count descending
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([group, sets]) => ({ group, sets }));
  }, [allExercises, exerciseDetails]);

  const maxSets = muscleBreakdown.length > 0
    ? Math.max(...muscleBreakdown.map((m) => m.sets))
    : 1;

  return (
    <div>
      {/* Day overview — aggregated sessions / workouts / exercises / sets
          and (when defined) loaded volume + timed duration. Replaces the
          old single-session "training volume" card that didn't account for
          the new session+workout hierarchy. */}
      <div className="p-3 border-b border-border">
        <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
          {t('training.sidebarDayOverview')}
        </div>
        <div className="text-[22px] font-bold text-text tracking-tight leading-none mb-1">
          {stats.sessionCount}
        </div>
        <div className="text-xs text-text3 mb-2.5">
          {t('training.sidebarSessionsTotal')}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-text3">{t('training.sidebarWorkoutsLabel')}</span>
            <span className="text-text tabular-nums font-medium">{stats.workoutCount}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text3">{t('training.sidebarExercises')}</span>
            <span className="text-text tabular-nums font-medium">{stats.exerciseCount}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text3">{t('training.sidebarSetsLabel')}</span>
            <span className="text-text tabular-nums font-medium">{stats.totalSets}</span>
          </div>
          {stats.totalVolume > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-text3">{t('training.sidebarVolumeStat')}</span>
              <span className="text-text tabular-nums font-medium">
                {stats.totalVolume.toLocaleString(i18n.language)} kg
              </span>
            </div>
          )}
          {stats.totalDurationSeconds > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-text3">{t('training.sidebarEstDuration')}</span>
              <span className="text-text tabular-nums font-medium">
                {formatDurationCompact(stats.totalDurationSeconds)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Muscle group breakdown */}
      <div className="p-3 border-b border-border">
        <div className="text-[11px] font-semibold text-text3 uppercase tracking-[0.04em] mb-2">
          {t('training.sidebarMuscleGroups')}
        </div>
        {muscleBreakdown.length === 0 ? (
          <div className="text-xs text-text4 py-1">
            {allExercises.length === 0 ? t('training.sidebarNoExercises') : t('training.sidebarLoading')}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {muscleBreakdown.map(({ group, sets }) => (
              <div key={group}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-text2">
                    {t(MUSCLE_GROUP_KEYS[group] ?? group)}
                  </span>
                  <span className="text-xs text-text3 tabular-nums">
                    {t('training.sidebarSets', { count: sets })}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-bg3 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      MUSCLE_GROUP_COLORS[group] ?? 'bg-accent',
                    )}
                    style={{ width: `${Math.round((sets / maxSets) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
