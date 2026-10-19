import { z } from 'zod';
import {
  AutomationActionType,
  AutomationAudience,
  AutomationEventType,
  AutomationOffsetDirection,
  AutomationScheduleUnit,
  AutomationTriggerKind,
  type AutomationRuleDto,
  type UpdateAutomationRuleRequest,
} from '@/api/automations';

export const NAME_MAX = 100;
export const MESSAGE_MAX = 1000;
export const PHOTO_MESSAGE_MAX = 500;
export const DEFAULT_EVENT_TIME = '09:00';
export const DEFAULT_SCHEDULE_TIME = '09:00';
export const STOP_AFTER_DEFAULT = '5';

/** Where the drawer is used: the global page, a client's own rule, or a client's override of a global rule. */
export type AutomationDrawerVariant = 'global' | 'clientOnly' | 'override';

export const PLAN_EVENTS: readonly AutomationEventType[] = [
  AutomationEventType.PlanStarted,
  AutomationEventType.PlanEnded,
];

/** Events a coach can pick; payment events do not exist in this set. */
export const EVENT_TYPES: readonly AutomationEventType[] = [
  AutomationEventType.ClientJoined,
  AutomationEventType.PlanStarted,
  AutomationEventType.PlanEnded,
  AutomationEventType.CheckInMissed,
  AutomationEventType.ClientInactive,
  AutomationEventType.FormAnswered,
];

export const isPlanEvent = (eventType: AutomationEventType): boolean => PLAN_EVENTS.includes(eventType);

