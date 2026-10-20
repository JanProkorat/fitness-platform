import type { TFunction } from 'i18next';
import {
  AutomationActionType,
  AutomationEventType,
  AutomationOffsetDirection,
  AutomationScheduleUnit,
  AutomationTriggerKind,
  type AutomationRuleDto,
  type AutomationRuleSummaryDto,
} from '@/api/automations';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A calendar date (day and month, no weekday) in the coach's language, or an em dash when there is none.
 * A date-only value is read as a local day so no time zone moves it.
 */
export function formatNextSend(iso: string | undefined, language: string): string {
  if (!iso) {
    return '—';
  }
  const dateOnly = DATE_ONLY.exec(iso);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(date);
}

/** "16 clients", with " · 1 custom" / " · 1 paused" only when above zero. */
export function appliesToLabel(summary: AutomationRuleSummaryDto | undefined, t: TFunction): string {
  if (!summary) {
    return '—';
  }
  const parts = [t('automations.table.clients', { count: summary.clientCount ?? 0 })];
  if ((summary.customCount ?? 0) > 0) {
    parts.push(t('automations.table.custom', { count: summary.customCount }));
  }
  if ((summary.pausedCount ?? 0) > 0) {
    parts.push(t('automations.table.paused', { count: summary.pausedCount }));
  }
  return parts.join(' · ');
}

/** Drawer footer line for a saved rule; null when there is no summary to show. */
export function summaryFooter(
  summary: AutomationRuleSummaryDto | undefined,
  t: TFunction,
  language: string,
): string | null {
  if (!summary) {
    return null;
  }
  const count = summary.clientCount ?? 0;
  if (summary.nextSendAt) {
    return t('automations.drawer.footer.next', { date: formatNextSend(summary.nextSendAt, language), count });
  }
  return t('automations.drawer.footer.appliesTo', { count });
}

/** The row's "When" cell. Never names a weekday. */
export function whenLabel(rule: AutomationRuleDto, t: TFunction): string {
  const time = (rule.localTime ?? '09:00:00').slice(0, 5);
  if (rule.triggerKind === AutomationTriggerKind.Schedule) {
    const key = rule.scheduleUnit === AutomationScheduleUnit.Days ? 'everyDays' : 'everyWeeks';
    return t(`automations.table.${key}`, { count: rule.scheduleInterval ?? 1, time });
  }
  const event = rule.eventType ? t(`automations.events.${rule.eventType}`) : '';
  const days = rule.eventOffsetDays ?? 0;
  if (days === 0) {
    return event;
  }
  if (rule.eventType === AutomationEventType.ClientInactive) {
    return t('automations.table.offsetInactive', { event, count: days });
  }
  const isBefore = rule.eventOffsetDirection === AutomationOffsetDirection.Before;
  const phrase = t(`automations.table.${isBefore ? 'eventsBefore' : 'eventsAfter'}.${rule.eventType}`);
  return t(`automations.table.${isBefore ? 'offsetBefore' : 'offsetAfter'}`, { event: phrase, count: days });
}

export type AutomationTileTone = 'form' | 'photos' | 'measurements' | 'checkIn';

/** The icon tile tone for a rule's action. */
export function toneForAction(action: AutomationActionType | undefined): AutomationTileTone {
  switch (action) {
    case AutomationActionType.RequestProgressPhotos:
      return 'photos';
    case AutomationActionType.RequestMeasurements:
      return 'measurements';
    default:
      return 'form';
  }
}

/** The row's subtitle, derived from the action. */
export function subtitleFor(rule: AutomationRuleDto, formTitle: string | undefined, t: TFunction): string {
  switch (rule.actionType) {
    case AutomationActionType.SendForm:
      return formTitle ? t('automations.table.subtitleForm', { name: formTitle }) : t('automations.table.subtitleFormUnknown');
    case AutomationActionType.RequestProgressPhotos:
      return t('automations.table.subtitlePhotos');
    default:
      return t('automations.table.subtitleMeasurements');
  }
}
