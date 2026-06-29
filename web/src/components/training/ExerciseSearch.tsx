import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openUp: boolean }>({ top: 0, left: 0, width: 0, openUp: false });

  const PAGE_SIZE = 20;
  const loadingRef = useRef(false);

  const fetchPage = useCallback(async (pageNum: number, searchQuery: string, reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await searchExercises({ pageSize: PAGE_SIZE, page: pageNum, q: searchQuery || undefined });
      setAllExercises((prev) => reset ? res.exercises : [...prev, ...res.exercises]);
      setPage(pageNum);
      setHasMore(res.exercises.length === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const DROPDOWN_MAX_HEIGHT = 280;

  const handleFocus = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && rect.top > spaceBelow;
      setDropdownPos({
        top: openUp ? rect.top : rect.bottom,
        left: rect.left,
        width: rect.width,
        openUp,
      });
    }
    setIsOpen(true);
    if (allExercises.length === 0) {
      fetchPage(1, query, true);
    }
  };

  // Reload when query changes
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchPage(1, query, true);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Infinite scroll
  useEffect(() => {
    if (!isOpen) return;
    const el = dropdownRef.current;
    if (!el) return;
    const currentQuery = query;
    const handleScroll = () => {
      if (loadingRef.current || !hasMore) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
        fetchPage(page + 1, currentQuery, false);
      }
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isOpen, hasMore, page, query, fetchPage]);

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
    setAllExercises([]);
    setPage(1);
    setHasMore(true);
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setAllExercises([]);
        setPage(1);
        setHasMore(true);
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

  const MUSCLE_COLORS: Record<string, string> = {
    Chest: 'var(--blue)', Back: 'var(--green)', Shoulders: 'var(--orange)', Biceps: 'var(--purple)', Triceps: 'var(--purple)',
    Forearms: 'var(--purple)', Quadriceps: 'var(--blue)', Hamstrings: 'var(--blue)', Glutes: 'var(--green)', Calves: 'var(--green)',
    Abs: 'var(--orange)', Obliques: 'var(--orange)', LowerBack: 'var(--orange)', Traps: 'var(--green)', FullBody: 'var(--accent)',
  };

  const MUSCLE_BG_COLORS: Record<string, string> = {
    Chest: 'var(--blue-bg)', Back: 'var(--green-bg)', Shoulders: 'var(--orange-bg)', Biceps: 'var(--purple-bg)', Triceps: 'var(--purple-bg)',
    Forearms: 'var(--purple-bg)', Quadriceps: 'var(--blue-bg)', Hamstrings: 'var(--blue-bg)', Glutes: 'var(--green-bg)', Calves: 'var(--green-bg)',
    Abs: 'var(--orange-bg)', Obliques: 'var(--orange-bg)', LowerBack: 'var(--orange-bg)', Traps: 'var(--green-bg)', FullBody: 'var(--accent-bg)',
  };

  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        className="flex items-center gap-1 text-[11px] text-text3 transition-colors hover:text-text"
        style={{ cursor: 'text' }}
        onClick={() => inputRef.current?.focus()}
      >
        <span>+</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder={effectivePlaceholder}
          aria-label={t('training.exerciseSearchAriaLabel')}
          className="flex-1 bg-transparent border-none outline-none text-[11px] text-text3 placeholder:text-text3 focus:text-text"
          style={{ fontFamily: 'inherit' }}
        />
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 1000,
            ...(dropdownPos.openUp
              ? { bottom: window.innerHeight - dropdownPos.top }
              : { top: dropdownPos.top }),
            border: '1px solid var(--border-md)', borderRadius: 'var(--radius-md)',
            background: 'var(--bg)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            maxHeight: DROPDOWN_MAX_HEIGHT, overflowY: 'auto',
          }}
        >
          {loading && filtered.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
              {t('training.exerciseSearchLoading')}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
              {query.length >= 2 ? t('training.exerciseSearchNoResults') : t('training.exerciseSearchEmpty')}
            </div>
          )}
          {sorted.map((exercise) => {
            const diffLevel = exercise.difficulty === 'Beginner' ? 1 : exercise.difficulty === 'Intermediate' ? 2 : exercise.difficulty === 'Advanced' ? 3 : 0;
            const diffColor = exercise.difficulty === 'Beginner' ? 'var(--green)' : exercise.difficulty === 'Intermediate' ? 'var(--orange)' : 'var(--red)';
            return (
              <div
                key={exercise.exerciseId}
                onClick={() => handleSelect(exercise)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exercise.name}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    {exercise.muscleGroups.map((g) => (
                      <span
                        key={g}
                        style={{
                          fontSize: 10, fontWeight: 500, borderRadius: 3,
                          padding: '1px 5px',
                          background: MUSCLE_BG_COLORS[g] ?? 'var(--accent-bg)',
                          color: MUSCLE_COLORS[g] ?? 'var(--accent)',
                        }}
                      >
                        {t(MUSCLE_GROUP_KEYS[g] ?? g)}
                      </span>
                    ))}
                  </div>
                </div>
                {diffLevel > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        style={{
                          width: 12, height: 4, borderRadius: 9999,
                          background: level <= diffLevel ? diffColor : 'var(--bg3)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {loading && filtered.length > 0 && (
            <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
              {t('training.exerciseSearchLoading')}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