/** The message limit follows the action: progress photos allow fewer characters. */
export function messageLimitFor(actionType: AutomationActionType): number {
  return actionType === AutomationActionType.RequestProgressPhotos ? PHOTO_MESSAGE_MAX : MESSAGE_MAX;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const INT_PATTERN = /^\d+$/;

const numberInRange = (value: string, min: number, max: number): boolean => {
  if (!INT_PATTERN.test(value.trim())) {
    return false;
  }
  const parsed = Number(value);
  return parsed >= min && parsed <= max;
};

export const automationRuleSchema = z
  .object({
    name: z.string(),
    actionType: z.enum(AutomationActionType),
    questionnaireId: z.string(),
    message: z.string(),
    triggerKind: z.enum(AutomationTriggerKind),
    scheduleInterval: z.string(),
    scheduleUnit: z.enum(AutomationScheduleUnit),
    localTime: z.string(),
    eventType: z.enum(AutomationEventType),
    eventOffsetDays: z.string(),
    eventOffsetDirection: z.enum(AutomationOffsetDirection),
    audience: z.enum(AutomationAudience),
    audienceTagId: z.string(),
    audienceClientIds: z.array(z.string()),
    skipWhilePreviousUnanswered: z.boolean(),
    stopAfterEnabled: z.boolean(),
    stopAfterSends: z.string(),
    oncePerPlan: z.boolean(),
    enabled: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: keyof AutomationRuleFormValues, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    const name = values.name.trim();
    if (name.length === 0) {
      fail('name', 'automations.errors.nameRequired');
    } else if (name.length > NAME_MAX) {
      fail('name', 'automations.errors.nameTooLong');
    }

    if (values.message.length > messageLimitFor(values.actionType)) {
      fail(
        'message',
        values.actionType === AutomationActionType.RequestProgressPhotos
          ? 'apiErrors.AUTOMATION_PHOTO_MESSAGE_TOO_LONG'
          : 'automations.errors.messageTooLong',
      );
    }

    if (values.actionType === AutomationActionType.SendForm && values.questionnaireId === '') {
      fail('questionnaireId', 'automations.errors.formRequired');
    }

    if (values.triggerKind === AutomationTriggerKind.Schedule) {
      if (!numberInRange(values.scheduleInterval, 1, 365)) {
        fail('scheduleInterval', 'automations.errors.intervalRange');
      }
      if (!TIME_PATTERN.test(values.localTime)) {
        fail('localTime', 'automations.errors.timeRequired');
      }
    } else {
      const minOffset = values.eventType === AutomationEventType.ClientInactive ? 1 : 0;
      if (!numberInRange(values.eventOffsetDays, minOffset, 365)) {
        fail(
          'eventOffsetDays',
          minOffset === 1 ? 'automations.errors.offsetInactiveRange' : 'automations.errors.offsetRange',
        );
      }
      if (values.localTime !== '' && !TIME_PATTERN.test(values.localTime)) {
        fail('localTime', 'automations.errors.timeInvalid');
      }
    }

    if (values.stopAfterEnabled && !numberInRange(values.stopAfterSends, 1, 1000)) {
      fail('stopAfterSends', 'automations.errors.stopAfterRange');
    }

    if (values.audience === AutomationAudience.Tag && values.audienceTagId === '') {
      fail('audienceTagId', 'automations.errors.tagRequired');
    }
    if (values.audience === AutomationAudience.Chosen && values.audienceClientIds.length === 0) {
      fail('audienceClientIds', 'automations.errors.clientsRequired');
    }
  });

export type AutomationRuleFormValues = z.infer<typeof automationRuleSchema>;

/** Fields that decide who is covered and when, so the saved-rule summary stops describing them once edited. */
export const SUMMARY_SENSITIVE_FIELDS = [
  'triggerKind',
  'scheduleInterval',
  'scheduleUnit',
  'localTime',
  'eventType',
  'eventOffsetDays',
  'eventOffsetDirection',
  'audience',
  'audienceTagId',
  'audienceClientIds',
] as const satisfies readonly (keyof AutomationRuleFormValues)[];

export function summarySensitiveSnapshot(values: AutomationRuleFormValues): string {
  return JSON.stringify(SUMMARY_SENSITIVE_FIELDS.map((field) => values[field]));
}

export function defaultRuleValues(): AutomationRuleFormValues {
  return {
    name: '',
    actionType: AutomationActionType.SendForm,
    questionnaireId: '',
    message: '',
    triggerKind: AutomationTriggerKind.Schedule,
    scheduleInterval: '1',
    scheduleUnit: AutomationScheduleUnit.Weeks,
    localTime: DEFAULT_SCHEDULE_TIME,
    eventType: AutomationEventType.ClientJoined,
    eventOffsetDays: '0',
    eventOffsetDirection: AutomationOffsetDirection.After,
    audience: AutomationAudience.All,
    audienceTagId: '',
    audienceClientIds: [],
    skipWhilePreviousUnanswered: true,
    stopAfterEnabled: false,
    stopAfterSends: STOP_AFTER_DEFAULT,
    oncePerPlan: false,
    enabled: true,
  };
}

/** The server sends a time of day as HH:mm:ss; the form works in HH:mm. */
function toFormTime(time: string | undefined): string {
  return time ? time.slice(0, 5) : '';
}

export function ruleToFormValues(rule: AutomationRuleDto): AutomationRuleFormValues {
  const defaults = defaultRuleValues();
  const isEvent = rule.triggerKind === AutomationTriggerKind.Event;
  const audience = rule.audience ?? AutomationAudience.All;
  return {
    ...defaults,
    name: rule.name ?? '',
    actionType: rule.actionType ?? defaults.actionType,
    questionnaireId: rule.questionnaireId ?? '',
    message: rule.message ?? '',
    triggerKind: rule.triggerKind ?? defaults.triggerKind,
    scheduleInterval: rule.scheduleInterval != null ? String(rule.scheduleInterval) : defaults.scheduleInterval,
    scheduleUnit: rule.scheduleUnit ?? defaults.scheduleUnit,
    localTime: isEvent ? toFormTime(rule.localTime) || DEFAULT_EVENT_TIME : toFormTime(rule.localTime),
    eventType: rule.eventType ?? defaults.eventType,
    eventOffsetDays: rule.eventOffsetDays != null ? String(rule.eventOffsetDays) : defaults.eventOffsetDays,
    eventOffsetDirection: rule.eventOffsetDirection ?? defaults.eventOffsetDirection,
    audience,
    audienceTagId: audience === AutomationAudience.Tag ? (rule.tag?.tagId ?? '') : '',
    audienceClientIds:
      audience === AutomationAudience.Chosen ? (rule.clients ?? []).flatMap((c) => (c.clientId ? [c.clientId] : [])) : [],
    skipWhilePreviousUnanswered: rule.skipWhilePreviousUnanswered ?? defaults.skipWhilePreviousUnanswered,
    stopAfterEnabled: rule.stopAfterSends != null,
    stopAfterSends: rule.stopAfterSends != null ? String(rule.stopAfterSends) : STOP_AFTER_DEFAULT,
    oncePerPlan: rule.oncePerPlan ?? false,
    enabled: rule.enabled ?? true,
  };
}

/**
 * Builds the save request from the form. The audience is left out for a client-only rule,
 * where the backend requires it to be null.
 */
export function formValuesToRequest(
  values: AutomationRuleFormValues,
  variant: AutomationDrawerVariant = 'global',
): UpdateAutomationRuleRequest {
  const isSchedule = values.triggerKind === AutomationTriggerKind.Schedule;
  const planEvent = !isSchedule && isPlanEvent(values.eventType);
  const request: UpdateAutomationRuleRequest = {
    name: values.name.trim(),
    actionType: values.actionType,
    questionnaireId: values.actionType === AutomationActionType.SendForm ? values.questionnaireId : undefined,
    message: values.message.trim() === '' ? undefined : values.message,
    triggerKind: values.triggerKind,
    scheduleInterval: isSchedule ? Number(values.scheduleInterval) : undefined,
    scheduleUnit: isSchedule ? values.scheduleUnit : undefined,
    localTime: values.localTime === '' ? undefined : values.localTime,
    eventType: isSchedule ? undefined : values.eventType,
    eventOffsetDays: isSchedule ? undefined : Number(values.eventOffsetDays),
    eventOffsetDirection: isSchedule ? undefined : planEvent ? values.eventOffsetDirection : AutomationOffsetDirection.After,
    oncePerPlan: planEvent && values.oncePerPlan,
    skipWhilePreviousUnanswered: values.skipWhilePreviousUnanswered,
    stopAfterSends: values.stopAfterEnabled ? Number(values.stopAfterSends) : undefined,
    enabled: values.enabled,
  };

  if (variant === 'global') {
    request.audience = values.audience;
    request.audienceTagId = values.audience === AutomationAudience.Tag ? values.audienceTagId : undefined;
    request.audienceClientIds = values.audience === AutomationAudience.Chosen ? values.audienceClientIds : [];
  }
  return request;
}

/** A whole-rule PUT that flips only the enabled flag; the audience is omitted so the server keeps it. */
export function ruleToToggleRequest(rule: AutomationRuleDto, enabled: boolean): UpdateAutomationRuleRequest {
  const values = { ...ruleToFormValues(rule), enabled };
  const request = formValuesToRequest(values, 'clientOnly');
  // Keep fields exactly as stored; a stored empty time on an event rule stays empty.
  if (rule.triggerKind === AutomationTriggerKind.Event && !rule.localTime) {
    request.localTime = undefined;
  }
  return request;
}
