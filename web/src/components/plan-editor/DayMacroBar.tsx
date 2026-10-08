import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, StickyNote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import {
  energySharePercent,
  KCAL_PER_GRAM_CARBS,
  KCAL_PER_GRAM_FAT,
  KCAL_PER_GRAM_PROTEIN,
  targetStatus,
  type Totals,
} from '@/components/plan-editor/plan-editor-nutrition';
import { MAX_NOTE_LENGTH, type PlanTargets } from '@/components/plan-editor/plan-editor-types';

interface MacroProps {
  label: string;
  value: number;
  target: number | undefined;
  unit: string;
  language: string;
  dotClass: string;
  barClass: string;
  /** Without a target: kcal per gram for an energy-share bar, or null for a number only. */
  energyFactor: number | null;
  dayKcal: number;
}

function MacroColumn({ label, value, target, unit, language, dotClass, barClass, energyFactor, dayKcal }: MacroProps) {
  const { t } = useTranslation();
  const hasTarget = target !== undefined;
  const share = !hasTarget && energyFactor !== null ? energySharePercent(value, energyFactor, dayKcal) : null;
  const fill = hasTarget ? Math.min(100, target ? (value / target) * 100 : 0) : (share ?? 0);
  const showTrack = hasTarget || share !== null;
  return (
    <div className="flex flex-auto flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5 text-body whitespace-nowrap">
        <span className={cn('size-1.75 shrink-0 self-center rounded-full', dotClass)} aria-hidden="true" />
        <span className="text-muted-foreground">{label}</span>
        <span className="text-copy font-semibold text-ink">{formatKcal(value, language)}</span>
        {hasTarget && (
          <span className="text-muted-foreground">
            / {formatKcal(target, language)}
            {unit}
          </span>
        )}
        {share !== null && (
          <span className="text-muted-foreground">{t('planEditor.day.percentKcal', { percent: Math.round(share) })}</span>
        )}
      </div>
      {showTrack && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className={cn('h-full rounded-full', barClass)} style={{ width: `${fill}%` }} />
        </div>
      )}
    </div>
  );
}

const KCAL_STATUS_CLASS = {
  none: { dot: 'bg-ink', bar: 'bg-ink' },
  on: { dot: 'bg-success', bar: 'bg-success' },
  near: { dot: 'bg-training-bright', bar: 'bg-training-bright' },
  off: { dot: 'bg-error', bar: 'bg-error' },
} as const;

interface Props {
  totals: Totals;
  targets: PlanTargets | undefined;
  note: string | undefined;
  readOnly: boolean;
  addMealDisabled: boolean;
  addMealTitle: string | undefined;
  onAddMeal: () => void;
  onNoteChange: (note: string) => void;
}

/** The day's kcal and macros against the targets, with the "Add meal" and day-note controls. */
export default function DayMacroBar({
  totals,
  targets,
  note,
  readOnly,
  addMealDisabled,
  addMealTitle,
  onAddMeal,
  onNoteChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const hasNote = Boolean(note);
  // A day with a note keeps its input open; clearing it hides the input again once it loses focus.
  const showInput = !readOnly && (hasNote || editing);
  const status = KCAL_STATUS_CLASS[targetStatus(totals.kcal, targets?.kcal)];
  const language = i18n.language;

  return (
    <div
      data-testid="day-macros"
      className="@container flex flex-col gap-3 rounded-xl border border-line bg-card px-4 py-3"
    >
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-3">
        <MacroColumn
          label={t('planEditor.day.kcal')}
          value={totals.kcal}
          target={targets?.kcal}
          unit=""
          language={language}
          dotClass={status.dot}
          barClass={status.bar}
          energyFactor={null}
          dayKcal={totals.kcal}
        />
        <MacroColumn
          label={t('planEditor.day.protein')}
          value={totals.protein}
          target={targets?.protein}
          unit=" g"
          language={language}
          dotClass="bg-macro-protein"
          barClass="bg-macro-protein"
          energyFactor={KCAL_PER_GRAM_PROTEIN}
          dayKcal={totals.kcal}
        />
        <MacroColumn
          label={t('planEditor.day.carbs')}
          value={totals.carbs}
          target={targets?.carbs}
          unit=" g"
          language={language}
          dotClass="bg-macro-carbs"
          barClass="bg-macro-carbs"
          energyFactor={KCAL_PER_GRAM_CARBS}
          dayKcal={totals.kcal}
        />
        <MacroColumn
          label={t('planEditor.day.fat')}
          value={totals.fat}
          target={targets?.fat}
          unit=" g"
          language={language}
          dotClass="bg-macro-fat"
          barClass="bg-macro-fat"
          energyFactor={KCAL_PER_GRAM_FAT}
          dayKcal={totals.kcal}
        />
        <MacroColumn
          label={t('planEditor.day.fiber')}
          value={totals.fiber}
          target={targets?.fiber}
          unit=" g"
          language={language}
          dotClass="bg-macro-fibre"
          barClass="bg-macro-fibre"
          energyFactor={null}
          dayKcal={totals.kcal}
        />
        </div>
        {!readOnly && (
          <button
            type="button"
            data-testid="day-add-meal"
            disabled={addMealDisabled}
            title={addMealTitle}
            aria-label={t('planEditor.addMeal.open')}
            onClick={onAddMeal}
            className="inline-flex h-7.5 w-7.5 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line text-body text-ink outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 @[56rem]:h-9 @[56rem]:w-auto @[56rem]:px-3"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden whitespace-nowrap @[56rem]:inline">{t('planEditor.addMeal.open')}</span>
          </button>
        )}
        {(!readOnly || hasNote) && (
          <button
            type="button"
            data-testid="day-note-toggle"
            disabled={readOnly || hasNote}
            title={readOnly ? note : hasNote ? t('planEditor.day.noteShownBelow') : t('planEditor.day.addNote')}
            aria-label={readOnly ? note : hasNote ? t('planEditor.day.noteLabel') : t('planEditor.day.addNote')}
            aria-expanded={readOnly ? undefined : showInput}
            onClick={() => setEditing((open) => !open)}
            className={cn(
              'inline-flex h-7.5 w-7.5 shrink-0 items-center justify-center gap-2 rounded-lg border text-body outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-100 @[56rem]:h-9 @[56rem]:w-auto @[56rem]:max-w-48 @[56rem]:px-3',
              hasNote ? 'border-line text-ink' : 'border-dashed border-line text-muted-foreground',
              readOnly || hasNote ? 'cursor-default' : 'cursor-pointer hover:text-ink',
            )}
          >
            <StickyNote className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden truncate @[56rem]:inline">
              {readOnly ? note : hasNote ? t('planEditor.day.noteLabel') : t('planEditor.day.addNote')}
            </span>
          </button>
        )}
      </div>
      {showInput && (
        <div className="relative">
          <StickyNote
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={note ?? ''}
            maxLength={MAX_NOTE_LENGTH}
            autoFocus={editing}
            aria-label={t('planEditor.day.noteLabel')}
            placeholder={t('planEditor.day.notePlaceholder')}
            onChange={(event) => onNoteChange(event.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            className="h-10 pl-10"
          />
        </div>
      )}
    </div>
  );
}
