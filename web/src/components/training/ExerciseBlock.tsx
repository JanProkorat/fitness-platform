import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export interface ExerciseSet {
  setNumber: number;
  reps: number | string;
  weight: number;
  restSeconds?: number;
  notes?: string;
}

export interface ExerciseBlockProps {
  name: string;
  sets: ExerciseSet[];
  meta?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSetChange?: (setIndex: number, field: string, value: string | number) => void;
  onAddSet?: () => void;
  onRemoveSet?: (setIndex: number) => void;
}

function InlineInput({
  value,
  onChange,
  className,
}: {
  value: string | number;
  onChange: (val: string) => void;
  className?: string;
}) {
  const [local, setLocal] = useState(String(value));

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        'bg-transparent outline-none rounded-sm px-1 py-[1px] transition-colors hover:bg-bg-hover focus:bg-bg-active focus:ring-1 focus:ring-border-md',
        className,
      )}
    />
  );
}

export function ExerciseBlock({
  name,
  sets,
  meta,
  isOpen,
  onToggle,
  onSetChange,
  onAddSet,
  onRemoveSet,
}: ExerciseBlockProps) {
  const { t } = useTranslation();
  return (
    <div className="border border-border rounded-md overflow-hidden mb-1.5">
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-2 px-3 py-2 bg-bg2 cursor-pointer transition-colors hover:bg-bg3 select-none"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-label={`${name} - ${isOpen ? 'Collapse' : 'Expand'}`}
      >
        <span
          className={cn(
            'text-[10px] text-text3 transition-transform duration-150 w-3 inline-flex items-center justify-center',
            isOpen && 'rotate-90',
          )}
        >
          ▶
        </span>
        <span className="text-[13px] font-semibold flex-1">{name}</span>
        {meta && <span className="text-xs text-text3">{meta}</span>}
      </div>

      {/* Body */}
      {isOpen && (
        <div className="border-t border-border px-3 py-2">
          {/* Header row */}
          <div className="grid grid-cols-[36px_80px_80px_70px_1fr] gap-2 py-[3px] pb-1.5 text-[11px] text-text3 font-medium border-b border-border">
            <span>Série</span>
            <span>Opak.</span>
            <span>Váha</span>
            <span>Odpočinek</span>
            <span>Poznámky</span>
          </div>

          {/* Set rows */}
          {sets.map((set, idx) => (
            <div
              key={set.setNumber}
              className="grid grid-cols-[36px_80px_80px_70px_1fr] gap-2 py-[5px] border-b border-border text-[13px] items-center last:border-b-0 group"
            >
              <span className="text-text3 text-xs">{set.setNumber}</span>
              <InlineInput
                value={set.reps}
                onChange={(val) => onSetChange?.(idx, 'reps', val)}
                className="text-[13px] w-full"
              />
              <InlineInput
                value={set.weight}
                onChange={(val) => onSetChange?.(idx, 'weight', val)}
                className="text-[13px] w-full"
              />
              <InlineInput
                value={set.restSeconds ?? ''}
                onChange={(val) => onSetChange?.(idx, 'restSeconds', val)}
                className="text-[13px] w-full"
              />
              <div className="flex items-center gap-1">
                <InlineInput
                  value={set.notes ?? ''}
                  onChange={(val) => onSetChange?.(idx, 'notes', val)}
                  className="text-[13px] w-full flex-1"
                />
                {onRemoveSet && (
                  <button
                    type="button"
                    onClick={() => onRemoveSet(idx)}
                    className="opacity-0 group-hover:opacity-100 text-[11px] text-text4 cursor-pointer transition-all hover:text-red px-1"
                    aria-label={t('training.removeSetAriaLabel')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add set */}
          {onAddSet && (
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-1.5 py-[5px] text-text4 text-xs cursor-pointer transition-colors hover:text-text3 mt-1"
              onClick={onAddSet}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAddSet();
                }
              }}
              aria-label={t('training.addSetAriaLabel')}
            >
              <span>+</span>
              <span>{t('training.addSetAriaLabel')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
