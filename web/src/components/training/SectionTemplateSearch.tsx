import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { WorkoutTemplateResponse } from '@/api/sectionTemplates';
import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';
import { FORMAT_LABEL_KEYS, FORMAT_BG_COLORS, FORMAT_COLORS } from '@/constants/training';
import { estimatedSectionDurationSeconds, formatDurationCompact } from '@/lib/training-plan-format';

export interface SectionTemplateSearchProps {
  templates: WorkoutTemplateResponse[];
  onSelect: (template: WorkoutTemplateResponse) => void;
  placeholder?: string;
}

/**
 * Typeahead-style picker for SectionTemplates — mirrors `ExerciseSearch` styling.
 * Templates are pre-loaded by the parent (small per-trainer set), so no infinite
 * scroll / async fetching. Filters by `template.name` substring.
 *
 * Each result row shows: template name, format pill (color-coded), exercise count.
 */
export function SectionTemplateSearch({
  templates,
  onSelect,
  placeholder,
}: SectionTemplateSearchProps) {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t('training.section.templateSearchPlaceholder');
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  }>({ top: 0, left: 0, width: 0, openUp: false });

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
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  function handleSelect(template: WorkoutTemplateResponse) {
    onSelect(template);
    setQuery('');
    setIsOpen(false);
  }

  // Filter + sort by name
  const q = query.trim().toLowerCase();
  const filtered = (q ? templates.filter((tpl) => (tpl.name ?? '').toLowerCase().includes(q)) : templates)
    .slice()
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

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
          aria-label={t('training.section.templateSearchAriaLabel')}
          className="flex-1 bg-transparent border-none outline-none text-[11px] text-text3 placeholder:text-text3 focus:text-text"
          style={{ fontFamily: 'inherit' }}
        />
      </div>

      {isOpen &&
        createPortal(
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
              border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              maxHeight: DROPDOWN_MAX_HEIGHT,
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
                {q.length > 0
                  ? t('training.section.templateSearchNoResults')
                  : t('training.section.templateSearchEmpty')}
              </div>
            )}
            {filtered.map((tpl, i) => {
              const fmt = (tpl.defaultFormat ?? 'Standard') as WorkoutFormat;
              const exerciseCount = tpl.defaultExercises?.length ?? 0;
              const durationSeconds = estimatedSectionDurationSeconds(
                fmt,
                tpl.defaultFormatConfig as WodConfig | null | undefined,
              );
              return (
                <div
                  // Stable key derived from `templateId` first, then `name`,
                  // then the row index — `Math.random()` here violated the
                  // React Compiler `react-hooks/purity` rule (impurity in
                  // render) and broke CI.
                  key={tpl.templateId ?? tpl.name ?? `tpl-${i}`}
                  onClick={() => handleSelect(tpl)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '';
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tpl.name ?? ''}
                    </div>
                    <div
                      className="text-text3"
                      style={{ fontSize: 11, marginTop: 2 }}
                    >
                      {t('training.section.templateExerciseCount', { count: exerciseCount })}
                      {durationSeconds != null && durationSeconds > 0 && (
                        <> · ≈ {formatDurationCompact(durationSeconds)}</>
                      )}
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                    style={{ background: FORMAT_BG_COLORS[fmt], color: FORMAT_COLORS[fmt] }}
                  >
                    {t(`training.format.${FORMAT_LABEL_KEYS[fmt]}`)}
                  </span>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
