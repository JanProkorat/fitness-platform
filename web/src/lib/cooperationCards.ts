import type { TFunction } from 'i18next';
import { useAuthStore } from '@/stores/auth';
import { useActiveRoles } from '@/hooks/useActiveRoles';
import {
  ChatEventType,
  ChatMessageKind,
  CooperationCardStatus,
  CooperationDirection,
  CooperationType,
  LinkCapabilityScope,
} from '@/api/generated';
import type { ConversationCooperationDto, MessageDto } from '@/api/generated';

/** How long an invite stays answerable. Mirrors the server's invite validity. */
export const INVITE_VALIDITY_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Within this many days a sent date reads as a weekday ("Fri"), older as a day and month. */
const WEEKDAY_WINDOW_DAYS = 6;

export type CooperationService = 'training' | 'nutrition';

/** Which right-hand panel a conversation shows, from its newest cooperation and the participant's client id. */
export type InboxPanelKind = 'pending' | 'invited' | 'client' | null;

/** The services a coach's own roles cover, in display order. */
export function useHeldServices(): CooperationService[] {
  const activeRoles = useActiveRoles();
  const tokenRoles = useAuthStore((s) => s.user?.roles ?? []);
  // While the coach-role lookup is pending or failed, fall back to the token (display only).
  const roles =
    activeRoles.isLoading || activeRoles.isError
      ? tokenRoles.map((role) => role.toLowerCase())
      : activeRoles.roles.map((role) => role.toLowerCase());
  const services: CooperationService[] = [];
  if (roles.includes('trainer')) {
    services.push('training');
  }
  if (roles.includes('nutritionist')) {
    services.push('nutrition');
  }
  return services;
}

/** The services an invite offered: its requested scope, falling back to the coach's held roles. */
export function resolveInviteServices(
  scope: LinkCapabilityScope | undefined,
  held: CooperationService[],
): CooperationService[] {
  switch (scope) {
    case LinkCapabilityScope.Both:
      return ['training', 'nutrition'];
    case LinkCapabilityScope.NutritionOnly:
      return ['nutrition'];
    case LinkCapabilityScope.TrainingOnly:
      return ['training'];
    default:
      return held;
  }
}

/** "Personal training", "Nutrition coaching" or both joined with " + ". */
export function formatServices(t: TFunction, services: CooperationService[]): string {
  return services.map((service) => t(`inbox.card.service.${service}`)).join(' + ');
}

/** Whole days left on an invite sent at `sentAtIso`, never negative. */
export function inviteDaysLeft(sentAtIso: string, now: number = Date.now()): number {
  const expiresAt = new Date(sentAtIso).getTime() + INVITE_VALIDITY_DAYS * MS_PER_DAY;
  return Math.max(0, Math.ceil((expiresAt - now) / MS_PER_DAY));
}

/** The expiry date of an invite sent at `sentAtIso`. */
export function inviteExpiresAt(sentAtIso: string): Date {
  return new Date(new Date(sentAtIso).getTime() + INVITE_VALIDITY_DAYS * MS_PER_DAY);
}

/** "Fri" within the last week, otherwise "16 Oct". Empty for an unparseable value. */
export function formatCardDate(iso: string, locale: string, now: number = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const ageDays = (now - date.getTime()) / MS_PER_DAY;
  if (ageDays >= 0 && ageDays < WEEKDAY_WINDOW_DAYS) {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  }
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** "today 10:42" for today, otherwise the card date. */
export function formatSentWhen(t: TFunction, iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  if (date.toDateString() === new Date().toDateString()) {
    return t('inbox.card.todayAt', {
      time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    });
  }
  return formatCardDate(iso, locale);
}

export function isOriginEvent(message: MessageDto): boolean {
  return (
    message.kind === ChatMessageKind.Event &&
    Boolean(message.eventSourceId) &&
    (message.eventType === ChatEventType.Invited || message.eventType === ChatEventType.Requested)
  );
}

function isFollowUpEvent(message: MessageDto): boolean {
  return (
    message.kind === ChatMessageKind.Event &&
    Boolean(message.eventSourceId) &&
    (message.eventType === ChatEventType.Accepted ||
      message.eventType === ChatEventType.Declined ||
      message.eventType === ChatEventType.Withdrawn)
  );
}

export interface ThreadCards {
  /** Messages to render, with folded follow-up events removed. */
  visible: MessageDto[];
  /** The newest follow-up event per source id, for the card's date. */
  followUps: Map<string, MessageDto>;
}

/**
 * Folds Accepted/Declined/Withdrawn events into the card of the invite or
 * request they answer. A follow-up whose card is not loaded stays visible as a pill.
 */
export function foldThreadCards(messages: MessageDto[]): ThreadCards {
  const originSources = new Set(messages.filter(isOriginEvent).map((message) => message.eventSourceId));
  const followUps = new Map<string, MessageDto>();
  const visible: MessageDto[] = [];

  for (const message of messages) {
    if (isFollowUpEvent(message) && originSources.has(message.eventSourceId)) {
      followUps.set(message.eventSourceId!, message);
      continue;
    }
    visible.push(message);
  }
  return { visible, followUps };
}

/** Pending requests and invites get their own panel; everything else is the client panel when a client id exists. */
export function getPanelKind(
  cooperation: ConversationCooperationDto | undefined,
  clientPublicId: string | undefined,
): InboxPanelKind {
  if (cooperation?.status === CooperationCardStatus.Pending) {
    if (cooperation.type === CooperationType.Request && cooperation.direction === CooperationDirection.Received) {
      return 'pending';
    }
    if (cooperation.type === CooperationType.Invite && cooperation.direction === CooperationDirection.Sent) {
      return 'invited';
    }
  }
  return clientPublicId ? 'client' : null;
}

/** First word of a display name, for "waiting for Klára to accept". */
export function firstName(name: string | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}
