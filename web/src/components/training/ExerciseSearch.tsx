import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { searchExercises } from '@/api/exercises';
import type { ExerciseSummary } from '@/api/exercise-types';

export interface ExerciseSearchProps {
  onSelect: (exercise: {
    exerciseExternalId: string;
    exerciseName: string;
  }) => void;
  placeholder?: string;
}

export function ExerciseSearch({ onSelect, placeholder }: ExerciseSearchProps) {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t('training.exerciseSearchPlaceholder');
  const [query, setQuery] = useState('');
  const [allExercises, setAllExercises] = useState<ExerciseSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadExercises = useCallback(async () => {
    if (loaded) return;
    try {
      const res = await searchExercises({ pageSize: 100 });
      setAllExercises(res.exercises);
      setLoaded(true);
    } catch {
      // silent
    }
  }, [loaded]);

  const handleFocus = () => {
    setIsOpen(true);
    loadExercises();
  };

  const filtered = query.length >= 2
    ? allExercises.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
    : allExercises;

  function handleSelect(exercise: ExerciseSummary) {
    onSelect({
      exerciseExternalId: exercise.exerciseId,
      exerciseName: exercise.name,
    });
    setQuery('');
    setIsOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  const MUSCLE_GROUP_KEYS: Record<string, string> = {
    Chest: 'training.muscleChest', Back: 'training.muscleBack', Shoulders: 'training.muscleShoulders',
    Biceps: 'training.muscleBiceps', Triceps: 'training.muscleTriceps', Forearms: 'training.muscleForearms',
    Quadriceps: 'training.muscleQuadriceps', Hamstrings: 'training.muscleHamstrings', Glutes: 'training.muscleGlutes',
    Calves: 'training.muscleCalves', Abs: 'training.muscleAbs', Obliques: 'training.muscleObliques',
    LowerBack: 'training.muscleLowerBack', Traps: 'training.muscleTraps', FullBody: 'training.muscleFullBody',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
          cursor: 'text', transition: 'background 0.1s',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <span style={{ color: 'var(--text4)', fontSize: 13 }}>+</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder={effectivePlaceholder}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: 'var(--text)', fontFamily: 'inherit',
          }}
        />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 200,
          border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)',
          background: 'var(--bg)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {!loaded && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
              {t('training.exerciseSearchLoading')}
            </div>
          )}
          {loaded && filtered.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
              {query.length >= 2 ? t('training.exerciseSearchNoResults') : t('training.exerciseSearchEmpty')}
            </div>
          )}
          {filtered.map((exercise) => (
            <div
              key={exercise.exerciseId}
              onClick={() => handleSelect(exercise)}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                alignItems: 'center', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {exercise.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                {exercise.muscleGroups.map((g) => t(MUSCLE_GROUP_KEYS[g] ?? g)).join(', ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
