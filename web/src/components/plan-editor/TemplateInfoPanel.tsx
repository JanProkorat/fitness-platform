import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Lock, LockOpen, Users } from 'lucide-react';
import { DietaryStyle } from '@/api/generated';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GOAL_ORDER } from '@/components/plan-templates/plan-template-tree';
import { cn } from '@/lib/utils';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import {
  STATUS_BAR_CLASS,
  STATUS_TEXT_CLASS,
  targetStatus,
  weekSummary,
} from '@/components/plan-editor/plan-editor-nutrition';
import {
  type EditorDocument,
  type EditorWeek,
  type PlanTargets,
} from '@/components/plan-editor/plan-editor-types';
import type { PlanEditorState } from '@/components/plan-editor/usePlanEditorState';

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_KCAL = 20000;
const MAX_GRAMS = 2000;

const DIETS: readonly DietaryStyle[] = [
  DietaryStyle.Standard,
  DietaryStyle.Vegetarian,
  DietaryStyle.Vegan,
  DietaryStyle.GlutenFree,
];

const SECTION_LABEL_CLASS = 'text-label font-semibold tracking-label text-ink-2 uppercase';

type TargetKey = keyof PlanTargets;

const MACRO_ROWS = [
  { key: 'protein', dotClass: 'bg-macro-protein' },
  { key: 'carbs', dotClass: 'bg-macro-carbs' },
  { key: 'fat', dotClass: 'bg-macro-fat' },
  { key: 'fiber', dotClass: 'bg-macro-fibre' },
] as const;

/** Share of the target reached, 0-100; 0 when there is no target. */
function fillPercent(value: number, target: number | undefined): number {
  return target ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
}

