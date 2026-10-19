import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Calendar, Camera, CheckSquare, Clock, FileText, Flag, MoreHorizontal, Ruler } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AutomationActionType,
  AutomationTriggerKind,
  type AutomationLinkedCheckInDto,
  type AutomationRuleDto,
} from '@/api/automations';
import { appliesToLabel, formatNextSend, subtitleFor, whenLabel } from '@/components/automations/automationFormat';

const SKELETON_ROW_COUNT = 4;
const COLUMN_COUNT = 7;
const HEAD_CLASS = 'px-4 py-3.5 text-meta font-semibold';
const CELL_CLASS = 'px-4 py-2.75';

const ACTION_ICON: Record<AutomationActionType, ReactNode> = {
  [AutomationActionType.SendForm]: <FileText className="size-4.5" aria-hidden="true" />,
  [AutomationActionType.RequestProgressPhotos]: <Camera className="size-4.5" aria-hidden="true" />,
  [AutomationActionType.RequestMeasurements]: <Ruler className="size-4.5" aria-hidden="true" />,
};

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-marker-text">
      {children}
    </span>
  );
}

interface Props {
  rules: AutomationRuleDto[];
  linkedCheckIns: AutomationLinkedCheckInDto[];
  /** Questionnaire titles by public id, for the "Form · name" subtitle. */
  formTitles: ReadonlyMap<string, string>;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Rule ids whose On switch is saving. */
  togglingIds: ReadonlySet<string>;
  onEdit: (rule: AutomationRuleDto) => void;
  onToggle: (rule: AutomationRuleDto, enabled: boolean) => void;
  onDelete: (rule: AutomationRuleDto) => void;
}

/** The global rules list: linked weekly check-in rows first, then the coach's rules. */
export default function AutomationsTable({
  rules,
  linkedCheckIns,
  formTitles,
  isPending,
  isError,
  onRetry,
  togglingIds,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  const { t, i18n } = useTranslation();

  return (
    <Table className="min-w-220">
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow>
          <TableHead className={HEAD_CLASS}>{t('automations.table.columnRule')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('automations.table.columnWhen')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('automations.table.columnAction')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('automations.table.columnAppliesTo')}</TableHead>
          <TableHead className={HEAD_CLASS}>{t('automations.table.columnNextSend')}</TableHead>
          <TableHead className={`w-24 ${HEAD_CLASS}`}>{t('automations.table.columnOn')}</TableHead>
          <TableHead className="w-12 px-4 py-3.5">
            <span className="sr-only">{t('automations.table.columnActions')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isPending &&
          Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
            <TableRow key={index}>
              <TableCell colSpan={COLUMN_COUNT}>
                <Skeleton className="h-10 w-full" />
              </TableCell>
            </TableRow>
          ))}

        {!isPending && isError && (
          <TableRow>
            <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center">
              <div className="flex flex-col items-center gap-3">
                <p className="text-body text-muted-foreground">{t('automations.loadError')}</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  {t('automations.retry')}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )}

        {!isPending &&
          !isError &&
          linkedCheckIns.map((checkIn) => (
            <TableRow key={`checkin-${checkIn.profession}`} className="border-line">
              <TableCell className={CELL_CLASS}>
                <div className="flex items-center gap-3">
                  <IconTile>
                    <CheckSquare className="size-4.5" aria-hidden="true" />
                  </IconTile>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-copy font-semibold text-ink">{t('automations.linked.title')}</span>
                    <span className="truncate text-meta text-muted-foreground">
                      {t(`automations.linked.subtitle.${checkIn.profession}`)}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className={`${CELL_CLASS} text-body text-ink-2`}>
                <span className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
                  {t('automations.linked.when')}
                </span>
              </TableCell>
              <TableCell className={`${CELL_CLASS} text-body text-ink-2`}>{t('automations.linked.action')}</TableCell>
              <TableCell className={`${CELL_CLASS} text-body text-ink-2`}>
                {t('automations.table.clients', { count: checkIn.clientCount ?? 0 })}
              </TableCell>
              <TableCell className={CELL_CLASS}>
                <span className="rounded-full bg-sunken px-2.5 py-1 text-meta font-semibold text-ink-2">
                  {t('automations.linked.badge')}
                </span>
              </TableCell>
              <TableCell className={CELL_CLASS}>
                <span className="flex items-center gap-3 text-body">
                  {checkIn.enabled === false && (
                    <span className="text-muted-foreground">{t('automations.linked.off')}</span>
                  )}
                  <Link to="/forms?type=CheckIn" className="font-semibold text-ink underline underline-offset-2">
                    {t('automations.linked.open')}
                  </Link>
                </span>
              </TableCell>
              <TableCell className={CELL_CLASS} />
            </TableRow>
          ))}

        {!isPending && !isError && rules.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center text-body text-muted-foreground">
              {t('automations.empty')}
            </TableCell>
          </TableRow>
        )}

        {!isPending &&
          !isError &&
          rules.map((rule) => {
            const ruleId = rule.ruleId ?? '';
            const name = rule.name ?? '';
            const formTitle = rule.questionnaireId ? formTitles.get(rule.questionnaireId) : undefined;
            const isEvent = rule.triggerKind === AutomationTriggerKind.Event;
            return (
              <TableRow key={ruleId} className="cursor-pointer border-line" onClick={() => onEdit(rule)}>
                <TableCell className={CELL_CLASS}>
                  <div className="flex items-center gap-3">
                    <IconTile>{ACTION_ICON[rule.actionType ?? AutomationActionType.SendForm]}</IconTile>
                    <div className="flex min-w-0 max-w-80 flex-col">
                      <button
                        type="button"
                        className="truncate text-left text-copy font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(rule);
                        }}
                      >
                        {name}
                      </button>
                      <span className="truncate text-meta text-muted-foreground">
                        {subtitleFor(rule, formTitle, t)}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={`${CELL_CLASS} text-body text-ink-2`}>
                  <span className="flex items-center gap-2">
                    {isEvent ? (
                      <Flag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    {whenLabel(rule, t)}
                  </span>
                </TableCell>
                <TableCell className={`${CELL_CLASS} text-body text-ink-2`}>
                  {t(`automations.actions.${rule.actionType ?? AutomationActionType.SendForm}`)}
                </TableCell>
                <TableCell className={`${CELL_CLASS} text-body text-ink-2`}>{appliesToLabel(rule.summary, t)}</TableCell>
                <TableCell className={`${CELL_CLASS} text-body text-ink-2`}>
                  {formatNextSend(rule.summary?.nextSendAt, i18n.language)}
                </TableCell>
                <TableCell className={CELL_CLASS} onClick={(event) => event.stopPropagation()}>
                  <Switch
                    checked={rule.enabled ?? false}
                    disabled={togglingIds.has(ruleId)}
                    onCheckedChange={(checked) => onToggle(rule, checked)}
                    aria-label={t('automations.table.toggle', { name })}
                  />
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('automations.rowMenu.open', { name })}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenuItem onSelect={() => onEdit(rule)}>{t('automations.rowMenu.edit')}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(rule)}>
                        {t('automations.rowMenu.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
