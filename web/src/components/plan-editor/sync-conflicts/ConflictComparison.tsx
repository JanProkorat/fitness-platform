import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatKcal } from '@/components/plan-editor/plan-editor-format';
import type {
  CompareLine,
  ComparePair,
  ComparePairStatus,
  Comparison,
} from '@/components/plan-editor/sync-conflicts/syncConflictModel';

interface Props {
  comparison: Comparison;
  clientName: string;
  /** Plan version the client saw; the label omits it when unknown. */
  sawVersion: number | undefined;
  /** Plan version now; the label omits it when unknown. */
  nowVersion: number | undefined;
  /** `day` shows kcal per row and an "Amount" chip; `popover` only highlights a changed amount. */
  variant: 'popover' | 'day';
}

const CHIP_CLASS: Record<Exclude<ComparePairStatus, 'same'>, string> = {
  removed: 'bg-error-soft text-error',
  added: 'bg-success-soft text-success-ink',
  amount: 'bg-caution-soft text-caution-ink',
};

function Chip({ status }: { status: Exclude<ComparePairStatus, 'same'> }) {
  const { t } = useTranslation();
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-label font-semibold', CHIP_CLASS[status])}>
      {t(`planEditor.syncConflicts.chip.${status}`)}
    </span>
  );
}

function Line({
  line,
  status,
  side,
  variant,
  language,
}: {
  line: CompareLine | undefined;
  status: ComparePairStatus;
  side: 'saw' | 'now';
  variant: 'popover' | 'day';
  language: string;
}) {
  const { t } = useTranslation();
  if (!line) {
    return <span className="text-muted-foreground">—</span>;
  }
  const struck = side === 'saw' && status === 'removed';
  const amountChanged = side === 'now' && status === 'amount';
  const amount = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(line.amount);
  const chip: Exclude<ComparePairStatus, 'same'> | null =
    struck ? 'removed' : side === 'now' && status === 'added' ? 'added' : amountChanged && variant === 'day' ? 'amount' : null;
  return (
    <span className="flex min-w-0 items-start justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span data-testid="conflict-item-name" className={cn('text-copy font-semibold text-ink [overflow-wrap:anywhere]', struck && 'line-through')}>
            {line.name}
          </span>
          {chip && <Chip status={chip} />}
        </span>
        <span className={cn('text-body text-muted-foreground', amountChanged && 'font-semibold text-caution-ink')}>
          {t(`planEditor.syncConflicts.amount.${line.unit}`, { amount })}
        </span>
      </span>
      {variant === 'day' && (
        <span className="shrink-0 text-body text-ink">
          {t('planEditor.cell.kcal', { kcal: formatKcal(line.kcal, language) })}
        </span>
      )}
    </span>
  );
}

function Column({
  side,
  label,
  pairs,
  totalKcal,
  variant,
  language,
}: {
  side: 'saw' | 'now';
  label: string;
  pairs: readonly ComparePair[];
  totalKcal: number;
  variant: 'popover' | 'day';
  language: string;
}) {
  const { t } = useTranslation();
  return (
    <div data-testid={`conflict-column-${side}`} className="flex min-w-0 flex-col gap-2">
      <span className="border-b border-line pb-2 text-label font-bold tracking-label text-muted-foreground uppercase">
        {label}
      </span>
      {pairs.map((pair) => (
        <div key={pair.key} className="flex min-h-12 flex-col justify-center border-b border-line pb-2">
          <Line line={pair[side]} status={pair.status} side={side} variant={variant} language={language} />
        </div>
      ))}
      <span className="text-copy font-semibold text-ink">
        {t('planEditor.syncConflicts.total', { kcal: formatKcal(totalKcal, language) })}
      </span>
    </div>
  );
}

/** What the client saw next to the meal as the plan has it now, item by item. */
export default function ConflictComparison({ comparison, clientName, sawVersion, nowVersion, variant }: Props) {
  const { t, i18n } = useTranslation();
  const version = (value: number | undefined) =>
    value === undefined ? '' : ` · ${t('planEditor.syncConflicts.version', { version: value })}`;
  return (
    <div
      data-testid="conflict-comparison"
      className="grid grid-cols-2 gap-x-8 rounded-xl border border-line bg-card p-4"
    >
      <Column
        side="saw"
        label={`${t('planEditor.syncConflicts.saw', { name: clientName })}${version(sawVersion)}`}
        pairs={comparison.pairs}
        totalKcal={comparison.sawKcal}
        variant={variant}
        language={i18n.language}
      />
      <Column
        side="now"
        label={`${t('planEditor.syncConflicts.planNow')}${version(nowVersion)}`}
        pairs={comparison.pairs}
        totalKcal={comparison.nowKcal}
        variant={variant}
        language={i18n.language}
      />
    </div>
  );
}