/** A signed percentage with a real minus sign, e.g. "+4" or "−12". */
function formatDeviation(value: number): string {
  if (value === 0) {
    return '0';
  }
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}`;
}

function Bar({ fill, heightClass, fillClass }: { fill: number; heightClass: string; fillClass: string }) {
  return (
    <span className={cn('block overflow-hidden rounded-full bg-muted', heightClass)} aria-hidden="true">
      <span className={cn('block h-full rounded-full', fillClass)} style={{ width: `${fill}%` }} />
    </span>
  );
}

/** How a plan is used by the caller; absent for hosts that have no such notion. */
export interface PlanUsage {
  count: number;
  shared: boolean;
}

interface TargetFieldProps {
  id: string;
  label: string;
  unit: string;
  value: number | undefined;
  max: number;
  disabled: boolean;
  onChange: (value: number | undefined) => void;
}

function TargetField({ id, label, unit, value, max, disabled, onChange }: TargetFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          disabled={disabled}
          value={value ?? ''}
          onChange={(event) => {
            const text = event.target.value.trim();
            if (text === '') {
              onChange(undefined);
              return;
            }
            const parsed = Math.round(Number(text));
            onChange(Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : undefined);
          }}
          className="h-10 pr-9"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-body text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

interface Props {
  doc: EditorDocument;
  /** The week the editor has selected; its average per day is shown. */
  week: EditorWeek;
  weekNumber: number;
  usage?: PlanUsage;
  readOnly: boolean;
  onEdit: PlanEditorState['edit'];
}

/** Side-panel tab with the plan's own data: name, description, goal, diet, daily targets and usage. */
export default function TemplateInfoPanel({ doc, week, weekNumber, usage, readOnly, onEdit }: Props) {
  const { t, i18n } = useTranslation();
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const nameInvalid = doc.name.trim() === '';
  const summary = weekSummary(week);
  const { average } = summary;
  const { targets } = doc;
  const kcalStatus = targetStatus(average.kcal, targets.kcal);
  const kcalDeviation = targets.kcal && average.kcal > 0 ? Math.round((average.kcal / targets.kcal - 1) * 100) : null;

  function setTarget(key: TargetKey, value: number | undefined) {
    onEdit((current) => ({ ...current, targets: { ...current.targets, [key]: value } }), `info:target:${key}`);
  }

  const targetFields: { key: TargetKey; labelKey: string; unitKey: string; max: number }[] = [
    { key: 'kcal', labelKey: 'calories', unitKey: 'kcal', max: MAX_KCAL },
    { key: 'fiber', labelKey: 'fiber', unitKey: 'g', max: MAX_GRAMS },
    { key: 'protein', labelKey: 'protein', unitKey: 'g', max: MAX_GRAMS },
    { key: 'carbs', labelKey: 'carbs', unitKey: 'g', max: MAX_GRAMS },
    { key: 'fat', labelKey: 'fat', unitKey: 'g', max: MAX_GRAMS },
  ];

  function renderTarget(field: (typeof targetFields)[number]) {
    return (
      <TargetField
        key={field.key}
        id={`${baseId}-${field.key}`}
        label={t(`planEditor.info.targets.${field.labelKey}`)}
        unit={field.unitKey === 'kcal' ? t('planEditor.info.targets.kcalUnit') : t('planEditor.units.g')}
        value={targets[field.key]}
        max={field.max}
        disabled={readOnly}
        onChange={(value) => setTarget(field.key, value)}
      />
    );
  }

  return (
    <div data-testid="template-info" className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4.5">
      <div className="flex flex-col gap-1">
        <Label htmlFor={nameId}>
          {t('planEditor.info.name')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id={nameId}
          value={doc.name}
          maxLength={MAX_NAME_LENGTH}
          disabled={readOnly}
          aria-invalid={nameInvalid}
          aria-describedby={nameInvalid ? `${nameId}-error` : undefined}
          onChange={(event) => onEdit((current) => ({ ...current, name: event.target.value }), 'name')}
          className="h-10"
        />
        {nameInvalid && (
          <p id={`${nameId}-error`} data-testid="info-name-error" role="alert" className="text-meta text-destructive">
            {t('planEditor.info.nameRequired')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${baseId}-description`}>{t('planEditor.info.description')}</Label>
        <Textarea
          id={`${baseId}-description`}
          rows={3}
          maxLength={MAX_DESCRIPTION_LENGTH}
          disabled={readOnly}
          value={doc.description ?? ''}
          onChange={(event) =>
            onEdit((current) => ({ ...current, description: event.target.value || undefined }), 'description')
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <span id={`${baseId}-goal`} className={SECTION_LABEL_CLASS}>
          {t('planEditor.info.goal')}
        </span>
        <div role="group" aria-labelledby={`${baseId}-goal`} className="flex flex-wrap gap-2">
          {GOAL_ORDER.map((goal) => {
            const selected = doc.goal === goal;
            return (
              <button
                key={goal}
                type="button"
                aria-pressed={selected}
                disabled={readOnly}
                onClick={() => onEdit((current) => ({ ...current, goal: selected ? undefined : goal }))}
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-body font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
                  selected ? 'border-ink bg-ink text-primary-foreground' : 'border-line bg-card text-ink hover:bg-muted',
                )}
              >
                {t(`nutritionGoals.goal_${goal}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${baseId}-diet`} className={SECTION_LABEL_CLASS}>
          {t('planEditor.info.diet')}
        </label>
        <div className="relative">
          <select
            id={`${baseId}-diet`}
            disabled={readOnly}
            value={doc.dietaryStyle ?? ''}
            onChange={(event) => {
              const value = DIETS.find((diet) => diet === event.target.value);
              onEdit((current) => ({ ...current, dietaryStyle: value }));
            }}
            className="h-10 w-full appearance-none rounded-field border border-input bg-background pr-9 pl-3 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">{t('planEditor.info.diets.any')}</option>
            {DIETS.map((diet) => (
              <option key={diet} value={diet}>
                {t(`planEditor.info.diets.${diet}`)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={SECTION_LABEL_CLASS}>{t('planEditor.info.targets.title')}</span>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">{targetFields.slice(0, 2).map(renderTarget)}</div>
        <div className="grid grid-cols-3 gap-x-3">{targetFields.slice(2).map(renderTarget)}</div>
        <p className="text-meta text-muted-foreground">{t('planEditor.info.targets.hint')}</p>
      </div>

      <div
        data-testid="info-week-average"
        className="flex flex-col gap-3 rounded-xl border border-raised-line bg-raised p-3.5 shadow-raised"
      >
        <div className="flex items-baseline gap-1.5">
          <span className={SECTION_LABEL_CLASS}>{t('planEditor.info.average', { week: weekNumber })}</span>
          <span className="ml-auto text-meta text-muted-foreground">
            {t('planEditor.info.weekTotal', { kcal: formatKcal(summary.total.kcal, i18n.language) })}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <span data-testid="info-average-kcal" data-status={kcalStatus} className={STATUS_TEXT_CLASS[kcalStatus]}>
              <span className="font-display text-stat font-semibold">{formatKcal(average.kcal, i18n.language)}</span>
            </span>
            <span className="text-body text-muted-foreground">
              {targets.kcal === undefined
                ? t('planEditor.info.targets.kcalUnit')
                : t('planEditor.info.ofTarget', { target: formatKcal(targets.kcal, i18n.language) })}
            </span>
            {kcalDeviation !== null && (
              <span className={cn('ml-auto text-body font-semibold', STATUS_TEXT_CLASS[kcalStatus])}>
                {t('planEditor.info.deviation', { value: formatDeviation(kcalDeviation) })}
              </span>
            )}
          </div>
          <Bar fill={fillPercent(average.kcal, targets.kcal)} heightClass="h-1.5" fillClass={STATUS_BAR_CLASS[kcalStatus]} />
        </div>

        <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
          {MACRO_ROWS.map(({ key, dotClass }) => (
            <div key={key} data-testid={`info-average-${key}`} className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-1.5 text-body text-ink">
                <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
                {t(`planEditor.info.targets.${key}`)}
                <span className="ml-auto">
                  <b className="font-semibold">{Math.round(average[key])}</b>
                  {targets[key] !== undefined && <span className="text-muted-foreground">/{targets[key]}</span>}
                </span>
              </span>
              <Bar fill={fillPercent(average[key], targets[key])} heightClass="h-1" fillClass={dotClass} />
            </div>
          ))}
        </div>
      </div>
      </div>

      {usage && (
        <div
          data-testid="info-usage"
          className="flex shrink-0 items-center gap-3.5 border-t border-line px-4 py-2.5 text-body text-ink"
        >
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {t('planEditor.info.clients', { count: usage.count })}
          </span>
          <span className="flex items-center gap-1.5">
            {usage.shared ? (
              <LockOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            {usage.shared ? t('planEditor.info.shared') : t('planEditor.info.private')}
          </span>
        </div>
      )}
    </div>
  );
}
