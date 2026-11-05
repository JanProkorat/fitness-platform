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
  /** Plan version the client ate; the label omits it when unknown. */
  sawVersion: number | undefined;
  /** Plan version now; the label omits it when unknown. */
  nowVersion: number | undefined;
}

type ChipStatus = Exclude<ComparePairStatus, 'same'>;

const CONFLICT_CHIP_CLASS: Record<ChipStatus, string> = {
  removed: 'bg-error-soft text-error',
  added: 'bg-success-soft text-success-ink',
  changed: 'bg-caution-soft text-caution-ink',
};

export function ConflictChip({ status }: { status: ChipStatus }) {
  const { t } = useTranslation();
  return (
    <span
      data-testid="conflict-chip"
      data-status={status}
      className={cn('rounded-full px-2 py-0.5 text-label font-semibold', CONFLICT_CHIP_CLASS[status])}
    >
      {t(`planEditor.syncConflicts.chip.${status}`)}
    </span>
  );
}

function Line({
  line,
  status,
  side,
  language,
}: {
  line: CompareLine | undefined;
  status: ComparePairStatus;
  side: 'saw' | 'now';
  language: string;
}) {
  const { t } = useTranslation();
  if (!line) {
    return <span className="text-muted-foreground">—</span>;
  }
  // What the coach removed is struck on the plan side, where the client's item is no longer.
  const struck = side === 'now' && status === 'removed';
  const changed = side === 'now' && status === 'changed';
  const chip: ChipStatus | null = side === 'now' && (status === 'removed' || status === 'added') ? status : null;
  const amount = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(line.amount);
  return (
    <span className="flex min-w-0 flex-col">
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span
          data-testid="conflict-item-name"
          className={cn('text-copy font-semibold text-ink [overflow-wrap:anywhere]', struck && 'line-through')}
        >
          {line.name}
        </span>
        {chip && <ConflictChip status={chip} />}
      </span>
      <span className={cn('text-body text-muted-foreground', changed && 'font-semibold text-caution-ink')}>
        {t(`planEditor.syncConflicts.amount.${line.unit}`, { amount })}
      </span>
    </span>
  );
}

function Column({
  side,
  label,
  pairs,
  total,
  language,
}: {
  side: 'saw' | 'now';
  label: string;
  pairs: readonly ComparePair[];
  total: string;
  language: string;
}) {
  return (
    <div data-testid={`conflict-column-${side}`} className="flex min-w-0 flex-col gap-2">
      <span className="border-b border-line pb-2 text-label font-bold tracking-label text-muted-foreground uppercase">
        {label}
      </span>
      {pairs.map((pair) => (
        <div key={pair.key} className="flex min-h-12 flex-col justify-center border-b border-line pb-2">
          <Line
            line={side === 'saw' ? pair.saw : (pair.now ?? (pair.status === 'removed' ? pair.saw : undefined))}
            status={pair.status}
            side={side}
            language={language}
          />
        </div>
      ))}
      <span className="text-copy font-semibold text-ink">{total}</span>
    </div>
  );
}

/** What the client ate next to the coach's change (which was not applied), item by item. */
export default function ConflictComparison({ comparison, clientName, sawVersion, nowVersion }: Props) {
  const { t, i18n } = useTranslation();
  const version = (value: number | undefined) =>
    value === undefined ? '' : ` · ${t('planEditor.syncConflicts.version', { version: value })}`;
  const gone = comparison.pairs.every((pair) => pair.status === 'removed');
  return (
    <div
      data-testid="conflict-comparison"
      className="grid grid-cols-2 gap-x-8 rounded-xl border border-line bg-card p-4"
    >
      <Column
        side="saw"
        label={`${t('planEditor.syncConflicts.saw', { name: clientName })}${version(sawVersion)}`}
        pairs={comparison.pairs}
        total={t('planEditor.syncConflicts.ate', { kcal: formatKcal(comparison.sawKcal, i18n.language) })}
        language={i18n.language}
      />
      <Column
        side="now"
        label={`${t('planEditor.syncConflicts.planNow')}${version(nowVersion)} · ${t('planEditor.syncConflicts.notApplied')}`}
        pairs={comparison.pairs}
        total={
          gone
            ? t('planEditor.syncConflicts.notInPlan')
            : t('planEditor.syncConflicts.wouldBe', { kcal: formatKcal(comparison.nowKcal, i18n.language) })
        }
        language={i18n.language}
      />
    </div>
  );
}
