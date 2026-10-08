import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StickyNote } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import { targetStatus, type Totals } from '@/components/plan-editor/plan-editor-nutrition';
import { MAX_NOTE_LENGTH, type PlanTargets } from '@/components/plan-editor/plan-editor-types';

interface MacroProps {
  label: string;
  value: number;
  target: number | undefined;
  unit: string;
  language: string;
  dotClass: string;
  barClass: string;
}

function MacroColumn({ label, value, target, unit, language, dotClass, barClass }: MacroProps) {
  const fill = target ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-baseline gap-1.5 overflow-hidden text-body whitespace-nowrap">
        <span className={cn('size-1.75 shrink-0 self-center rounded-full', dotClass)} aria-hidden="true" />
        <span className="text-muted-foreground">{label}</span>
        <span className="text-copy font-semibold text-ink">{formatKcal(value, language)}</span>
        {target !== undefined && (
          <span className="text-muted-foreground">
            / {formatKcal(target, language)}
            {unit}
          </span>
        )}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${fill}%` }} />
      </div>
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
  onNoteChange: (note: string) => void;
}

/** The day's kcal and macros against the targets, plus the day note. */
export default function DayMacroBar({ totals, targets, note, readOnly, onNoteChange }: Props) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const status = KCAL_STATUS_CLASS[targetStatus(totals.kcal, targets?.kcal)];
  const language = i18n.language;

  return (
    <div data-testid="day-macros" className="flex flex-col gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 min-[1100px]:flex-nowrap">
        <MacroColumn
          label={t('planEditor.day.kcal')}
          value={totals.kcal}
          target={targets?.kcal}
          unit=""
          language={language}
          dotClass={status.dot}
          barClass={status.bar}
        />
        <MacroColumn
          label={t('planEditor.day.protein')}
          value={totals.protein}
          target={targets?.protein}
          unit=" g"
          language={language}
          dotClass="bg-macro-protein"
          barClass="bg-macro-protein"
        />
        <MacroColumn
          label={t('planEditor.day.carbs')}
          value={totals.carbs}
          target={targets?.carbs}
          unit=" g"
          language={language}
          dotClass="bg-macro-carbs"
          barClass="bg-macro-carbs"
        />
        <MacroColumn
          label={t('planEditor.day.fat')}
          value={totals.fat}
          target={targets?.fat}
          unit=" g"
          language={language}
          dotClass="bg-macro-fat"
          barClass="bg-macro-fat"
        />
        <MacroColumn
          label={t('planEditor.day.fiber')}
          value={totals.fiber}
          target={targets?.fiber}
          unit=" g"
          language={language}
          dotClass="bg-macro-fibre"
          barClass="bg-macro-fibre"
        />
        {(!readOnly || Boolean(note)) && (
          <button
            type="button"
            disabled={readOnly}
            title={note || undefined}
            aria-expanded={readOnly ? undefined : editing}
            onClick={() => setEditing((open) => !open)}
            className={cn(
              'inline-flex h-9 max-w-48 shrink-0 items-center gap-2 rounded-lg border px-3 text-body outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-100',
              note ? 'border-line text-ink' : 'border-dashed border-line text-muted-foreground',
              readOnly ? 'cursor-default' : 'cursor-pointer hover:text-ink',
            )}
          >
            <StickyNote className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{note || t('planEditor.day.addNote')}</span>
          </button>
        )}
      </div>
      {editing && !readOnly && (
        <div className="relative">
          <StickyNote
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={note ?? ''}
            maxLength={MAX_NOTE_LENGTH}
            autoFocus
            aria-label={t('planEditor.day.noteLabel')}
            placeholder={t('planEditor.day.notePlaceholder')}
            onChange={(event) => onNoteChange(event.target.value)}
            onBlur={() => setEditing(false)}
            className="h-10 pl-10"
          />
        </div>
      )}
    </div>
  );
}
